# Ringshift — itch.io cover

| File | Use |
|---|---|
| `ringshift-itch-cover-1920x1080.png` | Main 16:9 cover / key art (1920×1080). |
| `ringshift-itch-cover-630x500@2x.png` | Centre crop at itch.io's cover-image ratio (630×500), at 2× (1260×1000). |
| `ringshift-cover.html` | SVG source of the artwork (board, wordmark, background). |
| `board.json` | The board on the cover, traced by the game's own engine. |
| `trace_board.py` | Re-traces `board.json` with `traceAllBeams()` from the game file. |
| `build_cover.py` | Renders the PNGs (headless Chromium, 2× supersampled) and runs the beam/rim check. |

## Why the beams are correct

The board is a real Ringshift position (12 slots, 3 rings: a Prism, a pinned
Mirror, two Blocks, three lit Locks and one unlit Lock). Its beams are not
drawn by hand: `trace_board.py` loads `ringshift v0.34.html` and calls the
game's `traceAllBeams()`, and the cover draws exactly those segments. The
engine ends a beam on a Block, a Source, an unpaired hole, or at `RIM_R`
(232), the centre line of the rim glass, so no beam can leave the board.

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
python3 trace_board.py "../../ringshift v0.34.html" board.json
python3 build_cover.py board.json .
```

The wordmark uses the Inter Display Black font; install it for an identical render.
