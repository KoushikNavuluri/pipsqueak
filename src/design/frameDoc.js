// Builds the HTML document a screen renders in. Screens are sandboxed
// iframes; the design system arrives as CSS variables wired into Tailwind's
// theme, so changing a token restyles every screen without regenerating it.
import { FONTS, fontStack, fontsUrl } from "./fonts.js";
import { BRIDGE } from "./bridge.js";

const TAILWIND = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4";
export const ICON_FAMILIES = {
  outlined: "Material Symbols Outlined",
  rounded: "Material Symbols Rounded",
  sharp: "Material Symbols Sharp",
};

export const COLOR_KEYS = ["bg", "surface", "surface2", "ink", "muted", "line", "primary", "onPrimary", "accent", "onAccent"];
const cssName = (k) => k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()).replace("surface2", "surface-2");

const SHADOWS = {
  none: "none",
  soft: "0 1px 2px rgb(0 0 0 / 0.04), 0 12px 32px -12px rgb(0 0 0 / 0.14)",
  crisp: "0 1px 0 rgb(0 0 0 / 0.06), 0 2px 6px -2px rgb(0 0 0 / 0.12)",
  hard: "4px 4px 0 0 var(--pq-ink)",
  glow: "0 0 0 1px rgb(255 255 255 / 0.06), 0 20px 50px -20px var(--pq-primary)",
};

// CSS variables for a design system. Applied to :root and live-updatable.
export function systemVars(system) {
  const vars = {};
  for (const k of COLOR_KEYS) {
    vars[`--pq-${cssName(k)}`] = system.colors?.[k] || "#888888";
  }
  vars["--pq-font-display"] = fontStack(system.fonts?.display || "Inter");
  vars["--pq-font-body"] = fontStack(system.fonts?.body || "Inter");
  vars["--pq-font-mono"] = fontStack(system.fonts?.mono || "JetBrains Mono", "mono");
  const r = system.radius || {};
  vars["--pq-radius-sm"] = `${r.sm ?? 6}px`;
  vars["--pq-radius-md"] = `${r.md ?? 10}px`;
  vars["--pq-radius-lg"] = `${r.lg ?? 16}px`;
  vars["--pq-radius-xl"] = `${r.xl ?? 24}px`;
  vars["--pq-shadow"] = SHADOWS[system.shadow] || SHADOWS.soft;
  vars["--pq-display-weight"] = String(system.type?.displayWeight ?? 600);
  vars["--pq-display-tracking"] = system.type?.displayTracking || "-0.02em";
  vars["--pq-display-case"] = system.type?.displayCase === "uppercase" ? "uppercase" : "none";
  vars["--pq-icon-weight"] = String(system.icons?.weight ?? 400);
  vars["--pq-icon-fill"] = String(system.icons?.fill ?? 0);
  return vars;
}

export const varsCss = (vars) => `:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")}}`;

export const THEME = `@theme {
  --color-bg: var(--pq-bg);
  --color-surface: var(--pq-surface);
  --color-surface-2: var(--pq-surface-2);
  --color-ink: var(--pq-ink);
  --color-muted: var(--pq-muted);
  --color-line: var(--pq-line);
  --color-primary: var(--pq-primary);
  --color-on-primary: var(--pq-on-primary);
  --color-accent: var(--pq-accent);
  --color-on-accent: var(--pq-on-accent);
  --font-display: var(--pq-font-display);
  --font-body: var(--pq-font-body);
  --font-sans: var(--pq-font-body);
  --font-mono: var(--pq-font-mono);
  --radius-sm: var(--pq-radius-sm);
  --radius-md: var(--pq-radius-md);
  --radius-lg: var(--pq-radius-lg);
  --radius-xl: var(--pq-radius-xl);
  --shadow-card: var(--pq-shadow);
}
@layer base {
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; background: var(--pq-bg); color: var(--pq-ink); font-family: var(--pq-font-body); -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; font-feature-settings: "ss01", "cv11"; }
  .font-display { font-weight: var(--pq-display-weight); letter-spacing: var(--pq-display-tracking); text-transform: var(--pq-display-case); }
  h1, h2, h3, h4 { text-wrap: balance; }
  p, li { text-wrap: pretty; }
  ::selection { background: color-mix(in srgb, var(--pq-primary) 22%, transparent); }
  input, textarea { caret-color: var(--pq-primary); }
  :focus-visible { outline: 2px solid var(--pq-primary); outline-offset: 2px; }
  img { display: block; max-width: 100%; }
  img[data-img] { object-fit: cover; background: var(--pq-surface-2); }
  .icon { font-family: var(--pq-icon-family); font-weight: normal; font-style: normal; font-size: 1.5rem; line-height: 1; letter-spacing: normal; text-transform: none; display: inline-block; white-space: nowrap; word-wrap: normal; direction: ltr; font-feature-settings: "liga"; -webkit-font-smoothing: antialiased; font-variation-settings: "FILL" var(--pq-icon-fill), "wght" var(--pq-icon-weight), "GRAD" 0, "opsz" 24; user-select: none; }
  .icon.filled { font-variation-settings: "FILL" 1, "wght" var(--pq-icon-weight), "GRAD" 0, "opsz" 24; }
  ::-webkit-scrollbar { width: 0; height: 0; }
  .pq-streaming .icon { visibility: hidden; }
  .pq-hints [data-nav] { outline: 2px dashed var(--pq-primary); outline-offset: 2px; animation: pqhint 1.6s ease-in-out infinite; }
  @keyframes pqhint { 50% { outline-offset: 5px; } }
}`;

