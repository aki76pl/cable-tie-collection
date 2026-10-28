// Opaska wielokablowa: bloczek z kanałami na kilka kabli obok siebie (kable wciska się od góry)
// i pasek z oczkami, który przechodzi nad kanałami i zapina się na kołku po drugiej stronie bloczka.
import { at, extrudeXZ, strapPlan, mushroomPeg, slotRow } from './common.js';

export default {
  id: 'multi',
  name: 'Wielokablowa',
  description: 'Bloczek z przegródkami trzyma kilka kabli równo obok siebie, a pasek zamyka je od góry.',
  printHint: 'TPU 95A (pasek musi się wyginać). Drukuj płasko, kanałami do góry, bez podpór.',
  label: true,
  materials: { pla: 'Pasek z PLA pęknie przy zginaniu: użyj TPU 95A.' },
  test: { overrides: { cableCount: 1, length: 50, slotCount: 2 } },
  fit: (p, d) => ({ cableD: d }),
  defaults: {
    cableCount: 4, cableD: 6, channelClearance: 0.2, rib: 1.6, floor: 1.6,
    length: 90, width: 10, thickness: 1.6,
    slotCount: 5, slotLength: 4, slotWidth: 6, slotPitch: 7, endMargin: 6,
    pegClearance: 0.2, capHeight: 1.8, capOverhang: 0.7,
    copies: 1,
  },
  sections: [
    { title: 'Kanały na kable', fields: [
      { key: 'cableCount', label: 'Ilość kabli', unit: 'szt.', min: 1, max: 10, step: 1 },
      { key: 'cableD', label: 'Średnica kabla', unit: 'mm', min: 2, max: 16, step: 0.1 },
      { key: 'channelClearance', label: 'Luz kanału', unit: 'mm', hint: 'na stronę', min: 0, max: 1, step: 0.05 },
      { key: 'rib', label: 'Przegródka', unit: 'mm', min: 1, max: 5, step: 0.1, role: 'thin' },
      { key: 'floor', label: 'Dno bloczka', unit: 'mm', min: 0.8, max: 5, step: 0.1 },
    ]},
    { title: 'Pasek', fields: [
      { key: 'length', label: 'Długość paska', unit: 'mm', min: 30, max: 300, step: 1 },
      { key: 'width', label: 'Szerokość', unit: 'mm', min: 6, max: 25, step: 0.5 },
      { key: 'thickness', label: 'Grubość', unit: 'mm', min: 0.8, max: 3, step: 0.1, role: 'thin' },
    ]},
    { title: 'Oczka', fields: [
      { key: 'slotCount', label: 'Ilość oczek', unit: 'szt.', min: 1, max: 30, step: 1 },
      { key: 'slotLength', label: 'Długość oczka', unit: 'mm', hint: 'wzdłuż paska', min: 1.5, max: 10, step: 0.1 },
      { key: 'slotWidth', label: 'Szerokość oczka', unit: 'mm', hint: 'w poprzek paska', min: 2, max: 21, step: 0.1 },
      { key: 'slotPitch', label: 'Rozstaw oczek', unit: 'mm', min: 3, max: 20, step: 0.1 },
      { key: 'endMargin', label: 'Odstęp od końca', unit: 'mm', min: 1, max: 20, step: 0.5 },
    ]},
    { title: 'Kołek', fields: [
      { key: 'pegClearance', label: 'Luz szyjki', unit: 'mm', min: 0, max: 1, step: 0.05, role: 'clearance' },
      { key: 'capHeight', label: 'Wysokość czapki', unit: 'mm', min: 0.6, max: 4, step: 0.1 },
      { key: 'capOverhang', label: 'Nawis czapki', unit: 'mm', min: 0.2, max: 2, step: 0.1 },
    ]},
  ],

  build(wasm, p, track) {
    const { CrossSection: CS, Manifold } = wasm;
    const warnings = [];
    const W = p.width, T = p.thickness, N = p.cableCount;
    const r = p.cableD / 2 + p.channelClearance;
    const slotY = Math.min(p.slotWidth, W - 2);
    const slotR = Math.min(1, p.slotLength / 2 - 0.01, slotY / 2 - 0.01);
    const pitch = Math.max(p.slotPitch, p.slotLength + 1);

    const peg = mushroomPeg(wasm, {
      slotX: p.slotLength, slotY, slotR, clearance: p.pegClearance,
      capHeight: p.capHeight, capOverhang: p.capOverhang, passT: T, maxCapY: W,
    }, track);

    // Bloczek: N kanałów + podest pod kołek. Górna krawędź na wysokości środka kanału + r/2,
    // więc otwór od góry ma ok. 87% średnicy i kabel wskakuje z lekkim oporem.
    const pad = peg.capX + 4;
    const chanX = N * 2 * r + (N + 1) * p.rib;
    const blockX = chanX + pad;
    const zc = p.floor + r;
    const H = zc + r * 0.5;
    const total = blockX + p.length;
    const bx0 = total / 2 - blockX, bx1 = total / 2;

    let block = track(track(track(CS.square([blockX, W], true)).extrude(H)).translate([(bx0 + bx1) / 2, 0, 0]));
    const cutters = [];
    for (let i = 0; i < N; i++) {
      const cx = bx0 + p.rib + r + i * (2 * r + p.rib);
      cutters.push(extrudeXZ(at(track(CS.circle(r)), cx, zc, track), W + 2, track));
    }
    block = track(block.subtract(track(Manifold.union(cutters))));
    const pegX = bx1 - pad / 2;

    // Pasek wychodzi z bloczka w stronę -X; oczka przy wolnym końcu.
    const sx0 = -total / 2;
    let plan = strapPlan(CS, sx0, bx0 + 2, W, 'round', 'square', track);
    const xLast = sx0 + p.endMargin + p.slotLength / 2;
    const free = Math.max(10, p.labelLen ? p.labelLen + 8 : 0);
    const maxSlots = Math.max(0, Math.floor((bx0 - free - xLast) / pitch) + 1);
    let count = p.slotCount;
    if (count > maxSlots) { warnings.push(`Przy tej długości mieści się maks. ${maxSlots} oczek.`); count = maxSlots; }
    const holes = slotRow(CS, { count, slotX: p.slotLength, slotY, slotR, pitch: -pitch, xLast }, track);
    if (holes) plan = track(plan.subtract(holes));
    const strap = track(plan.extrude(T));

    // Pasek musi obejść bok i wierzch bloczka, żeby sięgnąć kołka.
    const reach = H + (pegX - bx0) + 2;
    if (count && bx0 - xLast < reach) warnings.push(`Pasek jest za krótki: do kołka potrzeba ok. ${Math.ceil(reach + p.endMargin + 5)} mm.`);

    const pegSolid = track(peg.solid.translate([pegX, 0, H]));
    return {
      solid: track(Manifold.union([block, strap, pegSolid])),
      warnings,
      label: p.labelLen ? { x: bx0 - 3 - p.labelLen / 2, z: T, width: W } : null,
      info: [['Kanały', `${N} × Ø${p.cableD} mm`], ['Oczka', `${count} szt.`]],
    };
  },
};
