import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { SetRow } from "./SetRow";

describe("SetRow", () => {
  it("calls onRepsChange when reps input changes", async () => {
    const user = userEvent.setup();
    const onRepsChange = vi.fn();
    renderWithProviders(
      <SetRow
        reps={0}
        weight={0}
        note=""
        onRepsChange={onRepsChange}
        onWeightChange={vi.fn()}
        onNoteChange={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    const reps = screen.getByPlaceholderText(/reps/i);
    await user.clear(reps);
    await user.type(reps, "10");
    expect(onRepsChange).toHaveBeenCalled();
  });
});
