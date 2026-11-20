// Mathematics, medicine, optics and machines.
import {
  THREE, COLORS, createStage, fitDistance, orbit, metal, matte, shine, glow, label, fade, starfield, dust, rod,
  placeRod, tube, revealTube, ring, arcPoints, skyDome, rng, stage, smooth, lerp, clamp,
} from '../kit.js';

const darkStage = (opts = {}) => createStage({ background: 0x080c13, ambient: 0.6, sun: 1.4, ...opts });

// Parchment for the boards on which the methods are worked out.
let parchmentMap;
function parchment() {
  if (parchmentMap) return parchmentMap;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(256, 256, 40, 256, 256, 360);
  grad.addColorStop(0, '#efdcb2');
  grad.addColorStop(0.7, '#d9bd88');
  grad.addColorStop(1, '#8f6a3c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  const rand = rng(77);
  for (let i = 0; i < 9000; i++) {
    const v = rand();
    g.fillStyle = `rgba(${v < 0.5 ? '90,60,30' : '255,245,220'},${0.05 * rand()})`;
    g.fillRect(rand() * 512, rand() * 512, 1 + rand() * 3, 1 + rand() * 3);
  }
  // Faint ruled lines, like a scholar's working sheet.
  g.strokeStyle = 'rgba(120,85,45,0.12)';
  for (let y = 40; y < 512; y += 32) {
    g.beginPath();
    g.moveTo(30, y);
    g.lineTo(482, y);
    g.stroke();
  }
  parchmentMap = new THREE.CanvasTexture(c);
  parchmentMap.colorSpace = THREE.SRGBColorSpace;
  parchmentMap.userData.shared = true;
  return parchmentMap;
}

/* ---------- Al-Khwarizmi completes the square ---------- */

// The worked example from his book: «a square and ten roots equal
// thirty-nine». Step by step, as he explained it with a drawing.
export function algebra() {
  const { scene, camera, sun } = createStage({ background: 0x120d08, ambient: 0.3, sun: 0.75 });
  sun.position.set(-4, 12, 9);
  const lamp = new THREE.PointLight(0xffc27a, 14, 30, 2);
  lamp.position.set(5, 7, 6);
  scene.add(lamp);
  const motes = dust(260, [16, 9, 10], 0xffdca8, 5);
  motes.position.set(0, -2, -1);
  scene.add(motes);

  const x = 3;
  const k = 5;
  const n = x + k;
  const table = new THREE.Group();
  table.rotation.x = -0.9;
  table.position.y = -0.6;
  scene.add(table);

  const sheet = new THREE.Mesh(
    new THREE.BoxGeometry(n + 4.2, n + 4.2, 0.12),
    new THREE.MeshStandardMaterial({ map: parchment(), roughness: 1, color: 0xb9a080, envMapIntensity: 0.2 }),
  );
  sheet.position.set(0, 0, -0.08);
  table.add(sheet);

  const board = new THREE.Group();
  board.position.set(-n / 2, -n / 2, 0);
  table.add(board);

  const tile = (w, h, mat) => new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, h - 0.08, 0.28), mat);
  const glaze = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.15 });
  const square = tile(x, x, glaze(0x1d8a7c));
  square.position.set(x / 2, x / 2, 0.14);
  const right = tile(k, x, glaze(0x2c5fa8));
  const top = tile(x, k, glaze(0x2c5fa8));
  const corner = tile(k, k, new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.25, metalness: 0.9 }));
  board.add(square, right, top, corner);

  const ink = '#2a1a0c';
  const tags = {
    sq: label('x²', { size: 0.8, background: null }),
    r: label('5x', { size: 0.7, background: null }),
    t: label('5x', { size: 0.7, background: null }),
    c: label('25', { size: 0.8, background: null, color: '#2a1a0c' }),
    bx: label('x', { size: 0.55, background: null, color: ink }),
    b5: label('5', { size: 0.55, background: null, color: ink }),
    lx: label('x', { size: 0.55, background: null, color: ink }),
    l5: label('5', { size: 0.55, background: null, color: ink }),
    eight: label('8', { size: 0.8, background: null, color: '#7a1f12' }),
    area: label('64', { size: 1.2, background: null, color: '#fff3d0' }),
  };
  tags.sq.position.set(x / 2, x / 2, 0.5);
  tags.bx.position.set(x / 2, -0.55, 0.1);
  tags.b5.position.set(x + k / 2, -0.55, 0.1);
  tags.lx.position.set(-0.55, x / 2, 0.1);
  tags.l5.position.set(-0.55, x + k / 2, 0.1);
  tags.eight.position.set(n + 0.6, n / 2, 0.1);
  tags.area.position.set(n / 2, n / 2, 1.1);
  Object.values(tags).forEach((t) => board.add(t));

  // Glowing frame of the completed square (x + 5)².
  const outline = new THREE.Group();
  const s0 = -0.06;
  const s1 = n + 0.06;
  const pts = [[s0, s0], [s1, s0], [s1, s1], [s0, s1]].map(([a, b]) => new THREE.Vector3(a, b, 0.32));
  pts.forEach((c, i) => outline.add(rod(c, pts[(i + 1) % 4], 0.06, shine(0xffd890, 2.2))));
  board.add(outline);
  // Ink brackets for the sides x and 5.
  const bracket = new THREE.Group();
  const inkMat = new THREE.MeshBasicMaterial({ color: 0x3b2410 });
  bracket.add(rod(new THREE.Vector3(0, -0.25, 0.05), new THREE.Vector3(x, -0.25, 0.05), 0.025, inkMat));
  bracket.add(rod(new THREE.Vector3(x, -0.25, 0.05), new THREE.Vector3(n, -0.25, 0.05), 0.025, inkMat));
  bracket.add(rod(new THREE.Vector3(-0.25, 0, 0.05), new THREE.Vector3(-0.25, x, 0.05), 0.025, inkMat));
  bracket.add(rod(new THREE.Vector3(-0.25, x, 0.05), new THREE.Vector3(-0.25, n, 0.05), 0.025, inkMat));
  board.add(bracket);

  // Moments (share of the narration) when the voice reaches each step.
  const steps = [
    [0.0, 'Около 820 года: книга о решении житейских задач', 'аль-джабр и аль-мукабала'],
    [0.14, 'Задача из книги: «квадрат и десять корней равны 39»', 'x² + 10x = 39'],
    [0.27, 'Десять корней делим пополам: два прямоугольника по 5x', 'x² + 5x + 5x = 39'],
    [0.39, 'Не хватает угла 5 × 5 = 25', 'x² + 10x + 25 = 39 + 25'],
    [0.5, 'Аль-джабр — восполнение: достраиваем угол', 'x² + 10x + 25 = 39 + 25'],
    [0.63, 'Целый квадрат: 39 + 25 = 64', '(x + 5)² = 64'],
    [0.77, 'Его сторона — 8, ведь 8 × 8 = 64', 'x + 5 = 8'],
    [0.83, 'Значит, корень равен трём', 'x = 3'],
    [0.91, 'Из слова «аль-джабр» родилась алгебра', 'алгебра'],
  ];
  const longest = steps.reduce((a, b) => (b[1].length > a.length ? b[1] : a), '');
  const caption = label(steps[0][1], { size: 0.46, template: longest });
  const widest = steps.reduce((a, b) => (b[2].length > a.length ? b[2] : a), '');
  const formula = label(steps[0][2], { size: 0.75, color: '#ffe2a3', background: 'rgba(20,14,8,0.78)', template: widest });
  scene.add(caption, formula);

  return {
    scene,
    camera,
    update({ t, p }) {
      motes.userData.update(t);
      const a = stage(p, 0.14, 0.22);
      fade(square, a);
      fade(tags.sq, a);
      fade(tags.bx, a);
      fade(tags.lx, a);
      const b = stage(p, 0.27, 0.36);
      right.position.set(x + k / 2 + (1 - b) * 7, x / 2, 0.14 + (1 - b) * 2);
      top.position.set(x / 2, x + k / 2 + (1 - b) * 7, 0.14 + (1 - b) * 2);
      fade(right, b);
      fade(top, b);
      tags.r.position.copy(right.position).setZ(right.position.z + 0.4);
      tags.t.position.copy(top.position).setZ(top.position.z + 0.4);
      fade(tags.r, b);
      fade(tags.t, b);
      fade(tags.b5, b);
      fade(tags.l5, b);
      fade(bracket, Math.max(a, b) * 0.9);
      const c = stage(p, 0.48, 0.58);
      corner.position.set(x + k / 2, x + k / 2, 0.14 + (1 - c) * 9);
      corner.rotation.z = (1 - c) * 1.2;
      fade(corner, c);
      tags.c.position.copy(corner.position).setZ(corner.position.z + 0.4);
      fade(tags.c, c);
      const d = stage(p, 0.63, 0.7);
      fade(outline, d);
      const area = stage(p, 0.64, 0.7) * (1 - stage(p, 0.76, 0.8));
      fade(tags.area, area);
      fade(tags.eight, stage(p, 0.77, 0.81));
      // At the end the x side lights up: the answer.
      const answer = stage(p, 0.83, 0.88);
      square.material.emissive?.setHex(0x1d8a7c);
      square.material.emissiveIntensity = answer * (0.6 + 0.4 * Math.sin(t * 4));

      const step = steps.filter(([at]) => p >= at).at(-1);
      caption.userData.set(step[1]);
      formula.userData.set(step[2]);

      const dist = fitDistance(camera, n * 0.86);
      const push = lerp(1.08, 0.92, smooth(p));
      camera.position.set(Math.sin(t * 0.09) * 1.6, 2.2 + Math.sin(t * 0.07) * 0.3, dist * push);
      camera.lookAt(0, -0.6, 0);
      caption.position.set(0, 4.15, 1.2);
      formula.position.set(0, 3.3, 1.4);
    },
  };
}

