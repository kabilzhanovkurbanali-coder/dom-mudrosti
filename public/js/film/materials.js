// Materials and props for the 3D scenes, drawn in code: walnut wood,
// parchment with Arabic writing, glazed tiles with eight-pointed stars,
// brass and gold, an oil lamp with a living flame, a reed pen and ink,
// soft out-of-focus lights. They make the animations look like a real
// room in the House of Wisdom rather than shapes in a void.
import { THREE, rng, glow } from './kit.js';

const canvasTexture = (canvas, { repeat = null, srgb = true } = {}) => {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(...repeat);
  }
  return tex;
};

const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) {
    const value = make();
    // Shared textures survive the clean-up of a scene.
    for (const v of Object.values(value)) if (v?.isTexture) v.userData.shared = true;
    cache.set(key, value);
  }
  return cache.get(key);
};

/* ---------- Wood ---------- */

// Walnut planks: colour map and a matching bump map from the same grain.
export function woodMaps(seed = 3, { light = '#6b4325', dark = '#2e1a0d', size = 1024 } = {}) {
  return once(`wood:${seed}:${light}`, () => {
    const color = document.createElement('canvas');
    const bump = document.createElement('canvas');
    color.width = bump.width = size;
    color.height = bump.height = size / 2;
    const g = color.getContext('2d');
    const b = bump.getContext('2d');
    const rand = rng(seed);
    const h = size / 2;
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, light);
    grad.addColorStop(0.5, dark);
    grad.addColorStop(1, light);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, h);
    b.fillStyle = '#808080';
    b.fillRect(0, 0, size, h);
    // Planks.
    const planks = 4;
    for (let p = 0; p < planks; p++) {
      const y0 = (p * h) / planks;
      g.fillStyle = `rgba(${rand() < 0.5 ? '255,200,140' : '20,8,2'},${0.04 + rand() * 0.06})`;
      g.fillRect(0, y0, size, h / planks);
      g.fillStyle = 'rgba(10,4,0,0.55)';
      g.fillRect(0, y0, size, 2);
      b.fillStyle = '#303030';
      b.fillRect(0, y0, size, 3);
    }
    // Grain: long wavy lines.
    for (let i = 0; i < 520; i++) {
      const y = rand() * h;
      const amp = 2 + rand() * 7;
      const freq = 0.004 + rand() * 0.01;
      const phase = rand() * 10;
      const alpha = 0.04 + rand() * 0.12;
      g.strokeStyle = rand() < 0.75 ? `rgba(20,8,2,${alpha})` : `rgba(255,190,120,${alpha * 0.6})`;
      b.strokeStyle = `rgba(${rand() < 0.75 ? '40,40,40' : '200,200,200'},${alpha * 2})`;
      g.lineWidth = b.lineWidth = 0.6 + rand() * 1.6;
      for (const ctx of [g, b]) {
        ctx.beginPath();
        for (let x = 0; x <= size; x += 8) {
          const yy = y + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1 + phase) * amp * 0.3;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    }
    // A few knots.
    for (let i = 0; i < 5; i++) {
      const x = rand() * size;
      const y = rand() * h;
      const r = 6 + rand() * 14;
      const k = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
      k.addColorStop(0, 'rgba(15,6,1,0.7)');
      k.addColorStop(0.4, 'rgba(40,20,8,0.35)');
      k.addColorStop(1, 'rgba(40,20,8,0)');
      g.fillStyle = k;
      g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    }
    return { map: canvasTexture(color, { repeat: [1, 1] }), bump: canvasTexture(bump, { repeat: [1, 1], srgb: false }) };
  });
}

export function wood(seed = 3, opts = {}) {
  const { map, bump } = woodMaps(seed, opts);
  return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.6, roughness: 0.55, metalness: 0, color: opts.tint ?? 0xffffff });
}

/* ---------- Parchment with writing ---------- */

const ARABIC = "'Geeza Pro', 'Noto Naskh Arabic', 'Amiri', 'Scheherazade New', 'Traditional Arabic', 'Arial', serif";

