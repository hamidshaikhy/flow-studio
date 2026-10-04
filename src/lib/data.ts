import { FlowError, type Json, type Config } from "./model";
export function getPath(data: Json, path: string): Json | undefined {
  if (!path) return data;
  const keys = path.split(".");
  if (keys.some((k) => ["__proto__", "constructor", "prototype"].includes(k)))
    throw new FlowError("PATH", "مسیر ناامن است.");
  let current: Json | undefined = data;
  for (const key of keys) {
    if (
      current === null ||
      typeof current !== "object" ||
      !Object.hasOwn(current, key)
    )
      return undefined;
    current = (current as Record<string, Json>)[key];
  }
  return current;
}
export function matches(
  data: Json,
  rule: Extract<Config, { type: "filter" | "condition" }>,
): boolean {
  const value = getPath(data, rule.path);
  switch (rule.operator) {
    case "exists":
      return value !== undefined;
    case "eq":
      return (
        value !== undefined &&
        JSON.stringify(value) === JSON.stringify(rule.value)
      );
    case "neq":
      return (
        value !== undefined &&
        JSON.stringify(value) !== JSON.stringify(rule.value)
      );
    case "gt":
      return (
        typeof value === "number" &&
        typeof rule.value === "number" &&
        value > rule.value
      );
    case "lt":
      return (
        typeof value === "number" &&
        typeof rule.value === "number" &&
        value < rule.value
      );
    case "contains":
      return typeof value === "string" && typeof rule.value === "string"
        ? value.includes(rule.value)
        : Array.isArray(value) &&
            value.some((v) => JSON.stringify(v) === JSON.stringify(rule.value));
  }
}
export function filterData(
  data: Json,
  c: Extract<Config, { type: "filter" }>,
): Json {
  if (!Array.isArray(data))
    throw new FlowError(
      "TYPE",
      "فیلتر به آرایه نیاز دارد.",
      "ورودی را بررسی کن؛ مسیر پاسخ API باید به آرایه برسد.",
    );
  return data.filter((v) => matches(v, c));
}
export function sortData(
  data: Json,
  c: Extract<Config, { type: "sort" }>,
): Json {
  if (!Array.isArray(data))
    throw new FlowError("TYPE", "مرتب‌سازی به آرایه نیاز دارد.");
  return data
    .map((v, i) => ({ v, i, key: getPath(v, c.path) }))
    .sort((a, b) => {
      const valid = (v: Json | undefined) =>
        c.mode === "number" ? typeof v === "number" : typeof v === "string";
      const av = valid(a.key),
        bv = valid(b.key);
      if (!av || !bv) return av ? -1 : bv ? 1 : a.i - b.i;
      const delta =
        c.mode === "number"
          ? Number(a.key) - Number(b.key)
          : String(a.key).localeCompare(String(b.key), "fa");
      return (c.direction === "desc" ? -delta : delta) || a.i - b.i;
    })
    .map((v) => v.v);
}
export function toCsv(data: Json, columns: string[]): string {
  const rows = Array.isArray(data) ? data : [data];
  const keys = columns.length
    ? columns
    : [
        ...new Set(
          rows.flatMap((v) =>
            v && typeof v === "object" && !Array.isArray(v)
              ? Object.keys(v)
              : ["value"],
          ),
        ),
      ];
  const escape = (v: Json | undefined) => {
    let s =
      v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
    if (typeof v === "string" && /^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      keys.map(escape).join(","),
      ...rows.map((row) =>
        keys
          .map((key) =>
            escape(
              key === "value" && (row === null || typeof row !== "object")
                ? row
                : getPath(row, key),
            ),
          )
          .join(","),
      ),
    ].join("\r\n")
  );
}
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
export function jsonText(data: Json | undefined, max = 24000): string {
  if (data === undefined) return "هنوز داده‌ای ثبت نشده است.";
  const s = JSON.stringify(data, null, 2);
  return s.length > max
    ? s.slice(0, max) + "\n… نمایش کوتاه شده؛ فایل خروجی کامل است."
    : s;
}