/* ---------- Positional numerals ---------- */

function digitTile(ch, { color = '#f1d58a', bg = '#16212d' } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(214,171,85,0.6)';
  g.lineWidth = 4;
  g.strokeRect(6, 6, 116, 116);
  g.fillStyle = color;
  g.font = '600 84px Inter, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(ch, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const side = matte(0x0f1720);
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
  return new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.2), [side, side, side, side, face, side]);
}

export function numerals({ params }) {
  const { scene, camera } = darkStage();
  scene.add(starfield(1200, 300, 41));
  const decimal = params.variant === 'decimal';
  const row = '1234567890'.split('').map((ch, i) => {
    const tile = digitTile(ch);
    tile.userData.home = new THREE.Vector3((i - 4.5) * 1.05, 0.8, 0);
    tile.userData.from = new THREE.Vector3((i - 4.5) * 3, 6 - i * 0.5, -12);
    scene.add(tile);
    return tile;
  });
  const zeroGlow = glow(COLORS.gold, 2, 0);
  zeroGlow.position.copy(row[9].userData.home);
  scene.add(zeroGlow);
  const zeroTag = label('ноль — тоже цифра', { size: 0.34 });
  zeroTag.position.set(row[9].userData.home.x - 1, 2, 0.3);
  scene.add(zeroTag);

  const number = decimal ? ['0', ',', '2', '5'] : ['3', '0', '5'];
  const headers = decimal ? ['целые', '', 'десятые', 'сотые'] : ['сотни', 'десятки', 'единицы'];
  const result = new THREE.Group();
  number.forEach((ch, i) => {
    const x = (i - (number.length - 1) / 2) * 1.4;
    const tile = ch === ',' ? label(',', { size: 1.1, background: null, color: '#f1d58a' }) : digitTile(ch);
    tile.position.set(x, -0.2, 0);
    if (ch !== ',') tile.scale.setScalar(1.3);
    result.add(tile);
    if (headers[i]) {
      const h = label(headers[i], { size: 0.28, background: null, color: '#c6bfb0' });
      h.position.set(x, 0.95, 0);
      result.add(h);
    }
  });
  const expr = label(decimal ? '2/10 + 5/100 = 0,25' : '3·100 + 0·10 + 5 = 305', { size: 0.4 });
  expr.position.set(0, -1.6, 0);
  result.add(expr);
  scene.add(result);

  return {
    scene,
    camera,
    update({ t, p }) {
      const out = stage(p, 0.42, 0.5);
      row.forEach((tile, i) => {
        const f = stage(p, 0.02 + i * 0.025, 0.12 + i * 0.025);
        tile.position.copy(tile.userData.from).lerp(tile.userData.home, f);
        tile.position.y += out * 3;
        tile.rotation.y = (1 - f) * 2 + Math.sin(t + i) * 0.05;
        fade(tile, f * (1 - out));
      });
      zeroGlow.material.opacity = stage(p, 0.28, 0.34) * (1 - out) * 0.8;
      fade(zeroTag, stage(p, 0.3, 0.35) * (1 - out));
      fade(result, stage(p, 0.5, 0.6));
      // Wide enough for the row of ten digits, then closer for the final number.
      camera.position.set(Math.sin(t * 0.1) * 0.8, 0.4, fitDistance(camera, lerp(5.6, 3.2, stage(p, 0.45, 0.6))));
      camera.lookAt(0, 0.2, 0);
    },
  };
}

/* ---------- Al-Kindi's frequency analysis ---------- */

export function cipher() {
  const { scene, camera } = darkStage();
  scene.add(starfield(1000, 300, 51));
  const letters = [['О', 11], ['Е', 8.5], ['А', 8], ['И', 7.4], ['Н', 6.7], ['Т', 6.3], ['С', 5.5], ['Р', 4.7], ['В', 4.5], ['Л', 4.4]];
  const glyphs = ['✶', '◆', '☽', '▲', '✚', '●', '■', '✦', '◇', '☼'];
  const shuffled = [6, 2, 9, 0, 4, 7, 1, 8, 3, 5];
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), matte(0x121a24));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const spacing = 1.1;
  const xAt = (i) => (i - 4.5) * spacing;
  const bar = (h, color) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, h, 0.7), metal(color, 0.45, 0.3));
    m.geometry.translate(0, h / 2, 0);
    return m;
  };
  const plain = letters.map(([ch, f], i) => {
    const b = bar(f * 0.32, COLORS.teal);
    b.position.set(xAt(i), 0, -1.5);
    const tag = label(ch, { size: 0.42, background: null });
    tag.position.set(xAt(i), f * 0.32 + 0.4, -1.5);
    scene.add(b, tag);
    return b;
  });
  const secret = letters.map(([, f], i) => {
    const b = bar(f * 0.32, COLORS.gold);
    const tag = label(glyphs[i], { size: 0.42, background: null, color: '#f1d58a' });
    scene.add(b, tag);
    return { b, tag, h: f * 0.32, from: shuffled.indexOf(i), to: i };
  });
  const links = secret.map(() => {
    const r = rod(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 0.025, shine(0xffe2a0, 1.2));
    fade(r, 0);
    scene.add(r);
    return r;
  });
  const tags = [
    label('Частота букв в обычном тексте', { size: 0.34 }),
    label('Частота знаков в шифровке', { size: 0.34 }),
    label('Самый частый знак → самая частая буква', { size: 0.38 }),
  ];
  tags[0].position.set(0, 4.6, -1.5);
  tags[1].position.set(0, -0.9, 2.4);
  tags[2].position.set(0, 5.4, 0);
  tags.forEach((t) => scene.add(t));

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  return {
    scene,
    camera,
    update({ t, p }) {
      plain.forEach((m, i) => (m.scale.y = Math.max(0.001, stage(p, 0.02 + i * 0.015, 0.12 + i * 0.015))));
      const sort = stage(p, 0.4, 0.62);
      secret.forEach((s, i) => {
        const grow = Math.max(0.001, stage(p, 0.18 + i * 0.015, 0.3 + i * 0.015));
        const x = lerp(xAt(s.from), xAt(s.to), sort);
        s.b.scale.y = grow;
        s.b.position.set(x, 0, 1.5);
        s.tag.position.set(x, s.h * grow + 0.4, 1.5);
        fade(s.tag, grow);
        const link = stage(p, 0.68 + i * 0.015, 0.76 + i * 0.015);
        placeRod(links[i], a.set(x, 0.05, 1.15), b.set(xAt(i), 0.05, lerp(1.15, -1.15, link)));
        fade(links[i], link);
      });
      fade(tags[0], stage(p, 0.05, 0.12) * (1 - stage(p, 0.6, 0.66)));
      fade(tags[1], stage(p, 0.2, 0.28));
      fade(tags[2], stage(p, 0.66, 0.74));
      orbit(camera, new THREE.Vector3(0, 1.4, 0), fitDistance(camera, 6.3), Math.sin(t * 0.06) * 0.25, 0.55);
    },
  };
}

/* ---------- Camera obscura ---------- */

