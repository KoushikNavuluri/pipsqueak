// Keeps generated HTML on the design system. Tailwind palette classes and raw
// hex colors are mapped onto the semantic tokens, so a theme change always
// reaches every pixel and colors can't drift between screens. lintHtml
// reports the tells of templated, AI-made UI.

const GRAYS = "slate|gray|zinc|neutral|stone";
const HUES = "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PROPS = "bg|text|border|ring|from|via|to|fill|stroke|outline|divide|placeholder|decoration|accent|caret|shadow|border-t|border-b|border-l|border-r|border-x|border-y";
const PALETTE = new RegExp(`^((?:[a-z-]+:)*)(${PROPS})-(${GRAYS}|${HUES})-(\\d{2,3})((?:/\\d+)?)$`);
const PLAIN = new RegExp(`^((?:[a-z-]+:)*)(${PROPS})-(white|black)((?:/\\d+)?)$`);
const HEX = new RegExp(`^((?:[a-z-]+:)*)(${PROPS})-\\[#([0-9a-fA-F]{3,8})\\]((?:/\\d+)?)$`);

function tokenFor(prop, family, shade) {
  const gray = new RegExp(`^(${GRAYS})$`).test(family);
  const n = Number(shade);
  const isText = prop === "text" || prop === "placeholder" || prop === "decoration" || prop === "caret";
  const isLine = prop.startsWith("border") || prop === "divide" || prop === "ring" || prop === "outline";
  if (gray) {
    if (isText) return n >= 600 ? "ink" : "muted";
    if (isLine) return n >= 600 ? "ink" : "line";
    return n <= 50 ? "bg" : n <= 200 ? "surface-2" : n >= 800 ? "ink" : "line";
  }
  if (isText) return n <= 200 ? "on-primary" : "primary";
  if (isLine) return "primary";
  return n <= 100 ? "surface-2" : n <= 300 ? "primary/20" : "primary";
}

function lightHex(hex) {
  let h = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

function mapClass(cls) {
  let m = PALETTE.exec(cls);
  if (m) {
    const [, variants, prop, family, shade, opacity] = m;
    const token = tokenFor(prop, family, shade);
    return `${variants}${prop}-${token}${token.includes("/") ? "" : opacity}`;
  }
  m = PLAIN.exec(cls);
  if (m) {
    const [, variants, prop, color, opacity] = m;
    const token =
      color === "white"
        ? prop === "text" ? "on-primary" : prop === "bg" ? "surface" : "surface"
        : prop === "bg" ? "ink" : "ink";
    return `${variants}${prop}-${token}${opacity}`;
  }
  m = HEX.exec(cls);
  if (m) {
    const [, variants, prop, hex, opacity] = m;
    const light = lightHex(hex);
    const token = prop === "text" ? (light ? "on-primary" : "ink") : prop.startsWith("border") ? "line" : light ? "surface" : "ink";
    return `${variants}${prop}-${token}${opacity}`;
  }
  // Pixel values written as bare numbers (text-48, rounded-24) aren't
  // Tailwind classes and would silently do nothing.
  m = BARE_PX.exec(cls);
  if (m) {
    const [, variants, prop, n] = m;
    return mapClass(`${variants}${prop}-[${n}px]`);
  }
  // Text below 11px isn't readable on a screen; lift it to the floor.
  m = TINY_TEXT.exec(cls);
  if (m && Number(m[2]) < 11) {
    return `${m[1]}text-[11px]`;
  }
  return cls;
}

const BARE_PX = /^((?:[a-z-]+:)*)(text|rounded|rounded-[tblr]{1,2}|tracking)-(\d+(?:\.\d+)?)$/;
const TINY_TEXT = /^((?:[a-z-]+:)*)text-\[(\d+(?:\.\d+)?)px\]$/;

export function cleanClasses(str) {
  return String(str || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((c) => (c.includes("|") ? c : mapClass(c)))
    .join(" ")
    .replace(/\s*\|\s*/g, " | ");
}

// Rewrites every class attribute in a screen onto the tokens.
export function cleanHtml(html) {
  return String(html).replace(/\bclass="([^"]*)"/g, (_, cls) => `class="${cleanClasses(cls).replace(/ \| /g, " ")}"`);
}

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

// Tells of templated UI, for the review panel. Run on raw model output.
export function lintHtml(html) {
  const findings = [];
  const add = (kind, message, severity = "medium") => findings.push({ kind, message, severity });
  const classes = [...String(html).matchAll(/\bclass="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));
  const palette = classes.filter((c) => PALETTE.test(c) || PLAIN.test(c) || HEX.test(c));
  if (palette.length) {
    add("off-system", `${palette.length} color classes were off the design system and were mapped to tokens`, "low");
  }
  if (/style="[^"]*#[0-9a-f]{3,6}/i.test(html)) {
    add("raw-hex", "Inline styles use raw hex colors instead of tokens");
  }
  const text = String(html).replace(/<[^>]+>/g, " ");
  if (EMOJI.test(text)) {
    add("emoji", "Emoji are used in the interface; use icons instead");
  }
  if (/lorem ipsum|john doe|jane doe|item \d\b|placeholder text/i.test(text)) {
    add("filler", "Placeholder content (lorem ipsum, John Doe, Item 1)", "high");
  }
  if (/\b(unlock your|your journey|seamless(ly)?|supercharge|game.?changer|elevate your)\b/i.test(text)) {
    add("cliche", "Generic marketing copy that reads as AI-written");
  }
  const gradients = classes.filter((c) => /^(bg-gradient-to|bg-linear-to|bg-radial|bg-conic)/.test(c)).length;
  if (gradients > 2) {
    add("gradients", `${gradients} gradients on one screen`);
  }
  if (classes.some((c) => /^border-l-(4|8)$/.test(c)) && classes.some((c) => /^rounded/.test(c))) {
    add("left-accent", "A rounded card with a thick colored left border, a common AI tell", "low");
  }
  const shadows = classes.filter((c) => /^shadow(-|$)/.test(c)).length;
  if (shadows > 8) {
    add("shadows", `${shadows} shadowed elements; depth should come from surfaces and hairlines`, "low");
  }
  return findings;
}
