// Astronomy and geodesy.
import {
  THREE, COLORS, createStage, fitDistance, orbit, metal, matte, shine, glow, label, fade, starfield, rod, placeRod,
  tube, revealTube, ring, arcPoints, skyDome, rng, stage, smooth, lerp,
} from '../kit.js';
import { createFigure } from '../figure.js';
import { createActor, screenFacing } from '../actor.js';
import { worldTexture } from '../geo.js';

/* ---------- Al-Biruni measures the Earth ---------- */

export function earthMeasure({ ctx }) {
  const { scene, camera } = createStage({ background: 0x070b12, ambient: 0.6, sun: 1.4 });
  scene.add(starfield(1800, 300, 3));
  const R = 10;
  const h = 1.6;
  const C = new THREE.Vector3(0, -R, 0);
  const P = new THREE.Vector3(0, h, 0);
  const theta = Math.acos(R / (R + h));
  const T = new THREE.Vector3(R * Math.sin(theta), -R + R * Math.cos(theta), 0);
  const front = 0.36;
  const at = (v) => v.clone().setZ(front);

  // A slice of the Earth, seen edge-on.
  const slice = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.6, 160), [
    matte(0x1f5468, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x245e73, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x245e73, roughness: 0.8 }),
  ]);
  slice.rotation.x = Math.PI / 2;
  slice.position.copy(C);
  const crust = ring(R, 0.06, matte(0xcdb88c));
  crust.position.copy(C).setZ(front - 0.05);
  scene.add(slice, crust);

  const mountain = new THREE.Mesh(new THREE.ConeGeometry(1.5, h + 0.1, 48), matte(0x8c7b63));
  mountain.position.y = h / 2 - 0.05;
  const fort = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.4), matte(0xb7a383));
  fort.position.y = h + 0.1;
  const observer = glow(0xfff0c0, 0.6, 1);
  observer.position.copy(at(P));
  scene.add(mountain, fort, observer);

  const line = (a, b, color, radius = 0.035) => {
    const mesh = tube([at(a), at(b)], radius, shine(color, 1.2), 2);
    revealTube(mesh, 0);
    scene.add(mesh);
    return mesh;
  };
  const surface = (angle) => new THREE.Vector3(R * Math.sin(angle), -R + R * Math.cos(angle), 0);
  const B1 = surface(-0.13);
  const B2 = surface(-0.26);
  const sight1 = line(B1, P, 0x9fd4ff, 0.025);
  const sight2 = line(B2, P, 0x9fd4ff, 0.025);
  const height = line(new THREE.Vector3(0, 0, 0), P, COLORS.gold);
  const horizontal = line(P, new THREE.Vector3(6.5, h, 0), 0xf4efe2, 0.025);
  const sightline = line(P, T, COLORS.gold);
  const radiusP = line(C, P, 0x7fd3c8, 0.03);
  const radiusT = line(C, T, 0x7fd3c8, 0.03);
  const dots = [B1, B2, T].map((v) => {
    const d = glow(0xfff0c0, 0.4, 1);
    d.position.copy(at(v));
    scene.add(d);
    return d;
  });

  const angleArc = tube(arcPoints(1.6, 0, -theta, 24, 'xy', at(P)), 0.03, shine(COLORS.gold, 1.4), 40);
  revealTube(angleArc, 0);
  scene.add(angleArc);

  const tags = {
    step1: label('Шаг 1. Высота горы — с двух точек на равнине', { size: 0.42 }),
    h: label('h', { size: 0.5 }),
    step2: label('Шаг 2. С вершины: насколько горизонт ниже горизонтали', { size: 0.42 }),
    alpha: label('α ≈ 0°34′', { size: 0.45 }),
    R: label('R', { size: 0.6 }),
    formula: label('R = h · cos α / (1 − cos α)\n≈ 6340 км', { size: 0.55 }),
    scale: label('масштаб условный: гора сильно увеличена', { size: 0.3, color: '#c6bfb0' }),
  };
  tags.h.position.set(-0.55, h / 2, front);
  tags.alpha.position.set(2.6, h - 0.55, front);
  tags.R.position.copy(C.clone().lerp(T, 0.5)).add(new THREE.Vector3(0.7, 0, front));
  for (const tag of Object.values(tags)) {
    fade(tag, 0);
    scene.add(tag);
  }

  const near = { target: new THREE.Vector3(0.6, 0.4, 0), r: 3.4 };
  const far = { target: new THREE.Vector3(2.2, -3.6, 0), r: 7.8 };
  const target = new THREE.Vector3();

  return {
    scene,
    camera,
    update({ t, p }) {
      const s1 = stage(p, 0.05, 0.28);
      const s2 = stage(p, 0.34, 0.58);
      const s3 = stage(p, 0.62, 0.8);
      const s4 = stage(p, 0.84, 0.95);
      revealTube(sight1, s1);
      revealTube(sight2, s1);
      revealTube(height, stage(p, 0.2, 0.3));
      fade(dots[0], s1);
      fade(dots[1], s1);
      revealTube(horizontal, s2);
      revealTube(sightline, stage(p, 0.42, 0.56));
      revealTube(angleArc, stage(p, 0.5, 0.58));
      revealTube(radiusP, s3);
      revealTube(radiusT, s3);
      fade(dots[2], stage(p, 0.5, 0.56));

      fade(tags.step1, stage(p, 0.05, 0.1) * (1 - stage(p, 0.32, 0.36)));
      fade(tags.h, stage(p, 0.26, 0.32));
      fade(tags.step2, stage(p, 0.36, 0.42) * (1 - stage(p, 0.6, 0.64)));
      fade(tags.alpha, stage(p, 0.54, 0.6));
      fade(tags.R, stage(p, 0.72, 0.8));
      fade(tags.formula, s4);
      fade(tags.scale, stage(p, 0.7, 0.8));

      const zoom = smooth((p - 0.55) / 0.3);
      target.copy(near.target).lerp(far.target, zoom);
      const r = lerp(near.r, far.r, zoom);
      const d = fitDistance(camera, r, 1.05);
      camera.position.set(target.x + Math.sin(t * 0.08) * 0.6, target.y + 0.3, d);
      camera.lookAt(target);

      const top = target.y + r * 0.62;
      tags.step1.position.set(target.x, top, front);
      tags.step2.position.set(target.x, top, front);
      // On a wide screen the formula sits in the empty sky right of the mountain;
      // on a phone there is no room there, so it goes inside the Earth.
      if (ctx.aspect >= 1) {
        tags.formula.position.set(7.4, -0.1, front);
        tags.scale.position.set(7.4, -1.3, front);
      } else {
        tags.formula.position.set(target.x + r * 0.1, target.y - r * 0.2, front);
        tags.scale.position.set(target.x, target.y - r * 0.45, front);
      }
    },
  };
}

