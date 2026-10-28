// Wspólne klocki geometrii dla wszystkich modeli.
// Układ: X wzdłuż paska, Y w poprzek, Z w górę; spód na Z = 0.

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Wielokąt z listy punktów [x, y]; kierunek obiegu jest wyrównywany (CCW).
export function poly(CS, pts, track) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    area += x1 * y2 - x2 * y1;
  }
  return track(new CS([area < 0 ? [...pts].reverse() : pts]));
}

// Zaokrąglony prostokąt wyśrodkowany w (0,0).
export function roundedRect(CS, sx, sy, r, track) {
  r = Math.min(r, sx / 2 - 1e-3, sy / 2 - 1e-3);
  if (r <= 0.01) return track(CS.square([sx, sy], true));
  return track(track(CS.square([sx - 2 * r, sy - 2 * r], true)).offset(r, 'Round'));
}

export const at = (cs, x, y, track) => track(cs.translate([x, y]));

// Wyciąga profil narysowany w płaszczyźnie XZ (punkty [x, z]) na szerokość w osi Y, wyśrodkowany.
export function extrudeXZ(cs, width, track) {
  return track(track(track(cs.extrude(width)).rotate([90, 0, 0])).translate([0, width / 2, 0]));
}

// Obrys paska: [x0, x1] wzdłuż X, szerokość w. Końce: 'round' | 'square' | 'pointed'.
export function strapPlan(CS, x0, x1, w, startEnd, endEnd, track) {
  const r = w / 2;
  const parts = [];
  const cap = (x, kind, dir) => {
    if (kind === 'round') return at(track(CS.circle(r)), x - dir * r, 0, track);
    if (kind === 'pointed') {
      const tip = Math.min(w * 1.2, (x1 - x0) / 3);
      return [
        at(track(CS.square([0.01, w], true)), x - dir * tip, 0, track),
        at(track(CS.circle(w * 0.18)), x - dir * w * 0.18, 0, track),
      ];
    }
    return at(track(CS.square([0.02, w], true)), x - dir * 0.01, 0, track);
  };
  parts.push(cap(x0, startEnd, -1), cap(x1, endEnd, 1));
  return track(CS.hull(parts.flat()));
}

// Grzybkowy kołek dopasowany do oczka slotX × slotY, stojący na wysokości z0.
// Szyjka przechodzi przez materiał o grubości passT.
export function mushroomPeg(wasm, { slotX, slotY, slotR, clearance, capHeight, capOverhang, passT, maxCapY }, track) {
  const { CrossSection: CS } = wasm;
  const neckX = slotX - 2 * clearance, neckY = slotY - 2 * clearance;
  const capX = neckX + 2 * capOverhang;
  const capY = Math.min(neckY + 2 * capOverhang, maxCapY ?? Infinity);
  const neckR = Math.min(slotR, 1.2);
  const neckH = passT + 0.3;
  const neck = track(roundedRect(CS, neckX, neckY, neckR, track).extrude(neckH + 0.01));
  const base = roundedRect(CS, capX, capY, Math.min(capX / 2, neckR + capOverhang), track);
  const top = [Math.max(0.35, (neckX / capX) * 0.85), Math.max(0.35, (neckY / capY) * 0.85)];
  const cap = track(track(base.extrude(capHeight, 0, 0, top)).translate([0, 0, neckH]));
  return { solid: track(wasm.Manifold.union([neck, cap])), capX, capY, height: neckH + capHeight };
}

// Rząd zaokrąglonych oczek (do odjęcia) wzdłuż X, od xLast w stronę -X.
export function slotRow(CS, { count, slotX, slotY, slotR, pitch, xLast }, track) {
  if (count <= 0) return null;
  const slot = roundedRect(CS, slotX, slotY, slotR, track);
  const holes = [];
  for (let i = 0; i < count; i++) holes.push(at(slot, xLast - i * pitch, 0, track));
  return track(CS.union(holes));
}
