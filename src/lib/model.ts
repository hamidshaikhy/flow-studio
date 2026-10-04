import { z } from "zod";
z.config(z.locales.fa());

export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };
export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ]),
);
export const pathSchema = z
  .string()
  .max(200)
  .refine(
    (s) =>
      !s
        .split(".")
        .some((p) => ["__proto__", "prototype", "constructor"].includes(p)),
    "این مسیر مجاز نیست",
  );
const ruleShape = {
  path: pathSchema,
  operator: z.enum(["eq", "neq", "gt", "lt", "contains", "exists"]),
  value: jsonSchema,
};
export const ruleSchema = z.object(ruleShape);
const input = z.object({ type: z.literal("input"), value: jsonSchema });
const http = z.object({
  type: z.literal("http"),
  url: z
    .string()
    .url()
    .refine((s) => /^https?:\/\//.test(s), "فقط HTTP و HTTPS"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  transport: z.enum(["live", "fixture"]),
  query: z.record(z.string(), z.string()),
  headers: z
    .record(z.string(), z.string())
    .refine(
      (h) =>
        !Object.keys(h).some((k) =>
          /authorization|cookie|api[-_]?key|token/i.test(k),
        ),
      "کلید محرمانه و احراز هویت در این پروژه ذخیره نمی‌شود",
    ),
  body: jsonSchema,
  responsePath: pathSchema,
  timeout: z.number().int().min(100).max(60000),
  mappings: z
    .array(
      z.object({
        from: pathSchema,
        to: z.string().min(1),
        target: z.enum(["query", "body"]),
      }),
    )
    .max(30),
  fault: z.enum(["none", "http", "timeout", "json"]),
});
const filter = z.object({ type: z.literal("filter"), ...ruleShape });
const sort = z.object({
  type: z.literal("sort"),
  path: pathSchema,
  direction: z.enum(["asc", "desc"]),
  mode: z.enum(["number", "string"]),
});
const condition = z.object({ type: z.literal("condition"), ...ruleShape });
const delay = z.object({
  type: z.literal("delay"),
  ms: z.number().int().min(0).max(60000),
});
const output = z.object({
  type: z.literal("output"),
  view: z.enum(["table", "json"]),
  columns: z.array(pathSchema).max(30),
});
export const configSchema = z.discriminatedUnion("type", [
  input,
  http,
  filter,
  sort,
  condition,
  delay,
  output,
]);
export type Config = z.infer<typeof configSchema>;
export type NodeKind = Config["type"];
export const nodeSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  config: configSchema,
});
export const edgeSchema = z.object({
  id: z.string().min(1),
  source: z.string(),
  target: z.string(),
  port: z.enum(["out", "true", "false"]),
});
export const workflowSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  nodes: z.array(nodeSchema).max(100),
  edges: z.array(edgeSchema).max(200),
  updatedAt: z.number(),
  createdAt: z.number(),
});
export type Workflow = z.infer<typeof workflowSchema>;
export type FlowNode = z.infer<typeof nodeSchema>;
export type FlowEdge = z.infer<typeof edgeSchema>;
export type Issue = {
  nodeId?: string;
  field: string;
  message: string;
  action: string;
};
export type NodeStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "cancelled"
  | "interrupted";
export type RunStatus =
  "running" | "paused" | "succeeded" | "failed" | "cancelled" | "interrupted";
export type Fault = { code: string; message: string; action: string };
export type NodeRecord = {
  status: NodeStatus;
  input?: Json;
  output?: Json;
  branch?: "true" | "false";
  startedAt?: number;
  endedAt?: number;
  error?: Fault;
  uncertain?: boolean;
};
export type Run = {
  schemaVersion: 1;
  id: string;
  workflow: Workflow;
  status: RunStatus;
  nodes: Record<string, NodeRecord>;
  events: {
    time: number;
    nodeId?: string;
    message: string;
    level: "info" | "error" | "success";
  }[];
  startedAt: number;
  updatedAt: number;
  endedAt?: number;
  error?: Fault;
};
export class FlowError extends Error {
  constructor(
    public code: string,
    message: string,
    public action = "تنظیمات این بلوک را بررسی کن.",
  ) {
    super(message);
    this.name = "FlowError";
  }
}
export function faultOf(e: unknown): Fault {
  return e instanceof FlowError
    ? { code: e.code, message: e.message, action: e.action }
    : {
        code: "UNKNOWN",
        message: e instanceof Error ? e.message : "خطای ناشناخته",
        action: "جزئیات تنظیمات را بررسی کن و دوباره اجرا کن.",
      };
}
export const uid = () => crypto.randomUUID();
export const clone = <T>(v: T): T => structuredClone(v);
export const labels: Record<NodeKind, string> = {
  input: "ورودی",
  http: "درخواست API",
  filter: "فیلتر",
  sort: "مرتب‌سازی",
  condition: "شرط",
  delay: "تأخیر",
  output: "خروجی",
};
export const descriptions: Record<NodeKind, string> = {
  input: "نقطهٔ شروع با دادهٔ JSON",
  http: "دریافت یا ارسال داده",
  filter: "انتخاب رکوردهای موردنظر",
  sort: "چینش داده‌ها بر اساس یک فیلد",
  condition: "انتخاب مسیر درست یا نادرست",
  delay: "مکث قابل لغو بین مراحل",
  output: "جدول، JSON و دریافت فایل",
};
export function defaultConfig(type: NodeKind): Config {
  switch (type) {
    case "input":
      return { type, value: { userId: 1 } };
    case "http":
      return {
        type,
        url: "https://jsonplaceholder.typicode.com/posts",
        method: "GET",
        transport: "fixture",
        query: {},
        headers: {},
        body: null,
        responsePath: "",
        timeout: 10000,
        mappings: [],
        fault: "none",
      };
    case "filter":
    case "condition":
      return {
        type,
        path: type === "condition" ? "userId" : "userId",
        operator: "eq",
        value: 1,
      };
    case "sort":
      return { type, path: "id", direction: "desc", mode: "number" };
    case "delay":
      return { type, ms: 8000 };
    case "output":
      return { type, view: "table", columns: [] };
  }
}
