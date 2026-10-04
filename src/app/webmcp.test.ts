import { it, expect, vi } from "vitest";
import { registerStudioTools } from "./webmcp";
import { useApp } from "./store";
it("registers tools, uses UI state, validates input and unregisters on cleanup", () => {
  const register = vi.fn();
  const cleanup = registerStudioTools({ registerTool: register });
  expect(register.mock.calls).toHaveLength(3);
  const navigate = register.mock.calls[1][0];
  expect(navigate.execute({ page: "guide" })).toEqual({ page: "guide" });
  expect(useApp.getState().page).toBe("guide");
  expect(() => navigate.execute({ page: "missing" })).toThrow();
  const read = register.mock.calls[0][0];
  expect(read.execute({}).page).toBe("guide");
  expect(read.annotations.readOnlyHint).toBe(true);
  cleanup();
  expect(register.mock.calls[0][1].signal.aborted).toBe(true);
});
