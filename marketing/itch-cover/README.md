# Ringshift — itch.io cover

| File | Use |
|---|---|
| `ringshift-itch-cover-1920x1080.png` | Main 16:9 cover / key art (1920×1080). |
| `ringshift-itch-cover-630x500.png` | **itch.io cover image** — exactly 630×500 (upload this one). |
| `ringshift-itch-cover-630x500@2x.png` | Centre crop at itch.io's cover-image ratio (630×500), at 2× (1260×1000). |
| `ringshift-cover.html` | SVG source of the artwork (board, wordmark, background). |
| `board.json` | The board on the cover, traced by the game's own engine. |
| `trace_board.py` | Re-traces `board.json` with `traceAllBeams()` from the game file. |
| `build_cover.py` | Renders the PNGs (headless Chromium, 2× supersampled) and runs the beam/rim check. |

## Why the beams are correct

The board is a real Ringshift position, traced by the v0.44 engine (12 slots,
3 rings, all rotations 0; updated 4 Nov 2026 for the v0.36 mirror rule):

- **Mirror** — ring 1's source at 9 o'clock fires right into a pinned ╲ Mirror
  on ring 0. The beam enters the mirror's centre and leaves it straight down
  (the side the drawn bar deflects it, `mirrorReflect`), lighting Lock 4.
- **Prism** — ring 1's source at 6 o'clock fires up into a Prism on ring 2,
  which splits it ±45° onto Locks 11 and 1.
- **Block** — ring 2's source fires down-left into a Block on ring 0. The
  engine ends the beam there (`ends: block`), so Lock 7 behind it stays red.
  The wall is drawn over the beam with a hit flare on its face.

Its beams are not drawn by hand: `trace_board.py` loads the game file and
calls the game's `traceAllBeams()`, and the cover draws exactly those
segments. The engine ends a beam on a Block, a Source, an unpaired hole, or at
`RIM_R` (232), the centre line of the rim glass, so no beam can leave the board.

`build_cover.py` checks this on every render: it re-renders with only the
beam strokes visible and counts beam pixels outside the rim glass (radius 250
in game units). Current result: max engine beam radius 232.000, 0 pixels
outside the rim.

The "G" in the wordmark is an 8-slot rim (the size Easy levels use). Its bar
is a beam from a source at the centre that stops on that rim's centre line,
inside the lit Lock panel at 3 o'clock.

## Rebuild

```sh
pip install playwright pillow numpy && playwright install chromium
cd marketing/itch-cover
python3 trace_board.py "../../ringshift v0.43.html" board.json
python3 build_cover.py board.json .
```

The wordmark uses the Inter Display Black font; install it for an identical render.
