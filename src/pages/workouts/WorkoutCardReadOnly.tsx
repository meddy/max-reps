import { Link } from "react-router-dom";
import { formatDate } from "../../lib/format";
import type { SetEntryToken } from "../../lib/setEntry";
import { SetEntryTokens } from "./SetEntryTokens";
import {
  workoutDisplayName,
  type WorkoutCardModel,
  type WorkoutExerciseLine,
} from "./workoutCardModel";

export type ExerciseLinkState = Record<
  string,
  { exists: boolean; displayName?: string } | undefined
>;

export type DayLinkState = Record<string, { exists: boolean } | undefined>;

const WORKOUTS_RETURN_TO = {
  to: "/workouts",
  label: "Back to Workouts",
} as const;

function ExerciseName({
  line,
  linkState,
}: {
  line: WorkoutExerciseLine;
  linkState: ExerciseLinkState;
}) {
  const resolved = linkState[line.exerciseId];
  const name =
    resolved?.exists && resolved.displayName
      ? resolved.displayName
      : line.exerciseNameSnapshot || "Exercise";

  if (resolved?.exists) {
    return (
      <Link
        to={`/exercises/${line.exerciseId}`}
        state={{ returnTo: WORKOUTS_RETURN_TO }}
        className="font-semibold text-indigo-700 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {name}
      </Link>
    );
  }

  return <span className="font-semibold text-slate-800">{name}</span>;
}

function DayTitle({
  dayId,
  dayNameSnapshot,
  linkState,
}: {
  dayId: string;
  dayNameSnapshot: string;
  linkState: DayLinkState;
}) {
  const name = workoutDisplayName(dayNameSnapshot);
  const linked = Boolean(dayId) && linkState[dayId]?.exists === true;

  if (linked) {
    return (
      <Link
        to={`/days/${dayId}`}
        state={{ returnTo: WORKOUTS_RETURN_TO }}
        className="font-semibold text-indigo-700 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {name.text}
      </Link>
    );
  }

  return (
    <span
      className={
        name.isPlaceholder
          ? "italic text-slate-400"
          : "font-semibold text-indigo-800"
      }
    >
      {name.text}
    </span>
  );
}

export function WorkoutCardReadOnly({
  model,
  exerciseLinkState = {},
  dayLinkState = {},
  optionsSlot,
  className = "",
}: {
  model: WorkoutCardModel;
  exerciseLinkState?: ExerciseLinkState;
  dayLinkState?: DayLinkState;
  optionsSlot?: React.ReactNode;
  className?: string;
}) {
  const { workout, exercises } = model;
  const note = workout.note?.trim() ?? "";

  return (
    <article
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}
      data-workout-id={workout.id}
    >
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1 text-sm leading-relaxed">
          <span className="font-medium text-slate-500">
            {formatDate(workout.date)}
          </span>
          <span className="text-slate-300"> — </span>
          <DayTitle
            dayId={workout.dayId}
            dayNameSnapshot={workout.dayNameSnapshot}
            linkState={dayLinkState}
          />
          {note ? (
            <>
              <span className="text-slate-300"> — </span>
              <span className="italic text-slate-600">{note}</span>
            </>
          ) : null}
        </div>
        {optionsSlot ? (
          <div className="shrink-0" data-no-dnd>
            {optionsSlot}
          </div>
        ) : null}
      </header>

      {exercises.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No sets logged</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {exercises.map((line) => (
            <li
              key={`${line.exerciseId}-${line.sets[0]?.id ?? line.entryText}`}
              className="text-sm leading-relaxed"
            >
              <ExerciseName line={line} linkState={exerciseLinkState} />
              <span className="text-slate-300"> — </span>
              <SetEntryTokens tokens={line.tokens as SetEntryToken[]} />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
