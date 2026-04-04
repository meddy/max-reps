import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { TopSetChart } from "./TopSetChart";

describe("TopSetChart", () => {
  it("renders chart stub when data is non-empty", () => {
    renderWithProviders(
      <TopSetChart
        data={[
          {
            dateMs: 1,
            dateLabel: "Jan 1",
            weight: 225,
            reps: 5,
            label: "A",
          },
        ]}
      />
    );
    expect(screen.getAllByTestId("recharts-stub").length).toBeGreaterThan(0);
  });

  it("renders nothing when data is empty", () => {
    const { container } = renderWithProviders(<TopSetChart data={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
