// Discoveries of the people of Central Asia closer to our time: Navoi's
// «Judgement of the two languages», how Kanysh Satbayev found the copper of
// Zhezkazgan by drilling, and Chingiz Aitmatov's books going round the world.
import {
  THREE, COLORS, createStage, fitDistance, orbit, metal, matte, shine, glow, label, fade, dust, rod, tube,
  revealTube, starfield, rng, stage, smooth, lerp, clamp,
} from '../kit.js';
import { worldTexture, spherePosition } from '../geo.js';

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

// Lines of handwriting in Arabic script, drawn freely: the words on the tiles.
function scriptTexture(seed, ink = '#3a2410', paper = '#e9d3a2') {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = paper;
  g.fillRect(0, 0, 128, 96);
  const rand = rng(seed);
  g.strokeStyle = ink;
  g.lineCap = 'round';
  for (let line = 0; line < 2; line++) {
    const y = 34 + line * 30;
    let x = 112;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(x, y);
    while (x > 18) {
      const step = 8 + rand() * 14;
      g.quadraticCurveTo(x - step / 2, y - 4 - rand() * 14, x - step, y + (rand() - 0.5) * 4);
      x -= step;
    }
    g.stroke();
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(20 + rand() * 90, y - 14 - rand() * 6, 2.2, 0, Math.PI * 2);
      g.fillStyle = ink;
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------- Alisher Navoi: two languages on the scales ---------- */

export function navoiScales() {
  const { scene, camera, sun } = createStage({ background: 0x1a120a, ambient: 0.45, sun: 1.2 });
  sun.position.set(4, 9, 7);
  const lamp = new THREE.PointLight(0xffc27a, 22, 30, 2);
  lamp.position.set(-1, 4.5, 4);
  scene.add(lamp);
  const motes = dust(220, [12, 7, 8], 0xffdca8, 21);
  scene.add(motes);

  // A carved wooden table under the scales.
  const table = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 4), matte(0x4a2c18, 0.7));
  table.position.y = -0.15;
  table.receiveShadow = true;
  scene.add(table);

  const brass = metal(0xc9a256, 0.3, 0.9);
  const darkBrass = metal(0x8a6a32, 0.45, 0.85);
  const scales = new THREE.Group();
  scene.add(scales);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.25, 48), darkBrass);
  base.position.y = 0.12;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 3.6, 24), brass);
  pillar.position.y = 2.05;
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), brass);
  finial.position.y = 4.05;
  scales.add(base, pillar, finial);
  for (const m of [base, pillar, finial]) m.castShadow = true;

  const PIVOT = new THREE.Vector3(0, 3.75, 0);
  const ARM = 2.4;
  const beam = new THREE.Group();
  beam.position.copy(PIVOT);
  scales.add(beam);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, ARM * 2, 16), brass);
  bar.rotation.z = Math.PI / 2;
  bar.castShadow = true;
  const needle = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 12), brass);
  needle.position.y = 0.3;
  beam.add(bar, needle);
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), brass);
    tip.position.x = s * ARM;
    beam.add(tip);
  }

  // The pans hang from the ends of the beam on three chains each.
  const CHAIN = 2.0;
  const makePan = (color) => {
    const pan = new THREE.Group();
    const profile = [new THREE.Vector2(0, 0), new THREE.Vector2(0.75, 0.02), new THREE.Vector2(0.85, 0.18), new THREE.Vector2(0.88, 0.2)];
    const dish = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), new THREE.MeshStandardMaterial({ color: 0xc9a256, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }));
    dish.castShadow = true;
    pan.add(dish);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      pan.add(rod(new THREE.Vector3(Math.cos(a) * 0.82, 0.2, Math.sin(a) * 0.82), new THREE.Vector3(0, CHAIN, 0), 0.012, darkBrass));
    }
    const pile = new THREE.Group();
    pan.add(pile);
    pan.userData = { pile, color };
    scales.add(pan);
    return pan;
  };
  const persian = makePan(0x3b5c8a);
  const turkic = makePan(0x9a3b22);

  // Tiles with words: the Persian ones lie on their pan from the start,
  // the hundred Turkic verbs fall onto the other pan one by one.
  const tileGeo = new THREE.BoxGeometry(0.2, 0.05, 0.15);
  const tile = (color, seed) => {
    const side = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const top = new THREE.MeshStandardMaterial({ map: scriptTexture(seed), roughness: 0.7 });
    const m = new THREE.Mesh(tileGeo, [side, side, top, side, side, side]);
    m.castShadow = true;
    return m;
  };
  const slot = (i, rand) => {
    const layer = Math.floor(i / 12);
    const k = i % 12;
    const ring = k < 4 ? 0.16 : 0.45;
    const a = (k < 4 ? k / 4 : (k - 4) / 8) * Math.PI * 2 + layer * 0.4;
    return { x: Math.cos(a) * ring, y: 0.05 + layer * 0.052, z: Math.sin(a) * ring, r: rand() * Math.PI };
  };
  const rand = rng(41);
  const PERSIAN = 100;
  for (let i = 0; i < PERSIAN; i++) {
    const s = slot(i, rand);
    const m = tile(0x3b5c8a, i + 7);
    m.position.set(s.x, s.y, s.z);
    m.rotation.y = s.r;
    persian.userData.pile.add(m);
  }
  const falling = [];
  for (let i = 0; i < 100; i++) {
    const s = slot(i, rand);
    const m = tile(0xb0502a, i + 300);
    m.rotation.y = s.r;
    m.visible = false;
    turkic.userData.pile.add(m);
    falling.push({ m, s });
  }

  const tagP = label('персидский', { size: 0.34, background: 'rgba(10,14,22,0.75)' });
  const tagT = label('тюркский', { size: 0.34, background: 'rgba(10,14,22,0.75)' });
  scene.add(tagP, tagT);
  const counter = label('0 глаголов', { size: 0.42, color: '#ffd9a0', background: 'rgba(10,14,22,0.8)', template: '100 глаголов' });
  scene.add(counter);
  const balance = glow(0xffd27a, 3.2, 0.0);
  balance.position.copy(PIVOT);
  scene.add(balance);

  const title = captions([
    [0, '1499 · «Суждение о двух языках»'],
    [0.16, 'Великие стихи писали по-персидски'],
    [0.34, 'Тюркские глаголы без персидской пары'],
    [0.8, 'Тюркский язык не беднее персидского'],
  ], 0.4);
  scene.add(title.sprite);
  title.sprite.position.set(0, 5.6, 0);

  const end = new THREE.Vector3();
  return {
    scene,
    camera,
    update({ t, p }) {
      title.update(p);
      motes.userData.update?.(t);
      // How many verbs lie on the Turkic pan.
      const count = Math.round(clamp((p - 0.36) / 0.4) * 100);
      // Heavier side goes down; at first only the Persian words lie on the scales.
      const tilt = 0.24 * (1 - count / 100) + Math.sin(t * 1.3) * 0.006;
      // When the pans are even, the beam rocks a little and settles.
      const settle = count >= 100 ? Math.sin((p - 0.76) * 40) * Math.exp(-(p - 0.76) * 25) * 0.05 : 0;
      beam.rotation.z = tilt + settle;
      beam.updateMatrix();
      for (const [pan, s] of [[persian, -1], [turkic, 1]]) {
        end.set(s * ARM, 0, 0).applyMatrix4(beam.matrix);
        pan.position.set(end.x, end.y - CHAIN, end.z);
      }
      falling.forEach(({ m, s }, i) => {
        const at = 0.36 + (i / 100) * 0.4;
        const u = clamp((p - at) / 0.025);
        m.visible = p >= at;
        m.position.set(s.x, s.y + (1 - u * u) * 2.4, s.z);
      });
      tagP.position.copy(persian.position).add(new THREE.Vector3(0, -0.45, 1));
      tagT.position.copy(turkic.position).add(new THREE.Vector3(0, -0.45, 1));
      fade(tagP, stage(p, 0.05, 0.12));
      fade(tagT, stage(p, 0.05, 0.12));
      counter.userData.set(`${count} ${count % 10 === 1 && count % 100 !== 11 ? 'глагол' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'глагола' : 'глаголов'}`);
      counter.position.copy(turkic.position).add(new THREE.Vector3(0, 2.9, 0));
      fade(counter, stage(p, 0.34, 0.4));
      balance.material.opacity = stage(p, 0.76, 0.84) * (0.55 + 0.15 * Math.sin(t * 3));
      // The scales stand a little right of the middle: the poet is on the left.
      orbit(camera, new THREE.Vector3(-0.9, 2.5, 0), fitDistance(camera, lerp(3.5, 3.9, smooth(p))), lerp(-0.18, 0.12, smooth(p)), lerp(0.14, 0.08, p));
    },
  };
}