/* ---------- Ptolemy's deferent and epicycle ---------- */

export function celestial() {
  const { scene, camera } = createStage({ background: 0x060a11, ambient: 0.5, sun: 1.2 });
  scene.add(starfield(2500, 300, 8));
  const earthBall = new THREE.Mesh(new THREE.SphereGeometry(0.45, 48, 32), new THREE.MeshStandardMaterial({ map: worldTexture(), roughness: 0.85 }));
  scene.add(earthBall, glow(0x6fb7ff, 1.8, 0.35));
  const deferent = ring(4, 0.025, shine(COLORS.gold, 0.9));
  deferent.rotation.x = Math.PI / 2;
  scene.add(deferent);
  const zodiac = ring(6.5, 0.015, shine(COLORS.gold, 0.4));
  zodiac.rotation.x = Math.PI / 2;
  scene.add(zodiac);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    scene.add(rod(new THREE.Vector3(Math.cos(a) * 6.3, 0, Math.sin(a) * 6.3), new THREE.Vector3(Math.cos(a) * 6.75, 0, Math.sin(a) * 6.75), 0.02, shine(COLORS.gold, 0.6)));
  }
  const epicycle = ring(1.3, 0.02, shine(COLORS.teal, 1));
  epicycle.rotation.x = Math.PI / 2;
  const planet = new THREE.Group();
  planet.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), shine(0xffc070, 1.5)), glow(0xffc070, 1.2, 0.8));
  const origin = new THREE.Vector3();
  const armDeferent = rod(origin, new THREE.Vector3(4, 0, 0), 0.012, matte(0x9c8a66));
  const armEpicycle = rod(origin, new THREE.Vector3(1, 0, 0), 0.012, matte(0x5aa69c));
  scene.add(epicycle, planet, armDeferent, armEpicycle);

  const max = 2400;
  const trail = new Float32Array(max * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trail, 3));
  trailGeo.setDrawRange(0, 0);
  scene.add(new THREE.Points(trailGeo, new THREE.PointsMaterial({ size: 0.05, color: 0xffd58a, transparent: true, opacity: 0.8, depthWrite: false })));
  let n = 0;
  let lastSample = -1;

  const tag = label('Деферент и эпицикл — модель Птолемея', { size: 0.4 });
  tag.position.set(0, 3.2, 0);
  scene.add(tag);

  const center = new THREE.Vector3();
  const pos = new THREE.Vector3();
  return {
    scene,
    camera,
    update({ t, p }) {
      const a = t * 0.22;
      const b = t * 1.5;
      center.set(Math.cos(a) * 4, 0, Math.sin(a) * 4);
      pos.set(center.x + Math.cos(b) * 1.3, 0, center.z + Math.sin(b) * 1.3);
      epicycle.position.copy(center);
      planet.position.copy(pos);
      placeRod(armDeferent, origin, center);
      placeRod(armEpicycle, center, pos);
      if (t - lastSample > 0.04 && n < max) {
        trail.set([pos.x, pos.y, pos.z], n * 3);
        n += 1;
        lastSample = t;
        trailGeo.setDrawRange(0, n);
        trailGeo.attributes.position.needsUpdate = true;
      }
      earthBall.rotation.y += 0.002;
      fade(tag, stage(p, 0.08, 0.2));
      orbit(camera, new THREE.Vector3(0, 0, 0), fitDistance(camera, 6.8), t * 0.03, lerp(0.85, 0.55, smooth(p)));
    },
  };
}

