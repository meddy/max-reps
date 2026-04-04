import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetDocs = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  documentId: vi.fn(() => "DOCUMENT_ID"),
  getDocs: (q: unknown) => mockGetDocs(q),
  limit: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
}));

import { resolveExerciseNamesImpl } from "./templateQueries";

describe("resolveExerciseNamesImpl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty map for empty input without querying", async () => {
    const map = await resolveExerciseNamesImpl(
      {} as import("firebase/firestore").Firestore,
      []
    );
    expect(map.size).toBe(0);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it("dedupes ids and batches getDocs in chunks of 10", async () => {
    const ids = Array.from({ length: 11 }, (_, i) => `e${i}`);
    mockGetDocs
      .mockResolvedValueOnce({
        docs: ids.slice(0, 10).map((id) => ({
          id,
          data: () => ({ displayName: `Name ${id}` }),
        })),
      })
      .mockResolvedValueOnce({
        docs: [
          {
            id: "e10",
            data: () => ({ displayName: "Name e10" }),
          },
        ],
      });

    const map = await resolveExerciseNamesImpl(
      {} as import("firebase/firestore").Firestore,
      [...ids, "e0"]
    );

    expect(mockGetDocs).toHaveBeenCalledTimes(2);
    expect(map.get("e0")).toBe("Name e0");
    expect(map.get("e10")).toBe("Name e10");
  });

  it("skips entries without displayName", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: "a", data: () => ({ displayName: "Lift" }) },
        { id: "b", data: () => ({}) },
      ],
    });

    const map = await resolveExerciseNamesImpl(
      {} as import("firebase/firestore").Firestore,
      ["a", "b"]
    );
    expect(map.has("a")).toBe(true);
    expect(map.has("b")).toBe(false);
  });
});
