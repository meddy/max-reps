import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoadingSpinner } from "./LoadingSpinner";

describe("LoadingSpinner", () => {
  it("renders a status indicator", () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});
