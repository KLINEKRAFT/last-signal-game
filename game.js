import { createWorld } from "./world.js";
import { createSoundscape } from "./audio.js";

const $ = (id) => document.getElementById(id);
let world;
try {
  world = createWorld($("scene"));
} catch (error) {
  console.error("Unable to start the wilderness:", error);
  document.querySelector(".intro").textContent =
    "The wilderness needs WebGL 2. Enable hardware acceleration in your browser, then reload.";
  $("begin").disabled = true;
  $("begin").textContent = "3D graphics unavailable";
}
if (world) startGame(world);

function startGame(world) {
  const { rowan, piles, colliders, hAt } = world;
  const sound = createSoundscape();
  const SAVE_KEY = "last-signal-v1";
  const state = {
    started: false,
    paused: false,
    ended: false,
    salvaged: false,
    repaired: false,
    fuel: 35,
    food: 0,
    water: 0,
    parts: 0,
    elapsed: 0,
    day: 1,
    clock: 16 * 3600 + 17 * 60,
    tempF: -6,
    warm: 72,
    hung: 81,
    thir: 65,
    ener: 59,
    wood: 0,
    running: false,
    notes: [],
  };
  const keys = new Set(),
    target = { x: 0, z: 0 },
    stick = { x: 0, y: 0 };
  let holding = false,
    hasTarget = false,
    runToggle = false,
    pointerId = null,
    stickPointer = null,
    nearPile = null,
    action = null;
  let toastTimer,
    thoughtTimer,
    saveTimer = 0,
    hudTimer = 0,
    walkDistance = 0,
    lastTime = 0,
    time = 0;
  let needsRender = true;
  $("begin").disabled = false;
  $("begin").removeAttribute("aria-busy");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const entries = {
    arrival:
      "The engine is quiet. Everything else is too loud. The wind. My breathing. I need to find the radio.",
    salvage:
      "The radio housing is cracked, but the parts look intact. Three rations. Three flasks. Enough, if I keep moving.",
    wood: "Dry underneath the snow. My father would have called that a small mercy.",
    fire: "For a minute, my hands feel like mine again. I can do this.",
    ridge:
      "Those red trail stakes lead uphill. Someone has been here before me.",
    cold: "Keep moving, Rowan. One step. Then another.",
  };
  function toast(text) {
    $("toast").textContent = text;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2600);
  }
  function thought(key, text) {
    if (state.notes.includes(key)) return;
    state.notes.push(key);
    $("thought-copy").textContent = "“" + text + "”";
    $("thought").classList.add("show");
    clearTimeout(thoughtTimer);
    thoughtTimer = setTimeout(
      () => $("thought").classList.remove("show"),
      6500,
    );
  }
  function save() {
    if (!state.started || state.ended) return;
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          state: { ...state, running: false },
          position: { x: rowan.position.x, z: rowan.position.z },
          taken: piles.map((p) => p.taken),
        }),
      );
      $("save-status").textContent = "SAVED ON THIS DEVICE";
    } catch {
      $("save-status").textContent = "SAVING UNAVAILABLE";
    }
  }
  let saved = null;
  try {
    const candidate = JSON.parse(localStorage.getItem(SAVE_KEY));
    const numeric = [
      "clock",
      "day",
      "warm",
      "hung",
      "thir",
      "ener",
      "wood",
      "food",
      "water",
      "parts",
      "fuel",
      "elapsed",
    ];
    if (
      candidate?.state &&
      !candidate.state.ended &&
      numeric.every(
        (k) => Number.isFinite(candidate.state[k]) && candidate.state[k] >= 0,
      ) &&
      Number.isFinite(candidate.position?.x) &&
      Number.isFinite(candidate.position?.z) &&
      Array.isArray(candidate.taken) &&
      candidate.taken.length === piles.length
    )
      saved = candidate;
  } catch {}
  $("continue").hidden = !saved;
  function enter(restore = false) {
    if (restore && saved) {
      const fields = Object.keys(state);
      for (const field of fields)
        if (Object.hasOwn(saved.state, field))
          state[field] = saved.state[field];
      if (!Array.isArray(state.notes)) state.notes = [];
      rowan.position.set(
        Math.max(-95, Math.min(95, saved.position.x)),
        0,
        Math.max(-95, Math.min(95, saved.position.z)),
      );
      piles.forEach((p, i) => {
        p.taken = !!saved.taken[i];
        p.mesh.visible = !p.taken;
      });
    }
    rowan.position.y = hAt(rowan.position.x, rowan.position.z);
    Object.assign(state, {
      started: true,
      paused: false,
      ended: false,
      running: false,
    });
    $("boot").classList.add("gone");
    $("boot").setAttribute("aria-hidden", "true");
    hud();
    updateInteraction();
    save();
    if (!restore)
      thought("arrival", "If the radio survived, there’s still a way home.");
    $("pause").focus({ preventScroll: true });
  }
  $("begin").onclick = () => enter();
  $("continue").onclick = () => enter(true);

  function updateInteraction() {
    nearPile = null;
    action = null;
    let nearest = 2.4;
    for (const pile of piles) {
      const d = Math.hypot(
        rowan.position.x - pile.x,
        rowan.position.z - pile.z,
      );
      if (!pile.taken && d < nearest) {
        nearest = d;
        nearPile = pile;
      }
    }
    let label = "Keep exploring",
      hint = "KEEP A LITTLE WARMTH ALIVE",
      icon = "compass";
    if (nearPile) {
      label = "Gather wood";
      hint = "DRY BRANCHES · +1 WOOD";
      icon = "wood";
    } else if (
      !state.salvaged &&
      Math.hypot(rowan.position.x - 4, rowan.position.z + 3) < 6
    ) {
      action = "salvage";
      label = "Search wreckage";
      hint = "SALVAGE WHAT YOU CAN";
      icon = "plane";
    } else if (Math.hypot(rowan.position.x + 24, rowan.position.z + 24) < 3.5) {
      action = "beacon";
      label = "Send a signal";
      hint = "RADIO PARTS + 2 WOOD";
      icon = "radio";
    } else if (Math.hypot(rowan.position.x - 1.2, rowan.position.z + 1) < 4.5) {
      action = "fire";
      label = "Tend the fire";
      hint =
        state.fuel > 0
          ? Math.ceil(state.fuel) + "s OF WARMTH · 1 WOOD"
          : "RELIGHT WITH 1 WOOD";
      icon = "fire";
    }
    const available =
      !!(nearPile || action) && state.started && !state.paused && !state.ended;
    $("action-label").textContent = label;
    $("interaction-hint").textContent = hint;
    $("interact").disabled = !available;
    $("interact").classList.toggle("show", available);
    document
      .querySelector(".action-icon use")
      .setAttribute("href", "#icon-" + icon);
    const subject = nearPile
      ? { x: nearPile.x, z: nearPile.z, y: 0.8, text: "DRY WOOD", icon: "wood" }
      : action === "salvage"
        ? { x: 4, z: -3, y: 3.2, text: "THE WRECK", icon: "plane" }
        : action === "fire"
          ? { x: 1.2, z: -1, y: 1.8, text: "A LITTLE WARMTH", icon: "fire" }
          : action === "beacon"
            ? { x: -24, z: -24, y: 5, text: "THE BEACON", icon: "radio" }
            : null;
    if (subject && available) {
      const p = world.project(
        subject.x,
        hAt(subject.x, subject.z) + subject.y,
        subject.z,
      );
      const top = innerWidth < 700 ? 265 : 300,
        bottom = innerWidth < 700 ? innerHeight - 290 : innerHeight - 160;
      $("landmark").classList.toggle(
        "visible",
        p.visible &&
          p.y > top &&
          p.y < bottom &&
          p.x > 45 &&
          p.x < innerWidth - 45,
      );
      $("landmark").style.left = p.x + "px";
      $("landmark").style.top = p.y + "px";
      $("landmark-text").textContent = subject.text;
      $("landmark")
        .querySelector("use")
        .setAttribute("href", "#icon-" + subject.icon);
    } else $("landmark").classList.remove("visible");
  }
  function interact() {
    if (!state.started || state.paused || state.ended) return;
    updateInteraction();
    if (nearPile) {
      nearPile.taken = true;
      nearPile.mesh.visible = false;
      state.wood++;
      sound.collect();
      toast("+1 dry wood · something to keep the cold out");
      thought("wood", "Dry underneath. A small mercy.");
    } else if (action === "salvage") {
      state.salvaged = true;
      state.parts = 1;
      state.food = 3;
      state.water = 3;
      sound.collect();
      toast("Radio parts · 3 rations · 3 water flasks");
      thought(
        "salvage",
        "The parts are intact. There must be a transmitter up on that ridge.",
      );
    } else if (action === "fire") {
      if (!state.wood) {
        toast("Find dry wood nearby to feed the fire.");
        return;
      }
      state.wood--;
      state.fuel = Math.min(150, state.fuel + 45);
      sound.collect();
      toast("Fire fuelled · stay close to recover warmth");
      thought("fire", "For a minute, my hands feel like mine again.");
    } else if (action === "beacon") {
      if (!state.salvaged) {
        toast("Recover the radio parts from the wreck first.");
        return;
      }
      if (state.wood < 2) {
        toast("Bring 2 wood to brace the broken antenna.");
        return;
      }
      state.wood -= 2;
      state.parts = 0;
      state.repaired = true;
      sound.signal();
      finish(true);
    }
    save();
    hud();
    updateInteraction();
  }
  $("interact").onclick = interact;
  function consume(kind) {
    if (!state.started || state.paused || state.ended) return;
    if (state[kind] <= 0) {
      toast(kind === "food" ? "No rations left." : "The last flask is empty.");
      return;
    }
    const meter = kind === "food" ? "hung" : "thir";
    if (state[meter] > 95) {
      toast("Save it for later. You’re doing alright.");
      return;
    }
    state[kind]--;
    state[meter] = Math.min(100, state[meter] + 35);
    sound.collect();
    toast(
      kind === "food"
        ? "A little food. A little more strength. +35 food"
        : "A careful sip. Keep some for the climb. +35 water",
    );
    save();
    hud();
  }
  $("eat").onclick = () => consume("food");
  $("drink").onclick = () => consume("water");
  function stopInput() {
    holding = false;
    hasTarget = false;
    pointerId = null;
    stickPointer = null;
    stick.x = 0;
    stick.y = 0;
    keys.clear();
    $("joystick-thumb").style.transform = "translate(0,0)";
  }
  function togglePause(guide = false) {
    if (!state.started || state.ended) return;
    state.paused = !state.paused;
    needsRender = true;
    stopInput();
    if (state.paused) {
      save();
      $("panel").dataset.mode = guide ? "guide" : "pause";
      $("panel-title").textContent = guide
        ? "Notes from the quiet."
        : "A moment to breathe.";
      $("panel-copy").textContent = guide
        ? "Salvage the aircraft for food, water and radio parts. Fallen branches will feed the fire. Stay near its warmth.\n\nFollow the red trail stakes northwest. Take the radio parts and two wood to the ridge-top beacon.\n\nHold the left thumb pad to walk. Tap the lightning bolt to run. Tap your supplies to use them. On a keyboard: WASD / arrows, E to interact, 1 / 2 for supplies, Shift to run."
        : "The wilderness can wait for a moment.\n\nYour expedition is saved on this device. Take a breath. There’s still a way home.";
      $("journal-entries").replaceChildren();
      for (const key of state.notes) {
        if (entries[key]) {
          const p = document.createElement("p");
          p.textContent = entries[key];
          $("journal-entries").appendChild(p);
        }
      }
      $("resume").hidden = false;
      $("panel").showModal();
    } else {
      $("panel").close();
      lastTime = performance.now();
    }
    updateInteraction();
  }
  $("pause").onclick = () => togglePause();
  $("help").onclick = () => togglePause(true);
  $("resume").onclick = () => {
    if (state.paused) togglePause();
  };
  $("panel").addEventListener("cancel", (e) => {
    e.preventDefault();
    if (!state.ended) togglePause();
  });
  $("restart").onclick = () => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {}
    location.reload();
  };
  function finish(won) {
    state.ended = true;
    needsRender = true;
    stopInput();
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {}
    $("panel").dataset.mode = "ending";
    $("panel-title").textContent = won
      ? "Someone heard you."
      : "The wilderness fell silent.";
    $("panel-copy").textContent = won
      ? "At first, only static. Then a voice.\n\n“Stay where you are, Rowan. We have your signal.”\n\nThe mountains haven’t changed. The cold hasn’t lifted. But you are no longer alone.\n\nTime in the wilderness: " +
        Math.floor(state.elapsed / 60) +
        "m " +
        Math.floor(state.elapsed % 60) +
        "s."
      : "Your " +
        (state.warm <= 0 ? "warmth" : state.thir <= 0 ? "water" : "food") +
        " ran out before the signal reached anyone.\n\nNext time, keep the fire close. Save your supplies. Follow the red stakes to the ridge.\n\nThere is a way home.";
    $("resume").hidden = true;
    $("panel").showModal();
    hud();
    updateInteraction();
  }
  $("sound").onclick = () => {
    const enabled = sound.setEnabled(!sound.enabled);
    $("sound").setAttribute("aria-pressed", String(enabled));
    $("sound").setAttribute(
      "aria-label",
      enabled ? "Mute ambient sound" : "Enable ambient sound",
    );
    if (!enabled && !window.AudioContext && !window.webkitAudioContext)
      toast("Ambient audio is unavailable in this browser.");
  };
  $("sprint").onclick = () => {
    if (!state.started || state.paused || state.ended) return;
    runToggle = !runToggle;
    $("sprint").setAttribute("aria-pressed", String(runToggle));
    $("sprint").querySelector("span").textContent = runToggle
      ? "RUNNING"
      : "WALKING";
  };
  window.addEventListener("keydown", (e) => {
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(
        e.key,
      ) &&
      state.started
    )
      e.preventDefault();
    if (e.repeat) return;
    keys.add(e.key.toLowerCase());
    if (e.key === "Escape" && state.started && !state.ended) {
      e.preventDefault();
      togglePause();
    }
    if (e.key.toLowerCase() === "e") interact();
    if (e.key === "1") consume("food");
    if (e.key === "2") consume("water");
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  const canvas = world.renderer.domElement;
  function setPointer(e) {
    const p = world.pointerTarget(e.clientX, e.clientY);
    if (p) {
      target.x = p.x;
      target.z = p.z;
      hasTarget = true;
    }
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (
      !state.started ||
      state.paused ||
      state.ended ||
      pointerId !== null ||
      e.button > 0
    )
      return;
    pointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    holding = true;
    setPointer(e);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (holding && e.pointerId === pointerId) setPointer(e);
  });
  function endPointer(e) {
    if (e.pointerId === pointerId) {
      holding = false;
      hasTarget = false;
      pointerId = null;
    }
    if (e.pointerId === stickPointer) {
      stickPointer = null;
      stick.x = 0;
      stick.y = 0;
      $("joystick-thumb").style.transform = "translate(0,0)";
    }
  }
  window.addEventListener("pointerup", endPointer);
  window.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("lostpointercapture", endPointer);
  const pad = $("joystick");
  function updateStick(e) {
    const r = pad.getBoundingClientRect(),
      dx = e.clientX - r.left - r.width / 2,
      dy = e.clientY - r.top - r.height / 2;
    const radius = r.width * 0.34;
    const length = Math.hypot(dx, dy),
      scale = length > radius ? radius / length : 1;
    stick.x = length > 5 ? (dx * scale) / radius : 0;
    stick.y = length > 5 ? (dy * scale) / radius : 0;
    $("joystick-thumb").style.transform =
      `translate(${dx * scale}px,${dy * scale}px)`;
  }
  pad.addEventListener("pointerdown", (e) => {
    if (!state.started || state.paused || state.ended || stickPointer !== null)
      return;
    stickPointer = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    updateStick(e);
  });
  pad.addEventListener("pointermove", (e) => {
    if (e.pointerId === stickPointer) updateStick(e);
  });
  pad.addEventListener("lostpointercapture", endPointer);
  function autoPause() {
    stopInput();
    if (state.started && !state.paused && !state.ended) togglePause();
  }
  window.addEventListener("blur", autoPause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) autoPause();
  });
  window.addEventListener("pagehide", save);
  function resizeWorld() {
    world.resize();
    needsRender = true;
  }
  window.addEventListener("resize", resizeWorld);
  window.visualViewport?.addEventListener("resize", resizeWorld);
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    autoPause();
    toast("Graphics paused. Reload to restore your saved expedition.");
  });

  function fmtTime(seconds) {
    let hour = Math.floor(seconds / 3600) % 24;
    const minutes = Math.floor((seconds % 3600) / 60),
      period = hour >= 12 ? "PM" : "AM";
    return (
      (hour % 12 || 12) + ":" + String(minutes).padStart(2, "0") + " " + period
    );
  }
  function meter(name, value) {
    const v = Math.max(0, Math.min(100, value));
    $("m-" + name).style.width = v + "%";
    $("v-" + name).textContent = Math.round(v);
    $("status-" + name).classList.toggle("critical", v < 25);
    $("status-" + name).setAttribute(
      "aria-label",
      { warm: "Warmth", hung: "Food", thir: "Water", ener: "Energy" }[name] +
        ": " +
        Math.round(v) +
        " percent",
    );
  }
  function hud() {
    $("inv-wood").textContent = state.wood;
    $("inv-food").textContent = state.food;
    $("inv-water").textContent = state.water;
    $("inv-parts").textContent = state.parts;
    $("eat").disabled = !state.food;
    $("drink").disabled = !state.water;
    const step = state.repaired ? 3 : state.salvaged ? 2 : 1;
    $("progress").textContent = String(step).padStart(2, "0") + " / 03";
    $("mission-fill").style.width =
      (state.repaired
        ? 100
        : state.salvaged
          ? state.wood >= 2
            ? 66
            : 40
          : 0) + "%";
    $("objective").textContent = state.repaired
      ? "A voice in the static"
      : state.salvaged
        ? "Reach the ridge"
        : "Search the wreckage";
    $("objective-detail").textContent = state.repaired
      ? "You are no longer alone."
      : state.salvaged
        ? "Radio parts. Two wood. One chance home."
        : "There might be something we can use.";
    const dest = state.salvaged ? { x: -24, z: -24 } : { x: 4, z: -3 },
      dx = dest.x - rowan.position.x,
      dz = dest.z - rowan.position.z;
    $("bearing").textContent = Math.round(Math.hypot(dx, dz)) + " M";
    // Screen-space bearing, matching the isometric camera and thumb directions.
    const right = dx * 0.78 - dz * 0.625,
      down = dx * 0.625 + dz * 0.78;
    $("direction-arrow").style.transform =
      "rotate(" + (Math.atan2(right, -down) * 180) / Math.PI + "deg)";
    $("hud-day").textContent = "DAY " + state.day;
    $("hud-time").textContent = fmtTime(state.clock);
    $("hud-temp").textContent =
      (Math.round(state.tempF) < 0 ? "−" : "") +
      Math.abs(Math.round(state.tempF)) +
      "°F";
    meter("warm", state.warm);
    meter("hung", state.hung);
    meter("thir", state.thir);
    meter("ener", state.ener);
    $("vignette").style.boxShadow =
      state.warm < 25
        ? "inset 0 0 100px rgba(148,193,226,.5)"
        : "inset 0 0 100px #1a334522";
    const distance = Math.hypot(rowan.position.x, rowan.position.z);
    $("place-name").textContent =
      Math.hypot(rowan.position.x + 24, rowan.position.z + 24) < 9
        ? "THE SIGNAL RIDGE"
        : distance > 14
          ? "THE QUIET PINES"
          : "THE CRASH SITE";
  }
  hud();
  function frame(now) {
    requestAnimationFrame(frame);
    const rawDt = lastTime ? (now - lastTime) / 1000 : 1 / 60;
    lastTime = now;
    const dt = Math.min(rawDt, 0.05);
    // The journal freezes the landscape and releases the GPU until play resumes.
    if ((state.paused || state.ended) && !needsRender) return;
    const active = state.started && !state.paused && !state.ended;
    if (!state.paused && !state.ended) time += dt;
    let moving = false;
    const horizontal =
      (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
      (keys.has("a") || keys.has("arrowleft") ? 1 : 0) +
      stick.x;
    const vertical =
      (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
      (keys.has("w") || keys.has("arrowup") ? 1 : 0) +
      stick.y;
    const directional = Math.abs(horizontal) + Math.abs(vertical) > 0.01;
    if (active && directional) {
      target.x = rowan.position.x + (horizontal * 0.78 + vertical * 0.625) * 4;
      target.z = rowan.position.z + (vertical * 0.78 - horizontal * 0.625) * 4;
      hasTarget = true;
    }
    state.running =
      active && (runToggle || keys.has("shift")) && state.ener > 5;
    if (active && (holding || directional) && hasTarget) {
      const dx = target.x - rowan.position.x,
        dz = target.z - rowan.position.z,
        distance = Math.hypot(dx, dz);
      if (distance > 0.35) {
        const heading = Math.atan2(dx, dz);
        let turn = heading - rowan.rotation.y;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        rowan.rotation.y += turn * (1 - Math.exp(-dt * 12));
        const inputStrength = directional
          ? Math.min(1, Math.hypot(horizontal, vertical))
          : 1;
        const speed =
          (state.running ? 6.3 : 3.7) *
          (state.ener < 10 ? 0.65 : 1) *
          inputStrength;
        let nx = rowan.position.x + (dx / distance) * speed * dt,
          nz = rowan.position.z + (dz / distance) * speed * dt;
        for (const c of colliders) {
          const cx = nx - c.x,
            cz = nz - c.z,
            d = Math.hypot(cx, cz),
            radius = c.r + 0.38;
          if (d < radius) {
            if (d > 0.001) {
              nx += (cx / d) * (radius - d);
              nz += (cz / d) * (radius - d);
            } else nx += radius;
          }
        }
        nx = Math.max(-95, Math.min(95, nx));
        nz = Math.max(-95, Math.min(95, nz));
        const travelled = Math.hypot(
          nx - rowan.position.x,
          nz - rowan.position.z,
        );
        walkDistance += travelled;
        moving = travelled > 0.001;
        rowan.position.x = nx;
        rowan.position.z = nz;
        if (walkDistance > 0.65) {
          walkDistance = 0;
          world.footprint();
          sound.step();
        }
      }
    }
    rowan.position.y = hAt(rowan.position.x, rowan.position.z);
    if (active) {
      state.elapsed += dt;
      state.clock += 144 * dt;
      if (state.clock >= 86400) {
        state.clock -= 86400;
        state.day++;
        toast("Another morning. Keep going.");
      }
      const sunArc = Math.sin(((state.clock / 3600 - 6) / 12) * Math.PI);
      state.tempF = -10 + sunArc * 8;
      const nearFire =
        Math.hypot(rowan.position.x - 1.2, rowan.position.z + 1) < 4.5;
      state.fuel = Math.max(0, state.fuel - dt);
      const coldRate =
        (state.tempF < 0 ? 0.1 : 0.05) + (1 - Math.max(0, sunArc)) * 0.05;
      state.warm = Math.min(
        100,
        Math.max(
          0,
          state.warm +
            (nearFire && state.fuel > 0
              ? 2.8
              : -coldRate * (moving ? 0.7 : 1)) *
              dt,
        ),
      );
      state.ener = Math.max(
        0,
        Math.min(
          100,
          state.ener + (moving ? (state.running ? -1.4 : -0.22) : 0.18) * dt,
        ),
      );
      state.hung = Math.max(0, state.hung - 0.07 * dt);
      state.thir = Math.max(0, state.thir - 0.1 * dt);
      if (state.warm <= 0 || state.hung <= 0 || state.thir <= 0) finish(false);
      else if (state.warm < 25)
        thought("cold", "One step. Then another. Don’t stop now.");
      else if (
        state.salvaged &&
        rowan.position.x < -10 &&
        rowan.position.z < -10
      )
        thought("ridge", "Red stakes. Someone knew a way through here.");
      saveTimer += dt;
      if (saveTimer > 5) {
        saveTimer = 0;
        save();
      }
    }
    hudTimer += dt;
    if (hudTimer > 0.15) {
      hudTimer = 0;
      hud();
      updateInteraction();
      const stats = world.metrics();
      $("scene").dataset.drawCalls = stats.drawCalls;
      $("scene").dataset.threeRevision = stats.threeRevision;
    }
    sound.update({
      distanceToFire: Math.hypot(rowan.position.x - 1.2, rowan.position.z + 1),
      burning: state.fuel > 0,
      paused: state.paused || state.ended || !state.started,
    });
    if (!document.hidden)
      world.render({
        dt: state.paused ? 0 : dt,
        time: reducedMotion ? 0 : time,
        state,
        moving,
        target,
        holding: active && holding,
      });
    needsRender = false;
  }
  requestAnimationFrame(frame);
}
