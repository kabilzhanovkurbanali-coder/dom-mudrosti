// A 3D scholar who can walk, raise an instrument to his eye, point, write
// and work with his hands. Built from simple shapes with jointed limbs, so
// every film can show its hero doing the discovery, not just a diagram.
import { THREE, clamp, lerp } from './kit.js';

// Looks of the heroes: robe, inner robe, sash, headwear, beard, scarf.
export const LOOKS = {
  default: { robe: 0x5d6f8c, inner: 0xd9cfbd, sash: 0x8a4a28, head: 'turban', headColor: 0xf2ece0, beard: 0x2b2420 },
  'al-khwarizmi': { robe: 0x2f3f7a, headColor: 0xf2ece0, beard: 0x231c18 },
  'al-farghani': { robe: 0x6b4a2e, headColor: 0x2f6b4a, beard: 0x8d877e },
  'al-kindi': { robe: 0xe7dcc2, inner: 0xcfc4ac, headColor: 0xf6f0e2, beard: 0x151110, sash: 0x9c7a3c },
  'ar-razi': { robe: 0x2b2a33, headColor: 0x2b2a33, beard: 0x9a948a },
  'al-farabi': { robe: 0x7a6a55, head: 'cap', headColor: 0x6b5236, beard: 0xc9c4ba, beardLength: 1.5 },
  'az-zahrawi': { robe: 0xd9d2c0, headColor: 0xf6f0e2, beard: 0xe6e2da },
  'ibn-al-haytham': { robe: 0x2e2a28, headColor: 0x7a5a3a, beard: 0x4a4540 },
  'al-biruni': { robe: 0x8f98a8, inner: 0xe2dacb, headColor: 0x2f8f86, scarf: 0x2f8f86, beard: 0x3a3330, bag: true },
  'ibn-sina': { robe: 0x2a2440, sash: 0xb08a3a, headColor: 0xf6f0e2, beard: 0x141010 },
  'omar-khayyam': { robe: 0x9a8a6a, headColor: 0xe9e2d2, beard: 0x241c18 },
  'al-jazari': { robe: 0x6b5a40, headColor: 0xd8cdb6, beard: 0x2a201a, apron: 0x5a3a20 },
  'nasir-ad-din-tusi': { robe: 0x1f2430, headColor: 0xf6f0e2, headSize: 1.25, beard: 0xe8e4dc, beardLength: 1.3 },
  'ibn-an-nafis': { robe: 0x3d4a5a, headColor: 0xf6f0e2, beard: 0x2a221c },
  'al-kashi': { robe: 0x7a6a58, headColor: 0xc9bea6, beard: 0x2a221c },
  ulugbek: { robe: 0x7a2e2a, sash: 0xd6ab55, head: 'crown', headColor: 0x2a2a3a, beard: 0x1a1412, beardLength: 0.7 },
  'ali-kushchi': { robe: 0x2f4f8a, headColor: 0xf6f0e2, beard: 0xb8b2a8 },
  'taqi-al-din': { robe: 0x4a2e22, sash: 0x8a6a3a, headColor: 0xf6f0e2, headSize: 1.35, beard: 0xa8a29a, fur: true },
  'yusuf-balasaguni': { robe: 0x8a3a2a, sash: 0xd6ab55, headColor: 0xf2ece0, beard: 0x5a5450 },
  'mahmud-kashgari': { robe: 0x6a5a48, headColor: 0xf2ece0, beard: 0x231c18, bag: true },
  'abu-nasr-mansur': { robe: 0x6a2a6a, sash: 0xd6ab55, headColor: 0x7a1f3a, beard: 0x231c18, jewel: true },
  'al-jawhari': { robe: 0x8a8070, headColor: 0xf2ece0, beard: 0xb8b2a8 },
  'haidar-dulati': { robe: 0x3a2a4a, sash: 0xd6ab55, head: 'cap', headColor: 0x2a2018, beard: 0x141010 },
};

const SKIN = 0xb98563;

