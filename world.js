import * as THREE from "./vendor/three.module.js";

// All art is built here from a small, shared set of faceted meshes.
// Static scenery is instanced by geometry/material before it reaches the GPU.
export function createWorld(container) {
  let seed = 76193;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scene = new THREE.Scene();
  const daySky = new THREE.Color("#9aafb3"),
    nightSky = new THREE.Color("#304a60");
  scene.background = daySky.clone();
  scene.fog = new THREE.FogExp2("#91a9b0", 0.011);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 260);
  const camTarget = new THREE.Vector3(0, 1, 0);
  const followTarget = new THREE.Vector3();
  const camOffset = new THREE.Vector3(20, 26, 25);
  let frustum = 34,
    quality = 1,
    frameAverage = 1 / 60,
    qualityFrames = 0;
  function resize() {
    const width = container.clientWidth,
      height = container.clientHeight;
    const aspect = width / height;
    frustum = aspect < 0.7 ? 34 : aspect < 1 ? 31 : 27;
    // Portrait framing leaves room above Rowan for the mission, and below for thumbs.
    camera.left = (-frustum * aspect) / 2;
    camera.right = (frustum * aspect) / 2;
    camera.top = frustum * 0.53;
    camera.bottom = -frustum * 0.47;
    camera.updateProjectionMatrix();
    const ratio = Math.min(devicePixelRatio || 1, 1.6) * quality;
    const pixelBudget = 1_600_000;
    const cap = Math.min(ratio, Math.sqrt(pixelBudget / (width * height)));
    renderer.setPixelRatio(1);
    renderer.setSize(Math.round(width * cap), Math.round(height * cap), false);
  }
  resize();
  const hemi = new THREE.HemisphereLight("#d0e1e5", "#516b78", 2.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#ffe0b0", 3.1);
  sun.position.set(-25, 32, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 100;
  sun.shadow.normalBias = 0.08;
  sun.shadow.bias = -0.0002;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const fillLight = new THREE.DirectionalLight("#91c6dd", 0.9);
  fillLight.position.set(10, 10, -20);
  scene.add(fillLight);
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 1,
      flatShading: true,
      ...extra,
    });
  const M = {
    snow: mat("#ccdde1"),
    snowLight: mat("#e5ebe6"),
    pine: mat("#244c49"),
    pineLight: mat("#35625a"),
    pineDark: mat("#173f40"),
    bark: mat("#68584a"),
    wood: mat("#665342"),
    woodEnd: mat("#b49c73"),
    rock: mat("#708b95"),
    rockDark: mat("#526e7c"),
    red: mat("#b7523b"),
    redDark: mat("#833f37"),
    ivory: mat("#dbd3b8"),
    steel: mat("#677e7d"),
    dark: mat("#243b43"),
    glass: mat("#4c7b85", { metalness: 0.15, roughness: 0.35 }),
    coat: mat("#cf8b3e"),
    coatLight: mat("#e0a250"),
    fur: mat("#d2bc8d"),
    skin: mat("#d49a70"),
    scarf: mat("#a34c3c"),
    pack: mat("#5d7160"),
    leather: mat("#463f39"),
    black: mat("#26383c"),
    ice: mat("#7eaab3", { roughness: 0.5, metalness: 0.08 }),
  };
  const G = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cone: new THREE.ConeGeometry(1, 1, 7),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 7),
    taper: new THREE.CylinderGeometry(0.78, 1, 1, 7),
    ico: new THREE.IcosahedronGeometry(1, 0),
    round: new THREE.IcosahedronGeometry(1, 1),
    plane: new THREE.PlaneGeometry(1, 1),
  };
  const staticArt = new THREE.Group();
  function part(
    parent,
    geometry,
    material,
    x = 0,
    y = 0,
    z = 0,
    sx = 1,
    sy = sx,
    sz = sx,
    rx = 0,
    ry = 0,
    rz = 0,
  ) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function batchChildren(parent, exclude = []) {
    const buckets = new Map();
    for (const child of [...parent.children]) {
      if (!child.isMesh || exclude.includes(child)) continue;
      child.updateMatrix();
      const key = child.geometry.uuid + child.material.uuid;
      if (!buckets.has(key))
        buckets.set(key, {
          geometry: child.geometry,
          material: child.material,
          meshes: [],
        });
      buckets.get(key).meshes.push(child);
    }
    for (const bucket of buckets.values()) {
      if (bucket.meshes.length < 2) continue;
      const batch = new THREE.InstancedMesh(
        bucket.geometry,
        bucket.material,
        bucket.meshes.length,
      );
      bucket.meshes.forEach((mesh, i) => {
        batch.setMatrixAt(i, mesh.matrix);
        parent.remove(mesh);
      });
      batch.castShadow = true;
      batch.receiveShadow = true;
      batch.computeBoundingSphere();
      parent.add(batch);
    }
  }
  function hAt(x, z) {
    const creekX = 18 + Math.sin(z * 0.075) * 4;
    return (
      Math.sin(x * 0.055) * Math.cos(z * 0.05) * 1.15 +
      Math.sin(x * 0.16 + 1.7) * Math.sin(z * 0.13) * 0.45 +
      Math.cos((x + z) * 0.025) * 0.8 -
      Math.exp(-((x - creekX) ** 2) / 35) * 0.65
    );
  }
  const groundGeo = new THREE.PlaneGeometry(224, 224, 112, 112)
    .rotateX(-Math.PI / 2)
    .toNonIndexed();
  const vertices = groundGeo.attributes.position,
    colors = [];
  const color = new THREE.Color();
  for (let i = 0; i < vertices.count; i += 3) {
    const x = vertices.getX(i),
      z = vertices.getZ(i);
    const trail = x < 1 && x > -30 && Math.abs(x - z) < 2.2;
    color.set(
      trail
        ? "#bfced0"
        : random() < 0.12
          ? "#c2d4da"
          : random() < 0.3
            ? "#d7e2e1"
            : "#cfdee0",
    );
    color.multiplyScalar(0.94 + random() * 0.1);
    for (let j = 0; j < 3; j++) {
      const k = i + j;
      vertices.setY(k, hAt(vertices.getX(k), vertices.getZ(k)));
      colors.push(color.r, color.g, color.b);
    }
  }
  groundGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(
    groundGeo,
    mat("#ffffff", { vertexColors: true }),
  );
  ground.receiveShadow = true;
  scene.add(ground);
  const colliders = [];
  const pileLocations = [
    [-3.5, 4.5],
    [9, 6],
    [-9, -7],
    [-16, -14],
    [-24, -20],
    [6, -12],
    [-30, -31],
    [14, -2],
  ];
  function clear(x, z) {
    return (
      Math.hypot(x, z) > 7.8 &&
      Math.hypot(x + 24, z + 24) > 4.5 &&
      !(x < 1 && x > -40 && Math.abs(x - z) < 3) &&
      !pileLocations.some(([px, pz]) => Math.hypot(x - px, z - pz) < 2.7) &&
      Math.abs(x - 18 - Math.sin(z * 0.075) * 4) > 3.5
    );
  }
  function tree(x, z, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, hAt(x, z) - 0.08, z);
    g.rotation.y = random() * 6.28;
    g.rotation.z = (random() - 0.5) * 0.06;
    g.scale.setScalar(scale);
    staticArt.add(g);
    part(g, G.cylinder, M.bark, 0, 1.8, 0, 0.14, 3.6, 0.14);
    const tiers = 3 + Math.floor(random() * 2);
    for (let i = 0; i < tiers; i++) {
      const radius = 1.25 * (1 - i / (tiers + 1));
      const height = 1.8 - i * 0.16;
      const y = 1.1 + i * 0.92;
      const dx = (random() - 0.5) * 0.19,
        dz = (random() - 0.5) * 0.19,
        rotation = random() * 2;
      part(
        g,
        G.cone,
        i % 2 ? M.pine : M.pineDark,
        dx,
        y,
        dz,
        radius,
        height,
        radius,
        0,
        rotation,
        0,
      );
      // Offset snowy skirts reveal a dark irregular fringe under every tier.
      part(
        g,
        G.cone,
        i % 2 ? M.snow : M.snowLight,
        dx - 0.045,
        y + 0.19,
        dz,
        radius * 0.87,
        height * 0.78,
        radius * 0.87,
        0,
        rotation,
        0,
      );
    }
    colliders.push({ x, z, r: 0.48 * scale });
  }
  for (let i = 0; i < 95; i++) {
    const a = random() * Math.PI * 2,
      r = 8 + random() * 28;
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    if (clear(x, z)) tree(x, z, 0.85 + random() * 0.8);
  }
  for (let i = 0; i < 260; i++) {
    const x = (random() - 0.5) * 192,
      z = (random() - 0.5) * 192;
    if (clear(x, z)) tree(x, z, 0.7 + random() * 1.4);
  }
  [
    [-8, 2],
    [-10, -5],
    [10, 10],
    [1, 12],
    [13, 0],
    [6, -12],
    [-5, -12],
  ].forEach(([x, z]) => {
    if (clear(x, z)) tree(x, z, 1.25);
  });
  function rock(x, z, s = 1) {
    const g = new THREE.Group();
    g.position.set(x, hAt(x, z), z);
    g.rotation.y = random() * 6.28;
    staticArt.add(g);
    part(g, G.ico, M.rock, 0, 0.28 * s, 0, s, 0.65 * s, s * 0.8, 0, 0, 0.13);
    part(
      g,
      G.ico,
      M.snow,
      0,
      0.58 * s,
      -0.02 * s,
      s * 0.91,
      0.28 * s,
      s * 0.74,
      0,
      0,
      0.07,
    );
    if (s > 0.8) colliders.push({ x, z, r: 0.65 * s });
  }
  for (let i = 0; i < 75; i++) {
    const x = (random() - 0.5) * 150,
      z = (random() - 0.5) * 150;
    if (clear(x, z)) rock(x, z, 0.5 + random() * 1.7);
  }
  // A ribbon of frozen water gives the clearing a geographical identity.
  const riverVertices = [],
    riverColors = [];
  for (let z = -100; z < 100; z += 2.5) {
    const cx = (t) => 18 + Math.sin(t * 0.075) * 4;
    const w = (t) => 1.8 + Math.sin(t * 0.2) * 0.3;
    const coords = [
      [cx(z) - w(z), z],
      [cx(z) + w(z), z],
      [cx(z + 2.5) - w(z + 2.5), z + 2.5],
      [cx(z) + w(z), z],
      [cx(z + 2.5) + w(z + 2.5), z + 2.5],
      [cx(z + 2.5) - w(z + 2.5), z + 2.5],
    ];
    color.set(random() > 0.5 ? "#729dab" : "#89aeba");
    coords.forEach(([x, zz]) => {
      riverVertices.push(x, hAt(x, zz) + 0.055, zz);
      riverColors.push(color.r, color.g, color.b);
    });
    if (z % 5 === 0) {
      rock(cx(z) + w(z) + 0.8, z, 0.45 + random() * 0.5);
    }
  }
  const riverGeo = new THREE.BufferGeometry();
  riverGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(riverVertices, 3),
  );
  riverGeo.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(riverColors, 3),
  );
  riverGeo.computeVertexNormals();
  const river = new THREE.Mesh(
    riverGeo,
    mat("#ffffff", {
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.65,
    }),
  );
  river.receiveShadow = true;
  scene.add(river);
  const crackPoints = [];
  for (let i = 0; i < 75; i++) {
    const z = (random() - 0.5) * 150,
      x = 18 + Math.sin(z * 0.075) * 4 + (random() - 0.5) * 2.4;
    crackPoints.push(
      x,
      hAt(x, z) + 0.075,
      z,
      x + 0.3,
      hAt(x + 0.3, z + 0.8) + 0.075,
      z + 0.8,
      x + 0.3,
      hAt(x + 0.3, z + 0.8) + 0.075,
      z + 0.8,
      x - 0.25,
      hAt(x - 0.25, z + 1.5) + 0.075,
      z + 1.5,
    );
  }
  const cracks = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(crackPoints, 3),
    ),
    new THREE.LineBasicMaterial({
      color: "#c2d9dc",
      transparent: true,
      opacity: 0.4,
    }),
  );
  scene.add(cracks);
  // Sparse twigs and grass break up the snow without adding visual noise.
  for (let i = 0; i < 110; i++) {
    const x = (random() - 0.5) * 70,
      z = (random() - 0.5) * 70;
    if (Math.hypot(x, z) < 5 || random() > 0.7) continue;
    for (let j = 0; j < 3; j++)
      part(
        staticArt,
        G.cylinder,
        M.bark,
        x + j * 0.13,
        hAt(x, z) + 0.2,
        z,
        0.018,
        0.45 + random() * 0.3,
        0.018,
        0,
        0,
        (random() - 0.5) * 0.7,
      );
  }
  // A few weathered trail stakes are a quiet invitation toward the ridge.
  for (let d = 9; d < 32; d += 7) {
    const x = -d + 2.5,
      z = -d;
    part(
      staticArt,
      G.box,
      M.bark,
      x,
      hAt(x, z) + 0.65,
      z,
      0.12,
      1.3,
      0.12,
      0,
      0,
      -0.1,
    );
    part(
      staticArt,
      G.box,
      M.red,
      x - 0.04,
      hAt(x, z) + 1.1,
      z,
      0.14,
      0.24,
      0.14,
      0,
      0,
      -0.1,
    );
    part(staticArt, G.ico, M.snow, x, hAt(x, z) + 1.34, z, 0.17, 0.08, 0.14);
  }
  // Distant faceted ridgelines, visible as the player explores the valley.
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2,
      r = 105;
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r,
      h = 9 + random() * 13;
    part(
      staticArt,
      G.cone,
      M.rockDark,
      x,
      h * 0.35,
      z,
      15,
      h,
      12,
      0,
      random() * 3,
      0,
    );
    part(
      staticArt,
      G.cone,
      M.snow,
      x,
      h * 0.72,
      z,
      7,
      h * 0.4,
      6,
      0,
      random() * 3,
      0,
    );
  }

  /* The aircraft: a recognisable, weather-beaten red-and-cream bush plane. */
  const crash = new THREE.Group();
  crash.position.set(4, hAt(4, -3), -3);
  crash.rotation.set(0.04, -0.18, -0.11);
  staticArt.add(crash);
  const fus = part(
    crash,
    G.taper,
    M.ivory,
    0,
    0.96,
    0,
    0.75,
    5.3,
    0.82,
    0,
    0,
    Math.PI / 2,
  );
  part(crash, G.box, M.red, 0, 0.9, 0.73, 4.8, 0.22, 0.075);
  part(crash, G.box, M.red, 0, 0.9, -0.73, 4.8, 0.22, 0.075);
  part(crash, G.taper, M.red, 2.9, 0.85, 0, 0.67, 1.1, 0.7, 0, 0, Math.PI / 2);
  part(crash, G.ico, M.dark, 3.48, 0.87, 0, 0.22, 0.3, 0.3);
  part(crash, G.box, M.dark, 3.65, 0.88, 0, 0.1, 2.0, 0.15, 0.55, 0, 0.15);
  const cabin = part(
    crash,
    G.box,
    M.ivory,
    1.2,
    1.65,
    0,
    1.6,
    1.1,
    1.25,
    0,
    0,
    -0.12,
  );
  part(crash, G.box, M.glass, 1.29, 1.8, 0.641, 1.1, 0.55, 0.025, 0, 0, -0.12);
  part(crash, G.box, M.glass, 1.29, 1.8, -0.641, 1.1, 0.55, 0.025, 0, 0, -0.12);
  part(crash, G.box, M.glass, 2.03, 1.85, 0, 0.06, 0.58, 1.12, 0, 0, -0.23);
  part(crash, G.box, M.red, -2.65, 1.75, 0, 0.9, 1.8, 0.16, 0, 0, -0.25);
  part(crash, G.box, M.ivory, -2.7, 1.5, 0, 1.2, 0.13, 3.2, 0, 0, -0.08);
  part(crash, G.box, M.red, -2.7, 1.52, 1.32, 1.1, 0.15, 0.5);
  part(crash, G.box, M.red, -2.7, 1.52, -1.32, 1.1, 0.15, 0.5);
  // One intact wing; its torn counterpart lies in the snow beside the fuselage.
  part(crash, G.box, M.ivory, 0.7, 2.22, -2.0, 1.6, 0.15, 5.5, 0, 0.06, -0.12);
  part(crash, G.box, M.red, 0.7, 2.23, -4.35, 1.6, 0.16, 0.8, 0, 0.06, -0.12);
  part(crash, G.box, M.red, 0.7, 2.23, -0.2, 1.6, 0.16, 1, 0, 0.06, -0.12);
  part(crash, G.box, M.ivory, 1.2, 0.16, 3.0, 1.5, 0.13, 4.6, 0.06, -0.38, 0.1);
  part(crash, G.box, M.red, 2, 0.32, 4.8, 1.6, 0.15, 0.8, 0.06, -0.38, 0.1);
  // Wing strut and a sunken landing wheel.
  part(
    crash,
    G.cylinder,
    M.steel,
    0.8,
    1.33,
    -1.7,
    0.045,
    2.8,
    0.045,
    -0.7,
    0,
    0,
  );
  part(crash, G.cylinder, M.black, 1, 0.2, 0.85, 0.36, 0.18, 0.36, Math.PI / 2);
  const wreckColliders = [
    { x: 4, z: -3, r: 2.5 },
    { x: 6.8, z: -3, r: 1.1 },
  ];
  colliders.push(...wreckColliders);
  for (let i = 0; i < 11; i++) {
    const a = random() * 6.28,
      r = 2.5 + random() * 3.8,
      x = 4 + Math.cos(a) * r,
      z = -3 + Math.sin(a) * r;
    part(
      staticArt,
      G.box,
      i % 3 ? M.steel : M.red,
      x,
      hAt(x, z) + 0.08,
      z,
      0.2 + random() * 0.4,
      0.12,
      0.2 + random() * 0.4,
      0,
      random() * 6.28,
      0.15,
    );
  }
  // A battered suitcase and a little red thermos: someone was travelling here.
  part(
    staticArt,
    G.box,
    M.pack,
    1.1,
    hAt(1.1, 1.6) + 0.22,
    1.6,
    0.85,
    0.4,
    0.55,
    0,
    -0.35,
    0.1,
  );
  part(
    staticArt,
    G.box,
    M.leather,
    1.1,
    hAt(1.1, 1.6) + 0.45,
    1.6,
    0.24,
    0.09,
    0.09,
    0,
    -0.35,
    0,
  );
  part(
    staticArt,
    G.cylinder,
    M.red,
    -0.2,
    hAt(-0.2, 1.3) + 0.22,
    1.3,
    0.1,
    0.42,
    0.1,
    0,
    0,
    0.4,
  );
  part(
    staticArt,
    G.cylinder,
    M.steel,
    -0.12,
    hAt(-0.2, 1.3) + 0.44,
    1.3,
    0.1,
    0.08,
    0.1,
    0,
    0,
    0.4,
  );

  const piles = [];
  for (const [x, z] of pileLocations) {
    const g = new THREE.Group();
    g.position.set(x, hAt(x, z), z);
    scene.add(g);
    for (let i = 0; i < 3; i++) {
      const rotation = (i - 1) * 0.2;
      part(
        g,
        G.cylinder,
        M.wood,
        (i - 1) * 0.17,
        0.14 + i * 0.12,
        (i - 1) * 0.16,
        0.14,
        1.35,
        0.14,
        0,
        rotation,
        Math.PI / 2,
      );
      part(
        g,
        G.cylinder,
        M.woodEnd,
        0.67,
        0.14 + i * 0.12,
        (i - 1) * 0.16,
        0.135,
        0.015,
        0.135,
        0,
        rotation,
        Math.PI / 2,
      );
    }
    part(g, G.ico, M.snow, 0, 0.45, 0, 0.5, 0.09, 0.35);
    batchChildren(g);
    piles.push({ x, z, mesh: g, taken: false });
  }
  // The beacon is a repaired-by-hand landmark: tripod, guy ropes, red pennant.
  const beacon = new THREE.Group();
  beacon.position.set(-24, hAt(-24, -24), -24);
  staticArt.add(beacon);
  for (const angle of [0, 2.1, 4.2])
    part(
      beacon,
      G.cylinder,
      M.steel,
      Math.cos(angle) * 0.6,
      2.6,
      Math.sin(angle) * 0.6,
      0.06,
      5.3,
      0.06,
      Math.sin(angle) * 0.2,
      0,
      -Math.cos(angle) * 0.2,
    );
  part(beacon, G.cylinder, M.steel, 0, 5.9, 0, 0.07, 3, 0.07);
  for (const y of [6.6, 7.3])
    part(beacon, G.box, M.ivory, 0, y, 0, 2.7, 0.065, 0.065);
  part(beacon, G.box, M.pack, 0, 0.65, 0, 1.2, 1.3, 0.8);
  part(beacon, G.box, M.dark, 0, 0.76, 0.415, 0.7, 0.4, 0.03);
  const beaconGlow = part(
    beacon,
    G.round,
    new THREE.MeshBasicMaterial({ color: "#efb477" }),
    0,
    7.7,
    0,
    0.13,
  );
  const guyPoints = [];
  for (const [x, z] of [
    [2.5, 1.8],
    [-2, 2],
    [0, -3],
  ]) {
    guyPoints.push(
      -24,
      hAt(-24, -24) + 5,
      -24,
      -24 + x,
      hAt(-24 + x, -24 + z),
      -24 + z,
    );
    part(
      staticArt,
      G.box,
      M.bark,
      -24 + x,
      hAt(-24 + x, -24 + z) + 0.2,
      -24 + z,
      0.1,
      0.4,
      0.1,
    );
  }
  const guyLines = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(guyPoints, 3),
    ),
    new THREE.LineBasicMaterial({ color: "#6f8586" }),
  );
  scene.add(guyLines);
  colliders.push({ x: -24, z: -24, r: 0.65 });
  const pennant = new THREE.Mesh(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [0, 0, 0, 1.3, -0.12, 0, 0, -0.65, 0],
        3,
      ),
    ),
    new THREE.MeshStandardMaterial({
      color: "#b9553c",
      side: THREE.DoubleSide,
      roughness: 1,
      flatShading: true,
    }),
  );
  pennant.position.set(-24, hAt(-24, -24) + 6, -24);
  scene.add(pennant);
  // Batch the entire static world. Shared primitives keep geometry memory small.
  staticArt.updateMatrixWorld(true);
  const batches = new Map();
  staticArt.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const key = mesh.geometry.uuid + mesh.material.uuid;
    if (!batches.has(key))
      batches.set(key, {
        geometry: mesh.geometry,
        material: mesh.material,
        matrices: [],
      });
    batches.get(key).matrices.push(mesh.matrixWorld.clone());
  });
  for (const batch of batches.values()) {
    const instanced = new THREE.InstancedMesh(
      batch.geometry,
      batch.material,
      batch.matrices.length,
    );
    batch.matrices.forEach((matrix, i) => instanced.setMatrixAt(i, matrix));
    instanced.castShadow = true;
    instanced.receiveShadow = true;
    instanced.computeBoundingSphere();
    scene.add(instanced);
  }

  staticArt.clear();
  batches.clear();

  /* Rowan: tapered parka, fur-lined hood, mittens, boots and a hand-knit scarf. */
  const rowan = new THREE.Group();
  scene.add(rowan);
  rowan.position.set(0, hAt(0, 0), 0);
  rowan.rotation.y = -0.6;
  const legL = new THREE.Group(),
    legR = new THREE.Group();
  legL.position.set(-0.19, 0.64, 0);
  legR.position.set(0.19, 0.64, 0);
  rowan.add(legL, legR);
  [legL, legR].forEach((leg) => {
    part(leg, G.taper, M.dark, 0, -0.18, 0, 0.15, 0.6, 0.17);
    part(leg, G.box, M.leather, 0, -0.48, 0.08, 0.32, 0.23, 0.5);
    part(leg, G.box, M.fur, 0, -0.35, 0, 0.28, 0.08, 0.3);
  });
  const torso = part(rowan, G.taper, M.coat, 0, 1.07, 0, 0.47, 0.94, 0.34);
  part(rowan, G.taper, M.coatLight, 0, 0.69, 0, 0.45, 0.16, 0.35);
  part(rowan, G.box, M.leather, 0, 0.91, 0.285, 0.035, 0.64, 0.025);
  for (const x of [-0.27, 0.27])
    part(
      rowan,
      G.box,
      M.coatLight,
      x,
      0.9,
      0.29,
      0.18,
      0.24,
      0.055,
      0,
      0,
      x > 0.0 ? -0.08 : 0.08,
    );
  const armL = new THREE.Group(),
    armR = new THREE.Group();
  armL.position.set(-0.5, 1.38, 0);
  armR.position.set(0.5, 1.38, 0);
  rowan.add(armL, armR);
  [armL, armR].forEach((arm, i) => {
    part(
      arm,
      G.taper,
      M.coat,
      0,
      -0.22,
      0,
      0.15,
      0.67,
      0.17,
      0,
      0,
      i ? 0.12 : -0.12,
    );
    part(
      arm,
      G.round,
      M.leather,
      i ? 0.04 : -0.04,
      -0.58,
      0.025,
      0.15,
      0.18,
      0.15,
    );
    part(arm, G.cylinder, M.fur, 0, -0.44, 0, 0.155, 0.1, 0.17);
  });
  part(rowan, G.round, M.fur, 0, 1.78, 0, 0.48, 0.48, 0.42);
  part(rowan, G.round, M.coat, 0, 1.83, -0.075, 0.43, 0.42, 0.38);
  part(rowan, G.round, M.skin, 0, 1.82, 0.285, 0.275, 0.28, 0.16);
  part(rowan, G.round, M.black, 0, 1.97, 0.27, 0.29, 0.13, 0.17);
  part(rowan, G.ico, M.skin, 0, 1.81, 0.45, 0.07, 0.075, 0.07);
  for (const x of [-0.11, 0.11])
    part(rowan, G.box, M.dark, x, 1.87, 0.426, 0.025, 0.028, 0.02);
  part(rowan, G.cylinder, M.scarf, 0, 1.52, 0, 0.34, 0.18, 0.31);
  const scarf = part(
    rowan,
    G.box,
    M.scarf,
    -0.32,
    1.3,
    -0.32,
    0.17,
    0.67,
    0.045,
    -0.18,
    0,
    -0.24,
  );
  part(rowan, G.box, M.pack, 0, 1.14, -0.4, 0.65, 0.76, 0.3);
  part(rowan, G.box, M.leather, 0, 1.17, -0.56, 0.05, 0.8, 0.03);
  for (const x of [-0.3, 0.3])
    part(rowan, G.box, M.leather, x, 1.2, 0.12, 0.055, 0.65, 0.4);
  part(rowan, G.cylinder, M.ivory, 0.38, 1.05, -0.42, 0.1, 0.45, 0.1);
  part(rowan, G.box, M.fur, 0, 1.57, -0.4, 0.66, 0.12, 0.31);

  batchChildren(rowan, [torso, scarf]);

  function radialTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const c = canvas.getContext("2d"),
      gradient = c.createRadialGradient(32, 32, 1, 32, 32, 31);
    gradient.addColorStop(0, "rgba(255,255,255,.8)");
    gradient.addColorStop(0.4, "rgba(255,255,255,.3)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = gradient;
    c.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }
  const softTexture = radialTexture();
  const shadow = part(
    scene,
    G.plane,
    new THREE.MeshBasicMaterial({
      map: softTexture,
      color: "#1c414c",
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
    0,
    0,
    0,
    1.5,
    1.1,
    1,
    -Math.PI / 2,
  );
  shadow.castShadow = false;
  const fire = new THREE.Group();
  fire.position.set(1.2, hAt(1.2, -1), -1);
  scene.add(fire);
  part(fire, G.cylinder, M.rockDark, 0, 0.025, 0, 0.8, 0.04, 0.8);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 6.28;
    part(
      fire,
      G.ico,
      M.rock,
      Math.cos(a) * 0.69,
      0.12,
      Math.sin(a) * 0.69,
      0.22,
      0.17,
      0.2,
    );
  }
  for (const angle of [0.4, 2.2])
    part(
      fire,
      G.cylinder,
      M.wood,
      0,
      0.17,
      0,
      0.12,
      1.15,
      0.12,
      Math.PI / 2,
      0,
      angle,
    );
  const flames = new THREE.Group();
  fire.add(flames);
  const flameMaterial = new THREE.MeshBasicMaterial({ color: "#ef9a43" }),
    heartMaterial = new THREE.MeshBasicMaterial({ color: "#ffe0a0" });
  const flame1 = part(
    flames,
    G.ico,
    flameMaterial,
    0,
    0.65,
    0,
    0.3,
    0.66,
    0.3,
    0,
    0.4,
    0.1,
  );
  const flame2 = part(
    flames,
    G.ico,
    heartMaterial,
    0.05,
    0.5,
    0.1,
    0.18,
    0.42,
    0.18,
    0,
    0.5,
    -0.1,
  );
  const flame3 = part(
    flames,
    G.ico,
    flameMaterial,
    -0.22,
    0.46,
    0,
    0.15,
    0.4,
    0.17,
    0,
    0,
    -0.25,
  );
  const fireLight = new THREE.PointLight("#ffac62", 12, 10, 2);
  fireLight.position.y = 1.5;
  flames.add(fireLight);
  const glow = part(
    fire,
    G.plane,
    new THREE.MeshBasicMaterial({
      map: softTexture,
      color: "#f8af63",
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    0,
    0.045,
    0,
    4.8,
    4.8,
    1,
    -Math.PI / 2,
  );
  glow.castShadow = false;
  const emberPositions = new Float32Array(24 * 3),
    smokePositions = new Float32Array(12 * 3),
    breathPositions = new Float32Array(6 * 3);
  for (let i = 0; i < 24; i++) {
    emberPositions[i * 3] = (random() - 0.5) * 0.7;
    emberPositions[i * 3 + 1] = random() * 3;
    emberPositions[i * 3 + 2] = (random() - 0.5) * 0.7;
  }
  const points = (positions, material) =>
    new THREE.Points(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      ),
      material,
    );
  const embers = points(
    emberPositions,
    new THREE.PointsMaterial({
      color: "#ffc77c",
      size: 0.065,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    }),
  );
  fire.add(embers);
  const smoke = points(
    smokePositions,
    new THREE.PointsMaterial({
      map: softTexture,
      color: "#506a77",
      size: 1.3,
      transparent: true,
      opacity: 0.19,
      depthWrite: false,
    }),
  );
  fire.add(smoke);
  const breath = points(
    breathPositions,
    new THREE.PointsMaterial({
      map: softTexture,
      color: "#dbe9e4",
      size: 0.35,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
  scene.add(breath);
  const ring = part(
    scene,
    new THREE.RingGeometry(0.4, 0.43, 32),
    new THREE.MeshBasicMaterial({
      color: "#efc992",
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    0,
    0,
    0,
    1,
    1,
    1,
    -Math.PI / 2,
  );
  ring.castShadow = false;
  const footprints = [],
    fpGeometry = new THREE.CircleGeometry(0.12, 5),
    fpMaterial = new THREE.MeshBasicMaterial({
      color: "#718f9b",
      transparent: true,
      opacity: 0.23,
      depthWrite: false,
    });
  const footprintBatch = new THREE.InstancedMesh(fpGeometry, fpMaterial, 90),
    footprintDummy = new THREE.Object3D();
  footprintDummy.scale.setScalar(0);
  footprintDummy.updateMatrix();
  for (let i = 0; i < 90; i++) {
    footprintBatch.setMatrixAt(i, footprintDummy.matrix);
    footprints.push({ x: 0, y: 0, z: 0, angle: 0, life: 0 });
  }
  footprintBatch.frustumCulled = false;
  scene.add(footprintBatch);
  let fpIndex = 0,
    fpSide = 1;
  function footprint() {
    const f = footprints[fpIndex];
    fpIndex = (fpIndex + 1) % footprints.length;
    f.x = rowan.position.x + Math.cos(rowan.rotation.y) * 0.16 * fpSide;
    f.z = rowan.position.z - Math.sin(rowan.rotation.y) * 0.16 * fpSide;
    f.y = hAt(f.x, f.z) + 0.035;
    f.angle = rowan.rotation.y;
    f.life = 28;
    fpSide *= -1;
  }
  const snowCount = 340,
    snowPositions = new Float32Array(snowCount * 3);
  for (let i = 0; i < snowCount; i++) {
    snowPositions[i * 3] = (random() - 0.5) * 48;
    snowPositions[i * 3 + 1] = random() * 25;
    snowPositions[i * 3 + 2] = (random() - 0.5) * 48;
  }
  const snow = points(
    snowPositions,
    new THREE.PointsMaterial({
      color: "#e2eee9",
      map: softTexture,
      size: 0.12,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    }),
  );
  scene.add(snow);
  const raycaster = new THREE.Raycaster(),
    ndc = new THREE.Vector2(),
    plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    hit = new THREE.Vector3();
  function pointerTarget(x, y) {
    ndc.set(
      (x / container.clientWidth) * 2 - 1,
      (-y / container.clientHeight) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    plane.constant = -hAt(rowan.position.x, rowan.position.z);
    return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
  }
  let walkPhase = 0,
    lastDusk = -1;
  function render({ dt, time, state, moving, target, holding }) {
    const t = reducedMotion ? 0 : time;
    if (moving) {
      walkPhase += dt * (state.running ? 11 : 8);
      const s = Math.sin(walkPhase);
      legL.rotation.x = s * 0.6;
      legR.rotation.x = -s * 0.6;
      armL.rotation.x = -s * 0.4;
      armR.rotation.x = s * 0.4;
      rowan.position.y += Math.abs(s) * 0.045;
      rowan.rotation.z = Math.sin(walkPhase * 0.5) * 0.025;
    } else {
      for (const limb of [legL, legR, armL, armR])
        limb.rotation.x *= Math.exp(-dt * 12);
      rowan.rotation.z *= Math.exp(-dt * 8);
      torso.scale.y = 0.94 + Math.sin(t * 1.8) * 0.008;
    }
    scarf.rotation.x = -0.18 + Math.sin(t * 3) * 0.1;
    scarf.rotation.z = -0.24 + Math.sin(t * 2) * 0.08;
    shadow.position.set(
      rowan.position.x,
      hAt(rowan.position.x, rowan.position.z) + 0.025,
      rowan.position.z,
    );
    const burning = state.fuel > 0;
    flames.visible = burning;
    embers.visible = burning;
    smoke.visible = burning;
    glow.visible = burning;
    flame1.scale.y = 0.66 * (1 + Math.sin(t * 9) * 0.15);
    flame2.scale.y = 0.42 * (1 + Math.sin(t * 11) * 0.2);
    flame3.scale.y = 0.4 * (1 + Math.sin(t * 13) * 0.15);
    fireLight.intensity = 11 + Math.sin(t * 7) * 2;
    glow.material.opacity = 0.3 + Math.sin(t * 5) * 0.03;
    for (let i = 0; i < 24; i++) {
      const life = (t * 0.38 + i * 0.29) % 1;
      emberPositions[i * 3] = Math.sin(i * 2.4 + t) * 0.3 + life * 0.6;
      emberPositions[i * 3 + 1] = 0.5 + life * 2.7;
      emberPositions[i * 3 + 2] = Math.cos(i + t) * 0.25;
    }
    embers.geometry.attributes.position.needsUpdate = true;
    for (let i = 0; i < 12; i++) {
      const life = (t * 0.13 + i / 12) % 1;
      smokePositions[i * 3] = life * 1.7 + Math.sin(t + i) * 0.15;
      smokePositions[i * 3 + 1] = 0.5 + life * 5;
      smokePositions[i * 3 + 2] = Math.sin(i) * life * 0.4;
    }
    smoke.geometry.attributes.position.needsUpdate = true;
    const breathing = Math.max(0, Math.sin(t * 1.3));
    breath.material.opacity = breathing * 0.23;
    for (let i = 0; i < 6; i++) {
      const d = i / 6;
      breathPositions[i * 3] =
        rowan.position.x + Math.sin(rowan.rotation.y) * (0.4 + d * 0.5);
      breathPositions[i * 3 + 1] = rowan.position.y + 1.8 + d * 0.3;
      breathPositions[i * 3 + 2] =
        rowan.position.z + Math.cos(rowan.rotation.y) * (0.4 + d * 0.5);
    }
    breath.geometry.attributes.position.needsUpdate = true;
    pennant.rotation.y = Math.sin(t * 2) * 0.16;
    pennant.rotation.x = Math.sin(t * 3) * 0.1;
    let footprintsChanged = false;
    for (let i = 0; i < footprints.length; i++) {
      const f = footprints[i];
      if (f.life <= 0) continue;
      f.life = Math.max(0, f.life - dt);
      footprintsChanged = true;
      const fade = Math.min(1, f.life / 5);
      footprintDummy.position.set(f.x, f.y, f.z);
      footprintDummy.rotation.set(-Math.PI / 2, 0, -f.angle);
      footprintDummy.scale.set(0.7 * fade, 1.5 * fade, 1);
      footprintDummy.updateMatrix();
      footprintBatch.setMatrixAt(i, footprintDummy.matrix);
    }
    if (footprintsChanged) footprintBatch.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < snowCount; i++) {
      snowPositions[i * 3] += (0.24 + Math.sin(t * 0.5 + i) * 0.2) * dt;
      snowPositions[i * 3 + 1] -= dt * (0.8 + (i % 4) * 0.18);
      if (snowPositions[i * 3 + 1] < -1) {
        snowPositions[i * 3 + 1] = 24;
        snowPositions[i * 3] = (random() - 0.5) * 48;
      }
    }
    snow.geometry.attributes.position.needsUpdate = true;
    snow.position.set(camTarget.x, 0, camTarget.z);
    if (holding && target) {
      ring.position.set(target.x, hAt(target.x, target.z) + 0.05, target.z);
      ring.material.opacity = 0.4;
      ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
    } else ring.material.opacity *= Math.exp(-dt * 9);
    const hr = state.clock / 3600;
    const daylight = Math.max(0, Math.sin(((hr - 6) / 12) * Math.PI));
    const dusk = 1 - daylight;
    if (Math.abs(dusk - lastDusk) > 0.004) {
      scene.background.copy(daySky).lerp(nightSky, dusk * 0.8);
      scene.fog.color.copy(scene.background);
      hemi.intensity = 1.3 + daylight * 0.9;
      sun.intensity = 0.35 + daylight * 2.8;
      fillLight.intensity = 0.6 + dusk * 0.4;
      lastDusk = dusk;
    }
    if (!state.started) {
      camTarget.set(-1, 1, -1);
    } else
      camTarget.lerp(
        followTarget.set(
          rowan.position.x,
          rowan.position.y + 0.7,
          rowan.position.z,
        ),
        1 - Math.exp(-dt * 3),
      );
    camera.position.copy(camTarget).add(camOffset);
    camera.lookAt(camTarget);
    camera.updateMatrixWorld();
    sun.position.set(camTarget.x - 25, camTarget.y + 32, camTarget.z + 12);
    sun.target.position.copy(camTarget);
    renderer.render(scene, camera);
    // Lower the buffer once on sustained slow devices; keep the UI at native resolution.
    frameAverage = frameAverage * 0.98 + dt * 0.02;
    qualityFrames++;
    if (qualityFrames === 300 && frameAverage > 1 / 33 && quality === 1) {
      quality = 0.8;
      resize();
    }
  }
  function project(x, y, z) {
    const vector = new THREE.Vector3(x, y, z).project(camera);
    return {
      x: (vector.x + 1) * 0.5 * container.clientWidth,
      y: (1 - vector.y) * 0.5 * container.clientHeight,
      visible: vector.z > -1 && vector.z < 1,
    };
  }
  function metrics() {
    return {
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      bufferWidth: renderer.domElement.width,
      bufferHeight: renderer.domElement.height,
      threeRevision: THREE.REVISION,
    };
  }
  return {
    renderer,
    scene,
    camera,
    rowan,
    piles,
    colliders,
    hAt,
    resize,
    render,
    pointerTarget,
    footprint,
    project,
    metrics,
  };
}
