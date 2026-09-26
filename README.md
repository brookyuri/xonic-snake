# Territory Snake

A real-time territory duel for the mobile browser. You and the computer each steer a snake on a 15×15 grid: leave your territory to draw a trail, come back to close the loop and capture everything inside, and cut the opponent's trail before they cut yours. The snakes move on their own, one cell per tick and at the same time; you only steer. A match lasts two minutes.

Built as a portfolio project and a game-design experiment: the rules are specified up front, the engine is pure and tested, and the bot is explainable.

## Run it

```bash
npm install
npm run dev       # dev server
npm run build     # static build in dist/ (relative paths, deployable to any sub-folder)
npm run preview   # serve the build locally
```

Controls: swipe on the board or tap the D-pad on phones; arrow keys or WASD on desktop. Space or P pauses (hiding the tab pauses too). The menu picks the bot (Easy / Normal) and the speed (Slow 400 ms, Normal 280 ms, Fast 180 ms per tick).

## Tests and benchmark

```bash
npm test          # unit tests, a 2000-game invariant stress test and a quick bot smoke match
npm run bench     # full bot tournament: win rates, P1/P2 balance, move timing (~1.5 min)
```

## Architecture

- `src/engine/` — the game rules as pure TypeScript with no UI imports: `createInitialState`, `getLegalMoves`, `resolveRound` → `{ state, events }`, the capture algorithm and runtime invariants.
- `src/bot/` — computer opponents built only on the public game state: position analysis (distance home, distance to a trail, potential capture), `randomBot`, `safeBot`, `normalBot` (a one-round maximin over a weighted evaluation, weights in `NORMAL_CONFIG`, choices explained by `explainMove`) and `easyBot` on top of it (`EASY_CONFIG`: slower reactions, mistakes, less caution).
- `src/game/` — the real-time loop without React: a match controller with an injectable clock (countdown, drift-free ticks, pause), the two-press input queue and the wall rule. Bot decisions are generators, so the loop computes them in small slices between ticks instead of inside the tick frame.
- `src/ui/` — React + Tailwind screens (menu, how to play, game, pause) that drive the match controller and draw its state and events; no game logic lives here.
- The UI turns engine events into readable feedback: head movement, capture flashes, a one-line round summary, a trail-danger warning and an explained end screen.
- Playtest stats are kept in `localStorage` (`ts_stats`, `ts_games`) and can be exported as JSON from the menu.

The rules are the single source of truth: see [GAME_RULES.md](GAME_RULES.md). Product context is in [PRD.md](PRD.md).

## Screenshots

| Menu | How to play | Game | End screen |
|---|---|---|---|
| ![Menu](docs/screenshots/375x667-menu.png) | ![How to play](docs/screenshots/375x667-howto.png) | ![Game](docs/screenshots/375x667-game.png) | ![End screen](docs/screenshots/375x667-death.png) |
