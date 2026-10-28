// Opaska zapadkowa: klasyczny „trytytka” — ząbki na pasku i główka z kanałem oraz sprężystą zapadką.
// Koniec owija się wokół kabli i przekłada pionowo przez kanał główki; zapadka blokuje cofanie.
import { poly, extrudeXZ, strapPlan } from './common.js';

export default {
  id: 'ratchet',
  name: 'Zapadkowa',
  description: 'Klasyczna opaska z ząbkami i zapadką w główce. Zaciska się płynnie co jeden ząbek.',
  printHint: 'Najlepiej PETG lub TPU 95A. Drukuj płasko, ząbkami do góry, bez podpór.',
  defaults: {
    length: 180, width: 8, thickness: 1.6, endShape: 'pointed',
    toothPitch: 2, toothHeight: 0.8, smoothStart: 20,
    headHeight: 7, headWall: 1.6, clearance: 0.3, pawlThickness: 1.2,
    copies: 1,
  },
  sections: [
    { title: 'Pasek', fields: [
      { key: 'length', label: 'Długość paska', unit: 'mm', min: 60, max: 400, step: 1 },
      { key: 'width', label: 'Szerokość', unit: 'mm', min: 4, max: 20, step: 0.5 },
      { key: 'thickness', label: 'Grubość', unit: 'mm', min: 0.8, max: 4, step: 0.1 },
      { key: 'endShape', label: 'Koniec', type: 'choice', options: [['pointed', 'Szpic'], ['round', 'Okrągły']] },
    ]},
    { title: 'Ząbki', fields: [
      { key: 'toothPitch', label: 'Podziałka ząbków', unit: 'mm', min: 1, max: 6, step: 0.1 },
      { key: 'toothHeight', label: 'Wysokość ząbka', unit: 'mm', min: 0.3, max: 2, step: 0.05 },
      { key: 'smoothStart', label: 'Gładki odcinek przy główce', unit: 'mm', min: 0, max: 100, step: 1 },
    ]},
    { title: 'Główka z zapadką', fields: [
      { key: 'headHeight', label: 'Wysokość główki', unit: 'mm', min: 3, max: 15, step: 0.1 },
      { key: 'headWall', label: 'Ścianka główki', unit: 'mm', min: 0.8, max: 4, step: 0.1 },
      { key: 'clearance', label: 'Luz w kanale', unit: 'mm', hint: 'na stronę', min: 0, max: 1, step: 0.05 },
      { key: 'pawlThickness', label: 'Grubość zapadki', unit: 'mm', min: 0.6, max: 3, step: 0.1 },
    ]},
  ],

  build(wasm, p, track) {
    const { CrossSection: CS, Manifold } = wasm;
    const warnings = [];
    const T = p.thickness, W = p.width, h = Math.min(p.toothHeight, p.toothPitch * 0.8);

    // Kanał: grubość paska + ząbek + zapadka + luz (w X), szerokość paska + luz (w Y).
    const gapX = T + h + p.pawlThickness + 2 * p.clearance;
    const gapY = W + 2 * p.clearance;
    const headX = gapX + 2 * p.headWall;
    const headY = gapY + 2 * p.headWall;
    const hx0 = -(p.length + headX) / 2;          // całość wyśrodkowana
    const hx1 = hx0 + headX;
    const cx0 = hx0 + p.headWall, cx1 = cx0 + gapX;
    const H = Math.max(p.headHeight, T + 1);

    const head = track(track(track(CS.square([headX, headY], true)).extrude(H)).translate([(hx0 + hx1) / 2, 0, 0]));
    const channel = track(track(track(CS.square([gapX, gapY], true)).extrude(H + 2)).translate([(cx0 + cx1) / 2, 0, -1]));

    // Zapadka: skośny język przyczepiony do ściany +X kanału, końcem w dół i w stronę -X.
    const tipX = cx0 + p.clearance + T + h * 0.45;
    const zTop = H, zBot = Math.min(1, H * 0.2);
    const attach = Math.min(2, H * 0.3);
    const pawl2d = poly(CS, [
      [cx1 + 0.02, zTop], [cx1 - p.pawlThickness, zTop], [tipX, zBot],
      [tipX + p.pawlThickness * 0.8, zBot], [cx1 + 0.02, zTop - attach],
    ], track);
    const pawl = extrudeXZ(pawl2d, gapY - 0.6, track);

    // Pasek: profil boczny z ząbkami piłowymi (pionowa ścianka od strony główki), przycięty do obrysu.
    const sx0 = hx1 - 0.02, sx1 = -hx0;
    const teethStart = sx0 + p.smoothStart;
    const teethEnd = sx1 - Math.max(6, W);         // wolny koniec bez ząbków — łatwiej wprowadzić
    const prof = [[sx0, 0], [sx1, 0], [sx1, T], [teethEnd, T]];
    let x = teethEnd;
    let n = 0;
    while (x - p.toothPitch >= teethStart) {
      // idąc od końca w stronę główki: łagodna rampa w górę, potem pionowy spadek
      prof.push([x - p.toothPitch + 0.15, T + h], [x - p.toothPitch, T]);
      x -= p.toothPitch; n++;
    }
    if (x > sx0 + 0.01) prof.push([sx0, T]);
    const side = extrudeXZ(poly(CS, prof, track), W, track);
    const plan = track(track(strapPlan(CS, sx0 - 1, sx1, W, 'square', p.endShape, track)).extrude(T + h + 1));
    const strap = track(side.intersect(plan));
    if (n === 0) warnings.push('Brak miejsca na ząbki — zmniejsz gładki odcinek lub wydłuż pasek.');

    const solid = track(Manifold.union([track(head.subtract(channel)), pawl, strap]));
    return { solid, warnings, info: [['Ząbki', `${n} szt.`], ['Kanał', `${gapX.toFixed(1)} × ${gapY.toFixed(1)} mm`]] };
  },
};

