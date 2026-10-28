import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import {
  MODELS, COPIES_FIELD, MATERIALS, NOZZLES,
  generate, generateSheet, testPlan, sanitize, sectionsOf, applyProfile,
} from './generate.js';
import { toSTL, to3MF } from './export.js';
import { APP_VERSION, RELEASES_URL, checkForUpdate } from './updates.js';

const STORAGE_KEY = 'cable-tie-collection:v1';
const PAGES_URL = 'https://aki76pl.github.io/cable-tie-collection/';
const DENSITY = { tpu: 1.21, petg: 1.27, pla: 1.24 }; // g/cm³
const COLORS = ['#14b8a6', '#ec4899', '#1e3a5f', '#22c55e', '#f87171', '#9ca3af', '#f59e0b'];
const fmt = (v) => String(+(+v).toFixed(2)).replace('.', ',');
const $ = (id) => document.getElementById(id);
const byId = (id) => MODELS.find((m) => m.id === id);

// ---------- Stan (osobne parametry dla każdego modelu) ----------
function loadState() {
  const fresh = {
    model: MODELS[0].id, color: COLORS[0], params: {},
    profile: { material: 'tpu', nozzle: 0.4 }, presets: [], sheet: [], bed: { x: 220, y: 220 },
    updates: { auto: true, dismissed: '' },
  };
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...fresh, ...s, params: { ...(s.params || {}) }, profile: { ...fresh.profile, ...(s.profile || {}) }, updates: { ...fresh.updates, ...(s.updates || {}) }, bed: { ...fresh.bed, ...(s.bed || {}) } };
  } catch { return fresh; }
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* brak dostępu */ }
}

const state = loadState();
let mode = 'model';
let model = byId(state.model) || MODELS[0];
const params = () => (state.params[model.id] = sanitize(model, state.params[model.id]));

// Ustawienia z linku (#m=ratchet&length=180…) mają pierwszeństwo przed zapisanymi.
(function readLink() {
  if (!location.hash.includes('m=')) return;
  const q = new URLSearchParams(location.hash.slice(1));
  const m = byId(q.get('m'));
  if (!m) return;
  q.delete('m');
  model = m;
  state.model = m.id;
  state.params[m.id] = sanitize(m, Object.fromEntries(q));
  history.replaceState(null, '', location.pathname + location.search);
})();

function setStatus(id, text) {
  const el = $(id);
  el.textContent = text;
  clearTimeout(el._t);
  if (text) el._t = setTimeout(() => { el.textContent = ''; }, 6000);
}

// ---------- Panel: modele i parametry ----------
function buildModelTabs() {
  const nav = $('models');
  nav.innerHTML = '';
  for (const m of MODELS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = m.name;
    b.classList.toggle('on', m === model);
    b.addEventListener('click', () => selectModel(m));
    nav.appendChild(b);
  }
  $('model-desc').innerHTML = `<p>${model.description}</p><p class="hint">${model.printHint}</p>`;
  $('fit').hidden = !model.fit;
}

function selectModel(m) {
  if (m === model) return;
  model = m;
  state.model = m.id;
  buildModelTabs();
  buildControls();
  saveState();
  if (wasm) regenerate(); // od razu, żeby kamera kadrowała już nowy model
  setView('iso');
}

function buildControls() {
  const form = $('controls');
  form.innerHTML = '';
  const p = params();
  const sections = [...sectionsOf(model), { title: 'Wydruk', fields: [COPIES_FIELD, { key: 'color', label: 'Kolor podglądu', type: 'color' }] }];
  for (const section of sections) {
    const fs = document.createElement('fieldset');
    fs.innerHTML = `<legend>${section.title}</legend>`;
    for (const f of section.fields) {
      fs.appendChild(f.type === 'text' ? buildText(f, p) : f.type ? buildChoice(f, p) : buildNumber(f, p));
    }
    form.appendChild(fs);
  }
}

function buildChoice(f) {
  const isColor = f.type === 'color';
  const row = document.createElement('div');
  row.className = 'field';
  row.innerHTML = `<label>${f.label}</label><div class="seg ${f.type}"></div>`;
  const options = isColor ? COLORS.map((c) => [c, '']) : f.options;
  const current = () => (isColor ? state.color : params()[f.key]);
  segButtons(row.querySelector('.seg'), options, current, (val) => {
    if (isColor) state.color = val; else params()[f.key] = val;
    update();
  }, isColor);
  return row;
}