// Icon names used in a screen, so the icon font can be subset to just those.
export function iconNames(html) {
  const names = new Set();
  const re = /<(?:span|i)[^>]*class="[^"]*\b(?:icon|material-symbols-\w+|material-icons)\b[^"]*"[^>]*>\s*([a-z0-9_]+)\s*</g;
  let m;
  while ((m = re.exec(html))) {
    names.add(m[1]);
  }
  return [...names].sort();
}

function iconsUrl(set, names) {
  if (!names.length) {
    return null;
  }
  const family = (ICON_FAMILIES[set] || ICON_FAMILIES.rounded).replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${family}:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=${names.join(",")}&display=block`;
}

const hashString = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
};
const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]);

// An art-directed placeholder for an image that hasn't been painted yet: a
// tonal field in the system's colors with the subject set in small mono type.
export function placeholderImage(subject, colors) {
  const h = hashString(subject || "image");
  const angle = h % 360;
  const a = colors?.surface2 || "#E8E4DC";
  const b = colors?.[h % 2 ? "primary" : "accent"] || "#8A8A92";
  const ink = colors?.muted || "#6B6B6B";
  const label = esc((subject || "").split(/[,.;]/)[0].slice(0, 34));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}" stop-opacity=".35"/></linearGradient><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .07 0"/></filter></defs><rect width="400" height="300" fill="${a}"/><rect width="400" height="300" fill="url(#g)"/><rect width="400" height="300" filter="url(#n)"/><text x="200" y="154" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9" letter-spacing=".6" fill="${ink}" opacity=".7">${label.toUpperCase()}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// Gives every unpainted image a source: a painted kit image when one exists,
// otherwise the placeholder.
export function resolveImages(html, system, kit = []) {
  return html.replace(/<img\b([^>]*)>/g, (tag, attrs) => {
    const subject = /data-img="([^"]*)"/.exec(attrs)?.[1];
    const kitIndex = /data-kit="(\d+)"/.exec(attrs)?.[1];
    const hasSrc = /\ssrc="(?!data:image\/svg)[^"]+"/.test(attrs);
    if (hasSrc || (subject === undefined && kitIndex === undefined)) {
      return tag;
    }
    const kitItem = kitIndex !== undefined ? kit[Number(kitIndex)] : null;
    const src = kitItem?.url || placeholderImage(kitItem?.subject || subject || "image", system.colors);
    const clean = attrs.replace(/\ssrc="[^"]*"/, "");
    return `<img src="${esc(src)}"${clean}>`;
  });
}

// The full document for one screen.
// mode: "edit" (select and inline-edit), "view" (static), "play" (prototype)
// or "export" (no bridge at all).
// In the editor a web page's frame grows to the page's full length, so
// viewport units are pinned to the design viewport's height instead of the
// frame's; otherwise every min-h-screen section would grow with the frame.
const pinViewport = (vh) =>
  `<style id="pq-pin">:root{--pq-vh:${vh}px}.min-h-screen,.min-h-dvh,.min-h-svh,.min-h-lvh{min-height:var(--pq-vh)!important}.h-screen,.h-dvh,.h-svh,.h-lvh{height:var(--pq-vh)!important}.max-h-screen,.max-h-dvh{max-height:var(--pq-vh)!important}</style>`;

// Reports the CSS Tailwind compiled for this document to the app (see cssCache.js).
const CAPTURE = `<script>(function(){var t;function c(){var l=document.head.querySelectorAll("style:not([id]):not([type])"),s=l[l.length-1];if(s&&s.textContent.length>200)parent.postMessage({__pq:1,type:"css",css:s.textContent},"*")}new MutationObserver(function(){clearTimeout(t);t=setTimeout(c,400)}).observe(document.head,{childList:true,subtree:true,characterData:true});setTimeout(c,1500)})()</script>`;

// mode: "edit" | "view" | "play" (with the bridge), "thumb" (static preview
// that reports its compiled CSS) or "export" (no scripts). With `css`, the
// compiled stylesheet is inlined and Tailwind's compiler isn't loaded; editor
// frames load it on demand when an edit needs classes the CSS doesn't have.
// light: a preview that only shows the top of the page; the browser skips
// layout and paint for sections below it.
const LIGHT = `<style id="pq-light">body>*>*{content-visibility:auto;contain-intrinsic-size:auto 640px}</style>`;

export function buildFrameDoc({ html, system, kit = [], mode = "view", frameId = "", width = 390, vh = null, canvas = false, css = null, light = false }) {
  const fonts = [system.fonts?.display, system.fonts?.body, system.fonts?.mono].filter((f) => FONTS[f]);
  const fontLink = fontsUrl(fonts);
  const iconSet = system.icons?.set || "rounded";
  const iconLink = iconsUrl(iconSet, iconNames(html));
  const vars = { ...systemVars(system), "--pq-icon-family": `"${ICON_FAMILIES[iconSet] || ICON_FAMILIES.rounded}"` };
  const body = resolveImages(html, system, kit);
  const lazyTw = css && (mode === "edit" || mode === "view") ? { src: TAILWIND, theme: THEME } : undefined;
  const bridge =
    mode === "export" ? "" : mode === "thumb" ? (css ? "" : CAPTURE) : `<script>window.__PQ=${JSON.stringify({ frameId, mode, canvas, tw: lazyTw })};${BRIDGE}</script>`;
  const styles = css ? `<style id="pq-css">${css}</style>` : `<script src="${TAILWIND}"></script>\n<style type="text/tailwindcss">${THEME}</style>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width}, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fontLink ? `<link rel="stylesheet" href="${fontLink}">` : ""}
${iconLink ? `<link rel="stylesheet" href="${iconLink}">` : ""}
<style id="pq-vars">${varsCss(vars)}</style>
${styles}
${vh && mode !== "export" && mode !== "thumb" ? pinViewport(vh) : ""}
${light ? LIGHT : ""}
</head>
<body>
${body}
${bridge}
</body>
</html>`;
}