/* ---------- Star catalogue / night sky ---------- */

export function stars({ params }) {
  const { scene, camera } = createStage({ background: 0x04070d, ambient: 0.2, sun: 0.2 });
  scene.add(skyDome(0x03050a, 0x1a2338, 500));
  const sky = new THREE.Group();
  sky.rotation.x = THREE.MathUtils.degToRad(50);
  scene.add(sky);
  sky.add(starfield(3500, 300, 13));

  const count = params.count ?? 1200;
  const rand = rng(99);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = rand() * 1.6 - 0.6;
    const a = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos.set([200 * s * Math.cos(a), 200 * u, 200 * s * Math.sin(a)], i * 3);
  }
  const catGeo = new THREE.BufferGeometry();
  catGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const catalogue = new THREE.Points(catGeo, new THREE.PointsMaterial({ size: 4, sizeAttenuation: false, color: 0xffe2a0, transparent: true, depthWrite: false }));
  sky.add(catalogue);

  // A few constellation-like figures for the eye to hold on to.
  for (let c = 0; c < 9; c++) {
    const pts = [];
    const base = new THREE.Vector3(rand() - 0.5, rand() * 0.8 + 0.1, rand() - 0.5).normalize().multiplyScalar(200);
    for (let k = 0; k < 5; k++) pts.push(base.clone().add(new THREE.Vector3((rand() - 0.5) * 30, (rand() - 0.5) * 30, (rand() - 0.5) * 30)));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    sky.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x7fd3c8, transparent: true, opacity: 0.35 })));
  }

  const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 64), new THREE.MeshBasicMaterial({ color: 0x06080c }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  scene.add(ground);
  for (let i = 0; i < 14; i++) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(18 + rand() * 20, 16, 8), new THREE.MeshBasicMaterial({ color: 0x07090e }));
    const a = (i / 14) * Math.PI * 2;
    hill.position.set(Math.cos(a) * 120, -16, Math.sin(a) * 120);
    scene.add(hill);
  }

  const counter = params.counter !== false && params.count;
  const tag = counter ? label(`Звёзд в каталоге: 0`, { size: 1.1, template: `Звёзд в каталоге: ${count}` }) : null;
  if (tag) scene.add(tag);

  return {
    scene,
    camera,
    update({ t, p }) {
      sky.rotation.y = t * 0.015;
      const shown = counter ? Math.floor(count * stage(p, 0.05, 0.85)) : count;
      catGeo.setDrawRange(0, shown);
      const look = new THREE.Vector3(Math.sin(t * 0.02) * 4, lerp(4, 9, smooth(p)), -20);
      if (tag) {
        tag.userData.set(`Звёзд в каталоге: ${shown}`);
        tag.position.set(look.x * 0.9, look.y * 0.9 + 3, -18);
      }
      camera.position.set(0, 0, 0);
      camera.lookAt(look);
    },
  };
}

