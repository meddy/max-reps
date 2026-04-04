import { beforeEach, describe, expect, it, vi } from "vitest";

const batchDelete = vi.fn();
const batchCommit = vi.fn(() => Promise.resolve());
const mockWriteBatch = vi.fn((_db: unknown) => ({
  delete: batchDelete,
  commit: batchCommit,
}));

const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockGetDocs = vi.fn();

vi.mock("firebase/firestore", () => ({
  writeBatch: (db: unknown) => mockWriteBatch(db),
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  getDocs: (q: unknown) => mockGetDocs(q),
}));

import { deleteDocAndRelated } from "./firestore";

describe("deleteDocAndRelated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchCommit.mockResolvedValue(undefined);
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockDoc.mockReturnValue("parentRef");
  });

  it("queues cascaded deletes and parent doc then commits", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ ref: "c1" }, { ref: "c2" }],
    });

    await deleteDocAndRelated("days", "day1", [
      { collection: "exerciseSetTemplates", field: "dayId" },
    ]);

    expect(mockWriteBatch).toHaveBeenCalledOnce();
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(batchDelete).toHaveBeenCalledWith("c1");
    expect(batchDelete).toHaveBeenCalledWith("c2");
    expect(batchDelete).toHaveBeenCalledWith("parentRef");
    expect(batchCommit).toHaveBeenCalledOnce();
  });
});
