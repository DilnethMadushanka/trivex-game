// RANABHUMI — ancient weapons battle royale
// Host-authoritative simulation. Online play uses PeerJS (WebRTC data channels):
// the host's browser runs the match, friends send inputs and receive snapshots.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const $ = id => document.getElementById(id);
const damp = THREE.MathUtils.damp, clamp = THREE.MathUtils.clamp;
const TAU = Math.PI * 2;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const r2 = v => Math.round(v * 100) / 100;
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

// ====================== CONFIG ======================
const MAX_PLAYERS = 12;
const ISLAND_R = 92;
const WEAPONS = {
  fist:  { name: 'Fists', dmg: 9, range: 1.8, arc: 1.3, cd: 0.45, wind: 0.14, color: 0xffffff },
  sword: { name: 'Kaduwa · Sword', dmg: 24, range: 2.5, arc: 1.5, cd: 0.6, wind: 0.2, color: 0xbfe0ff },
  machete: { name: 'Kaththa · Machete', dmg: 30, range: 2.2, arc: 1.3, cd: 0.75, wind: 0.26, color: 0xe8c8a0 },
  spear: { name: 'Hella · Spear', dmg: 21, range: 3.5, arc: 0.6, cd: 0.7, wind: 0.24, color: 0xffd27a },
  mace:  { name: 'Gada · Mace', dmg: 37, range: 2.4, arc: 1.6, cd: 1.1, wind: 0.42, color: 0xff9a5a },
  bow:   { name: 'Dunna · Bow', dmg: 27, cd: 0.95, wind: 0.42, ranged: true, color: 0x9ff5cf },
};
const ITEMS = { herb: { name: 'Healing Herb', color: 0x5aff7a }, armor: { name: 'Bronze Armor', color: 0x7ab0ff } };
const LOOT_TABLE = [['sword', 20], ['machete', 14], ['spear', 18], ['mace', 12], ['bow', 15], ['herb', 13], ['armor', 10]];
const SKINS = {
  viru:   { label: 'Viru', skin: 0x8a5634, cloth: 0xe9e1cc, accent: 0xd4a24a, hair: 0x140c08, hero: true, scale: 1.0 },
  hiri:   { label: 'Hiri Yaksha', skin: 0x3c5546, cloth: 0x1c2620, accent: 0x9fffd0, eye: 0x9fffd0, horns: 2, mane: 0x8fa79a, scale: 1.05 },
  gini:   { label: 'Gini Raksha', skin: 0x4a1a10, cloth: 0x1a0a06, accent: 0xff5a1a, eye: 0xffa020, horns: 4, mane: 0x220a04, scale: 1.08 },
  andura: { label: 'Andura Raja', skin: 0x231b2e, cloth: 0x0c0812, accent: 0xb070ff, eye: 0xd8a0ff, horns: 6, mane: 0x0a0610, scale: 1.1, crown: true },
  sena:   { label: 'Sena', skin: 0x6a4026, cloth: 0x8a1c14, accent: 0xd4a24a, hair: 0x0a0604, hero: true, scale: 1.0 },
  mala:   { label: 'Mala', skin: 0x9a6a46, cloth: 0x1a4a6a, accent: 0xe0e0e0, hair: 0x1a0e08, hero: true, scale: 0.97 },
};
const SKIN_KEYS = Object.keys(SKINS);
const BOT_NAMES = ['Dutugemunu', 'Kirisanda', 'Nandimitra', 'Suranimala', 'Mahasena', 'Velusumana', 'Phussadeva', 'Gothaimbara', 'Theraputtabhaya', 'Labhiyavasabha', 'Bharana', 'Khanjadeva', 'Ravana', 'Kuveni', 'Vijaya', 'Ulupi'];

// ====================== RENDERER ======================
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
if (IS_TOUCH) document.body.classList.add('touch');
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.25 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8a46a);
scene.fog = new THREE.Fog(0xe0a070, 40, 190);
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 40, 80);
scene.add(new THREE.HemisphereLight(0xffe0b8, 0x4a3018, 1.1));
const sun = new THREE.DirectionalLight(0xffd8a0, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// sky dome with sunset gradient
{
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: false, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; void main(){ float h = normalize(vP).y;
      vec3 c = mix(vec3(0.95,0.62,0.38), vec3(0.22,0.25,0.5), smoothstep(0.0,0.6,h));
      c = mix(vec3(0.9,0.55,0.35), c, smoothstep(-0.2,0.05,h));
      float s = pow(max(dot(normalize(vP), normalize(vec3(-0.6,0.25,-0.7))),0.),60.);
      gl_FragColor = vec4(c + vec3(1.,0.8,0.5)*s, 1.); }`
  }));
  scene.add(sky);
}

// ====================== WORLD ======================
let SEED = 1;
let rnd = mulberry(1);
let noiseSeed = 0;
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7 + noiseSeed * 17.3) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
function H(x, z) {
  const r = Math.hypot(x, z);
  let h = vnoise(x * 0.025, z * 0.025) * 7 + vnoise(x * 0.07, z * 0.07) * 2 + vnoise(x * 0.012 + 9, z * 0.012) * 10 - 5;
  h *= 0.7;
  const plaza = THREE.MathUtils.smoothstep(r, 6, 16); // flat temple plaza in the center
  h = h * plaza + 1.2 * (1 - plaza);
  const edge = THREE.MathUtils.smoothstep(r, ISLAND_R - 14, ISLAND_R + 6);
  return h * (1 - edge) + (-5) * edge + 1.2 * (1 - edge);
}
let world = null;          // { group, colliders: [{x,z,r}] }
let colliders = [];

function buildWorld(seed) {
  if (world) scene.remove(world.group);
  SEED = seed; rnd = mulberry(seed); noiseSeed = seed % 1000;
  const group = new THREE.Group();
  colliders = [];
  // terrain
  const seg = 180, size = 230;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(0xd8b878), grass = new THREE.Color(0x5f8a3a), dgrass = new THREE.Color(0x3f6a2a), rock = new THREE.Color(0x8a7a6a), plaza = new THREE.Color(0xb89a72);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = H(x, z);
    pos.setY(i, y);
    const r = Math.hypot(x, z);
    if (r < 15) c.copy(plaza).lerp(grass, THREE.MathUtils.smoothstep(r, 11, 15));
    else if (y < 0.9) c.copy(sand);
    else if (y > 6) c.copy(rock);
    else c.copy(grass).lerp(dgrass, vnoise(x * 0.1, z * 0.1));
    c.offsetHSL(0, 0, (hash(x * 3.1, z * 2.7) - 0.5) * 0.05);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  terrain.receiveShadow = true;
  group.add(terrain);
  // sea
  const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 64), new THREE.MeshStandardMaterial({ color: 0x2a6a8a, roughness: 0.25, metalness: 0.3, transparent: true, opacity: 0.88 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = 0.15; group.add(sea);
  world = { group, sea, rocks: null, trees: null, treeLow: null, treeReal: null };

  // trees (instanced)
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 3, 6); trunkGeo.translate(0, 1.5, 0);
  const leafGeo = new THREE.IcosahedronGeometry(1.8, 0); leafGeo.translate(0, 3.8, 0);
  const palmLeaf = new THREE.ConeGeometry(2.2, 1.2, 7); palmLeaf.translate(0, 5.2, 0);
  const N = 260;
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 1 }), N);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0x3f7a2a, roughness: 0.9, flatShading: true }), N);
  trunks.castShadow = leaves.castShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < N * 4 && n < N; i++) {
    const a = rnd() * TAU, rr = 18 + rnd() * (ISLAND_R - 26);
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr, y = H(x, z);
    if (y < 1.2 || vnoise(x * 0.04 + 50, z * 0.04) < 0.42) continue;
    const sc = 0.8 + rnd() * 0.7;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * TAU);
    m.compose(p.set(x, y - 0.2, z), q, s.set(sc, sc * (0.9 + rnd() * 0.4), sc));
    trunks.setMatrixAt(n, m); leaves.setMatrixAt(n, m);
    leaves.setColorAt(n, new THREE.Color().setHSL(0.25 + rnd() * 0.08, 0.45, 0.25 + rnd() * 0.1));
    colliders.push({ x, z, r: 0.45 * sc });
    n++;
  }
  trunks.count = leaves.count = n;
  group.add(trunks, leaves);
  // remember every tree so a loaded model can take over the near ones (see updateTreeLOD)
  const trees = [];
  for (let i = 0; i < n; i++) { const mm = new THREE.Matrix4(); trunks.getMatrixAt(i, mm); const c = new THREE.Color(); leaves.getColorAt(i, c); trees.push({ m: mm, c, x: mm.elements[12], z: mm.elements[14] }); }
  // rocks
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 1, flatShading: true });
  const rocks = [];
  for (let i = 0; i < 70; i++) {
    const a = rnd() * TAU, rr = 16 + rnd() * (ISLAND_R - 20);
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr, y = H(x, z);
    if (y < 0.6) continue;
    const sc = 0.8 + rnd() * 2.2;
    const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(sc, 0), rockMat);
    rk.position.set(x, y + sc * 0.3, z); rk.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); rk.scale.y = 0.7;
    rk.castShadow = rk.receiveShadow = true; group.add(rk);
    rocks.push({ mesh: rk, x, y, z, sc, rot: rnd() * TAU });
    colliders.push({ x, z, r: sc * 0.85 });
  }
  world.trees = trees; world.treeLow = { trunks, leaves };
  world.rocks = rocks;
  applyProps();
  // ruins: broken pillar rings
  const stone = new THREE.MeshStandardMaterial({ color: 0xc8a882, roughness: 0.9 });
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * TAU + rnd(), rr = 35 + rnd() * 35;
    const cx = Math.cos(a) * rr, cz = Math.sin(a) * rr;
    for (let j = 0; j < 8; j++) {
      if (rnd() < 0.25) continue;
      const b = (j / 8) * TAU, x = cx + Math.cos(b) * 6, z = cz + Math.sin(b) * 6;
      const h = 1 + rnd() * 4;
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, h, 10), stone);
      pl.position.set(x, H(x, z) + h / 2 - 0.2, z); pl.castShadow = pl.receiveShadow = true; group.add(pl);
      colliders.push({ x, z, r: 0.6 });
    }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.6, 0.5, 24), stone);
    base.position.set(cx, H(cx, cz) - 0.1, cz); base.receiveShadow = true; group.add(base);
  }
  // central stupa (landmark)
  const white = new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.7 });
  const st = new THREE.Group();
  [[7, 0.8], [6.2, 0.8], [5.5, 0.8]].reduce((y, [r, h]) => { const mm = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), white); mm.position.y = y + h / 2; mm.receiveShadow = mm.castShadow = true; st.add(mm); return y + h; }, 1.1);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 16, 0, TAU, 0, Math.PI / 2), white); dome.position.y = 3.5; dome.castShadow = true; st.add(dome);
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.8), white); box.position.y = 9.1; st.add(box);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.9, 6, 16), new THREE.MeshStandardMaterial({ color: 0xd4a24a, metalness: 0.8, roughness: 0.3 })); spire.position.y = 12.8; st.add(spire);
  group.add(st);
  colliders.push({ x: 0, z: 0, r: 7.2 });
  scene.add(group);
}

// zone wall
const zoneMat = new THREE.ShaderMaterial({
  transparent: true, side: THREE.DoubleSide, depthWrite: false,
  uniforms: { uT: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform float uT; varying vec2 vUv;
    void main(){ float b = 0.5+0.5*sin(vUv.x*400.0 + uT*3.0 + vUv.y*20.0);
      float a = (0.12 + 0.18*b) * (1.0 - vUv.y*0.9);
      gl_FragColor = vec4(mix(vec3(0.55,0.2,1.0), vec3(1.0,0.4,0.9), b), a); }`
});
const zoneWall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 80, 96, 1, true), zoneMat);
zoneWall.position.y = 20;
scene.add(zoneWall);

function collide(o) {
  for (const c of colliders) {
    const dx = o.x - c.x, dz = o.z - c.z, rr = c.r + 0.4, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); o.x = c.x + dx / d * rr; o.z = c.z + dz / d * rr; }
  }
  const r = Math.hypot(o.x, o.z);
  if (r > ISLAND_R - 4) { o.x *= (ISLAND_R - 4) / r; o.z *= (ISLAND_R - 4) / r; }
}