/* ---------- The solar year ---------- */

export function orbitScene() {
  const { scene, camera } = createStage({ background: 0x05080f, ambient: 0.15, sun: 0 });
  scene.add(starfield(2500, 300, 4));
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(0.8, 48, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  const light = new THREE.PointLight(0xfff0d0, 120, 40);
  scene.add(sunBall, glow(0xffb347, 4.5, 0.9), light);
  const path = ring(4, 0.015, shine(COLORS.gold, 0.5));
  path.rotation.x = Math.PI / 2;
  scene.add(path);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tick = rod(new THREE.Vector3(Math.cos(a) * 3.85, 0, Math.sin(a) * 3.85), new THREE.Vector3(Math.cos(a) * 4.15, 0, Math.sin(a) * 4.15), 0.02, shine(COLORS.gold, 0.6));
    scene.add(tick);
  }
  const earthBall = new THREE.Mesh(new THREE.SphereGeometry(0.3, 48, 32), new THREE.MeshStandardMaterial({ map: worldTexture(), roughness: 0.85 }));
  const moonBall = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), matte(0xbbb5aa));
  const flash = glow(COLORS.gold, 1.6, 0);
  scene.add(earthBall, moonBall, flash);
  const year = label('Год 1', { size: 0.42, template: 'Год 10 · високосный, +1 день' });
  const note = label('Солнечный год ≈ 365,24 суток', { size: 0.34 });
  scene.add(year, note);
  const period = 7;

  return {
    scene,
    camera,
    update({ t, p }) {
      const a = (t / period) * Math.PI * 2;
      earthBall.position.set(Math.cos(a) * 4, 0, -Math.sin(a) * 4);
      earthBall.rotation.y = t * 2;
      moonBall.position.copy(earthBall.position).add(new THREE.Vector3(Math.cos(t * 5) * 0.55, 0, Math.sin(t * 5) * 0.55));
      const n = Math.floor(t / period) + 1;
      const leap = n % 4 === 0;
      year.userData.set(leap ? `Год ${n} · високосный, +1 день` : `Год ${n}`);
      const sinceStart = (t % period) / period;
      flash.position.copy(earthBall.position);
      flash.material.opacity = leap ? Math.max(0, 1 - sinceStart * 3) : 0;
      year.position.set(0, 2.1, 0);
      note.position.set(0, -1.6, 2.5);
      fade(note, stage(p, 0.1, 0.2));
      orbit(camera, new THREE.Vector3(), fitDistance(camera, 5), 0.3 + t * 0.02, 0.7);
    },
  };
}

/* ---------- Observatory ---------- */

