import { describe, it, expect, vi } from "vitest";
import { Engine, interrupted } from "./engine";
import { templates, fromTemplate } from "./templates";
import { clone, type Json, type Run } from "./model";
import { posts } from "./http";
function harness() {
  const saved: Run[] = [];
  const changes: Run[] = [];
  const http = vi.fn(async () => clone(posts));
  const save = vi.fn(async (r: Run) => {
    saved.push(clone(r));
  });
  const engine = new Engine({
    save,
    http,
    wait: async () => {},
    change: (r) => changes.push(r),
  });
  return { engine, http, save, saved, changes };
}
describe("execution and checkpoints", () => {
  it("runs the new fixture templates and chooses only the active branches", async () => {
    const run = async (templateId: string, value?: Json) => {
      const w = fromTemplate(templates.find((t) => t.id === templateId)!);
      if (value) w.nodes[0].config = { type: "input", value };
      const engine = new Engine({
        save: async () => {},
        wait: async () => {},
        change: () => {},
      });
      await engine.start(w);
      expect(engine.current?.status).toBe("succeeded");
      return engine.current!;
    };
    const filtered = await run("multi-filter");
    expect(
      (filtered.nodes.o.output as { id: number }[]).map((row) => row.id),
    ).toEqual([16]);

    const priorityHigh = await run("priority-routes");
    expect(priorityHigh.nodes.o1.status).toBe("succeeded");
    expect(priorityHigh.nodes.h2.status).toBe("skipped");
    const priorityNormal = await run("priority-routes", {
      priority: "normal",
      userId: 3,
    });
    expect(priorityNormal.nodes.h1.status).toBe("skipped");
    expect((priorityNormal.nodes.o2.output as unknown[]).length).toBe(9);

    const regular = await run("nested-decisions");
    expect(regular.nodes.o2.status).toBe("succeeded");
    expect(regular.nodes.h1.status).toBe("skipped");
    const audit = await run("nested-decisions", {
      active: true,
      audit: true,
      userId: 1,
    });
    expect((audit.nodes.o1.output as unknown[]).length).toBe(4);
    expect(audit.nodes.h2.status).toBe("skipped");
    const inactive = await run("nested-decisions", {
      active: false,
      audit: false,
      userId: 1,
    });
    expect(inactive.nodes.o3.output).toEqual({
      active: false,
      audit: false,
      userId: 1,
    });
    expect(inactive.nodes.h1.status).toBe("skipped");
    expect(inactive.nodes.h2.status).toBe("skipped");
  });
  it("runs sequentially and commits before starting dependents", async () => {
    const h = harness();
    await h.engine.start(templates[0]);
    expect(h.engine.current?.status).toBe("succeeded");
    expect(h.engine.current?.nodes.o.output).toEqual(
      (posts as Array<unknown>).slice(0, 10).reverse(),
    );
    expect(
      h.saved.filter((r) => r.nodes.h.status === "running")[0].nodes.i.status,
    ).toBe("succeeded");
    expect(h.http).toHaveBeenCalledTimes(1);
  });
  it.each([true, false])(
    "executes only the selected condition branch (%s)",
    async (active) => {
      const h = harness();
      const w = fromTemplate(templates[1]);
      w.nodes[0].config = { type: "input", value: { active } };
      await h.engine.start(w);
      expect(h.engine.current?.nodes.c.branch).toBe(String(active));
      expect(h.http).toHaveBeenCalledTimes(active ? 1 : 0);
      expect(h.engine.current?.nodes[active ? "d" : "h"].status).toBe(
        "skipped",
      );
    },
  );
  it("steps exactly one eligible node and resumes committed results", async () => {
    const h = harness();
    await h.engine.start(templates[0], true);
    expect(h.engine.current?.status).toBe("paused");
    expect(h.engine.current?.nodes.i.status).toBe("succeeded");
    expect(h.http).not.toHaveBeenCalled();
    await h.engine.resume(h.engine.current!, true);
    expect(h.http).toHaveBeenCalledTimes(1);
    expect(h.engine.current?.nodes.f.status).toBe("pending");
    await h.engine.resume(h.engine.current!);
    expect(h.http).toHaveBeenCalledTimes(1);
    expect(h.engine.current?.status).toBe("succeeded");
  });
  it("pauses at a node boundary and rejects duplicate starts", async () => {
    const h = harness();
    let finish!: () => void;
    h.http.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(clone(posts));
        }),
    );
    const start = h.engine.start(templates[0]);
    await vi.waitFor(() => expect(h.http).toHaveBeenCalled());
    await expect(h.engine.start(templates[0])).rejects.toThrow("اجرا");
    h.engine.pause();
    finish();
    await start;
    expect(h.engine.current?.status).toBe("paused");
    expect(h.engine.current?.nodes.h.status).toBe("succeeded");
    expect(h.engine.current?.nodes.f.status).toBe("pending");
  });
  it("cancels without accepting late responses", async () => {
    const h = harness();
    let finish!: () => void;
    h.http.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(clone(posts));
        }),
    );
    const start = h.engine.start(templates[0]);
    await vi.waitFor(() => expect(h.http).toHaveBeenCalled());
    await h.engine.cancel();
    finish();
    await start;
    expect(h.engine.current?.status).toBe("cancelled");
    expect(h.engine.current?.nodes.h.output).toBeUndefined();
  });
  it("restores interrupted delay without repeating successful HTTP", async () => {
    const h = harness();
    await h.engine.start(templates[2], true);
    await h.engine.resume(h.engine.current!, true);
    const r = clone(h.engine.current!);
    r.status = "running";
    r.nodes.d = { status: "running", input: clone(posts) };
    const recovered = interrupted(r);
    const next = harness();
    await next.engine.resume(recovered);
    expect(next.http).not.toHaveBeenCalled();
    expect(next.engine.current?.status).toBe("succeeded");
  });
  it("never silently replays an uncertain write", async () => {
    const h = harness();
    const w = fromTemplate(templates[0]);
    w.nodes[1].config = {
      ...w.nodes[1].config,
      ...(w.nodes[1].config.type === "http" ? { method: "POST" as const } : {}),
    };
    await h.engine.start(w, true);
    const r = clone(h.engine.current!);
    r.status = "running";
    r.nodes.h = { status: "running", input: null };
    const recovered = interrupted(r);
    expect(recovered.nodes.h.uncertain).toBe(true);
    await expect(h.engine.resume(recovered)).rejects.toThrow("مشخص نیست");
    expect(h.http).not.toHaveBeenCalled();
    await h.engine.resume(recovered, false, true);
    expect(h.http).toHaveBeenCalledTimes(1);
  });
  it("stops on checkpoint failure before the next operation", async () => {
    const h = harness();
    h.save.mockRejectedValueOnce(new Error("quota"));
    await h.engine.start(templates[0]);
    expect(h.engine.current?.status).toBe("paused");
    expect(h.http).not.toHaveBeenCalled();
  });
  it("does not reuse an uncommitted successful request", async () => {
    const h = harness();
    h.save.mockImplementation(async (r) => {
      if (r.nodes.h.status === "succeeded") throw new Error("quota");
      h.saved.push(clone(r));
    });
    await h.engine.start(templates[0]);
    expect(h.engine.current?.nodes.h.status).toBe("interrupted");
    expect(h.engine.current?.nodes.h.output).toBeUndefined();
    expect(h.engine.current?.status).toBe("paused");
  });
  it("fails without scheduling downstream operations", async () => {
    const h = harness();
    h.http.mockRejectedValue(new Error("offline"));
    await h.engine.start(templates[0]);
    expect(h.engine.current?.nodes.i.status).toBe("succeeded");
    expect(h.engine.current?.nodes.h.status).toBe("failed");
    expect(h.engine.current?.nodes.f.status).toBe("pending");
  });
});
