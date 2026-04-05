import { describe, expect, it, vi } from "vitest";
import { createInMemoryFirestoreDataPort } from "../firestoreDataPort/inMemory";
import { buildTemplatesSlice } from "./templatesSlice";

describe("buildTemplatesSlice", () => {
  it("forDay joins templates with exercise display names", async () => {
    const ts = new Date("2024-02-01T12:00:00.000Z");
    const firestore = createInMemoryFirestoreDataPort({
      exercises: {
        e1: {
          nameLower: "squat",
          displayName: "Squat",
          createdAt: ts,
          updatedAt: ts,
        },
      },
      exerciseSetTemplates: {
        t1: {
          dayId: "d1",
          exerciseId: "e1",
          numSets: 3,
          repsLower: 8,
          repsUpper: 12,
          order: 0,
          createdAt: ts,
          updatedAt: ts,
        },
      },
    });
    const slice = buildTemplatesSlice(firestore, {
      start: vi.fn(),
      end: vi.fn(),
    });
    const rows = await slice.forDay("d1");
    expect(rows).toHaveLength(1);
    expect(rows[0].exerciseDisplayName).toBe("Squat");
    expect(rows[0].exerciseId).toBe("e1");
  });
});