export function observatory({ params }) {
  if (params.variant === 'sextant') return sextant(params);
  const { scene, camera } = createStage({ background: 0x070b14, fog: [16, 40], ambient: 0.45, sun: 0.9 });
  scene.add(skyDome(0x050912, 0x22304a), starfield(2500, 300, 19));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 48), matte(0x3b352c));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 0.5, 48), matte(0xb9a988));
  platform.position.y = 0.25;
  scene.add(platform);

  const sphere = new THREE.Group();
  sphere.position.y = 2.6;
  const gold = metal(COLORS.gold, 0.3, 0.9);
  const rings = [1.7, 1.5, 1.3, 1.1].map((r, i) => {
    const m = ring(r, 0.04, gold);
    m.rotation.set(i * 0.7, i * 0.4, 0);
    sphere.add(m);
    return m;
  });
  const meridian = ring(1.9, 0.05, gold);
  sphere.add(meridian, new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), metal(COLORS.teal, 0.4, 0.5)));
  scene.add(sphere, rod(new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 0.7, 0), 0.4, matte(0x8c7b63)));
  scene.add(rod(new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 0.75, 0), 0.08, gold));
  const stand = rod(new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 2.6 - 1.9, 0), 0.06, gold);
  scene.add(stand);

  const building = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 3.4, 40), matte(0xc6b28d));
  drum.position.y = 1.7;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.6, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), matte(0xd7c7a5));
  dome.position.y = 3.4;
  building.add(drum, dome);
  for (let i = 0; i < 6; i++) {
    const w = glow(0xffc070, 0.7, 0.9);
    const a = Math.PI / 2 + (i - 2.5) * 0.35;
    w.position.set(Math.cos(a) * 2.75, 1.8, Math.sin(a) * 2.75);
    building.add(w);
  }
  building.position.set(-3.5, 0, -7);
  scene.add(building);

  return {
    scene,
    camera,
    update({ t, p }) {
      rings.forEach((r, i) => (r.rotation.y += 0.002 * (i + 1)));
      sphere.rotation.y = t * 0.05;
      orbit(camera, new THREE.Vector3(0, 2.2, -1), fitDistance(camera, 4.5) * lerp(1.15, 0.9, smooth(p)), 0.5 + t * 0.025, 0.18);
    },
  };
}

function sextant(params = {}) {
  const { scene, camera, sun } = createStage({ background: 0x2a3244, fog: [20, 60], ambient: 0.7, sun: 1.8 });
  sun.position.set(6, 10, 4);
  scene.add(skyDome(0x3d5a80, 0xe2c08a));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), matte(0xb3966a));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const R = 8;
  const C = new THREE.Vector3(0, R + 0.3, 0);
  const marble = matte(0xece4d4, 0.5);
  for (const z of [-0.6, 0.6]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(R, 0.16, 10, 120, Math.PI / 3), marble);
    rail.rotation.z = -Math.PI / 2;
    rail.position.set(C.x, C.y, z);
    scene.add(rail);
  }
  const steps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.12, 1.1), matte(0xd4c4a4), 40);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 40; i++) {
    const a = -Math.PI / 2 + (i / 39) * (Math.PI / 3);
    const pos = new THREE.Vector3(C.x + Math.cos(a) * (R - 0.05), C.y + Math.sin(a) * (R - 0.05), 0);
    m.compose(pos, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a + Math.PI / 2), new THREE.Vector3(1, 1, 1));
    steps.setMatrixAt(i, m);
  }
  scene.add(steps);
  const walls = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 3, 64, 1, true, Math.PI * 0.9, Math.PI * 1.2), new THREE.MeshStandardMaterial({ color: 0xc8ad82, roughness: 0.9, side: THREE.DoubleSide }));
  walls.position.set(2, 1.5, 0);
  scene.add(walls);

  const sunDisc = glow(0xfff2c8, 3, 1);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 8), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  const spot = glow(0xffe8a0, 1.4, 1);
  scene.add(sunDisc, beam, spot);
  const tag = label('Секстант Фахри · радиус ≈ 40 м', { size: 0.5 });
  tag.position.set(1.5, 7.4, 0);
  scene.add(tag);

  // An astronomer walks down the steps of the arc after the spot of sunlight
  // and reads its place on the scale. He is to scale: the arc is 40 m.
  const stand = params.cast?.stand;
  const actor = stand ? createActor({ stand }, { height: 0.8 }) : null;
  const astronomer = actor ?? createFigure(params.who ?? 'ulugbek', { prop: 'quill' });
  if (!actor) astronomer.root.scale.setScalar(0.42);
  scene.add(astronomer.root);
  const human = label('человек — для масштаба', { size: 0.26, background: 'rgba(10,14,22,0.7)' });
  scene.add(human);

  return {
    scene,
    camera,
    ownFigure: true,
    update({ t, dt, p }) {
      const a = lerp(-Math.PI / 2 + 0.15, -Math.PI / 2 + 0.85, smooth(p));
      const hit = new THREE.Vector3(C.x + Math.cos(a) * R, C.y + Math.sin(a) * R, 0);
      spot.position.copy(hit);
      const dir = new THREE.Vector3().subVectors(hit, C);
      beam.position.copy(C).addScaledVector(dir, 0.5);
      beam.scale.y = dir.length();
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      sunDisc.position.copy(C).addScaledVector(dir.clone().normalize(), -14);
      fade(tag, stage(p, 0.08, 0.2));
      // He keeps a step behind the spot, then stops and writes down the reading.
      const lag = a - 0.05 - Math.sin(t * 0.9) * 0.015;
      const feet = new THREE.Vector3(C.x + Math.cos(lag) * (R - 0.12), C.y + Math.sin(lag) * (R - 0.12), 0.05);
      astronomer.root.position.copy(feet);
      const moving = Math.abs(Math.cos(t * 0.9)) > 0.35;
      if (!actor) {
        astronomer.root.rotation.y = Math.PI / 2 + 0.5;
        astronomer.set({ walk: moving ? 0.8 : 0, right: moving ? 'down' : 'write', left: moving ? 'down' : 'hold', look: hit });
        astronomer.update(t, dt);
      }
      human.position.copy(feet).add(new THREE.Vector3(0.6, 1.3, 0.6));
      fade(human, stage(p, 0.15, 0.25));
      orbit(camera, new THREE.Vector3(1.8, 3.2, 0), fitDistance(camera, 7.5), lerp(0.25, -0.15, smooth(p)) + Math.sin(t * 0.05) * 0.05, 0.12);
      // He faces the spot of sunlight he follows.
      if (actor) actor.set({ walking: moving ? 0.8 : 0, face: screenFacing(camera, new THREE.Vector3(hit.x - feet.x, 0, 0)) }).update(t, dt, camera);
    },
  };
}