// ====================== CHARACTER RIG ======================
function buildBody(def) {
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
  const skin = std(def.skin, { roughness: 0.55 });
  const cloth = std(def.cloth, { roughness: 0.85, side: THREE.DoubleSide });
  const gold = std(def.hero ? def.accent : 0x6a5a4a, { metalness: def.hero ? 0.9 : 0.3, roughness: 0.3, emissive: def.hero ? 0 : def.accent, emissiveIntensity: def.hero ? 0 : 0.6 });
  const hairM = std(def.hair || def.mane || 0x111111, { roughness: 0.9 });
  const mesh = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const rig = new THREE.Group(), body = new THREE.Group(); rig.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.97; body.add(hips);
  mesh(new THREE.SphereGeometry(0.17, 14, 10), skin, 0, 0, 0, hips).scale.set(1.25, 0.8, 0.9);
  mesh(new THREE.CylinderGeometry(0.21, def.hero ? 0.3 : 0.25, def.hero ? 0.5 : 0.32, 12, 1, true), cloth, 0, def.hero ? -0.2 : -0.12, 0, hips);
  mesh(new THREE.TorusGeometry(0.21, 0.03, 6, 20), gold, 0, 0.04, 0, hips).rotation.x = Math.PI / 2;
  const spine = new THREE.Group(); spine.position.y = 0.05; hips.add(spine);
  mesh(new THREE.CapsuleGeometry(0.16, 0.3, 4, 12), skin, 0, 0.27, 0, spine).scale.set(1.4, 1, 0.85);
  mesh(new THREE.SphereGeometry(0.2, 14, 10), skin, 0, 0.47, 0.03, spine).scale.set(1.45, 0.85, 0.9);
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.1, 10, 8), skin, s * 0.1, 0.47, 0.13, spine).scale.set(1.1, 0.8, 0.5);
  mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), skin, 0, 0.66, 0, spine);
  const armor = mesh(new THREE.CylinderGeometry(0.27, 0.24, 0.42, 14, 1, true), std(0x9a7a4a, { metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide }), 0, 0.37, 0.01, spine);
  armor.scale.set(1.05, 1, 0.8); armor.visible = false;
  const head = new THREE.Group(); head.position.y = 0.7; spine.add(head);
  mesh(new THREE.SphereGeometry(0.135, 16, 12), skin, 0, 0.12, 0, head).scale.set(0.92, 1.1, 1);
  const jaw = mesh(new THREE.BoxGeometry(0.17, 0.08, 0.14), skin, 0, 0.03, 0.05, head);
  if (def.hero) {
    mesh(new THREE.SphereGeometry(0.14, 14, 10), hairM, 0, 0.17, -0.02, head).scale.set(0.95, 0.9, 1);
    mesh(new THREE.SphereGeometry(0.07, 10, 8), hairM, 0, 0.26, -0.12, head);
    mesh(new THREE.SphereGeometry(0.1, 10, 8), hairM, 0, 0.0, 0.07, head).scale.set(1, 1.1, 0.8);
    mesh(new THREE.TorusGeometry(0.14, 0.014, 6, 20), std(def.accent === 0xd4a24a ? 0xc8321c : def.accent), 0, 0.2, 0, head).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.018, 6, 6), new THREE.MeshBasicMaterial({ color: 0x110805 }), s * 0.045, 0.13, 0.125, head);
  } else {
    const eyeM = new THREE.MeshBasicMaterial({ color: def.eye });
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.028, 8, 6), eyeM, s * 0.05, 0.14, 0.115, head).scale.set(1.3, 0.7, 0.5);
    for (const s of [-1, 1]) mesh(new THREE.ConeGeometry(0.018, 0.07, 5), std(0xf0e6d0), s * 0.05, 0, 0.12, head).rotation.x = Math.PI;
    jaw.scale.set(1.15, 1.3, 1.1);
    for (let i = 0; i < def.horns; i++) {
      const s = i % 2 ? 1 : -1, k = Math.floor(i / 2);
      mesh(new THREE.ConeGeometry(0.035 - k * 0.006, 0.22 - k * 0.04, 6), std(0xd8cbb0), s * (0.08 + k * 0.03), 0.25 - k * 0.02, -0.02 - k * 0.05, head).rotation.set(-0.3 - k * 0.2, 0, -s * (0.5 + k * 0.3));
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 1.4 - Math.PI * 0.2;
      mesh(new THREE.ConeGeometry(0.04, 0.3, 4), hairM, Math.cos(a) * 0.13, 0.12 + Math.sin(a) * 0.12, -0.08, head).rotation.set(-1.2, 0, a - Math.PI / 2);
    }
    if (def.crown) for (let i = 0; i < 5; i++) mesh(new THREE.ConeGeometry(0.025, 0.14, 4), std(0xd4a24a, { metalness: 1, roughness: 0.3 }), (i - 2) * 0.05, 0.3, 0.05, head).rotation.z = (i - 2) * -0.2;
  }
  const sh = [], el = [], hp = [], kn = [], handG = [];
  for (const s of [1, -1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(s * 0.29, 0.56, 0); spine.add(shoulder);
    mesh(new THREE.SphereGeometry(0.095, 10, 8), skin, 0, 0, 0, shoulder);
    mesh(new THREE.CapsuleGeometry(0.068, 0.2, 4, 8), skin, 0, -0.16, 0, shoulder);
    mesh(new THREE.TorusGeometry(0.075, 0.015, 5, 14), gold, 0, -0.08, 0, shoulder).rotation.x = Math.PI / 2;
    const elbow = new THREE.Group(); elbow.position.y = -0.32; shoulder.add(elbow);
    mesh(new THREE.CapsuleGeometry(0.056, 0.2, 4, 8), skin, 0, -0.14, 0, elbow);
    mesh(new THREE.TorusGeometry(0.062, 0.018, 5, 14), gold, 0, -0.24, 0, elbow).rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.068, 10, 8), skin, 0, -0.31, 0.01, elbow).scale.set(0.8, 1.1, 1);
    const hg = new THREE.Group(); hg.position.set(0, -0.32, 0.02); elbow.add(hg);
    sh.push(shoulder); el.push(elbow); handG.push(hg);
    const hip = new THREE.Group(); hip.position.set(s * 0.11, -0.03, 0); hips.add(hip);
    mesh(new THREE.CapsuleGeometry(0.088, 0.3, 4, 8), skin, 0, -0.22, 0, hip);
    const knee = new THREE.Group(); knee.position.y = -0.46; hip.add(knee);
    mesh(new THREE.CapsuleGeometry(0.066, 0.32, 4, 8), skin, 0, -0.22, 0, knee);
    mesh(new THREE.BoxGeometry(0.1, 0.06, 0.24), skin, 0, -0.47, 0.06, knee);
    hp.push(hip); kn.push(knee);
  }
  rig.scale.setScalar(def.scale);
  return { rig, body, hips, spine, head, sh, el, hp, kn, handG, armor };
}

// realistic weapon models (Poly Haven): [prop key, grip position along the length, scale]
const WEAPON_MODELS = { sword: ['saber', 0.07, 1.25], machete: ['machete', 0.13, 1.3], armor: ['shield', 0.5, 0.45] };
function modelWeapon(type) {
  const wm = WEAPON_MODELS[type], src = wm && PROPS[wm[0]];
  if (!src) return null;
  const g = new THREE.Group(), m = src.scene.clone(), b = src.box, k = wm[2], L = b.max.y - b.min.y;
  m.scale.setScalar(k);
  m.position.set(-(b.min.x + b.max.x) / 2 * k, -(b.min.y + wm[1] * L) * k, -(b.min.z + b.max.z) / 2 * k);
  m.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.add(m);
  if (type !== 'armor') g.rotation.x = 1.15;
  return g;
}
function weaponMesh(type) {
  const real = modelWeapon(type);
  if (real) return real;
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8dde8, metalness: 0.95, roughness: 0.2 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4424, roughness: 0.8 });
  const goldM = new THREE.MeshStandardMaterial({ color: 0xd4a24a, metalness: 0.9, roughness: 0.3 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  if (type === 'sword' || type === 'machete') {
    add(new THREE.BoxGeometry(0.07, 0.9, 0.018), metal, 0, 0.6, 0);
    add(new THREE.ConeGeometry(0.05, 0.16, 4), metal, 0, 1.12, 0).scale.z = 0.3;
    add(new THREE.BoxGeometry(0.26, 0.04, 0.06), goldM, 0, 0.14, 0);
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6), wood, 0, 0.03, 0);
    add(new THREE.SphereGeometry(0.04, 8, 6), goldM, 0, -0.08, 0);
    g.rotation.x = 1.15;
  } else if (type === 'spear') {
    add(new THREE.CylinderGeometry(0.025, 0.03, 2.6, 6), wood, 0, 0.45, 0);
    add(new THREE.ConeGeometry(0.06, 0.32, 4), metal, 0, 1.9, 0);
    add(new THREE.TorusGeometry(0.035, 0.012, 5, 10), goldM, 0, 1.72, 0).rotation.x = Math.PI / 2;
    g.rotation.x = Math.PI / 2 + 0.05; g.position.z = 0;
  } else if (type === 'mace') {
    add(new THREE.CylinderGeometry(0.03, 0.035, 0.85, 6), wood, 0, 0.35, 0);
    add(new THREE.IcosahedronGeometry(0.17, 0), metal, 0, 0.82, 0);
    for (let i = 0; i < 6; i++) { const sp = add(new THREE.ConeGeometry(0.035, 0.12, 4), goldM, 0, 0.82, 0); sp.rotation.set(i < 3 ? 0 : Math.PI / 2, (i % 3) * 2.1, i < 3 ? Math.PI / 2 : 0); sp.translateY(0.18); }
    g.rotation.x = 1.15;
  } else if (type === 'bow') {
    add(new THREE.TorusGeometry(0.6, 0.022, 5, 24, Math.PI * 0.8), wood, 0, 0, 0).rotation.z = Math.PI / 2 + Math.PI * 0.1;
    const str = add(new THREE.CylinderGeometry(0.004, 0.004, 1.14, 3), new THREE.MeshBasicMaterial({ color: 0xeeeeee }), -0.35, 0, 0);
    g.children[0].position.x = -0.6 + 0.0; g.children[0].position.x = 0; str.position.x = -0.18;
    g.rotation.set(0, Math.PI / 2, Math.PI / 2);
  } else if (type === 'herb') {
    for (let i = 0; i < 5; i++) { const l = add(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: 0x4adf5a, emissive: 0x1a6a2a }), Math.cos(i * 1.26) * 0.12, 0.1, Math.sin(i * 1.26) * 0.12); l.scale.set(0.5, 1.2, 0.3); l.rotation.z = Math.cos(i * 1.26) * 0.6; }
  } else if (type === 'armor') {
    add(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0x9a7a4a, metalness: 0.85, roughness: 0.3 }), 0, 0, 0).rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(0.1, 10, 8), goldM, 0, 0, 0.05);
  }
  return g;
}

// ---- poses ----
const BASE = { hipY: 0, lean: 0.06, twist: 0, head: 0, fall: 0, lSx: -0.15, lSz: 0.18, lE: -0.4, rSx: -0.5, rSz: 0.15, rE: -0.9, lH: 0, lK: 0.1, rH: 0, rK: 0.1, spread: 0.05 };
const P = o => Object.assign({}, BASE, o);
const POSE = {
  idle: P({}),
  idleBow: P({ lSx: -0.6, lE: -0.3, rSx: -0.3, rE: -0.6 }),
  air: P({ lH: -0.9, lK: 1.2, rH: -0.3, rK: 0.8, lSx: -0.8, rSx: -0.8, lSz: 0.6, rSz: 0.6 }),
  dead: P({ fall: 1.5, hipY: -0.75, lSx: -2.6, lSz: 0.6, lE: -0.3, rSx: -2.7, rSz: 0.5, rE: -0.3, lH: -0.3, lK: 0.6, rK: 0.2, head: 0.3 }),
  hit: P({ lean: -0.35, head: -0.4, lSz: 0.6, rSz: 0.6, lE: -0.6, rE: -0.6 }),
  block: P({ rSx: -1.5, rSz: -0.35, rE: -1.5, lSx: -1.5, lSz: 0.35, lE: -1.5, lean: 0.12, hipY: -0.1, lK: 0.35, rK: 0.35, head: 0.1 }),
  // attacks: [windup, strike]
  fistW: P({ rSx: -0.9, rE: -2.2, twist: -0.3 }), fistS: P({ rSx: -1.6, rE: -0.05, twist: 0.4, lean: 0.2 }),
  swordW: P({ rSx: -2.7, rSz: 0.7, rE: -0.7, twist: -0.6, lean: -0.05 }), swordS: P({ rSx: -0.9, rSz: -0.5, rE: -0.15, twist: 0.7, lean: 0.35, lH: -0.4, lK: 0.5 }),
  macheteW: P({ rSx: -2.7, rSz: 0.7, rE: -0.7, twist: -0.6, lean: -0.05 }), macheteS: P({ rSx: -0.9, rSz: -0.5, rE: -0.15, twist: 0.7, lean: 0.35, lH: -0.4, lK: 0.5 }),
  spearW: P({ rSx: -0.9, rE: -1.9, rSz: 0.3, twist: -0.6, lSx: -1.2, lE: -0.6 }), spearS: P({ rSx: -1.57, rE: -0.02, rSz: 0, twist: 0.5, lean: 0.35, lSx: -1.3, lE: -0.3, lH: -0.6, lK: 0.6 }),
  maceW: P({ rSx: -3.0, rSz: 0.2, rE: -1.2, lSx: -2.4, lE: -1.0, lean: -0.25, twist: -0.3 }), maceS: P({ rSx: -0.7, rSz: 0, rE: -0.1, lSx: -0.9, lE: -0.4, lean: 0.55, twist: 0.2, hipY: -0.12, lH: -0.6, lK: 0.8 }),
  bowW: P({ lSx: -1.57, lSz: 0.1, lE: 0, rSx: -1.5, rSz: -0.3, rE: -2.6, twist: -0.4 }), bowS: P({ lSx: -1.57, lSz: 0.1, lE: 0, rSx: -1.1, rSz: 0.4, rE: -1.4, twist: -0.4 }),
};
const POSE_KEYS = Object.keys(BASE);