// Rząd przycisków jednokrotnego wyboru.
function segButtons(seg, options, current, onPick, isColor = false) {
  seg.innerHTML = '';
  const buttons = options.map(([val, text]) => {
    const b = document.createElement('button');
    b.type = 'button';
    if (isColor) { b.style.background = val; b.title = val; b.setAttribute('aria-label', val); } else b.textContent = text;
    b.addEventListener('click', () => {
      onPick(val);
      buttons.forEach((x, i) => x.classList.toggle('on', options[i][0] === current()));
    });
    seg.appendChild(b);
    return b;
  });
  buttons.forEach((x, i) => x.classList.toggle('on', options[i][0] === current()));
}

function buildText(f, p) {
  const row = document.createElement('div');
  row.className = 'field';
  row.innerHTML = `<label for="in-${f.key}">${f.label}</label><input class="text" id="in-${f.key}" type="text" maxlength="${f.max}" placeholder="${f.placeholder || ''}">`;
  const input = row.querySelector('input');
  input.value = p[f.key];
  input.addEventListener('input', () => { params()[f.key] = input.value; update(); });
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

// Krótki opis zmian parametrów, np. „Długość paska: 108 mm”.
function describePatch(m, before, after) {
  const fields = sectionsOf(m).flatMap((s) => s.fields);
  return fields.filter((f) => before[f.key] !== after[f.key])
    .map((f) => `${f.label}: ${f.type ? after[f.key] : fmt(after[f.key])}${f.unit ? ` ${f.unit}` : ''}`)
    .join(', ');
}

// ---------- Profil ----------
function buildProfile() {
  const pr = state.profile;
  segButtons($('pr-material'), MATERIALS.map(([id, name]) => [id, name]), () => pr.material, (v) => { pr.material = v; update(); });
  segButtons($('pr-nozzle'), NOZZLES, () => pr.nozzle, (v) => { pr.nozzle = v; update(); });
}
$('pr-apply').addEventListener('click', () => {
  const before = params();
  const after = applyProfile(model, before, state.profile);
  state.params[model.id] = after;
  buildControls();
  update();
  setStatus('pr-status', describePatch(model, before, after) || 'Parametry już pasują do profilu.');
});

// ---------- Dopasowanie do wiązki ----------
$('fit-apply').addEventListener('click', () => {
  const d = parseFloat($('fit-d').value);
  if (!model.fit || !(d > 0)) return;
  const before = params();
  const after = sanitize(model, { ...before, ...model.fit(before, d) });
  state.params[model.id] = after;
  buildControls();
  update();
  setStatus('fit-status', describePatch(model, before, after) || 'Model już pasuje do tej średnicy.');
});

// ---------- Presety i link ----------
function buildPresetList() {
  const sel = $('preset-list');
  sel.innerHTML = state.presets.length
    ? state.presets.map((pr, i) => `<option value="${i}">${byId(pr.model)?.name ?? pr.model}: ${escapeHtml(pr.name)}</option>`).join('')
    : '<option value="">Brak zapisanych presetów</option>';
  const own = state.presets.findIndex((pr) => pr.model === model.id);
  if (own >= 0) sel.value = String(own);
}
const escapeHtml = (t) => String(t).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

$('preset-save').addEventListener('click', () => {
  const name = $('preset-name').value.trim() || `Preset ${state.presets.length + 1}`;
  const entry = { name, model: model.id, params: { ...params() } };
  const i = state.presets.findIndex((pr) => pr.model === model.id && pr.name === name);
  if (i >= 0) state.presets[i] = entry; else state.presets.push(entry);
  saveState();
  buildPresetList();
  $('preset-list').value = String(i >= 0 ? i : state.presets.length - 1);
  setStatus('preset-status', `Zapisano „${name}”.`);
});
$('preset-load').addEventListener('click', () => {
  const pr = state.presets[+$('preset-list').value];
  const m = pr && byId(pr.model);
  if (!m) return;
  state.params[m.id] = sanitize(m, pr.params);
  if (m !== model) selectModel(m); else { buildControls(); update(); }
  setStatus('preset-status', `Wczytano „${pr.name}”.`);
});
$('preset-del').addEventListener('click', () => {
  const i = +$('preset-list').value;
  const pr = state.presets[i];
  if (!pr) return;
  state.presets.splice(i, 1);
  saveState();
  buildPresetList();
  setStatus('preset-status', `Usunięto „${pr.name}”.`);
});
$('preset-export').addEventListener('click', () => {
  const data = JSON.stringify({ app: 'kolekcja-opasek', version: 1, presets: state.presets }, null, 2);
  download(new Blob([data], { type: 'application/json' }), 'presety-opasek.json');
});
$('preset-import').addEventListener('click', () => $('preset-file').click());
$('preset-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    let n = 0;
    for (const pr of data.presets || []) {
      const m = byId(pr.model);
      if (!m || typeof pr.name !== 'string') continue;
      const entry = { name: pr.name.slice(0, 40), model: m.id, params: sanitize(m, pr.params) };
      const i = state.presets.findIndex((x) => x.model === m.id && x.name === entry.name);
      if (i >= 0) state.presets[i] = entry; else state.presets.push(entry);
      n++;
    }
    saveState();
    buildPresetList();
    setStatus('preset-status', `Zaimportowano ${n} presetów.`);
  } catch {
    setStatus('preset-status', 'Nie udało się odczytać pliku z presetami.');
  }
});
$('preset-link').addEventListener('click', async () => {
  const p = params();
  const d = sanitize(model, {});
  const q = new URLSearchParams({ m: model.id });
  for (const [k, v] of Object.entries(p)) if (v !== d[k] && !k.startsWith('_')) q.set(k, v);
  const base = location.protocol.startsWith('http') ? location.origin + location.pathname : PAGES_URL;
  const link = `${base}#${q}`;
  const out = $('link-out');
  out.value = link;
  out.hidden = false;
  out.select();
  try {
    await navigator.clipboard.writeText(link);
    setStatus('preset-status', 'Link skopiowany do schowka.');
  } catch {
    setStatus('preset-status', 'Skopiuj link z pola powyżej.');
  }
});