/* ---------- The Tusi couple ---------- */

export function tusi() {
  const { scene, camera } = createStage({ background: 0x070b12, ambient: 0.6, sun: 1.2 });
  scene.add(starfield(1500, 300, 23));
  const device = new THREE.Group();
  scene.add(device);
  const big = ring(2, 0.05, shine(COLORS.gold, 1));
  const smallGroup = new THREE.Group();
  const small = ring(1, 0.04, shine(COLORS.teal, 1.2));
  const spoke = rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), 0.02, shine(COLORS.teal, 0.8));
  smallGroup.add(small, spoke);
  const point = new THREE.Group();
  point.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), shine(0xffc070, 2)), glow(0xffc070, 1, 1));
  const track = tube([new THREE.Vector3(-2, 0, 0), new THREE.Vector3(2, 0, 0)], 0.03, shine(0xffe2a0, 1.3), 2);
  device.add(big, smallGroup, point, track);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.3, 64), new THREE.MeshStandardMaterial({ color: 0x15202c, roughness: 0.9, transparent: true, opacity: 0.85 }));
  disc.position.z = -0.08;
  device.add(disc);

  const tags = [
    label('Пара Туси', { size: 0.42 }),
    label('Малый круг катится внутри большого', { size: 0.3 }),
    label('Два вращения дают движение по прямой', { size: 0.3 }),
  ];
  tags[0].position.set(0, 3.1, 0);
  tags[1].position.set(0, -2.7, 0.2);
  tags[2].position.set(0, -2.7, 0.2);
  tags.forEach((t) => device.add(t));

  return {
    scene,
    camera,
    update({ t, p }) {
      const a = t * 0.9;
      smallGroup.position.set(Math.cos(a), Math.sin(a), 0);
      smallGroup.rotation.z = -a;
      point.position.set(2 * Math.cos(a), 0, 0.05);
      revealTube(track, stage(p, 0.35, 0.55));
      fade(tags[0], stage(p, 0.02, 0.1));
      fade(tags[1], stage(p, 0.1, 0.18) * (1 - stage(p, 0.45, 0.5)));
      fade(tags[2], stage(p, 0.52, 0.6));
      device.rotation.x = lerp(-0.1, -0.55, smooth(p));
      camera.position.set(Math.sin(t * 0.07) * 0.8, 0.3, fitDistance(camera, 3.4));
      camera.lookAt(0, 0, 0);
    },
  };
}
