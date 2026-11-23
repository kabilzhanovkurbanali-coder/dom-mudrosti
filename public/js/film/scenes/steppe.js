// Discoveries of the scholars of the steppe and of Khwarezm: the poem of
// Yusuf Balasaguni, the map of Mahmud Kashgari, the spherical law of sines
// of Abu Nasr Mansur, the rhyme dictionary and the wings of al-Jawhari.
import {
  THREE, COLORS, createStage, fitDistance, orbit, metal, matte, shine, glow, label, fade, dust, rod, tube,
  revealTube, ring, rng, stage, smooth, lerp, clamp,
} from '../kit.js';
import { parchment } from './science.js';
import { createFigure } from '../figure.js';

const warmStage = (opts = {}) => createStage({ background: 0x120d08, ambient: 0.35, sun: 0.9, ...opts });

// Caption at the top that follows the narration: [[from, text], ...].
function captions(steps, size = 0.42) {
  const longest = steps.reduce((a, [, t]) => (t.length > a.length ? t : a), '');
  const sprite = label(steps[0][1], { size, template: longest });
  return {
    sprite,
    update(p) {
      sprite.userData.set(steps.filter(([at]) => p >= at).at(-1)[1]);
    },
  };
}

/* ---------- Yusuf Balasaguni: the four heroes of «Kutadgu Bilig» ---------- */