function cloth(color, roughness = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

// Robe: a long coat widening to the hem, slightly flattened front to back.
function robeGeometry(phiStart = 0, phiLength = Math.PI * 2) {
  const profile = [
    [0.0, 0.06], [0.33, 0.06], [0.35, 0.12], [0.31, 0.45], [0.26, 0.8], [0.22, 1.0],
    [0.215, 1.2], [0.235, 1.38], [0.2, 1.45], [0.09, 1.5], [0.0, 1.5],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(profile.slice(1, -2), phiLength === Math.PI * 2 ? 40 : 6, phiStart, phiLength);
  if (phiLength === Math.PI * 2) {
    geo.dispose();
    const full = new THREE.LatheGeometry(profile, 40);
    full.scale(1, 1, 0.78);
    return full;
  }
  geo.scale(1, 1, 0.78);
  return geo;
}

function makeProp(kind) {
  const gold = new THREE.MeshStandardMaterial({ color: 0xd6a94a, roughness: 0.28, metalness: 0.95 });
  const g = new THREE.Group();
  if (kind === 'astrolabe') {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.014, 40), gold);
    disc.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 8, 40), gold);
    const ringTop = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 16), gold);
    ringTop.position.y = 0.115;
    // The alidade: a rotating sighting rule across the face.
    const rule = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.012, 0.006), new THREE.MeshStandardMaterial({ color: 0x8a6a2a, metalness: 0.8, roughness: 0.4 }));
    rule.position.z = 0.012;
    rule.rotation.z = 0.5;
    g.add(disc, rim, ringTop, rule);
    g.userData.rule = rule;
  } else if (kind === 'quill') {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.002, 0.2, 6), cloth(0xf4efe2)));
  } else if (kind === 'book') {
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.16), cloth(0x6a1f18, 0.6));
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.024, 0.15), cloth(0xe9dcc0));
    pages.position.y = 0.004;
    g.add(cover, pages);
  } else if (kind === 'compass') {
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.002, 0.18, 6), gold);
      leg.position.set(side * 0.03, -0.08, 0);
      leg.rotation.z = side * 0.25;
      g.add(leg);
    }
  } else if (kind === 'scroll') {
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.24, 16), cloth(0xe9dcc0));
    roll.rotation.z = Math.PI / 2;
    g.add(roll);
  }
  return g;
}

