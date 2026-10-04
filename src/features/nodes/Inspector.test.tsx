import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JsonField, DataViewer } from "./Inspector";
it("keeps invalid JSON local and commits false correctly", () => {
  const change = vi.fn();
  render(<JsonField label="test-json" value={null} onChange={change} />);
  fireEvent.change(screen.getByLabelText("test-json"), {
    target: { value: "{" },
  });
  expect(screen.getByRole("alert")).toHaveTextContent("JSON معتبر نیست");
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("test-json"), {
    target: { value: "false" },
  });
  expect(change).toHaveBeenCalledWith(false);
});
it("renders null rather than mistaking it for missing data", () => {
  render(<DataViewer data={null} />);
  expect(screen.getByText("null")).toBeInTheDocument();
});
it("reflects an external undo in the JSON editor", () => {
  const change = vi.fn();
  const { rerender } = render(
    <JsonField label="undo-json" value={1} onChange={change} />,
  );
  fireEvent.change(screen.getByLabelText("undo-json"), {
    target: { value: "2" },
  });
  rerender(<JsonField label="undo-json" value={2} onChange={change} />);
  rerender(<JsonField label="undo-json" value={1} onChange={change} />);
  expect(screen.getByLabelText("undo-json")).toHaveValue("1");
});