export function optics() {
  const { scene, camera } = darkStage({ ambient: 0.9, sun: 1.1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), matte(0x2e261f));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 0.9, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
  const room = new THREE.Group();
  const addWall = (w, h, pos, rotY = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.copy(pos);
    m.rotation.y = rotY;
    room.add(m);
  };
  addWall(3, 3, new THREE.Vector3(-1, 1.5, 0), Math.PI / 2);
  addWall(4, 3, new THREE.Vector3(1, 1.5, -1.5));
  addWall(4, 3, new THREE.Vector3(1, 1.5, 1.5));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), matte(0xe9dcc0));
  screen.position.set(3, 1.5, 0);
  screen.rotation.y = -Math.PI / 2;
  room.add(screen);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), wallMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(1, 3, 0);
  room.add(ceiling);
  scene.add(room);
  const hole = new THREE.Vector3(-1, 1.1, 0);
  const holeGlow = glow(0xfff0c0, 0.35, 1);
  holeGlow.position.copy(hole);
  scene.add(holeGlow);

  const candle = new THREE.Group();
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 1.8, 24), matte(0xf0e6cf));
  wax.position.y = 0.9;
  const flame = glow(0xffb347, 0.9, 1);
  flame.position.y = 2.15;
  const light = new THREE.PointLight(0xffa040, 12, 8);
  light.position.y = 2.2;
  candle.add(wax, flame, light);
  candle.position.x = -6;
  scene.add(candle);

  const top = new THREE.Vector3(-6, 2.2, 0);
  const bottom = new THREE.Vector3(-6, 0.05, 0);
  const through = (from) => {
    const dir = new THREE.Vector3().subVectors(hole, from);
    return hole.clone().addScaledVector(dir, (3 - hole.x) / dir.x);
  };
  const rays = [];
  for (const [from, color] of [[top, 0xffc070], [bottom, 0xffe2a0]]) {
    for (const dz of [-0.35, 0, 0.35]) {
      const start = from.clone().setZ(dz);
      const mesh = tube([start, hole, through(start)], 0.018, shine(color, 1.3), 40);
      revealTube(mesh, 0);
      scene.add(mesh);
      rays.push(mesh);
    }
  }
  const image = new THREE.Group();
  const imgWax = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 1.4, 20), shine(0xd9cfb8, 0.3));
  imgWax.position.y = 1.15;
  const imgFlame = glow(0xffb347, 0.7, 1);
  imgFlame.position.y = 0.25;
  image.add(imgWax, imgFlame);
  image.position.set(2.95, 0, 0);
  scene.add(image);

  const tags = [
    label('Свет идёт от предмета', { size: 0.42 }),
    label('через маленькое отверстие', { size: 0.42 }),
    label('изображение перевёрнуто', { size: 0.42 }),
  ];
  tags[0].position.set(-5.5, 3.2, 0);
  tags[1].position.set(-1, 3.9, 0);
  tags[2].position.set(3, 3.4, 0);
  tags.forEach((t) => scene.add(t));

  return {
    scene,
    camera,
    update({ t, p }) {
      const f = 0.9 + Math.sin(t * 8) * 0.06 + Math.sin(t * 19) * 0.04;
      flame.scale.setScalar(0.9 * f);
      light.intensity = 12 * f;
      rays.forEach((r, i) => revealTube(r, stage(p, 0.15 + (i % 3) * 0.03, 0.45 + (i % 3) * 0.03)));
      fade(image, stage(p, 0.45, 0.55));
      fade(tags[0], stage(p, 0.08, 0.15));
      fade(tags[1], stage(p, 0.25, 0.32));
      fade(tags[2], stage(p, 0.52, 0.6));
      orbit(camera, new THREE.Vector3(-1.4, 1.5, 0), fitDistance(camera, 5), lerp(0.7, 0.4, smooth(p)), 0.22);
    },
  };
}

/* ---------- The Nile: river, nilometer, canal ---------- */

export function nile({ params }) {
  const variant = params.variant ?? 'river';
  const { scene, camera, sun } = createStage({ background: 0x3a4a5c, fog: [20, 60], ambient: 0.8, sun: 2 });
  sun.position.set(-10, 6, 4);
  sun.color.set(0xffd2a0);
  scene.add(skyDome(0x4a6c94, 0xf0c48a));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), matte(0xc7a46e));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const waterGeo = new THREE.PlaneGeometry(80, 4, 120, 6);
  waterGeo.rotateX(-Math.PI / 2);
  const base = waterGeo.attributes.position.array.slice();
  const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ color: 0x2b6f7d, roughness: 0.25, metalness: 0.35 }));
  water.position.set(0, 0.04, -2);
  scene.add(water);
  for (const z of [-4.4, 0.4]) {
    const bank = new THREE.Mesh(new THREE.PlaneGeometry(80, 1.2), matte(0x5d7a3a));
    bank.rotation.x = -Math.PI / 2;
    bank.position.set(0, 0.02, z);
    scene.add(bank);
  }
  const rand = rng(61);
  for (let i = 0; i < 22; i++) {
    const palm = new THREE.Group();
    const h = 1.6 + rand() * 1.2;
    palm.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.15, h, 0), 0.07, matte(0x6b5236)));
    for (let k = 0; k < 6; k++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.1, 4), matte(0x4f7a32));
      leaf.position.set(0.15, h, 0);
      leaf.rotation.set(Math.PI / 2.4, (k / 6) * Math.PI * 2, 0, 'YXZ');
      leaf.translateY(0.45);
      palm.add(leaf);
    }
    palm.position.set(-20 + i * 2 + rand(), 0, i % 2 ? 0.6 + rand() * 0.6 : -4.6 - rand() * 0.6);
    scene.add(palm);
  }
  for (const [x, s] of [[-6, 3.2], [-1.5, 2.4], [2.5, 1.6]]) {
    const pyramid = new THREE.Mesh(new THREE.ConeGeometry(s, s * 1.2, 4), matte(0xd9bd88));
    pyramid.position.set(x, s * 0.6, -16);
    pyramid.rotation.y = Math.PI / 4;
    scene.add(pyramid);
  }
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.45), matte(COLORS.wood));
  const sailShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.9, 0), new THREE.Vector2(0, 1.6)]);
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), new THREE.MeshStandardMaterial({ color: 0xf2e9d6, side: THREE.DoubleSide }));
  sail.position.set(-0.3, 0.15, 0);
  boat.add(hull, sail);
  boat.position.set(-8, 0.15, -2);
  scene.add(boat);

  const extras = { tags: [] };
  if (variant === 'nilometer') {
    const well = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 3, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0xbca57e, roughness: 0.9, side: THREE.DoubleSide }));
    well.position.set(2, 1.5, 2.4);
    const rim = ring(1.3, 0.1, matte(0xd8c6a0));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(2, 3, 2.4);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.6, 16), matte(0xe9dcc0));
    column.position.set(2, 1.8, 2.4);
    scene.add(well, rim, column);
    for (let i = 0; i < 9; i++) {
      const tick = ring(0.16, 0.025, shine(COLORS.goldDeep, 0.3));
      tick.rotation.x = Math.PI / 2;
      tick.position.set(2, 0.4 + i * 0.35, 2.4);
      scene.add(tick);
    }
    const level = new THREE.Mesh(new THREE.CircleGeometry(1.25, 40), new THREE.MeshStandardMaterial({ color: 0x2b6f7d, roughness: 0.2, metalness: 0.3 }));
    level.rotation.x = -Math.PI / 2;
    level.position.set(2, 0.5, 2.4);
    scene.add(level);
    extras.level = level;
    const tag = label('Ниломер на острове Рода, 861 год', { size: 0.36 });
    tag.position.set(2, 4.3, 2.4);
    scene.add(tag);
    extras.tags.push(tag);
  }
  if (variant === 'canal') {
    const canal = new THREE.Group();
    const length = 10;
    const slope = 0.08;
    for (const z of [-0.8, 0.8]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(length, 1.4, 0.2), matte(0xa98c62));
      wall.position.set(0, -0.2, z);
      canal.add(wall);
    }
    const bed = new THREE.Mesh(new THREE.BoxGeometry(length, 0.1, 1.4), matte(0x8a7050));
    // Tilted so the start of the canal is lower than its end.
    bed.rotation.z = Math.atan(slope);
    bed.position.set(0, -0.7, 0);
    canal.add(bed);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(length * 0.42, 0.3, 1.4), new THREE.MeshStandardMaterial({ color: 0x2b6f7d, roughness: 0.2, metalness: 0.3 }));
    pool.position.set(-length * 0.29, -0.55, 0);
    canal.add(pool);
    canal.position.set(4, 0.5, 2.6);
    canal.rotation.y = -0.25;
    scene.add(canal);
    const tag = label('Начало канала глубже конца — вода не идёт', { size: 0.34 });
    tag.position.set(4, 2.4, 2.6);
    scene.add(tag);
    extras.tags.push(tag);
  }

  return {
    scene,
    camera,
    update({ t, p }) {
      const pos = waterGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, base[i * 3 + 1] + Math.sin(base[i * 3] * 0.8 + t * 1.5) * 0.04 + Math.cos(base[i * 3 + 2] * 2 + t) * 0.02);
      }
      pos.needsUpdate = true;
      boat.position.x = -8 + p * 10;
      boat.rotation.z = Math.sin(t * 1.3) * 0.03;
      if (extras.level) extras.level.position.y = 0.5 + Math.sin(p * Math.PI) * 2.1;
      extras.tags.forEach((tag) => fade(tag, stage(p, 0.08, 0.2)));
      const focus = variant === 'river' ? new THREE.Vector3(0, 0.8, -4) : new THREE.Vector3(2.5, 1.2, 1.5);
      orbit(camera, focus, fitDistance(camera, variant === 'river' ? 7.5 : 4.8), lerp(0.35, -0.15, smooth(p)), 0.32);
    },
  };
}

