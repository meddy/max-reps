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
A **Workout** that has been created but has zero logged **Sets**. Blank exercise lines in the **Workout Editor** are local only — Confirm and reload remove them. Reopening a Day-backed Unlogged Workout does not automatically recreate **Set Target** rows; use **Fill from Day** or **Add exercise**. Saving any Set transitions the workout to _logged_. In the **Workout Editor**, discarding an Unlogged Workout is labeled **Cancel** (same action as deleting the Workout; no confirm).
_Avoid_: template mode, template variant, day preview.

**Custom Workout**:
A **Workout** with no parent **Day** (`dayId` empty). Newly created Custom Workouts may have an empty `dayNameSnapshot` (shown as a muted “Untitled workout” placeholder). In the **Workout Editor**, when No Day is selected, the Owner can edit `dayNameSnapshot` (UI label “Title”); empty remains the “Untitled workout” placeholder. Selecting a Day later captures that Day's current name into `dayNameSnapshot`; switching back to No Day keeps the captured label. Exercises are added ad hoc or via **Fill from Day** after a Day is selected.
_Avoid_: free-form workout, ad-hoc workout.

**Fill from Day**:
A user action on a **Workout** that merges the parent **Day**'s **Set Targets** into the **Workout Editor** — appends missing exercises as blank Set-entry lines and refreshes Day target hints; never overwrites already-entered Set text. Does not remove existing blank lines (unlike changing the Workout's Day). Dangling Set Targets (missing Exercise) are skipped with a warning.
_Avoid_: fill template.

**Workout**:
One training session on a specific calendar date, owning the **Sets** logged during that performance. Optionally based on a **Day** (Day-backed) or created as a **Custom Workout** (no parent Day). Carries `dayNameSnapshot` so historical views stay stable if the referenced Day is later renamed or deleted, or to preserve a captured label for Custom Workouts. Exercises on a Workout are derived only from saved Sets (see [ADR-0004](./docs/adr/0004-derive-workout-exercises-from-sets.md)).
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

**Workout Editor**:
The in-memory inline-card state for editing one **Workout** at a time on the Workouts page: holds per-exercise Set-entry text drafts, validates the compact Set grammar, debounces/queues persistence, and tracks pending/invalid/error state. Distinct from the persisted **Workout** itself. Contained in `src/lib/workoutEditor/`. Edit mode is local and does not survive reload. Changing the Workout's Day drops blank exercise lines (no saved Sets and empty Set-entry text), syncs Day target hints on kept lines (clears hints for exercises not on the new Day, or all hints when switching to No Day), then merge-fills like **Fill from Day** when a Day is selected.
_Avoid_: workout session, session store, editor state.

**Owner**:
The single authenticated Firebase user permitted to read or write any data in this app. Identified by the UID configured in `VITE_ALLOWED_UID` (client) and `firestore.rules` (server-side `isOwner()`). All collections enforce the same rule: only the Owner can read or write. There is no concept of "users" beyond the Owner — documents don't carry a `userId` field, queries don't scope by user, and the app does not support sharing. See [ADR-0002](./docs/adr/0002-single-owner-architecture.md).
_Avoid_: user, account.

## Conventions

- **`nameLower` / `displayName`** — Both **Exercise** and **Day** carry this pair: `nameLower` is the case-insensitive uniqueness key (lookups and de-duplication), `displayName` is the rendered casing chosen at creation. Convention is `nameLower = displayName.toLowerCase().trim()`.
- **Day is a proper noun in UI** — In user-facing copy, always capitalize **Day** (`"Add a Day to get started."`, not `"Add a day..."`) to disambiguate from a calendar day. "Day template" is never used in UI copy; reword sentences so the bare noun **Day** stands.
- **Display Snapshot fields (`*NameSnapshot`)** — A **Workout** captures `dayNameSnapshot`; a **Set** captures `exerciseNameSnapshot`. For Day-backed workouts, `dayNameSnapshot` is a denormalized copy of the referenced Day's `displayName` written when the Day is selected; for **Custom Workouts**, it may be empty or a previously captured label. A Set's `exerciseNameSnapshot` is a denormalized copy of the referenced Exercise's `displayName`. Snapshots are write-once for a given capture and are not re-derived on rename. Job: keep historical views readable if the referenced entity is later renamed or deleted. Source of truth for editing surfaces remains the referenced entity itself; snapshots show up in historical read paths.
- **"Session" is reserved for auth** — The word _session_ refers exclusively to the user's authenticated session (`authSessionController`). A **Workout** is never a "session"; the in-memory editor is the **Workout Editor**, not a "workout session".
- **Same-date Workout ordering** — When multiple Workouts share a calendar `date`, list order is deterministic by document ID in the active sort direction (the existing `{ date, id }` query/cursor contract).

## Relationships

- A **Day** owns an ordered list of **Set Targets**
- A **Set Target** belongs to exactly one **Day** and references one **Exercise**
- A **Workout** optionally references a **Day** (Day-backed); a **Custom Workout** has no parent Day (`dayId` empty)
- A **Workout** owns zero or more **Sets**
- A **Workout** is **Unlogged** until its first **Set** is saved, then _logged_
- **Sets** are ordered workout-wide via `order` (a single sequence across the whole Workout). The user reorders **exercises**, not individual Sets — moving an exercise carries its Sets along while preserving their relative order within the exercise.
- A **Set Target** and a **Set** both reference an **Exercise**. Deleting an Exercise leaves historical Sets readable (via `exerciseNameSnapshot`) but leaves dangling Set Targets (see Flagged ambiguities).

## Flagged ambiguities

- **"Day" vs. calendar day** — "Day" is _not_ a calendar date. A [Workout](#) carries its own `date`; the `Day` it references is a named template, not the date it was performed.
- **`exerciseSetTemplates` collection name** — Legacy from before we settled on **Set Target**. Renaming the Firestore collection is invasive; reads/writes still use the old name. New code and docs should refer to the entity as a **Set Target**.
- **Dangling Set Targets after Exercise delete** — Deleting an **Exercise** does not cascade to **Set Targets** that reference it. Affected Set Targets are skipped by **Fill from Day** with a warning. Accepted: Exercises are rarely (if ever) deleted in practice, so this isn't currently worth automating away.