export function kutadgu() {
  const { scene, camera, sun } = warmStage();
  sun.position.set(-3, 9, 7);
  const lamp = new THREE.PointLight(0xffc27a, 18, 30, 2);
  lamp.position.set(0, 4, 5);
  scene.add(lamp);
  const motes = dust(240, [14, 8, 8], 0xffdca8, 9);
  motes.position.set(0, -1, 0);
  scene.add(motes);

  // An open book on a lectern.
  const book = new THREE.Group();
  book.position.set(0, -1.6, 0);
  book.rotation.x = -0.55;
  const page = new THREE.MeshStandardMaterial({ map: parchment(), roughness: 1, color: 0xc9b089, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.8, 12, 1), page);
    const pos = leaf.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(((x + 1.05) / 2.1) * Math.PI) * 0.18);
    }
    leaf.geometry.computeVertexNormals();
    leaf.position.x = side * 1.08;
    leaf.rotation.y = side * -0.12;
    book.add(leaf);
  }
  const cover = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.0, 0.08), new THREE.MeshStandardMaterial({ color: 0x5a1d14, roughness: 0.6 }));
  cover.position.z = -0.08;
  book.add(cover);
  scene.add(book);
  const bookGlow = glow(0xffd27a, 4, 0);
  bookGlow.position.set(0, -1.2, 0.6);
  scene.add(bookGlow);

  const gold = metal(COLORS.gold, 0.25, 0.95);
  const symbols = [];
  const hero = (name, idea, build) => {
    const g = new THREE.Group();
    build(g);
    const tag = label(name, { size: 0.42, color: '#ffe2a3', background: null });
    tag.position.y = -1.1;
    const sub = label(idea, { size: 0.3, background: 'rgba(20,14,8,0.75)' });
    sub.position.y = -1.6;
    g.add(tag, sub);
    g.add(glow(0xffd8a0, 2.4, 0.25));
    scene.add(g);
    symbols.push(g);
    return g;
  };

  // Kün-Toghdï, the ruler: the sun and balanced scales of justice.
  hero('Кюн-Тогды', 'справедливость', (g) => {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 48), shine(0xffc34d, 1.6));
    g.add(disc);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      g.add(rod(new THREE.Vector3(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0), new THREE.Vector3(Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0), 0.025, shine(0xffd27a, 1.2)));
    }
    const beam = rod(new THREE.Vector3(-0.55, -0.05, 0.3), new THREE.Vector3(0.55, -0.05, 0.3), 0.025, gold);
    g.add(beam, rod(new THREE.Vector3(0, -0.05, 0.3), new THREE.Vector3(0, -0.75, 0.3), 0.03, gold));
    for (const x of [-0.5, 0.5]) {
      const pan = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), gold);
      pan.position.set(x, -0.38, 0.3);
      g.add(pan, rod(new THREE.Vector3(x, -0.05, 0.3), new THREE.Vector3(x, -0.38, 0.3), 0.008, gold));
    }
  });

  // Ay-Toldï, the vizier: the moon, whose light waxes and wanes like fortune.
  const moonShadow = new THREE.Mesh(new THREE.SphereGeometry(0.52, 40, 24), new THREE.MeshBasicMaterial({ color: 0x0c0a08 }));
  hero('Ай-Толды', 'счастье, переменчивое, как луна', (g) => {
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 40, 24), new THREE.MeshStandardMaterial({ color: 0xe8e2d0, emissive: 0x9a8f78, emissiveIntensity: 0.6, roughness: 0.9 }));
    g.add(moon, moonShadow);
  });

  // Ögdülmish, the vizier's son: a lamp, the light of reason.
  const flame = glow(0xffb347, 1.2, 1);
  hero('Огдюльмиш', 'разум', (g) => {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), gold);
    body.scale.set(1.5, 0.6, 0.9);
    const spout = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.45, 12), gold);
    spout.rotation.z = -Math.PI / 2.4;
    spout.position.set(0.5, 0.08, 0);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 24), gold);
    handle.position.set(-0.5, 0.05, 0);
    flame.position.set(0.72, 0.28, 0);
    g.add(body, spout, handle, flame);
  });

  // Odghurmish, the hermit: a plain bowl and a staff — contentment with little.
  hero('Одгурмыш', 'довольство малым', (g) => {
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.8 });
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), wood);
    bowl.material.side = THREE.DoubleSide;
    bowl.position.y = 0.1;
    g.add(bowl, rod(new THREE.Vector3(0.6, -0.6, 0), new THREE.Vector3(0.45, 0.85, 0), 0.035, wood));
  });

  const title = captions([
    [0, '«Кутадгу билиг» — «Знание, дающее счастье», 1069 год'],
    [0.25, 'Четыре героя — четыре идеи'],
    [0.87, 'На этом держится мудрое государство'],
  ]);
  scene.add(title.sprite);
  // When the narration names each hero (share of the part).
  const marks = [0.39, 0.5, 0.65, 0.75];
  const slots = [-5.2, -1.75, 1.75, 5.2];

  return {
    scene,
    camera,
    update({ t, p }) {
      motes.userData.update(t);
      fade(book, stage(p, 0, 0.06));
      bookGlow.material.opacity = 0.35 * stage(p, 0.03, 0.12);
      title.update(p);
      const together = stage(p, 0.87, 0.97);
      symbols.forEach((g, i) => {
        const rise = stage(p, marks[i], marks[i] + 0.06);
        fade(g, rise);
        // Rises from the book to its place, then all four circle the book.
        const a = t * 0.35 + (i / 4) * Math.PI * 2;
        const placeX = lerp(slots[i], Math.cos(a) * 3.6, together);
        const placeY = lerp(1.1, 0.7 + Math.sin(a) * 0.5, together);
        g.position.set(lerp(0, placeX, rise), lerp(-1.4, placeY, rise), lerp(0.5, 0.3 + Math.sin(a) * 1.2 * together, rise));
        g.scale.setScalar(lerp(0.5, 1.3, rise));
      });
      // The moon goes through its phases.
      // The shadow slides across but never hides the whole moon: crescent → half → nearly full.
      moonShadow.position.set(0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 0.6)), 0, 0.12);
      flame.scale.setScalar(1.1 + Math.sin(t * 9) * 0.08);
      camera.position.set(Math.sin(t * 0.08) * 1.2, 1.2, fitDistance(camera, 6.4));
      camera.lookAt(0, 0.1, 0);
      title.sprite.position.set(0, 3.0, 0.5);
    },
  };
}