/* ---------- Laboratory: distilling, pharmacy, surgery ---------- */

export function laboratory({ params }) {
  const variant = params.variant ?? 'distill';
  const { scene, camera } = createStage({ background: 0x0e0b09, fog: [8, 22], ambient: 0.45, sun: 0.9 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(7, 0.25, 3.4), matte(COLORS.wood, 0.75));
  table.position.y = 0.9;
  scene.add(table);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), matte(0x2a211a));
  wall.position.set(0, 4, -3);
  scene.add(wall);
  const top = 1.03;
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfe3e0, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
  const rand = rng(71);
  const items = { update: () => {} };

  if (variant === 'distill') {
    const flame = glow(0xff9a3a, 0.9, 1);
    flame.position.set(-1.6, top + 0.25, 0);
    const light = new THREE.PointLight(0xff8a30, 10, 6);
    light.position.set(-1.6, top + 0.4, 0);
    const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.3, 20), matte(0x3a3330));
    burner.position.set(-1.6, top + 0.15, 0);
    const flask = new THREE.Mesh(new THREE.SphereGeometry(0.65, 32, 24), glass);
    flask.position.set(-1.6, top + 1.05, 0);
    const liquid = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7a3f8a, transparent: true, opacity: 0.8 }));
    liquid.position.copy(flask.position);
    const path = [new THREE.Vector3(-1.6, top + 1.6, 0), new THREE.Vector3(-1.5, top + 2.4, 0), new THREE.Vector3(-0.4, top + 2.2, 0), new THREE.Vector3(1.2, top + 1.2, 0), new THREE.Vector3(1.6, top + 0.9, 0)];
    const neck = tube(path, 0.07, glass, 80);
    const receiver = new THREE.Mesh(new THREE.SphereGeometry(0.45, 32, 24), glass);
    receiver.position.set(1.7, top + 0.45, 0);
    scene.add(flame, light, burner, flask, liquid, neck, receiver);
    const curve = new THREE.CatmullRomCurve3(path);
    const vapor = Array.from({ length: 24 }, (_, i) => {
      const v = glow(0xe8d8ff, 0.18, 0.7);
      v.userData.offset = i / 24;
      scene.add(v);
      return v;
    });
    const drops = Array.from({ length: 5 }, (_, i) => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), shine(0xb88ad0, 0.6));
      d.userData.offset = i / 5;
      scene.add(d);
      return d;
    });
    items.update = (t) => {
      const f = 0.9 + Math.sin(t * 9) * 0.07;
      flame.scale.setScalar(0.9 * f);
      light.intensity = 10 * f;
      vapor.forEach((v) => {
        const u = (t * 0.12 + v.userData.offset) % 1;
        v.position.copy(curve.getPoint(u));
        v.material.opacity = 0.7 * Math.sin(u * Math.PI);
      });
      drops.forEach((d) => {
        const u = (t * 0.5 + d.userData.offset) % 1;
        d.position.set(1.62, top + 0.9 - u * 0.4, 0);
      });
    };
  }

  if (variant === 'pharmacy') {
    const colors = [0x2b6f9a, 0x7d2a22, 0x2c4f3e, 0x8a6a2a, 0x5a2e4f, 0xd9c7a2];
    for (let shelf = 0; shelf < 3; shelf++) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(8, 0.08, 0.5), matte(COLORS.wood));
      board.position.set(0, 2 + shelf * 0.9, -2.7);
      scene.add(board);
      for (let i = 0; i < 11; i++) {
        const h = 0.4 + rand() * 0.25;
        const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, h, 16), metal(colors[(i + shelf) % colors.length], 0.5, 0.2));
        jar.position.set(-3.6 + i * 0.72, 2.04 + shelf * 0.9 + h / 2, -2.7);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), metal(COLORS.gold));
        lid.position.set(jar.position.x, jar.position.y + h / 2 + 0.04, -2.7);
        scene.add(jar, lid);
      }
    }
    const bowl = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.2, 0), new THREE.Vector2(0.45, 0.1), new THREE.Vector2(0.55, 0.45), new THREE.Vector2(0.5, 0.45), new THREE.Vector2(0.38, 0.12), new THREE.Vector2(0, 0.08)], 32), matte(0x8c8273));
    bowl.position.set(-1.6, top, 0.3);
    const pestle = rod(new THREE.Vector3(-1.6, top + 0.2, 0.3), new THREE.Vector3(-1.2, top + 1.1, 0.5), 0.06, matte(0x6f655a));
    scene.add(bowl, pestle);
    const scale = new THREE.Group();
    scale.position.set(1.6, top, 0.2);
    scale.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.5, 0), 0.04, metal(COLORS.gold)));
    const beam = new THREE.Group();
    beam.position.y = 1.5;
    beam.add(rod(new THREE.Vector3(-0.9, 0, 0), new THREE.Vector3(0.9, 0, 0), 0.03, metal(COLORS.gold)));
    const pans = [-0.9, 0.9].map((x) => {
      const pan = new THREE.Group();
      pan.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.7, 0), 0.008, metal(COLORS.gold)));
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.06, 24), metal(COLORS.gold));
      dish.position.y = -0.72;
      pan.add(dish);
      pan.position.x = x;
      beam.add(pan);
      return pan;
    });
    scale.add(beam);
    scene.add(scale);
    for (let i = 0; i < 14; i++) {
      const herb = new THREE.Mesh(new THREE.SphereGeometry(0.06 + rand() * 0.05, 8, 6), matte(0x5f7f3a));
      herb.position.set(-0.4 + rand() * 0.8, top + 0.06, 0.6 + rand() * 0.5);
      scene.add(herb);
    }
    items.update = (t) => {
      beam.rotation.z = Math.sin(t * 0.8) * 0.12;
      pans.forEach((pan) => (pan.rotation.z = -beam.rotation.z));
    };
  }

  if (variant === 'surgery') {
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.6), matte(0x4a1416));
    cloth.rotation.x = -Math.PI / 2;
    cloth.position.y = top + 0.005;
    scene.add(cloth);
    const steel = metal(0xd0d6dc, 0.25, 0.95);
    const handleMat = metal(COLORS.gold, 0.35, 0.8);
    const tools = [];
    const make = (build) => {
      const g = new THREE.Group();
      build(g);
      scene.add(g);
      tools.push(g);
      return g;
    };
    make((g) => {
      g.add(rod(new THREE.Vector3(-0.7, 0, 0), new THREE.Vector3(0.2, 0, 0), 0.05, handleMat));
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.6, 3), steel);
      blade.rotation.z = -Math.PI / 2;
      blade.position.x = 0.5;
      g.add(blade);
    });
    make((g) => {
      for (const s of [-1, 1]) {
        const arm = rod(new THREE.Vector3(-0.6, 0, 0), new THREE.Vector3(0.6, 0, s * 0.08), 0.03, steel);
        g.add(arm);
      }
    });
    make((g) => {
      g.add(rod(new THREE.Vector3(-0.7, 0, 0), new THREE.Vector3(0.3, 0, 0), 0.04, handleMat));
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 8, 24, Math.PI * 1.2), steel);
      hook.position.x = 0.42;
      hook.rotation.x = Math.PI / 2;
      g.add(hook);
    });
    make((g) => {
      g.add(rod(new THREE.Vector3(-0.8, 0, 0), new THREE.Vector3(0.6, 0, 0), 0.02, steel));
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), steel);
      tip.position.x = 0.62;
      g.add(tip);
    });
    make((g) => {
      g.add(rod(new THREE.Vector3(-0.6, 0, 0), new THREE.Vector3(0.1, 0, 0), 0.05, handleMat));
      const saw = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.14), steel);
      saw.position.x = 0.45;
      g.add(saw);
    });
    make((g) => {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 8, 20), steel);
      loop.position.x = -0.5;
      loop.rotation.x = Math.PI / 2;
      g.add(loop, rod(new THREE.Vector3(-0.42, 0, 0), new THREE.Vector3(0.6, 0, 0), 0.012, steel));
    });
    tools.forEach((g, i) => {
      g.position.set(-1.8 + (i % 3) * 1.8, top + 0.06, i < 3 ? -0.5 : 0.6);
      g.rotation.y = (rand() - 0.5) * 0.4;
    });
    const spot = new THREE.SpotLight(0xfff0d8, 40, 12, 0.5, 0.6);
    spot.position.set(0, 5, 2);
    scene.add(spot, spot.target);
    const tag = label('Около 200 инструментов в книге «Ат-Тасриф»', { size: 0.3 });
    tag.position.set(0, top + 1.4, 0);
    scene.add(tag);
    items.update = (t, p) => {
      spot.target.position.set(Math.sin(t * 0.4) * 1.5, top, 0);
      tools.forEach((g, i) => (g.position.y = top + 0.06 + Math.max(0, Math.sin(t * 0.7 + i)) * 0.04));
      fade(tag, stage(p, 0.1, 0.2));
    };
  }

  const motes = dust(150, [7, 4, 4], 0xffe2a8);
  motes.position.y = 1;
  scene.add(motes);

  return {
    scene,
    camera,
    update({ t, p }) {
      items.update(t, p);
      motes.userData.update(t);
      orbit(camera, new THREE.Vector3(0, top + 0.8, 0), fitDistance(camera, variant === 'surgery' ? 2.9 : 3.4), lerp(-0.35, 0.35, smooth(p)), variant === 'surgery' ? 0.75 : 0.28);
    },
  };
}

