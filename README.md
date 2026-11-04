# Last Signal

A small, atmospheric 3D survival game in the Alaskan wilderness. Play as Rowan, salvage a downed aircraft, keep warm, and repair a ridge-top radio beacon to call for rescue.

## Play locally

Run `python3 -m http.server 8000` and open http://localhost:8000. No build or runtime dependencies are needed. Deploy the repository as a static site, including `vendor/`, `game.js`, and `styles.css`.

- **Move:** WASD / arrow keys, or hold and drag on the terrain.
- **Run:** Shift. Sprinting drains energy faster.
- **Interact:** E or the contextual button.
- **Supplies:** 1 to eat, 2 to drink, or tap the inventory buttons.
- **Pause / guide:** Escape or the top-right controls.

Search the aircraft for radio parts, food, and water. Gather fallen wood; each piece fuels the crash-site fire for 45 seconds. Stay near a burning fire to recover warmth. Bring the radio parts and **two wood** to the beacon northwest of the crash. Food, water, or warmth reaching zero ends the expedition.

Progress saves locally every five seconds, on interactions, and when pausing. Choose **Continue expedition** on the title screen to resume. New expedition starts fresh. Browser storage must be available to retain progress between visits.

## Development checks

```sh
npm ci
npm run check
npm test
```

Browser tests cover salvage, movement, pause, saves, supplies, gathering, fire recovery, beacon requirements, rescue, death, restart, and mobile pointer movement. Tests use `/usr/bin/chromium` by default; set `CHROMIUM_PATH` to your Chromium executable if needed. Python 3 runs the test server.

## Technical notes

Uses a locally bundled Three.js r128 (MIT; license included in the vendor bundle). Fonts load optionally from Google Fonts, with system fallbacks. WebGL is required. No account, backend, analytics, or external game API is used. Saves stay on the player's device.
