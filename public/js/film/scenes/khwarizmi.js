// Al-Khwarizmi solves «a square and ten roots equal thirty-nine» at his desk
// in the House of Wisdom, the way his book does it: with pictures.
// The square x² and the ten roots are glazed tiles; the ten roots are cut in
// two halves of 5x and laid along two sides of the square; the reed pen
// draws the missing corner 5 × 5; a gilded tile fills it — «al-jabr», the
// restoration; the whole square is 64 = 8 × 8, its side is 8, so x = 3.
// Every step is timed to the words of the narration.
import {
  THREE, createStage, label, fade, dust, rod, tube, revealTube, stage, smooth, lerp, clamp, glow, fitDistance, SERIF,
} from '../kit.js';
import {
  wood, parchment, parchmentMaps, glaze, gilded, brass, oilLamp, qalam, inkwell, bokeh, book, tileMaps,
} from '../materials.js';

// The book and its famous problem, in Arabic.
const TITLE = 'الكتاب المختصر في حساب الجبر والمقابلة';
const PAGE_LEFT = [
  'بسم الله الرحمن الرحيم',
  'هذا كتاب الجبر والمقابلة',
  'مال وعشرة أجذار يعدل تسعة وثلاثين درهما',
  'فبابه أن تنصف الأجذار',
  'وهي في هذه المسألة خمسة',
  'فتضربها في مثلها فتكون خمسة وعشرين',
];
const PAGE_RIGHT = [
  'فتزيدها على التسعة والثلاثين',
  'فتكون أربعة وستين',
  'فتأخذ جذرها وهو ثمانية',
  'فتنقص منه نصف الأجذار وهو خمسة',
  'فيبقى ثلاثة وهو جذر المال',
  'والمال تسعة',
];
const PROBLEM = 'مال وعشرة أجذار يعدل تسعة وثلاثين درهما';

// A tile with soft bevelled edges; the picture covers its top face.
export function tileGeometry(w, d, h = 0.22) {
  const r = Math.min(0.08, w * 0.1, d * 0.1);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -d / 2);
  shape.lineTo(w / 2 - r, -d / 2);
  shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  shape.lineTo(w / 2, d / 2 - r);
  shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  shape.lineTo(-w / 2 + r, d / 2);
  shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  shape.lineTo(-w / 2, -d / 2 + r);
  shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h - 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0);
  // Top-face picture: u along x, v away from the viewer.
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (-pos.getZ(i) + d / 2) / d);
  geo.computeVertexNormals();
  return geo;
}

