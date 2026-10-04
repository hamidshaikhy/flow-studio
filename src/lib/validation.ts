import {
  configSchema,
  workflowSchema,
  type Workflow,
  type Issue,
  type FlowEdge,
} from "./model";
export function validate(w: Workflow): Issue[] {
  const issues: Issue[] = [];
  const add = (
    nodeId: string | undefined,
    field: string,
    message: string,
    action = "اتصال‌ها و تنظیمات را اصلاح کن.",
  ) => issues.push({ nodeId, field, message, action });
  if (!w.name.trim())
    add(
      undefined,
      "name",
      "نام گردش‌کار خالی است.",
      "یک نام برای گردش‌کار بنویس.",
    );
  if (w.nodes.length > 100)
    add(undefined, "nodes", "حداکثر ۱۰۰ بلوک مجاز است.");
  for (const n of w.nodes)
    if (!n.label.trim())
      add(n.id, "label", "نام بلوک خالی است.", "نام این بلوک را کامل کن.");
  const ids = new Set<string>();
  for (const n of w.nodes) {
    if (ids.has(n.id)) add(n.id, "id", "شناسهٔ تکراری بلوک");
    ids.add(n.id);
    const parsed = configSchema.safeParse(n.config);
    if (!parsed.success)
      for (const e of parsed.error.issues)
        add(n.id, e.path.join("."), e.message, "مقدار این فیلد را اصلاح کن.");
  }
  const entries = w.nodes.filter((n) => n.config.type === "input");
  if (entries.length !== 1)
    add(undefined, "graph", "دقیقاً یک بلوک ورودی لازم است.");
  const edgeIds = new Set<string>(),
    pairs = new Set<string>();
  for (const e of w.edges) {
    if (edgeIds.has(e.id) || pairs.has(`${e.source}|${e.port}|${e.target}`))
      add(e.target, "connection", "اتصال تکراری");
    edgeIds.add(e.id);
    pairs.add(`${e.source}|${e.port}|${e.target}`);
    const source = w.nodes.find((n) => n.id === e.source),
      target = w.nodes.find((n) => n.id === e.target);
    if (!source || !target) {
      add(undefined, "connection", "اتصال به بلوک حذف‌شده اشاره دارد.");
      continue;
    }
    if (source.id === target.id)
      add(source.id, "connection", "اتصال بلوک به خودش مجاز نیست.");
    if (source.config.type === "output")
      add(source.id, "connection", "خروجی باید آخرین بلوک مسیر باشد.");
    if (target.config.type === "input")
      add(target.id, "connection", "ورودی نمی‌تواند اتصال ورودی داشته باشد.");
    if (
      source.config.type === "condition" ? e.port === "out" : e.port !== "out"
    )
      add(source.id, "port", "پورت خروجی نامعتبر است.");
  }
  for (const n of w.nodes) {
    const incoming = w.edges.filter((e) => e.target === n.id),
      outgoing = w.edges.filter((e) => e.source === n.id);
    if (n.config.type !== "input" && incoming.length !== 1)
      add(
        n.id,
        "connection",
        incoming.length
          ? "ادغام چند ورودی پشتیبانی نمی‌شود."
          : "اتصال ورودی این بلوک خالی است.",
      );
    if (n.config.type !== "output" && !outgoing.length)
      add(n.id, "connection", "این مسیر به خروجی نمی‌رسد.");
    if (
      n.config.type === "condition" &&
      (!outgoing.some((e) => e.port === "true") ||
        !outgoing.some((e) => e.port === "false"))
    )
      add(n.id, "connection", "هر دو پورت درست و نادرست را متصل کن.");
  }
  const seen = new Set<string>(),
    stack = new Set<string>();
  const visit = (id: string) => {
    if (stack.has(id)) {
      add(id, "graph", "حلقه در گردش‌کار مجاز نیست.");
      return;
    }
    if (seen.has(id)) return;
    seen.add(id);
    stack.add(id);
    for (const e of w.edges.filter((e) => e.source === id)) visit(e.target);
    stack.delete(id);
  };
  for (const n of w.nodes) visit(n.id);
  if (entries.length === 1) {
    const reachable = new Set<string>();
    const reach = (id: string) => {
      if (reachable.has(id)) return;
      reachable.add(id);
      w.edges.filter((e) => e.source === id).forEach((e) => reach(e.target));
    };
    reach(entries[0].id);
    for (const n of w.nodes)
      if (!reachable.has(n.id))
        add(n.id, "graph", "این بلوک از ورودی قابل دسترسی نیست.");
  }
  if (!w.nodes.some((n) => n.config.type === "output"))
    add(undefined, "graph", "حداقل یک بلوک خروجی لازم است.");
  return issues;
}
export function connectionIssue(
  w: Workflow,
  edge: FlowEdge,
): string | undefined {
  if (w.edges.some((e) => e.target === edge.target && e.id !== edge.id))
    return "هر بلوک فقط یک ورودی می‌گیرد.";
  const issues = validate({
    ...w,
    edges: [...w.edges.filter((e) => e.id !== edge.id), edge],
  });
  return issues.find((i) =>
    /حلقه|پورت|خودش|حذف‌شده|آخرین|نمی‌تواند|تکراری/.test(i.message),
  )?.message;
}
export function importWorkflow(text: string): Workflow {
  const parsed = workflowSchema.safeParse(JSON.parse(text));
  if (!parsed.success)
    throw new Error(
      "ساختار یا نسخهٔ فایل معتبر نیست: " + parsed.error.issues[0].message,
    );
  const hard = validate(parsed.data).find((i) =>
    /حلقه|تکراری|پورت|حذف‌شده/.test(i.message),
  );
  if (hard) throw new Error(hard.message);
  return parsed.data;
}
export function order(w: Workflow): string[] {
  const result: string[] = [];
  const pending = new Set(w.nodes.map((n) => n.id));
  while (pending.size) {
    const ready = w.nodes.filter(
      (n) =>
        pending.has(n.id) &&
        w.edges
          .filter((e) => e.target === n.id)
          .every((e) => result.includes(e.source)),
    );
    if (!ready.length) throw new Error("گردش‌کار حلقه دارد.");
    for (const n of ready) {
      result.push(n.id);
      pending.delete(n.id);
    }
  }
  return result;
}
