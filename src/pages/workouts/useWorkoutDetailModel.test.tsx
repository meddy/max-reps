import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthTestProvider } from "../../contexts/AuthContext";
import { createTestDataAccess } from "../../test/mockDataAccess";
import { useWorkoutDetailModel } from "../../lib/workoutDetail";

const authedUser = { uid: "test-user" } as import("firebase/auth").User;

function renderDetailHook(
  workoutId: string | undefined,
  dataAccess: ReturnType<typeof createTestDataAccess>
) {
  return renderHook(
    () => useWorkoutDetailModel(workoutId, dataAccess.workoutDetail),
    {
      wrapper: ({ children }) => (
        <AuthTestProvider
          value={{
            user: authedUser,
            loading: false,
            error: null,
            allowedUid: "test-user",
            signIn: async () => {},
            signOut: async () => {},
            clearError: () => {},
          }}
        >
          {children}
        </AuthTestProvider>
      ),
    }
  );
}

const baseDate = new Date("2024-01-01T12:00:00.000Z");

function minimalWorkout(id: string) {
  return {
    id,
    date: baseDate,
    dayId: "d1",
    dayNameSnapshot: "Push",
    note: "",
    createdAt: baseDate,
    updatedAt: baseDate,
  };
}

describe("useWorkoutDetailModel", () => {
  it("when workoutId is undefined, stays idle without fetching", async () => {
    const dataAccess = createTestDataAccess();
    const { result } = renderDetailHook(undefined, dataAccess);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workout).toBeNull();
    expect(dataAccess.workouts.get).not.toHaveBeenCalled();
  });

  it("loads workout and resolves editor seed from sets", async () => {
    const dataAccess = createTestDataAccess();
    dataAccess.workouts.get.mockResolvedValue(minimalWorkout("w1"));
    dataAccess.sets.listForWorkout.mockResolvedValue([
      {
        id: "s1",
        workoutId: "w1",
        exerciseId: "e1",
        exerciseNameSnapshot: "Bench",
        reps: 5,
        weight: 135,
        unit: "lbs",
        note: "",
        performedAt: baseDate,
        order: 0,
        createdAt: baseDate,
      },
    ]);

    const { result } = renderDetailHook("w1", dataAccess);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workout?.id).toBe("w1");

    await waitFor(() => expect(result.current.editorSeed).not.toBeNull());
    expect(result.current.editorSeed?.variant).toBe("workout");
    expect(result.current.isTemplateMode).toBe(false);
    expect(result.current.editorSeed?.groups).toHaveLength(1);
    expect(result.current.editorSeed?.groups[0]?.exerciseName).toBe("Bench");
  });
});
