// Opaska z klamrą przelotową (jak przy plecaku): na końcu rama z poprzeczką i dwoma szczelinami.
// Wolny koniec przechodzi w górę przez jedną szczelinę, nad poprzeczką i w dół przez drugą —
// trzyma tarcie, więc regulacja jest bezstopniowa. Opcjonalne żeberka zwiększają chwyt.
import { roundedRect, at, strapPlan, extrudeXZ, poly } from './common.js';

export default {
  id: 'buckle',
  name: 'Z klamrą',
  description: 'Bezstopniowo regulowana opaska z klamrą przelotową. Bez dziurek i bez zapadek.',
  printHint: 'TPU 95A lub PETG. Drukuj płasko, żeberkami do góry, bez podpór.',
  label: true,
  materials: { pla: 'Pasek z PLA jest za sztywny do klamry: użyj TPU 95A lub PETG.' },
  test: { overrides: { length: 90 } },
  // Obwód wiązki + dwa przejścia przez klamrę + ok. 40 mm końcówki.
  fit: (p, d) => ({ length: Math.round(Math.PI * (d + p.thickness) + 4 * p.thickness + 2 * p.barWidth + 4 * p.frameWall + 40) }),
  defaults: {
    length: 170, width: 12, thickness: 1.4, endShape: 'round',
    frameThickness: 2.6, frameWall: 2, barWidth: 2.4, slotClearance: 0.35,
    ribs: 'on', ribPitch: 3, ribHeight: 0.4,
    copies: 1,
  },
  sections: [
    { title: 'Pasek', fields: [
      { key: 'length', label: 'Długość całkowita', unit: 'mm', min: 60, max: 400, step: 1 },
      { key: 'width', label: 'Szerokość', unit: 'mm', min: 5, max: 30, step: 0.5 },
      { key: 'thickness', label: 'Grubość', unit: 'mm', min: 0.8, max: 3, step: 0.1, role: 'thin' },
      { key: 'endShape', label: 'Koniec', type: 'choice', options: [['round', 'Okrągły'], ['pointed', 'Szpic'], ['square', 'Prosty']] },
    ]},
    { title: 'Klamra', fields: [
      { key: 'frameThickness', label: 'Grubość ramy', unit: 'mm', min: 1.2, max: 6, step: 0.1 },
      { key: 'frameWall', label: 'Ścianka ramy', unit: 'mm', min: 1, max: 5, step: 0.1 },
      { key: 'barWidth', label: 'Szerokość poprzeczki', unit: 'mm', min: 1, max: 6, step: 0.1 },
      { key: 'slotClearance', label: 'Luz szczelin', unit: 'mm', hint: 'na stronę', min: 0, max: 1, step: 0.05, role: 'clearance' },
    ]},
    { title: 'Żeberka', fields: [
      { key: 'ribs', label: 'Żeberka na pasku', type: 'choice', options: [['on', 'Tak'], ['off', 'Nie']] },
      { key: 'ribPitch', label: 'Rozstaw żeberek', unit: 'mm', min: 1.5, max: 10, step: 0.1 },
      { key: 'ribHeight', label: 'Wysokość żeberek', unit: 'mm', min: 0.2, max: 1.2, step: 0.05 },
    ]},
  ],

  build(wasm, p, track) {
    const { CrossSection: CS, Manifold } = wasm;
    const W = p.width, T = p.thickness;
    const ribH = p.ribs === 'on' ? p.ribHeight : 0;

    // Szczelina mieści podwójną warstwę paska (wejście + powrót), w poprzek szerokość + luz.
    const slotX = 2 * (T + ribH) + 2 * p.slotClearance;
    const slotY = W + 2 * p.slotClearance;
    const frameX = 2 * slotX + p.barWidth + 2 * p.frameWall;
    const frameY = slotY + 2 * p.frameWall;

    const x0 = -p.length / 2, x1 = p.length / 2;
    const fCx = x0 + frameX / 2;
    const s1 = fCx - (p.barWidth + slotX) / 2, s2 = fCx + (p.barWidth + slotX) / 2;

    const r = Math.min(1, slotX / 2 - 0.01);
    const outer = at(roundedRect(CS, frameX, frameY, Math.min(3, frameY / 2), track), fCx, 0, track);
    const slot = roundedRect(CS, slotX, slotY, r, track);
    const holes = track(CS.union([at(slot, s1, 0, track), at(slot, s2, 0, track)]));
    const frame = track(track(outer.subtract(holes)).extrude(Math.max(p.frameThickness, T)));

    const fx1 = fCx + frameX / 2;
    const strapX0 = fx1 - p.frameWall;               // pasek zachodzi na ściankę ramy
    const plan = strapPlan(CS, strapX0, x1, W, 'square', p.endShape, track);
    let strap = track(plan.extrude(T));

    let ribCount = 0;
    if (ribH > 0) {
      // Trapezowe żeberka w poprzek paska, od ramy do ok. 10 mm przed końcem.
      const ribs = [];
      const w = Math.min(1, p.ribPitch * 0.5);
      for (let x = Math.max(fx1 + 6, p.labelLen ? fx1 + 4 + p.labelLen + 2 : 0); x < x1 - Math.max(10, W); x += p.ribPitch) {
        ribs.push(poly(CS, [[x, T - 0.01], [x + w, T - 0.01], [x + w * 0.75, T + ribH], [x + w * 0.25, T + ribH]], track));
        ribCount++;
      }
      if (ribs.length) {
        const ribSolid = extrudeXZ(track(CS.union(ribs)), W - 1, track);
        strap = track(Manifold.union([strap, ribSolid]));
      }
    }

    return {
      solid: track(Manifold.union([frame, strap])),
      warnings: [],
      label: p.labelLen ? { x: fx1 + 3 + p.labelLen / 2, z: T, width: W } : null,
      info: [['Szczeliny', `2 × ${slotX.toFixed(1)} × ${slotY.toFixed(1)} mm`], ['Żeberka', ribCount ? `${ribCount} szt.` : 'brak']],
    };
  },
};
