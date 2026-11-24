// Places and settings: maps, globes, cities, halls.
import {
  THREE, COLORS, createStage, fitDistance, orbit, metal, matte, shine, glow, label, fade, starfield, dust, rod,
  tube, revealTube, ring, star8Shape, skyDome, pointedArch, houseColors, rng, stage, smooth, lerp, clamp,
} from '../kit.js';
import { MAP, PLACES, mapPosition, mapTexture, worldTexture, spherePosition, reliefMap } from '../geo.js';

/* ---------- Title card ---------- */

export function title() {
  const { scene, camera } = createStage({ background: 0x080c13, ambient: 0.35, sun: 2.2 });
  scene.add(starfield(1500, 300));
  const emblem = new THREE.Group();
  const extrude = (shape, depth) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 });
    geo.center();
    return geo;
  };
  emblem.add(
    new THREE.Mesh(extrude(star8Shape(1.6, 1.22), 0.25), metal(COLORS.gold, 0.28, 0.9)),
    new THREE.Mesh(extrude(star8Shape(0.9, 0.68), 0.42), metal(COLORS.tealDeep, 0.35, 0.6)),
    ring(2.1, 0.02, shine(COLORS.gold, 0.9)),
    ring(2.35, 0.012, shine(COLORS.gold, 0.5)),
    glow(COLORS.gold, 7, 0.3),
  );
  scene.add(emblem);
  const motes = dust(420, [12, 7, 8], 0xffd58a);
  motes.position.y = -3.5;
  scene.add(motes);
  const key = new THREE.PointLight(0xffd9a0, 40, 25);
  key.position.set(-3, 2, 5);
  scene.add(key);

  return {
    scene,
    camera,
    update({ t, p }) {
      emblem.rotation.y = Math.sin(t * 0.3) * 0.55;
      emblem.rotation.z = t * 0.04;
      motes.userData.update(t);
      camera.position.set(0, 0.1, fitDistance(camera, 2.7) * lerp(1.3, 1.05, smooth(p)));
      camera.lookAt(0, 0, 0);
    },
  };
}

/* ---------- Journey on the map ---------- */

function pin(name, height) {
  const group = new THREE.Group();
  group.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.32, 0), 0.025, metal(COLORS.gold)));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), shine(COLORS.gold, 1.4));
  head.position.y = 0.34;
  const halo = glow(0xffd27a, 0.6, 0.8);
  halo.position.y = 0.34;
  const tag = label(name, { size: 0.26 });
  tag.position.y = height;
  group.add(head, halo, tag);
  return group;
}

// A small camel for the caravan (length about 1 unit before scaling).
function camel() {
  const g = new THREE.Group();
  const hide = new THREE.MeshStandardMaterial({ color: 0xc49a62, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x7a5a36, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), hide);
  body.scale.set(1.5, 0.75, 0.7);
  body.position.y = 0.9;
  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), hide);
  hump.scale.set(1.2, 1, 0.9);
  hump.position.set(-0.05, 1.18, 0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.62, 10), hide);
  neck.position.set(0.55, 1.12, 0);
  neck.rotation.z = -0.7;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.13, 0.13), hide);
  head.position.set(0.82, 1.38, 0);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.62), new THREE.MeshStandardMaterial({ color: 0x8a2a1a, roughness: 0.8 }));
  pack.position.set(-0.2, 1.02, 0);
  g.add(body, hump, neck, head, pack);
  const legs = [];
  for (const [x, z] of [[0.32, 0.14], [0.32, -0.14], [-0.32, 0.14], [-0.32, -0.14]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.72, 8), dark);
    leg.geometry.translate(0, -0.36, 0);
    leg.position.set(x, 0.74, z);
    g.add(leg);
    legs.push(leg);
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  g.userData.walk = (t) => legs.forEach((leg, i) => {
    leg.rotation.z = Math.sin(t * 6 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.35;
  });
  return g;
}