// ---------- Arkusz ----------
function sheetLabel(e) {
  const m = byId(e.model);
  const p = sanitize(m, e.params);
  const size = p.length ? `${p.length} mm` : p.deskThickness ? `blat ${p.deskThickness} mm` : '';
  return [m.name, size, p.labelText && `„${p.labelText}”`].filter(Boolean).join(' · ');
}
function buildSheet() {
  const list = $('sheet-list');
  list.innerHTML = '';
  state.sheet = state.sheet.filter((e) => byId(e.model));
  state.sheet.forEach((e, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(sheetLabel(e))}</span>
      <button type="button" data-d="-1" aria-label="Mniej">−</button><b>${e.count}</b>
      <button type="button" data-d="1" aria-label="Więcej">+</button>
      <button type="button" data-x aria-label="Usuń z arkusza">✕</button>`;
    li.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => {
      e.count = Math.min(50, Math.max(1, e.count + +b.dataset.d));
      buildSheet(); update();
    }));
    li.querySelector('[data-x]').addEventListener('click', () => { state.sheet.splice(i, 1); buildSheet(); update(); });
    list.appendChild(li);
  });
  const total = state.sheet.reduce((s, e) => s + e.count, 0);
  document.querySelector('[data-mode="sheet"]').textContent = total ? `Arkusz (${total})` : 'Arkusz';
  $('sheet-clear').hidden = !state.sheet.length;
  $('bed-x').value = state.bed.x;
  $('bed-y').value = state.bed.y;
}
$('sheet-add').addEventListener('click', () => {
  const p = { ...params() };
  const copies = p.copies;
  delete p.copies;
  state.sheet.push({ model: model.id, params: p, count: copies });
  buildSheet();
  update();
});
$('sheet-clear').addEventListener('click', () => { state.sheet = []; buildSheet(); update(); });
for (const k of ['x', 'y']) {
  $(`bed-${k}`).addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (v >= 50 && v <= 1000) { state.bed[k] = v; update(); }
  });
}

// ---------- Aktualizacje (tylko aplikacja na Windows; wersja web jest zawsze aktualna) ----------
const isDesktop = location.protocol === 'app:';
$('app-version').textContent = APP_VERSION;
$('upd-auto').checked = state.updates.auto;
$('upd-auto').addEventListener('change', (e) => { state.updates.auto = e.target.checked; saveState(); });

function showUpdateBanner(info) {
  $('update-text').textContent = `Dostępna jest nowa wersja ${info.version} (masz ${APP_VERSION}).`;
  $('update-link').href = info.url;
  $('update-banner').hidden = false;
}
$('update-close').addEventListener('click', () => {
  $('update-banner').hidden = true;
  state.updates.dismissed = $('update-text').dataset.version || '';
  saveState();
});

async function runUpdateCheck(manual) {
  if (manual) setStatus('upd-status', 'Sprawdzam…');
  try {
    const info = await checkForUpdate();
    if (!info.newer) {
      if (manual) setStatus('upd-status', `Masz najnowszą wersję (${APP_VERSION}).`);
      return;
    }
    $('update-text').dataset.version = info.version;
    if (manual) setStatus('upd-status', `Dostępna jest wersja ${info.version}.`);
    // Przy automatycznym sprawdzaniu nie przypominamy o wersji, którą użytkownik już zamknął.
    if (!manual && state.updates.dismissed === info.version) return;
    showUpdateBanner(info);
    if (!manual && 'Notification' in window && Notification.permission !== 'denied') {
      const n = new Notification('Kolekcja Opasek — aktualizacja', {
        body: `Dostępna jest wersja ${info.version}. Kliknij, aby otworzyć stronę pobierania.`,
        icon: './icon.svg',
      });
      n.onclick = () => window.open(info.url || RELEASES_URL, '_blank');
    }
  } catch {
    if (manual) setStatus('upd-status', 'Nie udało się sprawdzić aktualizacji. Sprawdź połączenie z internetem.');
  }
}
$('upd-check').addEventListener('click', () => runUpdateCheck(true));
if (isDesktop) {
  $('updates').hidden = false;
  if (state.updates.auto) setTimeout(() => runUpdateCheck(false), 3000);
}

// ---------- Scena 3D ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

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
const dark = () => matchMedia('(prefers-color-scheme: dark)').matches;
function buildGrid() {
  if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
  grid = new THREE.GridHelper(400, 40, dark() ? 0x3f4a56 : 0xb9c2cc, dark() ? 0x2a323b : 0xdde3e9);
  grid.rotation.x = Math.PI / 2;
  scene.add(grid);
}
buildGrid();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', buildGrid);

// Przekrój: płaszczyzna odcina część modelu, a tylne ścianki w ciemniejszym kolorze udają przekrój.
const cutPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const material = new THREE.MeshStandardMaterial({ color: state.color, roughness: 0.55, metalness: 0.02 });
const inside = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9, side: THREE.BackSide });
const tieMesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
tieMesh.castShadow = true;
tieMesh.receiveShadow = true;
const insideMesh = new THREE.Mesh(tieMesh.geometry, inside);
scene.add(tieMesh, insideMesh);

// Obrys stołu drukarki (w trybie testu i arkusza).
const bedLine = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x0d9488 }));
scene.add(bedLine);
function showBed(visible) {
  bedLine.visible = visible;
  if (!visible) return;
  const x = state.bed.x / 2, y = state.bed.y / 2;
  bedLine.geometry.setFromPoints([[-x, -y], [x, -y], [x, y], [-x, y]].map(([a, b]) => new THREE.Vector3(a, b, 0.05)));
}

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas.parentElement;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);

function setView(kind) {
  // Odległość tak, by sfera otaczająca model zmieściła się w węższym z kątów widzenia.
  const [sx, sy, sz] = result?.size ?? [180, 30, 6];
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

function applyCut() {
  const v = +$('cut').value;
  const planes = v > 0 && result ? [cutPlane] : [];
  if (planes.length) {
    const [, sy] = result.size;
    cutPlane.constant = -(-sy / 2 + (v / 100) * sy); // zostaje część y ≥ granica
  }
  material.clippingPlanes = inside.clippingPlanes = planes;
  insideMesh.visible = planes.length > 0;
}
$('cut').addEventListener('input', applyCut);

(function loop() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
})();

// ---------- Tryby podglądu ----------
function setMode(m) {
  mode = m;
  document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  if (wasm) regenerate();
  setView('iso');
}
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

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

function compute() {
  const pr = state.profile;
  if (mode === 'test') {
    const plan = testPlan(model, params());
    if (!plan) return { empty: 'Ten model nie ma zapięcia do przetestowania.' };
    const r = generateSheet(wasm, plan.entries, state.bed, pr);
    const vals = plan.values.map(fmt);
    r.info = [['Testowany parametr', plan.field.label], ['Warianty', `${vals.join(' / ')} ${plan.field.unit}`], ...r.info];
    r.note = model.label
      ? `Każda sztuka ma na pasku swoją wartość. Wydrukuj, sprawdź, które zapięcie trzyma najlepiej, i wpisz tę wartość w polu „${plan.field.label}”.`
      : `Liczba kropek oznacza wariant: ${vals.map((v, i) => `${i + 1} → ${v}`).join(', ')} ${plan.field.unit}. Wybierz najlepszy i wpisz go w polu „${plan.field.label}”.`;
    r.fileName = `test-luzow_${model.id}`;
    return r;
  }
  if (mode === 'sheet') {
    const entries = state.sheet.map((e) => ({ model: byId(e.model), params: e.params, count: e.count }));
    if (!entries.length) return { empty: 'Arkusz jest pusty. Ustaw model i kliknij „Dodaj bieżący model do arkusza”.' };
    const r = generateSheet(wasm, entries, state.bed, pr);
    r.fileName = `arkusz_${entries.reduce((s, e) => s + e.count, 0)}szt`;
    return r;
  }
  const r = generate(wasm, model, params(), pr);
  const p = r.params;
  const slug = p.labelText ? `_${p.labelText.trim().replace(/[^A-Z0-9ĄĆĘŁŃÓŚŹŻ]+/g, '-')}` : '';
  r.fileName = `${model.id === 'clip' ? `klips_blat${p.deskThickness}mm` : `opaska_${model.id}_${p.length}x${p.width}mm`}${slug}${p.copies > 1 ? `_x${p.copies}` : ''}`;
  return r;
}

function regenerate() {
  let r;
  try {
    r = compute();
  } catch (e) {
    console.error(e);
    showWarnings([`Błąd generowania: ${e.message || e}`]);
    return;
  }
  showBed(mode !== 'model');
  $('mode-note').textContent = r.empty || r.note || '';
  $('mode-note').hidden = !(r.empty || r.note);
  if (r.empty) {
    result = null;
    tieMesh.geometry.dispose();
    tieMesh.geometry = insideMesh.geometry = new THREE.BufferGeometry();
    $('stats').innerHTML = '';
    $('dims').textContent = '';
    showWarnings([]);
    return;
  }
  result = r;
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(r.positions, 3));
  geo = toCreasedNormals(geo, THREE.MathUtils.degToRad(35));
  tieMesh.geometry.dispose();
  tieMesh.geometry = insideMesh.geometry = geo;
  applyCut();

  const [sx, sy, sz] = r.size;
  const vol = r.volume / 1000;
  const mat = MATERIALS.find((m) => m[0] === state.profile.material) || MATERIALS[0];
  const dims = `${sx.toFixed(1)} × ${sy.toFixed(1)} × ${sz.toFixed(1)} mm`;
  const rows = [
    ['Wymiary', dims],
    ...r.info,
    ['Objętość', `${vol.toFixed(2)} cm³`],
    [`Masa (${mat[1]})`, `${(vol * DENSITY[mat[0]]).toFixed(1)} g`],
    ['Trójkąty', r.triangles.toLocaleString('pl-PL')],
  ];
  $('stats').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${escapeHtml(v)}</b></div>`).join('');
  $('dims').textContent = dims;
  showWarnings(r.warnings);
}

function showWarnings(list) {
  $('warnings').innerHTML = list.map((w) => `<li>${escapeHtml(w)}</li>`).join('');
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

$('dl-stl').addEventListener('click', () => {
  if (result) download(toSTL(result.positions, result.fileName), `${result.fileName}.stl`);
});
$('dl-3mf').addEventListener('click', () => {
  if (result) download(to3MF(result.objects, mode === 'model' ? `Opaska ${model.name}` : result.fileName), `${result.fileName}.3mf`);
});
$('reset').addEventListener('click', () => {
  state.params[model.id] = sanitize(model, {});
  buildControls();
  update();
  setView('iso');
});

buildModelTabs();
buildProfile();
buildControls();
buildPresetList();
buildSheet();
document.querySelector('[data-mode="model"]').classList.add('on');
$('mode-note').hidden = true;
resize();
setView('iso');

Module({ locateFile: () => wasmUrl }).then((m) => {
  m.setup();
  m.setMinCircularAngle(6);
  m.setMinCircularEdgeLength(0.25);
  wasm = m;
  $('loading').remove();
  regenerate();
  setView('iso');
}).catch((e) => {
  $('loading').textContent = `Nie udało się załadować silnika geometrii: ${e.message || e}`;
});