// lines: Arabic text written right to left in brown ink; title: a red heading.
export function parchmentMaps({ lines = [], title = '', seed = 7, size = 1024, aspect = 1, ruled = false, margin = 0.08 } = {}) {
  return once(`parchment:${seed}:${title}:${lines.join('|')}:${aspect}:${ruled}`, () => {
    const w = size;
    const h = Math.round(size / aspect);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const rand = rng(seed);
    const grad = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.72);
    grad.addColorStop(0, '#f2e2bd');
    grad.addColorStop(0.65, '#e0c896');
    grad.addColorStop(1, '#a98455');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // Stains and fibres.
    for (let i = 0; i < 40; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 20 + rand() * 120;
      const s = g.createRadialGradient(x, y, 0, x, y, r);
      s.addColorStop(0, `rgba(140,100,50,${0.03 + rand() * 0.05})`);
      s.addColorStop(1, 'rgba(140,100,50,0)');
      g.fillStyle = s;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 2600; i++) {
      g.strokeStyle = `rgba(${rand() < 0.5 ? '110,80,40' : '255,248,225'},${0.04 + rand() * 0.07})`;
      g.lineWidth = 0.5 + rand();
      const x = rand() * w;
      const y = rand() * h;
      const a = rand() * Math.PI;
      const l = 3 + rand() * 12;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    if (ruled) {
      g.strokeStyle = 'rgba(120,85,45,0.14)';
      for (let y = h * 0.1; y < h * 0.95; y += h / 24) {
        g.beginPath();
        g.moveTo(w * margin, y);
        g.lineTo(w * (1 - margin), y);
        g.stroke();
      }
    }
    // Writing, right to left.
    g.direction = 'rtl';
    g.textAlign = 'right';
    g.textBaseline = 'alphabetic';
    let y = h * margin + w * 0.06;
    if (title) {
      g.fillStyle = '#8c2a14';
      g.font = `600 ${Math.round(w * 0.05)}px ${ARABIC}`;
      g.fillText(title, w * (1 - margin), y);
      y += w * 0.075;
    }
    g.fillStyle = 'rgba(48,26,10,0.92)';
    g.font = `500 ${Math.round(w * 0.04)}px ${ARABIC}`;
    for (const line of lines) {
      g.fillText(line, w * (1 - margin), y);
      y += w * 0.062;
    }
    return { map: canvasTexture(c) };
  });
}

export function parchment(opts = {}) {
  const { map } = parchmentMaps(opts);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0, envMapIntensity: 0.25 });
}

/* ---------- Glazed tiles ---------- */

// An eight-pointed star.
function star(g, x, y, r, inner = 0.42) {
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * (inner + 0.3) : r;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i) g.lineTo(px, py);
    else g.moveTo(px, py);
  }
  g.closePath();
}