export function journey({ params }) {
  const { scene, camera, sun } = createStage({ background: 0x0a0f16, fog: [45, 120], ambient: 0.55, sun: 1.6 });
  const route = params.route ?? null;
  const names = route ?? [params.from, ...(params.to ?? [])];
  // The whole map, flat and a little dimmer; the region of the route on top
  // of it, sharp and in relief.
  const map = new THREE.Mesh(new THREE.PlaneGeometry(MAP.width, MAP.height), new THREE.MeshStandardMaterial({ map: mapTexture(), roughness: 0.95, color: 0xb2a284 }));
  map.rotation.x = -Math.PI / 2;
  map.position.y = -0.02;
  map.receiveShadow = true;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(MAP.width + 0.5, 0.2, MAP.height + 0.5), matte(0x3b2a18));
  frame.position.y = -0.13;
  const lons = names.map((n) => PLACES[n]?.[0] ?? 44);
  const lats = names.map((n) => PLACES[n]?.[1] ?? 33);
  const midLon = (Math.min(...lons) + Math.max(...lons)) / 2;
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const halfLon = Math.max(13, (Math.max(...lons) - Math.min(...lons)) / 2 + 8);
  const halfLat = Math.max(8, (Math.max(...lats) - Math.min(...lats)) / 2 + 5);
  const bounds = {
    lon0: Math.max(MAP.lon0, midLon - halfLon), lon1: Math.min(MAP.lon1, midLon + halfLon),
    lat0: Math.max(MAP.lat0, midLat - halfLat), lat1: Math.min(MAP.lat1, midLat + halfLat),
  };
  const relief = reliefMap(bounds);
  scene.add(map, frame, relief);
  const heightAt = relief.userData.heightAt;
  const lonLat = (v) => [MAP.lon0 + (v.x + MAP.width / 2) / (MAP.cos * MAP.k), MAP.lat0 + (-v.z + MAP.height / 2) / MAP.k];
  const ground = (v, lift = 0.02) => {
    const [lon, lat] = lonLat(v);
    return v.setY(heightAt(lon, lat) + lift);
  };

  const points = names.map((n) => ground(mapPosition(n, 0)));
  const box = new THREE.Box3().setFromPoints(points);
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(2.2, box.getSize(new THREE.Vector3()).length() / 2 + 1);
  // Pins, labels and lines grow with the area shown, so they stay readable.
  const scale = clamp(radius / 3, 1, 3);
  const target = new THREE.Vector3();
  // Low evening sun from the west: the ranges cast long shadows.
  sun.position.copy(center).add(new THREE.Vector3(-9, 5, 3));
  sun.target.position.copy(center);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const span3 = radius * 2.2;
  Object.assign(sun.shadow.camera, { left: -span3, right: span3, top: span3, bottom: -span3, near: 0.5, far: 40 });
  sun.shadow.bias = -0.0008;

  const pins = names.map((name, i) => {
    const p = pin(name, i % 2 ? 0.95 : 0.62);
    p.scale.setScalar(scale);
    p.position.copy(points[i]);
    fade(p, 0);
    scene.add(p);
    return p;
  });

  // The route follows the ground: over the plains and through the passes.
  const pairs = route ? points.slice(1).map((b, i) => [points[i], b]) : points.slice(1).map((b) => [points[0], b]);
  const segments = pairs.map(([a, b]) => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const v = a.clone().lerp(b, i / 40);
      pts.push(ground(v, 0.035 * scale));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.045 * scale, 8), shine(COLORS.gold, 1.3));
    revealTube(mesh, 0);
    scene.add(mesh);
    return { curve, mesh };
  });
  // A caravan of three camels walks at the head of the route.
  const caravan = [0, 1, 2].map(() => {
    const c = camel();
    c.scale.setScalar(0.3 * scale);
    scene.add(c);
    return c;
  });
  const traveler = glow(0xfff0c0, 0.5 * scale, 0.6);
  scene.add(traveler);
  const start = 0.08;
  const span = 0.8 / Math.max(1, segments.length);
  const along = (p) => {
    // Position on the whole route at progress p (0…1 of the travel time).
    let head = points[0];
    let dir = new THREE.Vector3(1, 0, 0);
    segments.forEach((s, i) => {
      const f = stage(p, start + i * span, start + (i + 1) * span);
      if (f > 0) {
        head = s.curve.getPointAt(Math.min(0.999, f));
        dir = s.curve.getTangentAt(Math.min(0.999, f));
      }
    });
    return { head, dir };
  };

  return {
    scene,
    camera,
    update({ t, p }) {
      fade(pins[0], stage(p, 0, start));
      let head = points[0];
      segments.forEach((s, i) => {
        const f = stage(p, start + i * span, start + (i + 1) * span);
        revealTube(s.mesh, f);
        if (f > 0 && f < 1) head = s.curve.getPointAt(f);
        if (f >= 1) head = s.curve.getPointAt(1);
        fade(pins[i + 1], stage(f, 0.85, 1));
      });
      caravan.forEach((c, i) => {
        const { head: h, dir } = along(Math.max(0, p - i * 0.02));
        c.position.copy(h).add(new THREE.Vector3(0, -0.02 * scale, 0));
        c.rotation.y = Math.atan2(-dir.z, dir.x);
        c.userData.walk(t + i * 0.4);
        c.visible = p > start * 0.5;
      });
      traveler.position.copy(head).add(new THREE.Vector3(0, 0.35 * scale, 0));
      traveler.material.opacity = 0.35 + 0.2 * Math.sin(t * 4);
      target.copy(center).lerp(head, 0.35);
      orbit(camera, target, fitDistance(camera, radius) * lerp(1.0, 0.82, smooth(p)), Math.sin(t * 0.05) * 0.25 - 0.1, 0.72);
    },
  };
}

/* ---------- Globe ---------- */

function earth(radius) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 64),
    new THREE.MeshStandardMaterial({ map: worldTexture(), roughness: 0.85 }),
  );
}

