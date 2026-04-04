import { describe, expect, it } from "vitest";
import { createInMemoryFirestoreDataPort } from "./inMemory";

describe("createInMemoryFirestoreDataPort removeDocumentAndRelated", () => {
  it("deletes cascaded child documents then the parent", async () => {
    const port = createInMemoryFirestoreDataPort({
      days: {
        day1: { nameLower: "push", displayName: "Push" },
      },
      exerciseSetTemplates: {
        t1: { dayId: "day1", exerciseId: "e1", order: 0 },
        t2: { dayId: "day1", exerciseId: "e2", order: 1 },
      },
    });

    await port.removeDocumentAndRelated("days", "day1", [
      { collection: "exerciseSetTemplates", field: "dayId" },
    ]);

    expect(await port.getDocument("days", "day1")).toBeNull();
    expect(await port.getDocument("exerciseSetTemplates", "t1")).toBeNull();
    expect(await port.getDocument("exerciseSetTemplates", "t2")).toBeNull();
  });
});
