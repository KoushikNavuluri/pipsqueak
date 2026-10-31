// Design systems: normalizing what the model proposes, repairing contrast
// mathematically (keeping each color's hue), and exporting tokens.
import { FONTS } from "./fonts.js";
import { skillById } from "./skills.js";
import { COLOR_KEYS } from "./frameDoc.js";
import { cleanClasses } from "./lint.js";

// ---------- color math ----------
const isHex = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v.trim());
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbHex = (r) => "#" + r.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
function lum(hex) {
  return hexRgb(hex)
    .map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    })
    .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a, b) {
  const l1 = lum(a);
  const l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function toHsl([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) {
    return [0, 0, l];
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function fromHsl([h, s, l]) {
  if (s === 0) {
    return [l * 255, l * 255, l * 255];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

// Moves fg's lightness away from bg until the contrast target is met.
// Returns fg unchanged if it already passes.
export function towardContrast(fg, bg, target, maxShift = 1) {
  if (contrast(fg, bg) >= target) {
    return fg;
  }
  const [h, s, l] = toHsl(hexRgb(fg));
  const darker = lum(bg) > 0.18;
  for (let step = 0.01; step <= maxShift; step += 0.01) {
    const nl = Math.max(0, Math.min(1, darker ? l - step : l + step));
    const candidate = rgbHex(fromHsl([h, s, nl]));
    if (contrast(candidate, bg) >= target) {
      return candidate;
    }
    if (nl === 0 || nl === 1) {
      break;
    }
  }
  return darker ? "#111111" : "#F5F5F5";
}

function pickOn(fill, preferred, ink, bg) {
  for (const c of [preferred, "#FFFFFF", ink, bg, "#111111"]) {
    if (isHex(c) && contrast(c, fill) >= 4.5) {
      return c;
    }
  }
  return null;
}

// Makes every color role readable without changing the system's character.
export function repairColors(colors) {
  const c = { ...colors };
  c.ink = towardContrast(c.ink, c.bg, 7);
  c.ink = towardContrast(c.ink, c.surface, 6);
  c.muted = towardContrast(c.muted, c.bg, 4.6);
  c.muted = towardContrast(c.muted, c.surface, 4.5);
  for (const [fill, on] of [
    ["primary", "onPrimary"],
    ["accent", "onAccent"],
  ]) {
    let picked = pickOn(c[fill], c[on], c.ink, c.bg);
    if (!picked) {
      // Neither light nor dark text works: deepen or lighten the fill a little.
      const light = lum(c[fill]) > 0.3;
      c[fill] = towardContrast(c[fill], light ? "#111111" : "#FFFFFF", 4.6, 0.35);
      picked = pickOn(c[fill], c[on], c.ink, c.bg) || (light ? "#111111" : "#FFFFFF");
    }
    c[on] = picked;
  }
  // Primary is also used for links and emphasis words on the background.
  const asText = towardContrast(c.primary, c.bg, 4.5, 0.2);
  if (contrast(asText, c.bg) >= 4.5 && pickOn(asText, c.onPrimary, c.ink, c.bg)) {
    c.primary = asText;
    c.onPrimary = pickOn(asText, c.onPrimary, c.ink, c.bg);
  } else {
    c.primary = towardContrast(c.primary, c.bg, 3, 0.3);
    c.onPrimary = pickOn(c.primary, c.onPrimary, c.ink, c.bg) || c.onPrimary;
  }
  return c;
}

// ---------- normalizing ----------
const NEUTRAL = { bg: "#F7F6F3", surface: "#FFFFFF", surface2: "#EFEDE8", ink: "#16161A", muted: "#5F5E66", line: "#DEDBD3", primary: "#1F4FE0", onPrimary: "#FFFFFF", accent: "#FF6A3D", onAccent: "#16161A" };
const SHADOWS = ["none", "soft", "crisp", "hard", "glow"];
const RECIPES = ["buttonPrimary", "buttonSecondary", "buttonGhost", "card", "input", "chip", "listRow", "sectionTitle", "eyebrow", "displayHeadline", "bigNumber", "nav", "navItem", "divider"];
const int = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : d);

const LAYOUT_KEYS = ["grid", "header", "surfaces", "navigation", "imagery", "rhythm", "heroComposition"];

export function normalizeSystem(raw, fallbackSkill) {
  const r = raw && typeof raw === "object" ? raw : {};
  const skill = skillById(r.skill || fallbackSkill);
  const d = skill.defaults;
  const colors = {};
  for (const k of COLOR_KEYS) {
    const v = r.colors?.[k];
    colors[k] = isHex(v) ? v.trim().toUpperCase() : NEUTRAL[k];
  }
  const font = (name, role) => (FONTS[name] ? name : d.fonts[role]);
  const components = {};
  for (const k of RECIPES) {
    components[k] = cleanClasses(typeof r.components?.[k] === "string" ? r.components[k] : "");
  }
  const tracking = typeof r.type?.displayTracking === "string" && /^-?\d*\.?\d+(em|px)$/.test(r.type.displayTracking.trim()) ? r.type.displayTracking.trim() : d.type.displayTracking;
  return {
    skill: skill.id,
    name: String(r.name || skill.name).slice(0, 40),
    pitch: String(r.pitch || skill.tagline).slice(0, 240),
    colors: repairColors(colors),
    fonts: { display: font(r.fonts?.display, "display"), body: font(r.fonts?.body, "body"), mono: font(r.fonts?.mono, "mono") },
    type: {
      displayWeight: Math.round(int(r.type?.displayWeight, 100, 900, d.type.displayWeight) / 100) * 100,
      displayTracking: tracking,
      displayCase: r.type?.displayCase === "uppercase" ? "uppercase" : "none",
      scale: String(r.type?.scale || "12/15/20/32/56").slice(0, 60),
    },
    radius: {
      sm: int(r.radius?.sm, 0, 40, d.radius.sm),
      md: int(r.radius?.md, 0, 48, d.radius.md),
      lg: int(r.radius?.lg, 0, 56, d.radius.lg),
      xl: int(r.radius?.xl, 0, 64, d.radius.xl),
    },
    icons: {
      set: ["outlined", "rounded", "sharp"].includes(r.icons?.set) ? r.icons.set : d.icons.set,
      weight: Math.round(int(r.icons?.weight, 100, 700, d.icons.weight) / 100) * 100,
      fill: r.icons?.fill ? 1 : 0,
    },
    shadow: SHADOWS.includes(r.shadow) ? r.shadow : d.shadow,
    density: ["airy", "balanced", "compact"].includes(r.density) ? r.density : "balanced",
    imagery: String(r.imagery || skill.imagery).slice(0, 400),
    motion: String(r.motion || skill.motion).slice(0, 300),
    signature: (Array.isArray(r.signature) ? r.signature : skill.signature).slice(0, 4).map((s) => String(s).slice(0, 160)),
    scene: String(r.scene || "").slice(0, 240),
    strategy: ["restrained", "committed", "full", "drenched"].includes(r.strategy) ? r.strategy : "",
    layout: LAYOUT_KEYS.every((k) => typeof r.layout?.[k] === "string" && r.layout[k].trim()) ? Object.fromEntries(LAYOUT_KEYS.map((k) => [k, r.layout[k].trim().slice(0, 300)])) : null,
    components,
  };
}

// Applies a partial patch (from the copilot or the system panel).
export function patchSystem(system, patch) {
  if (!patch || typeof patch !== "object") {
    return system;
  }
  const next = {
    ...system,
    colors: { ...system.colors, ...(patch.colors || {}) },
    fonts: { ...system.fonts, ...(patch.fonts || {}) },
    radius: { ...system.radius, ...(patch.radius || {}) },
    icons: { ...system.icons, ...(patch.icons || {}) },
    type: {
      ...system.type,
      ...(patch.displayWeight ? { displayWeight: patch.displayWeight } : {}),
      ...(patch.displayTracking ? { displayTracking: patch.displayTracking } : {}),
      ...(patch.displayCase ? { displayCase: patch.displayCase } : {}),
    },
    ...(patch.shadow ? { shadow: patch.shadow } : {}),
  };
  return normalizeSystem(next, system.skill);
}

// ---------- exports ----------
const cssName = (k) => k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()).replace("surface2", "surface-2");

export function tokensCss(system) {
  const c = system.colors;
  const lines = COLOR_KEYS.map((k) => `  --color-${cssName(k)}: ${c[k]};`);
  return `@theme {
${lines.join("\n")}
  --font-display: "${system.fonts.display}", ${FONTS[system.fonts.display]?.kind === "serif" ? "Georgia, serif" : "system-ui, sans-serif"};
  --font-body: "${system.fonts.body}", system-ui, sans-serif;
  --font-sans: var(--font-body);
  --font-mono: "${system.fonts.mono}", ui-monospace, monospace;
  --radius-sm: ${system.radius.sm}px;
  --radius-md: ${system.radius.md}px;
  --radius-lg: ${system.radius.lg}px;
  --radius-xl: ${system.radius.xl}px;
}`;
}

export function designMd(project) {
  const s = project.system;
  const spec = project.spec || {};
  const yaml = [
    "---",
    `name: ${JSON.stringify(project.name)}`,
    `direction: ${s.skill}`,
    "colors:",
    ...COLOR_KEYS.map((k) => `  ${cssName(k)}: "${s.colors[k]}"`),
    "typography:",
    `  display: { fontFamily: "${s.fonts.display}", fontWeight: ${s.type.displayWeight}, letterSpacing: "${s.type.displayTracking}", textTransform: "${s.type.displayCase}" }`,
    `  body: { fontFamily: "${s.fonts.body}" }`,
    `  mono: { fontFamily: "${s.fonts.mono}" }`,
    `  scale: "${s.type.scale}"`,
    `rounded: { sm: ${s.radius.sm}px, md: ${s.radius.md}px, lg: ${s.radius.lg}px, xl: ${s.radius.xl}px }`,
    `icons: { family: "Material Symbols ${s.icons.set}", weight: ${s.icons.weight}, fill: ${s.icons.fill} }`,
    `shadow: ${s.shadow}`,
    "components:",
    ...Object.entries(s.components).map(([k, v]) => `  ${k}: "${v.replace(/"/g, "'")}"`),
    "---",
  ];
  const skill = skillById(s.skill);
  return `${yaml.join("\n")}

# ${project.name} design system

${s.pitch}

## Overview
${spec.summary || project.tagline || ""}
Audience: ${spec.audience || "—"}. Tone: ${(spec.tone || []).join(", ") || "—"}.

## Direction: ${s.name} (${skill.name})
${skill.typography}

${skill.color}

## Layout
${skill.layout}

## Components
${skill.components}

Use the recipes in the front matter verbatim for buttons, cards, inputs, chips, list rows, section titles, labels and navigation.

## Imagery
${s.imagery}

## Motion
${s.motion}

## Signature moves
${s.signature.map((x) => `- ${x}`).join("\n")}

## Do's and don'ts
${skill.never.map((x) => `- ${x}`).join("\n")}
- Use only the color tokens above; never raw hex or Tailwind's default palette.
`;
}
