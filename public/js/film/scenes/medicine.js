// Laboratories of the physicians, at the desk of the House of Wisdom:
//  · distill  — ar-Razi distils a liquid: heat, bubbles, vapour, drops;
//               and his three kinds of substances;
//  · surgery  — az-Zahrawi's instruments from «at-Tasrif», about two hundred
//               of them, each drawn in the book; catgut for inner stitches;
//  · pharmacy — Ibn Sina's five volumes of the «Canon» and the vast
//               «Book of Healing» with its sciences.
import { THREE, label, fade, rod, tube, revealTube, stage, smooth, lerp, clamp, glow, fitDistance, rng, SERIF, dust } from '../kit.js';
import { parchment, parchmentMaps, brass, book } from '../materials.js';
import { study, studyStage, shadowed } from './khwarizmi.js';

function hud(camera, steps) {
  const longest = steps.reduce((a, s) => (s[1].length > a.length ? s[1] : a), '');
  const widest = steps.reduce((a, s) => (s[2].length > a.length ? s[2] : a), '');
  const caption = label(steps[0][1], { size: 0.06, template: longest, background: 'rgba(14,9,5,0.66)' });
  const formula = label(steps[0][2], { size: 0.085, family: SERIF, weight: 700, color: '#ffe2a3', background: 'rgba(14,9,5,0.72)', template: widest });
  camera.add(caption, formula);
  return (p) => {
    const step = steps.filter(([s]) => p >= s).at(-1);
    caption.userData.set(step[1]);
    formula.userData.set(step[2]);
    const hh = 3 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const shift = camera.view?.enabled ? (2 * camera.view.offsetY) / camera.view.fullHeight : 0;
    caption.position.set(0, (0.86 - shift) * hh, -3);
    formula.position.set(0, (0.7 - shift) * hh, -3);
  };
}

// Places the camera on an orbit around a target; the presenter stands on the left.
function aim(camera, target, radius, az, el, presenterLeft = true) {
  const r = fitDistance(camera, radius) * 0.82;
  camera.position.set(target.x + r * Math.cos(el) * Math.sin(az), target.y + r * Math.sin(el), target.z + r * Math.cos(el) * Math.cos(az));
  camera.lookAt(target);
  if (camera.aspect > 1.1) {
    camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const hw = r * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    camera.position.addScaledVector(right, (presenterLeft ? -1 : 1) * hw * 0.14);
  }
}

const glass = (tint = 0xffffff) =>
  new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.04, metalness: 0, transmission: 1, thickness: 0.25, ior: 1.45, transparent: true, opacity: 1, envMapIntensity: 1.2, side: THREE.DoubleSide });

function lathe(points, material, segments = 48) {
  return new THREE.Mesh(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments), material);
}

/* ---------- ar-Razi: distillation ---------- */

