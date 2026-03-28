# Max Reps

A mobile-first workout tracking single-page app built with React, TypeScript, Vite, and Firebase (Auth, Firestore, Hosting). Single-user app gated by a whitelisted Firebase UID.

## Tech Stack

- React 19 + TypeScript (Vite)
- Tailwind CSS v4 (modern, minimal, Material-esque design)
- React Router v7 (history-based routing)
- Firebase modular SDK v11+ (Auth, Firestore, Hosting)

## Project Conventions

- All source code lives in `src/`.
- Shared types in `src/types/index.ts`.
- Firebase initialization in `src/lib/firebase.ts`, Firestore helpers in `src/lib/firestore.ts`.
- Page components in `src/pages/`, shared components in `src/components/`, hooks in `src/hooks/`, context providers in `src/contexts/`.
- Environment variables prefixed with `VITE_` (Vite convention) and stored in `.env` (gitignored). A `.env.example` template is committed.

## Quality Gates

Before submitting any changes, ensure:

1. **Formatting**: Run `npm run format` (Prettier). All code must be formatted.
2. **Linting**: Run `npm run lint` (OxLint). All errors must be resolved; warnings should be addressed when reasonable.
3. **Type checking**: Run `npm run typecheck` (tsc --noEmit). No TypeScript errors.
4. **Build**: Run `npm run build`. The project must compile cleanly.

## Firestore Data Model

Five top-level collections: `exercises`, `days`, `exerciseSetTemplates`, `workouts`, `sets`.
All documents include `createdAt` (timestamp). All except `sets` include `updatedAt` (timestamp).
`sets` is a top-level collection (not a subcollection of workouts).

## Key Design Decisions

- `unit` field on sets is always `"lbs"` (no UI toggle).
- `performedAt` on sets is derived from the parent workout's `date` field.
- Deletion cascades: day -> its templates; workout -> its sets. Exercise deletion does NOT cascade to historical sets.
- No offline support. Always-online assumption.
- Single-user app: Firestore security rules restrict all reads/writes to one whitelisted UID.
