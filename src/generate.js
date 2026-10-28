import ratchet from './models/ratchet.js';
import barbed from './models/barbed.js';
import loop from './models/loop.js';
import mount from './models/mount.js';
import buckle from './models/buckle.js';
import multi from './models/multi.js';
import clip from './models/clip.js';
import { textSection, unsupportedChars, normalizeText, MAX_TEXT } from './font.js';

export const MODELS = [ratchet, barbed, loop, buckle, mount, multi, clip];
export const COPIES_FIELD = { key: 'copies', label: 'Ilość sztuk', unit: 'szt.', min: 1, max: 20, step: 1 };

// Sekcja napisu dokładana do modeli, które mają na pasku miejsce na tekst.
const LABEL_DEFAULTS = { labelText: '', labelSize: 5, labelStyle: 'raised', labelDepth: 0.6 };
const LABEL_SECTION = { title: 'Napis', fields: [
  { key: 'labelText', label: 'Tekst', type: 'text', max: MAX_TEXT, placeholder: 'np. TV, ROUTER, 3' },
  { key: 'labelSize', label: 'Wysokość liter', unit: 'mm', min: 2.5, max: 12, step: 0.5 },
  { key: 'labelStyle', label: 'Rodzaj', type: 'choice', options: [['raised', 'Wypukły'], ['engraved', 'Wklęsły']] },
  { key: 'labelDepth', label: 'Wysokość / głębokość', unit: 'mm', min: 0.2, max: 1.2, step: 0.05 },
]};

// Profile materiału: bazowy luz zapięć (na stronę) i ostrzeżenia modeli.
export const MATERIALS = [['tpu', 'TPU 95A', 0.25], ['petg', 'PETG', 0.3], ['pla', 'PLA', 0.2]];
export const NOZZLES = [[0.4, '0,4 mm'], [0.6, '0,6 mm']];
export const profileClearance = (pr) => (MATERIALS.find((m) => m[0] === pr.material) || MATERIALS[0])[2] + (pr.nozzle > 0.4 ? 0.05 : 0);

const COPY_GAP = 4;   // odstęp między kopiami [mm]
const SHEET_GAP = 5;  // odstęp między elementami arkusza [mm]

export const sectionsOf = (model) => (model.label ? [...model.sections, LABEL_SECTION] : model.sections);
const fieldsOf = (model) => sectionsOf(model).flatMap((s) => s.fields);

// Przycina wartości do zakresów pól modelu (wejście może pochodzić z linku lub pliku).
export function sanitize(model, input) {
  const base = { ...model.defaults, ...(model.label ? LABEL_DEFAULTS : {}) };
  const p = { ...base, ...input };
  for (const f of fieldsOf(model)) {
    if (f.type === 'choice') {
      const hit = f.options.find(([v]) => String(v) === String(p[f.key]));
      p[f.key] = hit ? hit[0] : base[f.key];
    } else if (f.type === 'text') {
      p[f.key] = normalizeText(p[f.key]);
    } else {
      const v = Number(p[f.key]);
      p[f.key] = Number.isFinite(v) ? Math.min(f.max, Math.max(f.min, v)) : base[f.key];
    }
  }
  p.copies = Math.round(Math.min(COPIES_FIELD.max, Math.max(1, Number(p.copies) || 1)));
  return p;
}

// Ustawia luzy i minimalne grubości modelu według profilu; zwraca nowe parametry.
export function applyProfile(model, input, pr) {
  const p = { ...input };
  const c = profileClearance(pr);
  for (const f of fieldsOf(model)) {
    if (f.role === 'clearance') p[f.key] = Math.min(f.max, Math.max(f.min, Math.round(c / f.step) * f.step));
    if (f.role === 'thin') p[f.key] = Math.max(p[f.key], 2 * pr.nozzle);
  }
  return sanitize(model, p);
}

function profileWarnings(model, p, pr) {
  if (!pr) return [];
  const out = [];
  const msg = model.materials?.[pr.material];
  if (msg) out.push(msg);
  for (const f of fieldsOf(model)) {
    if (f.role === 'thin' && p[f.key] < 2 * pr.nozzle - 1e-6) {
      out.push(`${f.label} (${p[f.key]} mm) to mniej niż 2 ścieżki dyszy ${String(pr.nozzle).replace('.', ',')} mm.`);
    }
  }
  return out;
}

