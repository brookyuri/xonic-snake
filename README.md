# Territory Snake

A real-time territory game for the mobile browser, with two modes:

- **Duel** — you and the computer each steer a snake on a 15×15 grid: leave your territory to draw a trail, come back to close the loop and capture everything inside, and cut the opponent's trail before they cut yours. The snakes move at the same time, one cell per tick. A match lasts two minutes.
- **Solo** — one snake on a 20×20 field whose frame is your land. Balls bounce around the empty part; close a loop and every area without a ball becomes yours. A ball touching your trail costs one of three lives. Capture 75% to reach the next level, with one more ball.

In both modes the snake moves on its own; you only steer.

The look is 8-bit: a black screen, a blue board frame, solid land and hatched trails, a pixel font for labels and blinking, step-by-step effects (all off with reduced motion).

Built as a portfolio project and a game-design experiment: the rules are specified up front, the engine is pure and tested, and the bot is explainable.

## Play

**https://territory-snake.vercel.app** — best on a phone. Add `?perf` to the URL to see tick timing and copy a performance report from the end screen.

## Run it

```bash
npm install
npm run dev       # dev server
npm run build     # static build in dist/ (relative paths, deployable to any sub-folder)
npm run preview   # serve the build locally
```

Controls: swipe on the board or tap the D-pad on phones; arrow keys or WASD on desktop. Space or P pauses (hiding the tab pauses too). The menu picks the mode (Duel / Solo), the bot for Duel (Easy / Normal) and the speed (Slow 400 ms, Normal 280 ms, Fast 180 ms per tick).

## Tests and benchmark

```bash
npm test          # unit tests, 2000-game invariant stress tests for Duel and Solo, a quick bot smoke match
npm run bench     # full bot tournament: win rates, P1/P2 balance, move timing (~1.5 min)
```

## Architecture

- `src/engine/` — the game rules as pure TypeScript with no UI imports: `createInitialState`, `getLegalMoves`, `resolveRound` → `{ state, events }`, the capture algorithm and runtime invariants.
- `src/engine/solo/` — Solo on top of the same legal moves, trail update and capture: `createSoloState`, `resolveSoloTick` → `{ state, events }`, seeded bouncing balls, lives and levels, invariants S1–S6.
- `src/bot/` — computer opponents built only on the public game state: position analysis (distance home, distance to a trail, potential capture), `randomBot`, `safeBot`, `normalBot` (a one-round maximin over a weighted evaluation, weights in `NORMAL_CONFIG`, choices explained by `explainMove`) and `easyBot` on top of it (`EASY_CONFIG`: slower reactions, mistakes, less caution).
- `src/game/` — the real-time loop without React: a shared tick controller with an injectable clock (countdown, drift-free ticks, pause), the two-press input queue and the wall rule. The Duel match computes bot decisions as generators in small slices between ticks; the Solo match adds short in-game holds (a lost life, a cleared level) before the next countdown.
- `src/ui/` — React + Tailwind screens (menu, how to play, game, pause) that drive the match controller and draw its state and events; no game logic lives here.
- The UI turns engine events into readable feedback: head movement, capture flashes, a one-line round summary, a trail-danger warning and an explained end screen.
- Playtest stats are kept in `localStorage` (`ts_stats` for Duel, `ts_solo` for Solo, `ts_games` for every game) and can be exported as JSON from the menu.

The rules are the single source of truth: see [GAME_RULES.md](GAME_RULES.md) for Duel and [SOLO_RULES.md](SOLO_RULES.md) for Solo. Product context is in [PRD.md](PRD.md).

## Screenshots

Duel:

| Menu | How to play | Game | End screen |
|---|---|---|---|
| ![Menu](docs/screenshots/375x667-menu.png) | ![How to play](docs/screenshots/375x667-howto.png) | ![Game](docs/screenshots/375x667-game.png) | ![End screen](docs/screenshots/375x667-death.png) |

Solo:

| How to play | Game | Ball hit | Level clear | End screen |
|---|---|---|---|---|
| ![How to play](docs/screenshots/375x667-solo-howto.png) | ![Game](docs/screenshots/375x667-solo-game.png) | ![Ball hit](docs/screenshots/375x667-solo-ball-hit.png) | ![Level clear](docs/screenshots/375x667-solo-level-clear.png) | ![End screen](docs/screenshots/375x667-solo-gameover.png) |
