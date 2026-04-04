import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("renders dialog when open and closes via close control", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <Modal open title="Test modal" onClose={onClose}>
        <p>Inner</p>
      </Modal>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test modal")).toBeInTheDocument();
    expect(screen.getByText("Inner")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders nothing when closed", () => {
    renderWithProviders(
      <Modal open={false} title="Hidden" onClose={() => {}}>
        <p>Nope</p>
      </Modal>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
