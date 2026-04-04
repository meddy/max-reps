import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { DataAccessProvider } from "../contexts/DataAccessContext";
import type { DataAccess } from "../lib/dataAccess";
import { mockDataAccess } from "../test/mockDataAccess";
import { useExercisePicker } from "./useExercisePicker";

const ts = new Date("2024-01-01T12:00:00");

function wrapper({ children }: { children: ReactNode }) {
  return createElement(DataAccessProvider, {
    value: mockDataAccess as unknown as DataAccess,
    children,
  });
}

describe("useExercisePicker", () => {
  it("loads search results when active and search is non-empty", async () => {
    mockDataAccess.exercises.searchByNamePrefix.mockResolvedValue([
      {
        id: "ex1",
        nameLower: "squat",
        displayName: "Squat",
        createdAt: ts,
        updatedAt: ts,
      },
    ]);

    const { result } = renderHook(() => useExercisePicker({ active: true }), {
      wrapper,
    });

    act(() => {
      result.current.setSearch("sq");
    });

    await waitFor(() => {
      expect(result.current.results).toHaveLength(1);
      expect(result.current.results[0].displayName).toBe("Squat");
    });
  });

  it("surfaces duplicate name error from createExerciseFromSearch", async () => {
    mockDataAccess.exercises.findByExactName.mockResolvedValue({
      id: "existing",
      nameLower: "bench",
      displayName: "Bench",
      createdAt: ts,
      updatedAt: ts,
    });

    const { result } = renderHook(() => useExercisePicker({ active: true }), {
      wrapper,
    });

    act(() => {
      result.current.setSearch("Bench");
    });

    await act(async () => {
      await result.current.createExerciseFromSearch();
    });

    expect(result.current.createExerciseError).toBe(
      "An exercise with this name already exists"
    );
  });
});
