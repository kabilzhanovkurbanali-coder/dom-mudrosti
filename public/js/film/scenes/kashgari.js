// Mahmud Kashgari's round map of the Turkic world (1070s), on the desk next
// to his «Diwan Lughat al-Turk». As on the original: east at the top,
// the world ringed by the ocean, mountains drawn in red, rivers in blue,
// Balasagun in the middle and Issyk-Kul beside it. Timed to the narration.
import { THREE, label, fade, rod, tube, revealTube, stage, smooth, lerp, clamp, glow, fitDistance, rng, SERIF } from '../kit.js';
import { parchmentMaps } from '../materials.js';
import { study, studyStage, turningPage, shadowed } from './khwarizmi.js';

const R = 3.1; // map radius in scene units
// One unit of the map (east or north = 1) is where the painted land meets the ocean.
const U = R * 0.857;

// Positions on the map in its own terms: east (up) and north (left), from −1 to 1.
const MAP = new THREE.Vector3(0.6, 0.06, 0.3);
const at = (east, north, y = 0) => new THREE.Vector3(MAP.x - north * U, MAP.y + y, MAP.z - east * U);

const CITIES = [
  ['Баласагун', 0, 0, 'capital'],
  ['Барсхан', 0.17, -0.1],
  ['Кашгар', 0.1, -0.34],
  ['Хотан', 0.3, -0.52],
  ['Тараз', -0.14, 0.04],
  ['Самарканд', -0.4, -0.2],
  ['Бухара', -0.5, -0.16],
  ['Хорезм', -0.6, 0.08],
];
const REGIONS = [['Чин', 0.74, 0], ['Хинд', 0.12, -0.7], ['Рум', -0.76, 0.05], ['Ирак', -0.56, -0.5], ['Кыпчаки', 0.0, 0.66]];
// Ranges: lists of [east, north].
const RANGES = [
  [[-0.2, -0.12], [0.0, -0.16], [0.18, -0.2], [0.42, -0.18], [0.6, -0.12]], // Tian Shan, south of the lake
  [[-0.05, -0.42], [0.15, -0.46], [0.35, -0.62], [0.55, -0.68]], // Pamir and Kunlun
  [[0.2, 0.38], [0.36, 0.46], [0.5, 0.5]], // Altai in the north
  [[-0.32, -0.5], [-0.5, -0.56], [-0.66, -0.48]], // Hindu Kush
];
const RIVERS = [
  [[-0.2, -0.22], [-0.32, -0.12], [-0.46, 0.0], [-0.6, 0.16]], // Syr Darya
  [[-0.38, -0.46], [-0.48, -0.3], [-0.58, -0.12], [-0.66, 0.04]], // Amu Darya
  [[0.06, 0.02], [-0.04, 0.06], [-0.16, 0.1], [-0.26, 0.16]], // Chu
  [[0.34, 0.06], [0.24, 0.16], [0.14, 0.28], [0.04, 0.36]], // Ili
];

