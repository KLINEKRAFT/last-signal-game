# Last Signal

A short, low-poly wilderness survival game set in Alaska. You are Rowan, stranded beside a crashed plane. Keep the campfire burning, recover three radio parts from orange supply crates, and transmit a distress call. Survive the 40-second rescue approach to make it home.

## Play locally

No build step or application dependencies are required:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Serve the same files with any static host, including GitHub Pages. WebGL is required. Three.js is bundled locally; Google Fonts is optional and falls back to system fonts.

## Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Move | WASD, arrows, or hold mouse on terrain | Hold and drag on terrain |
| Interact | E or action button | Action button |
| Eat / drink | 1 / 2 or inventory buttons | Inventory buttons |
| Pause | Escape or pause button | Pause button |

The objective panel points toward the next mission location. Fallen logs provide fuel; each orange crate provides a radio part, food, and water. Stand near a burning campfire to recover warmth and energy. Feed it before the fuel runs out. Low energy slows movement. Warmth, food, or water reaching zero ends the expedition. The game automatically pauses when its tab loses focus. Sound is optional and synthesized locally after user input.

## Development

- `index.html`: accessible interface and menus
- `style.css`: responsive field-journal presentation
- `game.js`: world, input, survival simulation, and mission
- `vendor/three.min.js`: Three.js r128 (MIT; see `vendor/THREE-LICENSE.txt`)
- `tests/game.cjs`: browser integration checks, using test-only simulation access injected by Playwright

With the local server running, install Playwright and its browser, then run:

```sh
npm install
npx playwright install chromium
npm test
```

Set `CHROMIUM_PATH` to use a system Chromium. Tests cover movement, pause, gathering, fire, salvage, consumables, transmission, rescue, death, restart, and a phone viewport. Test teleports accelerate mission verification; manual play remains useful for tuning pacing and device performance.

There is no persistence: restart begins a fresh expedition. The terrain is procedurally scattered each run. Nothing is sent to a backend.
