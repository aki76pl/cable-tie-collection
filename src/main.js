import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { MODELS, COPIES_FIELD, generate, sanitize } from './generate.js';
import { toSTL, to3MF } from './export.js';

const STORAGE_KEY = 'cable-tie-collection:v1';
const TPU_DENSITY = 1.21; // g/cm³
const COLORS = ['#14b8a6', '#ec4899', '#1e3a5f', '#22c55e', '#f87171', '#9ca3af', '#f59e0b'];

// ---------- Stan (osobne parametry dla każdego modelu) ----------
function loadState() {
  const fresh = { model: MODELS[0].id, color: COLORS[0], params: {} };
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...fresh, ...s, params: { ...(s.params || {}) } };
  } catch { return fresh; }
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* brak dostępu */ }
}

const state = loadState();
let model = MODELS.find((m) => m.id === state.model) || MODELS[0];
const params = () => (state.params[model.id] = sanitize(model, state.params[model.id]));

// ---------- Panel ----------
function buildModelTabs() {
  const nav = document.getElementById('models');
  nav.innerHTML = '';
  for (const m of MODELS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = m.name;
    b.classList.toggle('on', m === model);
    b.addEventListener('click', () => {
      if (m === model) return;
      model = m;
      state.model = m.id;
      buildModelTabs();
      buildControls();
      saveState();
      if (wasm) regenerate(); // od razu, żeby kamera kadrowała już nowy model
      setView('iso');
    });
    nav.appendChild(b);
  }
  document.getElementById('model-desc').innerHTML =
    `<p>${model.description}</p><p class="hint">${model.printHint}</p>`;
}

function buildControls() {
  const form = document.getElementById('controls');
  form.innerHTML = '';
  const p = params();
  const sections = [...model.sections, { title: 'Wydruk', fields: [COPIES_FIELD, { key: 'color', label: 'Kolor podglądu', type: 'color' }] }];
  for (const section of sections) {
    const fs = document.createElement('fieldset');
    fs.innerHTML = `<legend>${section.title}</legend>`;
    for (const f of section.fields) fs.appendChild(f.type ? buildChoice(f, p) : buildNumber(f, p));
    form.appendChild(fs);
  }
}

function buildChoice(f, p) {
  const isColor = f.type === 'color';
  const row = document.createElement('div');
  row.className = 'field';
  row.innerHTML = `<label>${f.label}</label><div class="seg ${f.type}"></div>`;
  const seg = row.querySelector('.seg');
  const options = isColor ? COLORS.map((c) => [c, '']) : f.options;
  const current = () => (isColor ? state.color : params()[f.key]);
  const buttons = options.map(([val, text]) => {
    const b = document.createElement('button');
    b.type = 'button';
    if (isColor) { b.style.background = val; b.title = val; b.setAttribute('aria-label', val); }
    else b.textContent = text;
    b.addEventListener('click', () => {
      if (isColor) state.color = val; else params()[f.key] = val;
      buttons.forEach((x, i) => x.classList.toggle('on', options[i][0] === current()));
      update();
    });
    seg.appendChild(b);
    return b;
  });
  buttons.forEach((x, i) => x.classList.toggle('on', options[i][0] === current()));
  return row;
}

function buildNumber(f, p) {
  const row = document.createElement('div');
  row.className = 'field';
  row.innerHTML = `
    <div class="field-head">
      <label for="in-${f.key}">${f.label}${f.hint ? `<small>${f.hint}</small>` : ''}</label>
      <span class="num"><input id="in-${f.key}" type="number" min="${f.min}" max="${f.max}" step="${f.step}"><em>${f.unit}</em></span>
    </div>
    <input type="range" min="${f.min}" max="${f.max}" step="${f.step}" aria-label="${f.label}">`;
  const num = row.querySelector('input[type=number]');
  const range = row.querySelector('input[type=range]');
  num.value = range.value = p[f.key];
  const onInput = (src) => {
    const v = parseFloat(src.value);
    if (Number.isNaN(v)) return;
    const val = Math.min(f.max, Math.max(f.min, v));
    params()[f.key] = val;
    if (src === range) num.value = val; else range.value = val;
    update();
  };
  range.addEventListener('input', () => onInput(range));
  num.addEventListener('input', () => onInput(num));
  num.addEventListener('change', () => { num.value = range.value = params()[f.key]; });
  return row;
}