function distill({ scene, camera, lamp, motes }) {
  const base = new THREE.Vector3(0.6, 0, 0.3);
  const rand = rng(8);
  // Brazier with coals.
  const brazier = new THREE.Group();
  brazier.position.copy(base);
  scene.add(brazier);
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.6, metalness: 0.6 });
  const bowl = shadowed(lathe([[0, 0], [0.95, 0], [1.05, 0.15], [0.95, 0.7], [1.0, 0.75], [0.0, 0.75]], iron));
  brazier.add(bowl);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), iron));
    leg.position.set(Math.cos(a) * 0.8, -0.1, Math.sin(a) * 0.8);
    brazier.add(leg);
  }
  brazier.position.y = 0.2;
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x1a0a05, emissive: 0xff4a12, emissiveIntensity: 0, roughness: 0.8, flatShading: true });
  const coals = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1 + rand() * 0.08, 0), coalMat);
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 0.75;
    c.position.set(Math.cos(a) * r, 0.78 + rand() * 0.06, Math.sin(a) * r);
    c.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    coals.add(c);
  }
  brazier.add(coals);
  const fire = new THREE.PointLight(0xff6a2a, 0, 8, 2);
  fire.position.set(0, 1.1, 0);
  brazier.add(fire);
  const fireGlow = glow(0xff6a2a, 2.6, 0);
  fireGlow.position.set(0, 1.0, 0);
  brazier.add(fireGlow);

  // The cucurbit (flask) with the liquid, the alembic head with its spout, the receiver.
  const flaskAt = base.clone().add(new THREE.Vector3(0, 1.0, 0));
  const flask = lathe([[0, 0], [0.45, 0.05], [0.7, 0.35], [0.72, 0.7], [0.55, 1.05], [0.28, 1.3], [0.24, 1.75], [0.27, 1.8]], glass(0xe8f4ff));
  flask.position.copy(flaskAt);
  scene.add(flask);
  const liquidMat = new THREE.MeshPhysicalMaterial({ color: 0x9a5a1a, roughness: 0.1, transmission: 0.6, thickness: 0.5, transparent: true, opacity: 0.9, emissive: 0x3a1a00, emissiveIntensity: 0.2 });
  const liquid = lathe([[0, 0.02], [0.43, 0.07], [0.66, 0.35], [0.68, 0.55], [0, 0.55]], liquidMat);
  liquid.position.copy(flaskAt);
  scene.add(liquid);
  const headAt = flaskAt.clone().add(new THREE.Vector3(0, 1.75, 0));
  const head = lathe([[0.26, 0], [0.5, 0.15], [0.62, 0.45], [0.52, 0.75], [0.25, 0.9], [0, 0.95]], glass(0xeaf6ff));
  head.position.copy(headAt);
  scene.add(head);
  const spoutPts = [headAt.clone().add(new THREE.Vector3(0.5, 0.35, 0)), headAt.clone().add(new THREE.Vector3(1.4, 0.0, 0.05)), headAt.clone().add(new THREE.Vector3(2.3, -0.8, 0.1)), headAt.clone().add(new THREE.Vector3(2.9, -1.7, 0.12))];
  const spoutCurve = new THREE.CatmullRomCurve3(spoutPts);
  const spout = new THREE.Mesh(new THREE.TubeGeometry(spoutCurve, 64, 0.075, 12, false), glass(0xeaf6ff));
  scene.add(spout);
  const recvAt = spoutPts[3].clone().add(new THREE.Vector3(0.25, -1.5, 0));
  recvAt.y = 0;
  const receiver = lathe([[0, 0], [0.4, 0.04], [0.55, 0.3], [0.5, 0.7], [0.22, 1.0], [0.2, 1.4], [0.24, 1.45]], glass(0xe8f4ff));
  receiver.position.copy(recvAt);
  scene.add(receiver);
  const distMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, roughness: 0.05, transmission: 0.5, thickness: 0.4, transparent: true, opacity: 0.85, emissive: 0x1a3550, emissiveIntensity: 0.3 });
  const distillate = lathe([[0, 0.02], [0.38, 0.06], [0.52, 0.3], [0.5, 0.6], [0, 0.6]], distMat);
  distillate.position.copy(recvAt);
  scene.add(distillate);
  const tags = [
    ['куб с жидкостью', flaskAt.clone().add(new THREE.Vector3(-1.25, 0.5, 0.3))],
    ['алембик', headAt.clone().add(new THREE.Vector3(-0.9, 0.7, 0.2))],
    ['приёмник', recvAt.clone().add(new THREE.Vector3(0.95, 1.2, 0.2))],
  ].map(([text, pos]) => {
    const t = label(text, { size: 0.26, family: SERIF, weight: 700, color: '#fbe7b5', background: 'rgba(20,12,6,0.62)' });
    t.position.copy(pos);
    scene.add(t);
    return t;
  });

  // Bubbles in the liquid, vapour in the head, drops along the spout.
  const bubbles = Array.from({ length: 40 }, () => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.03 + rand() * 0.03, 8, 6), new THREE.MeshPhysicalMaterial({ color: 0xfff2d8, roughness: 0, transmission: 0.8, transparent: true, opacity: 0.7 }));
    b.userData = { a: rand() * Math.PI * 2, r: rand() * 0.5, speed: 0.4 + rand() * 0.6, phase: rand() };
    scene.add(b);
    return b;
  });
  const steamTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const vapour = Array.from({ length: 26 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData = { phase: rand(), x: (rand() - 0.5) * 0.4, z: (rand() - 0.5) * 0.4, speed: 0.25 + rand() * 0.25 };
    scene.add(s);
    return s;
  });
  const drops = Array.from({ length: 8 }, (_, i) => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshStandardMaterial({ color: 0xbfe4ff, roughness: 0.1, emissive: 0x4a9ad0, emissiveIntensity: 1.2 }));
    d.userData.phase = i / 8;
    scene.add(d);
    return d;
  });

  // Three kinds of substances.
  const kinds = new THREE.Group();
  kinds.position.set(-1.6, 0, 3.0);
  scene.add(kinds);
  const dish = () => shadowed(lathe([[0, 0], [0.5, 0], [0.62, 0.12], [0.58, 0.14], [0.45, 0.05], [0, 0.05]], brass(0xb8893c, 0.35)));
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshPhysicalMaterial({ color: 0x7fb0ff, roughness: 0.05, transmission: 0.6, thickness: 0.6, ior: 1.6, emissive: 0x1a3060, emissiveIntensity: 0.4 }));
  crystal.scale.set(1, 1.4, 1);
  const leaves = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshStandardMaterial({ color: 0x4f8a2a, roughness: 0.6 }));
    leaf.scale.set(0.45, 0.08, 1);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.12, 0.08 + (i % 2) * 0.04, Math.sin(a) * 0.12);
    leaf.rotation.y = -a;
    leaves.add(leaf);
  }
  const shell = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xe8d2b0, roughness: 0.4, side: THREE.DoubleSide }));
  shell.rotation.z = Math.PI / 2.4;
  const items = [[crystal, 'минеральные', 0x7fb0ff], [leaves, 'растительные', 0x8fd06a], [shell, 'животные', 0xffd0a0]].map(([obj, name, color], i) => {
    const g = new THREE.Group();
    g.position.set(i * 1.6, 0, 0);
    g.add(dish());
    obj.position.y = 0.32;
    g.add(obj);
    const halo = glow(color, 1.4, 0);
    halo.position.y = 0.4;
    g.add(halo);
    const t = label(name, { size: 0.28, family: SERIF, weight: 700, color: '#fff1cf', background: 'rgba(20,12,6,0.66)' });
    t.position.set(0, 0.95, 0);
    g.add(t);
    g.userData = { halo, t, obj };
    kinds.add(g);
    return g;
  });

  const update = hud(camera, [
    [0, 'Ар-Рази описал лабораторную посуду', 'куб · алембик · приёмник'],
    [0.12, 'Нагреваем жидкость', 'огонь → кипение'],
    [0.25, 'Пар поднимается и остывает', 'пар → капли'],
    [0.4, 'Капли стекают в другой сосуд', 'перегонка'],
    [0.75, 'Три рода веществ', 'минеральные · растительные · животные'],
  ]);

  return (t, p) => {
    motes.userData.update?.(t);
    lamp.update(t);
    update(p);
    tags.forEach((tg, i) => fade(tg, stage(p, 0.01 + i * 0.03, 0.05 + i * 0.03) * (1 - stage(p, 0.2, 0.25))));
    const heat = stage(p, 0.1, 0.2);
    coalMat.emissiveIntensity = heat * (1.4 + 0.4 * Math.sin(t * 7) + 0.2 * Math.sin(t * 13));
    fire.intensity = heat * (9 + 2 * Math.sin(t * 9));
    fireGlow.material.opacity = heat * 0.55;
    const boil = stage(p, 0.16, 0.26);
    bubbles.forEach((b) => {
      const { a, r, speed, phase } = b.userData;
      const u = (t * speed + phase) % 1;
      b.visible = boil > 0.05 && u < boil;
      b.position.copy(flaskAt).add(new THREE.Vector3(Math.cos(a + t) * r, 0.08 + u * 0.48, Math.sin(a + t) * r));
    });
    const steam = stage(p, 0.24, 0.32) * (1 - stage(p, 0.92, 1));
    vapour.forEach((s) => {
      const { phase, x, z, speed } = s.userData;
      const u = (t * speed + phase) % 1;
      s.position.copy(flaskAt).add(new THREE.Vector3(x * (1 - u), 0.6 + u * 2.0, z * (1 - u)));
      s.scale.setScalar(0.3 + u * 0.5);
      s.material.opacity = steam * Math.sin(Math.PI * u) * 0.85;
    });
    const dripping = stage(p, 0.38, 0.45);
    drops.forEach((d) => {
      const u = (t * 0.35 + d.userData.phase) % 1;
      d.visible = dripping > 0.05;
      if (u < 0.75) d.position.copy(spoutCurve.getPointAt(u / 0.75));
      else {
        const f = (u - 0.75) / 0.25;
        d.position.copy(spoutPts[3]).add(new THREE.Vector3(0, -f * f * 1.4, 0));
      }
    });
    distillate.scale.y = 0.05 + stage(p, 0.42, 0.9) * 0.95;
    liquid.scale.y = 1 - stage(p, 0.42, 0.9) * 0.4;
    items.forEach((g, i) => {
      const s = stage(p, 0.78 + i * 0.07, 0.83 + i * 0.07);
      g.visible = s > 0.01;
      g.scale.setScalar(0.4 + 0.6 * s);
      g.userData.halo.material.opacity = s * (0.4 + 0.2 * Math.sin(t * 3 + i));
      fade(g.userData.t, s);
      g.userData.obj.rotation.y = t * 0.6;
    });
    const end = stage(p, 0.74, 0.8);
    const target = base.clone().add(new THREE.Vector3(lerp(1.3, -0.2, end), lerp(1.9, 0.5, end), lerp(0, 2.6, end)));
    aim(camera, target, lerp(3.2, 2.6, end), -0.12 + Math.sin(t * 0.08) * 0.05, lerp(0.16, 0.5, end));
  };
}