// ====================== IMPORTED 3D MODELS (optional) ======================
// Put rigged GLB files in /models and list them in models/models.json:
// { "characters": { "viru": "models/viru.glb", "hiri": "models/yaksha.glb" },
//   "animations": ["models/animations.glb"] }
// Clips are matched by name (idle, run, slash, punch, kick, arrow/bow, hit, dying, jump),
// so Mixamo animations can be shared by every Mixamo-rigged character.
const MODEL_CACHE = {};
const CLIP_KEYS = {
  idle: ['idle'], run: ['run', 'sprint'], walk: ['walk'], slash: ['slash', 'sword', 'swing', 'attack'], punch: ['punch', 'jab', 'cross'],
  kick: ['kick'], block: ['block'], bow: ['arrow', 'bow', 'draw', 'shoot'], hit: ['hit', 'react', 'impact'], die: ['dying', 'death', 'die'], jump: ['jump'],
};
function mapClips(clips) {
  const map = {};
  for (const [k, words] of Object.entries(CLIP_KEYS)) {
    const c = clips.find(c => words.some(w => c.name.toLowerCase().includes(w)));
    if (c) map[k] = c;
  }
  map.run = map.run || map.walk; map.idle = map.idle || clips[0];
  map.punch = map.punch || map.slash; map.slash = map.slash || map.punch; map.kick = map.kick || map.punch;
  map.bow = map.bow || map.punch; map.block = map.block || map.idle;
  return map;
}
function stripRootMotion(clip) {
  // keep animations "in place": drop horizontal movement of the hips/root
  for (const t of clip.tracks) {
    if (t.name.endsWith('.position') && /hips|root|armature/i.test(t.name)) {
      const v = t.values; for (let i = 0; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; }
    }
  }
  return clip;
}
// Realistic map props (models.json "props": { "rock": "models/props/boulder.glb" }).
// The procedural world still decides where things go and their colliders; a loaded model
// only replaces how they look, so every player sees the same island.
const PROPS = {};
function propSource(g) {
  // one mesh, centred on x/z, base at y=0, scaled so its widest side is 1 unit
  let mesh = null; g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  if (!mesh) return null;
  mesh.updateWorldMatrix(true, false);
  const geo = mesh.geometry.clone(); geo.applyMatrix4(mesh.matrixWorld); geo.computeBoundingBox();
  const b = geo.boundingBox, w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) || 1;
  geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); geo.scale(1 / w, 1 / w, 1 / w);
  return { geo, mat: mesh.material };
}
function multiSource(g) {
  // every mesh of a model, sharing one transform: trunk centred on x/z, base at y=0, height 1
  const parts = []; let trunk = null;
  g.scene.updateMatrixWorld(true);
  g.scene.traverse(o => { if (!o.isMesh) return; const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); geo.computeBoundingBox(); parts.push({ geo, mat: o.material }); if (!trunk && !o.material.transparent && !/leaf|leaves/i.test(o.material.name)) trunk = geo; });
  if (!parts.length) return null;
  const all = new THREE.Box3(); parts.forEach(p => all.union(p.geo.boundingBox));
  const tb = (trunk || parts[0].geo).boundingBox, h = (all.max.y - all.min.y) || 1;
  for (const p of parts) {
    p.geo.translate(-(tb.min.x + tb.max.x) / 2, -all.min.y, -(tb.min.z + tb.max.z) / 2); p.geo.scale(1 / h, 1 / h, 1 / h);
    // leaves: cut-out instead of blending, so thousands of them sort correctly and cast shadows
    if (p.mat.transparent || /leaf|leaves/i.test(p.mat.name)) { p.mat.transparent = false; p.mat.alphaTest = 0.5; p.mat.side = THREE.DoubleSide; }
    // bark and leaves are not metal; a stray metalness map makes them reflect the dark sky
    p.mat.metalness = 0; p.mat.metalnessMap = null; p.mat.needsUpdate = true;
  }
  return parts;
}
// Trees near the camera use the real model; far ones keep the cheap low-poly shape (hidden by fog anyway).
const TREE_NEAR = IS_TOUCH ? 32 : 48, TREE_MAX = window.__treeMax || (IS_TOUCH ? 24 : 60), TREE_H = 5.4;
let treeLodT = 0;
function updateTreeLOD(cx, cz, force) {
  if (!world || !world.trees || !PROPS.tree) return;
  if (!world.treeReal) {
    world.treeReal = PROPS.tree.map(p => { const im = new THREE.InstancedMesh(p.geo, p.mat, world.trees.length); im.castShadow = im.receiveShadow = true; im.frustumCulled = false; im.count = 0; world.group.add(im); return im; });
    force = true;
  }
  treeLodT -= 1; if (treeLodT > 0 && !force) return; treeLodT = 15;
  const { trunks, leaves } = world.treeLow, real = world.treeReal;
  const m = new THREE.Matrix4(), sm = new THREE.Matrix4().makeScale(TREE_H, TREE_H, TREE_H);
  let nl = 0, nr = 0;
  for (const t of world.trees) t.d = Math.hypot(t.x - cx, t.z - cz);
  const near = new Set(world.trees.filter(t => t.d < TREE_NEAR).sort((a, b) => a.d - b.d).slice(0, TREE_MAX));
  for (const t of world.trees) {
    if (near.has(t)) { m.multiplyMatrices(t.m, sm); for (const im of real) im.setMatrixAt(nr, m); nr++; }
    else { trunks.setMatrixAt(nl, t.m); leaves.setMatrixAt(nl, t.m); leaves.setColorAt(nl, t.c); nl++; }
  }
  trunks.count = leaves.count = nl; for (const im of real) im.count = nr;
  trunks.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = true; if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  for (const im of real) im.instanceMatrix.needsUpdate = true;
}
function applyProps() {
  updateTreeLOD(camera.position.x, camera.position.z, true);
  if (!world || !world.rocks || !PROPS.rock || world.rockInst) return;
  const { geo, mat } = PROPS.rock, list = world.rocks;
  const inst = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3();
  list.forEach((r, i) => {
    r.mesh.visible = false;
    const w = r.sc * 2.3;
    m.compose(v.set(r.x, r.y - r.sc * 0.25, r.z), q.setFromAxisAngle(up, r.rot), s.set(w, w * 1.1, w));
    inst.setMatrixAt(i, m);
  });
  inst.castShadow = inst.receiveShadow = true;
  world.group.add(inst); world.rockInst = inst;
}
async function loadModels() {
  let manifest;
  try { const r = await fetch('models/models.json', { cache: 'no-cache' }); if (!r.ok) return; manifest = await r.json(); } catch (e) { return; }
  const loader = new GLTFLoader();
  // start the character downloads straight away, alongside the animations
  const files = {};
  for (const url of Object.values(manifest.characters || {})) files[url] = files[url] || loader.loadAsync(url);
  const sharedClips = [];
  // all animation files download at the same time
  await Promise.all((manifest.animations || []).map(async url => {
    // Mixamo names every clip "mixamo.com", so fall back to the file name (models/anim/run.glb -> run)
    try { const g = await loader.loadAsync(url); g.animations.forEach(c => { if (!c.name || c.name === 'mixamo.com') c.name = url.split('/').pop().replace(/\.glb$/i, ''); sharedClips.push(stripRootMotion(c)); }); } catch (e) { console.warn('animation load failed', url, e); }
  }));
  sharedClips.sort((a, b) => a.name.localeCompare(b.name));
  for (const [key, url] of Object.entries(manifest.characters || {})) {
    try {
      const g = await files[url];
      g.animations.forEach(c => { if (!c.name || c.name === 'mixamo.com') c.name = 'idle'; });
      g.scene.updateMatrixWorld(true);
      g.scene.traverse(o => { if (o.isSkinnedMesh) { o.skeleton.pose(); o.computeBoundingBox(); } });
      g.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g.scene, true);
      console.info('model', key, 'height', (box.max.y - box.min.y).toFixed(3));
      const height = box.max.y - box.min.y || 1;
      const clips = [...g.animations.map(stripRootMotion), ...sharedClips];
      MODEL_CACHE[key] = { scene: g.scene, scale: 1.8 / height, minY: box.min.y, map: mapClips(clips), tint: (manifest.tints || {})[key] };
    } catch (e) { console.warn('model load failed', url, e); }
  }
  if (Object.keys(MODEL_CACHE).length) previewSkin();
  // map props and weapons after the characters, all at once. Phones skip the heavy realistic trees.
  await Promise.all(Object.entries(manifest.props || {}).filter(([key]) => !(key === 'tree' && IS_TOUCH)).map(async ([key, url]) => {
    try {
      const g = await loader.loadAsync(url);
      const src = key === 'tree' ? multiSource(g) : key === 'rock' ? propSource(g) : { scene: g.scene, box: new THREE.Box3().setFromObject(g.scene) };
      if (src) PROPS[key] = src;
    } catch (e) { console.warn('prop load failed', url, e); }
  }));
  applyProps();
}
class SkinnedModel {
  constructor(key) {
    const src = MODEL_CACHE[key];
    this.root = new THREE.Group();
    const m = SkeletonUtils.clone(src.scene);
    m.scale.setScalar(src.scale); m.position.y = -src.minY * src.scale;
    const tint = src.tint ? new THREE.Color(src.tint) : null;
    m.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.frustumCulled = false;
      if (tint) { o.material = o.material.clone(); o.material.color.lerp(tint, 0.5); }
    });
    this.root.add(m);
    this.mixer = new THREE.AnimationMixer(m);
    this.actions = {};
    for (const [k, clip] of Object.entries(src.map)) if (clip) this.actions[k] = this.mixer.clipAction(clip);
    this.curName = null;
    m.traverse(o => { if (o.isBone && /right.?hand$/i.test(o.name)) this.rHand = o; if (o.isBone && /left.?hand$/i.test(o.name)) this.lHand = o; });
  }
  play(name, { once = false, restart = false, speed = 1, fade = 0.15 } = {}) {
    const a = this.actions[name] || this.actions.idle;
    if (!a) return;
    a.timeScale = speed;
    if (this.curName === name && !restart) return;
    const prev = this.actions[this.curName];
    a.reset();
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = once;
    a.enabled = true;
    if (prev && prev !== a) a.crossFadeFrom(prev, fade, false); else a.fadeIn(fade);
    a.play();
    this.curName = name;
  }
  duration(name) { const a = this.actions[name] || this.actions.idle; return a ? a.getClip().duration : 1; }
}
const ATTACK_CLIP = { fist: 'punch', sword: 'slash', machete: 'slash', spear: 'slash', mace: 'slash', bow: 'bow' };

// ====================== PLAYER VIEW ======================
class View {
  constructor(p) {
    this.def = SKINS[p.skin] || SKINS.viru;
    this.parts = buildBody(this.def);
    scene.add(this.parts.rig);
    if (MODEL_CACHE[p.skin]) {
      this.model = new SkinnedModel(p.skin);
      this.parts.body.visible = false;
      this.parts.rig.add(this.model.root);
      this.holder = new THREE.Group(); scene.add(this.holder);
      this.shieldHolder = new THREE.Group(); scene.add(this.shieldHolder);
    }
    this.cur = { ...POSE.idle };
    this.weapon = null; this.weaponType = null;
    this.walk = 0; this.phase = 0; this.atkT = 9; this.atkSeen = p.atk || 0; this.hitT = 0;
    this.x = p.x; this.y = p.y; this.z = p.z; this.yaw = p.yaw;
    // name tag
    this.tagCanvas = document.createElement('canvas'); this.tagCanvas.width = 256; this.tagCanvas.height = 72;
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(this.tagCanvas), depthTest: true, transparent: true }));
    this.tag.scale.set(1.6, 0.45, 1);
    this.tagName = p.name.slice(0, 16); this.tagHp = -1; this.tagAr = -1; this.drawTag(p);
    scene.add(this.tag);
  }
  drawTag(p) {
    const hp = Math.max(0, Math.ceil(p.hp)), ar = Math.max(0, Math.ceil(p.ar || 0));
    if (hp === this.tagHp && ar === this.tagAr) return;
    this.tagHp = hp; this.tagAr = ar;
    const g = this.tagCanvas.getContext('2d'); g.clearRect(0, 0, 256, 72);
    g.font = '700 24px Inter, sans-serif'; g.textAlign = 'center';
    g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(this.tagName, 128, 26); g.fillStyle = '#f3e6c8'; g.fillText(this.tagName, 128, 26);
    // health bar: dark frame, colour from green to red, armor as a thin blue strip on top
    const x = 38, w = 180, y = 38;
    g.fillStyle = 'rgba(10,6,4,0.8)'; g.fillRect(x - 3, y - 3, w + 6, 22);
    const f = hp / 100; g.fillStyle = f > 0.6 ? '#5ad86a' : f > 0.3 ? '#f0c040' : '#ff4a2a'; g.fillRect(x, y + 5, w * f, 11);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y + 5, w * f, 3);
    if (ar > 0) { g.fillStyle = '#7ab8ff'; g.fillRect(x, y, w * Math.min(1, ar / 100), 4); }
    this.tag.material.map.needsUpdate = true;
  }
  dispose() { scene.remove(this.parts.rig); scene.remove(this.tag); if (this.holder) scene.remove(this.holder); if (this.shieldHolder) scene.remove(this.shieldHolder); }
  setWeapon(type) {
    if (type === this.weaponType) return;
    this.weaponType = type;
    if (this.weapon) this.weapon.parent.remove(this.weapon);
    this.weapon = null;
    if (type && type !== 'fist') {
      this.weapon = weaponMesh(type);
      if (this.model) this.holder.add(this.weapon);
      else this.parts.handG[type === 'bow' ? 0 : 1].add(this.weapon);
    }
  }
  update(p, dt, isLocal) {
    // smooth toward network state (local player already predicted)
    const k = isLocal ? 30 : 14;
    this.x = damp(this.x, p.x, k, dt); this.y = damp(this.y, p.y, k, dt); this.z = damp(this.z, p.z, k, dt);
    if (Math.hypot(this.x - p.x, this.z - p.z) > 6) { this.x = p.x; this.y = p.y; this.z = p.z; }
    this.yaw += angDiff(p.yaw, this.yaw) * Math.min(1, dt * 18);
    this.setWeapon(p.w);
    this.parts.armor.visible = p.ar > 0;
    if (p.atk !== this.atkSeen) { this.atkSeen = p.atk; this.atkT = 0; sfx('whoosh', this.x, this.z); }
    if ((p.rolls || 0) !== (this.rollSeen ?? (p.rolls || 0))) { this.rollV = 0; sfx('whoosh', this.x, this.z); }
    this.rollSeen = p.rolls || 0;
    this.rollV = (this.rollV ?? 9) + dt;
    if (p.hp < (this.lastHp ?? p.hp)) this.hitT = 0.25;
    this.lastHp = p.hp;
    this.atkT += dt; this.hitT -= dt;
    const W = WEAPONS[p.w] || WEAPONS.fist;
    let target = p.w === 'bow' ? POSE.idleBow : POSE.idle;
    let rate = 12;
    if (!p.alive) { target = POSE.dead; rate = 6; }
    else if (this.atkT < W.cd * 0.85) {
      const kk = p.w || 'fist';
      target = this.atkT < W.wind ? POSE[kk + 'W'] : POSE[kk + 'S']; rate = this.atkT < W.wind ? 14 : 30;
    } else if (this.hitT > 0) { target = POSE.hit; rate = 25; }
    else if (p.blk) { target = POSE.block; rate = 18; }
    else if (p.mv === 2) target = POSE.air;
    for (const key of POSE_KEYS) this.cur[key] = damp(this.cur[key], target[key], rate, dt);
    const moving = p.alive && p.mv === 1;
    this.walk = damp(this.walk, moving ? 1 : 0, 10, dt);
    this.phase += dt * (p.sp ? 13 : 10);
    if (this.model) this.animateModel(p, W, dt); else this.apply();
    const pr = this.parts.rig;
    pr.position.set(this.x, this.y, this.z);
    pr.rotation.order = 'YXZ'; pr.rotation.y = this.yaw; pr.rotation.x = 0;
    if (this.rollV < ROLL.time && p.alive) {
      // forward somersault around the hips
      const k = this.rollV / ROLL.time, a = k * TAU, hip = 0.8 * this.def.scale;
      pr.rotation.x = a;
      pr.position.y += hip - hip * Math.cos(a) - Math.sin(k * Math.PI) * 0.15;
      pr.position.x -= Math.sin(this.yaw) * hip * Math.sin(a); pr.position.z -= Math.cos(this.yaw) * hip * Math.sin(a);
    }
    if (this.model) this.attachWeapon(p);
    this.tag.position.set(this.x, this.y + 2.35 * this.def.scale, this.z);
    this.tag.visible = p.alive && !isLocal;
    if (this.tag.visible) this.drawTag(p);
  }
  animateModel(p, W, dt) {
    const m = this.model;
    if (!p.alive) m.play('die', { once: true, fade: 0.2 });
    else if (this.atkT < W.cd * 0.9) {
      const clip = ATTACK_CLIP[p.w || 'fist'];
      const restart = this.atkT === 0 || this._atkFor !== this.atkSeen;
      this._atkFor = this.atkSeen;
      m.play(clip, { once: true, restart, speed: m.duration(clip) / (W.cd * 0.9), fade: 0.08 });
    } else if (this.rollV < ROLL.time) m.play('jump', { fade: 0.05, speed: 1.6 });
    else if (p.blk) m.play('block', { fade: 0.1 });
    else if (this.hitT > 0.1) m.play('hit', { once: true, fade: 0.08 });
    else if (p.mv === 2) m.play('jump', { fade: 0.2 });
    else if (p.mv === 1) m.play('run', { speed: p.sp ? 1.25 : 0.95 });
    else m.play('idle', { fade: 0.25 });
    m.mixer.update(dt);
  }
  attachWeapon(p) {
    this.parts.rig.updateMatrixWorld(true);
    // armor shows as a kite shield on the left forearm
    const lh = this.model.lHand, wantShield = p.ar > 0 && p.alive && p.w !== 'bow' && lh && PROPS.shield;
    if (wantShield && !this.shield) { this.shield = modelWeapon('armor'); this.shieldHolder.add(this.shield); }
    if (this.shield) this.shield.visible = !!wantShield;
    if (wantShield) {
      lh.getWorldPosition(this.shieldHolder.position); lh.getWorldQuaternion(this.shieldHolder.quaternion);
      this.shieldHolder.scale.setScalar(this.def.scale);
      this.shield.position.set(0.04, -0.12, 0); this.shield.rotation.set(0, Math.PI / 2, 0);
    }
    const bone = p.w === 'bow' ? this.model.lHand : this.model.rHand;
    if (!bone || !this.weapon) return;
    bone.getWorldPosition(this.holder.position);
    bone.getWorldQuaternion(this.holder.quaternion);
    this.holder.scale.setScalar(this.def.scale);
    // Mixamo hands: +Y runs along the fingers. Turn the weapon so its grip sits in the fist.
    this.weapon.position.set(0, 0.08, 0.02);
    this.weapon.rotation.set(p.w === 'bow' ? 0 : -Math.PI / 2, 0, p.w === 'spear' ? 0 : 0);
    if (p.w === 'bow') this.weapon.rotation.set(0, 0, Math.PI / 2);
  }
  apply() {
    const c = this.cur, p = this.parts, w = this.walk, ph = this.phase;
    const t = performance.now() / 1000;
    const br = Math.sin(t * 2.4) * 0.012;
    p.body.rotation.x = -c.fall;
    p.hips.position.y = 0.97 + c.hipY + br + Math.abs(Math.sin(ph)) * 0.06 * w;
    p.spine.rotation.x = c.lean + br + w * 0.12;
    p.spine.rotation.y = c.twist;
    p.head.rotation.x = c.head;
    p.sh[0].rotation.set(c.lSx + Math.sin(ph) * 0.6 * w, 0, c.lSz);
    p.el[0].rotation.x = c.lE - w * 0.5;
    p.sh[1].rotation.set(c.rSx - Math.sin(ph) * 0.4 * w, 0, -c.rSz);
    p.el[1].rotation.x = c.rE;
    p.hp[0].rotation.set(c.lH + Math.sin(ph) * 0.8 * w, 0, c.spread);
    p.kn[0].rotation.x = c.lK + Math.max(0, -Math.cos(ph)) * 1.1 * w;
    p.hp[1].rotation.set(c.rH - Math.sin(ph) * 0.8 * w, 0, -c.spread);
    p.kn[1].rotation.x = c.rK + Math.max(0, Math.cos(ph)) * 1.1 * w;
  }
}

