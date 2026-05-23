# Max Reps

A single-user workout tracking app. This glossary pins the language used across the codebase and UI so that domain terms stay consistent and unambiguous.

## Language

**Day**:
A reusable, named workout template — the targets for one workout's worth of training (e.g. "Push Day", "Leg Day").
_Avoid_: plan, routine, split (these imply multi-day patterns Max Reps doesn't model).

**Set Target**:
One row of a **Day**: a target of _N_ sets of an **Exercise** at a rep range of _L–U_. Ordered within its Day.
_Avoid_: template, template row, day exercise, exercise set template, prescription.

**Unlogged Workout**:
A **Workout** that has been created but has zero logged **Sets**. The editor renders the parent **Day**'s **Set Targets** as empty input rows; saving any Set transitions the workout to _logged_.
_Avoid_: template mode, template variant, day preview.

**Fill from Day**:
A user action on a logged **Workout** that re-merges the parent **Day**'s **Set Targets** into the editor — adds missing exercises and missing rows; never overwrites already-entered values.
_Avoid_: fill template.

**Workout**:
One performance of a **Day** on a specific calendar date, owning the **Sets** logged during that performance. Carries `dayNameSnapshot` so historical views stay stable if the Day is later renamed or deleted.
_Avoid_: workout session, training session, session.

**Set**:
One performed set of an **Exercise** within a **Workout**: `reps` × `weight` (always lbs). All Sets are equal in kind — Max Reps does not model warm-up vs working sets. Carries an optional free-text `note` for per-set commentary (e.g. RPE, form cues, how it felt) and a denormalized `performedAt` mirroring the parent Workout's date (kept on the Set for query/index purposes; see [ADR-0001](./docs/adr/0001-denormalize-performed-at-onto-set.md)).
_Avoid_: workout set, set row, editor row (the latter two are implementation, not the entity).

**Exercise**:
A named movement that can be performed (e.g. "Bench Press", "Goblet Squat"). Variants are modeled as separate Exercises by naming convention (e.g. "Barbell Bench Press" vs. "DB Bench Press") — Max Reps does not model equipment, muscle groups, or variant structure as fields.
_Avoid_: lift, movement.

**Personal Record (PR)**:
The all-time best **Set** for an **Exercise**: highest `weight`, ties broken by higher `reps`. Estimated-1RM and per-rep-range PRs are not this metric — they would be separate, additional metrics if added later.
_Avoid_: max, best lift, 1RM (these imply other definitions).

**Top Set (per Workout)**:
The best **Set** within a single **Workout** for an **Exercise**, using the same rule as **Personal Record** (max weight, ties to max reps), scoped to that Workout. Used by the per-exercise progression chart.
_Avoid_: top working set, working top, heaviest set.

**Volume**:
The training-volume total for a **Workout**: the sum of `weight × reps` across every **Set** in the Workout.
_Avoid_: total load, tonnage, work.

**Set Summary**:
A per-exercise, read-only condensation of the exercise's **Sets** in the **Workout Editor**: consecutive runs at the same `weight` with reps summed per run, rendered as `weight×totalReps` segments (e.g. `150x5, 130x18`). Shown below the set list when at least one row has `reps > 0`. Distinct from **Volume**.
_Avoid_: set group summary, exercise summary (too vague).

**Last Performed Set**:
For an **Exercise**, the **Sets** from the most recent **Workout** (regardless of **Day**) that included this Exercise. The single canonical "what did I do last time?" hint, used wherever last-performed is surfaced — seeding rows in an **Unlogged Workout**, **Fill from Day**, and adding an ad-hoc exercise mid-workout.
_Avoid_: last performed group, lastPerformed, previous same-day workout, same-day previous.

**Workout Editor**:
The in-memory state machinery backing the Workout Detail screen: holds the current rows being edited, debounces persistence, exposes per-row APIs, and tracks dirty/idle state. Distinct from the persisted **Workout** itself. Contained in `src/lib/workoutEditor/`.
_Avoid_: workout session, session store, editor state.

**Owner**:
The single authenticated Firebase user permitted to read or write any data in this app. Identified by the UID configured in `VITE_ALLOWED_UID` (client) and `firestore.rules` (server-side `isOwner()`). All collections enforce the same rule: only the Owner can read or write. There is no concept of "users" beyond the Owner — documents don't carry a `userId` field, queries don't scope by user, and the app does not support sharing. See [ADR-0002](./docs/adr/0002-single-owner-architecture.md).
_Avoid_: user, account.

## Conventions

- **`nameLower` / `displayName`** — Both **Exercise** and **Day** carry this pair: `nameLower` is the case-insensitive uniqueness key (lookups and de-duplication), `displayName` is the rendered casing chosen at creation. Convention is `nameLower = displayName.toLowerCase().trim()`.
- **Day is a proper noun in UI** — In user-facing copy, always capitalize **Day** (`"Add a Day to get started."`, not `"Add a day..."`) to disambiguate from a calendar day. "Day template" is never used in UI copy; reword sentences so the bare noun **Day** stands.
- **Display Snapshot fields (`*NameSnapshot`)** — A **Workout** captures `dayNameSnapshot`; a **Set** captures `exerciseNameSnapshot`. Denormalized copies of the referenced entity's `displayName`, written once at creation and never re-derived. Job: keep historical views readable if the referenced entity is later renamed or deleted. Renaming an entity intentionally leaves historical snapshots untouched — they preserve what the workout/set _was called when performed_. Source of truth for editing surfaces remains the referenced entity itself; snapshots only show up in historical read paths.
- **"Session" is reserved for auth** — The word _session_ refers exclusively to the user's authenticated session (`authSessionController`). A **Workout** is never a "session"; the in-memory editor is the **Workout Editor**, not a "workout session".

## Relationships

- A **Day** owns an ordered list of **Set Targets**
- A **Set Target** belongs to exactly one **Day** and references one **Exercise**
- A **Workout** currently references exactly one **Day** (see Flagged ambiguities)
- A **Workout** owns zero or more **Sets**
- A **Workout** is **Unlogged** until its first **Set** is saved, then _logged_
- **Sets** are ordered workout-wide via `order` (a single sequence across the whole Workout). The user reorders **exercises**, not individual Sets — moving an exercise carries its Sets along while preserving their relative order within the exercise.
- A **Set Target** and a **Set** both reference an **Exercise**. Deleting an Exercise leaves historical Sets readable (via `exerciseNameSnapshot`) but leaves dangling Set Targets (see Flagged ambiguities).

## Flagged ambiguities

- **"Day" vs. calendar day** — "Day" is _not_ a calendar date. A [Workout](#) carries its own `date`; the `Day` it references is a named template, not the date it was performed.
- **`exerciseSetTemplates` collection name** — Legacy from before we settled on **Set Target**. Renaming the Firestore collection is invasive; reads/writes still use the old name. New code and docs should refer to the entity as a **Set Target**.
- **Workout-without-a-Day** — Currently every **Workout** must reference a **Day** (UI requires picking one; `dayId` is non-optional). A planned change would let workouts exist without a Day. Defensive code in `loadWorkoutDetail` (`!w.dayId` branch) already anticipates that future state.
- **Multiple Workouts on one calendar date** — `Workout.date` is conceptually a calendar date, not a moment (the `T12:00:00` value at creation is a timezone-stability trick, not a meaningful time-of-day). Two Workouts on the same date are technically possible; ordering and presentation in that case is not formally defined.
- **Dangling Set Targets after Exercise delete** — Deleting an **Exercise** does not cascade to **Set Targets** that reference it. Affected Set Targets render with no exercise name. Accepted: Exercises are rarely (if ever) deleted in practice, so this isn't currently worth automating away.
- **`totalLoad` field name** — Legacy from before we settled on **Volume**. The `WorkoutListItem.totalLoad` field still exists in the read model; new code and copy should refer to the metric as **Volume**.
- **Fill from Day uses the wrong last-performed rule** — Per intent, all last-performed hints should come from **Last Performed Set** (any-Day). Currently `loadFillTemplateData` uses `previousForDayBefore` to scope hints to the same Day only, which is inconsistent with the Unlogged Workout and ad-hoc paths. Filed as a follow-up to align Fill from Day on the any-Day rule. After the fix, `previousForDayBefore` becomes dead code.
- **`WorkoutSession*` symbol names** — `WorkoutSessionApi`, `createWorkoutSessionStore`, `WorkoutSessionSnapshot`, `WorkoutSessionStore` all conflict with the "session reserved for auth" rule. Filed as a rename-only cleanup: these should become `WorkoutEditor*` (or split into `WorkoutDetail*` for the API facade and `WorkoutEditor*` for the editor store).