/* ---------- Mahmud Kashgari: the round map of the Turkic world ---------- */

export function turkmap() {
  const { scene, camera, sun } = warmStage({ sun: 1 });
  sun.position.set(-4, 10, 6);
  const motes = dust(200, [12, 6, 10], 0xffdca8, 4);
  scene.add(motes);

  const R = 4;
  const map = new THREE.Group();
  map.rotation.x = -Math.PI / 2;
  scene.add(map);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshStandardMaterial({ map: parchment(), roughness: 1, color: 0xa58a62 }));
  map.add(disc);
  // The encircling ocean, as on medieval round maps.
  const ocean = new THREE.Mesh(new THREE.RingGeometry(R * 0.86, R, 96), new THREE.MeshStandardMaterial({ color: 0x2f6f8f, roughness: 0.5 }));
  ocean.position.z = 0.01;
  map.add(ocean);
  const rim = ring(R, 0.05, metal(COLORS.gold, 0.3, 0.9), 128);
  rim.position.z = 0.03;
  map.add(rim);

  // East is at the top of Kashgari's map. On our disc: +y = east, -x = north.
  const at = (east, north) => new THREE.Vector3(-north, east, 0);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(0.42, 40), new THREE.MeshStandardMaterial({ color: 0x3f9fc0, roughness: 0.2, metalness: 0.1 }));
  lake.scale.set(0.55, 1.4, 1); // stretched west–east
  lake.position.copy(at(0.85, 0.05)).setZ(0.03);
  map.add(lake);

  const rock = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.9 });
  const snow = new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.6 });
  const mountains = new THREE.Group();
  const rand = rng(21);
  // Tian Shan: a chain south of the lake, towards Kashgar.
  for (let i = 0; i < 26; i++) {
    const u = i / 25;
    const p = at(lerp(-0.6, 2.2, u), lerp(-0.55, -0.9, u) + (rand() - 0.5) * 0.3);
    const h = 0.25 + rand() * 0.35;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(0.16 + rand() * 0.08, h, 6), rock);
    peak.rotation.x = Math.PI / 2;
    peak.position.set(p.x, p.y, h / 2);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.07, h * 0.3, 6), snow);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(p.x, p.y, h * 0.92);
    mountains.add(peak, cap);
  }
  map.add(mountains);

  const water = shine(0x4fa3c7, 0.5);
  const rivers = [
    // Syr Darya flows west-north-west, Amu Darya further west, the Chu by the capital.
    tube([at(-0.2, -0.8), at(-1.0, -0.4), at(-1.8, 0.2), at(-2.6, 0.7)], 0.03, water, 80),
    tube([at(-0.9, -1.9), at(-1.7, -1.4), at(-2.4, -0.7), at(-3.0, -0.2)], 0.03, water, 80),
    tube([at(0.6, 0.15), at(0.2, 0.25), at(-0.3, 0.45), at(-0.9, 0.75)], 0.025, water, 60),
  ];
  rivers.forEach((r) => {
    r.position.z = 0.03;
    revealTube(r, 0);
    map.add(r);
  });

  const cities = [
    ['Баласагун', 0, 0, true],
    ['Иссык-Куль', 0.85, 0.65, false],
    ['Барсхан', 1.15, -0.35, false],
    ['Кашгар', 1.2, -1.85, false],
    ['Самарканд', -1.7, -1.35, false],
    ['Бухара', -2.3, -1.1, false],
    ['Хорезм', -2.7, 0.2, false],
  ].map(([name, east, north, capital]) => {
    const g = new THREE.Group();
    const p = at(east, north);
    g.position.set(p.x, p.y, 0.05);
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(capital ? 0.12 : 0.07, capital ? 0.12 : 0.07, 0.08, 20), capital ? shine(0xffc34d, 2) : metal(0x6b2a18, 0.5, 0.3));
    dot.rotation.x = Math.PI / 2;
    g.add(dot);
    if (capital) g.add(glow(0xffd27a, 1.4, 0.9));
    const tag = label(name, { size: capital ? 0.34 : 0.26, color: capital ? '#ffe2a3' : '#f4ecd8', background: 'rgba(20,14,8,0.72)' });
    tag.position.set(0, 0, 0.45);
    g.add(tag);
    map.add(g);
    return g;
  });
  const east = label('ВОСТОК ↑', { size: 0.3, color: '#ffe2a3', background: null });
  east.position.set(0, R * 0.93, 0.3);
  map.add(east);

  const title = captions([
    [0, '«Диван лугат ат-тюрк» · Махмуд Кашгари, 1072–1077'],
    [0.28, 'Первая известная карта тюркского мира'],
    [0.54, 'Восток — сверху'],
    [0.66, 'В центре — Баласагун'],
    [0.76, 'Рядом — озеро Иссык-Куль'],
    [0.83, 'Горы, реки, пустыни и города соседних стран'],
  ]);
  scene.add(title.sprite);

  return {
    scene,
    camera,
    update({ t, p }) {
      motes.userData.update(t);
      title.update(p);
      fade(disc, stage(p, 0, 0.12));
      fade(ocean, stage(p, 0.28, 0.38));
      fade(rim, stage(p, 0.28, 0.38));
      fade(east, stage(p, 0.54, 0.6));
      fade(cities[0], stage(p, 0.67, 0.72));
      fade(lake, stage(p, 0.76, 0.81));
      fade(cities[1], stage(p, 0.77, 0.82));
      const m = stage(p, 0.83, 0.91);
      fade(mountains, m);
      mountains.scale.set(1, 1, Math.max(0.01, m));
      rivers.forEach((r, i) => revealTube(r, stage(p, 0.85 + i * 0.02, 0.95 + i * 0.015)));
      cities.slice(2).forEach((c, i) => fade(c, stage(p, 0.87 + i * 0.02, 0.91 + i * 0.02)));
      cities[0].children[1].material.opacity = 0.6 + 0.4 * Math.sin(t * 3);
      // The map turns slowly, so the mountains show their relief.
      map.rotation.z = Math.sin(t * 0.1) * 0.15;
      const d = fitDistance(camera, R * 1.05);
      camera.position.set(0, d * lerp(0.95, 0.78, smooth(p)), d * 0.45);
      camera.lookAt(0, 0, 0.3);
      title.sprite.position.set(0, 1.6, -R * 0.95);
    },
  };
}