export function createFigure(who = 'default', { prop = null } = {}) {
  const L = { ...LOOKS.default, ...(LOOKS[who] ?? {}) };
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = cloth(SKIN, 0.6);
  const robeMat = cloth(L.robe, 0.78);
  // Sleeves a shade darker, so the arms read against the robe.
  const sleeveMat = cloth(new THREE.Color(L.robe).multiplyScalar(0.78).getHex(), 0.8);
  const innerMat = cloth(L.inner, 0.85);

  // Legs under the robe: only the boots show when he walks.
  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(0.085 * side, 0.9, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.062, 0.44, 12), innerMat);
    thigh.position.y = -0.22;
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.4, 12), innerMat);
    shin.position.y = -0.2;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.25), cloth(0x3a2618, 0.6));
    boot.position.set(0, -0.42, 0.05);
    knee.add(shin, boot);
    hip.add(thigh, knee);
    body.add(hip);
    return { hip, knee };
  });

  const robe = new THREE.Mesh(robeGeometry(), robeMat);
  body.add(robe);
  // The inner robe shows down the front opening: a stripe on the robe itself.
  const stripe = robeGeometry(-0.2, 0.4);
  stripe.scale(1.012, 1, 1.012);
  const front = new THREE.Mesh(stripe, innerMat);
  body.add(front);
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.035, 10, 40), cloth(L.sash, 0.7));
  sash.rotation.x = Math.PI / 2;
  sash.scale.set(1, 0.78, 1);
  sash.position.y = 0.98;
  body.add(sash);
  if (L.apron) {
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.6, 0.02), cloth(L.apron, 0.6));
    apron.position.set(0, 0.68, 0.27);
    body.add(apron);
  }
  if (L.fur) {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 10, 32), cloth(0x8a6a4a, 1));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.43;
    body.add(collar);
  }
  if (L.bag) {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.07), cloth(0x6a4428, 0.6));
    bag.position.set(-0.3, 0.9, 0.04);
    bag.rotation.z = 0.1;
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.012, 6, 48, Math.PI * 0.9), cloth(0x5a3a20, 0.6));
    strap.position.set(-0.05, 1.12, 0);
    strap.rotation.set(0, Math.PI / 2, 2.4);
    body.add(bag, strap);
  }

  // Arms: shoulder → elbow → hand; wide sleeves of the robe.
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.22 * side, 1.39, 0);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.06, 0.3, 12), sleeveMat);
    upper.position.y = -0.15;
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.085, 0.27, 12), sleeveMat);
    lower.position.y = -0.135;
    const hand = new THREE.Group();
    hand.position.y = -0.3;
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), skin);
    palm.scale.set(0.8, 1.1, 0.55);
    hand.add(palm);
    elbow.add(lower, hand);
    shoulder.add(upper, elbow);
    body.add(shoulder);
    return { shoulder, elbow, hand, side };
  });

  // Head: face, beard, headwear.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 12), skin);
  neck.position.y = 1.5;
  body.add(neck);
  const head = new THREE.Group();
  head.position.y = 1.62;
  body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 18), skin);
  skull.scale.set(0.92, 1.08, 0.98);
  head.add(skull);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 8), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.005, 0.105);
  head.add(nose);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x15100c, roughness: 0.2 });
  const browMat = cloth(L.beard, 1);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), eyeMat);
    eye.position.set(0.034 * side, 0.024, 0.093);
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), cloth(0xf2ece2, 0.4));
    white.scale.set(1.2, 0.8, 0.5);
    white.position.set(0.034 * side, 0.024, 0.088);
    head.add(white);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.01), browMat);
    brow.position.set(0.036 * side, 0.045, 0.094);
    brow.rotation.z = -0.15 * side;
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), skin);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(0.098 * side, 0.005, 0);
    head.add(eye, brow, ear);
  }
  const beardMat = cloth(L.beard, 1);
  const beardLen = L.beardLength ?? 1;
  // Beard along the jaw and chin, below the nose; the face stays visible.
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 12, -Math.PI * 0.55, Math.PI * 1.1, Math.PI * 0.55, Math.PI * 0.45), beardMat);
  beard.scale.set(1.0, 1.25 * beardLen, 1.0);
  beard.position.set(0, -0.02, 0.012);
  const mustache = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 16, Math.PI), beardMat);
  mustache.position.set(0, -0.032, 0.1);
  mustache.rotation.z = Math.PI;
  head.add(beard, mustache);

  const headMat = cloth(L.headColor, 0.8);
  const hs = L.headSize ?? 1;
  if (L.head === 'turban') {
    const t1 = new THREE.Mesh(new THREE.TorusGeometry(0.098 * hs, 0.045 * hs, 12, 32), headMat);
    t1.rotation.x = Math.PI / 2;
    t1.position.y = 0.075;
    const t2 = new THREE.Mesh(new THREE.TorusGeometry(0.08 * hs, 0.042 * hs, 12, 32), headMat);
    t2.rotation.x = Math.PI / 2 + 0.25;
    t2.position.y = 0.12;
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.09 * hs, 18, 12), headMat);
    top.scale.set(1, 0.75, 1);
    top.position.y = 0.135;
    head.add(t1, t2, top);
    if (L.jewel) {
      const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2ad0b0, roughness: 0.1, metalness: 0.3, emissive: 0x0a4a40 }));
      jewel.position.set(0, 0.11, 0.13);
      head.add(jewel);
    }
  } else if (L.head === 'crown') {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.12, 24), headMat);
    hat.position.y = 0.1;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.014, 8, 32), new THREE.MeshStandardMaterial({ color: 0xd6ab55, metalness: 0.9, roughness: 0.3 }));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.06;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 16), headMat);
    tip.position.y = 0.2;
    head.add(hat, band, tip);
  } else {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.112, 0.1, 24), cloth(L.headColor, 1));
    cap.position.y = 0.09;
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), cloth(L.headColor, 1));
    top.position.y = 0.13;
    top.scale.y = 0.5;
    head.add(cap, top);
  }
  if (L.scarf) {
    const scarfMat = cloth(L.scarf, 0.85);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.12, 1.5, -0.05), new THREE.Vector3(0.0, 1.47, 0.12), new THREE.Vector3(0.13, 1.42, 0.08),
      new THREE.Vector3(0.16, 1.2, 0.2), new THREE.Vector3(0.14, 0.95, 0.24),
    ]);
    body.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.045, 8, false), scarfMat));
  }

  // Props go into a hand.
  let held = null;
  const hold = (kind, side = 1) => {
    if (held) held.parent.remove(held);
    held = kind ? makeProp(kind) : null;
    if (held) {
      const arm = arms.find((a) => a.side === side);
      held.position.set(0, -0.06, 0.05);
      arm.hand.add(held);
    }
    return held;
  };
  if (prop) hold(prop);

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
    }
  });

  // ---- Animation state.
  const pose = { walk: 0, lx: 0, lz: 0.1, le: -0.2, rx: 0, rz: -0.1, re: -0.2, yaw: 0, pitch: 0, lean: 0 };
  let phase = 0;
  let actionL = 'down';
  let actionR = 'down';
  let walking = 0;
  let lookTarget = null;
  const tmp = new THREE.Vector3();

  // Arm angles for each action: [shoulder x (forward), shoulder z (out), elbow].
  const ARM = {
    down: [0.05, 0.2, -0.25],
    raise: [-1.75, 0.35, -1.15], // instrument held up at eye level
    sight: [-1.95, 0.2, -0.55], // arm up, sighting along the instrument
    point: [-1.45, 0.15, -0.08],
    write: [-0.75, 0.1, -1.25],
    work: [-0.85, 0.22, -1.05],
    hold: [-0.9, 0.35, -1.0],
    gesture: [-0.65, 0.55, -0.85],
    present: [-1.2, 0.25, -0.5],
  };

  return {
    root,
    hold,
    // walk: 0..1 strength; actions per hand; look: world point or null.
    set({ walk = walking, left = actionL, right = actionR, look = lookTarget } = {}) {
      walking = walk;
      actionL = left;
      actionR = right;
      lookTarget = look;
    },
    // Moves him in the world and turns him to face where he goes.
    place(x, z, yaw) {
      root.position.x = x;
      root.position.z = z;
      if (yaw !== undefined) root.rotation.y = yaw;
    },
    update(t, dt) {
      // Smooth while playing; on a paused frame the pose is set at once.
      const k = dt > 0 ? Math.min(1, dt * 6) : 1;
      pose.walk += (walking - pose.walk) * k;
      phase += dt * 7 * pose.walk;
      const s = Math.sin(phase);
      legs.forEach((leg, i) => {
        const sw = (i ? -s : s) * 0.42 * pose.walk;
        leg.hip.rotation.x = sw;
        leg.knee.rotation.x = Math.max(0, (i ? s : -s)) * 0.55 * pose.walk;
      });
      body.position.y = Math.abs(Math.cos(phase)) * 0.025 * pose.walk;
      robe.rotation.x = Math.sin(phase * 2) * 0.025 * pose.walk;
      // A slow breath when standing still.
      body.scale.y = 1 + Math.sin(t * 1.6) * 0.004;

      const [lx, lz, le] = ARM[actionL] ?? ARM.down;
      const [rx, rz, re] = ARM[actionR] ?? ARM.down;
      const swing = s * 0.35 * pose.walk;
      const wobble = (a) => (a === 'write' || a === 'work' ? Math.sin(t * 7) * 0.08 : a === 'gesture' ? Math.sin(t * 1.5) * 0.15 : 0);
      pose.lx += (lx + (actionL === 'down' ? swing : 0) + wobble(actionL) - pose.lx) * k;
      pose.lz += (lz - pose.lz) * k;
      pose.le += (le - pose.le) * k;
      pose.rx += (rx + (actionR === 'down' ? -swing : 0) + wobble(actionR) - pose.rx) * k;
      pose.rz += (-rz - pose.rz) * k;
      pose.re += (re - pose.re) * k;
      arms[0].shoulder.rotation.set(pose.lx, 0, pose.lz);
      arms[0].elbow.rotation.x = pose.le;
      arms[1].shoulder.rotation.set(pose.rx, 0, pose.rz);
      arms[1].elbow.rotation.x = pose.re;

      // Turn the head toward what he looks at.
      let yaw = 0;
      let pitch = 0;
      if (lookTarget) {
        tmp.copy(lookTarget);
        root.worldToLocal(tmp);
        tmp.y -= 1.62 * root.scale.y;
        yaw = clamp(Math.atan2(tmp.x, tmp.z), -1.1, 1.1);
        pitch = clamp(-Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z)), -0.6, 0.5);
      }
      pose.yaw += (yaw - pose.yaw) * k;
      pose.pitch += (pitch - pose.pitch) * k;
      head.rotation.set(pose.pitch, pose.yaw, 0);
      if (held?.userData.rule) held.userData.rule.rotation.z = 0.5 + Math.sin(t * 0.7) * 0.25;
    },
    dispose() {
      root.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose?.();
      });
    },
  };
}

// Walks a figure along a path of points; u is 0..1 along it.
export function alongPath(points, u) {
  const total = [];
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += points[i].distanceTo(points[i - 1]);
    total.push(len);
  }
  const d = clamp(u) * len;
  let i = total.findIndex((x) => x >= d);
  if (i === -1) i = total.length - 1;
  const start = i ? total[i - 1] : 0;
  const seg = (d - start) / Math.max(1e-6, total[i] - start);
  const a = points[i];
  const b = points[i + 1];
  return {
    position: a.clone().lerp(b, seg),
    yaw: Math.atan2(b.x - a.x, b.z - a.z),
  };
}

export { lerp };