// ====================== LOOT VIEWS ======================
const lootViews = new Map();
function syncLootViews(list) {
  const seen = new Set();
  for (const l of list) {
    seen.add(l.id);
    if (!lootViews.has(l.id)) {
      const g = new THREE.Group();
      const m = weaponMesh(l.type); m.rotation.set(0, 0, l.type === 'spear' ? Math.PI / 2.4 : 0.3);
      if (l.type === 'spear') m.scale.setScalar(0.7);
      g.add(m);
      const col = (WEAPONS[l.type] || ITEMS[l.type]).color;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = -0.95;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.12, 2.4, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, depthWrite: false }));
      beam.position.y = 0.4;
      g.add(ring, beam);
      g.position.set(l.x, H(l.x, l.z) + 1.0, l.z);
      g.userData = { item: m, ph: Math.random() * 6 };
      scene.add(g); lootViews.set(l.id, g);
    }
  }
  for (const [id, g] of lootViews) if (!seen.has(id)) { scene.remove(g); lootViews.delete(id); }
}

// ====================== FX ======================
const fx = [];
function sparks(x, y, z, color = 0xffc070, n = 18) {
  const g = new THREE.BufferGeometry(), a = new Float32Array(n * 3), v = [];
  for (let i = 0; i < n; i++) { a.set([x, y, z], i * 3); v.push(new THREE.Vector3().randomDirection().multiplyScalar(2 + Math.random() * 4)); }
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.12, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(pts); fx.push({ pts, v, life: 1 });
}
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i], a = f.pts.geometry.attributes.position.array;
    f.life -= dt * 2;
    for (let j = 0; j < f.v.length; j++) { f.v[j].y -= 9 * dt; a[j * 3] += f.v[j].x * dt; a[j * 3 + 1] += f.v[j].y * dt; a[j * 3 + 2] += f.v[j].z * dt; }
    f.pts.geometry.attributes.position.needsUpdate = true; f.pts.material.opacity = Math.max(0, f.life);
    if (f.life <= 0) { scene.remove(f.pts); f.pts.geometry.dispose(); fx.splice(i, 1); }
  }
}
const arrowViews = [];
const arrowGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4); arrowGeo.rotateX(Math.PI / 2);
const arrowMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0 });
function syncArrows(list) {
  while (arrowViews.length < list.length) { const m = new THREE.Mesh(arrowGeo, arrowMat); scene.add(m); arrowViews.push(m); }
  arrowViews.forEach((m, i) => {
    const a = list[i];
    m.visible = !!a;
    if (a) { m.position.set(a[0], a[1], a[2]); m.lookAt(a[0] + a[3], a[1] + a[4], a[2] + a[5]); }
  });
}

// ====================== AUDIO ======================
let actx, master;
function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = 0.45; master.connect(actx.destination); } catch (e) {}
}
function tone(f, d, type = 'sine', v = 0.3, slide = 0) {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05);
}
function noise(d, v = 0.3, freq = 2000) {
  if (!actx) return;
  const b = actx.createBuffer(1, Math.ceil(actx.sampleRate * d), actx.sampleRate), dd = b.getChannelData(0);
  for (let i = 0; i < dd.length; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / dd.length, 2);
  const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
  s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = v;
  s.connect(f); f.connect(g); g.connect(master); s.start();
}
function sfx(k, x, z) {
  let vol = 1;
  if (x !== undefined && me()) { const d = Math.hypot(x - me().x, z - me().z); vol = clamp(1 - d / 40, 0, 1); if (vol <= 0.02) return; }
  switch (k) {
    case 'whoosh': noise(0.12, 0.15 * vol, 3200); break;
    case 'clang': tone(1250, 0.22, 'square', 0.12 * vol, -400); tone(1870, 0.18, 'triangle', 0.1 * vol, -200); noise(0.06, 0.3 * vol, 4000); break;
    case 'hit': noise(0.15, 0.6 * vol, 1500); tone(140, 0.15, 'triangle', 0.3 * vol, -60); break;
    case 'clang': tone(1200, 0.2, 'square', 0.06 * vol, -500); noise(0.08, 0.3 * vol, 6000); break;
    case 'pick': tone(660, 0.08, 'triangle', 0.25); setTimeout(() => tone(990, 0.12, 'triangle', 0.2), 70); break;
    case 'heal': tone(440, 0.3, 'sine', 0.2, 440); break;
    case 'kill': tone(220, 0.6, 'sawtooth', 0.2 * vol, -120); noise(0.4, 0.4 * vol, 900); break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.5, 'triangle', 0.25), i * 160)); break;
    case 'gong': tone(196, 2, 'sine', 0.35); tone(392, 1.6, 'sine', 0.12); break;
  }
}

// ====================== GAME STATE ======================
// Shared state shape (both host & client keep `S`):
// S.players: Map id -> {id,name,skin,x,y,z,yaw,pitch,hp,ar,alive,w,slots,cur,atk,mv,sp,kills,place}
const S = { players: new Map(), loot: [], arrows: [], zone: { x: 0, z: 0, r: ISLAND_R + 10 }, zoneText: '', alive: 0, phase: 'menu', myId: null, mode: 'br' };
// 1 vs 1 duel: a ring around the stupa, first to win 2 rounds takes the match
const DUEL = { r: 16, minR: 9.5, roundTime: 40, closeTime: 15, dps: 8, win: 2, spawn: [[5.5, 11.5], [-5.5, 11.5]] };
const maxPlayers = () => S.mode === 'duel' ? 2 : MAX_PLAYERS;
const views = new Map();
const me = () => S.players.get(S.myId);
let isHost = false;

// --------------- HOST SIMULATION ---------------
const H_ = { nextId: 1, lootId: 1, lootDirty: true, events: [], pending: [], zone: null, tick: 0, ended: false };
function hostReset(seed) {
  H_.lootId = 1; H_.lootDirty = true; H_.events = []; H_.pending = []; H_.ended = false;
  S.loot = []; S.arrows = [];
  buildWorld(seed);
  if (S.mode === 'duel') { H_.duel = { round: 1, score: {}, wait: 0 }; duelRound(); return; }
  H_.duel = null;
  const lr = mulberry(seed * 7 + 3);
  const pickLoot = () => { let t = lr() * 100; for (const [k, w] of LOOT_TABLE) { if ((t -= w) < 0) return k; } return 'sword'; };
  for (let i = 0; i < 90; i++) {
    const a = lr() * TAU, rr = 9 + lr() * (ISLAND_R - 18);
    const o = { x: Math.cos(a) * rr, z: Math.sin(a) * rr };
    collide(o);
    if (H(o.x, o.z) < 0.6) continue;
    S.loot.push({ id: H_.lootId++, type: pickLoot(), x: r2(o.x), z: r2(o.z) });
  }
  // a guaranteed weapon cache near the stupa
  ['sword', 'spear', 'mace', 'bow'].forEach((t, i) => { const a = i * Math.PI / 2 + 0.4; S.loot.push({ id: H_.lootId++, type: t, x: r2(Math.cos(a) * 9), z: r2(Math.sin(a) * 9) }); });
  H_.zone = { x: 0, z: 0, r: ISLAND_R + 8, fromX: 0, fromZ: 0, fromR: ISLAND_R + 8, toX: 0, toZ: 0, toR: ISLAND_R + 8, stage: 0, t: 35, shrinking: false, dps: 2 };
  S.zone = { x: 0, z: 0, r: H_.zone.r };
  // spawn every player on a ring
  const list = [...S.players.values()];
  list.forEach((p, i) => {
    const a = (i / list.length) * TAU + lr() * 0.3, rr = 45 + lr() * 25;
    const o = { x: Math.cos(a) * rr, z: Math.sin(a) * rr }; collide(o);
    Object.assign(p, { x: o.x, z: o.z, y: H(o.x, o.z), vy: 0, yaw: a + Math.PI, pitch: 0, hp: 100, ar: 0, alive: true, slots: ['fist', 'fist'], cur: 0, w: 'fist', atk: 0, cd: 0, mv: 0, sp: 0, kills: 0, place: 0, st: 100, blk: 0, rollT: 0, rolls: 0, combo: 0, lastAtk: -9, guardT: 0, inp: p.inp || blankInput() });
  });
}
function freshFighter(p, x, z, yaw, slots) {
  Object.assign(p, { x, z, y: H(x, z), vy: 0, yaw, pitch: 0, hp: 100, ar: 0, alive: true, slots, cur: 0, w: slots[0], atk: p.atk || 0, cd: 0, mv: 0, sp: 0, place: 0, st: 100, blk: 0, rollT: 0, rolls: p.rolls || 0, combo: 0, lastAtk: -9, guardT: 0, inp: p.inp || blankInput() });
  p.inp.yaw = yaw;
}
// start (or restart) a duel round: same arena, fresh health, fresh weapon rack
function duelRound() {
  H_.pending = []; S.arrows = [];
  S.loot = [];
  [['mace', 0, 13], ['machete', 13, 0], ['bow', -13, 0], ['herb', 0, -12], ['armor', 9, -9], ['herb', -9, -9]].forEach(([type, x, z]) => S.loot.push({ id: H_.lootId++, type, x, z }));
  H_.lootDirty = true;
  H_.zone = { duel: true, x: 0, z: 0, r: DUEL.r, t: DUEL.roundTime, shrinking: false, dps: DUEL.dps };
  S.zone = { x: 0, z: 0, r: DUEL.r };
  const list = [...S.players.values()].filter(p => !p.left);
  list.forEach((p, i) => {
    const [x, z] = DUEL.spawn[i % 2];
    freshFighter(p, x, z, x > 0 ? -Math.PI / 2 : Math.PI / 2, ['sword', 'spear']);
  });
  for (const p of S.players.values()) if (p.left) { p.alive = false; p.hp = 0; }
}
function duelScoreText() {
  const d = H_.duel; if (!d) return '';
  return [...S.players.values()].filter(p => !p.left).map(p => `${p.name} ${d.score[p.id] || 0}`).join('  –  ');
}
function blankInput() { return { mx: 0, mz: 0, yaw: 0, pitch: 0, atk: false, jump: false, pick: false, slot: -1, swap: false, sprint: false, block: false, roll: false }; }
// ---- block / dodge roll / stamina tuning ----
const ROLL = { time: 0.42, speed: 10.5, cost: 30, iframes: 0.34 };
const BLOCK = { arc: 1.25, take: 0.25, takeShield: 0.1, cost: 16, arrowTake: 0.2 };
// is attacker at (ax, az) in front of a blocking player t?
const facing = (t, ax, az) => Math.abs(angDiff(Math.atan2(ax - t.x, az - t.z), t.yaw)) < BLOCK.arc;
function addPlayer(name, skin, bot = false) {
  const id = H_.nextId++;
  const p = { id, name, skin: SKINS[skin] ? skin : 'viru', bot, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, hp: 100, ar: 0, alive: true, w: 'fist', slots: ['fist', 'fist'], cur: 0, atk: 0, mv: 0, sp: 0, kills: 0, place: 0, inp: blankInput(), ai: bot ? { t: 0, target: null, wander: Math.random() * TAU } : null };
  S.players.set(id, p);
  return p;
}
function feed(text) { H_.events.push(['feed', text]); showFeed(text); }

