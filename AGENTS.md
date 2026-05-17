# Max Reps

A mobile-first workout tracking single-page app built with React, TypeScript, Vite, and Firebase (Auth, Firestore, Hosting).

**Domain language and design rationale live in [`CONTEXT.md`](./CONTEXT.md) and [`docs/adr/`](./docs/adr/). Read them before touching domain code.**

## Tech Stack

- React 19 + TypeScript (Vite)
- Tailwind CSS v4 (modern, minimal, Material-esque design)
- React Router v7 (history-based routing)
- Firebase modular SDK v11+ (Auth, Firestore, Hosting)

## Project Conventions

- All source code lives in `src/`.
- Shared types in `src/types/index.ts`.
- Firestore access goes through `FirestoreDataPort` (`src/lib/firestoreDataPort/`) — never import `firebase/firestore` directly from slices, components, or pages. See [ADR-0003](./docs/adr/0003-firestore-data-port.md). `createDataAccess` (`src/lib/dataAccess/`) composes CRUD slices on top of the port; cascading writes use `src/lib/firestorePersistence.ts`.
- Page components in `src/pages/`, shared components in `src/components/`, hooks in `src/hooks/` (feature hooks may live under `src/lib/<feature>/`), context providers in `src/contexts/`.
- Environment variables prefixed with `VITE_` (Vite convention) and stored in `.env` (gitignored). A `.env.example` template is committed.

## Quality Gates

Before submitting any changes, ensure:

1. **Formatting**: Run `npm run format` (Prettier). All code must be formatted.
2. **Linting**: Run `npm run lint` (OxLint). All errors must be resolved; warnings should be addressed when reasonable.
3. **Type checking**: Run `npm run typecheck` (tsc --noEmit). No TypeScript errors.
4. **Build**: Run `npm run build`. The project must compile cleanly.
5. **Tests**: Run `npm run test` (Vitest). All tests must pass.

## Firestore Data Model

Five top-level collections: `exercises`, `days`, `exerciseSetTemplates`, `workouts`, `sets`. All documents carry `createdAt`; all except `sets` also carry `updatedAt`. `sets` is top-level, not nested under workouts. The `exerciseSetTemplates` collection holds **Set Targets** (see CONTEXT.md) — the collection name is legacy.

## Guard Rails

Things where forgetting the rule causes silent breakage. Read the linked rationale before changing related code.

- **Single-Owner architecture** — one whitelisted Firebase UID has access; no `userId` on documents, no per-user query scoping. See [ADR-0002](./docs/adr/0002-single-owner-architecture.md) and the *Owner* entry in CONTEXT.md.
- **`performedAt` is denormalized** — Sets carry a `performedAt` mirror of `Workout.date` for query performance. Updates to `Workout.date` must propagate to child Sets. See [ADR-0001](./docs/adr/0001-denormalize-performed-at-onto-set.md).
- **Cascades** — Day deletion cascades to its **Set Targets**; Workout deletion cascades to its Sets. Exercise deletion does **not** cascade either direction (historical Sets stay readable via `exerciseNameSnapshot`; dangling Set Targets are deliberate). Spec in `src/lib/dataAccess/cascadePolicy.ts`.
- **No offline support** — always-online assumption; no offline persistence configured.