export function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A page of the open book that turns over the spine (z axis) with a curl.
export function turningPage(w, d, material) {
  const seg = 28;
  const geo = new THREE.PlaneGeometry(w, d, seg, 1);
  geo.rotateX(-Math.PI / 2);
  const base = geo.attributes.position.array.slice();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  // u: 0 lying on the right, 1 lying on the left.
  mesh.userData.turn = (u) => {
    const pos = geo.attributes.position;
    const theta = Math.PI * smooth(u);
    const curl = Math.sin(Math.PI * u) * 1.1;
    for (let i = 0; i < pos.count; i++) {
      const s = base[i * 3] + w / 2; // distance from the spine
      // The angle grows along the page: the free edge lags behind (a curl).
      const steps = 12;
      let x = 0;
      let y = 0;
      for (let k = 0; k < steps; k++) {
        const sigma = (s * (k + 0.5)) / steps;
        const a = theta - curl * (sigma / w) * (1 - Math.abs(Math.cos(theta)) * 0.3);
        x += Math.cos(a) * (s / steps);
        y += Math.sin(a) * (s / steps);
      }
      pos.setXYZ(i, x, y + 0.012, base[i * 3 + 2]);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  mesh.userData.turn(0);
  return mesh;
}

// The far wall of the study: plaster, an arched window with moonlight,
// shelves of books in the shadow.
function studyWall() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 768;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 768);
  grad.addColorStop(0, '#2a1c10');
  grad.addColorStop(1, '#3a2716');
  g.fillStyle = grad;
  g.fillRect(0, 0, 2048, 768);
  // Arched windows.
  for (const x of [520, 1530]) {
    g.save();
    g.beginPath();
    g.moveTo(x - 110, 700);
    g.lineTo(x - 110, 330);
    g.quadraticCurveTo(x - 110, 170, x, 120);
    g.quadraticCurveTo(x + 110, 170, x + 110, 330);
    g.lineTo(x + 110, 700);
    g.closePath();
    const sky = g.createLinearGradient(0, 120, 0, 700);
    sky.addColorStop(0, '#22324f');
    sky.addColorStop(1, '#0c1424');
    g.fillStyle = sky;
    g.fill();
    g.clip();
    // Window lattice of stars.
    g.strokeStyle = 'rgba(40,26,14,0.9)';
    g.lineWidth = 7;
    for (let y = 150; y < 700; y += 70) {
      for (let k = -2; k <= 2; k++) {
        g.beginPath();
        g.arc(x + k * 70, y, 30, 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.restore();
  }
  // Shelves with books.
  const rand = (() => { let a = 7; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
  for (const [x0, x1] of [[760, 1290]]) {
    for (let y = 220; y < 720; y += 120) {
      g.fillStyle = '#1c1209';
      g.fillRect(x0, y + 96, x1 - x0, 14);
      let x = x0 + 6;
      while (x < x1 - 20) {
        const w = 14 + rand() * 22;
        const h = 60 + rand() * 34;
        const hue = ['#5a2016', '#1f3550', '#6b4a1a', '#2d4a2a', '#4a1a2a'][Math.floor(rand() * 5)];
        g.fillStyle = hue;
        g.fillRect(x, y + 96 - h, w - 2, h);
        g.fillStyle = 'rgba(226,181,79,0.35)';
        g.fillRect(x, y + 96 - h + 10, w - 2, 3);
        x += w;
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(48, 18), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  wall.position.set(0, 6, -12);
  return wall;
}

// The study of the House of Wisdom at night, shared by al-Khwarizmi's scenes.
export function study(scene) {
  const desk = shadowed(new THREE.Mesh(new THREE.BoxGeometry(22, 0.5, 13), wood(11)));
  desk.position.y = -0.25;
  scene.add(desk);
  scene.add(bokeh(30, { spread: [40, 14], depth: -16, seed: 4 }));
  scene.add(studyWall());
  const motes = dust(320, [14, 6, 10], 0xffd9a0, 13);
  motes.position.set(-1, 3, -1);
  scene.add(motes);
  // Warm key light from the lamp side, a cool rim light from the window.
  const key = new THREE.SpotLight(0xffd2a0, 46, 40, 0.75, 0.6, 1.6);
  key.position.set(-7, 9, 3);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x8fb2ff, 0.55);
  rim.position.set(6, 5, -8);
  scene.add(rim);
  const lamp = oilLamp({ intensity: 30, distance: 26 });
  lamp.group.position.set(-6.4, 0, -3.6);
  lamp.group.scale.setScalar(1.25);
  scene.add(lamp.group);
  return { desk, lamp, motes, key };
}

export function studyStage() {
  const { scene, camera, sun, hemi } = createStage({ background: 0x140c06, ambient: 0.22, sun: 0.0 });
  scene.fog = new THREE.Fog(0x140c06, 24, 60);
  hemi.color.set(0xffe2b8);
  hemi.groundColor.set(0x1a0e06);
  sun.intensity = 0;
  scene.add(camera);
  return { scene, camera };
}

export function algebra({ ctx } = {}) {
  const { scene, camera } = studyStage();

  // ---- The study: desk, wall, lamp, lights.
  const room = study(scene);
  const { lamp, motes } = room;
  const pot = inkwell();
  pot.position.set(4.6, 0, 2.6);
  scene.add(pot);
  const pen = qalam();
  scene.add(pen);
  const penRest = { pos: new THREE.Vector3(4.2, 0.05, 1.8), rot: new THREE.Euler(0, 0.6, -1.32) };
  const stack = new THREE.Group();
  [[0x5a2016, 0], [0x1f3550, 0.32], [0x6b4a1a, 0.62]].forEach(([c, y], i) => {
    const b = book({ w: 2.2, h: 0.3, d: 1.6, cover: c });
    b.position.set(i * 0.12, y + 0.15, i * 0.05);
    b.rotation.y = (i - 1) * 0.12;
    stack.add(b);
  });
  stack.position.set(5.6, 0, -3.4);
  stack.rotation.y = -0.4;
  scene.add(stack);

  // ---- The open book of al-Khwarizmi.
  const opened = new THREE.Group();
  opened.position.set(-5.2, 0, -0.6);
  opened.rotation.y = 0.35;
  scene.add(opened);
  const PW = 1.9;
  const PD = 2.6;
  const leftPage = parchmentMaps({ lines: PAGE_LEFT, title: TITLE, seed: 31, aspect: PW / PD, size: 768 });
  const rightPage = parchmentMaps({ lines: PAGE_RIGHT, seed: 32, aspect: PW / PD, size: 768 });
  const cover = new THREE.Mesh(new THREE.BoxGeometry(PW * 2 + 0.25, 0.06, PD + 0.2), new THREE.MeshStandardMaterial({ color: 0x5a2016, roughness: 0.65 }));
  cover.position.y = 0.03;
  opened.add(shadowed(cover));
  const blockMat = new THREE.MeshStandardMaterial({ color: 0xe8d6ab, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const block = shadowed(new THREE.Mesh(new THREE.BoxGeometry(PW - 0.04, 0.16, PD - 0.06), blockMat));
    block.position.set(side * (PW / 2 + 0.02), 0.14, 0);
    block.rotation.z = side * -0.035;
    opened.add(block);
    const page = new THREE.Mesh(new THREE.PlaneGeometry(PW - 0.06, PD - 0.08), new THREE.MeshStandardMaterial({ map: side < 0 ? leftPage.map : rightPage.map, roughness: 0.9, color: 0xcbb995 }));
    page.rotation.x = -Math.PI / 2;
    page.rotation.y = side * 0.035;
    page.position.set(side * (PW / 2 + 0.02), 0.225, 0);
    page.receiveShadow = true;
    opened.add(page);
  }
  const flipMat = new THREE.MeshStandardMaterial({ map: rightPage.map, roughness: 0.9, side: THREE.DoubleSide, color: 0xcbb995 });
  const flips = [turningPage(PW - 0.06, PD - 0.08, flipMat), turningPage(PW - 0.06, PD - 0.08, flipMat)];
  for (const f of flips) {
    f.position.y = 0.23;
    opened.add(f);
  }
  const bookTitle = label('«Книга о восполнении и противопоставлении» · около 820 г.', { size: 0.3, family: SERIF, color: '#f6e3b4', background: 'rgba(20,12,6,0.62)' });
  bookTitle.visible = false;

  // ---- The working sheet and the construction.
  const U = 0.56; // one unit of the problem in scene units
  const X = 3;
  const K = 5;
  const N = X + K;
  const sheetSize = N * U + 1.5;
  const sheet = new THREE.Mesh(
    new THREE.BoxGeometry(sheetSize, 0.03, sheetSize + 0.6),
    [null, null, Object.assign(parchment({ lines: [PROBLEM], seed: 12, size: 1024, ruled: true }), { color: new THREE.Color(0xb3a281) }), null, null, null].map((m) => m ?? new THREE.MeshStandardMaterial({ color: 0xd9c08c, roughness: 0.9 })),
  );
  const SHEET = new THREE.Vector3(-0.2, 0.015, 0.4);
  sheet.position.copy(SHEET);
  sheet.rotation.y = -0.03;
  sheet.receiveShadow = true;
  scene.add(sheet);
  // Plan coordinates of the problem: a to the right, b away from the viewer.
  const O = new THREE.Vector3(SHEET.x - (N * U) / 2, 0.03, SHEET.z + (N * U) / 2 - 0.2);
  const P = (a, b, y = 0) => new THREE.Vector3(O.x + a * U, O.y + y, O.z - b * U);
  const center = P(N / 2, N / 2);

  const tiles = new THREE.Group();
  scene.add(tiles);
  const T = (w, d, material) => {
    const m = shadowed(new THREE.Mesh(tileGeometry(w * U - 0.06, d * U - 0.06), material));
    tiles.add(m);
    return m;
  };
  const glazeOpts = (text, base, deep, cells, w, h) => ({ text, base, deep, cells, w, h, seed: text.length + w });
  const square = T(X, X, glaze(glazeOpts('x²', '#21a196', '#0a4e4a', [2, 2], 512, 512)));
  const halfMat = (text, angle = 0) => {
    if (!angle) return glaze(glazeOpts(text, '#2f63b8', '#132a5c', [4, 2], 1024, 600));
    // The second half lies across the first: its words are turned on the tile.
    const { map } = tileMaps(glazeOpts('', '#2f63b8', '#132a5c', [4, 2], 1024, 600));
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 600;
    const g = c.getContext('2d');
    g.drawImage(map.image, 0, 0);
    g.translate(512, 300);
    g.rotate(angle);
    g.font = "600 italic 180px 'Cormorant Garamond', Georgia, serif";
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 12;
    g.fillStyle = '#f3d27a';
    g.fillText(text, 0, 8);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.1 });
  };
  const plainHalf = halfMat('');
  const halfA = T(K, X, plainHalf);
  const halfB = T(K, X, plainHalf);
  const labelledA = halfMat('5x');
  const labelledB = halfMat('5x', Math.PI / 2);
  const corner = T(K, K, gilded('25', { w: 512, h: 512 }));
  const tenTag = label('10x — десять корней', { size: 0.34, family: SERIF, color: '#fbe7b5', background: 'rgba(20,12,6,0.7)' });
  scene.add(tenTag);

  // Where the tiles lie, and where the ten roots wait before they are halved.
  const at = (a0, b0, w, d) => P(a0 + w / 2, b0 + d / 2);
  const SQ = at(0, 0, X, X);
  const BAR_A = at(0, X + 1.1, K, X);
  const BAR_B = at(K, X + 1.1, K, X);
  const A_HOME = at(X, 0, K, X);
  const B_HOME = at(0, X, X, K);
  const C_HOME = at(X, X, K, K);
  square.position.copy(SQ);
  const arc = (from, to, u, lift) => from.clone().lerp(to, smooth(u)).add(new THREE.Vector3(0, Math.sin(Math.PI * u) * lift, 0));

  // The cut through the ten roots.
  const cut = rod(P(K, X + 0.95, 0.28), P(K, 2 * X + 1.25, 0.28), 0.035, new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true }));
  scene.add(cut);
  const cutGlow = glow(0xffe0a0, 2.2, 0);
  cutGlow.position.copy(P(K, 1.5 * X + 1.1, 0.35));
  scene.add(cutGlow);

  // The missing corner, drawn by the reed pen.
  const cornerPath = [P(X, X, 0.06), P(N, X, 0.06), P(N, N, 0.06), P(X, N, 0.06), P(X, X, 0.06)];
  const curve = new THREE.CurvePath();
  for (let i = 0; i < 4; i++) curve.add(new THREE.LineCurve3(cornerPath[i], cornerPath[i + 1]));
  const inkLine = tube(curve.getSpacedPoints(160), 0.028, new THREE.MeshStandardMaterial({ color: 0x2a1408, roughness: 0.35 }), 320);
  revealTube(inkLine, 0);
  scene.add(inkLine);
  const missing = label('5 × 5 = 25', { size: 0.5, family: SERIF, color: '#3a1f0a', background: null, weight: 700 });
  missing.position.copy(C_HOME).add(new THREE.Vector3(0, 0.25, 0));
  scene.add(missing);

  // Restoration: flash, and the word al-jabr in Arabic and in Russian.
  const flash = glow(0xffe6a8, 4, 0);
  flash.position.copy(C_HOME).add(new THREE.Vector3(0, 0.4, 0));
  scene.add(flash);
  const jabrArabic = label('الجبر', { size: 0.95, color: '#ffd77a', background: null, glow: 1, family: "'Geeza Pro', 'Noto Naskh Arabic', serif" });
  const jabrRu = label('«аль-джабр» — восполнение', { size: 0.42, family: SERIF, color: '#fff1cf', background: 'rgba(20,12,6,0.62)' });
  scene.add(jabrArabic, jabrRu);
  const puff = dust(36, [1.8, 0.4, 1.8], 0xffd27a, 21);
  puff.position.copy(C_HOME);
  scene.add(puff);

  // The whole square: a gold frame and its 64 cells lighting up one by one.
  const frame = new THREE.Group();
  const fy = 0.3;
  const corners = [P(0, 0, fy), P(N, 0, fy), P(N, N, fy), P(0, N, fy)];
  corners.forEach((c, i) => frame.add(rod(c, corners[(i + 1) % 4], 0.045, new THREE.MeshBasicMaterial({ color: 0xffd27a }))));
  scene.add(frame);
  const grid = new THREE.Group();
  for (let i = 1; i < N; i++) {
    grid.add(rod(P(i, 0, fy - 0.02), P(i, N, fy - 0.02), 0.012, new THREE.MeshBasicMaterial({ color: 0xffe2a0 })));
    grid.add(rod(P(0, i, fy - 0.02), P(N, i, fy - 0.02), 0.012, new THREE.MeshBasicMaterial({ color: 0xffe2a0 })));
  }
  scene.add(grid);
  const cells = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(U * 0.9, U * 0.9).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    N * N,
  );
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < N * N; i++) {
    const a = i % N;
    const b = Math.floor(i / N);
    m4.setPosition(P(a + 0.5, b + 0.5, fy - 0.01));
    cells.setMatrixAt(i, m4);
    cells.setColorAt(i, new THREE.Color(0, 0, 0));
  }
  scene.add(cells);
  const count = label('64', { size: 1.5, family: SERIF, color: '#fff3d0', background: null, glow: 1, weight: 700, template: '64' });
  count.position.copy(center).add(new THREE.Vector3(0, 1.1, 0));
  scene.add(count);

  // A brass ruler along the side: 8; then 8 = 5 + 3.
  const ruler = new THREE.Group();
  const bar = shadowed(new THREE.Mesh(new THREE.BoxGeometry(N * U + 0.3, 0.08, 0.34), brass(0xc9a256, 0.3)));
  bar.position.set((N * U) / 2, 0.04, 0);
  ruler.add(bar);
  const ticks = [];
  for (let i = 0; i <= N; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, i % 4 === 0 ? 0.22 : 0.14), new THREE.MeshBasicMaterial({ color: 0x3a2208 }));
    tick.position.set(i * U, 0.09, -0.06);
    ruler.add(tick);
    if (i > 0) {
      const n = label(String(i), { size: 0.36, family: SERIF, color: '#ffe8b0', background: null, weight: 700 });
      n.position.set(i * U, 0.4, 0.15);
      ruler.add(n);
      ticks.push(n);
    }
  }
  const rulerHome = P(0, -0.75, 0);
  ruler.position.copy(rulerHome);
  scene.add(ruler);
  const brace = (a0, a1, text, color) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color });
    g.add(rod(P(a0, -1.45, 0.06), P(a1, -1.45, 0.06), 0.03, mat));
    g.add(rod(P(a0, -1.3, 0.06), P(a0, -1.6, 0.06), 0.03, mat));
    g.add(rod(P(a1, -1.3, 0.06), P(a1, -1.6, 0.06), 0.03, mat));
    const t = label(text, { size: 0.55, family: SERIF, color: `#${new THREE.Color(color).getHexString()}`, background: 'rgba(20,12,6,0.6)', weight: 700 });
    t.position.copy(P((a0 + a1) / 2, -2.0, 0.3));
    g.add(t);
    scene.add(g);
    return g;
  };
  const braceX = brace(0, X, 'x = 8 − 5 = 3', 0x7ff0e0);
  const brace5 = brace(X, N, '5', 0xffd27a);
  const answerGlow = glow(0x6ff0e0, 2.6, 0);
  answerGlow.position.copy(SQ).add(new THREE.Vector3(0, 0.4, 0));
  scene.add(answerGlow);

  const finale = label('аль-джабр → алгебра', { size: 0.7, family: SERIF, color: '#ffe2a3', background: null, glow: 1, weight: 700 });
  scene.add(finale);

  // ---- Words on the screen (fixed to the camera).
  const steps = [
    [0.0, 'Около 820 года: книга о решении житейских задач', 'аль-джабр и аль-мукабала'],
    [0.14, 'Задача: «квадрат и десять корней равны 39»', 'x² + 10x = 39'],
    [0.27, 'Десять корней — пополам: два прямоугольника по 5x', 'x² + 5x + 5x = 39'],
    [0.4, 'Не хватает угла 5 × 5 = 25', 'x² + 10x + 25 = 39 + 25'],
    [0.51, 'Аль-джабр — восполнение: угол достроен', 'x² + 10x + 25 = 64'],
    [0.64, 'Целый квадрат: 39 + 25 = 64', '(x + 5)² = 64'],
    [0.78, 'Его сторона — 8, ведь 8 × 8 = 64', 'x + 5 = 8'],
    [0.84, 'Значит, корень равен трём', 'x = 3'],
    [0.92, 'Из слова «аль-джабр» родилась алгебра', 'алгебра'],
  ];
  const longest = steps.reduce((a, s) => (s[1].length > a.length ? s[1] : a), '');
  const widest = steps.reduce((a, s) => (s[2].length > a.length ? s[2] : a), '');
  const caption = label(steps[0][1], { size: 0.06, template: longest, background: 'rgba(14,9,5,0.66)' });
  const formula = label(steps[0][2], { size: 0.1, family: SERIF, weight: 700, color: '#ffe2a3', background: 'rgba(14,9,5,0.72)', template: widest });
  camera.add(caption, formula);

  // ---- Camera: from the book to the sheet, close on the corner, back out.
  const onBook = { target: opened.position.clone().add(new THREE.Vector3(0.2, 0.25, 0.1)), az: -0.28, el: 0.78, r: 1.75 };
  const problem = { target: P(5, 4.5), az: -0.06, el: 0.9, r: 3.4 };
  const shots = [
    [0.0, onBook],
    [0.1, onBook],
    [0.14, problem],
    [0.39, problem],
    [0.42, { target: P(4.6, 4.6), az: 0.05, el: 1.02, r: 2.9 }],
    [0.62, { target: center, az: -0.04, el: 1.04, r: 3.0 }],
    [0.76, { target: P(4, 3.2), az: -0.02, el: 0.98, r: 3.2 }],
    [0.92, { target: center.clone().add(new THREE.Vector3(-1.2, 0, -0.8)), az: -0.2, el: 0.78, r: 4.4 }],
  ];
  const view = (p) => {
    let i = 0;
    while (i < shots.length - 1 && p >= shots[i + 1][0]) i += 1;
    const [a, A] = shots[i];
    const [b, B] = shots[Math.min(i + 1, shots.length - 1)];
    const u = b === a ? 0 : smooth(clamp((p - a) / (b - a)));
    return { target: A.target.clone().lerp(B.target, u), az: lerp(A.az, B.az, u), el: lerp(A.el, B.el, u), r: lerp(A.r, B.r, u) };
  };
  const right = new THREE.Vector3();

  return {
    scene,
    camera,
    update({ t, p }) {
      motes.userData.update?.(t);
      lamp.update(t);

      // Pages turn while the book is shown.
      flips[0].userData.turn(stage(p, 0.02, 0.07));
      flips[1].userData.turn(stage(p, 0.065, 0.115));

      // The square and the ten roots appear with the words of the problem.
      const sq = stage(p, 0.175, 0.2);
      square.position.copy(SQ).add(new THREE.Vector3(0, (1 - sq) * 1.6, 0));
      square.visible = sq > 0.001;
      square.scale.setScalar(0.6 + 0.4 * sq);
      const bar = stage(p, 0.19, 0.22);
      // Halving: a bright cut, the halves part and fly to two sides of the square.
      const split = stage(p, 0.3, 0.32);
      const fly = clamp((p - 0.325) / 0.05);
      const apart = split * 0.25;
      halfA.position.copy(arc(BAR_A.clone().add(new THREE.Vector3(-apart, 0, 0)), A_HOME, fly, 1.4)).add(new THREE.Vector3(0, (1 - bar) * 1.6, 0));
      halfB.position.copy(arc(BAR_B.clone().add(new THREE.Vector3(apart, 0, 0)), B_HOME, fly, 1.9)).add(new THREE.Vector3(0, (1 - bar) * 1.6, 0));
      halfB.rotation.y = (Math.PI / 2) * smooth(fly);
      halfA.visible = halfB.visible = bar > 0.001;
      halfA.material = split > 0.5 ? labelledA : plainHalf;
      halfB.material = split > 0.5 ? labelledB : plainHalf;
      tenTag.position.copy(BAR_A.clone().lerp(BAR_B, 0.5)).add(new THREE.Vector3(0, 0.45, (X * U) / 2 + 0.3));
      fade(tenTag, bar * (1 - split));
      cut.material.opacity = stage(p, 0.29, 0.3) * (1 - stage(p, 0.31, 0.325));
      cut.visible = cut.material.opacity > 0.01;
      cutGlow.material.opacity = cut.material.opacity * 0.9;

      // The reed pen draws the missing corner; then it rests by the inkwell.
      const draw = clamp((p - 0.405) / 0.06);
      revealTube(inkLine, draw);
      inkLine.visible = draw > 0 && p < 0.575;
      const writing = stage(p, 0.385, 0.405) * (1 - stage(p, 0.47, 0.495));
      const tip = curve.getPointAt(Math.min(0.999, draw));
      const restPos = penRest.pos;
      pen.position.copy(restPos.clone().lerp(tip, writing));
      pen.rotation.set(lerp(penRest.rot.x, -0.35, writing), lerp(penRest.rot.y, 0.5, writing), lerp(penRest.rot.z, -0.45, writing));
      fade(missing, stage(p, 0.44, 0.47) * (1 - stage(p, 0.51, 0.54)));

      // Restoration: the gilded tile comes down into the corner.
      const fall = clamp((p - 0.505) / 0.05);
      const land = fall >= 1 ? Math.exp(-(p - 0.555) * 60) * Math.sin((p - 0.555) * 220) * 0.06 : 0;
      corner.position.copy(C_HOME).add(new THREE.Vector3(0, (1 - fall * fall) * 5 + Math.abs(land), 0));
      corner.rotation.y = (1 - smooth(fall)) * 1.6;
      corner.visible = fall > 0;
      const burst = stage(p, 0.553, 0.56) * (1 - stage(p, 0.56, 0.6));
      flash.material.opacity = burst * 0.9;
      puff.visible = p > 0.553 && p < 0.62;
      puff.userData.update?.(t);
      puff.position.y = C_HOME.y + (p - 0.553) * 6;
      fade(puff, 1 - stage(p, 0.57, 0.62));
      jabrArabic.position.copy(C_HOME).add(new THREE.Vector3(0, 0.9 + stage(p, 0.56, 0.62) * 0.35, 0));
      const word = stage(p, 0.56, 0.585) * (1 - stage(p, 0.63, 0.66));
      fade(jabrArabic, word);
      fade(jabrRu, 0);

      // The whole square: frame, grid, 64 cells.
      const whole = stage(p, 0.645, 0.67);
      fade(frame, whole * (1 - stage(p, 0.96, 1)));
      fade(grid, stage(p, 0.67, 0.69) * 0.35 * (1 - stage(p, 0.8, 0.84)));
      const lit = clamp((p - 0.68) / 0.065) * N * N;
      const c = new THREE.Color();
      for (let i = 0; i < N * N; i++) {
        const on = clamp(lit - i);
        const fadeOut = 1 - stage(p, 0.78, 0.82);
        // The newest cells flare, then settle to a soft glow.
        const fresh = clamp(1 - (lit - i) / 6);
        const k = on * fadeOut * (0.1 + 0.22 * fresh);
        cells.setColorAt(i, c.setRGB(k, k * 0.72, k * 0.25));
      }
      cells.instanceColor.needsUpdate = true;
      count.userData.set(String(Math.max(1, Math.round(lit))));
      fade(count, stage(p, 0.68, 0.7) * (1 - stage(p, 0.78, 0.8)));

      // The side is 8; 8 = 5 + 3.
      const slide = stage(p, 0.775, 0.8);
      ruler.position.copy(rulerHome).add(new THREE.Vector3((1 - slide) * -6, 0, 0));
      fade(ruler, slide);
      ticks.forEach((n, i) => fade(n, stage(p, 0.79 + i * 0.004, 0.795 + i * 0.004)));
      fade(braceX, stage(p, 0.86, 0.88));
      fade(brace5, stage(p, 0.845, 0.865));
      answerGlow.material.opacity = stage(p, 0.87, 0.89) * (0.3 + 0.15 * Math.sin(t * 4));
      square.material.emissive?.setHex(0x0f6f66);
      square.material.emissiveIntensity = stage(p, 0.87, 0.89) * (0.5 + 0.3 * Math.sin(t * 4));

      fade(finale, stage(p, 0.935, 0.965));
      finale.position.copy(center).add(new THREE.Vector3(0, 2.2, -0.5));

      // Words on the screen.
      const step = steps.filter(([s]) => p >= s).at(-1);
      caption.userData.set(step[1]);
      formula.userData.set(step[2]);
      // The engine draws 3D scenes a little higher (room for subtitles): allow for it.
      const hh = 3 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const shift = camera.view?.enabled ? (2 * camera.view.offsetY) / camera.view.fullHeight : 0;
      caption.position.set(0, (0.86 - shift) * hh, -3);
      formula.position.set(0, (0.7 - shift) * hh, -3);

      // Camera.
      const v = view(p);
      const r = fitDistance(camera, v.r) * 0.82;
      const az = v.az + Math.sin(t * 0.11) * 0.04;
      const el = v.el + Math.sin(t * 0.07) * 0.02;
      const target = v.target.clone();
      camera.position.set(target.x + r * Math.cos(el) * Math.sin(az), target.y + r * Math.sin(el), target.z + r * Math.cos(el) * Math.cos(az));
      camera.lookAt(target);
      // The presenter stands on the right: the work sits a little left of the middle.
      if (camera.aspect > 1.1) {
        camera.updateMatrixWorld();
        right.setFromMatrixColumn(camera.matrixWorld, 0);
        const hw = r * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
        camera.position.addScaledVector(right, hw * 0.16);
      }
      void ctx;
    },
  };
}

