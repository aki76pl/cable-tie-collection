// Opaska z oczkami i grzybkowym kołkiem (model z Generatora Opasek).
// Płaski pasek z rzędem oczek przy wolnym końcu; kołek przy drugim końcu wciska się w wybrane oczko.
import { roundedRect, strapPlan, mushroomPeg, slotRow, clamp } from './common.js';

const MIN_RIB = 1;   // minimalna ścianka materiału obok oczka [mm]
const TIP_R = 0.18;  // promień czubka szpica jako ułamek szerokości (jak w strapPlan)

export default {
  id: 'loop',
  name: 'Z oczkami',
  description: 'Wielorazowa opaska z rzędem oczek i grzybkowym kołkiem. Model z Generatora Opasek.',
  printHint: 'TPU 95A (opaska musi się wyginać). Drukuj płasko, kołkiem do góry, bez podpór.',
  label: true,
  materials: {
    pla: 'Pasek z PLA pęknie przy zginaniu: użyj TPU 95A.',
    petg: 'PETG wygina się tylko przy cienkim pasku (do ok. 1,2 mm).',
  },
  test: { overrides: { length: 70, slotCount: 2 } },
  // Kołek przy końcu, środkowe oczko wypada w odległości obwodu wiązki.
  fit: (p, d) => ({
    length: Math.round(p.width / 2 + Math.PI * (d + p.thickness) + (p.slotCount - 1) * p.slotPitch / 2 + p.endMargin + p.slotLength / 2),
  }),
  defaults: {
    length: 150, width: 15, thickness: 2, endShape: 'round',
    slotCount: 10, slotLength: 4, slotWidth: 8, slotPitch: 8.5, slotRadius: 1, endMargin: 6,
    pegClearance: 0.2, capHeight: 2, capOverhang: 0.8,
    copies: 1,
  },
  sections: [
    { title: 'Pasek', fields: [
      { key: 'length', label: 'Długość całkowita', unit: 'mm', min: 40, max: 400, step: 1 },
      { key: 'width', label: 'Szerokość', unit: 'mm', min: 6, max: 40, step: 0.5 },
      { key: 'thickness', label: 'Grubość', unit: 'mm', min: 0.8, max: 6, step: 0.1, role: 'thin' },
      { key: 'endShape', label: 'Koniec', type: 'choice', options: [['round', 'Okrągły'], ['pointed', 'Szpic'], ['square', 'Prosty']] },
    ]},
    { title: 'Oczka', fields: [
      { key: 'slotCount', label: 'Ilość oczek', unit: 'szt.', min: 0, max: 60, step: 1 },
      { key: 'slotLength', label: 'Długość oczka', unit: 'mm', hint: 'wzdłuż paska', min: 1.5, max: 15, step: 0.1 },
      { key: 'slotWidth', label: 'Szerokość oczka', unit: 'mm', hint: 'w poprzek paska', min: 2, max: 36, step: 0.1 },
      { key: 'slotPitch', label: 'Rozstaw oczek', unit: 'mm', hint: 'środek–środek', min: 3, max: 30, step: 0.1 },
      { key: 'slotRadius', label: 'Zaokrąglenie oczka', unit: 'mm', min: 0, max: 5, step: 0.1 },
      { key: 'endMargin', label: 'Odstęp od końca', unit: 'mm', min: 1, max: 50, step: 0.5 },
    ]},
    { title: 'Kołek', fields: [
      { key: 'pegClearance', label: 'Luz szyjki', unit: 'mm', hint: 'na stronę', min: 0, max: 1, step: 0.05, role: 'clearance' },
      { key: 'capHeight', label: 'Wysokość czapki', unit: 'mm', min: 0.6, max: 6, step: 0.1 },
      { key: 'capOverhang', label: 'Nawis czapki', unit: 'mm', hint: 'na stronę', min: 0.2, max: 3, step: 0.1 },
    ]},
  ],

  build(wasm, p, track) {
    const { CrossSection: CS, Manifold } = wasm;
    const warnings = [];
    const L = p.length, W = p.width, T = p.thickness;
    const slotY = clamp(p.slotWidth, 2, W - 2 * MIN_RIB);
    const slotR = clamp(p.slotRadius, 0, Math.min(p.slotLength, slotY) / 2 - 0.01);
    let pitch = p.slotPitch;
    if (pitch < p.slotLength + MIN_RIB) {
      pitch = p.slotLength + MIN_RIB;
      warnings.push(`Rozstaw zwiększony do ${pitch.toFixed(1)} mm (min. ${MIN_RIB} mm mostka między oczkami).`);
    }

    const peg = mushroomPeg(wasm, {
      slotX: p.slotLength, slotY, slotR, clearance: p.pegClearance,
      capHeight: p.capHeight, capOverhang: p.capOverhang, passT: T, maxCapY: W,
    }, track);
    const pegX = -L / 2 + W / 2;

    // Ile oczek mieści się między kołkiem (plus ewentualny napis) a wolnym końcem.
    let xLast = L / 2 - p.endMargin - p.slotLength / 2;
    if (p.endShape === 'pointed') {
      // W zwężeniu szpica oczko musi zachować ściankę MIN_RIB z obu stron.
      const tipLen = Math.min(W * 1.2, L / 3);
      const s = Math.max(0, (W - slotY - 2 * MIN_RIB) / (W * (1 - 2 * TIP_R)) * tipLen);
      xLast = Math.min(xLast, L / 2 - tipLen + s - p.slotLength / 2);
    }
    const labelX0 = pegX + peg.capX / 2 + 3;
    const gap = Math.max(12, p.labelLen ? p.labelLen + 6 : 0);
    const firstAllowed = pegX + peg.capX / 2 + gap + p.slotLength / 2;
    const maxSlots = xLast < firstAllowed ? 0 : Math.floor((xLast - firstAllowed) / pitch) + 1;
    let count = p.slotCount;
    if (count > maxSlots) { warnings.push(`Przy tej długości mieści się maks. ${maxSlots} oczek.`); count = maxSlots; }

    let plan = strapPlan(CS, -L / 2, L / 2, W, 'round', p.endShape, track);
    const holes = slotRow(CS, { count, slotX: p.slotLength, slotY, slotR, pitch, xLast }, track);
    if (holes) plan = track(plan.subtract(holes));
    const strap = track(plan.extrude(T));
    const pegSolid = track(peg.solid.translate([pegX, 0, T]));

    // Zakres średnic wiązki: od pierwszego do ostatniego oczka.
    const span = count ? [xLast - (count - 1) * pitch - pegX, xLast - pegX].map((c) => c / Math.PI - T) : null;
    return {
      solid: track(Manifold.union([strap, pegSolid])),
      warnings,
      label: p.labelLen ? { x: labelX0 + p.labelLen / 2, z: T, width: W } : null,
      info: [
        ['Oczka', `${count} szt.`],
        ['Wiązka', span ? `Ø ${Math.max(0, span[0]).toFixed(0)}–${span[1].toFixed(0)} mm` : '—'],
      ],
    };
  },
};
