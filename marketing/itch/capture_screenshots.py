#!/usr/bin/env python3
"""itch.io store screenshots, captured from the real game build (nothing staged or edited).

    python3 marketing/itch/capture_screenshots.py ../ringshift-social-autopilot

Reuses the social autopilot's GameSession (scripts/capture_gameplay.py): it loads the game file named by
GAME_FILE in .github/workflows/pages.yml, finds each level's real solution with the game's own tracer, and enters
moves with real arrow-key presses. Output: marketing/itch/screenshots/*.png at 1920x1080 (16:9 desktop window) and
one 1080x1920 phone shot. Every shot is checked for page errors.
"""
import re, subprocess, sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
AUTOPILOT = Path(sys.argv[1] if len(sys.argv) > 1 else REPO.parent / "ringshift-social-autopilot").resolve()
sys.path.insert(0, str(AUTOPILOT / "scripts"))
import capture_gameplay as cg  # noqa: E402

wf = (REPO / ".github/workflows/pages.yml").read_text()
GAME = REPO / re.search(r"^\s*GAME_FILE:\s*(.+?)\s*$", wf, re.M).group(1).strip("\"'")
OUT = REPO / "marketing/itch/screenshots"
OUT.mkdir(parents=True, exist_ok=True)

# (file, aspect, mode, level index, theme or None, how far through the solution, note)
#   progress: "start" = untouched puzzle, a fraction = that share of the real solution entered, "solved" = all of it
SHOTS = [
    ("01-hard-puzzle-in-progress", "16:9", "hard", 10, None, 0.99, "Hard level part-way: beams bending through mirrors"),
    ("02-normal-solved-breach", "16:9", "normal", 22, "blueprint", "solved", "Every Lock lit: BREACHED"),
    ("03-easy-theme-start", "16:9", "easy", 14, "starchart", "start", "A level at its start in an unlockable theme"),
    ("04-hard-late-game", "16:9", "hard", 22, "vinyl", 0.5, "Late Hard level, several mechanisms at once"),
    ("05-phone-portrait", "9:16", "normal", 12, None, 0.5, "Phone portrait layout (the game is mobile-first)"),
]


def shoot(name, aspect, mode, idx, theme, progress):
    with cg.GameSession(GAME, aspect=aspect) as g:
        if theme:
            g.set_theme(theme)
        g.start_level(mode, idx)
        sol = g.solve(mode, idx)
        if sol is None:
            raise SystemExit(f"{name}: no solution found for {mode}:{idx + 1}")
        moves = sum(abs(d) for d in sol["deltas"] if d)
        g.begin_scene()
        if progress == "solved":
            won = g.play(sol)
            assert won, f"{name}: level did not report a win"
            g.page.wait_for_timeout(cg.WIN_SHOT_MS)
        elif progress != "start":
            ring_moves = sum(1 for d in sol["deltas"] if d)
            g.play(sol, stop_after=max(1, int(ring_moves * progress)))
            g.page.wait_for_timeout(500)
        else:
            g.page.wait_for_timeout(500)
        if g.errors:
            raise SystemExit(f"{name}: page errors {g.errors[:2]}")
        raw = OUT / f"{name}.raw.png"
        g.page.screenshot(path=str(raw))
    target = "1920:1080" if aspect == "16:9" else "1080:1920"
    dst = OUT / f"{name}.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-vf", f"scale={target}:flags=lanczos", str(dst)],
                   check=True)
    raw.unlink()
    return moves


if __name__ == "__main__":
    print(f"game: {GAME.name}")
    for name, aspect, mode, idx, theme, progress, note in SHOTS:
        moves = shoot(name, aspect, mode, idx, theme, progress)
        print(f"  {name}.png  {mode} {idx + 1}  theme={theme or 'default'}  {progress}  ({moves} solution moves)  - {note}")
