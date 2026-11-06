# Ringshift — itch.io store page (copy + settings)

Everything below is ready to paste into **itch.io → Dashboard → Create new project**. Every claim was checked
against `ringshift v0.46.html` on 6 Nov 2026 (level counts read from `LEVELS`, mechanics from How To Play).

---

## Basic fields

| Field | Value |
|---|---|
| Title | `Ringshift` |
| Project URL | `https://ringshift.itch.io/ringshift` (matches the trailer end card — keep it) |
| Short description / tagline | `Rotate the rings. Bend the light. Light every Lock at once.` |
| Classification | Games |
| Kind of project | HTML — "You only have an HTML file / ZIP to play in the browser" |
| Release status | **In development** (signals updates and devlogs; switch to Released for a 1.0) |
| Pricing | **No payments** for launch week, then **$0 or donate** (see *Pricing* below) |
| Uploads | `ringshift-v0.46-itch-html5.zip` → tick **This file will be played in the browser** |
| Genre | Puzzle |
| Tags (max 10) | `puzzle`, `logic`, `lasers`, `mirrors`, `minimalist`, `abstract`, `singleplayer`, `mobile`, `casual`, `space` |
| AI generation disclosure | itch asks whether AI generation was used. Answer truthfully for code, graphics, sound and text; the game and trailer were built with AI-assisted development, so disclose it rather than risk a delisting later. |
| App store links | none |
| Custom noun | leave empty |
| Community | **Comments** on (cheapest feedback channel) |
| Visibility | **Draft** until you've played it once on the page, then **Public** |

### Embed options (Uploads → the HTML file)

| Option | Value | Why |
|---|---|---|
| Viewport dimensions | **1024 × 768** | v0.46 fixed the tally overlap at ≤ 960 px, but 1024 × 768 still gives the board the most room on desktop |
| Mobile friendly | **On**, orientation **Default** | Game handles portrait and landscape itself |
| Automatically start on page load | Off | |
| Click to launch in fullscreen | Off | Fullscreen button is enough; desktop players like seeing the page |
| Fullscreen button | **On** | |
| Enable scrollbars | Off | |
| SharedArrayBuffer support | Off | Not used |

### Media

| Slot | File (in this folder unless stated) |
|---|---|
| Cover image (630 × 500) | `../itch-cover/ringshift-itch-cover-630x500@2x.png` (1260 × 1000, itch downsizes cleanly) |
| Gameplay video or trailer | YouTube link to `Ringshift-Trailer-16x9.mp4` (itch only accepts a YouTube/Vimeo URL here — upload it as Public or Unlisted first) |
| Screenshots, in this order | `screenshots/01-hard-puzzle-in-progress.png`, `02-normal-solved-breach.png`, `04-hard-late-game.png`, `03-easy-theme-start.png`, `05-phone-portrait.png` |
| Theme (Edit theme) | Background `#070B14`, text `#E9EEFB`, link `#46D9FF`, button `#46D9FF` — matches the cover |

---

## Description (paste into the Description box)

> Formatting: itch's editor accepts pasted rich text. Paste the block below, then make the `###` lines headings.

**Rotate the rings. Bend the light. Light every Lock at once.**

Ringshift is a hand-made light puzzle played on a set of concentric rings. Every Source fires its beam straight through the centre. Turn a ring and everything on it moves: mirrors swing into a beam's path, portals line up, blocks slide out of the way. A level is cleared only when **every Lock on the rim is lit at the same moment**.

It plays in your browser, on a phone or a desktop, with nothing to install.

### What's inside

- **110 levels** — 25 Easy, 25 Normal and 25 Hard, built and verified by hand so every level has a real, intended solution
- **5 Challenge levels** — one rim emitter, four rings, and exactly one winning rotation out of 20,736
- **3 bonus modes**, unlocked by winning levels:
  - **Meteor Attack** (10 levels) — a meteor destroys a random Lock every 7 seconds; save as many as you can
  - **Space Orchestra** (10 movements) — fogged Locks guarded by gray UFOs; knock them out with your beams
  - **Rocket Attack** (10 levels) — rockets strike wherever your beams end; plan around the damage
- **Mechanisms that combine in surprising ways**: Mirrors, Blocks, Amplifiers, Portals (black holes), Half-Blocks, Prisms and Echo satellites
- **Gift boxes** hidden behind optional Locks, unlocking visual themes, rims and beam colours
- A **hint** that appears only after you've spent five minutes on a level — no hand-holding before you want it

### Controls

| | Keyboard | Touch / mouse | Gamepad |
|---|---|---|---|
| Select a ring | ▲ ▼ | Tap its track | D-pad / stick |
| Rotate it | ◀ ▶ | Drag along the track | D-pad / stick |
| Pause | Esc | ❚❚ button | — |

How To Play is in Options and opens on your first level.

### Your progress

Progress saves automatically in your browser. Use **Options → Back Up Progress** to keep a backup file or code — handy if you clear your browser data or switch devices. Saves on itch.io and on the GitHub Pages version are separate.

### Privacy

No accounts, no ads, no analytics or trackers in the game. [Privacy Policy](https://ultramegaray0-lgtm.github.io/ringshift-game/privacy.html) · [Terms](https://ultramegaray0-lgtm.github.io/ringshift-game/terms.html)

### Follow development

Ringshift is in active development by a solo developer. New levels and mechanisms are posted on X as they're built — follow along, and leave a comment with the level that stumped you.

---

## Pricing

**Recommendation: free to play, with an optional tip — not paid, yet.**

- Launch week: **No payments**. Zero friction while the page has no ratings or comments; the only goal is plays.
- After ~100 plays: switch to **$0 or donate**, suggested **$2**. itch keeps the default 10% revenue share, which you can lower.
- A paid tier is the step after that, not now: Ringshift is a browser demo, labelled "DEMO", with no downloadable build or store page elsewhere. A paid **full version** (more levels, offline download, ~$4.99) makes sense once the free page shows real demand (a play-through rate above ~25% of views, unprompted comments, creators covering it).
- Cost to you today: **0 SAR**. Payouts need a PayPal or Stripe account and a tax interview in itch's Payout settings only once you enable payments.

## Release recommendation

- Publish **Tuesday or Wednesday**, 16:00–18:00 Riyadh time (≈ 13:00–15:00 UTC: morning in the US, afternoon in Europe).
- itch.io surfaces new projects in *New & Popular* for a short window, so have the X post, the r/WebGames / r/puzzles posts and the creator emails ready to go out the same day (see `../launch/CAMPAIGN.md`).
- Post a first **devlog** on the itch page on launch day ("Ringshift is on itch.io: what's in the demo"). Devlogs appear in followers' feeds and the itch devlog feed — free reach.
