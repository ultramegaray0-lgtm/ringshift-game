# Ringshift — itch.io launch campaign (0 SAR)

Prepared 6 Nov 2026. Nothing here posts or sends anything by itself: every external action below is yours to take
(or to approve in the existing tools). Facts in every post were checked against `ringshift v0.46.html`.

**Launch day ("L") = the day the itch page goes Public.** Recommended: **Tue 10 or Wed 11 Nov 2026, 16:00–18:00
Riyadh** (13:00–15:00 UTC). If the page isn't ready by then, shift every row by the same number of days.

---

## 1. What already runs on its own (don't rebuild)

| System | State on 6 Nov | Launch role |
|---|---|---|
| X autopilot (`ringshift-social-autopilot`, daily 09:00 Riyadh via Buffer) | Broken 4–6 Nov by a date-dependent test; **fixed on main 6 Nov** (suite 889 OK). Next run 7 Nov 09:00 should post. | Daily real-gameplay posts. PR #22 adds 3+ hashtags; PR #23 (after launch) adds itch links. |
| Creator outreach (daily discovery + drafts, you approve each send) | **38 drafts awaiting you, 0 ever sent.** Demo link verified. | Section 4 picks who to approve first. |
| Reddit autopublish | Built, disabled; waits for Reddit API approval + per-community mod permission | Launch posts below are manual. |
| TikTok pipeline | Running (not a priority) | — |

## 2. Schedule

| Day | X (account) | Reddit (manual, your account) | Outreach (approve in Actions) | itch / YouTube |
|---|---|---|---|---|
| L−2 | Autopilot only | Read each sub's rules (sidebar + pinned) | Set `OUTREACH_SENDER_NAME` to your real first name | Verify itch email; create page as **Draft** from `marketing/itch/STORE_PAGE.md`; upload ZIP; play it once on the page |
| L−1 | Autopilot only | — | — | Upload `Ringshift-Trailer-16x9.mp4` to YouTube (Unlisted→Public on L); paste its link in itch's trailer field |
| **L** 16:00 | **Post A** (launch, trailer video, link) + pin it | **r/WebGames** (Post R1) | Approve **Tier 1** (5) | Page → **Public**; publish **Devlog D1**; merge PR #23 |
| L+1 | Autopilot (may pick an *invite* post now) + reply to every reply | **r/puzzlevideogames** (R2) | Tier 2 (5) | Answer every itch comment within 12 h |
| L+2 | **Post B** (developer story, GIF/clip) | **r/itchio** (R3) | Tier 2 cont. | — |
| L+3 | Autopilot | — | Tier 3 (5) | — |
| L+4 (Sat) | **Post C** #ScreenshotSaturday | **r/IndieGaming** (R4, only in its allowed self-promo format) | — | — |
| L+5..6 | Autopilot | r/logicpuzzles only if its rules allow game links | Follow-ups are automatic after 14 days | Read Analytics; fill the scorecard (section 6) |
| L+7 | **Post D** (week-one honest numbers — only real numbers) | — | Tier 3 cont. | Devlog D2: "What players found hardest" (from comments) |

Cadence rules: max **1 Reddit post per day**, never the same text twice, always reply to comments the same day.
X: at most 1 manual post per day on top of the autopilot (it posts once per Riyadh day).

## 3. Ready-to-post copy

