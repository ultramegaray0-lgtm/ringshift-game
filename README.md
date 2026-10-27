# Ringshift

A ring-rotation light puzzle game in a single self-contained HTML file
(`ringshift v0.30.html`). There is nothing to install or build: open the file
in a browser to play.

## Live demo

**https://ultramegaray0-lgtm.github.io/ringshift-game/**

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
2. The **build** job copies `ringshift v0.30.html` to `index.html` in a
   temporary `_site/` folder. The source file in the repository is not renamed
   or changed. It then runs `.github/scripts/check_site.py`, which fails the
   run if the page references a local file that is missing or uses an absolute
   path that would break under `/ringshift-game/`.
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

Open `ringshift v0.30.html` directly in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/ringshift%20v0.30.html
```