// ---------- Scena 3D ----------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.12;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-120, -160, 260);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -250, right: 250, top: 250, bottom: -250, near: 1, far: 800 });
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: 0.18 }));
ground.receiveShadow = true;
ground.position.z = -0.01;
scene.add(ground);
let grid;
function buildGrid() {
  if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  grid = new THREE.GridHelper(400, 40, dark ? 0x3f4a56 : 0xb9c2cc, dark ? 0x2a323b : 0xdde3e9);
  grid.rotation.x = Math.PI / 2;
  scene.add(grid);
}
buildGrid();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', buildGrid);

const material = new THREE.MeshStandardMaterial({ color: state.color, roughness: 0.55, metalness: 0.02 });
const tieMesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
tieMesh.castShadow = true;
tieMesh.receiveShadow = true;
scene.add(tieMesh);

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas.parentElement;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);

function setView(kind) {
  // Odległość tak, by sfera otaczająca model zmieściła się w węższym z kątów widzenia.
  const [sx, sy, sz] = result ? result.size : [180, 30, 6];
  const radius = Math.hypot(sx, sy, sz) / 2 + 5;
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const r = radius / Math.sin(Math.min(vfov, hfov) / 2);
  const dirs = { iso: [0.55, -0.9, 0.75], top: [0, -0.001, 1], side: [0, -1, 0.12] };
  controls.target.set(0, 0, sz / 2);
  camera.position.copy(new THREE.Vector3(...dirs[kind]).normalize().multiplyScalar(r)).add(controls.target);
  controls.update();
}
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

(function loop() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
})();

// ---------- Generowanie ----------
let wasm = null;
let result = null;
let pending = false;

function update() {
  saveState();
  material.color.set(state.color);
  if (!wasm || pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; regenerate(); });
}

function regenerate() {
  try {
    result = generate(wasm, model, params());
  } catch (e) {
    console.error(e);
    showWarnings([`Błąd generowania: ${e.message || e}`]);
    return;
  }
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(result.positions, 3));
  geo = toCreasedNormals(geo, THREE.MathUtils.degToRad(35));
  tieMesh.geometry.dispose();
  tieMesh.geometry = geo;

  const [sx, sy, sz] = result.size;
  const vol = result.volume / 1000;
  const dims = `${sx.toFixed(1)} × ${sy.toFixed(1)} × ${sz.toFixed(1)} mm`;
  const rows = [
    ['Wymiary', dims],
    ...result.info,
    ['Objętość', `${vol.toFixed(2)} cm³`],
    ['Masa (TPU)', `${(vol * TPU_DENSITY).toFixed(1)} g`],
    ['Trójkąty', result.triangles.toLocaleString('pl-PL')],
  ];
  document.getElementById('stats').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  document.getElementById('dims').textContent = dims;
  showWarnings(result.warnings);
}

function showWarnings(list) {
  document.getElementById('warnings').innerHTML = list.map((w) => `<li>${w}</li>`).join('');
}

function fileName(ext) {
  const p = result.params;
  return `opaska_${model.id}_${p.length}x${p.width}mm${p.copies > 1 ? `_x${p.copies}` : ''}.${ext}`;
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

document.getElementById('dl-stl').addEventListener('click', () => {
  if (result) download(toSTL(result.positions, fileName('stl')), fileName('stl'));
});
document.getElementById('dl-3mf').addEventListener('click', () => {
  if (result) download(to3MF(result.vertProperties, result.numProp, result.triVerts, `Opaska ${model.name}`), fileName('3mf'));
});
document.getElementById('reset').addEventListener('click', () => {
  state.params[model.id] = { ...model.defaults };
  buildControls();
  update();
  setView('iso');
});

buildModelTabs();
buildControls();
resize();
setView('iso');

Module({ locateFile: () => wasmUrl }).then((m) => {
  m.setup();
  m.setMinCircularAngle(6);
  m.setMinCircularEdgeLength(0.25);
  wasm = m;
  document.getElementById('loading').remove();
  regenerate();
  setView('iso');
}).catch((e) => {
  document.getElementById('loading').textContent = `Nie udało się załadować silnika geometrii: ${e.message || e}`;
});
