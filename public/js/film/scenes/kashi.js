// Al-Kashi's π (1424): a circle drawn with a compass, polygons inscribed in
// it with ever more sides — 6, 12, 24, 48 … — the gap between side and arc
// shrinking each time, until 3·2²⁸ sides give π to sixteen decimal places.
import { THREE, label, fade, rod, tube, revealTube, stage, smooth, lerp, clamp, glow, fitDistance, SERIF } from '../kit.js';
import { parchment, brass } from '../materials.js';
import { study, studyStage, shadowed, digit } from './khwarizmi.js';

const RC = 2.2; // radius of the circle on the sheet
const KASHI = '3,1415926535897932';

export function pi() {
  const { scene, camera } = studyStage();
  const { lamp, motes } = study(scene);
  const right = new THREE.Vector3();
  const C = new THREE.Vector3(0.6, 0.04, 0.2);

  const sheet = shadowed(new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.03, 6.0), [null, null, Object.assign(parchment({ seed: 71, size: 1024 }), { color: new THREE.Color(0xb3a281) }), null, null, null].map((m) => m ?? new THREE.MeshStandardMaterial({ color: 0xcdb48a }))));
  sheet.position.copy(C).setY(0.015);
  scene.add(sheet);
  const onSheet = (x, z, y = 0.035) => new THREE.Vector3(C.x + x, y, C.z + z);

  // The circle, drawn in ink by the compass.
  const ring = [];
  for (let i = 0; i <= 240; i++) {
    const a = (i / 240) * Math.PI * 2;
    ring.push(onSheet(Math.sin(a) * RC, -Math.cos(a) * RC));
  }
  const ink = new THREE.MeshStandardMaterial({ color: 0x24140a, roughness: 0.4 });
  const circle = tube(ring, 0.022, ink, 480);
  revealTube(circle, 0);
  scene.add(circle);
  // The compass: a pin at the centre, a pen leg on the circle.
  const compass = new THREE.Group();
  const legMat = brass(0xc9a256, 0.28);
  const hinge = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), legMat);
  hinge.position.set(RC / 2, 2.0, 0);
  const legA = rod(new THREE.Vector3(0, 0, 0), hinge.position, 0.035, legMat);
  const legB = rod(new THREE.Vector3(RC, 0, 0), hinge.position, 0.035, legMat);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 12), legMat);
  grip.position.copy(hinge.position).add(new THREE.Vector3(0, 0.22, 0));
  compass.add(hinge, legA, legB, grip);
  compass.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  compass.position.copy(C).setY(0.04);
  scene.add(compass);

  // Inscribed polygons: each edge a thin rod, a new colour for each doubling.
  const colors = [0x1fa69a, 0x2f6fd0, 0x8a4fd0, 0xd09a2f];
  const polygons = [6, 12, 24, 48].map((n, k) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: colors[k], emissive: colors[k], emissiveIntensity: 0.55, roughness: 0.4 });
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push(onSheet(Math.sin(a) * RC, -Math.cos(a) * RC, 0.04 + k * 0.004));
    }
    const edges = pts.map((p, i) => {
      const e = rod(p, pts[(i + 1) % n], 0.018 - k * 0.002, mat);
      g.add(e);
      return e;
    });
    const dots = pts.map((p) => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.045 - k * 0.007, 12, 8), mat);
      d.position.copy(p);
      g.add(d);
      return d;
    });
    scene.add(g);
    return { n, g, edges, dots };
  });

  // The magnifier: one side and its arc, seen enlarged; the gap halves with each doubling.
  const lens = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CircleGeometry(1.25, 64), new THREE.MeshPhysicalMaterial({ color: 0x0c1418, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.78, clearcoat: 1 }));
  const frame = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.07, 16, 96), brass(0xc9a256, 0.25));
  lens.add(glass, frame);
  const arcMat = new THREE.MeshBasicMaterial({ color: 0xffe2a3 });
  const chordMat = new THREE.MeshBasicMaterial({ color: 0x7ff0e0 });
  const arc = new THREE.Mesh(new THREE.BufferGeometry(), arcMat);
  const chord = new THREE.Mesh(new THREE.BufferGeometry(), chordMat);
  const gapFill = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xff8a5a, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
  lens.add(gapFill, arc, chord);
  const gapTag = label('зазор', { size: 0.24, family: SERIF, weight: 700, color: '#ffb08a', background: null });
  gapTag.position.set(0, 0.6, 0.02);
  lens.add(gapTag);
  scene.add(lens);
  const L = 1.9; // chord length in the lens
  const setLens = (n) => {
    const half = Math.PI / n;
    const rho = L / (2 * Math.sin(half));
    const sag = rho * (1 - Math.cos(half));
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const a = -half + (2 * half * i) / 48;
      pts.push(new THREE.Vector3(Math.sin(a) * rho, Math.cos(a) * rho - rho + sag / 2 - 0.15, 0.02));
    }
    arc.geometry.dispose();
    arc.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.025, 6, false);
    const y0 = -sag / 2 - 0.15;
    chord.geometry.dispose();
    chord.geometry = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(-L / 2, y0, 0.02), new THREE.Vector3(L / 2, y0, 0.02)), 2, 0.025, 6, false);
    const shape = new THREE.Shape(pts.map((v) => new THREE.Vector2(v.x, v.y)));
    shape.lineTo(-L / 2, y0);
    gapFill.geometry.dispose();
    gapFill.geometry = new THREE.ShapeGeometry(shape);
  };
  let lensN = 0;

  const sides = label('сторон: 6', { size: 0.34, family: SERIF, weight: 700, color: '#fff1cf', background: 'rgba(20,12,6,0.66)', template: 'сторон: 3 · 2²⁸ = 805 306 368' });
  const value = label('π ≈ 3', { size: 0.42, family: SERIF, weight: 700, color: '#ffe2a3', background: 'rgba(20,12,6,0.7)', template: 'π ≈ 3,1415926535897932' });
  scene.add(sides, value);
  const year = label('Самарканд, 1424 год', { size: 0.4, family: SERIF, weight: 700, color: '#fbe7b5', background: 'rgba(20,12,6,0.6)' });
  scene.add(year);

  // Sixteen decimals in a row of tiles.
  const row = KASHI.split('').map((ch, i) => {
    const d = digit(ch === ',' ? ',' : ch);
    d.scale.setScalar(0.42);
    d.position.copy(onSheet((i - (KASHI.length - 1) / 2) * 0.4, RC + 0.75, 0.04));
    d.visible = false;
    scene.add(d);
    return d;
  });

  // Words on the screen.
  const steps = [
    [0, 'Как найти число π?', 'π = длина окружности : диаметр'],
    [0.13, 'Впишем в круг многоугольник', '6 сторон'],
    [0.29, 'Больше сторон — периметр ближе к окружности', '6 → 12 → 24 → 48'],
    [0.57, 'Аль-Каши удваивал стороны снова и снова', '3 · 2²⁸ = 805 306 368 сторон'],
    [0.83, '1424 год: шестнадцать знаков после запятой', 'π ≈ 3,1415926535897932'],
  ];
  const longest = steps.reduce((a, s) => (s[1].length > a.length ? s[1] : a), '');
  const widest = steps.reduce((a, s) => (s[2].length > a.length ? s[2] : a), '');
  const caption = label(steps[0][1], { size: 0.06, template: longest, background: 'rgba(14,9,5,0.66)' });
  const formula = label(steps[0][2], { size: 0.085, family: SERIF, weight: 700, color: '#ffe2a3', background: 'rgba(14,9,5,0.72)', template: widest });
  camera.add(caption, formula);

  const piOf = (n) => n * Math.sin(Math.PI / n);
  const fmt = (x, d) => x.toFixed(d).replace('.', ',');

  return {
    scene,
    camera,
    update({ t, p }) {
      motes.userData.update?.(t);
      lamp.update(t);

      // The compass draws the circle.
      const draw = clamp((p - 0.025) / 0.09);
      revealTube(circle, draw);
      const showCompass = stage(p, 0, 0.02) * (1 - stage(p, 0.12, 0.15));
      compass.visible = showCompass > 0.01;
      compass.position.y = 0.04 + (1 - showCompass) * 1.5;
      compass.rotation.y = -draw * Math.PI * 2 + Math.PI / 2;

      // Polygons: 6 is drawn side by side, then each doubling appears.
      const times = [[0.15, 0.27], [0.31, 0.36], [0.38, 0.43], [0.45, 0.5]];
      let n = 0;
      polygons.forEach((poly, k) => {
        const [a, b] = times[k];
        const u = clamp((p - a) / (b - a));
        poly.edges.forEach((e, i) => {
          e.visible = u * poly.n > i;
        });
        poly.dots.forEach((d, i) => {
          d.visible = u * poly.n > i;
        });
        // Older polygons fade back once a newer one is complete.
        const later = k < 3 ? stage(p, times[k + 1][1], times[k + 1][1] + 0.04) : stage(p, 0.6, 0.66);
        poly.g.children.forEach((m) => {
          m.material.transparent = true;
          m.material.opacity = 1 - later * 0.85;
        });
        if (u > 0) n = poly.n;
      });
      // From 48 on, the doublings run fast: 96, 192 … 3·2²⁸.
      const fast = clamp((p - 0.6) / 0.2);
      if (fast > 0) n = Math.round(48 * 2 ** (fast * 24));
      if (p > 0.8) n = 3 * 2 ** 28;

      if (n && n !== lensN && n <= 48) {
        setLens(n);
        lensN = n;
      }
      const showLens = stage(p, 0.3, 0.34) * (1 - stage(p, 0.58, 0.62));
      lens.visible = showLens > 0.01;
      lens.scale.setScalar((0.001 + showLens) * 0.8);
      lens.position.copy(onSheet(RC + 0.55, -RC + 0.35, 1.3));
      lens.quaternion.copy(camera.quaternion);
      fade(gapTag, showLens);

      sides.userData.set(n >= 3 * 2 ** 28 ? 'сторон: 3 · 2²⁸ = 805 306 368' : `сторон: ${n ? n.toLocaleString('ru-RU') : 0}`);
      value.userData.set(p > 0.84 ? `π ≈ ${KASHI}` : n ? `π ≈ ${fmt(piOf(n), n < 100 ? 4 : n < 1e5 ? 8 : 12)}` : 'π ≈ ?');
      // Under the circle, nearest to the viewer.
      // In the middle of the circle: the polygons grow around the numbers.
      sides.position.copy(onSheet(0, 0.55, 0.3));
      value.position.copy(onSheet(0, -0.25, 0.3));
      fade(sides, stage(p, 0.15, 0.2) * (1 - stage(p, 0.82, 0.85)));
      fade(value, stage(p, 0.15, 0.2) * (1 - stage(p, 0.83, 0.85)));
      year.position.copy(onSheet(0, RC + 1.45, 0.5));
      fade(year, stage(p, 0.85, 0.88));
      // The sixteen decimals arrive one by one.
      row.forEach((d, i) => {
        const at = 0.84 + i * 0.008;
        const u = stage(p, at, at + 0.02);
        d.visible = u > 0.01;
        d.position.y = 0.04 + (1 - u) * 0.6;
        d.scale.setScalar(0.42 * (0.6 + 0.4 * u));
      });

      const step = steps.filter(([s]) => p >= s).at(-1);
      caption.userData.set(step[1]);
      formula.userData.set(step[2]);
      const hh = 3 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const shift = camera.view?.enabled ? (2 * camera.view.offsetY) / camera.view.fullHeight : 0;
      caption.position.set(0, (0.86 - shift) * hh, -3);
      formula.position.set(0, (0.7 - shift) * hh, -3);

      // Camera: over the sheet, a little closer while the polygons grow, back for the digits.
      const close = stage(p, 0.12, 0.2) * (1 - stage(p, 0.8, 0.86));
      const target = C.clone().add(new THREE.Vector3(-0.4, 0, lerp(0.2, 0.55, stage(p, 0.8, 0.86))));
      const r = fitDistance(camera, lerp(3.9, 3.4, close)) * 0.82;
      const el = lerp(0.95, 1.05, close);
      const az = -0.05 + Math.sin(t * 0.1) * 0.04;
      camera.position.set(target.x + r * Math.cos(el) * Math.sin(az), target.y + r * Math.sin(el), target.z + r * Math.cos(el) * Math.cos(az));
      camera.lookAt(target);
      if (camera.aspect > 1.1) {
        camera.updateMatrixWorld();
        right.setFromMatrixColumn(camera.matrixWorld, 0);
        const hw = r * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
        camera.position.addScaledVector(right, -hw * 0.14);
      }
      void smooth;
      void glow;
    },
  };
}
