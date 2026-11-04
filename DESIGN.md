# Last warm light

Last Signal should feel like a small human story inside a much larger place. The fire, Rowan's coat, the repaired antenna and the paper journal share the warm end of the palette. Snow, shadow, water and spruce occupy the cold end. Warmth has a purpose: it marks the things worth moving toward.

## World and character

The artwork is generated in `world.js`: faceted snow with subtle vertex colours; irregular, layered, snow-laden spruce; dark stone with snow caps; a frozen creek with fracture lines; and red trail stakes that lead toward the beacon. The aircraft has a cabin, windshield, striped fuselage, tailplane, a surviving wing, a detached wing, a damaged propeller and a sunken wheel. A suitcase and thermos suggest a journey interrupted.

Rowan wears a tapered ochre parka, fur-lined hood, scarf, mittens, boots and a strapped pack. Limb pivots produce a walking cycle. A scarf shifts in the wind, breath catches the light, and footprints remain behind. Firelight, embers, smoke and subdued falling snow bring motion to the clearing. Reduced-motion preferences suppress decorative oscillation and CSS transitions.

The title is a literary cover over the live world. The journal uses warm paper, human language and remembered observations. There are no web fonts or downloaded artwork. System serif, sans-serif and monospaced faces keep the interface ready without network requests.

## iPhone first

Portrait composition is designed at 390 × 844, with coverage for 320 × 568 and landscape. Safe-area insets protect the header and bottom controls. The central landscape stays open. A left thumb pad gives camera-relative movement; the right thumb has the current action and a run toggle. Inventory supplies can be tapped directly. The whole terrain also supports hold-and-steer. Desktop keyboard and pointer controls remain available.

Pause, field journal and sound controls have 44 CSS-pixel hit areas. Sound is opt-in and starts only after a gesture, respecting mobile browser audio requirements. The app pauses and clears input on blur or a hidden page; pointer capture and cancellation avoid stuck movement. Touch scrolling remains available inside the journal.

## Three.js research and implementation

The engine is pinned to **Three.js 0.187.0**, served as local ES modules. Current Three.js requires WebGL 2; a visible startup message handles unsupported graphics contexts.

- [Colour management](https://threejs.org/manual/pages/color-management.html): use the modern linear working-space pipeline, sRGB output, and ACES filmic tone mapping. Do not compensate for missing colour management by overexposing white snow.
- [Responsive rendering](https://threejs.org/manual/pages/responsive.html): keep UI dimensions in CSS pixels, cap drawing-buffer dimensions, and avoid blindly rendering every high-density phone pixel. The game caps the ratio at 1.6, the buffer at 1.6 million pixels, and can lower resolution after sustained slow rendering.
- [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html): batch shared static primitives by geometry and material, batch repeated logs and character details, and use an instanced footprint pool. Scene density need not imply one draw call per tree or footprint.
- [Shadows](https://threejs.org/manual/pages/shadows.html): use a single 1024-pixel shadow map from the directional sun. Firelight casts no shadow map. A soft contact patch grounds Rowan without another lighting pass.
- [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html): the rendering backend is WebGL 2; no WebGPU dependency is needed for the iPhone browser experience.

`audio.js` synthesises a quiet wind bed, nearby fire texture, footsteps and interaction tones. No audio assets or external services are fetched. `game.js` owns input, progression, journal entries, UI, and device-local saves.

## Validation limits

Automated browser checks exercise the rescue loop, resource management, persistence, failures, keyboard/pointer controls, mobile touch input, portrait and landscape bounds, and the graphics draw-call budget. Browser emulation helps verify layout and interactions; it does not establish real iPhone frame rate, battery use, Safari toolbar behaviour, speaker quality or thermal performance. A physical iPhone playthrough remains useful before a public release.
