import ratchet from './models/ratchet.js';
import barbed from './models/barbed.js';
import mount from './models/mount.js';
import buckle from './models/buckle.js';

export const MODELS = [ratchet, barbed, mount, buckle];
export const COPIES_FIELD = { key: 'copies', label: 'Ilość sztuk', unit: 'szt.', min: 1, max: 20, step: 1 };

const COPY_GAP = 4; // odstęp między kopiami na stole [mm]

// Przycina wartości liczbowe do zakresów pól modelu.
export function sanitize(model, input) {
  const p = { ...model.defaults, ...input };
  for (const s of model.sections) {
    for (const f of s.fields) {
      if (f.type === 'choice') {
        if (!f.options.some(([v]) => v === p[f.key])) p[f.key] = model.defaults[f.key];
      } else {
        const v = Number(p[f.key]);
        p[f.key] = Number.isFinite(v) ? Math.min(f.max, Math.max(f.min, v)) : model.defaults[f.key];
      }
    }
  }
  p.copies = Math.round(Math.min(COPIES_FIELD.max, Math.max(1, Number(p.copies) || 1)));
  return p;
}

export function generate(wasm, model, input) {
  const p = sanitize(model, input);
  const garbage = new Set(); // Set: ten sam obiekt może zostać zarejestrowany kilka razy
  const track = (o) => { garbage.add(o); return o; };
  try {
    const { solid, warnings, info } = model.build(wasm, p, track);
    // Kopie układane obok siebie w osi Y; całość stoi na Z = 0 i jest wyśrodkowana.
    const b = solid.boundingBox();
    const sy = b.max[1] - b.min[1];
    let all = track(solid.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2, -b.min[2]]));
    if (p.copies > 1) {
      const parts = [];
      for (let i = 0; i < p.copies; i++) parts.push(track(all.translate([0, (i - (p.copies - 1) / 2) * (sy + COPY_GAP), 0])));
      all = track(wasm.Manifold.compose(parts));
    }
    const mesh = all.getMesh();
    const np = mesh.numProp, vp = mesh.vertProperties, tv = mesh.triVerts;
    const positions = new Float32Array(tv.length * 3);
    for (let i = 0; i < tv.length; i++) {
      const v = tv[i] * np;
      positions[i * 3] = vp[v]; positions[i * 3 + 1] = vp[v + 1]; positions[i * 3 + 2] = vp[v + 2];
    }
    const box = all.boundingBox();
    return {
      params: p, warnings, info,
      positions, vertProperties: vp.slice(), numProp: np, triVerts: tv.slice(),
      triangles: tv.length / 3,
      volume: all.volume(),
      size: [0, 1, 2].map((i) => box.max[i] - box.min[i]),
      genus: solid.genus(),
      status: solid.status(),
    };
  } finally {
    for (const o of garbage) o.delete();
  }
}
