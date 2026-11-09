// The carousel design system: formats, art directions ("styles") and the
// color helpers that keep AI-chosen palettes readable. Style ids match
// supabase/functions/carousel/prompts.ts.

export const FORMATS = {
  "4:5": { w: 1080, h: 1350, label: "Portrait 4:5", note: "1080 × 1350 · safest for the feed" },
  "1:1": { w: 1080, h: 1080, label: "Square 1:1", note: "1080 × 1080" },
  "3:4": { w: 1080, h: 1440, label: "Tall 3:4", note: "1080 × 1440 · matches the new grid; post from the app" },
};

const SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, monospace";

// Each style is a recipe the layouts read: fonts, how headlines and numbers
// look, the background, cards, photo frames and the slide chrome.
export const STYLES = {
  editorial: {
    name: "Editorial",
    blurb: "Magazine feature: serif headlines, warm paper, pull quotes",
    google: ["Playfair+Display:ital,wght@0,500..900;1,500..900", "Inter:wght@400..800"],
    display: `'Playfair Display', ${SERIF}`,
    body: `'Inter', ${SANS}`,
    label: `'Inter', ${SANS}`,
    titleWeight: 700,
    titleCase: "none",
    titleTracking: "-0.025em",
    titleLeading: 1.02,
    titleScale: 1,
    highlight: "italic",
    background: "paper",
    card: "rule",
    number: "serif-italic",
    frame: "bleed",
    chrome: "folio",
    radius: 0,
    sample: { bg: "#F4EFE6", ink: "#1B1712", muted: "#5F564A", accent: "#B4361E", onAccent: "#FFFFFF", surface: "#FBF8F2" },
  },
  bold: {
    name: "Bold type",
    blurb: "Huge condensed type, color fields, highlighter words",
    google: ["Anton", "Inter:wght@400..800"],
    display: `'Anton', 'Impact', ${SANS}`,
    body: `'Inter', ${SANS}`,
    label: `'Inter', ${SANS}`,
    titleWeight: 400,
    titleCase: "upper",
    titleTracking: "0.005em",
    titleLeading: 1.04,
    titleScale: 1.18,
    highlight: "marker",
    background: "flat",
    card: "solid",
    number: "outline",
    frame: "cutout",
    chrome: "chip",
    radius: 28,
    sample: { bg: "#FFE14D", ink: "#111111", muted: "#3D3A2E", accent: "#FF3D2E", onAccent: "#111111", surface: "#FFFFFF" },
  },
  swiss: {
    name: "Swiss grid",
    blurb: "Neutral sans, white space, one sharp accent, big numerals",
    google: ["Inter+Tight:wght@400..900"],
    display: `'Inter Tight', ${SANS}`,
    body: `'Inter Tight', ${SANS}`,
    label: `'Inter Tight', ${SANS}`,
    titleWeight: 800,
    titleCase: "none",
    titleTracking: "-0.045em",
    titleLeading: 0.98,
    titleScale: 1,
    highlight: "color",
    background: "grid",
    card: "outline",
    number: "huge",
    frame: "block",
    chrome: "bar",
    radius: 0,
    sample: { bg: "#F7F7F5", ink: "#111111", muted: "#6B6B6B", accent: "#D93A10", onAccent: "#FFFFFF", surface: "#FFFFFF" },
  },
  noir: {
    name: "Dark tech",
    blurb: "Near-black, glowing gradients, glass cards, mono labels",
    google: ["Space+Grotesk:wght@400..700", "JetBrains+Mono:wght@400..700"],
    display: `'Space Grotesk', ${SANS}`,
    body: `'Space Grotesk', ${SANS}`,
    label: `'JetBrains Mono', ${MONO}`,
    titleWeight: 700,
    titleCase: "none",
    titleTracking: "-0.035em",
    titleLeading: 1.0,
    titleScale: 1,
    highlight: "gradient",
    background: "glow",
    card: "glass",
    number: "mono",
    frame: "bleed",
    chrome: "mono",
    radius: 32,
    sample: { bg: "#0A0B10", ink: "#F2F3F7", muted: "#9298A8", accent: "#7CF5D4", onAccent: "#0A0B10", surface: "#161925" },
  },
  documentary: {
    name: "Documentary",
    blurb: "Real photos on every slide, captions, film grain",
    google: ["Oswald:wght@400..700", "Source+Serif+4:ital,wght@0,400..700;1,400..700"],
    display: `'Oswald', 'Arial Narrow', ${SANS}`,
    body: `'Source Serif 4', ${SERIF}`,
    label: `'Oswald', ${SANS}`,
    titleWeight: 600,
    titleCase: "upper",
    titleTracking: "0.005em",
    titleLeading: 1.08,
    titleScale: 1.05,
    highlight: "box",
    background: "film",
    card: "caption",
    number: "box",
    frame: "bleed",
    chrome: "lowerthird",
    radius: 0,
    sample: { bg: "#121212", ink: "#F5F2EA", muted: "#B9B2A3", accent: "#F2C230", onAccent: "#121212", surface: "#1E1E1E" },
  },
  notebook: {
    name: "Notebook",
    blurb: "Lined paper, marker highlights, taped polaroids",
    google: ["Caveat:wght@500..700", "Nunito:wght@400..800"],
    display: `'Nunito', ${SANS}`,
    body: `'Nunito', ${SANS}`,
    label: `'Caveat', cursive`,
    hand: `'Caveat', cursive`,
    titleWeight: 800,
    titleCase: "none",
    titleTracking: "-0.02em",
    titleLeading: 1.06,
    titleScale: 0.95,
    highlight: "marker",
    background: "lined",
    card: "paper",
    number: "hand",
    frame: "polaroid",
    chrome: "page",
    radius: 14,
    sample: { bg: "#FBF7EC", ink: "#22262E", muted: "#5B6170", accent: "#FFD84D", onAccent: "#22262E", surface: "#FFFFFF" },
  },
  data: {
    name: "Data poster",
    blurb: "Big stats, bar meters, mono numerals, tight grid",
    google: ["Archivo:wdth,wght@62..125,400..900", "IBM+Plex+Mono:wght@400;500;600"],
    display: `'Archivo', ${SANS}`,
    body: `'Archivo', ${SANS}`,
    label: `'IBM Plex Mono', ${MONO}`,
    titleWeight: 800,
    titleCase: "none",
    titleTracking: "-0.03em",
    titleLeading: 1.0,
    titleScale: 1,
    titleStretch: "88%",
    highlight: "underline",
    background: "dots",
    card: "outline",
    number: "mono",
    frame: "block",
    chrome: "figure",
    radius: 6,
    sample: { bg: "#0E1A2B", ink: "#EAF0F7", muted: "#93A4BA", accent: "#3DDC97", onAccent: "#0E1A2B", surface: "#15243A" },
  },
  collage: {
    name: "Collage",
    blurb: "Tilted photo cut-outs, paper shapes, stickers",
    google: ["Bricolage+Grotesque:opsz,wght@12..96,400..800", "DM+Sans:wght@400..700"],
    display: `'Bricolage Grotesque', ${SANS}`,
    body: `'DM Sans', ${SANS}`,
    label: `'DM Sans', ${SANS}`,
    titleWeight: 800,
    titleCase: "none",
    titleTracking: "-0.04em",
    titleLeading: 0.96,
    titleScale: 1.04,
    highlight: "sticker",
    background: "shapes",
    card: "paper",
    number: "sticker",
    frame: "tilted",
    chrome: "sticker",
    radius: 22,
    sample: { bg: "#F3EADF", ink: "#1D1A16", muted: "#5D5448", accent: "#2F5BFF", onAccent: "#FFFFFF", surface: "#FFFFFF" },
  },
};