function hostStep(dt) {
  if (S.phase !== 'play' || H_.ended) return;
  const z = H_.zone;
  if (z.duel) {
    z.t -= dt;
    if (!z.shrinking && z.t <= 0) { z.shrinking = true; z.t = DUEL.closeTime; }
    if (z.shrinking) z.r = Math.max(DUEL.minR, DUEL.minR + (DUEL.r - DUEL.minR) * Math.max(0, z.t) / DUEL.closeTime);
    S.zone = { x: 0, z: 0, r: z.r };
    S.zoneText = `Round ${H_.duel.round} · ${duelScoreText()} · ` + (z.shrinking ? 'Ring closing!' : `Ring closes in ${Math.ceil(z.t)}s`);
  } else {
  z.t -= dt;
  if (z.t <= 0) {
    if (!z.shrinking) {
      if (z.stage < 6) {
        z.shrinking = true; z.t = 22; z.fromX = z.x; z.fromZ = z.z; z.fromR = z.r;
        const nr = z.stage === 5 ? 0 : z.r * (z.stage === 0 ? 0.55 : 0.58);
        const a = Math.random() * TAU, off = Math.random() * (z.r - nr) * 0.6;
        z.toX = clamp(z.x + Math.cos(a) * off, -50, 50); z.toZ = clamp(z.z + Math.sin(a) * off, -50, 50); z.toR = nr;
      }
    } else { z.shrinking = false; z.stage++; z.dps = 2 + z.stage * 3; z.t = z.stage >= 6 ? 9999 : Math.max(14, 32 - z.stage * 4); }
  }
  if (z.shrinking) { const k = 1 - z.t / 22; z.x = z.fromX + (z.toX - z.fromX) * k; z.z = z.fromZ + (z.toZ - z.fromZ) * k; z.r = z.fromR + (z.toR - z.fromR) * k; }
  S.zone = { x: z.x, z: z.z, r: z.r };
  S.zoneText = z.shrinking ? `Zone closing! ${Math.ceil(z.t)}s` : (z.stage >= 6 ? 'Final circle' : `Zone shrinks in ${Math.ceil(z.t)}s`);
  }

  H_.time = (H_.time || 0) + dt;
  for (const p of S.players.values()) {
    if (!p.alive) continue;
    if (p.bot) botThink(p, dt);
    const inp = p.inp;
    p.yaw = inp.yaw; p.pitch = inp.pitch;
    movePlayer(p, inp, dt);
    // weapon switching
    if (inp.slot >= 0 && inp.slot !== p.cur) { p.cur = inp.slot; }
    if (inp.swap) { p.cur = 1 - p.cur; inp.swap = false; }
    inp.slot = -1;
    p.w = p.slots[p.cur];
    // attack
    p.cd -= dt;
    if (inp.atk && p.cd <= 0 && !p.blk && !(p.rollT > 0)) {
      const W = WEAPONS[p.w];
      // attacks chained within a short window build a combo; the 3rd hit is a heavy finisher
      p.combo = H_.time - (p.lastAtk ?? -9) < W.cd + 0.45 ? (p.combo % 3) + 1 : 1;
      p.lastAtk = H_.time;
      p.cd = W.cd * (p.combo === 3 ? 1.25 : 1); p.atk++;
      H_.pending.push({ p, t: W.wind, W, type: p.w, combo: p.combo });
    }
    // pick up
    if (inp.pick) { inp.pick = false; tryPick(p); }
    // zone damage
    if (Math.hypot(p.x - z.x, p.z - z.z) > z.r) damage(p, z.dps * dt, null, 'zone');
  }
  // resolve delayed hits
  for (let i = H_.pending.length - 1; i >= 0; i--) {
    const h = H_.pending[i]; h.t -= dt;
    if (h.t > 0) continue;
    H_.pending.splice(i, 1);
    const a = h.p; if (!a.alive) continue;
    if (h.W.ranged) {
      const fx_ = Math.sin(a.yaw) * Math.cos(a.pitch), fy = -Math.sin(a.pitch), fz = Math.cos(a.yaw) * Math.cos(a.pitch);
      const sp = 48;
      S.arrows.push({ x: a.x + fx_ * 0.6, y: a.y + 1.45, z: a.z + fz * 0.6, vx: fx_ * sp, vy: fy * sp + 1.5, vz: fz * sp, owner: a, life: 2.5 });
    } else {
      let hitAny = false;
      for (const t of S.players.values()) {
        if (t === a || !t.alive) continue;
        const dx = t.x - a.x, dz = t.z - a.z, d = Math.hypot(dx, dz);
        if (d > h.W.range || Math.abs(t.y - a.y) > 1.8) continue;
        const ang = Math.atan2(dx, dz);
        if (Math.abs(angDiff(ang, a.yaw)) > h.W.arc / 2 + (d < 1 ? 1 : 0)) continue;
        if (t.rollT > ROLL.time - ROLL.iframes) { H_.events.push(['dodge', r2(t.x), r2(t.y + 1.4), r2(t.z), a.id, t.id]); fxDodge(t.x, t.y + 1.4, t.z, a.id, t.id); hitAny = true; continue; }
        const fin = h.combo === 3, dmgAmt = h.W.dmg * (fin ? 1.4 : 1);
        if (t.blk && facing(t, a.x, a.z)) {
          damage(t, dmgAmt * (t.ar > 0 ? BLOCK.takeShield : BLOCK.take), a, h.type, true);
          t.st -= BLOCK.cost * (fin ? 2 : 1) * (h.type === 'mace' ? 1.6 : 1);
          if (t.st <= 0) { t.st = 0; t.blk = 0; t.guardT = 1.2; H_.events.push(['gb', t.id]); }
          hitAny = true; continue;
        }
        damage(t, dmgAmt, a, h.type);
        if (fin && a.id === S.myId) showCombo();
        if (fin) H_.events.push(['cb', a.id]);
        const kb = (h.type === 'mace' ? 1.4 : 0.5) * (fin ? 2.2 : 1); t.x += dx / (d || 1) * kb; t.z += dz / (d || 1) * kb; collide(t);
        hitAny = true;
      }
      if (!hitAny && h.type !== 'fist') H_.events.push(['sw', r2(a.x), r2(a.z)]);
    }
  }
  // arrows
  for (let i = S.arrows.length - 1; i >= 0; i--) {
    const ar = S.arrows[i];
    ar.vy -= 9.8 * dt; ar.x += ar.vx * dt; ar.y += ar.vy * dt; ar.z += ar.vz * dt; ar.life -= dt;
    let dead = ar.life <= 0 || ar.y < H(ar.x, ar.z);
    if (!dead) for (const t of S.players.values()) {
      if (t === ar.owner || !t.alive) continue;
      const dy = ar.y - (t.y + 1.1);
      if (Math.abs(dy) < 1.0 && Math.hypot(ar.x - t.x, ar.z - t.z) < 0.55) {
        if (t.rollT > ROLL.time - ROLL.iframes) continue;
        const blocked = t.blk && facing(t, ar.x - ar.vx, ar.z - ar.vz);
        damage(t, WEAPONS.bow.dmg * (blocked ? BLOCK.arrowTake : 1), ar.owner, 'bow', blocked);
        if (blocked) t.st -= BLOCK.cost * 0.6;
        dead = true; break;
      }
    }
    if (!dead) for (const c of colliders) if (Math.hypot(ar.x - c.x, ar.z - c.z) < c.r && ar.y < H(c.x, c.z) + 3.5) { dead = true; break; }
    if (dead) S.arrows.splice(i, 1);
  }
  // end check
  const alive = [...S.players.values()].filter(p => p.alive);
  S.alive = alive.length;
  if (H_.duel && duelCheck(alive, dt)) return;
  if (!H_.ended && alive.length <= 1 && S.players.size > 1) {
    H_.ended = true;
    const w = alive[0];
    if (w) w.place = 1;
    H_.events.push(['end', w ? w.id : 0, w ? w.name : '']);
    onEnd(w ? w.id : 0, w ? w.name : '');
  }
}
function movePlayer(p, inp, dt) {
  const fwdX = Math.sin(p.yaw), fwdZ = Math.cos(p.yaw), rX = -Math.cos(p.yaw), rZ = Math.sin(p.yaw);
  let mx = fwdX * inp.mz + rX * inp.mx, mz = fwdZ * inp.mz + rZ * inp.mx;
  const l = Math.hypot(mx, mz);
  if (l > 0) { mx /= l; mz /= l; }
  // stamina comes back slowly while blocking, fast otherwise
  p.st = Math.min(100, (p.st ?? 100) + dt * (p.blk ? 6 : 24));
  p.guardT = Math.max(0, (p.guardT || 0) - dt);
  const grounded = p.y <= H(p.x, p.z) + 0.05;
  if (inp.roll && !(p.rollT > 0) && p.st >= ROLL.cost && grounded) {
    p.rollT = ROLL.time; p.st -= ROLL.cost; p.rolls = (p.rolls || 0) + 1;
    if (l > 0) { p.rdx = mx; p.rdz = mz; } else { p.rdx = fwdX; p.rdz = fwdZ; }
  }
  inp.roll = false;
  p.blk = inp.block && !(p.rollT > 0) && p.st > 4 && !(p.guardT > 0) ? 1 : 0;
  const sprint = inp.sprint && inp.mz > 0 && !p.blk;
  const W = WEAPONS[p.w || 'fist'];
  if (p.rollT > 0) {
    p.rollT -= dt;
    const k = ROLL.speed * (0.5 + 0.5 * Math.min(1, p.rollT / ROLL.time * 2));
    p.x += p.rdx * k * dt; p.z += p.rdz * k * dt;
  } else {
    const spd = (sprint ? 6.6 : 4.4) * (p.cd > W.cd * 0.4 ? 0.55 : 1) * (p.blk ? 0.45 : 1);
    p.x += mx * spd * dt; p.z += mz * spd * dt;
  }
  collide(p);
  const gy = H(p.x, p.z);
  if (p.y <= gy + 0.05) { p.y = gy; p.vy = 0; if (inp.jump) { p.vy = 7.5; p.y += 0.06; } }
  else { p.vy -= 22 * dt; p.y += p.vy * dt; if (p.y < gy) { p.y = gy; p.vy = 0; } }
  inp.jump = false;
  p.mv = p.y > gy + 0.1 ? 2 : (l > 0 || p.rollT > 0 ? 1 : 0);
  p.sp = sprint ? 1 : 0;
}
function damage(t, amt, src, how, blocked) {
  if (!t.alive || amt <= 0) return;
  const total = amt; let ab = 0;
  if (t.ar > 0 && how !== 'zone') { ab = Math.min(t.ar, amt * 0.6); t.ar -= ab; amt -= ab; }
  t.hp -= amt;
  if (how !== 'zone') { const n = Math.round(total), arm = blocked ? 2 : ab > amt ? 1 : 0; H_.events.push(['hit', r2(t.x), r2(t.y + 1.2), r2(t.z), src ? src.id : 0, t.id, n, arm]); fxHit(t.x, t.y + 1.2, t.z, src ? src.id : 0, t.id, n, arm); }
  if (t.hp <= 0) {
    t.hp = 0; t.alive = false;
    t.place = [...S.players.values()].filter(p => p.alive).length + 1;
    if (src) src.kills++;
    // drop weapons
    for (const w of t.slots) if (w !== 'fist') { S.loot.push({ id: H_.lootId++, type: w, x: r2(t.x + (Math.random() - 0.5) * 2), z: r2(t.z + (Math.random() - 0.5) * 2) }); H_.lootDirty = true; }
    const wn = how === 'zone' ? 'the zone' : (WEAPONS[how] ? WEAPONS[how].name.split(' · ')[0] : how);
    feed(src ? `<b>${esc(src.name)}</b> ⚔ ${esc(t.name)} <small>(${wn})</small>` : `${esc(t.name)} was consumed by <b>the zone</b>`);
    H_.events.push(['kill', r2(t.x), r2(t.z), t.id, t.place]);
    fxKill(t.x, t.z, t.id, t.place);
  }
}
function tryPick(p) {
  let best = null, bd = 2.4;
  for (const l of S.loot) { const d = Math.hypot(l.x - p.x, l.z - p.z); if (d < bd) { bd = d; best = l; } }
  if (!best) return;
  if (best.type === 'herb') { if (p.hp >= 100) return; p.hp = Math.min(100, p.hp + 45); }
  else if (best.type === 'armor') { if (p.ar >= 100) return; p.ar = Math.min(100, p.ar + 60); }
  else {
    let slot = p.slots[p.cur] === 'fist' ? p.cur : (p.slots[1 - p.cur] === 'fist' ? 1 - p.cur : p.cur);
    const old = p.slots[slot];
    if (old !== 'fist') S.loot.push({ id: H_.lootId++, type: old, x: r2(p.x), z: r2(p.z) });
    p.slots[slot] = best.type; p.cur = slot; p.w = best.type;
  }
  S.loot.splice(S.loot.indexOf(best), 1);
  H_.lootDirty = true;
  H_.events.push(['pick', p.id, best.type]);
  if (p.id === S.myId) sfx(best.type === 'herb' || best.type === 'armor' ? 'heal' : 'pick');
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --------------- BOTS ---------------
function botThink(p, dt) {
  const ai = p.ai, inp = p.inp;
  ai.t -= dt;
  const z = H_.zone;
  const W = WEAPONS[p.w];
  // pick a target periodically
  if (ai.t <= 0) {
    ai.t = 0.25 + Math.random() * 0.3;
    let best = null, bd = 28;
    for (const t of S.players.values()) { if (t === p || !t.alive) continue; const d = Math.hypot(t.x - p.x, t.z - p.z); if (d < bd) { bd = d; best = t; } }
    ai.target = best;
    ai.loot = null;
    if (!best || bd > 12) {
      const needW = p.slots.every(s => s === 'fist') || (p.hp < 60) || p.ar < 30;
      if (needW) { let bl = null, bld = 30; for (const l of S.loot) { const d = Math.hypot(l.x - p.x, l.z - p.z); if (d < bld && (l.type !== 'herb' || p.hp < 80) && (l.type !== 'armor' || p.ar < 50)) { bld = d; bl = l; } } ai.loot = bl; }
    }
    if (Math.random() < 0.05) ai.wander = Math.random() * TAU;
    // switch to better weapon
    const other = p.slots[1 - p.cur];
    if (other !== 'fist' && (p.w === 'fist' || (best && bd > 9 && other === 'bow') || (best && bd < 5 && p.w === 'bow'))) inp.slot = 1 - p.cur;
  }
  let tx, tz, wantDist = 0;
  const outside = Math.hypot(p.x - z.x, p.z - z.z) > z.r * 0.85;
  if (outside && !(ai.target && Math.hypot(ai.target.x - p.x, ai.target.z - p.z) < 4)) { tx = z.x; tz = z.z; }
  else if (ai.target) { tx = ai.target.x; tz = ai.target.z; wantDist = W.ranged ? 12 : W.range * 0.75; }
  else if (ai.loot) { tx = ai.loot.x; tz = ai.loot.z; }
  else { tx = p.x + Math.sin(ai.wander) * 10; tz = p.z + Math.cos(ai.wander) * 10; }
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  const desired = Math.atan2(dx, dz);
  inp.yaw = p.yaw + clamp(angDiff(desired, p.yaw), -6 * dt, 6 * dt);
  inp.mx = 0; inp.mz = d > wantDist + 0.3 ? 1 : (d < wantDist - 3 ? -1 : 0);
  if (ai.target && d < 4 && Math.random() < dt) inp.mx = Math.random() < 0.5 ? -1 : 1;
  inp.sprint = d > 15 || outside;
  inp.pitch = 0;
  inp.atk = false;
  if (ai.target) {
    const aligned = Math.abs(angDiff(desired, p.yaw)) < (W.ranged ? 0.08 : 0.6);
    if (W.ranged) { inp.pitch = -Math.atan2(d * 0.1, 48) * 1.0 - (ai.target.y - p.y) * 0.02; inp.atk = aligned && d < 30 && Math.random() < 0.5; }
    else inp.atk = aligned && d < W.range + 0.2;
  }
  if (ai.loot && d < 1.8) inp.pick = true;
  // defend: raise guard when the target is swinging nearby, roll away when hurt
  ai.blkT = (ai.blkT || 0) - dt;
  const tg = ai.target;
  if (tg && !W.ranged && d < 4 && tg.cd > 0.1 && ai.blkT <= -0.6 && Math.random() < 0.35) ai.blkT = 0.5 + Math.random() * 0.4;
  inp.block = ai.blkT > 0 && p.st > 20;
  if (inp.block) inp.atk = false;
  if (tg && d < 3.5 && p.hp < 45 && p.st > 50 && Math.random() < dt * 1.2) { inp.roll = true; inp.mx = Math.random() < 0.5 ? -1 : 1; inp.mz = -0.5; }
  // stuck detection
  ai.lx = ai.lx ?? p.x; ai.lz = ai.lz ?? p.z; ai.st = (ai.st || 0) + dt;
  if (ai.st > 1.2) { if (Math.hypot(p.x - ai.lx, p.z - ai.lz) < 0.5 && inp.mz !== 0) { ai.wander = Math.random() * TAU; inp.jump = true; ai.target = null; ai.loot = null; ai.t = 1.2; } ai.st = 0; ai.lx = p.x; ai.lz = p.z; }
}

// ====================== NETWORK ======================
const NET = { peer: null, conns: new Map(), host: null, code: null, sendT: 0 };
const PREFIX = 'ranabhumi-v1-';
function genCode() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({ length: 5 }, () => a[Math.floor(Math.random() * a.length)]).join(''); }
function netAvailable() { return typeof window.Peer === 'function'; }

