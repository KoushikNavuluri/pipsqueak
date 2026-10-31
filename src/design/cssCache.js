// Compiled Tailwind CSS for screens, so frames don't have to compile it again.
//
// Every screen renders in an iframe that runs Tailwind's in-browser compiler,
// which costs a script download, a full CSS build and a relayout per frame. A
// dashboard of designs or a studio with several screens did that once per
// frame, every time it mounted. Frames now hand their compiled CSS back to the
// app; it is kept in memory and in IndexedDB, keyed by a hash of the screen's
// HTML, and later renders of the same HTML use it as a static stylesheet.
//
// Colors and fonts are CSS variables, so the cached CSS stays valid when the
// design system changes. Bump VERSION when the frame's base CSS (THEME) changes.

const VERSION = 1;
const mem = new Map();
let dbPromise = null;

// cyrb53: a fast, well-distributed 53-bit string hash.
function hash(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export const cssKey = (html) => `${VERSION}:${hash(String(html || ""))}`;

function db() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  dbPromise ||= new Promise((resolve) => {
    const req = indexedDB.open("pipsqueak-css", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("css");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return dbPromise;
}

// Synchronous lookup of what's already in memory.
export function cachedCss(html) {
  return html ? mem.get(cssKey(html)) || null : null;
}

// Pulls any stored CSS for these screens into memory.
export async function loadCss(htmls) {
  const keys = [...new Set(htmls.filter(Boolean).map(cssKey))].filter((k) => !mem.has(k));
  if (!keys.length) return;
  const d = await db();
  if (!d) return;
  await new Promise((resolve) => {
    const store = d.transaction("css").objectStore("css");
    let left = keys.length;
    for (const k of keys) {
      const req = store.get(k);
      req.onsuccess = () => {
        if (req.result) mem.set(k, req.result);
        if (!--left) resolve();
      };
      req.onerror = () => !--left && resolve();
    }
  });
}

export function saveCss(html, css) {
  if (!html || !css || css.length < 200) return;
  const k = cssKey(html);
  if (mem.get(k) === css) return;
  mem.set(k, css);
  db().then((d) => d?.transaction("css", "readwrite").objectStore("css").put(css, k));
}

// Measured content heights of full-length frames, so they mount at their
// final size instead of laying out twice. Tiny, so localStorage is fine.
const HEIGHTS_KEY = "pipsqueak.frameHeights";
let heights = null;
function heightMap() {
  if (!heights) {
    try {
      heights = JSON.parse(localStorage.getItem(HEIGHTS_KEY) || "{}");
    } catch {
      heights = {};
    }
  }
  return heights;
}
export function knownHeight(width, html) {
  return heightMap()[`${width}:${cssKey(html)}`] || null;
}
let saveTimer = null;
export function rememberHeight(width, html, h) {
  const map = heightMap();
  const k = `${width}:${cssKey(html)}`;
  if (map[k] === h) return;
  map[k] = h;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const keys = Object.keys(map);
    if (keys.length > 600) keys.slice(0, keys.length - 600).forEach((x) => delete map[x]);
    try {
      localStorage.setItem(HEIGHTS_KEY, JSON.stringify(map));
    } catch {
      // Storage full or unavailable: heights are only an optimization.
    }
  }, 1000);
}