/* ---------- Ibn an-Nafis: pulmonary circulation ---------- */

export function heart() {
  const { scene, camera } = darkStage({ ambient: 0.5 });
  scene.add(starfield(800, 300, 81));
  const body = new THREE.Group();
  scene.add(body);
  const half = (x, color) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.85, 40, 28), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 }));
    m.scale.set(0.9, 1.15, 0.9);
    m.position.set(x, 0, 0);
    body.add(m);
    return m;
  };
  const rightHalf = half(-0.72, 0x3f5fb8);
  const leftHalf = half(0.72, 0xb8403a);
  const septum = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 1.5), matte(0xe9dcc0));
  body.add(septum);
  const lungMat = new THREE.MeshStandardMaterial({ color: 0xe0a0a0, roughness: 0.7, transparent: true, opacity: 0.35, depthWrite: false });
  for (const x of [-2.9, 2.9]) {
    const lung = new THREE.Mesh(new THREE.SphereGeometry(1.1, 32, 24), lungMat);
    lung.scale.set(0.8, 1.3, 0.7);
    lung.position.set(x, 2.1, 0);
    body.add(lung);
  }
  const loops = [
    [[-0.8, -0.2, 0.4], [-1.0, 1.4, 0.4], [-2.7, 2.6, 0.3], [-2.9, 1.5, 0.2], [-1.4, 2.6, 0.1], [0.6, 1.4, 0.2], [0.8, 0.4, 0.4]],
    [[-0.6, -0.2, -0.4], [-0.3, 1.6, -0.4], [2.6, 2.7, -0.3], [3.0, 1.5, -0.2], [1.5, 2.4, -0.2], [0.9, 1.3, -0.3], [0.8, 0.4, -0.4]],
  ].map((pts) => new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z))));
  loops.forEach((curve) => {
    const vessel = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.09, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a6a, transparent: true, opacity: 0.35, depthWrite: false }));
    body.add(vessel);
  });
  const blue = new THREE.Color(0x5a7ee0);
  const red = new THREE.Color(0xff5a4a);
  const cells = Array.from({ length: 70 }, (_, i) => {
    const cell = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: blue.clone() }));
    cell.userData = { curve: loops[i % 2], offset: i / 70 };
    body.add(cell);
    return cell;
  });
  const cross = label('✕ пор в перегородке нет', { size: 0.26 });
  cross.position.set(0, -1.45, 0.6);
  const tags = [
    [label('правая половина сердца', { size: 0.24 }), new THREE.Vector3(-1.7, -0.9, 0.5)],
    [label('левая половина', { size: 0.24 }), new THREE.Vector3(1.6, -0.9, 0.5)],
    [label('лёгкие: кровь смешивается с воздухом', { size: 0.26 }), new THREE.Vector3(0, 3.7, 0)],
    [label('Малый круг кровообращения', { size: 0.36 }), new THREE.Vector3(0, -2.2, 0)],
  ];
  tags.forEach(([t, v]) => {
    t.position.copy(v);
    body.add(t);
  });
  body.add(cross);

  return {
    scene,
    camera,
    update({ t, p }) {
      const beat = 1 + Math.max(0, Math.sin(t * 6)) ** 8 * 0.06;
      rightHalf.scale.set(0.9 * beat, 1.15 * beat, 0.9 * beat);
      leftHalf.scale.set(0.9 * beat, 1.15 * beat, 0.9 * beat);
      const flow = stage(p, 0.1, 0.2);
      cells.forEach((c) => {
        const u = (t * 0.07 + c.userData.offset) % 1;
        c.position.copy(c.userData.curve.getPoint(u));
        c.material.color.copy(blue).lerp(red, smooth((u - 0.4) / 0.15));
        c.visible = flow > 0.05;
      });
      fade(cross, stage(p, 0.25, 0.35));
      fade(tags[0][0], stage(p, 0.05, 0.12));
      fade(tags[1][0], stage(p, 0.05, 0.12));
      fade(tags[2][0], stage(p, 0.4, 0.5));
      fade(tags[3][0], stage(p, 0.65, 0.75));
      body.rotation.y = Math.sin(t * 0.15) * 0.35;
      camera.position.set(0, 1, fitDistance(camera, 4.3));
      camera.lookAt(0, 0.9, 0);
    },
  };
}

/* ---------- Al-Farabi: string ratios ---------- */

export function music() {
  const { scene, camera } = darkStage({ ambient: 0.5 });
  scene.add(starfield(1200, 300, 91));
  const board = new THREE.Mesh(new THREE.BoxGeometry(7, 0.2, 3.2), matte(COLORS.wood, 0.6));
  scene.add(board);
  const L = 6;
  const specs = [[1, '1 : 1 — основной тон'], [1 / 2, '1 : 2 — октава'], [2 / 3, '2 : 3 — квинта'], [3 / 4, '3 : 4 — кварта']];
  const strings = specs.map(([ratio, text], i) => {
    const len = L * ratio;
    const geo = new THREE.BoxGeometry(len, 0.025, 0.025, 80, 1, 1);
    const base = geo.attributes.position.array.slice();
    const mesh = new THREE.Mesh(geo, shine(0xf1d58a, 0.8));
    const z = -1.1 + i * 0.75;
    mesh.position.set(-L / 2 + len / 2, 0.35, z);
    const nut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.2), matte(0xe9dcc0));
    nut.position.set(-L / 2, 0.2, z);
    const bridge = nut.clone();
    bridge.position.x = -L / 2 + len;
    const tag = label(text, { size: 0.24 });
    tag.position.set(-L / 2 + len + 1.1, 0.6, z);
    scene.add(mesh, nut, bridge, tag);
    return { mesh, geo, base, len, ratio, tag, z };
  });
  const rings = Array.from({ length: 4 }, () => {
    const r = ring(1, 0.02, new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0 }));
    r.rotation.x = Math.PI / 2;
    scene.add(r);
    return r;
  });

  return {
    scene,
    camera,
    update({ t, p }) {
      strings.forEach((s, i) => {
        const on = stage(p, 0.05 + i * 0.18, 0.12 + i * 0.18);
        const pos = s.geo.attributes.position;
        const amp = 0.08 * on * (0.6 + 0.4 * Math.sin(t * 0.7 + i));
        const w = 30 / s.ratio;
        for (let k = 0; k < pos.count; k++) {
          const x = s.base[k * 3];
          const u = (x + s.len / 2) / s.len;
          pos.setY(k, s.base[k * 3 + 1] + Math.sin(u * Math.PI) * Math.sin(t * w) * amp);
        }
        pos.needsUpdate = true;
        fade(s.tag, on);
      });
      rings.forEach((r, i) => {
        const u = (t * 0.35 + i / 4) % 1;
        r.scale.setScalar(0.5 + u * 4);
        r.position.set(0, 0.4, 0);
        r.material.opacity = (1 - u) * 0.35;
      });
      orbit(camera, new THREE.Vector3(0.8, 0.3, 0), fitDistance(camera, 4), Math.sin(t * 0.08) * 0.3, lerp(0.9, 0.6, smooth(p)));
    },
  };
}

/* ---------- Omar Khayyam: a cubic via a parabola and a circle ---------- */

