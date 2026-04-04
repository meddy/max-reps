# Architecture deepening candidates

**Execution order for all candidates:** [architecture-roadmap-all-candidates.md](./architecture-roadmap-all-candidates.md)

RFC-style plans for module-deepening refactors (John Ousterhout: small interface, large implementation). **Proposed interfaces are intentionally deferred** until a candidate is chosen; the next step is to frame constraints and run parallel interface designs per candidate.

Dependency categories (see project skill reference): **In-process**, **Local-substitutable**, **Remote but owned (ports & adapters)**, **True external (mock)**.

---

## 1. Unify Firestore access: `firestore.ts` + `dataAccess.ts` + Settings

### Problem

Two parallel stacks express the same concerns (timestamps on write, cascade deletes, collection references): `src/lib/firestore.ts` exposes `createDoc` / `updateDocById` / `deleteDocAndRelated`, while `src/lib/dataAccess.ts` uses private `addDocument` / `patchDocument` / `removeDocumentAndRelated` against the same `db`. Settings export/CSV uses `getCollectionRef` plus raw `getDocs` / `query` from `firestore.ts`, bypassing the `DataAccess` surface other features use. Understanding writes requires bouncing between both modules; behavior is easy to diverge.

### Proposed interface

_To be designed after candidate selection._ Direction: a single repository-style boundary that owns timestamps, cascades, and query entry points so Settings and CRUD share one path.

### Dependency strategy

- **Remote but owned (ports & adapters):** Firestore remains the production adapter; tests use an in-memory or fake adapter at the repository boundary (or existing Firebase test patterns consolidated here).
- **Data** layer primary; **UI** only as the Settings special-case consumer to fold in.

### Testing strategy

- **New boundary tests:** Timestamp/cascade/query invariants in one place; export path covered through the same facade.
- **Old tests to revisit:** `src/lib/firestore.test.ts` (e.g. `deleteDocAndRelated`) and `SettingsPage.test.tsx` mocks of `getCollectionRef` — replace with tests against the unified boundary where redundant.
- **Test environment:** Firestore emulator or injected fake `db`/adapter, aligned with how the chosen port is shaped.

### Implementation recommendations

- Own: all top-level collection writes, deletes with cascades, and shared read/query helpers used by features.
- Hide: raw `collection`/`doc`/`getDocs` usage from pages; chunking (`FIRESTORE_IN_MAX`) and timestamp fields.
- Expose: a narrow API (e.g. per-aggregate or a single facade) consistent for Settings and `dataAccess` callers.
- Migrate: move Settings off ad hoc `firestore` imports; delete duplicate helpers once callers route through one module.

---

## 2. Split or stratify `dataAccess.ts` monolith

### Problem

`src/lib/dataAccess.ts` (~730+ lines) combines exercises, days, templates, workouts, sets, Firestore `in`-chunking, name resolution, list aggregations (`listWithStats`), and `withSaving` integration. `createDataAccess(deps)` exists but the app always uses the exported singleton with real `db` and `savingStore`. The interface surface is nearly as large as the implementation (shallow module), so tests mock the entire `DataAccess` shape.

### Proposed interface

_To be designed._ Options to explore: vertical slices (e.g. workouts+sets read models), façade over sub-modules, or domain-shaped ports per aggregate.

### Dependency strategy

- **Remote but owned:** Firestore via injected `db` (or repository port).
- **Cross-cutting:** `savingStore` should attach at a clear boundary (single place that wraps writes), not scattered assumptions.

### Testing strategy

- **New boundary tests:** Per-slice or façade — behaviors at the public seam (list filters, cascades, aggregations) without reaching into private helpers.
- **Old tests to delete:** Shallow tests that only mirror internal function names once boundary tests exist.
- **Test environment:** `createDataAccess` with test doubles for `db` and saving hooks.

### Implementation recommendations

- Own: orchestration for each aggregate’s Firestore operations and invariants.
- Hide: chunking, query composition, and field normalization.
- Expose: stable, caller-oriented methods grouped by feature area.
- Migrate: pages/hooks depend on smaller types or a façade so mocks shrink.

---

## 3. React boundary: inject `DataAccess` instead of global import

### Problem

Pages (`WorkoutDetail`, `WorkoutHistory`, `DayList`, `DayDetail`, `ExerciseList`, `ExerciseDetail`) and `hooks/useExercisePicker.ts` import `dataAccess` directly. There is no single injection point at the app root. Tests rely on `src/test/mockDataAccess.ts` and `vi.mock("../lib/dataAccess")`, coupling every page test to the full mock object.

### Proposed interface

_To be designed._ Direction: React context provider or router-aware data layer that supplies a `DataAccess` (or slimmed port) so tests pass a local double without module-wide mocks.

### Dependency strategy

- **Cross-cutting** wiring between **UI** and **data**; underlying store remains **remote but owned**.

### Testing strategy

- **New boundary tests:** App shell provides implementation; one test verifies wiring and error boundaries if any.
- **Old tests to simplify:** Page tests use wrapper with fake `DataAccess` instead of global `vi.mock` of the whole module.
- **Test environment:** Lightweight fake implementing only methods the page needs.