// A glazed tile face: glaze colour, star lattice, border and a gilded inscription.
export function tileMaps({ base = '#1f8f86', deep = '#0d4d4a', line = '#e9f4ef', text = '', textColor = '#f3d27a', cells = [2, 2], seed = 1, w = 512, h = 512 } = {}) {
  return once(`tile:${base}:${text}:${cells}:${w}:${h}`, () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(w * 0.4, h * 0.35, 10, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, base);
    grad.addColorStop(1, deep);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // Pooling of the glaze: soft darker blotches.
    const rand = rng(seed);
    for (let i = 0; i < 30; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 20 + rand() * 80;
      const s = g.createRadialGradient(x, y, 0, x, y, r);
      s.addColorStop(0, `rgba(0,0,0,${0.04 + rand() * 0.06})`);
      s.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = s;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Star lattice.
    const [cx, cy] = cells;
    const sx = w / cx;
    const sy = h / cy;
    const r = Math.min(sx, sy) * 0.36;
    g.lineWidth = Math.max(2, r * 0.07);
    for (let i = 0; i < cx; i++) {
      for (let j = 0; j < cy; j++) {
        const x = sx * (i + 0.5);
        const y = sy * (j + 0.5);
        star(g, x, y, r);
        g.fillStyle = 'rgba(255,255,255,0.10)';
        g.fill();
        g.strokeStyle = line;
        g.globalAlpha = 0.75;
        g.stroke();
        g.globalAlpha = 1;
        star(g, x, y, r * 0.45);
        g.fillStyle = 'rgba(243,210,122,0.55)';
        g.fill();
      }
    }
    // Border.
    g.strokeStyle = 'rgba(243,210,122,0.85)';
    g.lineWidth = Math.min(w, h) * 0.03;
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
    if (text) {
      g.font = `600 italic ${Math.round(Math.min(w, h) * 0.3)}px 'Cormorant Garamond', Georgia, serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,0.6)';
      g.shadowBlur = 12;
      g.fillStyle = textColor;
      g.fillText(text, w / 2, h / 2 + Math.min(w, h) * 0.02);
      g.shadowBlur = 0;
    }
    return { map: canvasTexture(c) };
  });
}

// Glossy glaze: a clear coat over the coloured tile.
export function glaze(opts = {}) {
  const { map } = tileMaps(opts);
  return new THREE.MeshPhysicalMaterial({ map, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.1 });
}

export const brass = (color = 0xc9a256, roughness = 0.32) =>
  new THREE.MeshStandardMaterial({ color, metalness: 0.95, roughness, envMapIntensity: 1.3 });
export const gold = (roughness = 0.22) =>
  new THREE.MeshStandardMaterial({ color: 0xe2b54f, metalness: 1, roughness, envMapIntensity: 1.5, emissive: 0x2a1a00, emissiveIntensity: 0.25 });

// A gilded tile with an inscription.
export function gilded(text = '', { w = 512, h = 512 } = {}) {
  const { map } = tileMaps({ base: '#f1cd6e', deep: '#a8772a', line: '#fff4cf', text, textColor: '#5a3510', cells: [2, 2], w, h });
  return new THREE.MeshStandardMaterial({ map, metalness: 0.85, roughness: 0.28, envMapIntensity: 1.4, emissive: 0x2a1a00, emissiveIntensity: 0.2 });
}

/* ---------- Props ---------- */

// An oil lamp with a flickering flame; returns { group, light, update(t) }.
export function oilLamp({ intensity = 26, distance = 30, shadow = false } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.LatheGeometry([
      new THREE.Vector2(0, 0), new THREE.Vector2(0.32, 0.02), new THREE.Vector2(0.4, 0.12), new THREE.Vector2(0.36, 0.24),
      new THREE.Vector2(0.18, 0.3), new THREE.Vector2(0.06, 0.34), new THREE.Vector2(0, 0.34),
    ], 40),
    brass(0xb8893c, 0.38),
  );
  body.castShadow = true;
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.42, 16), brass(0xb8893c, 0.38));
  spout.rotation.z = Math.PI / 2 - 0.35;
  spout.position.set(0.42, 0.24, 0);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 10, 24, Math.PI * 1.3), brass(0xb8893c, 0.38));
  handle.position.set(-0.42, 0.22, 0);
  handle.rotation.z = Math.PI * 0.35;
  group.add(body, spout, handle);
  const flame = new THREE.Group();
  flame.position.set(0.6, 0.38, 0);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }));
  core.scale.set(0.8, 1.9, 0.8);
  const halo = glow(0xffa23a, 0.9, 0.85);
  const big = glow(0xff8a2a, 2.6, 0.3);
  flame.add(core, halo, big);
  group.add(flame);
  const light = new THREE.PointLight(0xffb066, intensity, distance, 2);
  light.position.copy(flame.position).add(new THREE.Vector3(0, 0.15, 0));
  if (shadow) {
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.002;
  }
  group.add(light);
  return {
    group,
    light,
    flame,
    update(t) {
      const f = 0.86 + 0.08 * Math.sin(t * 13.1) + 0.05 * Math.sin(t * 23.7 + 1.3) + 0.03 * Math.sin(t * 41.9);
      light.intensity = intensity * f;
      core.scale.set(0.8, 1.9 * (0.9 + 0.15 * Math.sin(t * 17)), 0.8);
      flame.rotation.z = Math.sin(t * 3.1) * 0.08;
      halo.material.opacity = 0.75 * f;
      big.material.opacity = 0.26 * f;
    },
  };
}

// A reed pen (qalam): its tip is at the origin, the pen rises along +y.
export function qalam() {
  const group = new THREE.Group();
  const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 1.6, 12), new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.6 }));
  reed.position.y = 0.95;
  const nib = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 12), new THREE.MeshStandardMaterial({ color: 0x2a1a0c, roughness: 0.4 }));
  nib.rotation.x = Math.PI;
  nib.position.y = 0.09;
  for (const m of [reed, nib]) m.castShadow = true;
  group.add(reed, nib);
  return group;
}

export function inkwell() {
  const group = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.28, 0), new THREE.Vector2(0.33, 0.12), new THREE.Vector2(0.3, 0.3), new THREE.Vector2(0.14, 0.38), new THREE.Vector2(0.14, 0.44), new THREE.Vector2(0, 0.44)], 32),
    new THREE.MeshPhysicalMaterial({ color: 0x1b2a3a, roughness: 0.15, clearcoat: 1, metalness: 0.1 }),
  );
  pot.castShadow = true;
  const ink = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.05 }));
  ink.rotation.x = -Math.PI / 2;
  ink.position.y = 0.43;
  group.add(pot, ink);
  return group;
}

// Soft round lights far behind the subject, like a lens out of focus.
export function bokeh(count = 26, { spread = [26, 10], depth = -18, colors = [0xffb35c, 0xffd28a, 0xff9a4a, 0x9fb7ff], seed = 9, size = [0.8, 2.6] } = {}) {
  const group = new THREE.Group();
  const rand = rng(seed);
  for (let i = 0; i < count; i++) {
    const s = glow(colors[Math.floor(rand() * colors.length)], size[0] + rand() * (size[1] - size[0]), 0.12 + rand() * 0.22);
    s.position.set((rand() - 0.5) * spread[0], (rand() - 0.2) * spread[1], depth - rand() * 8);
    s.userData.phase = rand() * Math.PI * 2;
    group.add(s);
  }
  group.userData.update = (t) => {
    for (const s of group.children) s.material.opacity = (0.14 + 0.06 * Math.sin(t * 0.7 + s.userData.phase)) * (s.userData.base ?? 1);
  };
  return group;
}

// A closed book: leather cover, gilt edge.
export function book({ w = 1.4, h = 0.3, d = 1.0, cover = 0x6b2418 } = {}) {
  const group = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: cover, roughness: 0.7 });
  const pages = new THREE.MeshStandardMaterial({ color: 0xe9d9b0, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, h - 0.06, d - 0.04), pages);
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), leather);
  top.position.y = h / 2 - 0.02;
  const bottom = top.clone();
  bottom.position.y = -h / 2 + 0.02;
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, d), leather);
  spine.position.x = -w / 2 + 0.03;
  const medallion = new THREE.Mesh(new THREE.CircleGeometry(0.18, 8), gold(0.3));
  medallion.rotation.x = -Math.PI / 2;
  medallion.position.y = h / 2 + 0.002;
  group.add(body, top, bottom, spine, medallion);
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return group;
}