/* ---------- Abu Nasr Mansur: the spherical law of sines ---------- */

export function sines() {
  const { scene, camera } = createStage({ background: 0x070b14, ambient: 0.5, sun: 1.1 });
  const R = 3;
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(R, 64, 32),
    new THREE.MeshStandardMaterial({ color: 0x1b3a5c, transparent: true, opacity: 0.35, roughness: 0.3, metalness: 0.1, depthWrite: false }),
  );
  scene.add(sphere);
  const grid = new THREE.Group();
  const gridMat = new THREE.MeshBasicMaterial({ color: 0x4a6f96, transparent: true, opacity: 0.35 });
  for (let i = 1; i < 6; i++) {
    const lat = -Math.PI / 2 + (i / 6) * Math.PI;
    const r = ring(R * Math.cos(lat) + 0.002, 0.008, gridMat, 96);
    r.rotation.x = Math.PI / 2;
    r.position.y = R * Math.sin(lat);
    grid.add(r);
  }
  for (let i = 0; i < 6; i++) {
    const r = ring(R + 0.002, 0.008, gridMat, 96);
    r.rotation.y = (i / 6) * Math.PI;
    grid.add(r);
  }
  scene.add(grid);

  const dir = (lon, lat) => new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
  const A = dir(0, 1.25);
  const B = dir(-0.75, 0.15);
  const C0 = dir(0.8, 0.1);
  const C1 = dir(1.15, 0.55);
  const C = C0.clone();

  const colors = { a: 0xffc34d, b: 0x5cc2b5, c: 0xe0786a };
  const arcMesh = (color) => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), shine(color, 1.3));
    scene.add(m);
    return m;
  };
  const arcs = { a: arcMesh(colors.a), b: arcMesh(colors.b), c: arcMesh(colors.c) };
  const slerpPoints = (u, v, n = 48) => {
    const out = [];
    const angle = u.angleTo(v);
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const p = u.clone().multiplyScalar(Math.sin((1 - s) * angle)).add(v.clone().multiplyScalar(Math.sin(s * angle))).divideScalar(Math.sin(angle) || 1);
      out.push(p.normalize().multiplyScalar(R * 1.004));
    }
    return out;
  };
  const setArc = (mesh, u, v, reveal) => {
    mesh.geometry.dispose();
    mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(slerpPoints(u, v)), 64, 0.04, 8, false);
    revealTube(mesh, reveal);
  };

  const vertex = (name, sub, color) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 12), shine(color, 2)), glow(color, 0.9, 0.8));
    const tag = label(name, { size: 0.42, color: '#ffffff', background: null });
    tag.position.y = 0.42;
    const note = label(sub, { size: 0.22, background: 'rgba(8,12,20,0.7)' });
    note.position.y = 0.05;
    note.position.x = 0.9;
    g.add(tag, note);
    scene.add(g);
    return g;
  };
  const vA = vertex('A', 'полюс мира', 0xffffff);
  const vB = vertex('B', 'звезда', 0xffffff);
  const vC = vertex('C', 'зенит', 0xffffff);

  const sideTags = { a: label('a', { size: 0.36, color: '#ffc34d', background: null }), b: label('b', { size: 0.36, color: '#5cc2b5', background: null }), c: label('c', { size: 0.36, color: '#e0786a', background: null }) };
  Object.values(sideTags).forEach((s) => scene.add(s));

  const panel = label('sin a / sin A = 0,000\nsin b / sin B = 0,000\nsin c / sin C = 0,000', {
    size: 0.36, color: '#fff3d0', background: 'rgba(8,12,20,0.82)', template: 'sin a / sin A = 0,0000 \nsin b / sin B = 0,0000 \nsin c / sin C = 0,0000 ',
  });
  scene.add(panel);
  const title = captions([
    [0, 'Небесная сфера'],
    [0.12, 'Треугольник на сфере: вершины — полюс, звезда, зенит'],
    [0.22, 'Стороны — это дуги больших кругов'],
    [0.34, 'Теорема синусов Абу Насра Мансура'],
    [0.78, 'Вершина движется — отношения остаются равными'],
  ], 0.38);
  scene.add(title.sprite);

  const angleAt = (P, Q, S) => {
    const n1 = P.clone().cross(Q).normalize();
    const n2 = P.clone().cross(S).normalize();
    return Math.acos(clamp(n1.dot(n2), -1, 1));
  };
  const fmt = (x) => x.toFixed(3).replace('.', ',');
  let lastText = '';

  return {
    scene,
    camera,
    update({ t, p }) {
      title.update(p);
      fade(sphere, 0.35 * stage(p, 0, 0.1));
      fade(grid, 0.35 * stage(p, 0.02, 0.12));
      // The third vertex travels once the theorem is on screen.
      const move = stage(p, 0.78, 0.98);
      // There and back: C0 → C1 → C0.
      C.copy(C0).lerp(C1, 0.5 - 0.5 * Math.cos(move * Math.PI * 2)).normalize();
      [[vA, A], [vB, B], [vC, C]].forEach(([g, v], i) => {
        g.position.copy(v).multiplyScalar(R * 1.01);
        fade(g, stage(p, 0.12 + i * 0.03, 0.17 + i * 0.03));
      });
      const draw = stage(p, 0.22, 0.32);
      setArc(arcs.c, A, B, draw);
      setArc(arcs.a, B, C, draw);
      setArc(arcs.b, C, A, draw);
      const mid = (u, v) => u.clone().add(v).normalize().multiplyScalar(R * 1.18);
      sideTags.a.position.copy(mid(B, C));
      sideTags.b.position.copy(mid(C, A));
      sideTags.c.position.copy(mid(A, B));
      Object.values(sideTags).forEach((s) => fade(s, stage(p, 0.3, 0.36)));

      const a = B.angleTo(C);
      const b = C.angleTo(A);
      const c = A.angleTo(B);
      const angA = angleAt(A, B, C);
      const angB = angleAt(B, C, A);
      const angC = angleAt(C, A, B);
      const text = `sin a / sin A = ${fmt(Math.sin(a) / Math.sin(angA))}\nsin b / sin B = ${fmt(Math.sin(b) / Math.sin(angB))}\nsin c / sin C = ${fmt(Math.sin(c) / Math.sin(angC))}`;
      if (text !== lastText) {
        panel.userData.set(text);
        lastText = text;
      }
      fade(panel, stage(p, 0.48, 0.55));
      panel.position.set(R * 1.55, -0.4, 0);
      title.sprite.position.set(0, R * 1.32, 0);
      orbit(camera, new THREE.Vector3(R * 0.35, 0.3, 0), fitDistance(camera, R * 1.65), lerp(0.35, 0.75, smooth(p)) + Math.sin(t * 0.1) * 0.05, 0.28);
    },
  };
}