### Implementation recommendations

- Own: how the tree receives data access (provider + hook).
- Hide: singleton import path from feature code.
- Expose: `useDataAccess()` (or similar) with a typed contract.
- Migrate: replace direct `dataAccess` imports incrementally; keep a default export for gradual rollout if needed.

---

## 4. Workout editor: `useWorkoutEditor` + `workoutEditorPersistence` + `WorkoutDetail`

### Problem

`src/hooks/useWorkoutEditor.ts` mixes React state, debounced timers, workout vs template persistence, local `isSaving`, and pure builders (`editorGroupsFromWorkoutSets`, etc.) in one file. `createDefaultWorkoutEditorPersistence()` in `src/lib/workoutEditorPersistence.ts` imports global `dataAccess`, weakening the hook’s injectable persistence abstraction. `WorkoutDetail.tsx` orchestrates loading, mode switching, date/note updates, deletes, and editor seeding.

### Proposed interface

_To be designed._ Direction: persistence as a true port (factory receives deps); editor state machine or service object hiding debounce/save sequencing; page as thin orchestration.

### Dependency strategy

- **UI** + **domain** (editor model) + **data** via injected persistence port (**ports & adapters**).

### Testing strategy

- **New boundary tests:** Seed/group invariants, persistence call order, debounced flush behavior through the hook’s public API or a thin façade.
- **Old tests:** `useWorkoutEditor.test.ts` can remain for pure transforms or fold into boundary tests if redundant.
- **Test environment:** In-memory persistence double; no global `dataAccess` in default test factory.

### Implementation recommendations

- Own: editor lifecycle, debouncing, and mapping between domain and persistence DTOs.
- Hide: `dataAccess` from default export path used in tests; timer details.
- Expose: hook props + persistence interface small enough to mock.
- Migrate: default factory takes `dataAccess` as parameter from app composition root.

---

## 5. Domain types vs Firebase `Timestamp`

### Problem

`src/types/index.ts` ties shared domain types (`Exercise`, `Workout`, `WorkoutSet`, …) to `Timestamp` from `firebase/firestore`. Any consumer of types drags Firebase’s type surface; fixtures often import `Timestamp` from Firebase.

### Dependency strategy

- **Data** persistence types leaking into **domain**; boundary belongs at serialization (**ports & adapters**): neutral types inside, adapter at Firestore edge.

### Testing strategy

- **New boundary tests:** Mappers to/from Firestore shapes (round-trip, null/edge fields).
- **Domain tests:** Use `Date`, ISO strings, or branded numbers — no Firebase imports.
- **Old tests:** Simplify fixtures that only existed to satisfy `Timestamp`.

### Implementation recommendations

- Own: domain fields in neutral forms; Firestore-specific types only in `lib/` adapters.
- Hide: `Timestamp` construction and conversion.
- Expose: domain types and explicit `toFirestore` / `fromFirestore` (or repository-returned DTOs).
- Migrate: mechanical refactor of types and call sites; high churn but clear seam.

---

## 6. Global save indicator vs editor-local saving

### Problem

`dataAccess` calls `startSaving` / `endSaving` from `src/lib/savingStore.ts`, consumed by `src/components/Layout.tsx` via `useSyncExternalStore`. `useWorkoutEditor` also tracks `savingCountRef` / `isSaving` around persistence — two notions of “saving” for related writes (`dataAccess.sets.*` already triggers `withSaving`).

### Dependency strategy

- **Cross-cutting** UX state across **data** and **UI**; can be **in-process** if modeled as a single write tracker with subscribers.

### Testing strategy

- **New boundary tests:** Single module owns in-flight write accounting; assert Layout + editor both observe the same source of truth for overlapping operations.
- **Old tests:** Remove duplicated assertions on parallel mechanisms.

### Implementation recommendations

- Own: correlation IDs or scoped write stacks if needed for nested operations.
- Hide: whether saving came from `dataAccess` or editor-specific paths.
- Expose: subscribe API or React hook used by Layout and editor.
- Migrate: route editor persistence through the same saving instrumentation as `withSaving`, or unify counting.

---

## 7. Exercise detail read model + chart

### Problem

`src/pages/exercises/ExerciseDetail.tsx` sequences multiple `dataAccess` calls then derives `setNumberBySetId`, `sortedSets`, `topSetsPerWorkout`, and chart points in `useMemo` blocks — domain-style ranking/sorting inside the route component, mostly untested.

### Dependency strategy

- **In-process** derivation from already-fetched data; inputs could be plain objects once types are neutral (ties to candidate 5).

### Testing strategy

- **New boundary tests:** Pure module (e.g. `buildExerciseDetailViewModel(...)`) with table-driven cases; no router/Firebase.
- **Page tests:** Thin integration (data in, rendered labels/chart props).
- **Old tests:** None to delete unless duplicated.

### Implementation recommendations

- Own: sort orders, PR selection rules, per-workout top-set logic, chart series shape.
- Hide: Firestore document layout from the derivation function (pass DTOs).
- Expose: one function or small object building view model + chart data.
- Migrate: move `useMemo` bodies into the module; page wires `dataAccess` → view model → UI.

