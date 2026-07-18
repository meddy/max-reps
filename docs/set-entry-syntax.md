# Compact Set-entry syntax

The **Sets** field on an inline Workout card is free-form text that encodes an ordered list of **Sets** for one **Exercise**: reps, weight (lbs), and optional per-Set notes.

## Grammar

- Tokens are separated by commas. Surrounding whitespace is ignored.
- A token is either:
  - `weight x reps [note]` — nonnegative decimal weight, positive integer reps, optional trailing note; or
  - `reps [note]` — positive integer reps that inherit the current weight (starts at bodyweight `0`).
- `0xR` sets the current weight back to bodyweight (`0`). Subsequent bare reps stay bodyweight until another weight is introduced.
- Unquoted notes run to the end of the token (they may not contain commas).
- Quoted notes use double quotes and may contain commas. Inside quotes, `\"` and `\\` escape quote and backslash.
- Empty input is valid and means “no Sets” for that exercise (clears persisted Sets on reconcile).

## Examples

| Text                           | Sets                                    |
| ------------------------------ | --------------------------------------- |
| `4,5,6`                        | 4 / 5 / 6 reps at bodyweight            |
| `45x6,7,8`                     | 6 / 7 / 8 reps at 45 lbs                |
| `93x10, 65x9`                  | 10 reps at 93, then 9 at 65             |
| `9 new technique`              | 9 reps bodyweight, note `new technique` |
| `45x6, 0x8,9`                  | 6 at 45, then 8 and 9 bodyweight        |
| `9 "new technique, felt good"` | 9 bodyweight with a comma in the note   |

## Validation errors

Invalid text must leave persisted Sets untouched. Errors report a human-readable message and a character range (start/end offsets into the raw string) so the UI can highlight the problem.

Common failures: empty token, non-positive reps, negative weight, malformed `x`, unclosed quote, trailing junk after a quoted note.

## Canonical formatting

While the user edits, the raw textarea text is the source of truth. Blur and autosave **must not** rewrite it.

Canonical reconstruction happens only when edit mode opens from saved Sets (and for read-only / live preview tokens):

- Consecutive Sets that share a weight are grouped: first Set may emit `WxR` (or bare `R` at bodyweight); following same-weight Sets emit bare reps (and notes).
- Returning to bodyweight after a positive weight emits an explicit `0xR`.
- Notes are left unquoted when they contain no comma/quote/backslash; otherwise they are double-quoted with escapes.
- Spaces after commas are used for readability (`45x6, 7, 8`).

## Live preview

In the **Workout Editor**, a single non-editable preview at the bottom of the card shows exercise lines (name + styled tokens) for the whole workout. Blank lines are omitted; invalid lines still show partial tokens with a muted cue. The preview must not be focusable, must hide duplicate content from assistive technology (`aria-hidden`), and must never mutate textarea values.
