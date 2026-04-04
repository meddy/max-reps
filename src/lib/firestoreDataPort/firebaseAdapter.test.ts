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

import { createFirebaseFirestoreDataPort } from "./firebaseAdapter";

describe("createFirebaseFirestoreDataPort queryExercisesWhereDocumentIdIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chunks document id in queries to 10 ids per getDocs", async () => {
    const ids = Array.from({ length: 11 }, (_, i) => `e${i}`);
    mockGetDocs
      .mockResolvedValueOnce({
        docs: ids.slice(0, 10).map((id) => ({
          id,
          data: () => ({ displayName: `N ${id}` }),
        })),
      })
      .mockResolvedValueOnce({
        docs: [
          {
            id: "e10",
            data: () => ({ displayName: "N e10" }),
          },
        ],
      });

    const port = createFirebaseFirestoreDataPort(
      {} as import("firebase/firestore").Firestore
    );
    const rows = await port.queryExercisesWhereDocumentIdIn(ids);

    expect(mockGetDocs).toHaveBeenCalledTimes(2);
    expect(rows).toHaveLength(11);
    expect(rows.find((r) => r.id === "e10")?.data.displayName).toBe("N e10");
  });
});
