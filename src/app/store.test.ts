import { it, expect, vi } from "vitest";
import { useApp, copyNodes, pasteNodes, execute, engine } from "./store";
import { fromTemplate, templates } from "../lib/templates";
import { repository } from "../lib/storage";
it("undo/redo restores graph changes without rewinding run logs", () => {
  const w = fromTemplate(templates[0]);
  useApp.setState({ workflow: w, past: [], future: [], run: undefined });
  useApp.getState().edit((v) => {
    v.name = "edited";
  });
  expect(useApp.getState().workflow?.name).toBe("edited");
  useApp.getState().undo();
  expect(useApp.getState().workflow?.name).toBe(w.name);
  useApp.getState().redo();
  expect(useApp.getState().workflow?.name).toBe("edited");
});
it("copies internal connections along with selected processing nodes", () => {
  const w = fromTemplate(templates[0]);
  useApp.setState({ workflow: w, run: undefined, past: [], future: [] });
  copyNodes(["h", "f"]);
  pasteNodes();
  const copy = useApp.getState().workflow!;
  expect(copy.nodes).toHaveLength(7);
  expect(copy.edges).toHaveLength(5);
  expect(copy.edges.at(-1)?.source).toBe(copy.nodes.at(-2)?.id);
  expect(copy.edges.at(-1)?.target).toBe(copy.nodes.at(-1)?.id);
});
it("does not execute a workflow whose latest revision could not be saved", async () => {
  const workflow = fromTemplate(templates[0]);
  useApp.setState({
    workflow,
    run: undefined,
    saveState: "saving",
    revision: 1000,
  });
  const save = vi
    .spyOn(repository, "saveWorkflow")
    .mockRejectedValueOnce(new Error("disk full"));
  const start = vi.spyOn(engine, "start");
  const request = vi.fn(
    async (
      _name: string,
      _options: unknown,
      callback: (lock: object) => Promise<void>,
    ) => callback({}),
  );
  const locks = Object.getOwnPropertyDescriptor(navigator, "locks");
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: { request },
  });
  try {
    await execute();
    expect(start).not.toHaveBeenCalled();
    expect(useApp.getState().saveState).toBe("error");
    expect(useApp.getState().notice).toContain("disk full");
  } finally {
    save.mockRestore();
    start.mockRestore();
    if (locks) Object.defineProperty(navigator, "locks", locks);
    else Reflect.deleteProperty(navigator, "locks");
  }
});
