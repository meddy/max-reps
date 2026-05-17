# Hexagonal Firestore access via `FirestoreDataPort`

All Firestore reads and writes go through the `FirestoreDataPort` interface (`src/lib/firestoreDataPort/types.ts`). Two adapters implement it: a Firebase-backed adapter for production and an in-memory adapter for tests. The `DataAccess` layer (CRUD slices in `src/lib/dataAccess/`) and the **Workout Editor**'s session API depend only on the port, not on the Firebase SDK directly. This keeps the data layer fully testable without mocking Firebase, at the cost of one indirection layer in every read/write path.

## Consequences

The port surface must be kept narrow and stable: every method we add has to be implemented twice (Firebase + in-memory) and exercised by `firestoreDataPort.contract.test.ts` so both adapters stay behaviourally identical. UI code, slices, and the Workout Editor must never import from `firebase/firestore` directly — that's the rule that makes the abstraction valuable. Removing the port later would require rewriting every test that currently uses the in-memory adapter.