/* ---------- az-Zahrawi: the instruments of «at-Tasrif» ---------- */

function instrument(kind, steel) {
  const g = new THREE.Group();
  const add = (m) => {
    m.castShadow = true;
    g.add(m);
    return m;
  };
  if (kind === 'scalpel') {
    add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.1), steel)).position.x = -0.35;
    const blade = new THREE.Shape();
    blade.moveTo(0, -0.05);
    blade.lineTo(0.55, -0.05);
    blade.quadraticCurveTo(0.65, 0.08, 0.2, 0.1);
    blade.lineTo(0, 0.05);
    const b = add(new THREE.Mesh(new THREE.ExtrudeGeometry(blade, { depth: 0.015, bevelEnabled: false }), steel));
    b.rotation.x = -Math.PI / 2;
    b.position.set(0.2, 0, 0);
  } else if (kind === 'hook') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 12), steel)).rotation.z = Math.PI / 2;
    const tip = add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 8, 24, Math.PI * 1.2), steel));
    tip.position.set(0.7, 0, 0.1);
    tip.rotation.x = Math.PI / 2;
  } else if (kind === 'forceps') {
    for (const s of [-1, 1]) {
      const arm = add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.07), steel));
      arm.position.set(0, 0, s * 0.08);
      arm.rotation.y = s * 0.09;
    }
    add(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 20), steel)).position.set(-0.7, 0, 0);
  } else {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 10), steel)).rotation.z = Math.PI / 2;
    add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), steel)).position.x = 0.72;
  }
  return g;
}