---

## 8. (Optional) Auth: `AuthContext` + `firebase.ts` + `ProtectedRoute`

### Problem

`src/contexts/AuthContext.tsx` wires Firebase `User`, `onAuthStateChanged`, and `auth` singleton directly. `ProtectedRoute` and tests use Firebase-shaped mocks; allowlist/session rules are spread across context and route guard.

### Dependency strategy

- **Cross-cutting** auth; underlying Firebase Auth is **true external** at the SDK boundary — mock or fake auth module in tests (**mock** at port).

### Testing strategy

- **New boundary tests:** Auth façade: signed-in/out, allowlist deny, session persistence assumptions.
- **Old tests:** Consolidate duplicate Firebase mocks if one port suffices.

### Implementation recommendations

- Own: allowlist check, derived “can use app” state, and sign-in/out orchestration.
- Hide: Firebase SDK types from feature components where possible.
- Expose: context value with stable shapes (e.g. `status: 'loading' | 'signedOut' | 'ready' | 'denied'`).
- Migrate: `ProtectedRoute` consumes only context; tests inject fake auth port.

---

## As-built boundaries (implemented)

This section records what shipped so the RFC sections above stay readable as history.

| Area                           | As-built                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Writes / cascades**          | [`src/lib/firestoreWrites.ts`](../src/lib/firestoreWrites.ts) owns `addDocument`, `patchDocument`, `removeDocument`, `removeDocumentAndRelated`. [`src/lib/firestore.ts`](../src/lib/firestore.ts) keeps thin refs plus `deleteDocAndRelated` delegating to that layer; duplicate `createDoc` / `updateDocById` / `deleteDocById` removed. |
| **Date ↔ Firestore**           | [`src/lib/firestoreDocSerialize.ts`](../src/lib/firestoreDocSerialize.ts) (`writePayload`, `readTimestampAsDate`) and [`src/lib/firestoreModelMappers.ts`](../src/lib/firestoreModelMappers.ts) at the repository edge. Domain types in [`src/types/index.ts`](../src/types/index.ts) use `Date`.                                          |
| **`DataAccess` layout**        | Facade + slices under [`src/lib/dataAccess/`](../src/lib/dataAccess/): `exercisesSlice`, `daysSlice`, `templatesSlice`, `workoutsSlice`, `setsSlice`, `exportForBackup`, `templateQueries`, `withSaving`. Public API in [`types.ts`](../src/lib/dataAccess/types.ts); singleton in [`index.ts`](../src/lib/dataAccess/index.ts).           |
| **Settings export**            | [`exportForBackup`](../src/lib/dataAccess/exportForBackup.ts) on `DataAccess`; [`SettingsPage`](../src/pages/settings/SettingsPage.tsx) uses `useDataAccess()`.                                                                                                                                                                            |
| **React injection**            | [`DataAccessProvider`](../src/contexts/DataAccessContext.tsx) + [`useDataAccess()`](../src/contexts/DataAccessContext.tsx) in [`App`](../src/App.tsx). Provider defaults to imported `dataAccess` singleton (tests override `dataAccess` export via [`setup.ts`](../src/test/setup.ts) partial mock).                                      |
| **Workout editor persistence** | [`createWorkoutEditorPersistence(access)`](../src/lib/workoutEditorPersistence.ts); [`WorkoutDetail`](../src/pages/workouts/WorkoutDetail.tsx) passes `useDataAccess()`.                                                                                                                                                                   |
| **Saving signal**              | Editor no longer tracks duplicate `isSaving`; layout [`savingStore`](../src/lib/savingStore.ts) reflects all `dataAccess` writes (including editor) via `withSaving`.                                                                                                                                                                      |
| **Exercise detail VM**         | [`buildSetNumberBySetId`](../src/lib/exerciseDetailViewModel.ts), [`buildSortedSetsForHistory`](../src/lib/exerciseDetailViewModel.ts), [`buildTopSetsPerWorkoutChartSeries`](../src/lib/exerciseDetailViewModel.ts) + tests in [`exerciseDetailViewModel.test.ts`](../src/lib/exerciseDetailViewModel.test.ts).                           |
| **Auth façade (candidate 8)**  | **Deferred** per roadmap (only if auth/routing is touched). `AuthContext` and `ProtectedRoute` unchanged.                                                                                                                                                                                                                                  |

---

## How to use this document

1. Pick a candidate number (or combine 1+2 if unifying the data layer first).
2. Frame constraints (callers, Firestore rules, single-user assumptions) and sketch a non-binding API shape.
3. Produce **multiple contrasting interface designs** (minimal surface vs maximal flexibility vs default-caller ergonomics vs ports/adapters), compare trade-offs, and record the chosen design in a short addendum under that candidate’s section or a new file `plans/architecture-deepening-chosen.md`.
4. Implement with **boundary tests** replacing redundant shallow tests, per the testing strategy sections above.

No GitHub issue is required; this file is the planning artifact.
