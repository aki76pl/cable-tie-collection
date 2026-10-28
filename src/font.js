// Prosta czcionka kreskowa do napisów na paskach (wielkie litery, cyfry, polskie znaki).
// Siatka: wysokość wersalika 6 jednostek, linia bazowa y = 0. Każdy znak to szerokość
// i lista łamanych „x y x y …” rozdzielonych średnikami. Kreski grubieją przy budowie bryły.

const ACUTE = '1.5 6.9 2.7 8';
const DOT = '2 7.4 2 7.4';
const O = '1 0 0 1 0 5 1 6 3 6 4 5 4 1 3 0 1 0';
const C = '4 5 3 6 1 6 0 5 0 1 1 0 3 0 4 1';
const S = '4 5 3 6 1 6 0 5 0 4 1 3 3 3 4 2 4 1 3 0 1 0 0 1';
const N = '0 0 0 6 4 0 4 6';
const Z = '0 6 4 6 0 0 4 0';
const A = '0 0 2 6 4 0; 0.7 2 3.3 2';
const E = '4 6 0 6 0 0 4 0; 0 3 3 3';
const P = '0 0 0 6 3 6 4 5 4 4 3 3 0 3';

const GLYPHS = {
  A: [4, A],
  B: [4, '0 0 0 6 3 6 4 5 4 4 3 3 0 3; 3 3 4 2 4 1 3 0 0 0'],
  C: [4, C],
  D: [4, '0 0 0 6 2.5 6 4 4.5 4 1.5 2.5 0 0 0'],
  E: [4, E],
  F: [4, '4 6 0 6 0 0; 0 3 3 3'],
  G: [4, '4 5 3 6 1 6 0 5 0 1 1 0 3 0 4 1 4 3 2 3'],
  H: [4, '0 0 0 6; 4 0 4 6; 0 3 4 3'],
  I: [0, '0 0 0 6'],
  J: [4, '4 6 4 1 3 0 1 0 0 1'],
  K: [4, '0 0 0 6; 4 6 0 2.5; 1.3 3.6 4 0'],
  L: [4, '0 6 0 0 4 0'],
  M: [5, '0 0 0 6 2.5 2.5 5 6 5 0'],
  N: [4, N],
  O: [4, O],
  P: [4, P],
  Q: [4, `${O}; 2.5 1.5 4 0`],
  R: [4, `${P}; 2 3 4 0`],
  S: [4, S],
  T: [4, '0 6 4 6; 2 6 2 0'],
  U: [4, '0 6 0 1 1 0 3 0 4 1 4 6'],
  V: [4, '0 6 2 0 4 6'],
  W: [5, '0 6 1.2 0 2.5 4 3.8 0 5 6'],
  X: [4, '0 0 4 6; 0 6 4 0'],
  Y: [4, '0 6 2 3 4 6; 2 3 2 0'],
  Z: [4, Z],
  'Ą': [4, `${A}; 4 0 3.3 -0.8 3.6 -1.4 4.2 -1.3`],
  'Ć': [4, `${C}; ${ACUTE}`],
  'Ę': [4, `${E}; 3.6 0 3 -0.8 3.3 -1.4 3.9 -1.3`],
  'Ł': [4, '0 6 0 0 4 0; -0.7 2.5 1.6 4.3'],
  'Ń': [4, `${N}; ${ACUTE}`],
  'Ó': [4, `${O}; ${ACUTE}`],
  'Ś': [4, `${S}; ${ACUTE}`],
  'Ź': [4, `${Z}; ${ACUTE}`],
  'Ż': [4, `${Z}; ${DOT}`],
  0: [4, `${O}; 4 5 0 1`],
  1: [2, '0 4.5 2 6 2 0'],
  2: [4, '0 5 1 6 3 6 4 5 4 4 0 0 4 0'],
  3: [4, '0 5 1 6 3 6 4 5 4 4 3 3 1.5 3; 3 3 4 2 4 1 3 0 1 0 0 1'],
  4: [4, '3 0 3 6 0 2 4 2'],
  5: [4, '4 6 0 6 0 3.5 3 3.5 4 2.5 4 1 3 0 1 0 0 1'],
  6: [4, '4 5 3 6 1 6 0 5 0 1 1 0 3 0 4 1 4 2 3 3 0 3'],
  7: [4, '0 6 4 6 1.5 0'],
  8: [4, '1 3 0 4 0 5 1 6 3 6 4 5 4 4 3 3 1 3 0 2 0 1 1 0 3 0 4 1 4 2 3 3'],
  9: [4, '0 1 1 0 3 0 4 1 4 5 3 6 1 6 0 5 0 4 1 3 4 3'],
  '-': [3, '0 3 3 3'],
  '+': [4, '0 3 4 3; 2 1 2 5'],
  '=': [4, '0 2 4 2; 0 4 4 4'],
  '.': [0, '0 0 0 0'],
  ',': [0.5, '0.5 0.3 0 -1'],
  ':': [0, '0 0 0 0; 0 4 0 4'],
  '/': [3, '0 0 3 6'],
  '#': [4, '1 0 1.6 6; 2.4 0 3 6; 0 2 4 2; 0 4 4 4'],
  '(': [1.5, '1.5 6 0 4 0 2 1.5 0'],
  ')': [1.5, '0 6 1.5 4 1.5 2 0 0'],
  '!': [0, '0 6 0 2; 0 0 0 0'],
  '?': [4, '0 5 1 6 3 6 4 5 4 4 2 3 2 2; 2 0 2 0'],
  "'": [0, '0 6 0 4.5'],
  ' ': [2, ''],
};

const parsed = new Map();
function glyph(ch) {
  if (!parsed.has(ch)) {
    const [w, src] = GLYPHS[ch];
    const strokes = src ? src.split(';').map((s) => {
      const n = s.trim().split(/\s+/).map(Number);
      const pts = [];
      for (let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]]);
      return pts;
    }) : [];
    parsed.set(ch, { w, strokes });
  }
  return parsed.get(ch);
}

export const MAX_TEXT = 16;
export const normalizeText = (s) => String(s ?? '').toUpperCase().slice(0, MAX_TEXT);
export const unsupportedChars = (s) => [...new Set([...normalizeText(s)].filter((c) => !(c in GLYPHS)))];

// Zwraca CrossSection napisu: wysokość wersalika `height` [mm], środek ramki w (0, 0).
// Tekst biegnie wzdłuż +X, górą liter w stronę +Y.
export function textSection(CS, text, height, track) {
  const s = height / 6;
  const stroke = Math.max(0.6, 0.9 * s);
  const r = stroke / 2;
  const dot = track(CS.circle(r, 12));
  const parts = [];
  let x = 0;
  for (const ch of normalizeText(text)) {
    if (!(ch in GLYPHS)) continue;
    const g = glyph(ch);
    for (const pts of g.strokes) {
      if (pts.length === 1) pts.push(pts[0]);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = track(dot.translate([(x + pts[i][0]) * s, pts[i][1] * s]));
        const b = track(dot.translate([(x + pts[i + 1][0]) * s, pts[i + 1][1] * s]));
        parts.push(track(CS.hull([a, b])));
      }
    }
    x += g.w + 2;
  }
  if (!parts.length) return null;
  const all = track(CS.union(parts));
  const b = all.bounds();
  return track(all.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]));
}
