# Lineup Planner

A single-page app that helps youth baseball and soccer coaches plan which player plays which
position in each inning, half or quarter, plus a batting order for baseball, and then run the game
from the dugout with a full-screen scoreboard and field. Everything runs in the browser: there is
no backend, and the roster, rules, plan and live score are saved to `localStorage` (or exported
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
- The rule list is in priority order: drag a rule's ⋮⋮ handle to move it. When the rules cannot
  all be met, the solver satisfies rules nearer the top first, and one violation of a higher rule
  outweighs any number of violations of the rules below it. New "Who can play a position" and
  "Positions a player can play" rules are added at the top; other rules join at the bottom.
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
- **Game view** turns the screen into a dugout/sideline display:
  - A scoreboard across the top with the score by inning (or quarter or half) and the running
    total, laid out the usual way with the visitors on the first row. Innings still to come are
    left blank. Tap any box to move the game there: for baseball each row is one team's half, so
    tapping the home row's third box goes to the bottom of the 3rd. The box in play is ringed.
  - An overhead field — a diamond for baseball, a pitch for soccer — with every player's name
    where they are playing that period, plus the bench underneath.
  - **Swipe sideways** anywhere on the screen to move a half-inning (or period) on and back —
    handy with a phone in one hand. A mostly-vertical drag scrolls as usual, and a sideways one
    on the scoreboard scrolls that instead.
  - On a phone there is no room for the field and the batting order at once, so they take turns:
    the field while you are in the field, and the order — large enough to read at arm's length —
    while you bat. Swiping through the game alternates between them.
  - The +/− score buttons sit beside the scoreboard at the top, so the field gets the rest of
    the screen. Runs are added to whichever team is batting that half; soccer, where either
    side can score at any time, gets a pair per team. They are the only buttons on the screen —
    everything else is a tap on the thing itself.
  - For baseball, the batting order with the batter at the plate highlighted and who is on deck.
    Tap any name to put that batter up.
  - The screen is kept awake where the browser allows it, and the score survives a reload, so
    you can lock your phone between innings.
  - Set your team, the opponent and (for baseball) home or away under **Game** on the left.
    Home teams field the top half and bat the bottom; away teams the other way round.
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
