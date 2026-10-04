import { describe, it, expect } from "vitest";
import { templates, fromTemplate } from "./templates";
import { validate, connectionIssue, importWorkflow, order } from "./validation";
import { getPath, filterData, sortData, matches, toCsv } from "./data";
import { defaultConfig, workflowSchema, type Config } from "./model";
describe("graph rules", () => {
  it("accepts each complete template", () =>
    templates.forEach((w) => expect(validate(w)).toEqual([])));
  it("rejects cycles", () => {
    const w = fromTemplate(templates[0]);
    w.edges.push({ id: "cycle", source: "s", target: "h", port: "out" });
    expect(validate(w).some((i) => i.message.includes("حلقه"))).toBe(true);
  });
  it("rejects missing entry, disconnected nodes and missing outputs", () => {
    const w = fromTemplate(templates[0]);
    w.nodes = w.nodes.filter((n) => n.id !== "i" && n.id !== "o");
    expect(validate(w).length).toBeGreaterThan(2);
  });
  it("rejects dangling edges and duplicate ids", () => {
    const w = fromTemplate(templates[0]);
    w.edges.push({ ...w.edges[0], target: "gone" });
    w.nodes.push(w.nodes[0]);
    expect(validate(w).some((i) => i.message.includes("حذف‌شده"))).toBe(true);
    expect(validate(w).some((i) => i.message.includes("تکراری"))).toBe(true);
  });
  it("rejects duplicate edges and wrong condition ports", () => {
    const w = fromTemplate(templates[1]);
    w.edges.push({ ...w.edges[0] });
    w.edges[1].port = "out";
    expect(validate(w).some((i) => i.field === "port")).toBe(true);
    expect(validate(w).some((i) => i.message.includes("تکراری"))).toBe(true);
  });
  it("requires both condition outcomes", () => {
    const w = fromTemplate(templates[1]);
    w.edges = w.edges.filter((e) => e.port !== "false");
    expect(validate(w).some((i) => i.message.includes("هر دو"))).toBe(true);
  });
  it("prevents fan-in and terminal outputs", () => {
    const w = fromTemplate(templates[0]);
    expect(
      connectionIssue(w, { id: "x", source: "i", target: "s", port: "out" }),
    ).toContain("فقط یک");
    w.edges.push({ id: "x", source: "o", target: "i", port: "out" });
    expect(validate(w).some((i) => i.message.includes("آخرین"))).toBe(true);
  });
  it("uses stable dependency order", () =>
    expect(order(templates[0])).toEqual(["i", "h", "f", "s", "o"]));
});
describe("data paths and operations", () => {
  it("preserves primitives and missing distinctions", () => {
    expect(getPath({ v: false }, "v")).toBe(false);
    expect(getPath({ v: null }, "v")).toBe(null);
    expect(getPath({ v: 0 }, "v")).toBe(0);
    expect(getPath("", "")).toBe("");
    expect(getPath({}, "v")).toBeUndefined();
    expect(getPath([{ v: 2 }], "0.v")).toBe(2);
  });
  it("rejects dangerous properties", () =>
    expect(() => getPath({}, "constructor.name")).toThrow("ناامن"));
  const f = {
    ...defaultConfig("filter"),
    type: "filter",
    path: "v",
    operator: "eq",
    value: 0,
  } as Extract<Config, { type: "filter" }>;
  it("uses typed equality and does not treat missing as null", () => {
    expect(filterData([{ v: 0 }, { v: "0" }, { v: null }, {}], f)).toEqual([
      { v: 0 },
    ]);
    expect(filterData([{ v: null }, {}], { ...f, value: null })).toEqual([
      { v: null },
    ]);
  });
  it("handles exists, contains and numeric comparisons", () => {
    expect(matches({ v: false }, { ...f, operator: "exists" })).toBe(true);
    expect(
      matches({ v: "abc" }, { ...f, operator: "contains", value: "b" }),
    ).toBe(true);
    expect(
      matches({ v: [1, 2] }, { ...f, operator: "contains", value: 2 }),
    ).toBe(true);
    expect(matches({ v: 2 }, { ...f, operator: "gt", value: 1 })).toBe(true);
    expect(matches({ v: "2" }, { ...f, operator: "gt", value: 1 })).toBe(false);
    expect(matches({}, { ...f, operator: "neq" })).toBe(false);
  });
  it("requires arrays and handles empty arrays", () => {
    expect(() => filterData(null, f)).toThrow("آرایه");
    expect(filterData([], f)).toEqual([]);
  });
  it("sorts stably and puts missing and wrong types last even descending", () => {
    const s = {
      type: "sort",
      path: "v",
      direction: "desc",
      mode: "number",
    } as const;
    expect(
      sortData(
        [
          { id: "a", v: 2 },
          { id: "b", v: 2 },
          { id: "c" },
          { id: "d", v: 1 },
          { id: "e", v: "3" },
        ],
        s,
      ),
    ).toEqual([
      { id: "a", v: 2 },
      { id: "b", v: 2 },
      { id: "d", v: 1 },
      { id: "c" },
      { id: "e", v: "3" },
    ]);
    expect(() => sortData("", s)).toThrow();
  });
  it("sorts string primitives", () =>
    expect(
      sortData(["b", "a"], {
        type: "sort",
        path: "",
        direction: "asc",
        mode: "string",
      }),
    ).toEqual(["a", "b"]));
  it("escapes CSV and neutralizes string formula injection", () => {
    const csv = toCsv([{ v: "=1+1", x: 'a,"b"\nline' }], []);
    expect(csv).toContain("'\u003d1+1");
    expect(csv).toContain('a,""b""\nline');
    expect(toCsv([{ v: -1 }], ["v"])).toContain('"-1"');
  });
});
describe("schema and import", () => {
  it("round-trips versioned documents", () =>
    expect(importWorkflow(JSON.stringify(templates[0]))).toEqual(templates[0]));
  it("rejects malformed JSON, version, unsafe paths and secret headers", () => {
    expect(() => importWorkflow("{")).toThrow();
    expect(() =>
      importWorkflow(JSON.stringify({ ...templates[0], schemaVersion: 2 })),
    ).toThrow();
    expect(
      workflowSchema.safeParse({
        ...templates[0],
        nodes: [
          {
            ...templates[0].nodes[1],
            config: {
              ...defaultConfig("http"),
              headers: { Authorization: "secret" },
            },
          },
        ],
      }).success,
    ).toBe(false);
  });
});