export function cubic() {
  const { scene, camera } = darkStage();
  scene.add(starfield(1200, 300, 101));
  const s = 1.6;
  const grid = new THREE.GridHelper(10, 20, 0x2a3644, 0x1a2430);
  grid.rotation.x = Math.PI / 2;
  grid.position.z = -0.05;
  scene.add(grid);
  scene.add(rod(new THREE.Vector3(-4, 0, 0), new THREE.Vector3(4.5, 0, 0), 0.015, matte(0x8a96a6)));
  scene.add(rod(new THREE.Vector3(0, -2.5, 0), new THREE.Vector3(0, 4.5, 0), 0.015, matte(0x8a96a6)));
  const parabola = [];
  for (let i = 0; i <= 60; i++) {
    const x = -1.55 + (3.1 * i) / 60;
    parabola.push(new THREE.Vector3(x * s, x * x * s, 0));
  }
  const para = tube(parabola, 0.04, shine(COLORS.teal, 1.1), 160);
  const circle = tube(arcPoints(s, Math.PI, Math.PI * 3, 100, 'xy', new THREE.Vector3(s, 0, 0)), 0.04, shine(COLORS.gold, 1.1), 160);
  revealTube(para, 0);
  revealTube(circle, 0);
  scene.add(para, circle);
  const hit = new THREE.Group();
  hit.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), shine(0xffffff, 2)), glow(0xffe2a0, 1.2, 1));
  hit.position.set(s, s, 0.05);
  const drop = tube([new THREE.Vector3(s, s, 0), new THREE.Vector3(s, 0, 0)], 0.02, shine(0xffffff, 1), 2);
  revealTube(drop, 0);
  scene.add(hit, drop);
  const tags = [
    [label('x³ + x = 2', { size: 0.55 }), new THREE.Vector3(-2.2, 3.9, 0)],
    [label('парабола y = x²', { size: 0.3 }), new THREE.Vector3(-2.7, 2.9, 0)],
    [label('окружность', { size: 0.3 }), new THREE.Vector3(3.6, -1.4, 0)],
    [label('пересечение даёт корень: x = 1', { size: 0.34 }), new THREE.Vector3(3.3, 2.2, 0)],
  ];
  tags.forEach(([t, v]) => {
    t.position.copy(v);
    scene.add(t);
  });

  return {
    scene,
    camera,
    update({ t, p }) {
      fade(tags[0][0], stage(p, 0.02, 0.1));
      revealTube(para, stage(p, 0.12, 0.35));
      fade(tags[1][0], stage(p, 0.25, 0.35));
      revealTube(circle, stage(p, 0.38, 0.6));
      fade(tags[2][0], stage(p, 0.5, 0.6));
      fade(hit, stage(p, 0.62, 0.7));
      hit.scale.setScalar(1 + Math.sin(t * 4) * 0.1);
      revealTube(drop, stage(p, 0.68, 0.76));
      fade(tags[3][0], stage(p, 0.74, 0.82));
      camera.position.set(0.6 + Math.sin(t * 0.1) * 0.8, 1.2, fitDistance(camera, 4.6));
      camera.lookAt(0.6, 1, 0);
    },
  };
}

/* ---------- Machines: gears, water clock, pump, steam spit ---------- */

function gearGeometry(teeth, radius, depth = 0.25) {
  const shape = new THREE.Shape();
  const inner = radius * 0.86;
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const r = i % 4 < 2 ? radius : inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, radius * 0.18, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

// A tube whose radius changes along its length: trunks, tusks, dragons.
function taperedTube(points, r0, r1, material, segments = 48, radial = 14) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, c);
    const r = lerp(r0, r1, i / segments);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

// An Indian elephant, as on al-Jazari's clock: trunk, tusks, fan ears,
// a red and gold caparison. Faces +x. `skin` is returned so the body can
// turn translucent to show the water tank inside.
function elephant() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x77706a, roughness: 0.82, metalness: 0.02 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xf1e6cf, roughness: 0.35 });
  const blob = (r, sx, sy, sz, x, y, z, mat = skin) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  blob(1, 1.75, 1.15, 1.0, 0, 2.15, 0); // barrel of the body
  blob(0.95, 0.95, 1.1, 0.95, -0.95, 2.1, 0); // haunch
  blob(1.0, 0.9, 1.2, 0.98, 0.85, 2.35, 0); // shoulders
  blob(0.62, 1.05, 1.1, 0.95, 1.75, 2.75, 0); // head
  blob(0.34, 1, 1, 1, 1.95, 3.25, 0.22); // forehead domes
  blob(0.34, 1, 1, 1, 1.95, 3.25, -0.22);
  for (const [x, z] of [[-1.0, -0.5], [-1.0, 0.5], [0.95, -0.5], [0.95, 0.5]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.36, 1.75, 24), skin);
    leg.position.set(x, 0.9, z);
    g.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.16, 24), skin);
    foot.position.set(x, 0.08, z);
    g.add(foot);
    for (let n = -1; n <= 1; n++) {
      const nail = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), ivory);
      nail.position.set(x + 0.36 * Math.cos(n * 0.5), 0.12, z + 0.36 * Math.sin(n * 0.5));
      g.add(nail);
    }
  }
  g.add(taperedTube([
    new THREE.Vector3(2.25, 2.7, 0), new THREE.Vector3(2.55, 2.1, 0), new THREE.Vector3(2.6, 1.3, 0),
    new THREE.Vector3(2.5, 0.65, 0), new THREE.Vector3(2.75, 0.35, 0), new THREE.Vector3(2.95, 0.5, 0),
  ], 0.3, 0.08, skin, 64));
  for (const z of [-0.28, 0.28]) {
    g.add(taperedTube([
      new THREE.Vector3(2.2, 2.25, z), new THREE.Vector3(2.55, 1.9, z * 1.2), new THREE.Vector3(2.85, 1.95, z * 1.35), new THREE.Vector3(3.05, 2.25, z * 1.3),
    ], 0.09, 0.015, ivory, 24, 10));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 0.2 }));
    eye.position.set(2.18, 2.95, z * 1.55);
    g.add(eye);
  }
  const earShape = new THREE.Shape();
  earShape.moveTo(0, 0);
  earShape.bezierCurveTo(-0.15, 0.85, -1.0, 1.0, -1.1, 0.25);
  earShape.bezierCurveTo(-1.15, -0.5, -0.55, -1.15, -0.1, -0.75);
  earShape.lineTo(0, 0);
  const earGeo = new THREE.ExtrudeGeometry(earShape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.04, bevelSegments: 2, curveSegments: 24 });
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, skin);
    ear.position.set(1.55, 2.95, side * 0.62);
    ear.rotation.y = side * 0.35;
    g.add(ear);
  }
  g.add(taperedTube([new THREE.Vector3(-2.15, 2.6, 0), new THREE.Vector3(-2.35, 1.9, 0), new THREE.Vector3(-2.3, 1.3, 0)], 0.07, 0.03, skin, 20, 8));
  // Caparison: a red cloth with a gold border over the back.
  const capAngle = Math.PI * 0.36;
  const cloth = new THREE.Mesh(
    new THREE.SphereGeometry(1.04, 48, 20, 0, Math.PI * 2, 0, capAngle),
    new THREE.MeshStandardMaterial({ color: 0x8e1d1b, roughness: 0.75, side: THREE.DoubleSide }),
  );
  cloth.scale.set(1.62, 1.16, 1.08);
  cloth.position.set(0, 2.2, 0);
  g.add(cloth);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(1.04 * Math.sin(capAngle), 0.045, 10, 72), metal(COLORS.gold, 0.3, 0.95));
  hem.rotation.x = Math.PI / 2;
  hem.scale.set(1.62, 1.08, 1);
  hem.position.set(0, 2.2 + 1.04 * Math.cos(capAngle) * 1.16, 0);
  g.add(hem);
  g.userData.skin = skin;
  return g;
}