/* ---------- Indian numerals, zero, and the word «algorithm» ---------- */

// A small ivory tile with one big cobalt digit and a gilt rim.
const digitMats = new Map();
export function digit(ch) {
  if (!digitMats.has(ch)) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(100, 90, 10, 128, 128, 190);
    grad.addColorStop(0, '#fbf1d8');
    grad.addColorStop(1, '#d9c497');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#c89a3c';
    g.lineWidth = 12;
    g.strokeRect(6, 6, 244, 244);
    g.fillStyle = '#1d3b8a';
    g.font = "700 190px 'Cormorant Garamond', Georgia, serif";
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, 128, 142);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    digitMats.set(ch, new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 }));
  }
  return shadowed(new THREE.Mesh(tileGeometry(0.9, 0.9, 0.2), digitMats.get(ch)));
}

// A sand board (takht): the arithmetic of the time was written in fine sand.
function sandBoard(columns, colW = 1.5, depth = 2.0) {
  const g = new THREE.Group();
  const w = columns.length * colW + 0.5;
  const frameMat = wood(5, { light: '#7a4a26', dark: '#3a2010' });
  const rim = (sx, sz, x, z) => {
    const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(sx, 0.25, sz), frameMat));
    m.position.set(x, 0.125, z);
    g.add(m);
  };
  rim(w + 0.3, 0.15, 0, -depth / 2 - 0.075);
  rim(w + 0.3, 0.15, 0, depth / 2 + 0.075);
  rim(0.15, depth, -w / 2 - 0.075, 0);
  rim(0.15, depth, w / 2 + 0.075, 0);
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const s = c.getContext('2d');
  s.fillStyle = '#c9ab78';
  s.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 30000; i++) {
    const v = Math.random();
    s.fillStyle = `rgba(${v < 0.5 ? '120,90,50' : '255,240,210'},${0.08 + Math.random() * 0.12})`;
    s.fillRect(Math.random() * 1024, Math.random() * 512, 1.5, 1.5);
  }
  // Grooves between the columns, drawn with a finger.
  s.strokeStyle = 'rgba(90,62,30,0.55)';
  s.lineWidth = 6;
  for (let i = 1; i < columns.length; i++) {
    const x = (i / columns.length) * 1024;
    s.beginPath();
    s.moveTo(x, 30);
    s.lineTo(x + 4, 482);
    s.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sand = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, depth), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  sand.position.y = 0.07;
  sand.receiveShadow = true;
  g.add(sand);
  const heads = columns.map((name, i) => {
    const h = label(name, { size: 0.3, family: SERIF, color: '#ffe8b0', background: 'rgba(20,12,6,0.6)', weight: 700 });
    h.position.set((i - (columns.length - 1) / 2) * colW, 0.5, -depth / 2 - 0.45);
    g.add(h);
    return h;
  });
  g.userData = { colX: (i) => (i - (columns.length - 1) / 2) * colW, heads, width: w };
  return g;
}

