// Al-Biruni measures the Earth at Nandana, as he describes it: he sights
// the top of the mountain twice from the plain to find its height, climbs
// up, measures how far the horizon dips below the horizontal, and the
// triangle Earth's centre — summit — horizon gives the radius.
import {
  THREE, createStage, label, fade, glow, starfield, dust, rod, stage, smooth, lerp, clamp, rng, skyDome,
} from '../kit.js';
import { createFigure, alongPath } from '../figure.js';
import { createActor, screenFacing } from '../actor.js';

const MOUNT = new THREE.Vector2(0, -40); // x, z of the summit
const PEAK = 22;

// Height of the ground: a plain with soft hills and the Nandana mountain.
function groundHeight(x, z) {
  const dx = x - MOUNT.x;
  const dz = z - MOUNT.y;
  const d2 = dx * dx + dz * dz * 0.7;
  const mountain = PEAK * Math.exp(-d2 / (2 * 13 * 13));
  const ridge = 4 * Math.exp(-((dz + 4) ** 2) / 90) * Math.exp(-(dx * dx) / 1600);
  const hills = Math.sin(x * 0.05) * Math.cos(z * 0.04) * 0.6 + Math.sin(x * 0.13 + z * 0.07) * 0.25;
  return mountain + ridge + hills * clamp(Math.hypot(dx, dz) / 30);
}

function terrain() {
  const size = 420;
  const geo = new THREE.PlaneGeometry(size, size, 220, 220);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const grass = new THREE.Color(0x56622f);
  const dry = new THREE.Color(0x857451);
  const rock = new THREE.Color(0x6f6457);
  const top = new THREE.Color(0x9a8f80);
  const patch = new THREE.Color(0x3f4a24);
  const rand = rng(5);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = groundHeight(x, z);
    pos.setY(i, y);
    const h = y / PEAK;
    const n = Math.sin(x * 0.31) * Math.cos(z * 0.27) + Math.sin(x * 0.11 - z * 0.17);
    const c = grass.clone().lerp(patch, clamp(n * 0.5 + 0.2) * 0.6).lerp(dry, clamp(h * 1.8 + n * 0.12 + (rand() - 0.5) * 0.25))
      .lerp(rock, clamp((h - 0.3) * 1.8 + n * 0.15)).lerp(top, clamp((h - 0.82) * 4));
    c.multiplyScalar(0.92 + rand() * 0.12);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  mesh.receiveShadow = true;
  return mesh;
}

function fortress() {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xc8a978, roughness: 0.9 });
  const parts = [[0, 0, 0, 6, 2.2, 3.5], [-3.4, 0, 0, 1.4, 3.2, 1.4], [3.4, 0, 0, 1.4, 3.2, 1.4], [0, 2.2, 0, 2.4, 1.2, 2.2]];
  for (const [x, y, z, w, h, d] of parts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  for (let i = -2; i <= 2; i++) {
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), stone);
    merlon.position.set(i * 1.2, 2.4, 1.6);
    g.add(merlon);
  }
  return g;
}

// A thick glowing line between two points.
function beam(color, radius = 0.05) {
  const m = rod(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), radius, new THREE.MeshBasicMaterial({ color, transparent: true }));
  m.renderOrder = 5;
  return m;
}
function setBeam(m, a, b) {
  const dir = b.clone().sub(a);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.scale.y = dir.length();
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
}