// returns true while the duel goes on; false lets the normal "last one standing" ending run
function duelCheck(alive, dt) {
  const d = H_.duel;
  if ([...S.players.values()].some(p => p.left)) return false;   // opponent left: the one still here wins
  if (d.wait > 0) {
    d.wait -= dt;
    if (d.wait <= 0) { d.round++; duelRound(); H_.events.push(['rs', d.round]); onRoundStart(d.round); }
    return true;
  }
  if (alive.length > 1) return true;
  const w = alive[0];
  if (w) d.score[w.id] = (d.score[w.id] || 0) + 1;
  if (w && d.score[w.id] >= DUEL.win) { S.zoneText = duelScoreText(); return false; }
  d.wait = 3.5;
  const ev = ['round', d.round, w ? w.id : 0, w ? w.name : '', duelScoreText()];
  H_.events.push(ev); onRoundEnd(ev);
  return true;
}
function onRoundEnd(e) {
  const [, n, wid, wname, score] = e;
  sfx(wid === S.myId ? 'win' : 'gong');
  centerMsg(wid === S.myId ? `You win round ${n}` : (wname ? `${wname} wins round ${n}` : `Round ${n} draw`), score, 3.2);
}
function onRoundStart(n) {
  sfx('gong'); centerMsg(`ROUND ${n}`, 'Fight!', 1.8);
  setTimeout(() => { const p = me(); if (p) { camYaw = p.yaw; camPitch = 0.25; } }, 150);
}
function hostRoom(mode = S.mode) {
  S.mode = mode;
  if (!netAvailable()) return showErr('Online library failed to load. Check your internet connection.');
  const code = genCode();
  NET.code = code;
  const peer = new window.Peer(PREFIX + code);
  NET.peer = peer;
  isHost = true;
  S.players.clear();
  H_.nextId = 1;
  const meP = addPlayer(myName(), mySkin);
  S.myId = meP.id;
  S.phase = 'lobby';
  peer.on('open', () => { $('roomCode').textContent = code; showScreen('lobby'); renderLobby(); });
  peer.on('error', e => { if (e.type === 'unavailable-id') { peer.destroy(); hostRoom(mode); } else if (e.type !== 'network' && e.type !== 'disconnected') { showErr('Network error: ' + e.type); $('lobbyErr').textContent = 'Network: ' + e.type; } });
  // Phones drop the connection to the room server when the browser goes to the background
  // (e.g. while sharing the code on WhatsApp). Friends then get "room not found", so reconnect.
  peer.on('disconnected', () => {
    if (NET.peer !== peer || peer.destroyed) return;
    $('lobbyErr').textContent = 'Reconnecting…';
    setTimeout(() => { if (NET.peer === peer && !peer.destroyed && peer.disconnected) try { peer.reconnect(); } catch (e) {} }, 800);
  });
  peer.on('open', () => { if ($('lobbyErr').textContent === 'Reconnecting…') $('lobbyErr').textContent = ''; });
  peer.on('connection', conn => {
    conn.on('data', msg => onHostMsg(conn, msg));
    conn.on('close', () => {
      const p = conn.playerId && S.players.get(conn.playerId);
      NET.conns.delete(conn.peer);
      if (p) { if (S.phase === 'lobby') S.players.delete(p.id); else { if (S.mode === 'duel') p.left = true; if (p.alive) { p.alive = false; p.hp = 0; feed(`${esc(p.name)} left the island`); } } }
      renderLobby(); broadcastLobby();
    });
  });
  $('bStart').disabled = false; setLobbyText();
}
document.addEventListener('visibilitychange', () => {
  const peer = NET.peer;
  if (document.visibilityState === 'visible' && isHost && peer && !peer.destroyed && peer.disconnected) try { peer.reconnect(); } catch (e) {}
});
function onHostMsg(conn, m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'join') {
    if (S.phase !== 'lobby' || S.players.size >= maxPlayers()) { conn.send({ t: 'full' }); return; }
    const p = addPlayer(String(m.name || 'Warrior').slice(0, 14), m.skin);
    conn.playerId = p.id;
    NET.conns.set(conn.peer, conn);
    conn.send({ t: 'welcome', id: p.id, mode: S.mode });
    renderLobby(); broadcastLobby();
  } else if (m.t === 'in') {
    const p = S.players.get(conn.playerId); if (!p) return;
    const i = p.inp;
    i.mx = clamp(+m.mx || 0, -1, 1); i.mz = clamp(+m.mz || 0, -1, 1); i.yaw = +m.yaw || 0; i.pitch = clamp(+m.pitch || 0, -1.2, 1.2);
    i.atk = !!m.atk; i.sprint = !!m.sp; i.block = !!m.bk; if (m.rl) i.roll = true;
    if (m.j) i.jump = true; if (m.pk) i.pick = true; if (m.sw) i.swap = true; if (m.sl >= 0 && m.sl <= 1) i.slot = m.sl;
    // trust the client's predicted position a little (smooth feel), but never beyond what it could reach
    if (typeof m.x === 'number' && p.alive) { const d = Math.hypot(m.x - p.x, m.z - p.z); if (d < 1.2) { p.x = m.x; p.z = m.z; collide(p); } }
  }
}
function broadcast(msg) { for (const c of NET.conns.values()) if (c.open) c.send(msg); }
function broadcastLobby() { broadcast({ t: 'lobby', players: [...S.players.values()].map(p => [p.id, p.name, p.skin]) }); }

function joinRoom(code, attempt = 1) {
  if (!netAvailable()) return showErr('Online library failed to load. Check your internet connection.');
  // keep only letters and digits, so "abc d2", "ABCD2 " and a pasted invite link all work
  code = String(code).toUpperCase().replace(/.*ROOM=/, '').replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (code.length !== 5) return showErr('Enter the 5-letter room code.');
  if (NET.peer && attempt === 1) { try { NET.peer.destroy(); } catch (e) {} NET.peer = null; }
  isHost = false;
  showErr(attempt > 1 ? `Looking for room ${code}… (${attempt}/3)` : 'Connecting…');
  const peer = NET.peer && !NET.peer.destroyed ? NET.peer : new window.Peer();
  NET.peer = peer;
  let done = false;
  const retry = () => {
    if (done || NET.peer !== peer || S.phase !== 'menu') return;
    done = true;
    if (attempt < 3) setTimeout(() => joinRoom(code, attempt + 1), 2000);
    else showErr(`Room ${code} not found. Check the code, and ask the host to keep the game open on their screen.`);
  };
  NET.joinRetry = retry;
  const go = () => {
    const conn = peer.connect(PREFIX + code, { reliable: true });
    NET.host = conn;
    const to = setTimeout(retry, 9000);
    conn.on('open', () => { clearTimeout(to); done = true; conn.send({ t: 'join', name: myName(), skin: mySkin }); });
    conn.on('data', m => onClientMsg(m));
    conn.on('close', () => { if (S.phase !== 'menu') { centerMsg('Host left the match', 'Returning to menu…'); setTimeout(toMenu, 2500); } });
  };
  if (peer.open) go(); else peer.on('open', go);
  if (attempt === 1) peer.on('error', e => {
    if (e.type === 'peer-unavailable') NET.joinRetry && NET.joinRetry();
    else if (e.type !== 'network' && e.type !== 'disconnected') showErr('Network error: ' + e.type);
  });
}
function onClientMsg(m) {
  if (m.t === 'full') { showErr('That room is full or already playing.'); return; }
  if (m.t === 'welcome') { S.myId = m.id; S.phase = 'lobby'; S.mode = m.mode === 'duel' ? 'duel' : 'br'; setLobbyText(); $('roomCode').textContent = $('code').value.toUpperCase(); showScreen('lobby'); $('bStart').disabled = true; $('lobbyNote').textContent = 'Waiting for the host to start…'; }
  if (m.t === 'lobby') { S.lobby = m.players; renderLobby(); }
  if (m.t === 'start') { S.mode = m.mode === 'duel' ? 'duel' : 'br'; startMatchView(m.seed); }
  if (m.t === 's') applySnapshot(m);
  if (m.t === 'loot') { S.loot = m.l.map(a => ({ id: a[0], type: a[1], x: a[2], z: a[3] })); syncLootViews(S.loot); }
}
let lastSnap = 0;
function applySnapshot(m) {
  const seen = new Set();
  for (const a of m.p) {
    const [id, x, y, z, yaw, hp, ar, alive, w, atk, mv, sp, kills, place, name, skin, slots, cur, blk, rolls, st] = a;
    seen.add(id);
    let p = S.players.get(id);
    if (!p) { p = { id }; S.players.set(id, p); }
    const local = id === S.myId;
    Object.assign(p, { hp, ar, alive: !!alive, w, atk, kills, place, name, skin, slots, cur });
    if (!local) Object.assign(p, { blk, rolls }); else p.stHost = st;
    if (local && p.alive && p.x !== undefined) {
      // client-side prediction: keep our own position unless far off
      if (Math.hypot(p.x - x, p.z - z) > 2.5) { p.x = x; p.z = z; p.y = y; }
    } else { p.x = x; p.y = y; p.z = z; p.yaw = yaw; p.mv = mv; p.sp = sp; }
  }
  for (const id of [...S.players.keys()]) if (!seen.has(id)) S.players.delete(id);
  S.arrows = m.a; S.zone = { x: m.z[0], z: m.z[1], r: m.z[2] }; S.zoneText = m.zt; S.alive = m.al;
  for (const e of m.e || []) handleEvent(e);
}
function handleEvent(e) {
  if (e[0] === 'hit') fxHit(e[1], e[2], e[3], e[4], e[5], e[6], e[7]);
  else if (e[0] === 'feed') showFeed(e[1]);
  else if (e[0] === 'kill') fxKill(e[1], e[2], e[3], e[4]);
  else if (e[0] === 'end') onEnd(e[1], e[2]);
  else if (e[0] === 'round') onRoundEnd(e);
  else if (e[0] === 'rs') onRoundStart(e[1]);
  else if (e[0] === 'sw') {}
  else if (e[0] === 'dodge') fxDodge(e[1], e[2], e[3], e[4], e[5]);
  else if (e[0] === 'cb' && e[1] === S.myId) showCombo();
  else if (e[0] === 'gb' && e[1] === S.myId) centerMsg('GUARD BROKEN', '', 0.9);
  else if (e[0] === 'pick' && e[1] === S.myId) sfx(e[2] === 'herb' || e[2] === 'armor' ? 'heal' : 'pick');
}
function makeSnapshot() {
  return {
    t: 's',
    p: [...S.players.values()].map(p => [p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.yaw), Math.ceil(p.hp), Math.ceil(p.ar), p.alive ? 1 : 0, p.w, p.atk, p.mv, p.sp, p.kills, p.place, p.name, p.skin, p.slots, p.cur, p.blk ? 1 : 0, p.rolls || 0, Math.round(p.st ?? 100)]),
    a: S.arrows.map(a => [r2(a.x), r2(a.y), r2(a.z), r2(a.vx), r2(a.vy), r2(a.vz)]),
    z: [r2(S.zone.x), r2(S.zone.z), r2(S.zone.r)], zt: S.zoneText, al: S.alive,
    e: H_.events.splice(0),
  };
}