export function globe({ params, ctx }) {
  const { scene, camera, sun } = createStage({ background: 0x05080d, ambient: 0.35, sun: 2.4 });
  sun.position.set(-8, 4, 6);
  scene.add(starfield(2500, 300));
  const facing = -Math.atan2(...(() => {
    const v = spherePosition(params.lon ?? 50, 20, 1);
    return [v.x, v.z];
  })());

  const globes = [];
  if (params.compare) {
    for (const key of ['a', 'b']) {
      const spec = params.compare[key];
      const g = new THREE.Group();
      const ball = earth(1.5 * spec.scale);
      ball.rotation.y = facing;
      const tag = label(spec.label, { size: 0.4 });
      g.add(ball, glow(0x6fb7ff, 3.6 * spec.scale, 0.18), tag);
      g.userData = { ball, tag, scale: spec.scale };
      scene.add(g);
      globes.push(g);
    }
  } else {
    const g = new THREE.Group();
    const ball = earth(2.4);
    ball.rotation.y = facing;
    g.add(ball, glow(0x6fb7ff, 6, 0.2));
    if (params.spin) {
      g.add(rod(new THREE.Vector3(0, -3.3, 0), new THREE.Vector3(0, 3.3, 0), 0.03, shine(COLORS.gold, 0.8)));
      const tag = label('Вращение Земли вокруг оси', { size: 0.32 });
      tag.position.y = 3.6;
      g.add(tag);
      g.rotation.z = THREE.MathUtils.degToRad(23.4);
    }
    g.userData = { ball };
    scene.add(g);
    globes.push(g);
  }

  return {
    scene,
    camera,
    update({ dt, p }) {
      const wide = ctx.aspect >= 0.9;
      if (globes.length === 2) {
        globes.forEach((g, i) => {
          const side = i === 0 ? -1 : 1;
          g.position.set(wide ? side * 1.85 : 0, wide ? 0 : -side * 1.9, 0);
          // Above each globe side by side; outside the pair when stacked on a phone.
          const above = wide || i === 0;
          g.userData.tag.position.set(0, (above ? 1 : -1) * (1.5 * g.userData.scale + 0.5), 0);
          g.userData.ball.rotation.y += dt * 0.08;
        });
        camera.position.set(0, 0.2, fitDistance(camera, wide ? 3.9 : 4.1) * lerp(1.1, 0.98, smooth(p)));
      } else {
        globes[0].userData.ball.rotation.y += dt * (params.spin ? 0.45 : 0.1);
        camera.position.set(0, 0.4, fitDistance(camera, params.spin ? 3.8 : 2.8) * lerp(1.15, 1, smooth(p)));
      }
      camera.lookAt(0, 0, 0);
    },
  };
}

/* ---------- Moon ---------- */

export function moon({ params }) {
  const { scene, camera, sun } = createStage({ background: 0x040609, ambient: 0.08, sun: 3 });
  scene.add(starfield(2500, 300, 21));
  const R = 2.4;
  // Indexed geometry, so the craters get smooth normals instead of facets.
  const geo = new THREE.SphereGeometry(R, 256, 128);
  const rand = rng(17);
  const craters = Array.from({ length: 70 }, () => ({
    dir: new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize(),
    size: 0.05 + rand() ** 2 * 0.22,
    depth: 0.02 + rand() * 0.05,
  }));
  const named = new THREE.Vector3(0.35, 0.3, 1).normalize();
  craters.push({ dir: named, size: 0.2, depth: 0.08 });
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let h = 0;
    for (const c of craters) {
      const d = v.angleTo(c.dir) / c.size;
      if (d < 1) h -= c.depth * (1 - d * d);
      else if (d < 1.4) h += c.depth * 0.35 * Math.sin(((d - 1) / 0.4) * Math.PI);
    }
    v.multiplyScalar(R * (1 + h));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xa29d93, roughness: 1 }));
  scene.add(body);

  let marker = null;
  if (params.label) {
    marker = new THREE.Group();
    const circle = ring(0.55, 0.02, shine(COLORS.gold, 1.4));
    circle.position.copy(named).multiplyScalar(R * 1.01);
    circle.lookAt(named.clone().multiplyScalar(10));
    const tag = label(params.label, { size: 0.24 });
    tag.position.copy(named).multiplyScalar(R * 1.01).add(new THREE.Vector3(0, 0.85, 0.2));
    marker.add(circle, tag);
    scene.add(marker);
  }
  const phaseTag = params.phases ? label('Фазы Луны', { size: 0.3 }) : null;
  if (phaseTag) {
    phaseTag.position.set(0, R + 0.45, 0);
    scene.add(phaseTag);
  }

  return {
    scene,
    camera,
    update({ t, p }) {
      body.rotation.y = params.phases ? t * 0.03 : 0;
      if (params.phases) {
        const a = lerp(Math.PI * 0.9, Math.PI * 0.05, smooth(p));
        sun.position.set(Math.sin(a) * 10, 2, Math.cos(a) * 10);
        camera.position.set(0, 0.3, fitDistance(camera, R + 1));
        camera.lookAt(0, 0.2, 0);
      } else {
        sun.position.set(-6, 3, 7);
        const focus = named.clone().multiplyScalar(R);
        const far = new THREE.Vector3(0, 0, fitDistance(camera, R + 0.4));
        const near = named.clone().multiplyScalar(R + 4.4);
        camera.position.copy(far).lerp(near, smooth((p - 0.15) / 0.75));
        camera.lookAt(new THREE.Vector3().lerp(focus, smooth((p - 0.15) / 0.75)));
        if (marker) fade(marker, stage(p, 0.45, 0.65));
      }
    },
  };
}

/* ---------- City ---------- */

function mosque(dome, scale = 1, minarets = 2) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 2.2), matte(0xd9c7a2));
  base.position.y = 0.45;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.35, 32), matte(0xd2bf98));
  drum.position.y = 1.05;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.86, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), metal(dome, 0.45, 0.4));
  cap.position.y = 1.2;
  g.add(base, drum, cap);
  for (let i = 0; i < minarets; i++) {
    const a = (i / minarets) * Math.PI * 2 + Math.PI / 4;
    const m = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.8, 12), matte(0xe0d2b4));
    shaft.position.y = 1.4;
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 12), metal(dome, 0.5, 0.3));
    top.position.y = 3.05;
    m.add(shaft, top);
    m.position.set(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5);
    g.add(m);
  }
  g.scale.setScalar(scale);
  return g;
}