// The painted sheet: parchment, the ocean ring with waves, deserts and the names of the lands.
function mapTexture() {
  const S = 2048;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.drawImage(parchmentMaps({ seed: 55, size: 1024 }).map.image, 0, 0, S, S);
  const cx = S / 2;
  const r = S * 0.47;
  const px = (east, north) => [cx - north * r * 0.86, cx - east * r * 0.86];
  // The ocean around the world.
  g.save();
  g.beginPath();
  g.arc(cx, cx, r, 0, Math.PI * 2);
  g.arc(cx, cx, r * 0.86, 0, Math.PI * 2, true);
  const sea = g.createRadialGradient(cx, cx, r * 0.86, cx, cx, r);
  sea.addColorStop(0, '#2f6f6a');
  sea.addColorStop(1, '#1d4f57');
  g.fillStyle = sea;
  g.fill('evenodd');
  g.clip('evenodd');
  g.strokeStyle = 'rgba(220,240,230,0.35)';
  g.lineWidth = 3;
  for (let a = 0; a < Math.PI * 2; a += 0.045) {
    for (const k of [0.89, 0.93, 0.97]) {
      const x = cx + Math.cos(a) * r * k;
      const y = cx + Math.sin(a) * r * k;
      g.beginPath();
      g.arc(x, y, 9, a + Math.PI * 0.2, a + Math.PI * 0.8);
      g.stroke();
    }
  }
  g.restore();
  g.lineWidth = 6;
  g.strokeStyle = '#6b2a14';
  g.beginPath();
  g.arc(cx, cx, r, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.arc(cx, cx, r * 0.86, 0, Math.PI * 2);
  g.stroke();
  // Deserts: fields of ochre dots.
  const rand = rng(3);
  for (const [e, n, w, h] of [[0.36, -0.36, 0.22, 0.12], [-0.46, 0.02, 0.16, 0.14], [0.02, 0.24, 0.16, 0.08]]) {
    const [x, y] = px(e, n);
    for (let i = 0; i < 520; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand());
      g.fillStyle = `rgba(196,140,52,${0.35 + rand() * 0.35})`;
      g.beginPath();
      g.arc(x + Math.cos(a) * d * h * r * 0.86, y + Math.sin(a) * d * w * r * 0.86, 3 + rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Names of the lands, as a scribe would write them.
  g.fillStyle = 'rgba(120,40,16,0.9)';
  g.font = `600 italic ${Math.round(S * 0.034)}px 'Cormorant Garamond', Georgia, serif`;
  g.textAlign = 'center';
  for (const [name, e, n] of REGIONS) {
    const [x, y] = px(e, n);
    g.fillText(name, x, y);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// A ridge of red mountains along a path, as little painted peaks that rise up.
function ridge(points, rand) {
  const group = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(points.map(([e, n]) => at(e, n)));
  const count = Math.round(curve.getLength() / 0.09);
  const red = new THREE.MeshStandardMaterial({ color: 0xb4482a, roughness: 0.7, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x7a2a16, roughness: 0.75, flatShading: true });
  const snow = new THREE.MeshStandardMaterial({ color: 0xf6ead2, roughness: 0.6, flatShading: true });
  for (let i = 0; i < count; i++) {
    const p = curve.getPointAt(i / Math.max(1, count - 1));
    // Two rows of peaks, the inner ones taller with a white top.
    for (const row of [0, 1]) {
      const h = (row ? 0.16 : 0.24) + rand() * 0.16;
      const peak = new THREE.Group();
      const body = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.075 + rand() * 0.03, h, 7), (i + row) % 3 ? red : dark));
      body.position.y = h / 2;
      peak.add(body);
      if (!row) {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.03, h * 0.28, 7), snow);
        cap.position.y = h * 0.88;
        peak.add(cap);
      }
      peak.position.set(p.x + (rand() - 0.5) * 0.1 + row * 0.08, p.y, p.z + (rand() - 0.5) * 0.1 + row * 0.06);
      peak.rotation.y = rand() * Math.PI;
      peak.userData.h = h;
      group.add(peak);
    }
  }
  return group;
}

