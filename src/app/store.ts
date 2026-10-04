import { create } from "zustand";
import {
  clone,
  uid,
  type Workflow,
  type FlowNode,
  type FlowEdge,
  type NodeKind,
  type Run,
  defaultConfig,
  labels,
} from "../lib/model";
import { repository } from "../lib/storage";
import { templates, fromTemplate, emptyWorkflow } from "../lib/templates";
import { Engine, interrupted } from "../lib/engine";
import { acquireOwner, releaseOwner } from "../lib/ownership";
export type Page = "editor" | "library" | "templates" | "history" | "guide";
type State = {
  workflows: Workflow[];
  workflow?: Workflow;
  runs: Run[];
  run?: Run;
  selected?: string;
  page: Page;
  theme: "dark" | "light";
  loaded: boolean;
  saveState: "saved" | "saving" | "error";
  saveError?: string;
  notice?: string;
  past: Workflow[];
  future: Workflow[];
  clipboard: FlowNode[];
  clipboardEdges: FlowEdge[];
  revision: number;
  pausePending: boolean;
  setPage: (page: Page) => void;
  select: (id?: string) => void;
  edit: (fn: (w: Workflow) => void, group?: boolean) => void;
  undo: () => void;
  redo: () => void;
  open: (w: Workflow) => void;
  add: (kind: NodeKind, position?: { x: number; y: number }) => void;
  toast: (message?: string) => void;
};
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let historyTimer: ReturnType<typeof setTimeout> | undefined;
let groupOpen = false;
let saveQueue = Promise.resolve();
export const useApp = create<State>((set, get) => ({
  workflows: [],
  runs: [],
  page: "editor",
  theme: "dark",
  loaded: false,
  saveState: "saved",
  past: [],
  future: [],
  clipboard: [],
  clipboardEdges: [],
  revision: 0,
  pausePending: false,
  setPage: (page) => {
    location.hash = page;
    set({ page });
  },
  select: (selected) => set({ selected }),
  toast: (notice) => set({ notice }),
  edit: (fn, group = false) => {
    const s = get();
    if (!s.workflow || isLocked()) return;
    const w = clone(s.workflow);
    fn(w);
    w.updatedAt = Date.now();
    const past =
      group && groupOpen ? s.past : [...s.past, clone(s.workflow)].slice(-50);
    groupOpen = group;
    clearTimeout(historyTimer);
    historyTimer = setTimeout(() => {
      groupOpen = false;
    }, 700);
    set({
      workflow: w,
      past,
      future: [],
      revision: s.revision + 1,
      saveState: "saving",
      run: undefined,
    });
    scheduleSave();
  },
  undo: () => {
    const s = get();
    if (!s.workflow || !s.past.length || isLocked()) return;
    const w = s.past.at(-1)!;
    set({
      workflow: clone(w),
      past: s.past.slice(0, -1),
      future: [clone(s.workflow), ...s.future],
      saveState: "saving",
      revision: s.revision + 1,
    });
    scheduleSave();
  },
  redo: () => {
    const s = get();
    if (!s.workflow || !s.future.length || isLocked()) return;
    set({
      workflow: clone(s.future[0]),
      past: [...s.past, clone(s.workflow)],
      future: s.future.slice(1),
      saveState: "saving",
      revision: s.revision + 1,
    });
    scheduleSave();
  },
  open: (w) => {
    void flushSave();
    set({
      workflow: clone(w),
      selected: undefined,
      past: [],
      future: [],
      run: undefined,
      page: "editor",
      saveState: get().workflows.some(
        (v) => v.id === w.id && v.updatedAt === w.updatedAt,
      )
        ? "saved"
        : "saving",
      revision: get().revision + 1,
    });
    location.hash = "editor";
  },
  add: (kind, position) => {
    const s = get();
    if ((s.workflow?.nodes.length ?? 0) >= 100) {
      s.toast("حداکثر ۱۰۰ بلوک مجاز است.");
      return;
    }
    if (
      s.workflow?.nodes.some((n) => n.config.type === "input") &&
      kind === "input"
    ) {
      s.toast("هر گردش‌کار فقط یک ورودی دارد.");
      return;
    }
    const id = uid();
    s.edit((w) =>
      w.nodes.push({
        id,
        label: labels[kind],
        config: defaultConfig(kind),
        position: position ?? {
          x: 120 + (w.nodes.length % 5) * 290,
          y: 160 + Math.floor(w.nodes.length / 5) * 210,
        },
      }),
    );
    s.select(id);
  },
}));
export function isLocked() {
  const run = useApp.getState().run;
  return !!run && ["running", "paused", "interrupted"].includes(run.status);
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flushSave(), 450);
}
export async function flushSave() {
  clearTimeout(saveTimer);
  const s = useApp.getState();
  if (!s.workflow || s.saveState === "saved") return;
  const w = clone(s.workflow),
    revision = s.revision;
  saveQueue = saveQueue.then(async () => {
    try {
      await repository.saveWorkflow(w);
      useApp.setState((state) => ({
        workflows: [w, ...state.workflows.filter((v) => v.id !== w.id)],
        ...(state.revision === revision
          ? { saveState: "saved" as const, saveError: undefined }
          : {}),
      }));
    } catch (e) {
      useApp.setState((state) =>
        state.revision === revision && state.workflow?.id === w.id
          ? {
              saveState: "error",
              saveError: e instanceof Error ? e.message : "ذخیره انجام نشد.",
            }
          : {},
      );
    }
  });
  await saveQueue;
}
export async function initialize() {
  try {
    let workflows = await repository.listWorkflows();
    const savedRuns = await repository.listRuns();
    const theme = await repository.preference("theme");
    let runs = savedRuns;
    const owner = await acquireOwner().catch(() => false);
    if (owner) {
      runs = savedRuns.map(interrupted);
      for (const run of runs)
        if (run.status === "interrupted") await repository.saveRun(run);
      releaseOwner();
    }
    if (!workflows.length) {
      const w = fromTemplate(templates[0]);
      w.nodes.forEach((n) => {
        if (n.config.type === "http") n.config.transport = "fixture";
      });
      workflows = [w];
      await repository.saveWorkflow(w);
    }
    const pages: Page[] = [
      "editor",
      "library",
      "templates",
      "history",
      "guide",
    ];
    const page = pages.find((p) => p === location.hash.slice(1)) ?? "editor";
    useApp.setState({
      workflows,
      workflow: clone(workflows[0]),
      runs,
      theme: theme === "light" ? "light" : "dark",
      loaded: true,
      page,
    });
  } catch (e) {
    useApp.setState({
      loaded: true,
      saveState: "error",
      saveError: e instanceof Error ? e.message : "اطلاعات بارگذاری نشد.",
      workflow: fromTemplate(templates[0]),
    });
  }
}
export async function createWorkflow(template?: Workflow) {
  if (isLocked()) {
    useApp.getState().toast("پیش از تغییر گردش‌کار، اجرا را لغو یا تمام کن.");
    return;
  }
  const w = template ? fromTemplate(template) : emptyWorkflow();
  useApp.getState().open(w);
  useApp.setState({ saveState: "saving" });
  await flushSave();
}
export async function removeWorkflow(id: string) {
  if (isLocked()) return;
  try {
    await flushSave();
    await repository.deleteWorkflow(id);
    const remaining = useApp.getState().workflows.filter((w) => w.id !== id);
    useApp.setState({ workflows: remaining });
    if (useApp.getState().workflow?.id === id) {
      if (remaining.length) useApp.getState().open(remaining[0]);
      else await createWorkflow();
    }
  } catch (e) {
    useApp.getState().toast(String(e));
  }
}
export const engine = new Engine({
  save: repository.saveRun,
  change: (run) => {
    useApp.setState((s) => ({
      run,
      runs: [run, ...s.runs.filter((r) => r.id !== run.id)],
      pausePending: run.status === "running" ? s.pausePending : false,
    }));
    if (["succeeded", "failed", "cancelled"].includes(run.status))
      releaseOwner();
  },
});
export async function execute(step = false, resume?: Run, unsafe = false) {
  try {
    if (!(await acquireOwner()))
      throw new Error(
        "اجرا در یک زبانهٔ دیگر فعال است؛ در همان زبانه آن را تمام یا لغو کن.",
      );
    const w = useApp.getState().workflow;
    if (resume) {
      useApp.setState({
        workflow: clone(resume.workflow),
        run: resume,
        selected: undefined,
        page: "editor",
      });
      location.hash = "editor";
      await engine.resume(resume, step, unsafe);
    } else if (w) {
      await flushSave();
      const saved = useApp.getState();
      if (saved.saveState !== "saved" || saved.workflow?.id !== w.id)
        throw new Error(
          saved.saveError ??
            "گردش‌کار ذخیره نشد؛ پیش از اجرا ذخیره را دوباره امتحان کن.",
        );
      await engine.start(w, step);
    }
  } catch (e) {
    useApp.getState().toast(e instanceof Error ? e.message : "اجرا شروع نشد.");
    if (
      !engine.current ||
      !["running", "paused"].includes(engine.current.status)
    )
      releaseOwner();
  }
}
export async function cancelRun() {
  const r = useApp.getState().run;
  if (r && engine.current?.id !== r.id) {
    engine.current = clone(r);
  }
  await engine.cancel();
  if (engine.current?.status === "cancelled") releaseOwner();
}
export function copyNodes(ids: string[]) {
  const w = useApp.getState().workflow;
  if (w)
    useApp.setState({
      clipboard: clone(w.nodes.filter((n) => ids.includes(n.id))),
      clipboardEdges: clone(
        w.edges.filter((e) => ids.includes(e.source) && ids.includes(e.target)),
      ),
    });
}
export function pasteNodes() {
  const s = useApp.getState();
  if (!s.clipboard.length) return;
  const nodes = s.clipboard.filter((n) => n.config.type !== "input");
  if (!nodes.length) {
    s.toast("ورودی دوم مجاز نیست؛ از خود ورودی استفاده کن.");
    return;
  }
  if ((s.workflow?.nodes.length ?? 0) + nodes.length > 100) {
    s.toast("حداکثر ۱۰۰ بلوک مجاز است.");
    return;
  }
  s.edit((w) => {
    const ids = new Map(nodes.map((n) => [n.id, uid()]));
    for (const n of nodes)
      w.nodes.push({
        ...clone(n),
        id: ids.get(n.id)!,
        label: (n.label + " (کپی)").slice(0, 100),
        position: { x: n.position.x + 40, y: n.position.y + 80 },
      });
    for (const e of s.clipboardEdges)
      if (ids.has(e.source) && ids.has(e.target))
        w.edges.push({
          ...e,
          id: uid(),
          source: ids.get(e.source)!,
          target: ids.get(e.target)!,
        });
  });
}
export async function setTheme() {
  const theme = useApp.getState().theme === "dark" ? "light" : "dark";
  useApp.setState({ theme });
  try {
    await repository.setPreference("theme", theme);
  } catch (e) {
    useApp.getState().toast(String(e));
  }
}
