import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockServerTimestamp = vi.fn(() => "SERVER_TS");

vi.mock("firebase/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/firestore")>();
  return {
    ...actual,
    collection: (...args: unknown[]) => mockCollection(...args),
    doc: (...args: unknown[]) => mockDoc(...args),
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    serverTimestamp: () => mockServerTimestamp(),
  };
});

import { addDocument, patchDocument } from "./firestorePersistence";

describe("addDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue("colRef");
    mockAddDoc.mockResolvedValue({ id: "newId" });
  });

  it("adds createdAt and updatedAt for non-sets collections", async () => {
    const id = await addDocument(
      {} as import("firebase/firestore").Firestore,
      "exercises",
      {
        nameLower: "bench",
        displayName: "Bench",
      }
    );
    expect(id).toBe("newId");
    expect(mockAddDoc).toHaveBeenCalledWith(
      "colRef",
      expect.objectContaining({
        nameLower: "bench",
        displayName: "Bench",
        createdAt: "SERVER_TS",
        updatedAt: "SERVER_TS",
      })
    );
  });

  it("adds only createdAt for sets collection", async () => {
    await addDocument({} as import("firebase/firestore").Firestore, "sets", {
      workoutId: "w1",
      exerciseId: "e1",
      exerciseNameSnapshot: "Squat",
      reps: 5,
      weight: 135,
      unit: "lbs",
      note: "",
      performedAt: new Date("2024-01-01"),
      order: 0,
    });
    const payload = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.createdAt).toBe("SERVER_TS");
    expect(payload.updatedAt).toBeUndefined();
    expect(payload.reps).toBe(5);
  });
});

describe("patchDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue("docRef");
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it("merges updatedAt for non-sets collections", async () => {
    await patchDocument(
      {} as import("firebase/firestore").Firestore,
      "workouts",
      "w1",
      {
        dayNameSnapshot: "Legs",
      }
    );
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      "docRef",
      expect.objectContaining({
        dayNameSnapshot: "Legs",
        updatedAt: "SERVER_TS",
      })
    );
  });

  it("does not set updatedAt for sets collection", async () => {
    await patchDocument(
      {} as import("firebase/firestore").Firestore,
      "sets",
      "s1",
      {
        reps: 8,
      }
    );
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      "docRef",
      expect.objectContaining({ reps: 8 })
    );
    expect(mockUpdateDoc.mock.calls[0][1]).not.toHaveProperty("updatedAt");
  });
});