/* ---------- Kanysh Satbayev: copper under the steppe ---------- */

export function ore() {
  const { scene, camera, sun } = createStage({ background: 0x2c3442, ambient: 0.7, sun: 1.6 });
  sun.position.set(-6, 12, 9);
  const W = 14;
  const D = 6;
  // Layers of the ground, top to bottom: [thickness, colour, name].
  const LAYERS = [
    [0.35, 0xb59a6a, 'почва и глина'],
    [1.1, 0xa0563a, 'красные песчаники'],
    [1.8, 0x7c7f80, 'серые песчаники'],
    [1.4, 0x55504a, 'коренные породы'],
  ];
  const ground = new THREE.Group();
  scene.add(ground);
  const layerMats = [];
  let y = 0;
  const tops = [];
  for (const [h, color] of LAYERS) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.95, transparent: true, opacity: 1 });
    layerMats.push(m);
    const box = new THREE.Mesh(new THREE.BoxGeometry(W, h, D), m);
    box.position.y = y - h / 2;
    box.receiveShadow = true;
    ground.add(box);
    tops.push(y);
    y -= h;
  }
  const bottom = y;
  // Steppe grass on top.
  const grass = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, D), matte(0x8f8a4a));
  grass.position.y = 0.03;
  ground.add(grass);
  const rand = rng(9);
  for (let i = 0; i < 160; i++) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18 + rand() * 0.15, 5), matte(0x9c9450));
    tuft.position.set((rand() - 0.5) * (W - 0.4), 0.12, (rand() - 0.5) * (D - 0.4));
    ground.add(tuft);
  }

  // The copper: lenses in the grey sandstone, deep under the surface.
  const oreMat = new THREE.MeshStandardMaterial({ color: 0x3fae8a, emissive: 0x1f7a5a, emissiveIntensity: 0.0, roughness: 0.45, metalness: 0.3, transparent: true, opacity: 0 });
  const oreBody = new THREE.Group();
  ground.add(oreBody);
  const lenses = [
    [-3.6, -2.3, 2.6, 0.32], [-0.8, -2.6, 3.4, 0.4], [2.4, -2.45, 3.0, 0.36], [4.9, -2.9, 1.8, 0.28], [0.8, -3.4, 2.6, 0.26], [-2.4, -3.3, 2.0, 0.24],
  ];
  for (const [x, yy, w, h] of lenses) {
    const lens = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), oreMat);
    lens.scale.set(w / 2, h, Math.min(D * 0.42, w * 0.6));
    lens.position.set(x, yy, 0);
    oreBody.add(lens);
  }
  const oreDepth = (x) => {
    for (const [cx, cy, w, h] of lenses) {
      const u = (x - cx) / (w / 2);
      if (Math.abs(u) < 1) return [cy + h * Math.sqrt(1 - u * u), cy - h * Math.sqrt(1 - u * u)];
    }
    return null;
  };
  // Old pits on the surface: green stains, where copper was mined long ago.
  const pits = new THREE.Group();
  for (const x of [-4.5, -3.2, 1.8]) {
    const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.25, 0.12, 20), matte(0x4f8a64));
    pit.position.set(x, 0.05, 0.8);
    pits.add(pit);
  }
  ground.add(pits);

  // The drilling rig: a lattice tower on the surface.
  const rig = new THREE.Group();
  const steel = metal(0x9a8c78, 0.5, 0.6);
  const legs = [[-0.45, -0.45], [0.45, -0.45], [0.45, 0.45], [-0.45, 0.45]];
  for (const [x, z] of legs) rig.add(rod(new THREE.Vector3(x, 0, z), new THREE.Vector3(0, 2.6, 0), 0.03, steel));
  for (let k = 1; k <= 3; k++) {
    const h = k * 0.6;
    const s = 0.45 * (1 - h / 2.6);
    for (let i = 0; i < 4; i++) {
      const [ax, az] = legs[i];
      const [bx, bz] = legs[(i + 1) % 4];
      rig.add(rod(new THREE.Vector3(ax * (s / 0.45), h, az * (s / 0.45)), new THREE.Vector3(bx * (s / 0.45), h, bz * (s / 0.45)), 0.018, steel));
    }
  }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.5), matte(0x6a4a2a));
  cabin.position.set(0.8, 0.22, 0);
  rig.add(cabin);
  rig.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  scene.add(rig);

  // Boreholes along the front face of the cut, with the core beside each.
  const HOLES = [-4.2, -2.2, -0.3, 1.6, 3.4, 5.4];
  const FRONT = D / 2 + 0.02;
  const holes = HOLES.map((x) => {
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 10), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    hole.position.set(x, 0, FRONT);
    hole.visible = false;
    ground.add(hole);
    const hit = oreDepth(x);
    const mark = hit ? new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, hit[0] - hit[1], 12), shine(0x4fe0a8, 1.6)) : null;
    if (mark) {
      mark.position.set(x, (hit[0] + hit[1]) / 2, FRONT + 0.02);
      mark.visible = false;
      ground.add(mark);
    }
    const tag = hit ? label('медь', { size: 0.3, color: '#bfffe6', background: 'rgba(10,30,24,0.8)' }) : null;
    if (tag) {
      tag.position.set(x + 0.55, hit[0] + 0.2, FRONT + 0.1);
      fade(tag, 0);
      ground.add(tag);
    }
    return { x, hole, mark, tag, hit };
  });
  const DEPTH = bottom + 0.3;

  const layerTags = LAYERS.map(([h, , name], i) => {
    const t = label(name, { size: 0.36, background: 'rgba(10,14,22,0.7)' });
    t.position.set(-W / 2 - 1.7, tops[i] - h / 2, FRONT);
    scene.add(t);
    return t;
  });
  const counter = label('скважин: 0', { size: 0.36, color: '#ffe2a3', background: 'rgba(10,14,22,0.8)', template: 'скважин: 66' });
  counter.position.set(W / 2 - 1.2, 1.6, FRONT);
  scene.add(counter);
  const title = captions([
    [0, 'Жезказган: старые копи у поверхности'],
    [0.16, 'Сатпаев: бурить глубже'],
    [0.3, 'Скважина за скважиной — медная руда'],
    [0.74, 'Под степью — огромное рудное тело'],
    [0.88, 'Одно из крупнейших месторождений меди в мире'],
  ], 0.4);
  scene.add(title.sprite);
  title.sprite.position.set(0, 3.2, 0);

  return {
    scene,
    camera,
    update({ t, p }) {
      title.update(p);
      layerTags.forEach((tg, i) => fade(tg, stage(p, 0.04 + i * 0.02, 0.1 + i * 0.02) * (1 - stage(p, 0.72, 0.76))));
      // Each hole: the rig moves over, drills down, the core comes up.
      const span = 0.56 / HOLES.length;
      let drilled = 0;
      let rigX = HOLES[0];
      holes.forEach((h, i) => {
        const at = 0.16 + i * span;
        const move = stage(p, at, at + span * 0.25);
        const drill = clamp((p - at - span * 0.25) / (span * 0.6));
        if (p >= at) rigX = lerp(i ? HOLES[i - 1] : HOLES[0] - 1.5, h.x, move);
        const depth = drill * DEPTH;
        h.hole.visible = drill > 0;
        h.hole.scale.y = Math.max(0.001, -depth);
        h.hole.position.y = depth / 2;
        if (drill >= 1) drilled += 1;
        if (h.mark) {
          const reached = drill > 0 && depth <= h.hit[1];
          h.mark.visible = reached;
          if (h.tag) fade(h.tag, reached ? 1 - stage(p, 0.86, 0.9) : 0);
        }
      });
      // Many more holes followed: the counter runs on after the six we see.
      const shown = drilled + Math.round(stage(p, 0.72, 0.86) * 60);
      counter.userData.set(`скважин: ${shown}`);
      fade(counter, stage(p, 0.18, 0.24));
      rig.position.set(rigX, 0.06, FRONT - 0.5);
      rig.rotation.y = Math.sin(t * 8) * 0.004 * (p > 0.16 && p < 0.72 ? 1 : 0);
      // In the end the ground turns see-through and the whole ore body shows.
      const reveal = stage(p, 0.72, 0.84);
      layerMats.forEach((m, i) => {
        m.opacity = 1 - reveal * (i === 0 ? 0.4 : 0.72);
        m.depthWrite = reveal < 0.5;
      });
      oreMat.opacity = reveal;
      oreMat.emissiveIntensity = reveal * (0.6 + 0.25 * Math.sin(t * 2.5));
      const wide = stage(p, 0.7, 0.9);
      orbit(camera, new THREE.Vector3(0.4, -1.4, 0), fitDistance(camera, lerp(6.6, 7.6, wide)), lerp(-0.12, 0.45, smooth(p)), lerp(0.18, 0.32, wide));
    },
  };
}