export const STYLE_IDS = Object.keys(STYLES);
export const styleOf = (id) => STYLES[id] || STYLES.editorial;

// ---------- Fonts ----------

const loaded = new Set();

// Adds the style's Google Fonts once. `crossorigin` lets the exporter read
// the font rules and embed the files in PNGs.
export function ensureFonts(styleId) {
  if (typeof document === "undefined") return;
  const st = styleOf(styleId);
  for (const fam of st.google) {
    if (loaded.has(fam)) continue;
    loaded.add(fam);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.crossOrigin = "anonymous";
    link.href = `https://fonts.googleapis.com/css2?family=${fam}&display=block`;
    link.dataset.carouselFont = fam;
    document.head.appendChild(link);
  }
}

// Resolves once the style's fonts can be drawn (or after a timeout).
export async function fontsReady(styleId, timeout = 6000) {
  if (typeof document === "undefined" || !document.fonts) return;
  ensureFonts(styleId);
  const st = styleOf(styleId);
  const families = [st.display, st.body, st.label, st.hand].filter(Boolean).map((f) => f.split(",")[0].trim());
  const loads = [...new Set(families)].flatMap((f) => [document.fonts.load(`400 40px ${f}`), document.fonts.load(`700 40px ${f}`)]);
  await Promise.race([Promise.allSettled(loads), new Promise((r) => setTimeout(r, timeout))]);
}

// ---------- Color ----------

export const isHex = (c) => /^#[0-9a-fA-F]{6}$/.test(c || "");

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex) {
  if (!isHex(hex)) return 0;
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

export const isDark = (hex) => luminance(hex) < 0.22;

export function mix(a, b, t) {
  if (!isHex(a) || !isHex(b)) return a;
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export const alpha = (hex, a) => {
  if (!isHex(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// Whichever of two colors reads better on `bg`.
const better = (bg, a, b) => (contrast(bg, a) >= contrast(bg, b) ? a : b);

// A palette that is always readable: ink 7:1, muted 4.5:1, onAccent 4.5:1.
export function safePalette(p, styleId) {
  const base = styleOf(styleId).sample;
  const pal = { ...base, ...Object.fromEntries(Object.entries(p || {}).filter(([, v]) => isHex(v))) };
  // A mid-tone background can't carry text; push it lighter or darker first.
  for (let i = 0; i < 4 && Math.max(contrast(pal.bg, "#111111"), contrast(pal.bg, "#F7F7F5")) < 7; i++) {
    pal.bg = luminance(pal.bg) > 0.18 ? mix(pal.bg, "#FFFFFF", 0.45) : mix(pal.bg, "#000000", 0.45);
  }
  if (contrast(pal.ink, pal.bg) < 7) pal.ink = better(pal.bg, "#111111", "#F7F7F5");
  if (contrast(pal.muted, pal.bg) < 4.5) pal.muted = mix(pal.ink, pal.bg, 0.3);
  if (contrast(pal.onAccent, pal.accent) < 4.5) pal.onAccent = better(pal.accent, "#111111", "#FFFFFF");
  if (contrast(pal.ink, pal.surface) < 7) pal.surface = isDark(pal.bg) ? mix(pal.bg, "#FFFFFF", 0.08) : mix(pal.bg, "#FFFFFF", 0.6);
  // Accent used as text needs 3:1 on bg; otherwise text uses ink and the accent stays a fill.
  pal.accentText = contrast(pal.accent, pal.bg) >= 3 ? pal.accent : pal.ink;
  return pal;
}