// Ink drawings of instruments for the pages and the wall of two hundred.
function sketchTexture(seed) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const rand = rng(seed);
  g.strokeStyle = 'rgba(52,26,8,1)';
  g.lineWidth = 7;
  g.lineCap = 'round';
  const kind = Math.floor(rand() * 4);
  g.beginPath();
  g.moveTo(20, 108);
  g.lineTo(100, 28);
  if (kind === 0) {
    g.moveTo(100, 28);
    g.quadraticCurveTo(118, 18, 108, 40);
  } else if (kind === 1) {
    g.moveTo(100, 28);
    g.arc(104, 36, 10, Math.PI, Math.PI * 2.2);
  } else if (kind === 2) {
    g.moveTo(24, 100);
    g.lineTo(96, 40);
  } else {
    g.moveTo(100, 28);
    g.arc(100, 28, 7, 0, Math.PI * 2);
  }
  g.stroke();
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.arc(30 + i * 8, 98 - i * 8, 3, 0, Math.PI * 2);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function surgery({ scene, camera, lamp, motes }) {
  const steel = new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 1, roughness: 0.18, envMapIntensity: 1.4 });
  const centre = new THREE.Vector3(0.6, 0, 0.4);
  // Velvet instrument roll.
  const velvet = shadowed(new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.05, 2.6), new THREE.MeshStandardMaterial({ color: 0x3a1022, roughness: 1 })));
  velvet.position.copy(centre).setY(0.025);
  scene.add(velvet);
  // The Tasrif, open at its pages of drawings.
  const pages = new THREE.Group();
  pages.position.set(-3.6, 0, -0.6);
  pages.rotation.y = 0.35;
  scene.add(pages);
  const page = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 2.4), [null, null, Object.assign(parchment({ title: 'كتاب التصريف', lines: ['لمن عجز عن التأليف'], seed: 91, size: 1024, aspect: 3.4 / 2.4 }), { color: new THREE.Color(0xcab894) }), null, null, null].map((m) => m ?? new THREE.MeshStandardMaterial({ color: 0xcdb48a }))));
  page.position.y = 0.04;
  pages.add(page);

  const named = ['scalpel', 'hook', 'forceps', 'probe'].map((kind, i) => {
    const g = instrument(kind, steel);
    g.position.copy(centre).add(new THREE.Vector3((i - 1.5) * 1.15, 0.08, 0));
    g.rotation.y = Math.PI / 2;
    scene.add(g);
    // Its drawing on the page.
    const sketch = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: sketchTexture(i * 7 + 1), transparent: true, opacity: 0 }));
    sketch.rotation.x = -Math.PI / 2;
    sketch.position.set(-1.1 + i * 0.75, 0.09, 0.45);
    pages.add(sketch);
    return { g, sketch, home: g.position.clone() };
  });
  const names = ['скальпель', 'крючок', 'щипцы', 'зонд'].map((n, i) => {
    const t = label(n, { size: 0.28, family: SERIF, weight: 700, color: '#fff1cf', background: 'rgba(20,12,6,0.66)' });
    t.position.copy(named[i].home).add(new THREE.Vector3(0, 0.95, 0.5));
    scene.add(t);
    return t;
  });
  const invented = [0, 2].map((i) => {
    const t = label('✦ придумал сам', { size: 0.22, family: SERIF, weight: 700, color: '#ffd27a', background: null, glow: 0.8 });
    t.position.copy(named[i].home).add(new THREE.Vector3(0, 1.35, 0.5));
    scene.add(t);
    return t;
  });

  // A wall of two hundred little drawings behind the roll.
  const wall = new THREE.Group();
  wall.position.set(0.6, 1.6, -3.2);
  scene.add(wall);
  const sketchMats = Array.from({ length: 8 }, (_, k) => new THREE.MeshBasicMaterial({ map: sketchTexture(100 + k), transparent: true, opacity: 0, color: 0xf2e4c4 }));
  const cells = [];
  for (let i = 0; i < 200; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.39, 0.39), sketchMats[i % 8]);
    m.position.set(((i % 20) - 9.5) * 0.4, -Math.floor(i / 20) * 0.4 + 1.8, 0);
    m.visible = false;
    wall.add(m);
    cells.push(m);
  }
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 4.4), new THREE.MeshStandardMaterial({ color: 0xcfb98f, roughness: 1 }));
  paper.position.set(0, 0, -0.02);
  wall.add(paper);
  const counter = label('0', { size: 0.6, family: SERIF, weight: 700, color: '#fff3d0', background: 'rgba(20,12,6,0.6)', template: '≈ 200 инструментов' });
  counter.position.set(0, -2.55, 0.3);
  wall.add(counter);

  // Catgut: a suture closing a cut.
  const pad = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.2), new THREE.MeshStandardMaterial({ color: 0xd99a8a, roughness: 0.7 })));
  pad.position.copy(centre).add(new THREE.Vector3(0, 0.06, 1.9));
  scene.add(pad);
  const cut = rod(pad.position.clone().add(new THREE.Vector3(-0.8, 0.07, 0)), pad.position.clone().add(new THREE.Vector3(0.8, 0.07, 0)), 0.02, new THREE.MeshBasicMaterial({ color: 0x6a1010 }));
  scene.add(cut);
  const stitch = [];
  for (let i = 0; i <= 8; i++) {
    const x = -0.8 + i * 0.2;
    stitch.push(pad.position.clone().add(new THREE.Vector3(x, 0.09, i % 2 ? 0.16 : -0.16)));
  }
  const thread = tube(stitch, 0.028, new THREE.MeshStandardMaterial({ color: 0xffd98a, roughness: 0.3, emissive: 0x8a5a10, emissiveIntensity: 0.9 }), 200);
  revealTube(thread, 0);
  scene.add(thread);
  const gutTag = label('кетгут — нить для внутренних швов', { size: 0.26, family: SERIF, weight: 700, color: '#fbe7b5', background: 'rgba(20,12,6,0.66)' });
  gutTag.position.copy(pad.position).add(new THREE.Vector3(0, 1.05, -0.7));
  scene.add(gutTag);

  const update = hud(camera, [
    [0, '«Ат-Тасриф»: тридцать книг, последняя — о хирургии', 'около 200 инструментов'],
    [0.22, 'Скальпели, крючки, щипцы, зонды', 'каждый — с рисунком'],
    [0.48, 'Каждый нарисован в книге', 'многие придумал сам'],
    [0.8, 'Кетгут — нити для внутренних швов', 'кетгут'],
  ]);

  return (t, p) => {
    motes.userData.update?.(t);
    lamp.update(t);
    update(p);
    // The wall fills with two hundred drawings.
    const fill = clamp((p - 0.04) / 0.14);
    cells.forEach((c, i) => {
      c.visible = fill * 200 > i;
    });
    sketchMats.forEach((m) => {
      m.opacity = stage(p, 0.04, 0.08) * (1 - stage(p, 0.2, 0.26) * 0.7);
    });
    counter.userData.set(fill >= 1 ? '≈ 200 инструментов' : String(Math.round(fill * 200)));
    fade(counter, stage(p, 0.04, 0.07) * (1 - stage(p, 0.22, 0.26)));
    // Each named instrument rises as its name is spoken.
    const times = [0.24, 0.29, 0.33, 0.39];
    named.forEach((n, i) => {
      const s = stage(p, times[i], times[i] + 0.05);
      n.g.position.copy(n.home).add(new THREE.Vector3(0, s * 0.6 * (1 - stage(p, 0.46, 0.5)), 0));
      n.g.rotation.z = s * 0.25 * Math.sin(t * 1.4 + i) * (1 - stage(p, 0.46, 0.5));
      fade(names[i], s * (1 - stage(p, 0.78, 0.82)));
      n.sketch.material.opacity = stage(p, 0.49 + i * 0.025, 0.53 + i * 0.025);
    });
    invented.forEach((tg, i) => fade(tg, stage(p, 0.6 + i * 0.03, 0.64 + i * 0.03) * (1 - stage(p, 0.78, 0.82))));
    revealTube(thread, stage(p, 0.84, 0.97));
    fade(gutTag, stage(p, 0.83, 0.87));
    // Camera: the wall, the roll, the page, the suture.
    const wallView = stage(p, 0, 0.02) * (1 - stage(p, 0.2, 0.26));
    const pageView = stage(p, 0.47, 0.52) * (1 - stage(p, 0.66, 0.72));
    const stitchView = stage(p, 0.8, 0.86);
    const target = centre.clone()
      .lerp(wall.position.clone().add(new THREE.Vector3(0, 0.2, 0)), wallView)
      .lerp(pages.position.clone().add(new THREE.Vector3(0.3, 0, 0)), pageView)
      .lerp(pad.position.clone(), stitchView);
    aim(camera, target, lerp(3.0, 2.4, Math.max(pageView, stitchView)) + wallView * 1.4, -0.05 + Math.sin(t * 0.09) * 0.04, lerp(0.85, 0.35, wallView));
  };
}