export function machine({ params }) {
  const variant = params.variant ?? 'gears';
  const { scene, camera } = createStage({ background: 0x0b0d12, fog: [14, 40], ambient: 0.9, sun: 2 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(20, 48), matte(0x2a2520));
  floor.rotation.x = -Math.PI / 2;
  const key = new THREE.PointLight(0xffe2b8, 60, 30);
  key.position.set(3, 6, 7);
  scene.add(floor, key);
  const bronze = metal(0xb5893f, 0.35, 0.9);
  const run = { update: () => {} };
  let focus = new THREE.Vector3(0, 1.5, 0);
  let radius = 3.5;

  if (variant === 'gears') {
    const specs = [[24, 1.6, -1.75, 1.9], [12, 0.8, 0.73, 1.9], [16, 1.07, 0.73, 3.85], [10, 0.67, 2.53, 1.9]];
    const gears = specs.map(([teeth, r, x, y], i) => {
      const m = new THREE.Mesh(gearGeometry(teeth, r), i === 2 ? metal(COLORS.gold, 0.3, 0.9) : bronze);
      m.position.set(x, y, 0);
      m.userData.teeth = teeth;
      scene.add(m, rod(new THREE.Vector3(x, y, -0.4), new THREE.Vector3(x, y, 0.4), 0.06, matte(0x555555)));
      return m;
    });
    const tag = label('Зубчатые передачи — сердце механизмов', { size: 0.34 });
    tag.position.set(0, 5.1, 0);
    scene.add(tag);
    focus = new THREE.Vector3(0.3, 2.9, 0);
    radius = 3.7;
    run.update = (t, p) => {
      const a = t * 0.6;
      gears[0].rotation.z = a;
      gears[1].rotation.z = -a * (24 / 12) + Math.PI / 12;
      gears[2].rotation.z = a * (24 / 16);
      gears[3].rotation.z = a * (24 / 10);
      fade(tag, stage(p, 0.08, 0.2));
    };
  }

  if (variant === 'clock') {
    // Al-Jazari's elephant clock (1206). Inside the elephant a bowl with a
    // small hole sinks in a tank of water; after half an hour it tips a lever:
    // a ball rolls from the tower into a dragon's mouth, the phoenix on the
    // dome turns and whistles, the driver strikes his drum.
    const gold = metal(COLORS.gold, 0.28, 0.95);
    const turquoise = new THREE.MeshStandardMaterial({ color: 0x1f9d92, roughness: 0.3, metalness: 0.2 });
    const beast = elephant();
    scene.add(beast);

    // Tank and float bowl inside the belly (seen when the body turns translucent).
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x8fb9b5, transparent: true, opacity: 0.16, roughness: 0.15, envMapIntensity: 0.25, depthWrite: false, side: THREE.DoubleSide });
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.15, 40, 1, true), glassMat);
    tank.position.set(0, 2.05, 0);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.95, 40), new THREE.MeshStandardMaterial({ color: 0x2a78b0, transparent: true, opacity: 0.7, roughness: 0.1 }));
    water.position.set(0, 1.97, 0);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), gold);
    const cord = rod(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 0.015, metal(0xd8c9a0, 0.5, 0.3));
    scene.add(tank, water, bowl, cord);

    // Howdah: platform, pavilion with four columns, drum with the balls, onion dome.
    const howdah = new THREE.Group();
    howdah.position.set(0.05, 3.42, 0);
    scene.add(howdah);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.14, 1.55), gold);
    howdah.add(deck);
    const carpet = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 1.35), new THREE.MeshStandardMaterial({ color: 0x1b3f7a, roughness: 0.8 }));
    carpet.position.y = 0.09;
    howdah.add(carpet);
    for (const [x, z] of [[-0.85, -0.55], [0.85, -0.55], [-0.85, 0.55], [0.85, 0.55]]) {
      howdah.add(rod(new THREE.Vector3(x, 0.1, z), new THREE.Vector3(x, 1.55, z), 0.06, gold));
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.16, 1.3), gold);
    lintel.position.y = 1.62;
    howdah.add(lintel);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.55, 40), turquoise);
    drum.position.y = 2.0;
    howdah.add(drum);
    // Dial with the half-hours on the front of the drum.
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.24, 32), new THREE.MeshStandardMaterial({ color: 0xf3e3bd, roughness: 0.5 }));
    dial.position.set(0.63, 2.0, 0);
    dial.rotation.y = Math.PI / 2;
    howdah.add(dial);
    const hand = rod(new THREE.Vector3(0.64, 2.0, 0), new THREE.Vector3(0.64, 2.18, 0), 0.015, metal(0x2a1a0c, 0.4, 0.5));
    howdah.add(hand);
    const balls = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), gold);
      b.position.set(Math.cos(a) * 0.68, 2.32, Math.sin(a) * 0.68);
      howdah.add(b);
      balls.push(b);
    }
    const domeProfile = [[0, 0], [0.62, 0], [0.74, 0.18], [0.72, 0.45], [0.55, 0.78], [0.3, 1.02], [0.1, 1.2], [0.04, 1.38], [0, 1.45]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const dome = new THREE.Mesh(new THREE.LatheGeometry(domeProfile, 48), gold);
    dome.position.y = 2.28;
    howdah.add(dome);

    // Phoenix on the dome.
    const phoenix = new THREE.Group();
    phoenix.position.y = 3.85;
    const pBody = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), turquoise);
    pBody.scale.set(1.5, 0.9, 0.9);
    const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), turquoise);
    pHead.position.set(0.24, 0.12, 0);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 10), gold);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.34, 0.12, 0);
    phoenix.add(pBody, pHead, beak);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 10), gold);
      wing.scale.set(1.2, 0.18, 0.9);
      wing.position.set(-0.02, 0.06, side * 0.2);
      wing.rotation.x = side * 0.5;
      phoenix.add(wing);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 12), gold);
    tail.rotation.z = Math.PI / 2 + 0.4;
    tail.position.set(-0.32, 0.08, 0);
    phoenix.add(tail);
    howdah.add(phoenix);

    // Driver on the neck with his drumstick, and a drum in front of him.
    const driver = new THREE.Group();
    driver.position.set(1.5, 3.45, 0);
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.5, 20), new THREE.MeshStandardMaterial({ color: 0x6b2a8a, roughness: 0.7 }));
    robe.position.y = 0.25;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), new THREE.MeshStandardMaterial({ color: 0xa7754f, roughness: 0.6 }));
    face.position.y = 0.62;
    const turban = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.8 }));
    turban.scale.set(1, 0.75, 1);
    turban.position.y = 0.72;
    driver.add(robe, face, turban);
    const arm = new THREE.Group();
    arm.position.set(0.05, 0.42, 0.16);
    arm.add(rod(new THREE.Vector3(), new THREE.Vector3(0.32, 0.08, 0), 0.035, robe.material));
    arm.add(rod(new THREE.Vector3(0.32, 0.08, 0), new THREE.Vector3(0.55, 0.3, 0), 0.02, metal(0x6b4423, 0.6, 0.1)));
    driver.add(arm);
    const tabla = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.18, 20), metal(0x9a6a33, 0.4, 0.6));
    tabla.position.set(0.45, 0.32, 0.18);
    driver.add(tabla);
    scene.add(driver);

    // Two dragons coil down from the tower; the ball runs through one of them.
    const dragonMat = new THREE.MeshStandardMaterial({ color: 0x2d7a4a, roughness: 0.35, metalness: 0.45 });
    const dragonPath = (side) => [
      new THREE.Vector3(0.1, 5.75, side * 0.75), new THREE.Vector3(0.55, 5.35, side * 1.05), new THREE.Vector3(0.2, 4.6, side * 1.25),
      new THREE.Vector3(-0.45, 4.0, side * 1.2), new THREE.Vector3(-0.25, 3.35, side * 1.3), new THREE.Vector3(0.3, 2.9, side * 1.45),
    ];
    const dragonCurve = new THREE.CatmullRomCurve3(dragonPath(1));
    for (const side of [-1, 1]) {
      scene.add(taperedTube(dragonPath(side), 0.13, 0.05, dragonMat, 80, 12));
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 16, 1, true), dragonMat);
      head.material.side = THREE.DoubleSide;
      head.position.set(0.1, 5.92, side * 0.75);
      scene.add(head);
    }
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.12, 0.3, 24), gold);
    vase.position.set(0.35, 2.75, 1.45);
    scene.add(vase);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), metal(COLORS.gold, 0.15, 1));
    const ballGlow = glow(0xffd27a, 0.6, 0.8);
    const chime = glow(0xffe2a0, 2.2, 0);
    chime.position.set(0.35, 2.95, 1.45);
    const whistle = glow(0x9ef5e8, 1.4, 0);
    whistle.position.set(0.05, 7.3, 0);
    scene.add(ball, ballGlow, chime, whistle);

    const steps = [
      [0.0, 'Часы-слон аль-Джазари, 1206 год'],
      [0.22, 'Внутри слона — бак с водой и чаша с отверстием'],
      [0.4, 'Чаша медленно наполняется и тонет полчаса'],
      [0.6, 'Утонув, она дёргает шнур: шар катится в пасть дракона'],
      [0.76, 'Феникс поворачивается и свистит, погонщик бьёт в барабан'],
    ];
    const longest = steps.reduce((a, b) => (b[1].length > a.length ? b[1] : a), '');
    const tag = label(steps[0][1], { size: 0.3, template: longest });
    scene.add(tag);
    focus = new THREE.Vector3(0.35, 3.75, 0);
    radius = 5.3;
    const skin = beast.userData.skin;

    run.update = (t, p) => {
      // X-ray: the body turns translucent while the tank is explained.
      const xray = stage(p, 0.2, 0.3) * (1 - stage(p, 0.86, 0.96));
      skin.transparent = xray > 0.01;
      skin.opacity = 1 - xray * 0.72;
      skin.depthWrite = xray < 0.5;
      fade(tank, xray);
      fade(water, xray);
      fade(bowl, Math.max(xray, 0.001));
      fade(cord, xray);
      // One full cycle told by the narration, then it keeps ticking.
      const first = p < 0.82;
      const u = first ? stage(p, 0.36, 0.62) : ((t % 6) / 6) * 1.25;
      const sink = clamp(u);
      bowl.position.set(0, 2.38 - sink * 0.75, 0);
      placeRod(cord, bowl.position.clone().setY(bowl.position.y + 0.05), new THREE.Vector3(0, 3.45, 0));
      const drop = first ? stage(p, 0.62, 0.78) : clamp((u - 1) / 0.25);
      ball.visible = drop > 0 && drop < 1;
      ballGlow.visible = ball.visible;
      if (ball.visible) {
        dragonCurve.getPointAt(drop, ball.position);
        ballGlow.position.copy(ball.position);
      }
      const ring = drop > 0.97 || (drop > 0 && drop < 0.05) ? 1 : 0;
      chime.material.opacity = Math.max(ring * (drop > 0.9 ? 1 : 0), chime.material.opacity - 0.02);
      const strike = drop > 0 && drop < 1 ? Math.abs(Math.sin(drop * Math.PI * 6)) : 0;
      arm.rotation.z = -0.5 * strike;
      phoenix.rotation.y = drop > 0 ? drop * Math.PI * 2 : 0;
      whistle.material.opacity = drop > 0 && drop < 1 ? 0.8 * Math.sin(drop * Math.PI) : 0;
      // Balls in the drum: one is used every half hour.
      const used = first ? (drop >= 1 ? 1 : 0) : 1 + Math.floor(t / 6);
      balls.forEach((b, i) => {
        b.visible = i >= used % 12;
      });
      hand.rotation.x = 0;
      const step = steps.filter(([at]) => p >= at).at(-1);
      tag.userData.set(step[1]);
      tag.position.set(0.3, 7.95, 0);
      fade(tag, stage(p, 0.02, 0.08));
    };
  }

  if (variant === 'pump') {
    const wheel = new THREE.Group();
    wheel.position.set(0, 2, 0);
    wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.18, 48), bronze).rotateX(Math.PI / 2));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      wheel.add(rod(new THREE.Vector3(0, 0, 0.12), new THREE.Vector3(Math.cos(a) * 1.1, Math.sin(a) * 1.1, 0.12), 0.03, matte(0x6b5236)));
    }
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 12), metal(COLORS.gold));
    pin.rotation.x = Math.PI / 2;
    scene.add(wheel, pin);
    const rods = [-1, 1].map(() => {
      const r = rod(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), 0.05, metal(0xd0d6dc, 0.3, 0.9));
      scene.add(r);
      return r;
    });
    const cylinders = [-1, 1].map((side) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x9c8a66, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
      c.rotation.z = Math.PI / 2;
      c.position.set(side * 3.9, 2, 0);
      scene.add(c);
      return c;
    });
    const pistons = [-1, 1].map(() => {
      const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.35, 24), metal(COLORS.gold));
      piston.rotation.z = Math.PI / 2;
      scene.add(piston);
      return piston;
    });
    const drops = Array.from({ length: 16 }, (_, i) => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), shine(0x4fa3c7, 0.6));
      d.userData = { side: i % 2 ? 1 : -1, offset: i / 16 };
      scene.add(d);
      return d;
    });
    const tag = label('Вращение колеса → движение поршней', { size: 0.34 });
    tag.position.set(0, 4.2, 0);
    scene.add(tag);
    focus = new THREE.Vector3(0, 2, 0);
    radius = 4.8;
    const r = 0.7;
    const l = 2.2;
    run.update = (t, p) => {
      const a = t * 1.4;
      wheel.rotation.z = a;
      const pinPos = new THREE.Vector3(Math.cos(a) * r, 2 + Math.sin(a) * r, 0.25);
      pin.position.copy(pinPos);
      [-1, 1].forEach((side, i) => {
        const dy = pinPos.y - 2;
        const x = pinPos.x + side * Math.sqrt(l * l - dy * dy);
        const head = new THREE.Vector3(x, 2, 0);
        placeRod(rods[i], pinPos, head);
        pistons[i].position.set(x + side * 0.2, 2, 0);
      });
      drops.forEach((d) => {
        const u = (t * 0.6 + d.userData.offset) % 1;
        d.position.set(d.userData.side * (4.75 + u * 0.5), 2 - u * u * 1.8, 0);
      });
      fade(tag, stage(p, 0.08, 0.18));
    };
  }

  if (variant === 'steam') {
    const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.2, 32), metal(0x8a6a4a, 0.4, 0.7));
    kettle.position.set(-2.2, 1, 0);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), metal(0x8a6a4a, 0.4, 0.7));
    lid.position.set(-2.2, 1.6, 0);
    const nozzle = rod(new THREE.Vector3(-1.6, 1.3, 0), new THREE.Vector3(-0.6, 1.7, 0), 0.07, metal(0x8a6a4a, 0.4, 0.7));
    const fire = glow(0xff8a30, 1.6, 1);
    fire.position.set(-2.2, 0.25, 0);
    const fireLight = new THREE.PointLight(0xff8a30, 14, 6);
    fireLight.position.set(-2.2, 0.4, 0.6);
    scene.add(kettle, lid, nozzle, fire, fireLight);
    const turbine = new THREE.Group();
    turbine.position.set(0.4, 1.9, 0);
    turbine.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 16), metal(COLORS.gold)).rotateX(Math.PI / 2));
    for (let i = 0; i < 8; i++) {
      const vane = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.3), metal(COLORS.gold, 0.3, 0.9));
      const a = (i / 8) * Math.PI * 2;
      vane.position.set(Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0);
      vane.rotation.z = a;
      turbine.add(vane);
    }
    scene.add(turbine);
    const spit = new THREE.Group();
    spit.position.set(0.4, 1.9, 0);
    spit.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -2.6), 0.04, metal(0xd0d6dc, 0.3, 0.9)));
    const roast = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 6, 16), matte(0x8a4a2a, 0.6));
    roast.rotation.x = Math.PI / 2;
    roast.position.z = -1.7;
    spit.add(roast);
    scene.add(spit);
    const puffs = Array.from({ length: 40 }, (_, i) => {
      const s = glow(0xeeeeee, 0.3, 0.5);
      s.material.blending = THREE.NormalBlending;
      s.userData.offset = i / 40;
      scene.add(s);
      return s;
    });
    const tag = label('Паровой вертел Такиюддина, 1551 год', { size: 0.34 });
    tag.position.set(-0.8, 3.6, 0);
    scene.add(tag);
    focus = new THREE.Vector3(-0.8, 1.6, -0.6);
    radius = 3.6;
    run.update = (t, p) => {
      const f = 0.9 + Math.sin(t * 10) * 0.08;
      fire.scale.setScalar(1.6 * f);
      fireLight.intensity = 14 * f;
      turbine.rotation.z = -t * 3;
      spit.rotation.z = -t * 3;
      puffs.forEach((s) => {
        const u = (t * 0.8 + s.userData.offset) % 1;
        s.position.set(-0.6 + u * 1.1, 1.7 + u * 0.25 + Math.sin(u * 9) * 0.05, (Math.sin(u * 13 + s.userData.offset * 40) - 0.5) * 0.15);
        s.scale.setScalar(0.2 + u * 0.6);
        s.material.opacity = 0.5 * (1 - u);
      });
      fade(tag, stage(p, 0.08, 0.18));
    };
  }

  return {
    scene,
    camera,
    update({ t, p }) {
      run.update(t, p);
      orbit(camera, focus, fitDistance(camera, radius), lerp(0.45, -0.25, smooth(p)), 0.22);
    },
  };
}