// ====================== MATCH FLOW ======================
let mySkin = 'viru';
function myName() { const n = $('name').value.trim(); return n || 'Warrior' + Math.floor(Math.random() * 90 + 10); }
function startSolo(mode = 'br') {
  initAudio();
  S.mode = mode;
  isHost = true; NET.conns.clear();
  S.players.clear(); H_.nextId = 1;
  S.myId = addPlayer(myName(), mySkin).id;
  hostStart();
}
function hostStart() {
  initAudio();
  // fill with bots
  const used = new Set([...S.players.values()].map(p => p.name));
  let bi = 0;
  while (S.players.size < maxPlayers()) {
    let n = BOT_NAMES[bi++ % BOT_NAMES.length]; while (used.has(n)) n = BOT_NAMES[bi++ % BOT_NAMES.length] + ' ' + bi;
    used.add(n);
    addPlayer(n, SKIN_KEYS[Math.floor(Math.random() * SKIN_KEYS.length)], true);
  }
  const seed = Math.floor(Math.random() * 1e9);
  hostReset(seed);
  S.phase = 'play';
  broadcast({ t: 'start', seed, mode: S.mode });
  broadcast({ t: 'loot', l: S.loot.map(l => [l.id, l.type, l.x, l.z]) });
  H_.lootDirty = false;
  startMatchView(seed, true);
}
function startMatchView(seed, hostSide = false) {
  initAudio();
  if (!hostSide) buildWorld(seed);
  for (const v of views.values()) v.dispose(); views.clear();
  syncLootViews(hostSide ? S.loot : []);
  S.phase = 'play'; spectating = null; ended = false;
  showScreen(null);
  $('feed').innerHTML = '';
  if (S.mode === 'duel') centerMsg('1 VS 1 DUEL', 'First to win 2 rounds · Weapons around the stupa', 3.2);
  else centerMsg('RANABHUMI', 'Find weapons · Stay in the safe zone · Be the last warrior', 3.2);
  sfx('gong');
  camYaw = 0; camPitch = 0.25;
  setTimeout(() => { const p = me(); if (p) camYaw = p.yaw; }, 120);
  requestLock();
}
let ended = false, spectating = null;
function onEnd(winId, winName) {
  if (ended) return; ended = true;
  const meP = me();
  const won = winId === S.myId;
  if (won) sfx('win');
  setTimeout(() => {
    $('overT').textContent = won ? 'VICTORY!' : (winName ? `${winName} WINS` : 'MATCH OVER');
    if (S.mode === 'duel') $('overS').innerHTML = (won ? 'You won the duel.' : 'You lost the duel.') + `<br>${esc(S.zoneText.split(' · ').find(t => t.includes('–')) || '')}`;
    else $('overS').innerHTML = won ? `Last warrior standing on Ranabhumi.<br>Kills: <b>${meP ? meP.kills : 0}</b>` : `You placed <b>#${meP && meP.place ? meP.place : '?'}</b> with <b>${meP ? meP.kills : 0}</b> kills.`;
    $('bAgain').style.display = isHost ? '' : 'none';
    $('bSpec').style.display = 'none';
    showScreen('over'); document.exitPointerLock?.();
  }, won ? 1500 : 2500);
}
// floating damage numbers (HTML, projected from the 3D hit point)
const dmgNums = [];
function dmgNumber(x, y, z, n, kind) {
  const el = document.createElement('div'); el.className = 'dnum ' + kind; el.textContent = n;
  $('hud').appendChild(el);
  dmgNums.push({ el, x: x + (Math.random() - 0.5) * 0.6, y: y + 0.6, z, t: 0 });
}
function updateDmgNumbers(dt) {
  const v = new THREE.Vector3();
  for (let i = dmgNums.length - 1; i >= 0; i--) {
    const d = dmgNums[i]; d.t += dt; d.y += dt * 1.2;
    if (d.t > 0.9) { d.el.remove(); dmgNums.splice(i, 1); continue; }
    v.set(d.x, d.y, d.z).project(camera);
    const vis = v.z < 1;
    d.el.style.display = vis ? '' : 'none';
    d.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -50%) scale(${d.t < 0.12 ? 1.6 - d.t * 5 : 1})`;
    d.el.style.opacity = d.t > 0.6 ? (0.9 - d.t) / 0.3 : 1;
  }
}
function fxDodge(x, y, z, srcId, tId) {
  sparks(x, y, z, 0xbfe0ff, 10);
  if (srcId === S.myId || tId === S.myId) dmgNumber(x, y, z, 'DODGE', 'dodge');
}
function showCombo() {
  const el = $('combo'); el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
}
function fxHit(x, y, z, srcId, tId, n, arm) {
  if (arm === 2) {
    sparks(x, y, z, 0xffffff, 18); sparks(x, y, z, 0x9fd0ff, 10); sfx('clang', x, z);
    if (srcId === S.myId || tId === S.myId) dmgNumber(x, y, z, 'BLOCK ' + n, 'blk');
    return;
  }
  sparks(x, y, z, 0xffb060, 16); sparks(x, y, z, 0xc8321c, 8);
  if (n && srcId === S.myId && tId !== S.myId) dmgNumber(x, y, z, n, arm ? 'arm' : n >= 30 ? 'big' : '');
  else if (n && tId === S.myId) dmgNumber(x, y, z, '-' + n, 'me');
  sfx('hit', x, z);
  if (srcId === S.myId) { $('cross').classList.add('hitm'); setTimeout(() => $('cross').classList.remove('hitm'), 120); }
  if (tId === S.myId) { $('dmg').style.opacity = 0.7; setTimeout(() => $('dmg').style.opacity = 0, 160); shakeT = 0.18; }
}
function fxKill(x, z, id, place) {
  sparks(x, H(x, z) + 1, z, 0xffd27a, 40);
  sfx('kill', x, z);
  if (id === S.myId && !ended && S.mode !== 'duel') {
    centerMsg('YOU FELL', `Placed #${place} · Press Spectate on the end screen or keep watching`, 4);
    setTimeout(() => { if (!ended) { $('overT').textContent = 'DEFEATED'; $('overS').innerHTML = `You placed <b>#${place}</b> with <b>${me() ? me().kills : 0}</b> kills.`; $('bAgain').style.display = 'none'; $('bSpec').style.display = ''; showScreen('over'); document.exitPointerLock?.(); } }, 2500);
  }
}
function toMenu() {
  if (NET.peer) { try { NET.peer.destroy(); } catch (e) {} }
  NET.peer = null; NET.conns.clear(); NET.host = null;
  for (const v of views.values()) v.dispose(); views.clear();
  syncLootViews([]); syncArrows([]);
  S.players.clear(); S.phase = 'menu'; ended = false;
  showScreen('menu');
}

// ====================== UI ======================
function showScreen(id) {
  for (const s of ['menu', 'lobby', 'over']) $(s).classList.toggle('hidden', s !== id);
  $('hud').classList.toggle('hidden', id !== null);
  document.body.classList.toggle('playing', id === null);
}
function showErr(t) { $('err').textContent = t; }
function renderLobby() {
  const list = isHost ? [...S.players.values()].map(p => [p.id, p.name, p.skin]) : (S.lobby || []);
  $('plist').innerHTML = list.map(([id, n, s]) => `<li>${id === S.myId ? '⭐ ' : ''}${esc(n)} <span style="color:#b9a785">· ${SKINS[s] ? SKINS[s].label : ''}</span>${id === 1 ? ' <span style="color:#e0b45e">(host)</span>' : ''}</li>`).join('') +
    (S.mode === 'duel' ? (list.length < 2 ? `<li style="color:#b9a785">Waiting for an opponent…</li>` : '') : `<li style="color:#b9a785">+ ${Math.max(0, MAX_PLAYERS - list.length)} bots</li>`);
}
function setLobbyText() {
  const duel = S.mode === 'duel';
  $('lobbyKicker').textContent = duel ? '1 vs 1 Duel Room' : 'Online Room';
  if (isHost) $('lobbyNote').textContent = (duel ? 'Share the code with one friend. Start alone to fight a bot.' : 'Bots fill the island up to 12 warriors.') + ' Keep this page open while friends join.';
}
let centerT = 0;
function centerMsg(t, s = '', d = 2.5) { $('center').innerHTML = esc(t) + (s ? `<small>${esc(s)}</small>` : ''); $('center').style.opacity = 1; centerT = d; }
function showFeed(html) {
  const d = document.createElement('div'); d.innerHTML = html; $('feed').prepend(d);
  while ($('feed').children.length > 5) $('feed').lastChild.remove();
  setTimeout(() => d.remove(), 7000);
}
{
  const box = $('skins');
  for (const k of SKIN_KEYS) {
    const s = SKINS[k], b = document.createElement('div');
    b.className = 'skin' + (k === mySkin ? ' sel' : '');
    b.innerHTML = `<i style="background:#${s.skin.toString(16).padStart(6, '0')};box-shadow:0 0 0 2px #${s.accent.toString(16).padStart(6, '0')}"></i>${s.label}`;
    b.onclick = () => { mySkin = k; [...box.children].forEach(c => c.classList.remove('sel')); b.classList.add('sel'); previewSkin(); };
    box.appendChild(b);
  }
  try { $('name').value = localStorage.getItem('rb_name') || ''; } catch (e) {}
  $('name').addEventListener('change', () => { try { localStorage.setItem('rb_name', $('name').value); } catch (e) {} });
  const q = new URLSearchParams(location.search).get('room');
  if (q) $('code').value = q.toUpperCase();
}
$('bSolo').onclick = () => startSolo('br');
$('bHost').onclick = () => { initAudio(); hostRoom('br'); };
$('bDuel').onclick = () => { initAudio(); hostRoom('duel'); };
$('bDuelBot').onclick = () => startSolo('duel');
$('bJoin').onclick = () => { initAudio(); joinRoom($('code').value); };
$('bStart').onclick = () => { if (isHost) hostStart(); };
$('bLeave').onclick = toMenu;
$('bMenu').onclick = toMenu;
$('bSpec').onclick = () => { showScreen(null); spectating = true; };
$('bAgain').onclick = () => {
  if (!isHost) return;
  for (const [id, p] of S.players) if (p.bot) S.players.delete(id);
  for (const p of S.players.values()) p.inp = blankInput();
  hostStart();
};
$('bCopy').onclick = () => {
  const url = location.origin + location.pathname + '?room=' + NET.code;
  navigator.clipboard?.writeText(url).then(() => { $('bCopy').textContent = 'Copied!'; setTimeout(() => $('bCopy').textContent = 'Copy invite link', 1500); }).catch(() => { $('bCopy').textContent = NET.code; });
};

// ====================== INPUT ======================
const keys = {};
let camYaw = 0, camPitch = 0.25, mouseDown = false, locked = false;
const edge = { jump: false, pick: false, swap: false, roll: false, slot: -1 };
let rightDown = false;
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (S.phase !== 'play') return;
  if (e.code === 'Space') { edge.jump = true; e.preventDefault(); }
  if (e.code === 'KeyE') edge.pick = true;
  if (e.code === 'KeyQ') edge.swap = true;
  if (e.code === 'Digit1') edge.slot = 0;
  if (e.code === 'Digit2') edge.slot = 1;
  if (e.code === 'KeyF') mouseDown = true;
  if (e.code === 'KeyC' || e.code === 'AltLeft') { edge.roll = true; e.preventDefault(); }
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyF') mouseDown = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; rightDown = false; });
function requestLock() { if (!matchMedia('(pointer:fine)').matches) return; try { canvas.requestPointerLock()?.catch?.(() => {}); } catch (e) {} }
canvas.addEventListener('mousedown', e => {
  if (S.phase !== 'play') return;
  if (!locked) { requestLock(); return; }
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) rightDown = true;
});
addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; if (e.button === 2) rightDown = false; });
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; $('clickHint').style.display = locked ? 'none' : ''; });
addEventListener('mousemove', e => {
  if (!locked) return;
  // Chrome sometimes sends one huge jump right after pointer lock starts; ignore it
  if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
  camYaw -= e.movementX * 0.0024;
  camPitch = clamp(camPitch + e.movementY * 0.0022, -0.9, 1.1);
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ---------- touch controls (phones / tablets) ----------
// Left thumb: virtual joystick. Right thumb: drag anywhere to look. Buttons: attack, jump, pick up, swap, sprint.
const touch = { jx: 0, jz: 0, joyId: null, lookId: null, lx: 0, ly: 0, atk: false, sprint: false, block: false };
function setupTouch() {
  const joy = $('joy'), knob = $('joyKnob'), look = $('lookZone');
  const R = 55;
  let cx = 0, cy = 0;
  const moveKnob = (x, y) => {
    let dx = x - cx, dy = y - cy; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touch.jx = dx / R; touch.jz = -dy / R;
  };
  $('joyZone').addEventListener('pointerdown', e => {
    if (touch.joyId !== null) return;
    touch.joyId = e.pointerId; e.target.setPointerCapture?.(e.pointerId);
    cx = e.clientX; cy = e.clientY;
    joy.style.left = (cx - 70) + 'px'; joy.style.top = (cy - 70) + 'px'; joy.classList.add('on');
    moveKnob(cx, cy);
  });
  addEventListener('pointermove', e => {
    if (e.pointerId === touch.joyId) moveKnob(e.clientX, e.clientY);
    if (e.pointerId === touch.lookId) {
      camYaw -= (e.clientX - touch.lx) * 0.0065;
      camPitch = clamp(camPitch + (e.clientY - touch.ly) * 0.005, -0.9, 1.1);
      touch.lx = e.clientX; touch.ly = e.clientY;
    }
  });
  const end = e => {
    if (e.pointerId === touch.joyId) { touch.joyId = null; touch.jx = touch.jz = 0; knob.style.transform = ''; joy.classList.remove('on'); }
    if (e.pointerId === touch.lookId) touch.lookId = null;
  };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);
  look.addEventListener('pointerdown', e => { if (touch.lookId !== null) return; touch.lookId = e.pointerId; touch.lx = e.clientX; touch.ly = e.clientY; });
  const hold = (id, on, off) => {
    const el = $(id);
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('down'); on(); });
    const up = () => { el.classList.remove('down'); off && off(); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  };
  hold('tAtk', () => { touch.atk = true; touch.atkUntil = performance.now() + 160; }, () => { touch.atk = false; });
  hold('tJump', () => { edge.jump = true; });
  hold('tPick', () => { edge.pick = true; });
  hold('tSwap', () => { edge.swap = true; });
  hold('tBlock', () => { touch.block = true; }, () => { touch.block = false; });
  hold('tRoll', () => { edge.roll = true; });
  hold('tRun', () => { touch.sprint = !touch.sprint; $('tRun').classList.toggle('lit', touch.sprint); });
  $('tFull').addEventListener('click', () => {
    const d = document.documentElement;
    if (!document.fullscreenElement) d.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
    else document.exitFullscreen?.();
  });
  document.addEventListener('touchmove', e => { if (S.phase === 'play') e.preventDefault(); }, { passive: false });
}
if (IS_TOUCH) setupTouch();

