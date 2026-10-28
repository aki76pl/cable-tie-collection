// Opaska z zadziorami („jodełka”): na jednym końcu oczko, na drugim sprężyste zadziory po bokach.
// Koniec przekłada się przez oczko — zadziory składają się przy wkładaniu i rozkładają za oczkiem.
import { poly, roundedRect, at, strapPlan } from './common.js';

export default {
  id: 'barbed',
  name: 'Z zadziorami',
  description: 'Płaska opaska z oczkiem i elastycznymi zadziorami. Zapina się przez przełożenie końca przez oczko.',
  printHint: 'Wymaga TPU (zadziory muszą się uginać). Drukuj płasko, bez podpór.',
  defaults: {
    length: 160, width: 6, thickness: 1.8, eyeThickness: 2.6, eyeWall: 2,
    slotClearance: 0.4, barbCount: 12, barbPitch: 6, barbLength: 4,
    barbOverhang: 1.6, barbFinger: 1.1,
    copies: 1,
  },
  sections: [
    { title: 'Pasek', fields: [
      { key: 'length', label: 'Długość całkowita', unit: 'mm', min: 60, max: 400, step: 1 },
      { key: 'width', label: 'Szerokość', unit: 'mm', min: 3, max: 20, step: 0.5 },
      { key: 'thickness', label: 'Grubość', unit: 'mm', min: 0.8, max: 4, step: 0.1 },
    ]},
    { title: 'Oczko', fields: [
      { key: 'slotClearance', label: 'Luz otworu', unit: 'mm', hint: 'na stronę', min: 0.1, max: 1.5, step: 0.05 },
      { key: 'eyeWall', label: 'Ścianka oczka', unit: 'mm', min: 1, max: 6, step: 0.1 },
      { key: 'eyeThickness', label: 'Grubość oczka', unit: 'mm', min: 1, max: 8, step: 0.1 },
    ]},
    { title: 'Zadziory', fields: [
      { key: 'barbCount', label: 'Ilość zadziorów', unit: 'szt.', hint: 'par, po obu stronach', min: 1, max: 60, step: 1 },
      { key: 'barbPitch', label: 'Rozstaw', unit: 'mm', min: 2, max: 20, step: 0.1 },
      { key: 'barbLength', label: 'Długość zadzioru', unit: 'mm', min: 1, max: 15, step: 0.1 },
      { key: 'barbOverhang', label: 'Wysięg poza otwór', unit: 'mm', hint: 'na stronę', min: 0.3, max: 5, step: 0.1 },
      { key: 'barbFinger', label: 'Grubość zadzioru', unit: 'mm', min: 0.5, max: 3, step: 0.05 },
    ]},
  ],

  build(wasm, p, track) {
    const { CrossSection: CS, Manifold } = wasm;
    const warnings = [];
    const W = p.width, T = p.thickness;

    // Otwór oczka: pasek przechodzi przez niego prostopadle, więc X ≈ grubość, Y ≈ szerokość.
    const slotX = T + 2 * p.slotClearance;
    const slotY = W + 2 * p.slotClearance;
    const barbHalf = slotY / 2 + p.barbOverhang;
    const eyeX = slotX + 2 * p.eyeWall;
    const eyeY = Math.max(slotY, 2 * barbHalf) + 2 * p.eyeWall;

    const x0 = -p.length / 2, x1 = p.length / 2;
    const eyeCx = x0 + eyeX / 2;

    // Oczko (grubsze, pierścień) + przejście do paska.
    const eyeOuter = at(roundedRect(CS, eyeX, eyeY, Math.min(eyeX, eyeY) / 2, track), eyeCx, 0, track);
    const eyeHole = at(roundedRect(CS, slotX, slotY, Math.min(slotX, slotY) / 2, track), eyeCx, 0, track);
    const eye = track(track(eyeOuter.subtract(eyeHole)).extrude(Math.max(p.eyeThickness, T)));

    // Pasek z zaostrzonym końcem.
    let plan = strapPlan(CS, eyeCx, x1, W, 'square', 'pointed', track);
    plan = track(plan.subtract(eyeHole));

    // Zadziory: skośne „palce” odchodzące od krawędzi w stronę oczka, z klinową szczeliną przy pasku.
    const tipLen = Math.min(W * 1.2, (x1 - eyeCx) / 3);
    const lastX = x1 - tipLen - 1;
    const maxCount = Math.max(0, Math.floor((lastX - p.barbLength - (eyeCx + eyeX / 2 + 15)) / p.barbPitch) + 1);
    let count = p.barbCount;
    if (count > maxCount) { warnings.push(`Przy tej długości mieści się maks. ${maxCount} par zadziorów.`); count = maxCount; }
    const fx = Math.min(p.barbFinger * 1.6, p.barbLength * 0.8);
    const fingers = [];
    for (let i = 0; i < count; i++) {
      const bx = lastX - i * p.barbPitch;
      for (const s of [1, -1]) {
        const h0 = s * (W / 2 - 0.05);
        fingers.push(poly(CS, [
          [bx, h0], [bx - p.barbLength, s * barbHalf],
          [bx - p.barbLength, s * Math.max(W / 2 + 0.2, barbHalf - p.barbFinger)], [bx - fx, h0],
        ], track));
      }
    }
    if (fingers.length) plan = track(CS.union([plan, ...fingers]));
    const strap = track(plan.extrude(T));

    return {
      solid: track(Manifold.union([eye, strap])),
      warnings,
      info: [['Zadziory', `${count} par`], ['Otwór oczka', `${slotX.toFixed(1)} × ${slotY.toFixed(1)} mm`]],
    };
  },
};
