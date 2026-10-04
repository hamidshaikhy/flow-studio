import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { z } from "zod";
import { validate } from "./validation";
import {
  workflowSchema,
  jsonSchema,
  FlowError,
  type Workflow,
  type Run,
} from "./model";
const fault = z.object({
  code: z.string(),
  message: z.string(),
  action: z.string(),
});
export const runSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string(),
    workflow: workflowSchema,
    status: z.enum([
      "running",
      "paused",
      "succeeded",
      "failed",
      "cancelled",
      "interrupted",
    ]),
    nodes: z.record(
      z.string(),
      z.object({
        status: z.enum([
          "pending",
          "running",
          "succeeded",
          "failed",
          "skipped",
          "cancelled",
          "interrupted",
        ]),
        input: jsonSchema.optional(),
        output: jsonSchema.optional(),
        branch: z.enum(["true", "false"]).optional(),
        startedAt: z.number().optional(),
        endedAt: z.number().optional(),
        error: fault.optional(),
        uncertain: z.boolean().optional(),
      }),
    ),
    events: z.array(
      z.object({
        time: z.number(),
        nodeId: z.string().optional(),
        message: z.string(),
        level: z.enum(["info", "error", "success"]),
      }),
    ),
    startedAt: z.number(),
    updatedAt: z.number(),
    endedAt: z.number().optional(),
    error: fault.optional(),
  })
  .refine(
    (run) =>
      validate(run.workflow).length === 0 &&
      Object.keys(run.nodes).length === run.workflow.nodes.length &&
      run.workflow.nodes.every((n) => {
        const record = run.nodes[n.id];
        return (
          !!record &&
          (record.status !== "succeeded" ||
            (Object.hasOwn(record, "output") &&
              (n.config.type !== "condition" || !!record.branch)))
        );
      }),
    "ساختار ذخیره‌شدهٔ اجرا ناقص یا ناسازگار است.",
  );
interface FlowDB extends DBSchema {
  workflows: { key: string; value: Workflow };
  runs: { key: string; value: Run };
  preferences: { key: string; value: string };
}
let connection: Promise<IDBPDatabase<FlowDB>> | undefined;
const db = () =>
  (connection ??= openDB<FlowDB>("flow-studio", 1, {
    upgrade(db) {
      db.createObjectStore("workflows", { keyPath: "id" });
      db.createObjectStore("runs", { keyPath: "id" });
      db.createObjectStore("preferences");
    },
    blocked() {
      window.dispatchEvent(
        new CustomEvent("storage-warning", {
          detail: "یک زبانهٔ دیگر اتصال پایگاه داده را نگه داشته است.",
        }),
      );
    },
    blocking() {
      void connection?.then((d) => d.close());
      connection = undefined;
    },
    terminated() {
      connection = undefined;
    },
  }).catch((error) => {
    connection = undefined;
    throw error;
  }));
async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw new FlowError(
      "STORAGE",
      "ذخیره‌سازی مرورگر در دسترس نیست: " +
        (e instanceof Error ? e.message : "خطا"),
      "فضای مرورگر را بررسی کن؛ فایل گردش‌کار را دریافت کن و ذخیره را دوباره امتحان کن.",
    );
  }
}
export const repository = {
  listWorkflows: () =>
    guarded(async () => {
      const d = await db();
      return (await d.getAll("workflows")).map((v) => workflowSchema.parse(v));
    }),
  saveWorkflow: (w: Workflow) =>
    guarded(async () => {
      const d = await db();
      const tx = d.transaction("workflows", "readwrite");
      await tx.store.put(workflowSchema.parse(w));
      await tx.done;
    }),
  deleteWorkflow: (id: string) =>
    guarded(async () => {
      const d = await db();
      await d.delete("workflows", id);
    }),
  listRuns: () =>
    guarded(async () => {
      const d = await db();
      return (await d.getAll("runs"))
        .map((v) => runSchema.parse(v))
        .sort((a, b) => b.startedAt - a.startedAt);
    }),
  saveRun: (run: Run) =>
    guarded(async () => {
      const d = await db();
      const tx = d.transaction("runs", "readwrite");
      await tx.store.put(runSchema.parse(run));
      await tx.done;
    }),
  clearRuns: () =>
    guarded(async () => {
      const d = await db();
      await d.clear("runs");
    }),
  preference: (key: string) =>
    guarded(async () => {
      const d = await db();
      return d.get("preferences", key);
    }),
  setPreference: (key: string, value: string) =>
    guarded(async () => {
      const d = await db();
      await d.put("preferences", value, key);
    }),
  clearAll: () =>
    guarded(async () => {
      const d = await db();
      const tx = d.transaction(
        ["workflows", "runs", "preferences"],
        "readwrite",
      );
      await Promise.all([
        tx.objectStore("workflows").clear(),
        tx.objectStore("runs").clear(),
        tx.objectStore("preferences").clear(),
      ]);
      await tx.done;
    }),
};