/* ---------- Al-Kashi: doubling polygons to find π ---------- */

export function pi() {
  const { scene, camera } = darkStage();
  scene.add(starfield(1500, 300, 111));
  const R = 2.4;
  const circle = ring(R, 0.03, shine(COLORS.gold, 1));
  scene.add(circle);
  const fill = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: COLORS.teal, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  const edge = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x7fd3c8 }));
  scene.add(fill, edge);
  const sides = label('Сторон: 6', { size: 0.4, template: 'Сторон: 3·2²⁸ = 805 306 368' });
  const value = label('π ≈ 3,0000000', { size: 0.5, template: 'π ≈ 3,1415926535897932' });
  sides.position.set(0, R + 0.8, 0);
  value.position.set(0, -R - 0.85, 0);
  scene.add(sides, value);
  let shown = 0;

  const setPolygon = (n) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 2;
      pts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0));
    }
    edge.geometry.dispose();
    edge.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    fill.geometry.dispose();
    fill.geometry = new THREE.ShapeGeometry(new THREE.Shape(pts.map((v) => new THREE.Vector2(v.x, v.y))));
  };

  return {
    scene,
    camera,
    update({ t, p }) {
      const step = Math.min(6, Math.floor(stage(p, 0.05, 0.75) * 7));
      const n = 6 * 2 ** step;
      if (n !== shown) {
        setPolygon(n);
        shown = n;
      }
      if (p < 0.8) {
        sides.userData.set(`Сторон: ${n}`);
        value.userData.set(`π ≈ ${(n * Math.sin(Math.PI / n)).toFixed(7).replace('.', ',')}`);
      } else {
        sides.userData.set('Сторон: 3·2²⁸ = 805 306 368');
        value.userData.set('π ≈ 3,1415926535897932');
      }
      circle.rotation.z = t * 0.02;
      camera.position.set(Math.sin(t * 0.1) * 0.8, 0.2, fitDistance(camera, 3.6));
      camera.lookAt(0, 0, 0);
    },
  };
}