export function city({ params }) {
  const { scene, camera, sun } = createStage({ background: 0x141a26, fog: [18, 40], ambient: 0.7, sun: 1.8 });
  sun.position.set(-10, 5, 4);
  sun.color.set(0xffc58a);
  scene.add(skyDome(0x0e1726, 0xd88b4c));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 64), matte(0xae9067));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const rand = rng(params.name?.length ?? 9);
  const variant = params.variant;
  const color = houseColors(4);
  const count = 260;
  const houses = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), matte(0xffffff), count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    let x;
    let z;
    if (variant === 'ideal') {
      const ringIndex = 1 + (i % 4);
      const a = (i / count) * Math.PI * 2 * 4 + ringIndex;
      x = Math.cos(a) * (1.6 + ringIndex * 1.35);
      z = Math.sin(a) * (1.6 + ringIndex * 1.35);
    } else {
      const r = 2 + Math.sqrt(rand()) * 5.2;
      const a = rand() * Math.PI * 2;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    }
    const w = 0.35 + rand() * 0.45;
    const h = variant === 'ideal' ? 0.45 : 0.25 + rand() * 0.55;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), variant === 'ideal' ? -Math.atan2(z, x) : rand() * 0.4);
    m.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(w, h, w * (0.8 + rand() * 0.4)));
    houses.setMatrixAt(i, m);
    houses.setColorAt(i, new THREE.Color(color()));
  }
  scene.add(houses);

  // City wall with towers.
  const wallMat = matte(0x9c8261);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.7, 0.25), wallMat);
    seg.position.set(Math.cos(a) * 7.8, 0.35, Math.sin(a) * 7.8);
    seg.rotation.y = -a + Math.PI / 2;
    scene.add(seg);
    if (i % 6 === 0) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.1, 12), wallMat);
      tower.position.set(Math.cos(a) * 7.8, 0.55, Math.sin(a) * 7.8);
      scene.add(tower);
    }
  }

  const istanbul = params.name === 'Стамбул';
  const centerDome = variant === 'ideal' ? COLORS.gold : istanbul ? 0x8d97a3 : 0x2f8f8a;
  scene.add(mosque(centerDome, istanbul ? 1.5 : 1.15, istanbul ? 4 : 2));
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2;
    const r = 3 + rand() * 3;
    const small = mosque(i % 2 ? 0x2f8f8a : COLORS.gold, 0.45, 1);
    small.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    scene.add(small);
  }
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const r = 1.8 + rand() * 5.5;
    const lamp = glow(0xffb45e, 0.5, 0.8);
    lamp.position.set(Math.cos(a) * r, 0.5 + rand() * 0.4, Math.sin(a) * r);
    scene.add(lamp);
  }
  if (variant === 'ideal') {
    const beam = glow(0xffe3a0, 6, 0.35);
    beam.position.y = 3;
    scene.add(beam);
  }

  const tag = label(params.name ?? 'Город', { size: 0.5 });
  tag.position.set(0, 4.6, 0);
  scene.add(tag);

  // Ar-Razi's meat test: pieces hang across the city, all but one spoil.
  const meat = [];
  let verdict = null;
  if (variant === 'meat') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const g = new THREE.Group();
      g.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.8, 0), 0.03, matte(0x4b3a29)));
      const piece = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.2), new THREE.MeshStandardMaterial({ color: 0xd2453b, roughness: 0.6 }));
      piece.position.y = 1.5;
      const halo = glow(0xff6b5b, 0.9, 0.6);
      halo.position.y = 1.5;
      g.add(piece, halo);
      g.position.set(Math.cos(a) * 4.6, 0, Math.sin(a) * 4.6);
      scene.add(g);
      meat.push({ piece, halo, g });
    }
    verdict = label('Здесь воздух чище всего', { size: 0.3 });
    scene.add(verdict);
  }

  const fresh = new THREE.Color(0xd2453b);
  const spoiled = new THREE.Color(0x4b3b2c);
  return {
    scene,
    camera,
    update({ t, p }) {
      meat.forEach((m, i) => {
        if (i === 2) {
          m.halo.material.opacity = 0.5 + stage(p, 0.7, 0.9) * 0.5;
          m.halo.scale.setScalar(0.9 + stage(p, 0.7, 0.9) * 1.2);
          return;
        }
        const f = stage(p, 0.25 + i * 0.12, 0.4 + i * 0.12);
        m.piece.material.color.copy(fresh).lerp(spoiled, f);
        m.halo.material.opacity = 0.6 * (1 - f);
      });
      if (verdict) {
        verdict.position.copy(meat[2].g.position).add(new THREE.Vector3(0, 2.4, 0));
        fade(verdict, stage(p, 0.78, 0.9));
      }
      orbit(camera, new THREE.Vector3(0, 0.8, 0), fitDistance(camera, 8.2) * lerp(1, 0.82, smooth(p)), t * 0.04, lerp(0.75, 0.48, smooth(p)));
    },
  };
}

/* ---------- Fortress on a mountain ---------- */

