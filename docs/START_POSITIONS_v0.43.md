# Starting positions changed in v0.43

Approved by the owner on 2026-11-02: change the **starting rotation only** of four levels so Easy 13 and Normal 24
are less frustrating and Easy 19 and Hard 6 are less of a pushover. Nothing else in these levels changes.

Rules for the change (from the approval): do not change puzzle solutions, required Locks, piece counts, gift
locations or rewards, beam mechanics or winning positions; do not touch Space Orchestra's final level; keep each
puzzle's identity and intended difficulty. If any change altered a solution or gift result, stop and report it.

## Original and new starts

A position is the rotation of each ring, inner ring first. "Moves" is the fewest ring steps from the start to a
winning position (each one-slot turn of one ring is one move); "gift" is the same to the winning position that
also lights the gift Lock. Stumble rate (from the v0.41 review): share of 200 simulated players who turn whichever
ring lights the most Locks, without lookahead, and reach a win.

| Level | Rings / slots | Original start | Moves (gift) | Stumble | New start | Moves (gift) | Stumble |
|---|---|---|---|---|---|---|---|
| Easy 13 | 4 / 12 | [6,5,8,1] | 7 (7) | 13–18% | [9,4,8,4] | 5 (6) | 76% |
| Normal 24 | 3 / 12 | [3,11,11] | 17 (18) | 1–2% | [3,7,4] | 8 (9) | 33% |
| Easy 19 | 2 / 10 | [6,9] | 1 (4) | 100% | [1,4] | 6 (6) | 73% |
| Hard 6 | 2 / 12 | [8,6] | 2 (5) | 93–95% | [11,2] | 7 (12) | 28% |

Every new start lights none of the required Locks and needs every ring turned (no ring already sits on every
answer). Easy 4 was reviewed but not approved, so it is unchanged. Space Orchestra is unchanged.

## What stays identical (and how it is proved)

Winning positions do not depend on the start: the engine decides a win from the rings' rotations alone. The proof
is mechanical, not by inspection:

1. The game file's diff against v0.42 is the `initialRotation` values above (9 numbers on 9 lines), one comment line per level recording the change, a note on Normal 24's old comment, and the version label.
2. The engine (`function slotToAngle(` … `const EMITTER_BOUNCES`) is byte-identical to v0.42.
3. `tests/golden/level-wins.json` (every winning rotation of every level and which gift Locks each lights) passes
   **without** `--update`; only its version header line changes.
4. For the four levels, the full win set and gift result were listed before and after:

| Level | Winning positions → gift Locks lit (before = after) |
|---|---|
| Easy 13 | 11,5,9,2 → 3 (gift) · 11,5,9,3 → none |
| Normal 24 | 9,5,5 → 10 (gift) · 9,6,5 → none |
| Easy 19 | 0,9 → none · 2,9 → 9 (gift) · 5,9 → none · 7,9 → none |
| Hard 6 | 7,5 → none · 5,8 → 2 (gift) · 5,9 → none |

5. Gift rewards are assigned per level slot (`rewardForLevel(mode, index)`), not per start, so every reward stays
   on the same level. The full scripted playthrough opens the same gift boxes and ends with the same totals.
