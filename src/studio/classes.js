// Deterministic property editing: each control swaps one group of Tailwind
// classes on the selected element. No model call, instant, undoable.

const TOKENS = "bg|surface|surface-2|ink|muted|line|primary|on-primary|accent|on-accent";
export const GROUPS = {
  family: /^font-(display|body|mono|sans|serif)$/,
  size: /^text-(xs|sm|base|lg|xl|[2-9]xl|\[[\d.]+(px|rem|em)\])$/,
  weight: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[\d+\])$/,
  tracking: /^tracking-(tighter|tight|normal|wide|wider|widest|\[[-\d.]+em\])$/,
  leading: /^leading-(none|tight|snug|normal|relaxed|loose|\d+|\[[\d.]+\])$/,
  align: /^text-(left|center|right|justify)$/,
  textColor: new RegExp(`^text-(${TOKENS})(\\/\\d+)?$`),
  fill: new RegExp(`^bg-(${TOKENS}|transparent)(\\/\\d+)?$`),
  radius: /^rounded(-(none|sm|md|lg|xl|2xl|3xl|full))?$/,
  padding: /^p-(\d+(\.\d+)?|\[\d+px\])$/,
  case: /^(uppercase|lowercase|capitalize|normal-case)$/,
  shadow: /^shadow(-(card|none|sm|md|lg))?$/,
};

export const splitClasses = (s) => String(s || "").split(/\s+/).filter(Boolean);

// The current value of a group (ignores variant-prefixed classes like md:).
export function getGroup(className, group) {
  return splitClasses(className).find((c) => GROUPS[group].test(c)) || null;
}

// Replaces a group's class (base, unprefixed) with value, or removes it.
export function setGroup(className, group, value) {
  const kept = splitClasses(className).filter((c) => !GROUPS[group].test(c));
  if (value) {
    kept.push(value);
  }
  return kept.join(" ");
}

export const SIZE_STEPS = [11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72, 88, 104, 120];
const NAMED_SIZES = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36, "5xl": 48, "6xl": 60, "7xl": 72, "8xl": 96, "9xl": 128 };

export function sizeOf(className, fallbackPx) {
  const g = getGroup(className, "size");
  if (!g) {
    return fallbackPx;
  }
  const arb = /\[([\d.]+)(px|rem|em)\]/.exec(g);
  if (arb) {
    return arb[2] === "px" ? Number(arb[1]) : Math.round(Number(arb[1]) * 16);
  }
  return NAMED_SIZES[g.slice(5)] ?? fallbackPx;
}

export const WEIGHTS = [
  ["font-light", "Light"],
  ["font-normal", "Regular"],
  ["font-medium", "Medium"],
  ["font-semibold", "Semibold"],
  ["font-bold", "Bold"],
  ["font-black", "Black"],
];
export const TRACKING = [
  ["tracking-[-0.04em]", "Tight −4%"],
  ["tracking-[-0.02em]", "Snug −2%"],
  ["", "Normal"],
  ["tracking-[0.06em]", "Open +6%"],
  ["tracking-[0.14em]", "Wide +14%"],
];
export const RADII = [
  ["rounded-none", "0"],
  ["rounded-sm", "S"],
  ["rounded-md", "M"],
  ["rounded-lg", "L"],
  ["rounded-xl", "XL"],
  ["rounded-full", "Full"],
];
export const PADDINGS = [
  ["", "—"],
  ["p-2", "8"],
  ["p-3", "12"],
  ["p-4", "16"],
  ["p-5", "20"],
  ["p-6", "24"],
  ["p-8", "32"],
];
export const TEXT_TOKENS = ["ink", "muted", "primary", "accent", "on-primary", "on-accent", "surface"];
export const FILL_TOKENS = ["", "bg", "surface", "surface-2", "primary", "accent", "ink"];
