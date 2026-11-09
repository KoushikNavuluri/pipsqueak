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

// Each theme is a full recipe, not just colors and fonts:
//   cover   how the first slide is composed: bleed (photo fills it), block
//           (text over a photo band), blocktop (photo band over text),
//           object (a photo object beside the title), stack (shaped photo
//           above centered text), rounded (text over an inset rounded photo),
//           side (photo column beside text), magazine (masthead cover),
//           poster (giant headline over a boxed photo)
//   photo   how photo slides are composed: bleed, band, side or shape
//   shape   the photo shape for object/stack/shape placements
//   align   left or center text; panel: none, card, glass, border or outline
//   number, kicker, highlight, background, card, chrome: the details
// so two themes never share the same composition.
export const STYLES = {
  editorial: {
    name: "Editorial",
    group: "Editorial",
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
    kicker: "dash",
    chrome: "folio",
    cover: "bleed",
    photo: "band",
    shape: "rect",
    align: "left",
    panel: "none",
    radius: 0,
    sample: { bg: "#F4EFE6", ink: "#1B1712", muted: "#5F564A", accent: "#B4361E", onAccent: "#FFFFFF", surface: "#FBF8F2" },
  },
  bold: {
    name: "Bold type",
    group: "Bold",
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
    kicker: "pill",
    chrome: "chip",
    cover: "object",
    photo: "shape",
    shape: "cutout",
    align: "left",
    panel: "none",
    radius: 28,
    sample: { bg: "#FFE14D", ink: "#111111", muted: "#3D3A2E", accent: "#FF3D2E", onAccent: "#111111", surface: "#FFFFFF" },
  },
  swiss: {
    name: "Swiss grid",
    group: "Modern",
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
    kicker: "dash",
    chrome: "bar",
    cover: "block",
    photo: "band",
    shape: "rect",
    align: "left",
    panel: "none",
    radius: 0,
    sample: { bg: "#F7F7F5", ink: "#111111", muted: "#6B6B6B", accent: "#D93A10", onAccent: "#FFFFFF", surface: "#FFFFFF" },
  },
  noir: {
    name: "Dark tech",
    group: "Modern",
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
    kicker: "dash",
    chrome: "mono",
    cover: "rounded",
    photo: "shape",
    shape: "rounded",
    align: "left",
    panel: "none",
    radius: 32,
    sample: { bg: "#0A0B10", ink: "#F2F3F7", muted: "#9298A8", accent: "#7CF5D4", onAccent: "#0A0B10", surface: "#161925" },
  },
  documentary: {
    name: "Documentary",
    group: "Photo",
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
    kicker: "dash",
    chrome: "lowerthird",
    cover: "bleed",
    photo: "bleed",
    shape: "rect",
    align: "left",
    panel: "none",
    radius: 0,
    sample: { bg: "#121212", ink: "#F5F2EA", muted: "#B9B2A3", accent: "#F2C230", onAccent: "#121212", surface: "#1E1E1E" },
  },
  notebook: {
    name: "Notebook",
    group: "Aesthetic",
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
    kicker: "hand",
    chrome: "page",
    cover: "object",
    photo: "shape",
    shape: "polaroid",
    align: "left",
    panel: "none",
    radius: 14,
    sample: { bg: "#FBF7EC", ink: "#22262E", muted: "#5B6170", accent: "#FFD84D", onAccent: "#22262E", surface: "#FFFFFF" },
  },
  data: {
    name: "Data poster",
    group: "Corporate",
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
    kicker: "dash",
    chrome: "figure",
    cover: "blocktop",
    photo: "band",
    shape: "rect",
    align: "left",
    panel: "none",
    radius: 6,
    sample: { bg: "#0E1A2B", ink: "#EAF0F7", muted: "#93A4BA", accent: "#3DDC97", onAccent: "#0E1A2B", surface: "#15243A" },
  },
  collage: {
    name: "Collage",
    group: "Bold",
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
    kicker: "pill",
    chrome: "sticker",
    cover: "object",
    photo: "shape",
    shape: "tilted",
    align: "left",
    panel: "none",
    radius: 22,
    sample: { bg: "#F3EADF", ink: "#1D1A16", muted: "#5D5448", accent: "#2F5BFF", onAccent: "#FFFFFF", surface: "#FFFFFF" },
  },
  minimal: {
    name: "Minimal",
    group: "Minimal",
    blurb: "Quiet and airy: centered light type, small photos, lots of space",
    google: ["Manrope:wght@300..800"],
    display: `'Manrope', ${SANS}`,
    body: `'Manrope', ${SANS}`,
    label: `'Manrope', ${SANS}`,
    titleWeight: 500,
    titleCase: "none",
    titleTracking: "-0.035em",
    titleLeading: 1.08,
    titleScale: 0.82,
    highlight: "color",
    background: "plain",
    card: "outline",
    number: "rule",
    kicker: "plain",
    chrome: "dots",
    cover: "stack",
    photo: "shape",
    shape: "rect",
    align: "center",
    panel: "none",
    radius: 0,
    sample: { bg: "#FAFAF7", ink: "#1A1A1A", muted: "#6E6E6A", accent: "#8C6E5A", onAccent: "#FFFFFF", surface: "#FFFFFF" },
  },
  luxury: {
    name: "Luxury",
    group: "Luxury",
    blurb: "Deep color, gold hairline frame, spaced serif capitals, arched photos",
    google: ["Cormorant+Garamond:ital,wght@0,400..700;1,400..700", "Montserrat:wght@400..700"],
    display: `'Cormorant Garamond', ${SERIF}`,
    body: `'Montserrat', ${SANS}`,
    label: `'Montserrat', ${SANS}`,
    titleWeight: 500,
    titleCase: "upper",
    titleTracking: "0.06em",
    titleLeading: 1.06,
    titleScale: 0.86,
    highlight: "italic",
    background: "lux",
    card: "outline",
    number: "roman",
    kicker: "flank",
    chrome: "frame",
    cover: "bleed",
    photo: "shape",
    shape: "arch",
    align: "center",
    panel: "none",
    photoDim: 0.22,
    radius: 0,
    sample: { bg: "#0F1F1A", ink: "#F3EBDD", muted: "#B9AE98", accent: "#C9A45C", onAccent: "#0F1F1A", surface: "#16291F" },
  },
  corporate: {
    name: "Corporate",
    group: "Corporate",
    blurb: "Clean business deck: white cards, brand bar, side photos, clear hierarchy",
    google: ["Plus+Jakarta+Sans:wght@400..800"],
    display: `'Plus Jakarta Sans', ${SANS}`,
    body: `'Plus Jakarta Sans', ${SANS}`,
    label: `'Plus Jakarta Sans', ${SANS}`,
    titleWeight: 800,
    titleCase: "none",
    titleTracking: "-0.03em",
    titleLeading: 1.06,
    titleScale: 0.9,
    highlight: "color",
    background: "corp",
    card: "outline",
    number: "pill",
    kicker: "tint",
    chrome: "corp",
    cover: "side",
    photo: "side",
    shape: "rounded",
    align: "left",
    panel: "card",
    radius: 24,
    sample: { bg: "#EEF2F8", ink: "#0B1B33", muted: "#4A5872", accent: "#1F5EFF", onAccent: "#FFFFFF", surface: "#FFFFFF" },
  },
  aesthetic: {
    name: "Aesthetic",
    group: "Aesthetic",
    blurb: "Soft pastel gradients, arched and round photos, elegant serif",
    google: ["DM+Serif+Display:ital@0;1", "DM+Sans:wght@400..700"],
    display: `'DM Serif Display', ${SERIF}`,
    body: `'DM Sans', ${SANS}`,
    label: `'DM Sans', ${SANS}`,
    titleWeight: 400,
    titleCase: "none",
    titleTracking: "-0.015em",
    titleLeading: 1.04,
    titleScale: 0.96,
    highlight: "italic",
    background: "mesh",
    card: "paper",
    number: "circle",
    kicker: "plain",
    chrome: "dots",
    cover: "stack",
    photo: "shape",
    shape: "arch",
    align: "center",
    panel: "none",
    radius: 40,
    sample: { bg: "#F7EFE9", ink: "#3A2A2A", muted: "#7A6460", accent: "#A4524D", onAccent: "#FFFFFF", surface: "#FFFFFF" },
  },
  retro: {
    name: "Retro",
    group: "Bold",
    blurb: "70s warmth: sunburst rays, fat rounded type, offset photo frames",
    google: ["Shrikhand", "Work+Sans:wght@400..800"],
    display: `'Shrikhand', ${SERIF}`,
    body: `'Work Sans', ${SANS}`,
    label: `'Work Sans', ${SANS}`,
    titleWeight: 400,
    titleCase: "none",
    titleTracking: "0",
    titleLeading: 1.1,
    titleScale: 0.88,
    highlight: "color",
    background: "sunburst",
    card: "paper",
    number: "badge",
    kicker: "pill",
    chrome: "retro",
    cover: "stack",
    photo: "shape",
    shape: "offset",
    align: "center",
    panel: "none",
    radius: 28,
    sample: { bg: "#F6E7C8", ink: "#2B1B12", muted: "#6B4E3A", accent: "#E2572B", onAccent: "#140A05", surface: "#FFF6E3" },
  },
  brutalist: {
    name: "Brutalist",
    group: "Bold",
    blurb: "Raw and loud: black borders, mono labels, giant poster headlines",
    google: ["Archivo+Black", "Space+Mono:wght@400;700"],
    display: `'Archivo Black', ${SANS}`,
    body: `'Space Mono', ${MONO}`,
    label: `'Space Mono', ${MONO}`,
    titleWeight: 400,
    titleCase: "upper",
    titleTracking: "-0.02em",
    titleLeading: 0.94,
    titleScale: 1.08,
    highlight: "invert",
    background: "brutal",
    card: "solid",
    number: "brutal",
    kicker: "box",
    chrome: "brutal",
    cover: "poster",
    photo: "shape",
    shape: "boxed",
    align: "left",
    panel: "border",
    radius: 0,
    sample: { bg: "#FFFFFF", ink: "#000000", muted: "#333333", accent: "#FF4F00", onAccent: "#000000", surface: "#FFFFFF" },
  },
  gradient: {
    name: "Gradient glass",
    group: "Modern",
    blurb: "Vivid mesh gradients, frosted glass cards, rounded geometric type",
    google: ["Sora:wght@300..800"],
    display: `'Sora', ${SANS}`,
    body: `'Sora', ${SANS}`,
    label: `'Sora', ${SANS}`,
    titleWeight: 700,
    titleCase: "none",
    titleTracking: "-0.04em",
    titleLeading: 1.02,
    titleScale: 0.92,
    highlight: "gradient",
    background: "vivid",
    card: "glass",
    number: "pill",
    kicker: "tint",
    chrome: "dots",
    cover: "stack",
    photo: "shape",
    shape: "card",
    align: "center",
    panel: "glass",
    radius: 40,
    sample: { bg: "#1B0F3A", ink: "#FFFFFF", muted: "#C9C2E6", accent: "#FF7AD9", onAccent: "#1B0F3A", surface: "#2A1B57" },
  },
  magazine: {
    name: "Magazine cover",
    group: "Editorial",
    blurb: "Fashion-magazine cover: masthead, full-bleed photo, Bodoni headlines",
    google: ["Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900", "Libre+Franklin:wght@400..800"],
    display: `'Bodoni Moda', ${SERIF}`,
    body: `'Libre Franklin', ${SANS}`,
    label: `'Libre Franklin', ${SANS}`,
    titleWeight: 700,
    titleCase: "none",
    titleTracking: "-0.03em",
    titleLeading: 0.98,
    titleScale: 1,
    highlight: "italic",
    background: "plain",
    card: "rule",
    number: "serif",
    kicker: "plain",
    chrome: "masthead",
    cover: "magazine",
    photo: "side",
    shape: "rect",
    align: "left",
    panel: "none",
    radius: 0,
    sample: { bg: "#FFFFFF", ink: "#111111", muted: "#555555", accent: "#D0021B", onAccent: "#FFFFFF", surface: "#F4F1EC" },
  },
};

export const STYLE_IDS = Object.keys(STYLES);
export const STYLE_GROUPS = ["Minimal", "Modern", "Editorial", "Corporate", "Bold", "Aesthetic", "Luxury", "Photo"];
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