// Buduje jedną sztukę modelu razem z napisem.
function buildOne(wasm, model, p, track) {
  const { CrossSection: CS, Manifold } = wasm;
  const warnings = [];
  let text = null, len = 0;
  if (model.label && p.labelText.trim()) {
    const bad = unsupportedChars(p.labelText);
    if (bad.length) warnings.push(`Napis: pominięto znaki ${bad.join(' ')}`);
    text = textSection(CS, p.labelText, p.labelSize, track);
    if (text) { const b = text.bounds(); len = b.max[0] - b.min[0]; }
  }
  const out = model.build(wasm, { ...p, labelLen: len }, track);
  warnings.push(...out.warnings);
  let solid = out.solid;

  if (text && out.label) {
    const z = out.label; // { x, z, width } — środek pola na napis i dostępna szerokość
    const b = text.bounds();
    const avail = z.width - 1.6;
    const th = b.max[1] - b.min[1];
    if (th > avail) {
      const size = Math.max(1.5, p.labelSize * avail / th);
      text = textSection(CS, p.labelText, size, track);
      warnings.push(`Napis zmniejszony do ${size.toFixed(1)} mm, żeby zmieścił się na pasku.`);
    }
    if (p.labelStyle === 'raised') {
      const s = track(track(text.extrude(p.labelDepth + 0.01)).translate([z.x, 0, z.z - 0.01]));
      solid = track(Manifold.union([solid, s]));
    } else {
      const d = Math.min(p.labelDepth, z.z - 0.4);
      if (d < p.labelDepth - 1e-6) warnings.push(`Głębokość napisu ograniczona do ${Math.max(0, d).toFixed(2)} mm, żeby zostało 0,4 mm materiału.`);
      if (d > 0.05) {
        const s = track(track(text.extrude(d + 1)).translate([z.x, 0, z.z - d]));
        solid = track(solid.subtract(s));
      }
    }
  } else if (text) {
    warnings.push('Ten model nie ma miejsca na napis.');
  }
  return { solid, warnings, info: out.info };
}

// Przesuwa bryłę tak, by stała na Z = 0 ze środkiem obrysu w (0, 0).
function centered(man, track) {
  const b = man.boundingBox();
  return track(man.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2, -b.min[2]]));
}

// Zamienia listę brył (osobne obiekty) na dane do podglądu i eksportu.
function finish(wasm, mans, meta, track) {
  const all = track(wasm.Manifold.compose(mans));
  const objects = mans.map((m) => {
    const mesh = m.getMesh();
    return { vertProperties: mesh.vertProperties.slice(), numProp: mesh.numProp, triVerts: mesh.triVerts.slice() };
  });
  let n = 0;
  for (const o of objects) n += o.triVerts.length;
  const positions = new Float32Array(n * 3);
  let k = 0;
  for (const o of objects) {
    const { vertProperties: vp, numProp: np, triVerts: tv } = o;
    for (let i = 0; i < tv.length; i++) {
      const v = tv[i] * np;
      positions[k++] = vp[v]; positions[k++] = vp[v + 1]; positions[k++] = vp[v + 2];
    }
  }
  const box = all.boundingBox();
  return {
    ...meta,
    objects, positions,
    triangles: n / 3,
    volume: mans.reduce((s, m) => s + m.volume(), 0),
    size: [0, 1, 2].map((i) => box.max[i] - box.min[i]),
    status: all.status(),
  };
}

function withGarbage(fn) {
  const garbage = new Set(); // Set: ten sam obiekt może zostać zarejestrowany kilka razy
  const track = (o) => { garbage.add(o); return o; };
  try { return fn(track); } finally { for (const o of garbage) o.delete(); }
}

