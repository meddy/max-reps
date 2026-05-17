# Denormalize `performedAt` onto Set documents

Each **Set** document carries a `performedAt` field that mirrors its parent **Workout**'s `date`. We keep the duplication on purpose: Firestore can't join, and several core queries — exercise history, top-set-per-workout chart, all-time PR, last-performed lookup — are indexed on `(exerciseId, performedAt desc)` directly on the `sets` collection. Computing the date from the parent Workout at read time would require an N+1 fan-out fetch and break those indexes.

## Consequences

`performedAt` is a derived mirror, not a free field. When `Workout.date` changes, all child Sets must be updated to match. The `WorkoutsDataSlice.update` path is responsible for propagating date changes; without that propagation, charts and PR queries can desync from the workout's displayed date.
