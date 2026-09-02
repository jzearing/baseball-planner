# Lineup Planner

A single-page app that helps youth baseball and soccer coaches plan which player plays which
position in each inning, half or quarter, plus a batting order for baseball. Everything runs in the browser: there is
no backend, and the roster, rules and plan are saved to `localStorage` (or exported
to a JSON file you can import later).

## Features

- Pick the sport. Baseball plans innings with a batting order; soccer plans halves, thirds or
  quarters with formation presets (7v7, 9v9, 11v11) and no batting order.
- Enter the roster, the game length and which positions are in play.
  Untick a player who is absent to leave them out of the plan without deleting them.
- A library of constraints, each with a checkbox and its own parameters:
  - No repeated positions (at most N times at the same position)
  - Equal bench time (within ± N innings)
  - No long bench streaks
  - No back-to-back same position
  - Everyone plays a position group (e.g. the infield) at least N times before inning K
  - Who can play a position (e.g. only these players may pitch or catch), with an option to
    exempt that position from the repeated-position rules so a catcher can catch every inning
  - Positions a given player can play
- Every rule has a priority (P1–P9, set with − and +). When the rules cannot all be met, the
  solver satisfies higher-priority rules first: one P3 violation outweighs any number of P2
  ones. "Who can play a position" and "Positions a player can play" default to P3, bench
  rules to P2, and the rest to P1.
- **Preferences** tab: soft wishes such as "Eli would like to play SS". The solver honours
  them whenever the rules allow, and nothing is flagged when it cannot.
- **Randomize lineup** solves inning by inning from the first inning onward. If every rule
  cannot be met, earlier innings are satisfied first and the trouble lands in later innings.
- Drag a name onto another name to swap; drop it between two rows to insert and shift the
  others down. Drop a name onto a name in a different inning to trade those two players in
  both innings, so each inning still lists everyone once. Drag inning headers to reorder
  innings the same way. On a phone or tablet, press and hold a name, then drag.
- Every manual change re-checks the rules: offending names are highlighted with a ⚠ whose
  hover text explains which rule is broken.
- Lock (🔒) any player in place; **Randomize lineup** always leaves locked players where they
  are and re-solves everyone else. Batters can be locked too, so Shuffle keeps them in their spot.
- A batting order with the same drag-to-swap / drop-between-to-insert mechanics.
- Share a colour image of the plan straight to a text message (on browsers that support
  sharing files; elsewhere the image downloads), export to CSV, export/import JSON, and a
  landscape Print view that fits on one letter sheet.
- **Share link** packs the whole setup (roster, rules, plan, batting order) into the URL
  fragment as deflate-compressed base64url JSON. Anyone who opens the link gets an editable
  copy in their own browser; the fragment is never sent to a server. **QR code** shows the
  same link as a code another coach can scan with their phone camera.

## Development

```sh
npm install
npm run dev      # start the dev server
npm test         # run the unit tests (vitest)
npm run build    # type-check and build to dist/
```

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds the site and publishes it with
GitHub Pages on every push to `main`. Turn it on once in the repository settings:
**Settings → Pages → Build and deployment → Source: GitHub Actions**. The site is then
served at `https://<user>.github.io/<repo>/`.
