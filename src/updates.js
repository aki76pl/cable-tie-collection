// Sprawdzanie, czy na GitHubie jest nowsze wydanie aplikacji.
// Program niczego nie pobiera ani nie instaluje sam — tylko informuje i podaje link do strony wydania.

const REPO = 'aki76pl/cable-tie-collection';
export const APP_VERSION = __APP_VERSION__;
export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;

// Porównanie wersji „1.2.10” > „1.2.9”.
export function isNewer(tag, current = APP_VERSION) {
  const a = String(tag).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const b = String(current).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

// Zwraca { version, url, newer } albo rzuca błąd (brak sieci, limit API itp.).
export async function checkForUpdate() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`GitHub odpowiedział ${res.status}`);
    const rel = await res.json();
    const version = String(rel.tag_name || '').replace(/^v/, '');
    return { version, url: rel.html_url || RELEASES_URL, newer: isNewer(version) };
  } finally {
    clearTimeout(timer);
  }
}