export function fortress({ params }) {
  const { scene, camera, sun } = createStage({ background: 0x1b1d2b, fog: [14, 46], ambient: 0.55, sun: 1.9 });
  sun.position.set(-8, 6, 5);
  sun.color.set(0xffc996);
  scene.add(skyDome(0x151a2d, 0xc9845a));
  const profile = [[7.5, 0], [6.5, 0.7], [5.2, 1.6], [4.1, 2.6], [3.1, 3.4], [2.5, 3.95], [2.3, 4.1], [0, 4.1]];
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 96);
  const pos = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = Math.sin(x * 2.1 + z * 1.3) * Math.cos(z * 2.7 - y * 1.9) * 0.25 + Math.sin(x * 5.3 + y * 4.1) * 0.08;
    const k = y > 4 ? 1 : 1 + n * 0.35;
    pos.setXYZ(i, x * k, y, z * k);
    const c = new THREE.Color(0x6f6457).lerp(new THREE.Color(0xa79a86), clamp(y / 4.1 + n));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));

  const dark = params.name === 'Амид';
  const stoneMat = matte(dark ? 0x3b3734 : 0xb09d7f);
  const keep = new THREE.Group();
  keep.position.y = 4.1;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.16), stoneMat);
    seg.position.set(Math.cos(a) * 1.9, 0.27, Math.sin(a) * 1.9);
    seg.rotation.y = -a + Math.PI / 2;
    keep.add(seg);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.95, 12), stoneMat);
    tower.position.set(Math.cos(a) * 1.9, 0.47, Math.sin(a) * 1.9);
    keep.add(tower);
    for (let j = 0; j < 6; j++) {
      const b = (j / 6) * Math.PI * 2;
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), stoneMat);
      merlon.position.set(tower.position.x + Math.cos(b) * 0.22, 1.0, tower.position.z + Math.sin(b) * 0.22);
      keep.add(merlon);
    }
  }
  const donjon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 1.6, 16), stoneMat);
  donjon.position.y = 0.8;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.7, 16), matte(0x5b3b2a));
  roof.position.y = 1.95;
  const lit = glow(0xffb45e, 0.5, 0.9);
  lit.position.set(0, 1.1, 0.6);
  keep.add(donjon, roof, lit);
  scene.add(keep);

  const clouds = [];
  const rand = rng(31);
  for (let i = 0; i < 14; i++) {
    const c = glow(0xc8c2d6, 4 + rand() * 4, 0.12);
    c.material.blending = THREE.NormalBlending;
    c.position.set((rand() - 0.5) * 16, 1 + rand() * 2.2, (rand() - 0.5) * 16);
    scene.add(c);
    clouds.push(c);
  }
  const tag = label(params.name ?? 'Крепость', { size: 0.42 });
  tag.position.set(0, 7, 0);
  scene.add(tag);

  return {
    scene,
    camera,
    update({ t, p }) {
      clouds.forEach((c, i) => {
        c.position.x += Math.sin(i) * 0.002;
      });
      lit.material.opacity = 0.7 + Math.sin(t * 3) * 0.2;
      orbit(camera, new THREE.Vector3(0, 3.2, 0), fitDistance(camera, 6.5) * lerp(1.1, 0.75, smooth(p)), 0.4 + t * 0.03, lerp(0.15, 0.32, smooth(p)));
    },
  };
}

/* ---------- Ruins ---------- */

export function ruins() {
  const { scene, camera, sun } = createStage({ background: 0x2b2620, fog: [10, 36], ambient: 0.7, sun: 2 });
  sun.position.set(-9, 3, 3);
  sun.color.set(0xffc07a);
  scene.add(skyDome(0x45505f, 0xd9b27c));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), matte(0xb99a6d));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const rand = rng(44);
  const stone = matte(0xcfc0a2);
  for (let i = 0; i < 14; i++) {
    const h = 0.4 + rand() * 2.4;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, h, 14), stone);
    col.position.set(-6 + (i % 7) * 2, h / 2, i < 7 ? -2 : 1.5);
    col.rotation.z = (rand() - 0.5) * 0.12;
    scene.add(col);
  }
  for (let i = 0; i < 6; i++) {
    const fallen = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 1 + rand() * 1.5, 14), stone);
    fallen.rotation.z = Math.PI / 2;
    fallen.rotation.y = rand() * Math.PI;
    fallen.position.set((rand() - 0.5) * 10, 0.22, (rand() - 0.5) * 6);
    scene.add(fallen);
  }
  const arc = new THREE.Mesh(new THREE.TorusGeometry(4, 0.3, 10, 64, Math.PI * 0.38), matte(0xe5dccb));
  arc.position.set(1.5, -1.2, -4);
  arc.rotation.z = 0.25;
  scene.add(arc);
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), stone, 50);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 50; i++) {
    const s = 0.15 + rand() * 0.4;
    m.compose(
      new THREE.Vector3((rand() - 0.5) * 14, s / 2, (rand() - 0.5) * 9),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(), rand(), rand())),
      new THREE.Vector3(s, s * 0.7, s),
    );
    blocks.setMatrixAt(i, m);
  }
  scene.add(blocks);
  const sand = dust(500, [24, 3, 14], 0xf1d9a8, 9);
  scene.add(sand);

  return {
    scene,
    camera,
    update({ t, p }) {
      sand.userData.update(t * 2.5);
      const x = lerp(-4, 4, smooth(p));
      camera.position.set(x, 2.2, fitDistance(camera, 4.5));
      camera.lookAt(x * 0.4, 1, -1);
    },
  };
}