export function turkmap() {
  const { scene, camera } = studyStage();
  const { lamp, motes } = study(scene);
  const rand = rng(41);
  const right = new THREE.Vector3();

  // ---- The Diwan, open on the desk.
  const book = new THREE.Group();
  book.position.set(-5.4, 0, -0.2);
  book.rotation.y = 0.42;
  scene.add(book);
  const PW = 1.9;
  const PD = 2.6;
  const left = parchmentMaps({ title: 'ديوان لغات الترك', lines: ['بسم الله الرحمن الرحيم', 'محمود بن الحسين بن محمد الكاشغري'], seed: 61, aspect: PW / PD, size: 768 });
  const rightPage = parchmentMaps({ lines: ['قال محمود بن الحسين', 'رأيت الله تعالى أطلع شمس الدولة', 'في بروج الأتراك'], seed: 62, aspect: PW / PD, size: 768 });
  const cover = shadowed(new THREE.Mesh(new THREE.BoxGeometry(PW * 2 + 0.25, 0.06, PD + 0.2), new THREE.MeshStandardMaterial({ color: 0x1f3a52, roughness: 0.6 })));
  cover.position.y = 0.03;
  book.add(cover);
  const pagesMat = new THREE.MeshStandardMaterial({ color: 0xe8d6ab, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const block = shadowed(new THREE.Mesh(new THREE.BoxGeometry(PW - 0.04, 0.16, PD - 0.06), pagesMat));
    block.position.set(side * (PW / 2 + 0.02), 0.14, 0);
    block.rotation.z = side * -0.035;
    book.add(block);
    const page = new THREE.Mesh(new THREE.PlaneGeometry(PW - 0.06, PD - 0.08), new THREE.MeshStandardMaterial({ map: (side < 0 ? left : rightPage).map, roughness: 0.9, color: 0xcbb995 }));
    page.rotation.x = -Math.PI / 2;
    page.rotation.y = side * 0.035;
    page.position.set(side * (PW / 2 + 0.02), 0.225, 0);
    page.receiveShadow = true;
    book.add(page);
  }
  const flip = turningPage(PW - 0.06, PD - 0.08, new THREE.MeshStandardMaterial({ map: rightPage.map, roughness: 0.9, side: THREE.DoubleSide, color: 0xcbb995 }));
  flip.position.y = 0.23;
  book.add(flip);

  // ---- The round map.
  const sheet = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(R * 1.06, R * 1.06, 0.03, 128), [
    new THREE.MeshStandardMaterial({ color: 0xb59a6c, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: mapTexture(), roughness: 0.88, color: 0xd6c4a2 }),
    new THREE.MeshStandardMaterial({ color: 0xb59a6c, roughness: 0.9 }),
  ]));
  sheet.position.copy(MAP).setY(0.03);
  sheet.rotation.y = Math.PI / 2; // the texture's top towards the far side (east)
  scene.add(sheet);
  // The ocean ring is painted; a glint runs around it when it is named.
  const oceanGlint = glow(0x9fe0d0, 1.6, 0);
  scene.add(oceanGlint);
  // East at the top: a small compass rose.
  const rose = new THREE.Group();
  const roseMat = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.9, roughness: 0.3 });
  for (let k = 0; k < 8; k++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, k % 2 ? 0.28 : 0.5, 4), roseMat);
    const a = (k / 8) * Math.PI * 2;
    spike.rotation.set(Math.PI / 2, 0, -a);
    spike.position.set(Math.sin(a) * (k % 2 ? 0.14 : 0.25), 0.03, -Math.cos(a) * (k % 2 ? 0.14 : 0.25));
    rose.add(spike);
  }
  rose.position.copy(at(0.82, -0.82, 0.05));
  scene.add(rose);
  const eastTag = label('ВОСТОК ↑', { size: 0.34, family: SERIF, weight: 700, color: '#ffe2a3', background: 'rgba(20,12,6,0.6)' });
  eastTag.position.copy(at(0.97, 0, 0.35));
  scene.add(eastTag);
  const eastArrow = rod(at(0.62, 0, 0.12), at(0.9, 0, 0.12), 0.035, new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  scene.add(eastArrow);

  // Balasagun in the middle, Issyk-Kul beside it.
  const capital = new THREE.Group();
  capital.position.copy(at(0, 0, 0.04));
  const medallion = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 32), new THREE.MeshStandardMaterial({ color: 0xf0c060, metalness: 0.9, roughness: 0.25, emissive: 0x5a3a00, emissiveIntensity: 0.4 })));
  const capGlow = glow(0xffd27a, 1.6, 0);
  capital.add(medallion, capGlow);
  scene.add(capital);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshPhysicalMaterial({ color: 0x2f8fb8, roughness: 0.1, metalness: 0.1, clearcoat: 1, transparent: true }));
  lake.rotation.x = -Math.PI / 2;
  lake.scale.set(R * 0.11, R * 0.045, 1); // long from west to east (along x after the turn)
  lake.rotation.z = Math.PI / 2;
  lake.position.copy(at(0.13, -0.02, 0.025));
  scene.add(lake);
  const lakeGlint = glow(0xbfe8ff, 1.2, 0);
  lakeGlint.position.copy(lake.position).setY(0.15);
  scene.add(lakeGlint);

  // Mountains, rivers, cities.
  const ranges = RANGES.map((pts) => ridge(pts, rand));
  ranges.forEach((m) => scene.add(m));
  const water = new THREE.MeshStandardMaterial({ color: 0x2a86c8, roughness: 0.25, emissive: 0x0d4a78, emissiveIntensity: 0.8 });
  const rivers = RIVERS.map((pts) => {
    const r = tube(pts.map(([e, n]) => at(e, n, 0.03)), 0.045, water, 120);
    revealTube(r, 0);
    scene.add(r);
    return r;
  });
  const cities = CITIES.map(([name, e, n, kind]) => {
    const g = new THREE.Group();
    g.position.copy(at(e, n, 0.03));
    if (!kind) {
      const dot = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20), new THREE.MeshStandardMaterial({ color: 0x8a2a16, roughness: 0.5 })));
      g.add(dot);
    }
    const tag = label(name, { size: kind ? 0.34 : 0.26, family: SERIF, weight: 700, color: kind ? '#ffe2a3' : '#fbe9c4', background: 'rgba(20,12,6,0.66)' });
    tag.position.set(0, kind ? 0.42 : 0.36, kind ? 0.32 : 0);
    g.add(tag);
    scene.add(g);
    return g;
  });
  const lakeTag = label('Иссык-Куль', { size: 0.28, family: SERIF, weight: 700, color: '#cfefff', background: 'rgba(8,20,30,0.66)' });
  lakeTag.position.copy(at(0.24, -0.02, 0.4));
  scene.add(lakeTag);

  // Words on the screen.
  const steps = [
    [0, '«Диван лугат ат-тюрк» — словарь тюркских наречий', 'Махмуд Кашгари, Багдад, 1070-е'],
    [0.29, 'В книге — круглая карта', 'первая известная карта тюркского мира'],
    [0.55, 'Восток на ней сверху', 'восток ↑'],
    [0.67, 'В центре — Баласагун', 'Баласагун'],
    [0.75, 'Рядом — озеро Иссык-Куль', 'Иссык-Куль'],
    [0.81, 'Вокруг — горы, реки, пустыни и города', 'горы · реки · пустыни · города'],
  ];
  const longest = steps.reduce((a, s) => (s[1].length > a.length ? s[1] : a), '');
  const widest = steps.reduce((a, s) => (s[2].length > a.length ? s[2] : a), '');
  const caption = label(steps[0][1], { size: 0.06, template: longest, background: 'rgba(14,9,5,0.66)' });
  const formula = label(steps[0][2], { size: 0.085, family: SERIF, weight: 700, color: '#ffe2a3', background: 'rgba(14,9,5,0.72)', template: widest });
  camera.add(caption, formula);

  const onBook = { target: book.position.clone().add(new THREE.Vector3(0.1, 0.25, 0.1)), az: -0.32, el: 0.8, r: 1.8 };
  const whole = { target: at(0.12, 0), az: 0, el: 1.12, r: R * 1.22 };
  const centre = { target: at(0.1, -0.02), az: 0.05, el: 1.05, r: R * 0.82 };
  const shots = [[0, onBook], [0.24, onBook], [0.31, whole], [0.64, whole], [0.68, centre], [0.8, centre], [0.86, whole]];
  const view = (p) => {
    let i = 0;
    while (i < shots.length - 1 && p >= shots[i + 1][0]) i += 1;
    const [a, A] = shots[i];
    const [b, B] = shots[Math.min(i + 1, shots.length - 1)];
    const u = b === a ? 0 : smooth(clamp((p - a) / (b - a)));
    return { target: A.target.clone().lerp(B.target, u), az: lerp(A.az, B.az, u), el: lerp(A.el, B.el, u), r: lerp(A.r, B.r, u) };
  };

  return {
    scene,
    camera,
    update({ t, p }) {
      motes.userData.update?.(t);
      lamp.update(t);
      flip.userData.turn(stage(p, 0.08, 0.16));

      // The map: the sheet is there; its parts come with the words.
      const ocean = stage(p, 0.36, 0.44);
      const a = t * 0.6;
      oceanGlint.position.copy(at(Math.sin(a) * 0.93, Math.cos(a) * 0.93, 0.08));
      oceanGlint.material.opacity = ocean * (1 - stage(p, 0.6, 0.66)) * 0.8;
      const east = stage(p, 0.55, 0.6);
      fade(eastTag, east);
      fade(eastArrow, east);
      rose.scale.setScalar(0.001 + east);
      rose.rotation.y = (1 - east) * 2 + Math.sin(t * 0.8) * 0.03;

      const cap = stage(p, 0.68, 0.72);
      capital.scale.setScalar(0.001 + cap);
      capGlow.material.opacity = cap * (0.55 + 0.35 * Math.sin(t * 3));
      fade(cities[0], cap);
      const lk = stage(p, 0.77, 0.8);
      lake.material.opacity = lk;
      lake.visible = lk > 0.01;
      lakeGlint.material.opacity = lk * (0.35 + 0.25 * Math.sin(t * 2.2));
      fade(lakeTag, lk);

      ranges.forEach((m, i) => {
        const grow = stage(p, 0.83 + i * 0.015, 0.88 + i * 0.015);
        m.visible = grow > 0.01;
        m.children.forEach((peak) => {
          peak.scale.set(1, Math.max(0.01, grow), 1);
          peak.position.y = MAP.y;
        });
      });
      rivers.forEach((r, i) => revealTube(r, stage(p, 0.86 + i * 0.012, 0.93 + i * 0.012)));
      cities.slice(1).forEach((c, i) => fade(c, stage(p, 0.92 + i * 0.008, 0.95 + i * 0.008)));

      const step = steps.filter(([s]) => p >= s).at(-1);
      caption.userData.set(step[1]);
      formula.userData.set(step[2]);
      const hh = 3 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const shift = camera.view?.enabled ? (2 * camera.view.offsetY) / camera.view.fullHeight : 0;
      caption.position.set(0, (0.86 - shift) * hh, -3);
      formula.position.set(0, (0.7 - shift) * hh, -3);

      const v = view(p);
      const r = fitDistance(camera, v.r) * 0.8;
      const az = v.az + Math.sin(t * 0.09) * 0.03;
      camera.position.set(v.target.x + r * Math.cos(v.el) * Math.sin(az), v.target.y + r * Math.sin(v.el), v.target.z + r * Math.cos(v.el) * Math.cos(az));
      camera.lookAt(v.target);
      // The presenter is on the left: the map sits right of the middle.
      if (camera.aspect > 1.1) {
        camera.updateMatrixWorld();
        right.setFromMatrixColumn(camera.matrixWorld, 0);
        const hw = r * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
        camera.position.addScaledVector(right, -hw * 0.15);
      }
    },
  };
}
