// Klips na krawędź blatu: sprężysta litera C zaciska się na blacie bez wkręcania,
// a pod spodem ma zatrzaskowy uchwyt na kabel lub wiązkę.
// Profil rysowany jest w płaszczyźnie XY i wyciągany w Z na szerokość klipsa — drukuje się na boku.
import { at, clamp } from './common.js';

export default {
  id: 'clip',
  name: 'Klips na blat',
  description: 'Zaciska się na krawędzi biurka, bez wkręcania. Kabel wciska się w zatrzask pod blatem.',
  printHint: 'PETG lub PLA. Drukuj na boku (tak jak w podglądzie), bez podpór.',
  materials: { tpu: 'Klips z TPU będzie za miękki, żeby trzymać się blatu: użyj PETG lub PLA.' },
  test: { key: 'grip', values: [0, 0.3, 0.6, 0.9, 1.2], overrides: { clipWidth: 6 } },
  fit: (p, d) => ({ cableD: d }),
  defaults: {
    deskThickness: 18, grip: 0.6, jawLength: 22, wall: 3, clipWidth: 12,
    cableD: 8, hookWall: 2.4, opening: 75,
    copies: 1,
  },
  sections: [
    { title: 'Blat', fields: [
      { key: 'deskThickness', label: 'Grubość blatu', unit: 'mm', min: 5, max: 45, step: 0.5 },
      { key: 'grip', label: 'Docisk', unit: 'mm', hint: 'o ile szczęki są węższe od blatu', min: 0, max: 2, step: 0.05 },
      { key: 'jawLength', label: 'Długość szczęk', unit: 'mm', min: 10, max: 50, step: 0.5 },
      { key: 'wall', label: 'Grubość ścianek', unit: 'mm', min: 2, max: 6, step: 0.1 },
      { key: 'clipWidth', label: 'Szerokość klipsa', unit: 'mm', min: 5, max: 30, step: 0.5 },
    ]},
    { title: 'Uchwyt na kabel', fields: [
      { key: 'cableD', label: 'Średnica kabla / wiązki', unit: 'mm', min: 3, max: 30, step: 0.5 },
      { key: 'hookWall', label: 'Grubość uchwytu', unit: 'mm', min: 1.2, max: 5, step: 0.1, role: 'thin' },
      { key: 'opening', label: 'Szerokość wejścia', unit: '%', hint: 'średnicy kabla', min: 50, max: 95, step: 1 },
    ]},
  ],

  build(wasm, p, track) {
    const { CrossSection: CS, Manifold } = wasm;
    const warnings = [];
    const t = p.wall, J = Math.max(p.jawLength, t + 4);
    const gap = Math.max(2, p.deskThickness - p.grip);
    const rect = (x0, y0, x1, y1) => track(track(CS.square([x1 - x0, y1 - y0])).translate([x0, y0]));

    // Litera C: grzbiet + dwie szczęki, na końcach szczęk wypustki dociskające blat.
    const bump = Math.min(0.9, t / 3);
    const parts = [
      rect(0, 0, t, gap + 2 * t),
      rect(0, 0, J, t),
      rect(0, gap + t, J, gap + 2 * t),
      at(track(CS.circle(bump, 16)), J - 2, t, track),
      at(track(CS.circle(bump, 16)), J - 2, gap + t, track),
    ];

    // Zatrzask na kabel pod dolną szczęką, wejściem w stronę końca szczęk.
    const rIn = p.cableD / 2, rOut = rIn + p.hookWall;
    const cx = clamp(J - rOut, rOut, Math.max(rOut, J - rOut));
    const cy = -rIn;
    const ring = track(at(track(CS.circle(rOut)), cx, cy, track).subtract(at(track(CS.circle(rIn)), cx, cy, track)));
    const open = (p.opening / 100) * p.cableD;
    const mouth = rect(cx, cy - open / 2, cx + rOut + 1, cy + open / 2);
    parts.push(track(ring.subtract(mouth)));

    // Zaokrąglenie wypukłych narożników (otwarcie morfologiczne), żeby nie rysował blatu.
    const k = Math.min(0.6, t / 4);
    const profile = track(track(track(CS.union(parts)).offset(-k, 'Round')).offset(k, 'Round'));
    let solid = track(profile.extrude(p.clipWidth));

    // Znaczniki dla testu (kropki na grzbiecie), żeby odróżnić warianty.
    if (p._index) {
      const dots = [];
      for (let i = 0; i < p._index; i++) {
        dots.push(track(track(track(CS.circle(0.6, 12)).extrude(0.5)).translate([t / 2, t + 2 + i * 2.2, p.clipWidth - 0.01])));
      }
      solid = track(Manifold.union([solid, ...dots]));
    }

    if (open < 2) warnings.push('Wejście uchwytu jest bardzo wąskie — kabel może się nie wcisnąć.');
    return {
      solid,
      warnings,
      label: null,
      info: [['Rozstaw szczęk', `${gap.toFixed(1)} mm`], ['Wejście uchwytu', `${open.toFixed(1)} mm`]],
    };
  },
};