export function numerals({ params = {} } = {}) {
  const { scene, camera } = studyStage();
  const { lamp, motes } = study(scene);
  const decimal = params.variant === 'decimal';
  const right = new THREE.Vector3();

  const board = sandBoard(decimal ? ['целые', 'десятые', 'сотые'] : ['сотни', 'десятки', 'единицы']);
  board.position.set(-0.6, 0, 0.6);
  scene.add(board);
  const { colX } = board.userData;
  const slot = (i) => board.localToWorld(new THREE.Vector3(colX(i), 0.15, 0.1));

  // The ten digits in a row above the board.
  const row = '1234567890'.split('').map((ch, i) => {
    const d = digit(ch);
    d.userData.home = new THREE.Vector3(-0.6 + (i - 4.5) * 1.0, 0.02, -1.75);
    scene.add(d);
    return d;
  });
  const value = label('3', { size: 0.95, family: SERIF, color: '#fff1cf', background: null, glow: 1, weight: 700, template: '0,25 = 2/10 + 5/100' });
  scene.add(value);
  const zeroNote = label(decimal ? 'запятая отделяет целые от долей' : 'ноль держит пустое место', { size: 0.3, family: SERIF, color: '#ffe8b0', background: 'rgba(20,12,6,0.6)' });
  scene.add(zeroNote);
  const zeroGlow = glow(0xffd27a, 2.4, 0);
  scene.add(zeroGlow);
  const comma = label(',', { size: 1.4, family: SERIF, color: '#ffd27a', background: null, weight: 700 });
  scene.add(comma);

  // The Latin book: «Dixit Algorizmi».
  const latin = new THREE.Group();
  latin.position.set(4.6, 0, -0.4);
  latin.rotation.y = -0.45;
  scene.add(latin);
  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = 768;
  pageCanvas.height = 1024;
  const lp = pageCanvas.getContext('2d');
  lp.drawImage(parchmentMaps({ seed: 44, size: 768, aspect: 0.75 }).map.image, 0, 0);
  lp.fillStyle = '#9a2a14';
  lp.font = "700 76px 'Cormorant Garamond', Georgia, serif";
  lp.fillText('DIXIT', 70, 160);
  lp.fillText('ALGORIZMI:', 70, 245);
  lp.fillStyle = 'rgba(40,24,10,0.85)';
  lp.font = "500 italic 40px 'Cormorant Garamond', Georgia, serif";
  const words = ['laudes deo rectori nostro', 'atque defensori dicamus', 'dignas debitas, que', 'debentur ei ...', '', 'I II III IIII V VI VII', 'VIII IX X'];
  words.forEach((w, i) => lp.fillText(w, 70, 330 + i * 56));
  const latinTex = new THREE.CanvasTexture(pageCanvas);
  latinTex.colorSpace = THREE.SRGBColorSpace;
  const latinPage = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 3.2), [null, null, new THREE.MeshStandardMaterial({ map: latinTex, roughness: 0.9, color: 0xd5c3a0 }), null, null, null].map((m) => m ?? new THREE.MeshStandardMaterial({ color: 0xcdb48a }))));
  latinPage.position.y = 0.05;
  latin.add(latinPage);
  const sweep = glow(0xffe0a0, 2.4, 0);
  latin.add(sweep);
  const latinTitle = label('«Algoritmi de numero Indorum» — латинский перевод', { size: 0.3, family: SERIF, color: '#ffe8b0', background: 'rgba(20,12,6,0.6)' });
  latinTitle.visible = false;
  // The name turns into a word.
  const forms = ['Algorizmi', 'algorismus', 'алгоритм'].map((w, i) => {
    const l = label(w, { size: i === 2 ? 0.9 : 0.75, family: SERIF, color: i === 2 ? '#ffe2a3' : '#f6e3c0', background: null, glow: 1, weight: 700 });
    scene.add(l);
    return l;
  });

  // Words on the screen.
  const steps = decimal
    ? [[0, 'Десятичные дроби в «Ключе арифметики»', '0,25'], [0.3, 'Две десятых', '2/10'], [0.5, 'и пять сотых', '2/10 + 5/100'], [0.68, 'Ноль целых двадцать пять сотых', '0,25 = 2/10 + 5/100']]
    : [[0, 'Индийские цифры и ноль', '1 2 3 4 5 6 7 8 9 0'], [0.08, 'Значение цифры зависит от её места', '3 · 30 · 300'], [0.2, 'Ноль держит пустое место', '307 = 3·100 + 0·10 + 7'], [0.3, 'Латинский перевод: «Сказал Алгоризми»', 'Dixit Algorizmi'], [0.7, 'Так имя учёного стало словом', 'алгоритм']];
  const longest = steps.reduce((a, st) => (st[1].length > a.length ? st[1] : a), '');
  const widest = steps.reduce((a, st) => (st[2].length > a.length ? st[2] : a), '');
  const caption = label(steps[0][1], { size: 0.06, template: longest, background: 'rgba(14,9,5,0.66)' });
  const formula = label(steps[0][2], { size: 0.1, family: SERIF, weight: 700, color: '#ffe2a3', background: 'rgba(14,9,5,0.72)', template: widest });
  camera.add(caption, formula);

  const boardView = { target: new THREE.Vector3(-0.6, 0.3, -0.4), az: -0.05, el: 0.86, r: 3.4 };
  const bookView = { target: latin.position.clone().add(new THREE.Vector3(0, 0.3, 0.3)), az: -0.3, el: 0.85, r: 2.8 };
  const place = (m, pos, lift = 0) => m.position.copy(pos).add(new THREE.Vector3(0, lift, 0));

  return {
    scene,
    camera,
    update({ t, p }) {
      motes.userData.update?.(t);
      lamp.update(t);
      // Row of digits.
      row.forEach((d, i) => {
        const a = stage(p, i * 0.006, 0.05 + i * 0.006);
        d.visible = a > 0.001 && !(decimal ? false : (i === 2 || i === 6 || i === 9) && p > 0.07);
        place(d, d.userData.home, (1 - a) * 1.5);
        d.rotation.x = (1 - a) * 0.8;
      });
      let shown = '';
      if (!decimal) {
        // «3» walks from the units to the hundreds: 3, 30, 300.
        const three = row[2];
        const u = clamp((p - 0.07) / 0.15);
        const col = u < 0.33 ? 2 : u < 0.66 ? 1 : 0;
        const k = u < 0.33 ? u / 0.33 : u < 0.66 ? (u - 0.33) / 0.33 : (u - 0.66) / 0.34;
        if (p > 0.07) {
          const from = col === 2 ? three.userData.home : slot(col + 1);
          const to = slot(col);
          three.visible = true;
          place(three, from.clone().lerp(to, smooth(clamp(k * 2.5))), Math.sin(Math.PI * clamp(k * 2.5)) * 0.8);
          shown = ['300', '30', '3'][col];
        }
        // «7» to the units, zero into the empty tens.
        const seven = row[6];
        const s7 = stage(p, 0.2, 0.235);
        if (p > 0.2) {
          seven.visible = true;
          place(seven, seven.userData.home.clone().lerp(slot(2), s7), Math.sin(Math.PI * s7) * 0.8);
          shown = s7 > 0.9 ? '3 _ 7' : shown;
        }
        const zero = row[9];
        const s0 = stage(p, 0.245, 0.28);
        if (p > 0.245) {
          zero.visible = true;
          place(zero, zero.userData.home.clone().lerp(slot(1), s0), Math.sin(Math.PI * s0) * 1.2);
          if (s0 > 0.9) shown = '307';
        }
        zeroGlow.position.copy(slot(1)).add(new THREE.Vector3(0, 0.3, 0));
        zeroGlow.material.opacity = stage(p, 0.27, 0.29) * (1 - stage(p, 0.34, 0.38)) * 0.7;
        zeroNote.position.copy(slot(1)).add(new THREE.Vector3(0, 0.45, 0.85));
        fade(zeroNote, stage(p, 0.27, 0.29) * (1 - stage(p, 0.34, 0.38)));
        fade(comma, 0);
      } else {
        // 2 tenths, 5 hundredths, 0 units and the comma.
        const two = row[1];
        const five = row[4];
        const zero = row[9];
        const s2 = stage(p, 0.3, 0.36);
        const s5 = stage(p, 0.48, 0.54);
        const s0 = stage(p, 0.66, 0.72);
        if (p > 0.3) place(two, two.userData.home.clone().lerp(slot(1), s2), Math.sin(Math.PI * s2) * 0.8);
        if (p > 0.48) place(five, five.userData.home.clone().lerp(slot(2), s5), Math.sin(Math.PI * s5) * 0.8);
        if (p > 0.66) place(zero, zero.userData.home.clone().lerp(slot(0), s0), Math.sin(Math.PI * s0) * 0.8);
        shown = p > 0.72 ? '0,25' : p > 0.54 ? '2/10 + 5/100' : p > 0.36 ? '2/10' : '';
        comma.position.copy(slot(0).lerp(slot(1), 0.5)).add(new THREE.Vector3(0, 0.35, 0.3));
        fade(comma, stage(p, 0.72, 0.76));
        zeroGlow.position.copy(comma.position);
        zeroGlow.material.opacity = stage(p, 0.72, 0.76) * 0.6;
        zeroNote.position.copy(slot(1)).add(new THREE.Vector3(0, 0.5, 1.4));
        fade(zeroNote, stage(p, 0.76, 0.8));
      }
      value.userData.set(shown || ' ');
      // The value stands to the right of the board (the presenter is on the left).
      value.position.copy(board.position).add(new THREE.Vector3(0.4, 1.0, 1.75));
      fade(value, shown ? (decimal ? 1 : 1 - stage(p, 0.33, 0.36)) : 0);

      // The Latin book and the birth of a word (only for al-Khwarizmi).
      const book = decimal ? 0 : stage(p, 0.3, 0.36);
      sweep.position.set(lerp(-1.2, 1.2, clamp((p - 0.4) / 0.2)), 0.15, -0.9);
      sweep.material.opacity = decimal ? 0 : stage(p, 0.4, 0.44) * (1 - stage(p, 0.6, 0.64)) * 0.7;
      void book;
      latin.visible = !decimal;
      const lift = latin.position.clone().add(new THREE.Vector3(-0.2, 0.7, 1.3));
      const w1 = stage(p, 0.62, 0.66) * (1 - stage(p, 0.74, 0.77));
      const w2 = stage(p, 0.74, 0.77) * (1 - stage(p, 0.82, 0.85));
      const w3 = stage(p, 0.83, 0.87);
      [w1, w2, w3].forEach((w, i) => {
        fade(forms[i], decimal ? 0 : w);
        forms[i].position.copy(lift).add(new THREE.Vector3(0, i === 2 ? 0.4 + stage(p, 0.83, 0.95) * 0.3 : 0, 0));
      });

      const step = steps.filter(([s]) => p >= s).at(-1);
      caption.userData.set(step[1]);
      formula.userData.set(step[2]);
      const hh = 3 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const shift = camera.view?.enabled ? (2 * camera.view.offsetY) / camera.view.fullHeight : 0;
      caption.position.set(0, (0.86 - shift) * hh, -3);
      formula.position.set(0, (0.7 - shift) * hh, -3);

      // Camera: the board, then the Latin book.
      const u = decimal ? 0 : stage(p, 0.3, 0.38);
      const v = {
        target: boardView.target.clone().lerp(bookView.target, u),
        az: lerp(boardView.az, bookView.az, u) + Math.sin(t * 0.1) * 0.04,
        el: lerp(boardView.el, bookView.el, u),
        r: lerp(boardView.r, bookView.r, u) * lerp(1, 0.92, smooth(p)),
      };
      const r = fitDistance(camera, v.r) * 0.82;
      camera.position.set(v.target.x + r * Math.cos(v.el) * Math.sin(v.az), v.target.y + r * Math.sin(v.el), v.target.z + r * Math.cos(v.el) * Math.cos(v.az));
      camera.lookAt(v.target);
      if (camera.aspect > 1.1) {
        camera.updateMatrixWorld();
        right.setFromMatrixColumn(camera.matrixWorld, 0);
        const hw = r * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
        // The presenter stands on the left here: the board sits right of the middle.
        camera.position.addScaledVector(right, -hw * 0.16);
      }
    },
  };
}