// Pojedynczy model (z kopiami ułożonymi obok siebie w osi Y).
export function generate(wasm, model, input, profile) {
  const p = sanitize(model, input);
  return withGarbage((track) => {
    const one = buildOne(wasm, model, p, track);
    const solid = centered(one.solid, track);
    const b = solid.boundingBox();
    const sy = b.max[1] - b.min[1];
    const mans = [];
    for (let i = 0; i < p.copies; i++) mans.push(track(solid.translate([0, (i - (p.copies - 1) / 2) * (sy + COPY_GAP), 0])));
    return finish(wasm, mans, {
      params: p,
      warnings: [...profileWarnings(model, p, profile), ...one.warnings],
      info: one.info,
    }, track);
  });
}

// Układanie półkowe: najdłuższe elementy najpierw, rzędy wzdłuż X, kolejne rzędy w +Y.
function pack(sizes, bed) {
  const order = sizes.map((_, i) => i).sort((a, b) => Math.max(...sizes[b]) - Math.max(...sizes[a]));
  const out = [];
  let x = 0, y = 0, row = 0, width = 0;
  for (const i of order) {
    let [sx, sy] = sizes[i];
    let rot = false;
    if (sx > bed.x && sy <= bed.x && sx <= bed.y) { rot = true; [sx, sy] = [sy, sx]; }
    if (x > 0 && x + sx > bed.x) { y += row + SHEET_GAP; x = 0; row = 0; }
    out[i] = { x, y, rot, sx, sy };
    x += sx + SHEET_GAP;
    row = Math.max(row, sy);
    width = Math.max(width, x - SHEET_GAP);
  }
  return { places: out, width, height: y + row };
}

// Arkusz: różne modele i parametry ułożone na stole drukarki o wymiarach bed {x, y}.
// entries: [{ model, params, count }]
export function generateSheet(wasm, entries, bed, profile) {
  return withGarbage((track) => {
    const warnings = new Set();
    const pieces = [];
    for (const e of entries) {
      const p = sanitize(e.model, e.params);
      const one = buildOne(wasm, e.model, p, track);
      for (const w of [...profileWarnings(e.model, p, profile), ...one.warnings]) warnings.add(`${e.model.name}: ${w}`);
      const solid = centered(one.solid, track);
      for (let i = 0; i < (e.count || 1); i++) pieces.push(solid);
    }
    if (!pieces.length) return null;
    const sizes = pieces.map((m) => { const b = m.boundingBox(); return [b.max[0] - b.min[0], b.max[1] - b.min[1]]; });
    const { places, width, height } = pack(sizes, bed);
    const mans = pieces.map((m, i) => {
      const pl = places[i];
      const r = pl.rot ? track(m.rotate([0, 0, 90])) : m;
      return track(r.translate([pl.x + pl.sx / 2 - width / 2, pl.y + pl.sy / 2 - height / 2, 0]));
    });
    if (width > bed.x + 1e-6 || height > bed.y + 1e-6) {
      warnings.add(`Elementy zajmują ${width.toFixed(0)} × ${height.toFixed(0)} mm i nie mieszczą się na stole ${bed.x} × ${bed.y} mm.`);
    }
    return finish(wasm, mans, {
      params: null,
      warnings: [...warnings],
      info: [['Elementy', `${pieces.length} szt.`], ['Zajęte miejsce', `${width.toFixed(0)} × ${height.toFixed(0)} mm`]],
    }, track);
  });
}

// Test luzów: kilka krótkich sztuk różniących się luzem zapięcia, z wartością na pasku.
export function testPlan(model, input) {
  const t = model.test || {};
  const field = fieldsOf(model).find((f) => (t.key ? f.key === t.key : f.role === 'clearance'));
  if (!field) return null;
  const values = (t.values || [0.1, 0.2, 0.3, 0.4, 0.5]).map((v) => Math.min(field.max, Math.max(field.min, v)));
  const fmt = (v) => String(+v.toFixed(2)).replace('.', ',');
  return {
    field,
    values,
    entries: values.map((v, i) => ({
      model,
      count: 1,
      params: { ...input, ...t.overrides, [field.key]: v, copies: 1, labelText: fmt(v), labelSize: 4, labelStyle: 'raised', labelDepth: 0.6, _index: i + 1 },
    })),
  };
}
