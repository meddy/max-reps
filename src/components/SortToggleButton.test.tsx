import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { SortToggleButton } from "./SortToggleButton";

describe("SortToggleButton", () => {
  it("toggles between asc and desc", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <SortToggleButton
        value="desc"
        onChange={onChange}
        ariaLabel="Sort items"
        ascLabel="Oldest first"
        descLabel="Newest first"
      />
    );
    expect(
      screen.getByRole("button", { name: /newest first/i })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /sort items/i }));
    expect(onChange).toHaveBeenCalledWith("asc");
  });
});
