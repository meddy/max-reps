import { describe, expect, it, vi } from "vitest";
import { createInMemoryFirestoreDataPort } from "../firestoreDataPort/inMemory";
import { buildDaysSlice } from "./daysSlice";

describe("buildDaysSlice", () => {
  it("get maps a stored day document", async () => {
    const ts = new Date("2024-01-01T12:00:00.000Z");
    const firestore = createInMemoryFirestoreDataPort({
      days: {
        d1: {
          nameLower: "leg day",
          displayName: "Leg Day",
          createdAt: ts,
          updatedAt: ts,
        },
      },
    });
    const slice = buildDaysSlice(firestore, { start: vi.fn(), end: vi.fn() });
    const d = await slice.get("d1");
    expect(d).toMatchObject({
      id: "d1",
      displayName: "Leg Day",
      nameLower: "leg day",
    });
  });

  it("create persists a day and returns its id", async () => {
    const firestore = createInMemoryFirestoreDataPort();
    const slice = buildDaysSlice(firestore, { start: vi.fn(), end: vi.fn() });
    const id = await slice.create({
      nameLower: "push",
      displayName: "Push",
    });
    expect(typeof id).toBe("string");
    const loaded = await slice.get(id);
    expect(loaded?.displayName).toBe("Push");
  });
});
