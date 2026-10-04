import { it, expect } from "vitest";
import { useApp, copyNodes, pasteNodes } from "./store";
import { fromTemplate, templates } from "../lib/templates";
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