/* ---------- Ibn Sina: the Canon and the Book of Healing ---------- */

function pharmacy({ scene, camera, lamp, motes }) {
  const centre = new THREE.Vector3(0.6, 0, 0.2);
  const covers = [0x5a2016, 0x1f3550, 0x2d4a2a, 0x6b4a1a, 0x4a1a2a];
  const volumes = covers.map((c, i) => {
    const b = book({ w: 0.62, h: 2.3, d: 1.7, cover: c });
    b.rotation.z = 0;
    const home = centre.clone().add(new THREE.Vector3((i - 2) * 0.7 - 1.6, 1.15, -0.4));
    b.position.copy(home);
    scene.add(b);
    const n = label(['I', 'II', 'III', 'IV', 'V'][i], { size: 0.34, family: SERIF, weight: 700, color: '#ffd27a', background: null, glow: 0.6 });
    n.position.copy(home).add(new THREE.Vector3(0, 0.3, 0.9));
    scene.add(n);
    return { b, home, n };
  });
  const canonTag = label('«Канон врачебной науки» — 5 томов', { size: 0.3, family: SERIF, weight: 700, color: '#fff1cf', background: 'rgba(20,12,6,0.66)' });
  canonTag.position.copy(centre).add(new THREE.Vector3(-1.6, 0.25, 1.05));
  scene.add(canonTag);

  // The Book of Healing: a great open book.
  const healing = new THREE.Group();
  healing.position.copy(centre).add(new THREE.Vector3(2.2, 0, 0.5));
  healing.rotation.y = -0.3;
  scene.add(healing);
  const W = 1.6;
  const D = 2.2;
  const left = parchmentMaps({ title: 'كتاب الشفاء', lines: ['المنطق', 'الطبيعيات', 'الرياضيات', 'الإلهيات'], seed: 77, aspect: W / D, size: 768 });
  const coverMesh = shadowed(new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.2, 0.08, D + 0.2), new THREE.MeshStandardMaterial({ color: 0x3a1a10, roughness: 0.6 })));
  coverMesh.position.y = 0.04;
  healing.add(coverMesh);
  const pagesL = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.06, D - 0.08), new THREE.MeshStandardMaterial({ map: left.map, roughness: 0.9, color: 0xcbb995 }));
  pagesL.rotation.x = -Math.PI / 2;
  pagesL.position.set(-W / 2, 0.3, 0);
  const pagesR = pagesL.clone();
  pagesR.position.x = W / 2;
  const blockMat = new THREE.MeshStandardMaterial({ color: 0xe8d6ab, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const blk = shadowed(new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.22, D - 0.06), blockMat));
    blk.position.set(s * W / 2, 0.18, 0);
    healing.add(blk);
  }
  healing.add(pagesL, pagesR);
  const healTag = label('«Книга исцеления»', { size: 0.34, family: SERIF, weight: 700, color: '#fff1cf', background: 'rgba(20,12,6,0.66)' });
  healTag.position.set(0, 1.0, 0.9);
  healing.add(healTag);
  const sciences = ['логика', 'физика', 'математика', 'астрономия', 'музыка', 'метафизика'].map((name, i, all) => {
    const t = label(name, { size: 0.26, family: SERIF, weight: 700, color: '#ffe2a3', background: 'rgba(20,12,6,0.5)', glow: 0.5 });
    const a = Math.PI * (0.1 + (0.8 * i) / (all.length - 1));
    t.position.set(Math.cos(a) * 1.9, 0.9 + Math.sin(a) * 0.9, -0.6);
    healing.add(t);
    return t;
  });

  const update = hud(camera, [
    [0, 'Днём — больные, ночью — книги', 'Ибн Сина'],
    [0.2, '«Канон врачебной науки»', 'пять томов'],
    [0.4, 'Энциклопедия медицины', 'I · II · III · IV · V'],
    [0.6, '«Книга исцеления»', 'свод философии и наук'],
  ]);

  return (t, p) => {
    motes.userData.update?.(t);
    lamp.update(t);
    update(p);
    volumes.forEach(({ b, home, n }, i) => {
      const s = stage(p, 0.2 + i * 0.04, 0.25 + i * 0.04);
      b.visible = s > 0.01;
      b.position.copy(home).add(new THREE.Vector3(0, (1 - s) * 2.5, 0));
      b.rotation.y = (1 - s) * 0.8;
      fade(n, stage(p, 0.4 + i * 0.02, 0.44 + i * 0.02));
    });
    fade(canonTag, stage(p, 0.21, 0.26));
    const open = stage(p, 0.58, 0.66);
    healing.visible = open > 0.01;
    healing.scale.setScalar((0.3 + 0.7 * open) * 1.35);
    fade(healTag, open);
    sciences.forEach((s, i) => fade(s, stage(p, 0.74 + i * 0.03, 0.78 + i * 0.03)));
    const target = centre.clone().add(new THREE.Vector3(lerp(-1.6, 1.6, stage(p, 0.56, 0.66)), 1.0, 0));
    aim(camera, target, lerp(3.4, 3.2, stage(p, 0.56, 0.66)), -0.08 + Math.sin(t * 0.08) * 0.05, 0.42);
  };
}

export function laboratory({ params = {} } = {}) {
  const { scene, camera } = studyStage();
  const room = study(scene);
  const ctx = { scene, camera, lamp: room.lamp, motes: room.motes };
  const variant = params.variant ?? 'distill';
  const step = variant === 'surgery' ? surgery(ctx) : variant === 'pharmacy' ? pharmacy(ctx) : distill(ctx);
  void smooth;
  void dust;
  return {
    scene,
    camera,
    update({ t, p }) {
      step(t, p);
    },
  };
}