Replace `ITCH` with `https://ringshift.itch.io/ringshift` once the page is public. Every X post is ≤ 280 weighted
characters with 3–5 hashtags and one link, and passes the autopilot's `post_rules.validate_post` with the itch
project URL configured (launch branch, PR #23).

**Post A — launch (attach the 16:9 trailer)**
> Rotate the rings, bend the light, and light every Lock at once. Ringshift has 110 levels and plays free in your browser on itch.io, on phone or desktop. ITCH #Ringshift #puzzlegame #indiegame #webgames

**Post B — developer story (attach a 4:5 clip from the autopilot's media-store)**
> A ring's own mirrors never touch its own beam. Every level in Ringshift is built on that one rule: you're always steering the other rings' light. Free on itch.io: ITCH #Ringshift #indiedev #gamedev #puzzlegame

**Post C — Screenshot Saturday (attach `04-hard-late-game.png`)**
> Hard 23: Echo satellites, Portals and an Amplifier on three rings. Four Locks, one moment where they all light. ITCH #ScreenshotSaturday #Ringshift #indiegame #puzzlegame

**Post D — week one (only after you have the numbers)**
> One week of Ringshift on itch.io: [N] plays, and the level people asked about most was [level]. Thank you for playing. ITCH #Ringshift #indiedev #puzzlegame

Alternative hooks for extra posts (pick one per day, never repeat):
- "Five Challenge levels. Four rings each. Exactly one winning rotation out of 20,736."
- "Meteor Attack: a meteor destroys a random Lock every 7 seconds. Being lit doesn't protect it."
- "A Prism splits one beam into two at ±45°. Sometimes that's the solution. Sometimes it's the trap."

**R1 — r/WebGames** (title)
> Ringshift — rotate concentric rings to steer beams of light onto every Lock at once (110 levels, mobile-friendly, no sign-up)

Body: two sentences on the rule, a line on controls (arrows or drag), "free, no ads, saves in your browser", link,
"I'm the developer, happy to hear which level stumps you." Link the itch page (r/WebGames wants a direct playable link).

**R2 — r/puzzlevideogames** (title)
> I made a ring-rotation light puzzle: every beam fires through the centre, and a ring's own pieces never affect its own beam

Body: explain that single rule and why it makes levels work, one screenshot (`01-hard-puzzle-in-progress.png`), the
link at the end. Ask: "Is the Hard ladder too steep?"

**R3 — r/itchio**: use the sub's release flair; title "Ringshift — my first release on itch.io, a browser light
puzzle"; body: what's in it + one line asking for feedback on the page itself.

**R4 — r/IndieGaming**: only as a GIF/video post following its self-promo rules (the trailer's 1:1 cut fits).

**Devlog D1 (itch, launch day)** — title "Ringshift is on itch.io". Three short paragraphs: what the game is; what's in
the demo (the list from the store page); what you want feedback on (difficulty curve, phone controls). End with
"follow the page for new levels".

**YouTube trailer** — title "Ringshift — Trailer (free browser puzzle game)"; description first line = itch link;
then the store tagline and the 110-level list; tags: puzzle game, indie game, browser game, itch.io.

## 4. Creator outreach — who to approve first

From the 6 Nov outreach run (38 drafts awaiting approval). The tool caps sends at 5/day and re-checks the demo link
before each one. Before approving, read the draft: a few Gemini "personal sentences" are off (e.g. the CrazyGames
draft says players "browse the CrazyGames documentation" — reject/redo that one).

| Tier | When | Drafts (id · name · score) | Why |
|---|---|---|---|
| 1 | L | `od-056d28ef` Vane 97 · `od-a7789d57` Olexa 100 · `od-325e20e3` A Daily Slice Of Oranje 95 · `od-2217dc28` Thinky Games 85 (form — paste yourself) · `od-f85f5df5` Coolmath Games 90 (portal) | Highest-scored, puzzle-specific audiences |
| 2 | L+1–2 | `od-84f3a516` Near Tragedy 90 · `od-6cfee649` I Dream of Indie Games 90 · `od-f965dbf3` Jugando Indies 90 · `od-6b76c246` Games Puff 85 · `od-a90efac7` tytrgames 85 | Indie/puzzle coverage, regular uploads |
| 3 | L+3–7 | `od-e2cafd97` SableGhost 80 · `od-845abe04` Mets ta Quest 80 · `od-107a7d94` BrainBendersBanter 73 · `od-1a3f32eb` ChippyFindsGames 70 · `od-003d5998` Alpha Beta Gamer 55 | Good fit, smaller reach |
| Review first | — | eagleRUDRA Shorts, Joker Yt, Rajput Gamer, VoodooDE VR, UniqueGeese | Fit is doubtful from the channel names; open each channel before approving |

How: Actions → *Ringshift creator outreach* → Run workflow (main) → mode `deliver`, draft id, approval code (in the
run summary), recipient typed in full, delivery `gmail-draft` (you press Send in Gmail).

Drafts made before PR #23 is merged carry the GitHub Pages link; that's fine (same build). After the merge, new drafts
use the itch link.

## 5. Tracking links

| Channel | Link to use | Where the number shows up |
|---|---|---|
| X (all posts) | `https://ringshift.itch.io/ringshift` | Buffer analytics "clicks" (already pulled daily into `data/metrics.json` / `data/report.md`) + itch referrer `t.co` |
| Reddit | same link | itch referrers `reddit.com` / `old.reddit.com`; post views on Reddit |
| YouTube trailer | same link, first line of the description | YouTube Studio "Outbound clicks" is not available; use itch referrer `youtube.com` |
| Creator emails | demo link in the draft | itch referrer = the creator's video/site once they cover it |
| itch browsing | — | itch Analytics: views from itch.io itself (search, tags, New & Popular) |

itch.io's Analytics page splits views and plays by referring site for free, so one clean link per channel is enough;
there's no need for a paid link shortener. Keep links unmodified so the autopilot's "exact project URL" rule passes.

## 6. Measurement — weekly scorecard

Fill this every Monday from itch Analytics, `data/report.md` (X) and the outreach run summary. Targets are for the
first 14 days and are deliberately modest for a page with no followers.

| Metric | Source | 14-day target | Week 1 | Week 2 |
|---|---|---|---|---|
| itch page views | itch Analytics | 1,000 | | |
| Browser plays | itch Analytics ("plays" for HTML games) | 250 | | |
| **Play rate** = plays ÷ views | computed | ≥ 25 % (below 15 % → fix cover/screenshots/first line) | | |
| itch followers + collections | itch Analytics | 15 | | |
| itch comments | page | 5 | | |
| X impressions (all posts) | `data/report.md` | 3,000 | | |
| X link clicks | `data/report.md` | 40 | | |
| Reddit: post upvotes / comments | each post | best post ≥ 30 upvotes | | |
| Outreach sent / replies / coverage | outreach run summary | 20 sent / 2 replies / 1 video | | |
| Trailer views | YouTube Studio | 300 | | |

**Player-interest signals that decide what's next** (more important than raw views): comments asking for more
levels; people naming a specific level; followers; a creator covering it unprompted; a play rate above 25 %.
Two or more of these by L+14 → start the paid full-version plan (store page, more levels, $4.99). None → improve the
first five minutes before spending effort on reach.

The game itself stays analytics-free (the Privacy Policy promises no trackers), so all measurement comes from the
platforms above.
