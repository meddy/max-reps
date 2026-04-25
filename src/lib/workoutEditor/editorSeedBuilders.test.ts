import { describe, expect, it } from "vitest";
import {
  mergeWorkoutGroupsWithDayTemplates,
  type TemplateWithName,
} from "./editorSeedBuilders";
import type { EditorExerciseGroup } from "./model";

function template(input: Partial<TemplateWithName>): TemplateWithName {
  return {
    id: input.id ?? "t1",
    dayId: input.dayId ?? "d1",
    exerciseId: input.exerciseId ?? "e1",
    exerciseName: input.exerciseName ?? "Bench",
    exerciseDisplayName: input.exerciseDisplayName ?? "Bench Press",
    numSets: input.numSets ?? 3,
    repsLower: input.repsLower ?? 6,
    repsUpper: input.repsUpper ?? 10,
    order: input.order ?? 0,
    createdAt: input.createdAt ?? new Date(),
    updatedAt: input.updatedAt ?? new Date(),
    isAdHoc: input.isAdHoc,
  };
}

function group(input: Partial<EditorExerciseGroup>): EditorExerciseGroup {
  return {
    groupKey: input.groupKey ?? "e1",
    exerciseId: input.exerciseId ?? "e1",
    exerciseName: input.exerciseName ?? "Bench",
    dayId: input.dayId,
    rows: input.rows ?? [{ id: "r1", reps: 5, weight: 135, note: "" }],
    templateMeta: input.templateMeta,
    lastPerformed: input.lastPerformed,
  };
}

describe("mergeWorkoutGroupsWithDayTemplates", () => {
  it("enriches matching workout exercises and adds missing rows up to template sets", () => {
    const groups = [
      group({
        exerciseId: "e1",
        rows: [{ id: "r1", reps: 5, weight: 135, note: "" }],
      }),
    ];
    const templates = [template({ exerciseId: "e1", numSets: 3 })];
    const previous = {
      e1: { workoutId: "w0", sets: [{ reps: 8, weight: 155, note: "pause" }] },
    };

    const merged = mergeWorkoutGroupsWithDayTemplates(
      groups,
      templates,
      previous
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].rows).toHaveLength(3);
    expect(merged[0].rows[0].id).toBe("r1");
    expect(merged[0].templateMeta).toEqual({
      repsLower: 6,
      repsUpper: 10,
      isAdHoc: false,
    });
    expect(merged[0].lastPerformed).toEqual(previous.e1);
  });

  it("does not remove existing rows when workout has at least template set count", () => {
    const groups = [
      group({
        exerciseId: "e1",
        rows: [
          { id: "r1", reps: 5, weight: 135, note: "" },
          { id: "r2", reps: 5, weight: 145, note: "" },
          { id: "r3", reps: 5, weight: 155, note: "" },
        ],
      }),
    ];
    const templates = [template({ exerciseId: "e1", numSets: 2 })];

    const merged = mergeWorkoutGroupsWithDayTemplates(groups, templates, {});

    expect(merged[0].rows.map((row) => row.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("adds template exercises missing from workout as empty groups", () => {
    const groups = [group({ exerciseId: "e1", exerciseName: "Bench" })];
    const templates = [
      template({ exerciseId: "e1", order: 0 }),
      template({
        id: "t2",
        exerciseId: "e2",
        exerciseName: "Squat",
        exerciseDisplayName: "Back Squat",
        numSets: 2,
        order: 1,
      }),
    ];

    const merged = mergeWorkoutGroupsWithDayTemplates(groups, templates, {});

    expect(merged).toHaveLength(2);
    expect(merged[1].exerciseId).toBe("e2");
    expect(merged[1].exerciseName).toBe("Back Squat");
    expect(merged[1].rows).toHaveLength(2);
  });

  it("keeps workout-only exercises unchanged", () => {
    const groups = [
      group({
        exerciseId: "e3",
        exerciseName: "Cable Row",
        rows: [{ id: "r1", reps: 10, weight: 90, note: "strict" }],
      }),
    ];

    const merged = mergeWorkoutGroupsWithDayTemplates(groups, [], {});

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(groups[0]);
  });
});