/* ---------- Comet over the city ---------- */

export function comet() {
  const { scene, camera } = createStage({ background: 0x05080f, ambient: 0.25, sun: 0.4 });
  scene.add(skyDome(0x04070d, 0x1f2c47), starfield(3000, 300, 5));
  const rand = rng(77);
  const dark = new THREE.MeshBasicMaterial({ color: 0x0b0f17 });
  for (let i = 0; i < 40; i++) {
    const w = 0.4 + rand() * 1.2;
    const h = 0.3 + rand() * 1;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), dark);
    b.position.set(-12 + i * 0.62, h / 2, -6 - rand());
    scene.add(b);
  }
  for (const [x, r] of [[-5, 1.1], [1.5, 1.5], [7, 0.9]]) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), dark);
    dome.position.set(x, 1.1, -6.5);
    scene.add(dome);
    for (const dx of [-1.8, 1.8]) {
      const minaret = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.6 * r, 8), dark);
      minaret.position.set(x + dx * r, 1.8 * r, -6.4);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 8), dark);
      tip.position.set(x + dx * r, 3.6 * r + 0.2, -6.4);
      scene.add(minaret, tip);
    }
  }
  for (let i = 0; i < 30; i++) {
    const light = glow(0xffb45e, 0.18, 0.9);
    light.position.set(-12 + rand() * 24, 0.2 + rand() * 0.8, -5.6);
    scene.add(light);
  }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), new THREE.MeshStandardMaterial({ color: 0x0a1624, roughness: 0.3, metalness: 0.6 }));
  water.rotation.x = -Math.PI / 2;
  water.position.z = 3;
  scene.add(water);

  const head = new THREE.Group();
  head.add(glow(0xdff3ff, 1.4, 1), glow(0x9fd4ff, 4, 0.35));
  const tailCount = 900;
  const tailPos = new Float32Array(tailCount * 3);
  for (let i = 0; i < tailCount; i++) {
    const f = rand() ** 1.6;
    const spread = f * 1.2;
    tailPos.set([f * 9 + (rand() - 0.5) * 0.3, f * 2.5 + (rand() - 0.5) * spread, (rand() - 0.5) * spread], i * 3);
  }
  const tailGeo = new THREE.BufferGeometry();
  tailGeo.setAttribute('position', new THREE.BufferAttribute(tailPos, 3));
  const tail = new THREE.Points(tailGeo, new THREE.PointsMaterial({ size: 0.09, color: 0xbfe3ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  head.add(tail);
  scene.add(head);
  const tag = label('Большая комета 1577 года', { size: 0.6 });
  scene.add(tag);

  return {
    scene,
    camera,
    update({ t, p }) {
      head.position.set(lerp(-7, -2, p), lerp(6.5, 7.2, p), -10);
      tail.rotation.x = Math.sin(t * 0.3) * 0.03;
      tag.position.set(head.position.x + 2.5, head.position.y - 1.4, -9);
      fade(tag, stage(p, 0.1, 0.25));
      camera.position.set(Math.sin(t * 0.05) * 0.6, 1.6, fitDistance(camera, 7.5) * 0.8);
      camera.lookAt(0, 4, -8);
    },
  };
}

/* ---------- Halls: court, madrasa, library ---------- */

function colonnade(scene, { length = 12, spacing = 2.4, x = 3.2, height = 4.2, material }) {
  for (const side of [-1, 1]) {
    for (let z = length / 2; z >= -length / 2; z -= spacing) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, height, 16), material);
      col.position.set(side * x, height / 2, z);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.55), material);
      cap.position.set(side * x, height + 0.1, z);
      scene.add(col, cap);
      if (z - spacing >= -length / 2 - 0.01) {
        const arch = tube(pointedArch(spacing, 1.2), 0.09, material, 60);
        arch.rotation.y = Math.PI / 2;
        arch.position.set(side * x, height + 0.2, z - spacing / 2);
        scene.add(arch);
      }
    }
  }
}

function lightShafts(scene, count = 4, color = 0xffd9a0) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < count; i++) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.6, 9, 24, 1, true), mat);
    shaft.position.set(i % 2 ? 2.2 : -2.2, 4, 4 - i * 3);
    shaft.rotation.z = i % 2 ? 0.45 : -0.45;
    scene.add(shaft);
  }
}

function carpetTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#7d1f22';
  g.fillRect(0, 0, 256, 1024);
  g.strokeStyle = '#d6ab55';
  g.lineWidth = 10;
  g.strokeRect(14, 14, 228, 996);
  g.lineWidth = 4;
  for (let y = 80; y < 1000; y += 140) {
    g.beginPath();
    g.moveTo(128, y - 50);
    g.lineTo(178, y);
    g.lineTo(128, y + 50);
    g.lineTo(78, y);
    g.closePath();
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function openBook(cover = 0x7d2a22) {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const half = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.7), matte(cover, 0.7));
    board.position.x = side * 0.25;
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.64), new THREE.MeshStandardMaterial({ color: 0xf3e8cf, emissive: 0xf3e2b8, emissiveIntensity: 0.25 }));
    pages.position.set(side * 0.24, 0.035, 0);
    half.add(board, pages);
    half.rotation.z = side * -0.25;
    g.add(half);
  }
  return g;
}

