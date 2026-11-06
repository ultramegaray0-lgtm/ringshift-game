# itch.io upload — owner checklist (≈ 30 minutes)

Everything here needs your account, so only you can do it. Copy and settings: `STORE_PAGE.md`.

1. **Verify your itch.io email** (Settings → Email). itch refuses uploads until it is verified — this stopped the
   first attempt on 4 Nov.
2. Dashboard → **Create new project**. Fill the fields from `STORE_PAGE.md` → *Basic fields*.
   Keep **Visibility: Draft**.
3. **Uploads** → Upload files → `ringshift-v0.46-itch-html5.zip` → tick *This file will be played in the browser*.
   Set the embed options from `STORE_PAGE.md` (1024 × 768, Mobile friendly, Fullscreen button).
4. **Cover image** → `marketing/itch-cover/ringshift-itch-cover-630x500@2x.png`.
5. **Screenshots** → the five files in `screenshots/`, in the order listed in `STORE_PAGE.md`.
6. **Description** → paste from `STORE_PAGE.md`. Check that the Privacy / Terms links open.
7. **Trailer** → upload `Ringshift-Trailer-16x9.mp4` (from the 4 Nov trailer delivery) to YouTube, paste the
   YouTube link into *Gameplay video or trailer*. Watch it once with sound first — the audio has only been checked
   by measurement. The end card already shows `ringshift.itch.io/ringshift`, so the project URL must be exactly that.
8. **Edit theme** → colours from `STORE_PAGE.md`.
9. Save, open the page's **View page** link, and play one Easy level on desktop **and** on your phone:
   rings turn, a level completes, Options → Back Up Progress opens, Privacy / Terms open.
10. On launch day: **Visibility → Public**, then follow `../launch/CAMPAIGN.md` (post the devlog, merge autopilot PR #23).

## Package check (done 6 Nov, before handing over)

- ZIP built by `python3 tools/build_itch.py` from branch `release/v0.46-itch`: `index.html` (= `ringshift v0.46.html`),
  `privacy.html`, `terms.html`; no folders, no TikTok verification file, no absolute paths.
- `node tests/run.js` all pass (engine, levels, design, robust, stack, layout incl. itch embed sizes, save safety);
  `node tests/render.test.js` 3/3.
- `node tools/itch_embed_check.js dist/ringshift-v0.46-itch-html5.zip`: 30/30 in an itch-style cross-origin iframe
  (1024 × 768, 630 × 500, Pixel 7): v0.46 label, tally clear of the title, How To Play on first level, arrow keys
  rotate rings, save survives reload, legal pages served, 0 external / failed requests, 0 page errors.
