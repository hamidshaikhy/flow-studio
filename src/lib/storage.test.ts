import { describe, it, expect } from "vitest";
import { repository, runSchema } from "./storage";
import { fromTemplate, templates } from "./templates";
import { Engine } from "./engine";
describe("IndexedDB commits", () => {
  it("rejects malformed run records rather than attempting recovery", async () => {
    const engine = new Engine({ save: async () => {}, change: () => {} });
    await engine.start(templates[0], true);
    expect(runSchema.safeParse({ ...engine.current!, nodes: {} }).success).toBe(
      false,
    );
    const bad = structuredClone(engine.current!);
    delete bad.nodes.i.output;
    expect(runSchema.safeParse(bad).success).toBe(false);
  });
  it("stores and reads a validated workflow, then deletes it", async () => {
    const w = fromTemplate(templates[0]);
    await repository.saveWorkflow(w);
    expect((await repository.listWorkflows()).some((v) => v.id === w.id)).toBe(
      true,
    );
    await repository.deleteWorkflow(w.id);
    expect((await repository.listWorkflows()).some((v) => v.id === w.id)).toBe(
      false,
    );
  });
  it("persists checkpoints with immutable snapshots", async () => {
    const w = fromTemplate(templates[0]);
    const engine = new Engine({ save: repository.saveRun, change: () => {} });
    await engine.start(w, true);
    w.name = "changed";
    const r = (await repository.listRuns()).find(
      (v) => v.id === engine.current!.id,
    );
    expect(r?.nodes.i.status).toBe("succeeded");
    expect(r?.workflow.name).not.toBe("changed");
  });
  it("stores preferences", async () => {
    await repository.setPreference("theme", "light");
    expect(await repository.preference("theme")).toBe("light");
  });
});
