# Derive Workout exercises from Sets only

A **Workout** has no separate exercise-list entity or field. The exercises shown on a card are derived from the Workout's saved **Sets** (grouped by `exerciseId`, ordered by Set `order`).

We considered adding an explicit Workout-exercise collection or array so blank “planned” rows could survive Confirm/reload. That would complicate the five-collection model, cascade rules, and copy/autosave paths for little gain once Set entry is free-form text.

## Consequences

- Empty exercise lines in the **Workout Editor** are local only. Confirm and reload remove them from the rendered card.
- Reopening a Day-backed **Unlogged Workout** does **not** automatically recreate **Set Target** rows; the editor stays empty until **Fill from Day** or **Add exercise**.
- Read-only display and **Copy** include only exercises that have saved Sets.
- **Fill from Day** is the recovery mechanism for restoring missing Day exercises as blank drafts.