/* ---------- Chingiz Aitmatov: the books go round the world ---------- */

const TALAS = [72.24, 42.52];
const TRANSLATIONS = [
  ['русский', 37.6, 55.75],
  ['французский', 2.35, 48.86],
  ['немецкий', 13.4, 52.52],
  ['японский', 139.7, 35.68],
  ['английский', -74.0, 40.71],
  ['китайский', 116.4, 39.9],
  ['испанский', -3.7, 40.42],
  ['арабский', 31.24, 30.04],
  ['турецкий', 28.98, 41.0],
  ['хинди', 77.2, 28.61],
  ['персидский', 51.39, 35.69],
  ['корейский', 126.98, 37.57],
  ['испанский · Аргентина', -58.38, -34.6],
  ['португальский', -46.63, -23.55],
];

export function translations() {
  const { scene, camera, sun } = createStage({ background: 0x04070d, ambient: 0.4, sun: 2.3 });
  sun.position.set(-6, 3, 8);
  scene.add(starfield(2400, 300, 31));
  const R = 2.4;
  const world = new THREE.Group();
  scene.add(world);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ map: worldTexture(), roughness: 0.85 }));
  world.add(ball, glow(0x6fb7ff, R * 2.6, 0.2));

  const home = spherePosition(TALAS[0], TALAS[1], R * 1.005);
  const homePin = new THREE.Group();
  homePin.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), shine(0xffd27a, 2)), glow(0xffc070, 0.7, 1));
  homePin.position.copy(home);
  world.add(homePin);
  const homeTag = label('Таласская долина', { size: 0.2, background: 'rgba(10,14,22,0.75)' });
  world.add(homeTag);
  homeTag.position.copy(spherePosition(TALAS[0], TALAS[1], R * 1.22));

  // An arc over the surface from Talas to each place, and the language.
  const arcs = TRANSLATIONS.map(([lang, lon, lat], i) => {
    const to = spherePosition(lon, lat, R);
    const a = home.clone().normalize();
    const b = to.clone().normalize();
    const angle = a.angleTo(b);
    const points = [];
    for (let k = 0; k <= 48; k++) {
      const u = k / 48;
      const v = new THREE.Vector3().copy(a).multiplyScalar(Math.sin((1 - u) * angle)).addScaledVector(b, Math.sin(u * angle)).divideScalar(Math.sin(angle));
      points.push(v.multiplyScalar(R * (1.01 + Math.sin(Math.PI * u) * angle * 0.16)));
    }
    const mesh = tube(points, 0.012, shine(i < 5 ? 0xffd27a : 0xffb46a, 1.4), 96);
    revealTube(mesh, 0);
    world.add(mesh);
    const dot = glow(0xffe2a3, 0.28, 0);
    dot.position.copy(spherePosition(lon, lat, R * 1.01));
    world.add(dot);
    const tag = label(lang, { size: 0.17, background: 'rgba(10,14,22,0.72)' });
    tag.position.copy(spherePosition(lon, lat, R * 1.14));
    world.add(tag);
    fade(tag, 0);
    return { mesh, dot, tag, at: i < 5 ? [0.3, 0.37, 0.44, 0.54, 0.64][i] : 0.72 + (i - 5) * 0.022 };
  });

  const counter = label('1 язык', { size: 0.5, color: '#ffe2a3', background: 'rgba(10,14,22,0.8)', template: 'более 150 языков' });
  scene.add(counter);
  const title = captions([
    [0, 'Книги Айтматова'],
    [0.08, 'переведены более чем на 150 языков'],
    [0.3, 'Из Таласской долины — в Москву и Париж'],
    [0.52, 'в Берлин, Токио и Нью-Йорк'],
  ], 0.34);
  scene.add(title.sprite);

  // Which way the globe faces through the film: Talas, Europe, Asia, across
  // the Pacific to America, and on round.
  const KEYS = [[0, 80], [0.28, 55], [0.38, 30], [0.47, 18], [0.56, 105], [0.68, 300], [1, 400]];
  const lonAt = (p) => {
    const i = Math.max(0, KEYS.findIndex(([at]) => at > p) - 1);
    const [a, la] = KEYS[i];
    const [b, lb] = KEYS[Math.min(i + 1, KEYS.length - 1)];
    return b === a ? la : lerp(la, lb, smooth(clamp((p - a) / (b - a))));
  };
  const camDir = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  // The globe turns so that Talas, then Europe, then Asia and America come round.
  const facing = (lon) => -Math.atan2(...(() => {
    const v = spherePosition(lon, 20, 1);
    return [v.x, v.z];
  })());
  return {
    scene,
    camera,
    update({ t, p }) {
      title.update(p);
      world.rotation.y = facing(lonAt(p));
      world.rotation.x = 0.28;
      world.updateMatrixWorld();
      camera.getWorldDirection(camDir);
      arcs.forEach(({ mesh, dot, tag, at }) => {
        const u = stage(p, at, at + 0.07);
        revealTube(mesh, u);
        dot.material.opacity = u >= 1 ? 0.9 : 0;
        // Labels on the far side of the globe are hidden.
        tag.getWorldPosition(tmp);
        const front = -tmp.clone().normalize().dot(camDir) > -0.05 ? 1 : 0;
        fade(tag, stage(p, at + 0.05, at + 0.09) * front);
      });
      homeTag.getWorldPosition(tmp);
      fade(homeTag, stage(p, 0.04, 0.1) * (1 - stage(p, 0.3, 0.36)));
      homePin.scale.setScalar(1 + 0.25 * Math.sin(t * 4));
      const n = Math.round(lerp(1, 150, stage(p, 0.12, 0.9) ** 1.6));
      counter.userData.set(p > 0.9 ? 'более 150 языков' : `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'язык' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'языка' : 'языков'}`);
      const d = fitDistance(camera, 3.4);
      camera.position.set(Math.sin(t * 0.05) * 0.4, 0.5, d);
      camera.lookAt(0, 0, 0);
      const hh = d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      // Beside the globe on a wide screen, under the caption on a phone.
      if (camera.aspect > 1.1) counter.position.set(hh * camera.aspect * 0.62, 0, 0);
      else counter.position.set(0, hh * 0.64, 0);
      title.sprite.position.set(0, hh * 0.8, 0);
      fade(counter, stage(p, 0.08, 0.14));
    },
  };
}