function gatherInput() {
  const tmag = Math.hypot(touch.jx, touch.jz);
  return {
    mx: clamp((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + (tmag > 0.2 ? touch.jx : 0), -1, 1),
    mz: clamp((keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + (tmag > 0.2 ? touch.jz : 0), -1, 1),
    yaw: camYaw, pitch: camPitch - 0.25, atk: mouseDown || touch.atk || performance.now() < (touch.atkUntil || 0),
    sprint: !!(keys.ShiftLeft || keys.ShiftRight) || touch.sprint || tmag > 0.95,
    block: rightDown || !!keys.KeyX || touch.block,
  };
}

// ====================== HUD ======================
const mm = $('minimap').getContext('2d');
// ---- crosshair: style, colour and size picked on the menu, remembered in this browser ----
const XH = { style: 'cross', color: '#ffffff', size: 22 };
const XH_STYLES = {
  cross: s => `<path d="M12 2v7M12 15v7M2 12h7M15 12h7"/>`,
  dot: s => `<circle cx="12" cy="12" r="2.4" class="f"/>`,
  circle: s => `<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.2" class="f"/>`,
  t: s => `<path d="M12 15v7M2 12h7M15 12h7"/>`,
  chevron: s => `<path d="M6 16l6-6 6 6"/>`,
  plusdot: s => `<path d="M12 3v5M12 16v5M3 12h5M16 12h5"/><circle cx="12" cy="12" r="1.3" class="f"/>`,
};
function applyCrosshair() {
  const c = $('cross');
  c.style.setProperty('--xc', XH.color);
  c.style.width = c.style.height = XH.size + 'px'; c.style.margin = `${-XH.size / 2}px 0 0 ${-XH.size / 2}px`;
  c.innerHTML = `<svg viewBox="0 0 24 24">${XH_STYLES[XH.style](XH.size)}</svg>`;
  document.querySelectorAll('#xhStyles .xh').forEach(b => b.classList.toggle('sel', b.dataset.s === XH.style));
  document.querySelectorAll('#xhColors .xc').forEach(b => b.classList.toggle('sel', b.dataset.c === XH.color));
  const pv = $('xhPreview'); if (pv) pv.innerHTML = c.innerHTML, pv.style.setProperty('--xc', XH.color), pv.style.width = pv.style.height = XH.size + 'px';
  try { localStorage.setItem('rb_xh', JSON.stringify(XH)); } catch (e) {}
}
function setupCrosshair() {
  try { Object.assign(XH, JSON.parse(localStorage.getItem('rb_xh') || '{}')); } catch (e) {}
  if (!XH_STYLES[XH.style]) XH.style = 'cross';
  $('xhStyles').innerHTML = Object.keys(XH_STYLES).map(k => `<button class="xh" data-s="${k}" title="${k}"><svg viewBox="0 0 24 24">${XH_STYLES[k]()}</svg></button>`).join('');
  $('xhColors').innerHTML = ['#ffffff', '#ff4a3a', '#4aff7a', '#ffe14a', '#4ae0ff', '#ff5ad8'].map(c => `<button class="xc" data-c="${c}" style="background:${c}"></button>`).join('');
  $('xhStyles').onclick = e => { const b = e.target.closest('.xh'); if (b) { XH.style = b.dataset.s; applyCrosshair(); } };
  $('xhColors').onclick = e => { const b = e.target.closest('.xc'); if (b) { XH.color = b.dataset.c; applyCrosshair(); } };
  $('xhSize').value = XH.size; $('xhSize').oninput = () => { XH.size = +$('xhSize').value; applyCrosshair(); };
  applyCrosshair();
}
setupCrosshair();
function drawHUD() {
  const p = me(); if (!p) return;
  $('hpf').style.width = p.hp + '%'; $('hpT').textContent = Math.ceil(p.hp);
  $('hptr').style.width = p.hp + '%';
  const st = isHost ? p.st ?? 100 : p.st ?? p.stHost ?? 100;
  $('stf').style.width = st + '%';
  $('abRoll').classList.toggle('off', st < ROLL.cost || p.rollT > 0);
  $('abBlock').classList.toggle('on', !!p.blk); $('abBlock').classList.toggle('off', (p.guardT || 0) > 0 || st <= 4);
  $('abCombo').textContent = p.combo > 1 && H_.time - (p.lastAtk ?? -9) < 1 ? 'x' + p.combo : '';
  document.body.classList.toggle('lowhp', p.alive && p.hp < 30);
  $('arf').style.width = p.ar + '%'; $('arT').textContent = Math.ceil(p.ar);
  $('aliveN').textContent = S.alive || [...S.players.values()].filter(q => q.alive).length;
  $('killN').textContent = p.kills || 0;
  $('zoneInfo').textContent = S.zoneText || 'Safe zone';
  const slots = p.slots || ['fist', 'fist'];
  for (let i = 0; i < 2; i++) { const el = $('s' + i); el.classList.toggle('on', p.cur === i); el.lastChild.textContent = WEAPONS[slots[i]].name; }
  const outside = Math.hypot(p.x - S.zone.x, p.z - S.zone.z) > S.zone.r;
  $('zoneTint').style.opacity = outside && p.alive ? 0.22 : 0;
  // pickup prompt
  let best = null, bd = 2.4;
  if (p.alive) for (const l of S.loot) { const d = Math.hypot(l.x - p.x, l.z - p.z); if (d < bd) { bd = d; best = l; } }
  const pr = $('prompt');
  if (best) { pr.classList.remove('hidden'); pr.innerHTML = `${IS_TOUCH ? '✋' : '<kbd>E</kbd>'} Pick up ${esc((WEAPONS[best.type] || ITEMS[best.type]).name)}`; } else pr.classList.add('hidden');
  // minimap
  const s = 170, k = s / (ISLAND_R * 2 + 10);
  mm.clearRect(0, 0, s, s);
  mm.save(); mm.beginPath(); mm.arc(s / 2, s / 2, s / 2, 0, TAU); mm.clip();
  mm.fillStyle = '#2a5a7a'; mm.fillRect(0, 0, s, s);
  mm.fillStyle = '#5f8a3a'; mm.beginPath(); mm.arc(s / 2, s / 2, (ISLAND_R - 6) * k, 0, TAU); mm.fill();
  mm.fillStyle = '#f2ece0'; mm.beginPath(); mm.arc(s / 2, s / 2, 7 * k, 0, TAU); mm.fill();
  mm.strokeStyle = '#d070ff'; mm.lineWidth = 2; mm.beginPath(); mm.arc(s / 2 + S.zone.x * k, s / 2 + S.zone.z * k, Math.max(1, S.zone.r * k), 0, TAU); mm.stroke();
  mm.fillStyle = 'rgba(224,180,94,0.8)';
  for (const l of S.loot) { mm.fillRect(s / 2 + l.x * k - 1, s / 2 + l.z * k - 1, 2, 2); }
  // me as arrow
  mm.translate(s / 2 + p.x * k, s / 2 + p.z * k); mm.rotate(-p.yaw + Math.PI);
  mm.fillStyle = '#fff'; mm.beginPath(); mm.moveTo(0, -6); mm.lineTo(4, 5); mm.lineTo(-4, 5); mm.closePath(); mm.fill();
  mm.restore();
}

// ====================== MAIN LOOP ======================
const clock = new THREE.Clock();
let shakeT = 0, snapT = 0, inT = 0, time = 0;
const camTarget = new THREE.Vector3();

// menu backdrop
buildWorld(7);
function previewSkin() {
  if (S.phase !== 'menu') return;
  for (const v of views.values()) v.dispose(); views.clear();
  const p = { id: -1, name: '', skin: mySkin, x: 0, y: H(0, 12), z: 12, yaw: 0, hp: 100, ar: 0, alive: true, w: 'sword', atk: 0, mv: 0 };
  const v = new View(p); views.set(-1, v); S.preview = p;
}
previewSkin();
loadModels();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;
  zoneMat.uniforms.uT.value = time;
  if (world) world.sea.position.y = 0.15 + Math.sin(time * 0.6) * 0.08;
  updateTreeLOD(camera.position.x, camera.position.z);

  if (S.phase === 'play') {
    const inp = gatherInput();
    const p = me();
    if (isHost) {
      if (p) {
        Object.assign(p.inp, inp);
        if (edge.roll) p.inp.roll = true;
        if (edge.jump) p.inp.jump = true; if (edge.pick) p.inp.pick = true; if (edge.swap) p.inp.swap = true; if (edge.slot >= 0) p.inp.slot = edge.slot;
      }
      hostStep(dt);
      snapT -= dt;
      if (NET.conns.size && snapT <= 0) {
        snapT = 1 / 20;
        broadcast(makeSnapshot());
        if (H_.lootDirty) { H_.lootDirty = false; broadcast({ t: 'loot', l: S.loot.map(l => [l.id, l.type, l.x, l.z]) }); }
      } else if (!NET.conns.size) H_.events.length = 0;
      if (H_.lootDirty && !NET.conns.size) H_.lootDirty = false;
      syncLootViews(S.loot);
    } else if (p && NET.host) {
      // client prediction of own movement
      if (p.alive) {
        p.yaw = inp.yaw;
        const pi = { ...inp, jump: edge.jump, roll: edge.roll };
        p.vy = p.vy || 0;
        movePlayer(p, pi, dt);
      }
      inT -= dt;
      if (inT <= 0 || edge.jump || edge.pick || edge.swap || edge.roll || edge.slot >= 0) {
        inT = 1 / 30;
        NET.host.open && NET.host.send({ t: 'in', ...inp, sp: inp.sprint, bk: inp.block, rl: edge.roll, j: edge.jump, pk: edge.pick, sw: edge.swap, sl: edge.slot, x: r2(p.x), z: r2(p.z) });
      }
    }
    edge.jump = edge.pick = edge.swap = edge.roll = false; edge.slot = -1;

    // views
    const seen = new Set();
    for (const q of S.players.values()) {
      if (q.x === undefined || !q.name) continue;
      seen.add(q.id);
      let v = views.get(q.id);
      if (!v) { v = new View(q); views.set(q.id, v); }
      v.update(q, dt, q.id === S.myId);
    }
    for (const [id, v] of views) if (!seen.has(id)) { v.dispose(); views.delete(id); }
    syncArrows(isHost ? S.arrows.map(a => [a.x, a.y, a.z, a.vx, a.vy, a.vz]) : S.arrows);
    zoneWall.scale.set(Math.max(0.01, S.zone.r), 1, Math.max(0.01, S.zone.r));
    zoneWall.position.set(S.zone.x, 20, S.zone.z);
    drawHUD();

    // camera
    let focus = p;
    if (p && !p.alive) {
      if (!spectating || !spectating.alive) spectating = [...S.players.values()].find(q => q.alive) || p;
      focus = spectating;
    }
    if (focus) {
      const v = views.get(focus.id);
      const fx_ = v ? v.x : focus.x, fy = v ? v.y : focus.y, fz = v ? v.z : focus.z;
      const yaw = focus === p ? camYaw : (v ? v.yaw : focus.yaw), pitch = focus === p ? camPitch : 0.3;
      const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
      camTarget.set(fx_, fy + 1.65, fz);
      const dist = focus === p ? 3.6 : 6;
      const cp = camTarget.clone().addScaledVector(dir, -dist).addScaledVector(right, focus === p ? 0.65 : 0);
      cp.y = Math.max(cp.y, H(cp.x, cp.z) + 0.4);
      camera.position.copy(cp);
      if (shakeT > 0) { shakeT -= dt; camera.position.x += (Math.random() - 0.5) * 0.15; camera.position.y += (Math.random() - 0.5) * 0.15; }
      camera.lookAt(cp.clone().addScaledVector(dir, 20));
      sun.position.set(fx_ - 30, 60, fz - 25); sun.target.position.set(fx_, fy, fz);
    }
  } else {
    // menu / lobby: orbit around preview warrior
    const a = time * 0.12;
    const v = views.get(-1);
    if (v && S.preview) {
      const pp = S.preview;
      if (Math.floor(time / 2.2) !== pp._last) { pp._last = Math.floor(time / 2.2); pp.atk++; pp.w = ['sword', 'machete', 'spear', 'mace', 'bow'][pp._last % 5]; }
      v.update(pp, dt, true);
    }
    camera.position.set(Math.sin(a) * 6, H(0, 12) + 2.2, 12 + Math.cos(a) * 6);
    camera.lookAt(0, H(0, 12) + 1.2, 12);
    sun.position.set(-30, 60, -13); sun.target.position.set(0, 0, 12);
    zoneWall.scale.set(ISLAND_R + 20, 1, ISLAND_R + 20);
  }
  for (const [id, g] of lootViews) { g.userData.item.rotation.y += dt * 1.5; g.userData.item.position.y = Math.sin(time * 2 + g.userData.ph) * 0.12; }
  updateFx(dt); updateDmgNumbers(dt);
  if (centerT > 0) { centerT -= dt; if (centerT <= 0) $('center').style.opacity = 0; }
  renderer.render(scene, camera);
}
frame();
window.__S = S; window.__H = H_; window.__step = hostStep; window.__views = views; window.__world = () => world; window.__camera = camera; window.__cp = () => [camYaw, camPitch];
