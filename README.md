# Ringshift

A ring-rotation light puzzle game in a single self-contained HTML file
(`ringshift v0.44.html`). There is nothing to install or build: open the file
in a browser to play.

## Live demo

**https://ultramegaray0-lgtm.github.io/ringshift-game/**

Legal pages, linked from the difficulty screen and from Options:
[Privacy Policy](https://ultramegaray0-lgtm.github.io/ringshift-game/privacy.html) ·
[Terms of Service](https://ultramegaray0-lgtm.github.io/ringshift-game/terms.html)

The demo always shows the stable branch, `main`. It goes live after GitHub
Pages has been enabled for this repository (see *One-time setup* below) and the
first deployment has finished. The **Deployments → github-pages** entry on the
repository page shows the latest published commit.

## How publishing works

Publishing is automatic and handled by
[`.github/workflows/pages.yml`](.github/workflows/pages.yml):

1. A commit reaches `main` (a direct push or a merged pull request), or someone
   starts the workflow by hand from **Actions → Publish Ringshift to GitHub
   Pages → Run workflow** with the branch set to `main`.
2. The **build** job copies `ringshift v0.44.html` to `index.html` in a
   temporary `_site/` folder, next to the legal pages listed in `EXTRA_PAGES`
   (`privacy.html`, `terms.html`). The source files in the repository are not
   renamed or changed. It then runs `.github/scripts/check_site.py`, which
   checks every page and fails the run if one references a local file that is
   missing or uses an absolute path that would break under `/ringshift-game/`.
3. The **deploy** job publishes `_site/` to GitHub Pages using the official
   `actions/upload-pages-artifact` and `actions/deploy-pages` actions.

Safeguards:

- Only `main` is published. A manual run started on any other branch (for
  example `theme-redesign`) stops with an error and nothing is deployed.
- Only one deployment runs at a time. A newer commit waits for the current
  deployment instead of interrupting it.
- Each job gets the minimum token permissions it needs (`contents: read` and
  `pages: read` to build, `pages: write` and `id-token: write` to deploy).
- Players' saves live in their browser's `localStorage` on the demo's domain.
  Publishing a new build does not clear them.

If the game file is renamed for a future version, update `GAME_FILE` at the
top of the workflow.

### One-time setup (repository owner)

1. GitHub Pages needs a **public** repository on GitHub Free, or GitHub Pro /
   Team for a private repository.
2. In **Settings → Pages → Build and deployment**, set **Source** to
   **GitHub Actions**.
3. Run the workflow once from the Actions tab, or push a commit to `main`.

## Branches

| Branch | Purpose |
|---|---|
| `main` | Stable build. This is what the live demo publishes. |
| `visual-milestone-1` | HUD layout and mechanism readability pass (review). |
| `theme-redesign` | Full theme redesign (review, not yet published). |

To publish a reviewed branch, merge it into `main` with a pull request. The
merge commit triggers the deployment. To roll the demo back, revert that merge
commit on `main`; the revert triggers a new deployment of the previous build.

## Run locally

Open `ringshift v0.44.html` directly in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/ringshift%20v0.44.html
```

## Tests

The tests load the engine and level data straight out of the game file named
by `GAME_FILE` in the workflow, so they check exactly what players run. They
need only Node.js; the publish workflow runs them before every deployment.

```sh
node tests/run.js               # mirror rules + every level's win set + design rules + float robustness + stacked pieces + phone layout
node tests/render.test.js       # optional: drawn mirrors/beams vs engine, needs Playwright + Chromium
```

- `tests/mirror.test.js`: the Mirror reflection table (both bars, beams from
  all four sides), exact 90° turns toward the side the drawn bar faces, bar
  angle for pinned/unpinned mirrors, and bounces happening on the mirror.
- `tests/levels.test.js`: every level's winning rotations (and coin outcomes)
  must match `tests/golden/level-wins.json` (the coin column is traced with
  the gift-box Lock as a target, as the game does); every Easy / Normal / Hard
  gift box can be earned; no level starts solved; every
  Challenge level has exactly one answer; every mirror bounce in every
  rotation of every level happens at the mirror and turns the drawn way.
  After a deliberate level or engine change, regenerate the golden file with
  `node tests/levels.test.js --update` and review the diff. (A start-position
  change does not need it: wins don't depend on the start. v0.43 changed four
  starts, documented in `docs/START_POSITIONS_v0.43.md`, with the golden file
  untouched apart from its version line.)
- `tests/robust.test.js`: traces every rotation of every level a second time
  with `Math.sin`/`cos`/`atan2`/`sqrt`/`hypot` perturbed by a tiny relative
  error (1e-13) and requires identical results, so no level depends on
  last-bit float differences between browser engines (V8 / Safari /
  Firefox).
- `tests/stack.test.js`: stacked pieces. When turning a ring puts two of its
  pieces on one slot the engine keeps only one; this checks, for every
  rotation of every level, that the board draws the covered piece faded and
  the piece in play normally, marks a Black Hole whose twin is covered, and
  that a touch drag keeps working when the board is rebuilt mid-drag (its
  browser part needs Playwright + Chromium and skips without them).
- `tests/layout.test.js` (browser part needs Playwright + Chromium and skips without them): the difficulty
  screen's tally, title and INVENTORY never overlap in portrait or short landscape, and the demo-end
  screen shows no Steam link or WISHLIST button while `STEAM_STORE_URL` in the game file is empty (there is no
  store page yet; put the game's own store URL there to show the button).
- `tests/save.test.js` (browser part needs Playwright + Chromium and skips without them): Options → Back Up
  Progress. A backup code and a backup file each restore the exact same progress into an empty browser after a
  confirm; a wrong or cut-off code is refused; a damaged save falls back to the last save that loaded cleanly.
  Also: `tests/fixtures/save-v0.41.json` (a real save written by v0.41 after a full playthrough) loads to the
  identical save and restores through the dialog (raw, file, code); restoring an older backup warns, CANCEL keeps
  the newer save, CONFIRM gives exactly the older one; 19 kinds of invalid backup never touch a valid save (stored
  bytes unchanged); a damaged value is kept aside as `ringshiftDemoSave_v1_damaged`; and the whole flow works by
  taps on emulated iPhone SE and Pixel 5.
- `tests/design.test.js`: design rules for Meteor Attack, Space Orchestra,
  Rocket Attack and Challenge, which the golden file can't catch: each level's
  featured gimmick is needed by every answer, no ring is idle, every level can
  be won, Meteor levels have 1-2 answers and a ring frozen at the start costs a
  lock, Challenge routes have 6+ touches and land squarely on the Lock, and
  One-Way Street's Half-Blocks both let the answer through and stop wrong turns.