/* ---------- Al-Jawhari: a dictionary ordered by the last letter ---------- */

export function rhymes() {
  const { scene, camera, sun } = warmStage();
  sun.position.set(-3, 8, 8);
  const motes = dust(200, [14, 8, 8], 0xffdca8, 13);
  scene.add(motes);
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.7 });

  // Chapters of the dictionary: the last letter of the root.
  const chapters = [['ب', 'ба'], ['ر', 'ра'], ['س', 'син'], ['ل', 'лям'], ['م', 'мим']].map(([letter, name], i) => {
    const g = new THREE.Group();
    g.position.set((i - 2) * 2.3, -1.6, -0.5);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 1.0), wood);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.6, 0.1), wood);
    back.position.set(0, 0.8, -0.45);
    const head = label(letter, { size: 0.8, color: '#ffe2a3', background: null });
    head.position.set(0, 2.15, -0.3);
    const tag = label(`глава «${name}»`, { size: 0.24, background: 'rgba(20,14,8,0.7)' });
    tag.position.set(0, -0.45, 0.3);
    g.add(shelf, back, head, tag);
    scene.add(g);
    return g;
  });

  // Roots, the letter that sorts them, and the chapter they go to.
  const words = [
    ['كتب', 'к-т-б · писать', 0],
    ['علم', 'ʿ-л-м · знать', 4],
    ['شعر', 'ш-ʿ-р · стих', 1],
    ['قمر', 'к-м-р · луна', 1],
    ['جمل', 'дж-м-л · красота', 3],
    ['درس', 'д-р-с · учить', 2],
  ].map(([root, gloss, chapter], i) => {
    const g = new THREE.Group();
    const card = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.0, 0.06), new THREE.MeshStandardMaterial({ map: parchment(), color: 0xd7c296, roughness: 1 }));
    const word = label(root, { size: 0.62, color: '#2a1a0c', background: null });
    word.position.z = 0.06;
    word.position.y = 0.12;
    const note = label(gloss, { size: 0.2, color: '#3b2410', background: null });
    note.position.set(0, -0.3, 0.06);
    const spark = glow(0xffc34d, 0.7, 0);
    // In Arabic the last letter is on the left.
    spark.position.set(-0.45, 0.12, 0.12);
    g.add(card, word, note, spark);
    g.userData = { chapter, spark, index: i };
    scene.add(g);
    return g;
  });
  const used = new Map();
  words.forEach((w) => {
    const n = used.get(w.userData.chapter) ?? 0;
    w.userData.stack = n;
    used.set(w.userData.chapter, n + 1);
  });

  const rhyme = label('рифма: шиʿр — камар', { size: 0.34, color: '#ffe2a3', background: 'rgba(20,14,8,0.8)' });
  scene.add(rhyme);
  const title = captions([
    [0, '«ас-Сихах» · около 40 000 статей'],
    [0.23, 'Корень — три согласных'],
    [0.39, 'Слова идут по последней букве корня'],
    [0.68, 'Поэт быстро находит рифму'],
    [0.87, 'Порядок, ставший образцом на века'],
  ]);
  scene.add(title.sprite);

  return {
    scene,
    camera,
    update({ t, p }) {
      motes.userData.update(t);
      title.update(p);
      chapters.forEach((c, i) => fade(c, stage(p, 0.04 + i * 0.02, 0.12 + i * 0.02)));
      words.forEach((w, i) => {
        // Each card appears, its last letter lights up, then it flies to its chapter.
        const start = 0.42 + i * 0.045;
        const appear = stage(p, start, start + 0.04);
        const light = stage(p, start + 0.03, start + 0.06);
        const fly = stage(p, start + 0.06, start + 0.12);
        fade(w, appear);
        w.userData.spark.material.opacity = light * (1 - fly) * (0.7 + 0.3 * Math.sin(t * 8));
        const ch = chapters[w.userData.chapter].position;
        const from = new THREE.Vector3(0, 1.4, 1.6);
        const to = new THREE.Vector3(ch.x, ch.y + 0.65 + w.userData.stack * 0.55, ch.z + 0.15 + w.userData.stack * 0.05);
        w.position.copy(from).lerp(to, fly);
        w.position.y += Math.sin(fly * Math.PI) * 1.2;
        w.scale.setScalar(lerp(1.2, 0.78, fly));
      });
      const r = chapters[1].position;
      rhyme.position.set(r.x, r.y + 2.9, r.z + 0.6);
      fade(rhyme, stage(p, 0.68, 0.73));
      title.sprite.position.set(0, 3.6, 0);
      camera.position.set(Math.sin(t * 0.07) * 1.2, 1.4, fitDistance(camera, 5.4));
      camera.lookAt(0, 0.3, 0);
    },
  };
}

