// Uchwyt montażowy z opaską: płytka przykręcana do biurka/ściany (otwory z fazą pod łeb stożkowy),
// z której wychodzi pasek z oczkami. Pasek owija kable i zapina się na kołku na płytce.
import { roundedRect, at, strapPlan, mushroomPeg, slotRow } from './common.js';

export default {
  id: 'mount',
  name: 'Montażowa',
  description: 'Opaska z płytką do przykręcenia pod blatem lub na ścianie. Kable trzymają się przy płytce.',
  printHint: 'TPU 95A (pasek musi się wyginać). Drukuj płasko, kołkiem do góry.',
  label: true,
  materials: { pla: 'Pasek z PLA pęknie przy zginaniu: użyj TPU 95A.' },
  test: { overrides: { length: 50, slotCount: 2, baseLength: 26, holeCount: 0 } },
  // Obwód wiązki + połowa strefy oczek + odstęp od końca.
  fit: (p, d) => ({
    length: Math.round(Math.PI * (d + p.thickness) + (p.slotCount - 1) * p.slotPitch / 2 + p.endMargin + p.slotLength / 2 + 4),
  }),
  defaults: {
    baseLength: 40, baseWidth: 22, baseThickness: 3, holeCount: 1, screwDiameter: 3.5, screwHead: 7,
    length: 120, width: 12, thickness: 1.8,
    slotCount: 6, slotLength: 4, slotWidth: 7, slotPitch: 8, endMargin: 6,
    pegClearance: 0.2, capHeight: 2, capOverhang: 0.8,
    copies: 1,
  },
  sections: [
    { title: 'Płytka montażowa', fields: [
      { key: 'baseLength', label: 'Długość płytki', unit: 'mm', min: 20, max: 100, step: 0.5 },
      { key: 'baseWidth', label: 'Szerokość płytki', unit: 'mm', min: 10, max: 60, step: 0.5 },
      { key: 'baseThickness', label: 'Grubość płytki', unit: 'mm', min: 1.5, max: 8, step: 0.1 },
      { key: 'holeCount', label: 'Otwory na śruby', type: 'choice', options: [[0, 'Brak'], [1, 'Jeden'], [2, 'Dwa']] },
      { key: 'screwDiameter', label: 'Średnica śruby', unit: 'mm', min: 2, max: 6, step: 0.1 },
      { key: 'screwHead', label: 'Średnica łba (faza)', unit: 'mm', min: 3, max: 12, step: 0.1 },
    ]},
    { title: 'Pasek', fields: [
      { key: 'length', label: 'Długość paska', unit: 'mm', min: 40, max: 300, step: 1 },
      { key: 'width', label: 'Szerokość', unit: 'mm', min: 6, max: 30, step: 0.5 },
      { key: 'thickness', label: 'Grubość', unit: 'mm', min: 0.8, max: 4, step: 0.1, role: 'thin' },
    ]},
    { title: 'Oczka', fields: [
      { key: 'slotCount', label: 'Ilość oczek', unit: 'szt.', min: 0, max: 40, step: 1 },
      { key: 'slotLength', label: 'Długość oczka', unit: 'mm', hint: 'wzdłuż paska', min: 1.5, max: 12, step: 0.1 },
      { key: 'slotWidth', label: 'Szerokość oczka', unit: 'mm', hint: 'w poprzek paska', min: 2, max: 26, step: 0.1 },
      { key: 'slotPitch', label: 'Rozstaw oczek', unit: 'mm', min: 3, max: 25, step: 0.1 },
      { key: 'endMargin', label: 'Odstęp od końca', unit: 'mm', min: 1, max: 30, step: 0.5 },
    ]},
    { title: 'Kołek', fields: [
      { key: 'pegClearance', label: 'Luz szyjki', unit: 'mm', min: 0, max: 1, step: 0.05, role: 'clearance' },
      { key: 'capHeight', label: 'Wysokość czapki', unit: 'mm', min: 0.6, max: 5, step: 0.1 },
      { key: 'capOverhang', label: 'Nawis czapki', unit: 'mm', min: 0.2, max: 3, step: 0.1 },
    ]},
  ],

  build(wasm, p, track) {
    const { CrossSection: CS, Manifold } = wasm;
    const warnings = [];
    const bL = p.baseLength, bW = p.baseWidth, bT = p.baseThickness;
    const W = Math.min(p.width, bW), T = p.thickness;
    const slotY = Math.min(p.slotWidth, W - 2);
    const slotR = Math.min(1, p.slotLength / 2 - 0.01, slotY / 2 - 0.01);
    const pitch = Math.max(p.slotPitch, p.slotLength + 1);

    // Całość wyśrodkowana: płytka po stronie +X, pasek wychodzi w stronę -X.
    const total = bL + p.length;
    const bx0 = total / 2 - bL, bx1 = total / 2;
    const sx0 = -total / 2;

    // Kołek przy dalszym końcu płytki.
    const peg = mushroomPeg(wasm, {
      slotX: p.slotLength, slotY, slotR, clearance: p.pegClearance,
      capHeight: p.capHeight, capOverhang: p.capOverhang, passT: T, maxCapY: bW,
    }, track);
    const pegX = bx1 - Math.max(peg.capX / 2 + 2, 4);

    let base = track(roundedRect(CS, bL, bW, Math.min(4, bW / 2), track).extrude(bT));
    base = track(base.translate([(bx0 + bx1) / 2, 0, 0]));

    // Otwory na śruby z fazą pod łeb stożkowy (90°).
    const holeZone = [bx0 + p.screwHead / 2 + 2, pegX - peg.capX / 2 - p.screwHead / 2 - 2];
    const holesX = p.holeCount === 2 ? holeZone : p.holeCount === 1 ? [(holeZone[0] + holeZone[1]) / 2] : [];
    if (holesX.length && holeZone[1] < holeZone[0]) warnings.push('Płytka jest za krótka na otwory — wydłuż ją.');
    const sinkDepth = Math.min((p.screwHead - p.screwDiameter) / 2, bT - 0.6);
    const cutters = [];
    for (const hx of holesX) {
      const r = p.screwDiameter / 2 + 0.15;
      cutters.push(track(track(track(CS.circle(r)).extrude(bT + 2)).translate([hx, 0, -1])));
      if (sinkDepth > 0) {
        const cone = track(track(CS.circle(r)).extrude(sinkDepth + 0.01, 0, 0, (r + sinkDepth) / r));
        cutters.push(track(cone.translate([hx, 0, bT - sinkDepth])));
      }
    }
    if (cutters.length) base = track(base.subtract(track(Manifold.union(cutters))));

    // Pasek z oczkami przy wolnym końcu.
    let plan = strapPlan(CS, sx0, bx0 + 2, W, 'round', 'square', track);
    const xLast = sx0 + p.endMargin + p.slotLength / 2;
    const free = Math.max(15, p.labelLen ? p.labelLen + 8 : 0);
    const maxSlots = Math.max(0, Math.floor((bx0 - free - xLast) / pitch) + 1);
    let count = p.slotCount;
    if (count > maxSlots) { warnings.push(`Przy tej długości paska mieści się maks. ${maxSlots} oczek.`); count = maxSlots; }
    // Oczka liczone od wolnego końca (-X) w stronę płytki.
    const holes = slotRow(CS, { count, slotX: p.slotLength, slotY, slotR, pitch: -pitch, xLast }, track);
    if (holes) plan = track(plan.subtract(holes));
    const strap = track(plan.extrude(T));

    const pegSolid = track(peg.solid.translate([pegX, 0, bT]));
    return {
      solid: track(Manifold.union([base, strap, pegSolid])),
      warnings,
      label: p.labelLen ? { x: bx0 - 3 - p.labelLen / 2, z: T, width: W } : null,
      info: [['Oczka', `${count} szt.`], ['Otwory', `${holesX.length} × Ø${p.screwDiameter}`]],
    };
  },
};