function bookshelves(scene, rand) {
  const count = 600;
  const spines = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), matte(0xffffff, 0.8), count);
  const palette = [0x7d2a22, 0x2c4f3e, 0x2b3f6b, 0x8a6a2a, 0x5a2e4f, 0x3f2a1d];
  const m = new THREE.Matrix4();
  let i = 0;
  for (const side of [-1, 1]) {
    for (let shelf = 0; shelf < 5; shelf++) {
      let z = -6;
      while (z < 6 && i < count) {
        const w = 0.08 + rand() * 0.07;
        const h = 0.45 + rand() * 0.2;
        m.compose(new THREE.Vector3(side * 4.9, 0.4 + shelf * 0.75 + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(0.3, h, w));
        spines.setMatrixAt(i, m);
        spines.setColorAt(i, new THREE.Color(palette[Math.floor(rand() * palette.length)]));
        z += w + 0.01;
        i += 1;
      }
    }
  }
  spines.count = i;
  scene.add(spines);
  for (const side of [-1, 1]) {
    for (let shelf = 0; shelf <= 5; shelf++) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 12.2), matte(COLORS.wood));
      board.position.set(side * 4.9, 0.38 + shelf * 0.75, 0);
      scene.add(board);
    }
  }
}

function hallFloor(scene, color = 0x2a2420) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 20), matte(color, 0.8));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
}

export function court({ params }) {
  if (params.variant === 'madrasa') return madrasa();
  const { scene, camera } = createStage({ background: 0x0e0c0b, fog: [8, 24], ambient: 0.45, sun: 0.6 });
  hallFloor(scene);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 14), new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 1 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.01, 1);
  scene.add(carpet);
  colonnade(scene, { material: matte(0xc9b994) });
  lightShafts(scene);

  const throne = new THREE.Group();
  throne.position.z = -5.2;
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(3.4 - i * 0.6, 0.22, 2 - i * 0.3), matte(0xd8c8a6));
    step.position.y = 0.11 + i * 0.22;
    throne.add(step);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.8), metal(COLORS.gold, 0.35, 0.8));
  seat.position.y = 0.9;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 0.15), metal(COLORS.gold, 0.35, 0.8));
  back.position.set(0, 1.5, -0.35);
  throne.add(seat, back);
  for (const [x, z] of [[-0.8, 0.5], [0.8, 0.5], [-0.8, -0.6], [0.8, -0.6]]) {
    throne.add(rod(new THREE.Vector3(x, 0.66, z), new THREE.Vector3(x, 2.9, z), 0.04, metal(COLORS.gold)));
  }
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), metal(COLORS.gold, 0.4, 0.7));
  canopy.position.y = 2.9;
  canopy.scale.y = 0.6;
  throne.add(canopy, glow(COLORS.gold, 5, 0.25));
  scene.add(throne);

  const wall = new THREE.Mesh(new THREE.BoxGeometry(12, 9, 0.3), matte(0x2e2622));
  wall.position.set(0, 4.5, -7.2);
  const archLine = tube(pointedArch(4.2, 2.4), 0.08, shine(COLORS.gold, 0.7), 80);
  archLine.position.set(0, 3.6, -7);
  scene.add(wall, archLine);

  const lamps = [];
  for (let i = 0; i < 8; i++) {
    const x = i % 2 ? 1.6 : -1.6;
    const z = 5 - Math.floor(i / 2) * 3;
    const lamp = glow(0xffc070, 0.9, 0.9);
    lamp.position.set(x, 3.4, z);
    scene.add(lamp, rod(new THREE.Vector3(x, 3.45, z), new THREE.Vector3(x, 7, z), 0.008, matte(0x8a6a3a)));
    const light = new THREE.PointLight(0xffb060, 6, 6);
    light.position.copy(lamp.position);
    scene.add(light);
    lamps.push(lamp);
  }
  const motes = dust(260, [6, 6, 14], 0xffe2a8);
  scene.add(motes);

  return {
    scene,
    camera,
    update({ t, p }) {
      motes.userData.update(t);
      lamps.forEach((l, i) => (l.material.opacity = 0.75 + Math.sin(t * 3 + i) * 0.15));
      const z = lerp(10, 2.2, smooth(p));
      camera.position.set(Math.sin(t * 0.1) * 0.3, 1.9, z);
      camera.lookAt(0, 1.6, -5);
    },
  };
}

function tileTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1f5f7a';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#d6ab55';
  g.lineWidth = 3;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const cx = 64 + i * 128;
      const cy = 64 + j * 128;
      g.beginPath();
      for (let k = 0; k < 16; k++) {
        const r = k % 2 ? 34 : 52;
        const a = (k / 16) * Math.PI * 2;
        g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.closePath();
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function madrasa() {
  const { scene, camera, sun } = createStage({ background: 0x111826, fog: [14, 40], ambient: 0.6, sun: 1.4 });
  sun.position.set(-6, 8, 6);
  sun.color.set(0xffd0a0);
  scene.add(skyDome(0x0d1424, 0x6b5a7a), starfield(1200, 300));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), matte(0xbfa77e));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const tiles = tileTexture();
  tiles.repeat.set(4, 3);
  const tileMat = new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.6 });
  const facade = new THREE.Mesh(new THREE.BoxGeometry(10, 6.5, 0.8), tileMat);
  facade.position.set(0, 3.25, -6);
  const opening = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.6, 0.2), matte(0x0c1018));
  opening.position.set(0, 2.3, -5.55);
  const outline = tube(pointedArch(3.8, 1.8), 0.1, shine(COLORS.gold, 0.8), 80);
  outline.position.set(0, 3.6, -5.5);
  scene.add(facade, opening, outline);
  for (const side of [-1, 1]) {
    const minaret = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 9, 24), tileMat);
    minaret.position.set(side * 5.6, 4.5, -6);
    const band = ring(0.46, 0.06, metal(COLORS.gold));
    band.rotation.x = Math.PI / 2;
    band.position.set(side * 5.6, 7.6, -6);
    scene.add(minaret, band);
    for (let i = 0; i < 4; i++) {
      const arch = tube(pointedArch(1.6, 0.8), 0.06, matte(0xe3d6b8), 40);
      arch.rotation.y = Math.PI / 2;
      arch.position.set(side * 6.5, 2.2, 3 - i * 2);
      scene.add(arch);
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.2, 0.3), matte(0xe3d6b8));
      pier.position.set(side * 6.5, 1.1, 3.8 - i * 2);
      scene.add(pier);
    }
  }
  const lantern = glow(0xffc070, 1.5, 0.9);
  lantern.position.set(0, 2.2, -5.3);
  scene.add(lantern);
  for (let i = 0; i < 6; i++) {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.4), matte(COLORS.wood));
    stand.position.set(-2.5 + i, 0.25, -1 + (i % 2) * 1.2);
    const book = openBook(0x2b3f6b);
    book.scale.setScalar(0.6);
    book.position.set(stand.position.x, 0.55, stand.position.z);
    scene.add(stand, book);
  }

  return {
    scene,
    camera,
    update({ t, p }) {
      lantern.material.opacity = 0.8 + Math.sin(t * 2.5) * 0.15;
      const d = fitDistance(camera, 6.8);
      camera.position.set(Math.sin(t * 0.07) * 1.2, lerp(2.6, 1.8, smooth(p)), -6 + d * lerp(1.1, 0.85, smooth(p)));
      camera.lookAt(0, 3.4, -6);
    },
  };
}

export function library({ params }) {
  const variant = params.variant ?? 'default';
  const night = variant === 'night';
  const { scene, camera } = createStage({ background: 0x0d0b0a, fog: [7, 22], ambient: night ? 0.08 : 0.5, sun: night ? 0.1 : 0.7 });
  const rand = rng(12);
  hallFloor(scene, 0x2b2117);
  bookshelves(scene, rand);
  if (!night) {
    colonnade(scene, { x: 3.1, material: matte(0xc9b994) });
    lightShafts(scene, 5);
  }
  const motes = dust(night ? 80 : 320, [8, 5, 12], 0xffe2a8);
  scene.add(motes);

  const floating = [];
  let candle = null;
  let focus = new THREE.Vector3(0, 2.2, -2);
  if (variant === 'single' || night) {
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1), matte(COLORS.wood, 0.7));
    table.position.set(0, 0.45, -2);
    const book = openBook(0x7d2a22);
    book.position.set(0, 0.95, -2);
    book.scale.setScalar(1.3);
    scene.add(table, book, glow(0xffe2a8, 2.2, night ? 0.35 : 0.6).translateY(1.15).translateZ(-2));
    focus = new THREE.Vector3(0, 1, -2);
    if (night) {
      candle = new THREE.Group();
      const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.35, 12), matte(0xf0e6cf));
      wax.position.y = 0.17;
      const flame = glow(0xffb347, 0.45, 1);
      flame.position.y = 0.42;
      const light = new THREE.PointLight(0xffa040, 8, 7);
      light.position.y = 0.5;
      candle.add(wax, flame, light);
      candle.position.set(0.55, 0.9, -2.2);
      candle.userData = { flame, light };
      scene.add(candle);
    }
  } else {
    const count = variant === 'many' ? 46 : 12;
    const palette = [0x7d2a22, 0x2c4f3e, 0x2b3f6b, 0x8a6a2a];
    for (let i = 0; i < count; i++) {
      const b = openBook(palette[i % palette.length]);
      b.userData = { a: rand() * Math.PI * 2, r: 0.8 + rand() * 1.8, y: 1 + rand() * 2.8, s: 0.15 + rand() * 0.25 };
      scene.add(b);
      floating.push(b);
    }
    const heart = glow(0xffe2a8, 4, 0.35);
    heart.position.copy(focus);
    scene.add(heart);
  }

  return {
    scene,
    camera,
    update({ t, p }) {
      motes.userData.update(t);
      floating.forEach((b, i) => {
        const d = b.userData;
        const a = d.a + t * d.s;
        b.position.set(Math.cos(a) * d.r, d.y + Math.sin(t * 0.6 + i) * 0.15, -2 + Math.sin(a) * d.r);
        b.rotation.set(Math.sin(t * 0.5 + i) * 0.3, -a, Math.cos(t * 0.4 + i) * 0.2);
      });
      if (candle) {
        const f = 0.85 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23) * 0.05;
        candle.userData.flame.scale.setScalar(0.45 * f);
        candle.userData.light.intensity = 8 * f;
      }
      const close = variant === 'single' || night;
      const z = lerp(close ? 4 : 9, close ? 0.6 : 3.5, smooth(p));
      camera.position.set(Math.sin(t * 0.08) * 0.5, close ? lerp(2, 1.5, smooth(p)) : 2, z);
      camera.lookAt(focus);
    },
  };
}