/* ---------- Al-Jawhari's wooden wings: why they could not hold him ---------- */

export function wings({ params = {} } = {}) {
  const { scene, camera, sun } = createStage({ background: 0x2a3a52, ambient: 0.7, sun: 1.3, fog: [30, 70] });
  sun.position.set(6, 10, 6);
  const stone = matte(0xc2a67c);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 4), stone);
  roof.position.set(-3, -3, 0);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), matte(0x5aa6a0));
  dome.position.set(-4, 0, 0);
  scene.add(roof, dome);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), matte(0x6b5a40));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -6;
  scene.add(ground);

  // Al-Jawhari with two wooden panels tied to his arms.
  const jawhari = createFigure(params.who ?? 'al-jawhari');
  const man = jawhari.root;
  man.scale.setScalar(0.75);
  const board = new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 0.8 });
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.5), board);
  const wingR = wingL.clone();
  wingL.position.set(-0.75, 1.3, 0);
  wingR.position.set(0.75, 1.3, 0);
  man.add(wingL, wingR);
  man.position.set(-1, 0, 0);
  scene.add(man);

  const arrow = (color, text) => {
    const g = new THREE.Group();
    const mat = shine(color, 1.4);
    const shaft = rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 0.06, mat);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.35, 16), mat);
    g.add(shaft, tip);
    const tag = label(text, { size: 0.4, background: 'rgba(10,14,22,0.8)' });
    g.add(tag);
    g.userData = { shaft, tip, tag };
    scene.add(g);
    return g;
  };
  const weight = arrow(0xe0605a, 'вес');
  const lift = arrow(0x6fc2ff, 'подъёмная сила');
  const setArrow = (g, from, length) => {
    const { shaft, tip, tag } = g.userData;
    const dirY = Math.sign(length) || 1;
    const end = from.clone().add(new THREE.Vector3(0, length, 0));
    shaft.position.set(0, 0, 0);
    g.position.copy(from);
    shaft.scale.y = Math.abs(length);
    shaft.position.y = (length) / 2;
    shaft.rotation.z = 0;
    tip.position.set(0, length + dirY * 0.15, 0);
    tip.rotation.z = dirY > 0 ? 0 : Math.PI;
    tag.position.set(0.9, length / 2, 0);
    return end;
  };

  // For comparison: a hang glider wing, about ten metres across.
  const glider = new THREE.Group();
  const sail = new THREE.Shape();
  sail.moveTo(0, 1.6);
  sail.lineTo(-5, -0.6);
  sail.lineTo(0, -0.1);
  sail.lineTo(5, -0.6);
  sail.closePath();
  const sailMesh = new THREE.Mesh(new THREE.ShapeGeometry(sail), new THREE.MeshStandardMaterial({ color: 0xe8b04a, side: THREE.DoubleSide, roughness: 0.6 }));
  sailMesh.rotation.x = -Math.PI / 2.4;
  glider.add(sailMesh);
  const gliderTag = label('крыло дельтаплана: размах около 10 м', { size: 0.34, background: 'rgba(10,14,22,0.8)' });
  gliderTag.position.set(0, 1.5, 0);
  const boardTag = label('деревянные створки: около метра', { size: 0.3, background: 'rgba(10,14,22,0.8)' });
  glider.add(gliderTag);
  glider.position.set(4.5, 2.2, -2);
  scene.add(glider, boardTag);

  const title = captions([
    [0, 'Предание: крыша мечети в Нишапуре'],
    [0.5, 'Вес тянет вниз, крылья дают подъёмную силу'],
    [0.6, 'Маленькие крылья держат намного меньше веса'],
    [0.79, 'Чтобы удержать человека, нужно огромное крыло'],
  ], 0.4);
  scene.add(title.sprite);

  return {
    scene,
    camera,
    ownFigure: true,
    update({ t, dt, p }) {
      title.update(p);
      // Stands on the roof, jumps, and drops away below the edge.
      const jump = stage(p, 0.36, 0.42);
      const fall = stage(p, 0.68, 0.8);
      const x = lerp(-1, 1.2, jump);
      const y = Math.sin(jump * Math.PI) * 0.6 - fall * fall * 9;
      man.position.set(x, y, 0);
      man.rotation.z = -fall * 0.6;
      const flap = Math.sin(t * 10) * 0.35 * jump * (1 - fall);
      wingL.rotation.z = flap;
      wingR.rotation.z = -flap;
      jawhari.set({ walk: 0, left: 'gesture', right: 'gesture' });
      jawhari.update(t, dt);
      fade(man, 1 - stage(p, 0.74, 0.8));
      const forces = stage(p, 0.5, 0.56) * (1 - stage(p, 0.68, 0.72));
      const center = man.position.clone().add(new THREE.Vector3(0, 0.6, 0.4));
      setArrow(weight, center, -2.6);
      setArrow(lift, center.clone().add(new THREE.Vector3(0, 0.6, 0)), 0.55 + 0.05 * Math.sin(t * 4));
      fade(weight, forces);
      fade(lift, forces);
      const compare = stage(p, 0.8, 0.88);
      fade(glider, compare);
      boardTag.position.set(1.2, 1.8, 0.6);
      fade(boardTag, compare);
      if (compare > 0) {
        // Show the small boards next to the big wing.
        man.position.set(1.2, 0, 0);
        man.rotation.z = 0;
        fade(man, compare);
        wingL.rotation.z = 0;
        wingR.rotation.z = 0;
      }
      title.sprite.position.set(1, 4.2, 0);
      camera.position.set(lerp(2, 3.5, smooth(p)) + Math.sin(t * 0.1), 1.4, fitDistance(camera, compare > 0 ? 6.4 : 4.4));
      camera.lookAt(1.2, 0.4, 0);
    },
  };
}