export function biruniMeasure({ params = {}, ctx }) {
  const { scene, camera, sun, hemi } = createStage({ background: 0x9fb4c8, ambient: 0.75, sun: 2.2 });
  scene.background = new THREE.Color(0xa9b9c6);
  const landFog = new THREE.Fog(0xc2c8c6, 50, 220);
  scene.fog = landFog;
  hemi.color.set(0xdfe8f0);
  hemi.groundColor.set(0x6b5a3a);
  sun.color.set(0xffd9a8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14;
  sun.shadow.camera.bottom = -14;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0005;
  scene.add(sun.target);

  const land = new THREE.Group();
  scene.add(land);
  land.add(terrain());
  const fort = fortress();
  fort.position.set(MOUNT.x + 3, groundHeight(MOUNT.x + 3, MOUNT.y - 3) - 0.4, MOUNT.y - 3);
  land.add(fort);
  // Rocks and shrubs on the plain.
  const rand = rng(17);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.9 });
  const shrubMat = new THREE.MeshStandardMaterial({ color: 0x5a6a2a, roughness: 1 });
  for (let i = 0; i < 420; i++) {
    const x = (rand() - 0.5) * 90;
    const z = 28 - rand() * 90;
    const shrub = rand() < 0.6;
    const m = new THREE.Mesh(shrub ? new THREE.IcosahedronGeometry(0.25 + rand() * 0.35, 0) : new THREE.DodecahedronGeometry(0.15 + rand() * 0.3, 0), shrub ? shrubMat : rockMat);
    m.position.set(x, groundHeight(x, z) + 0.1, z);
    m.castShadow = true;
    land.add(m);
  }
  land.add(skyDome(0x5f87b5, 0xe8d9bc, 300));
  const sunGlow = glow(0xfff0d0, 40, 0.7);
  sunGlow.position.set(-120, 60, -160);
  land.add(sunGlow);
  const motes = dust(200, [30, 8, 30], 0xfff0d8, 3);
  land.add(motes);

  // Al-Biruni with his astrolabe: a realistic figure (photos of him walking,
  // sighting with the astrolabe and standing on the summit); the simple 3D
  // figure only while those pictures are not drawn yet.
  const poses = params.cast ?? {};
  const actor = poses.walk && poses.sight ? createActor(poses, { height: 1.85 }) : null;
  const biruni = actor ?? createFigure(params.who ?? 'al-biruni', { prop: 'astrolabe' });
  scene.add(biruni.root);
  // What he does: a pose of the photos or of the 3D figure, and where he faces.
  const DO = { walk: 'down', sight: 'sight', summit: 'sight' };
  const act = (what, walking, toward, look) => {
    if (actor) actor.pose(what).set({ walking, face: screenFacing(camera, toward) });
    else biruni.set({ walk: walking, right: DO[what], look });
  };
  const eye = (pos) => pos.clone().add(new THREE.Vector3(0, 1.62, 0));

  const S = new THREE.Vector3(MOUNT.x, groundHeight(MOUNT.x, MOUNT.y), MOUNT.y);
  const A = new THREE.Vector3(7, 0, 16);
  const B = new THREE.Vector3(4.5, 0, 6);
  const start = new THREE.Vector3(12, 0, 24);
  for (const p of [A, B, start]) p.y = groundHeight(p.x, p.z);
  // Path up the mountain, winding on the gentle side.
  const climb = [B, new THREE.Vector3(6, 0, -8), new THREE.Vector3(4, 0, -20), new THREE.Vector3(5.5, 0, -30), new THREE.Vector3(2, 0, -36), new THREE.Vector3(0.6, 0, -39.4)]
    .map((p) => p.setY(groundHeight(p.x, p.z)));
  const top = climb.at(-1);

  // Sight lines, the height of the mountain and the dip of the horizon.
  const sightA = beam(0xffd27a, 0.06);
  const sightB = beam(0xffd27a, 0.06);
  const height = beam(0xffffff, 0.08);
  const level = beam(0xffffff, 0.05);
  const horizon = beam(0xffc34d, 0.05);
  land.add(sightA, sightB, height, level, horizon);
  const tag = (text, size = 0.7) => {
    const s = label(text, { size, background: 'rgba(10,14,22,0.72)' });
    land.add(s);
    return s;
  };
  const tagA = tag('угол на вершину · 1');
  const tagB = tag('угол на вершину · 2');
  const tagH = tag('h — высота горы', 0.9);
  const tagLevel = tag('горизонталь', 0.4);
  const tagDip = tag('α ≈ 0°34′ — чуть больше половины градуса', 0.42);

  // ---- Space: the triangle centre of the Earth — summit — horizon.
  const space = new THREE.Group();
  space.position.set(0, 600, 0);
  scene.add(space);
  space.add(starfield(1500, 220, 11));
  const R = 8;
  const h = 2.6;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 72, 48), new THREE.MeshStandardMaterial({ color: 0x2a5d8f, roughness: 0.55, metalness: 0.05, emissive: 0x061424, transparent: true, opacity: 0.35, depthWrite: false }));
  // Cross-section through the centre, so the radius lines can be seen.
  const section = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshBasicMaterial({ color: 0x173a5c }));
  const sectionRim = new THREE.Mesh(new THREE.RingGeometry(R - 0.06, R + 0.06, 128), new THREE.MeshBasicMaterial({ color: 0x8fd0ff }));
  sectionRim.position.z = 0.02;
  space.add(section, sectionRim);
  const atmosphere = glow(0x6fb6ff, R * 2.5, 0.22);
  const mountain = new THREE.Mesh(new THREE.ConeGeometry(1.1, h, 24), new THREE.MeshStandardMaterial({ color: 0xa88f5a, roughness: 0.9 }));
  mountain.position.y = R + h / 2 - 0.05;
  atmosphere.position.z = -1;
  space.add(atmosphere, mountain);
  const theta = Math.acos(R / (R + h));
  const C = new THREE.Vector3(0, 0, 0);
  const Sk = new THREE.Vector3(0, R + h, 0);
  const T = new THREE.Vector3(R * Math.sin(theta), R * Math.cos(theta), 0);
  const lineMat = (c) => new THREE.MeshBasicMaterial({ color: c });
  const lines = [
    [C, T, 0xffffff, 'R'], [C, Sk, 0xffffff, 'R + h'], [Sk, T, 0xffc34d, ''], [Sk, Sk.clone().add(new THREE.Vector3(7, 0, 0)), 0xdddddd, ''],
  ].map(([a, b, color, text]) => {
    const m = rod(a, b, 0.07, lineMat(color));
    m.position.z += 0.08;
    space.add(m);
    let t = null;
    if (text) {
      t = label(text, { size: 0.7, background: 'rgba(10,14,22,0.7)' });
      t.position.copy(a.clone().lerp(b, 0.5)).add(new THREE.Vector3(text === 'R' ? 0.7 : -0.9, 0, 0.6));
      space.add(t);
    }
    return { m, t };
  });
  const formula = label('R = h · cos α / (1 − cos α)', { size: 0.85, color: '#fff3d0', background: 'rgba(10,14,22,0.8)' });
  formula.position.set(R + 7.5, 4.5, 0);
  const result = label('R ≈ 6340 км', { size: 1.4, color: '#ffe2a3', background: null });
  result.position.set(R + 7.5, 1.2, 0);
  const alpha = label('α', { size: 0.8, color: '#ffc34d', background: null });
  alpha.position.copy(Sk).add(new THREE.Vector3(1.6, -0.5, 0.6));
  space.add(formula, result, alpha);

  // A dark veil in front of the camera for the cut from the mountain to space.
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false }));
  veil.renderOrder = 50;
  camera.add(veil);
  veil.position.z = -0.5;
  scene.add(camera);

  const captions = [
    [0, 'Крепость Нандана'],
    [0.2, 'Шаг 1. С равнины: высота горы'],
    [0.46, 'Шаг 2. Подъём на вершину'],
    [0.6, 'Шаг 3. Насколько горизонт ниже горизонтали'],
    [0.8, 'Шаг 4. Треугольник: центр Земли — вершина — горизонт'],
  ];
  const caption = label(captions[0][1], { size: 0.075, template: captions[4][1] });
  camera.add(caption);
  caption.position.set(0, 0.6, -3);

  let first = true;
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const lerpV = (a, b, u) => a.clone().lerp(b, u);

  return {
    scene,
    camera,
    update({ t, dt, p }) {
      motes.userData.update(t);
      caption.userData.set(captions.filter(([at]) => p >= at).at(-1)[1]);

      // ---- Where he is and what he does.
      let pos;
      let yaw;
      const flat = (a, b) => new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
      if (p < 0.22) {
        const u = stage(p, 0.03, 0.2);
        pos = start.clone().lerp(A, u);
        yaw = Math.atan2(A.x - start.x, A.z - start.z);
        act(u > 0 && u < 1 ? 'walk' : 'sight', u > 0 && u < 1 ? 1 : 0, flat(start, A), S);
      } else if (p < 0.29) {
        pos = A.clone();
        yaw = Math.atan2(S.x - A.x, S.z - A.z);
        act('sight', 0, flat(A, S), S);
      } else if (p < 0.35) {
        const u = stage(p, 0.29, 0.345);
        pos = A.clone().lerp(B, u);
        yaw = Math.atan2(B.x - A.x, B.z - A.z);
        act('walk', 1, flat(A, B), S);
      } else if (p < 0.46) {
        pos = B.clone();
        yaw = Math.atan2(S.x - B.x, S.z - B.z);
        act('sight', 0, flat(B, S), S);
      } else if (p < 0.59) {
        const step = alongPath(climb, stage(p, 0.46, 0.585));
        pos = step.position;
        pos.y = groundHeight(pos.x, pos.z);
        yaw = step.yaw;
        act('walk', 1.25, new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), null);
      } else {
        pos = top.clone();
        yaw = Math.PI / 2; // facing east, over the plain
        act('summit', 0, new THREE.Vector3(1, 0, 0), top.clone().add(new THREE.Vector3(30, 0.5, 0)));
      }
      biruni.root.position.copy(pos);
      if (!actor) {
        biruni.root.rotation.y = yaw;
        biruni.update(t, dt);
      }

      // ---- Lines and labels.
      const showA = stage(p, 0.235, 0.26) * (1 - stage(p, 0.46, 0.5));
      // The beams start a little in front of his face, so they do not cover it.
      const ahead = (from) => eye(from).lerp(S, 0.6 / eye(from).distanceTo(S));
      setBeam(sightA, ahead(A), S);
      sightA.material.opacity = showA;
      sightA.visible = showA > 0.01;
      tagA.position.copy(eye(A).lerp(S, 0.35)).add(new THREE.Vector3(2.2, 0.8, 0));
      fade(tagA, showA);
      const showB = stage(p, 0.37, 0.4) * (1 - stage(p, 0.46, 0.5));
      setBeam(sightB, ahead(B), S);
      sightB.material.opacity = showB;
      sightB.visible = showB > 0.01;
      tagB.position.copy(eye(B).lerp(S, 0.45)).add(new THREE.Vector3(2.2, 0.8, 0));
      fade(tagB, showB);
      const showH = stage(p, 0.41, 0.45) * (1 - stage(p, 0.5, 0.54));
      const base = S.clone().setY(groundHeight(S.x + 9, S.z + 12));
      setBeam(height, base, S.clone().add(new THREE.Vector3(0, 0.3, 0)));
      height.material.opacity = showH;
      height.visible = showH > 0.01;
      tagH.position.copy(base.clone().lerp(S, 0.5)).add(new THREE.Vector3(-3.2, 0, 2));
      fade(tagH, showH);

      const topEye = eye(top);
      const showDip = stage(p, 0.66, 0.71) * (1 - stage(p, 0.77, 0.8));
      setBeam(level, topEye, topEye.clone().add(new THREE.Vector3(40, 0, 0)));
      // The dip is about half a degree; shown larger so it can be seen.
      setBeam(horizon, topEye, topEye.clone().add(new THREE.Vector3(40, -3.6, 0)));
      level.material.opacity = showDip;
      horizon.material.opacity = showDip;
      level.visible = horizon.visible = showDip > 0.01;
      tagLevel.position.copy(topEye).add(new THREE.Vector3(9, 0.55, 0));
      tagDip.position.copy(topEye).add(new THREE.Vector3(8, -1.6, 0));
      fade(tagLevel, showDip);
      fade(tagDip, stage(p, 0.69, 0.73) * (1 - stage(p, 0.77, 0.8)));

      // ---- Camera: plain, over his shoulder, the climb, the summit, space.
      const inSpace = p >= 0.785;
      land.visible = !inSpace;
      biruni.root.visible = !inSpace;
      space.visible = inSpace;
      scene.fog = inSpace ? null : landFog;
      scene.background.set(inSpace ? 0x04060c : 0xa9b9c6);
      if (!inSpace) {
        const wide = { pos: new THREE.Vector3(20, 4.5, 34), look: new THREE.Vector3(2, 8, -30) };
        // From his side: he is on the left, the mountain on the right.
        const toS = new THREE.Vector3(S.x - pos.x, 0, S.z - pos.z).normalize();
        const sideways = new THREE.Vector3(-toS.z, 0, toS.x);
        // Far enough back to hold both him and the summit, looking between them.
        const shoulderPos = pos.clone().addScaledVector(sideways, 6).addScaledVector(toS, -8).add(new THREE.Vector3(0, 1.7, 0));
        const toMan = pos.clone().add(new THREE.Vector3(0, 0.9, 0)).sub(shoulderPos).normalize();
        const toTopS = S.clone().sub(shoulderPos).normalize();
        const shoulder = { pos: shoulderPos, look: shoulderPos.clone().addScaledVector(toMan.add(toTopS).normalize(), 10) };
        const toTop = new THREE.Vector3(top.x - pos.x, 0, top.z - pos.z).normalize();
        const follow = {
          pos: pos.clone().addScaledVector(new THREE.Vector3(-toTop.z, 0, toTop.x), 7).addScaledVector(toTop, -3).add(new THREE.Vector3(0, 3, 0)),
          look: pos.clone().addScaledVector(toTop, 2).add(new THREE.Vector3(0, 1.3, 0)),
        };
        const summit = {
          pos: top.clone().add(new THREE.Vector3(-3.2, 2.4, 5.8)),
          look: top.clone().add(new THREE.Vector3(6, 0.6, 0)),
        };
        const blend = (a, b, u) => ({ pos: lerpV(a.pos, b.pos, u), look: lerpV(a.look, b.look, u) });
        let shot = blend(wide, shoulder, smooth(stage(p, 0.12, 0.24)));
        shot = blend(shot, follow, smooth(stage(p, 0.45, 0.5)));
        shot = blend(shot, summit, smooth(stage(p, 0.56, 0.63)));
        camPos.lerp(shot.pos, first ? 1 : 0.08);
        camLook.lerp(shot.look, first ? 1 : 0.08);
        first = false;
        camera.position.copy(camPos);
        camera.lookAt(camLook);
        // The sun's shadow follows him.
        sun.position.copy(pos).add(new THREE.Vector3(-18, 26, 10));
        sun.target.position.copy(pos);
        if (actor) actor.update(t, dt, camera);
      } else {
        const u = stage(p, 0.79, 1);
        space.updateMatrixWorld();
        const centre = space.position.clone().add(new THREE.Vector3(5, 2.5, 0));
        camera.position.copy(centre).add(new THREE.Vector3(Math.sin(t * 0.05) * 2, 0.5, lerp(40, 36, u)));
        camera.lookAt(centre);
        lines.forEach(({ m, t: tg }, i) => {
          const show = stage(p, 0.8 + i * 0.025, 0.84 + i * 0.025);
          fade(m, show);
          if (tg) fade(tg, show);
        });
        fade(alpha, stage(p, 0.86, 0.9));
        fade(formula, stage(p, 0.87, 0.91));
        fade(result, stage(p, 0.93, 0.97));
        result.material.opacity = stage(p, 0.93, 0.97) * (0.85 + 0.15 * Math.sin(t * 3));
      }
      // Dip to black around the cut.
      veil.material.opacity = Math.max(stage(p, 0.755, 0.785) * (1 - stage(p, 0.785, 0.8)), 0);
    },
  };
}
