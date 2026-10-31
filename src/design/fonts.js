// The typefaces design systems may use. Each entry is a Google Fonts family
// with the axis spec to request and the character it brings. Keeping this
// list curated is deliberate: a good pairing from forty fonts beats a random
// pick from fifteen hundred.
export const FONTS = {
  // Serif display and text
  Fraunces: { spec: "ital,opsz,wght@0,9..144,300..900;1,9..144,300..900", kind: "serif", role: ["display", "body"], feel: "warm, literary, soft-edged old style with optical sizes" },
  "Instrument Serif": { spec: "ital@0;1", kind: "serif", role: ["display"], feel: "condensed, elegant, fashion-editorial; single weight, great with italics" },
  "Playfair Display": { spec: "ital,wght@0,400..900;1,400..900", kind: "serif", role: ["display"], feel: "high-contrast didone, classic luxury" },
  "DM Serif Display": { spec: "ital@0;1", kind: "serif", role: ["display"], feel: "punchy high-contrast serif for big headlines" },
  Newsreader: { spec: "ital,opsz,wght@0,6..72,200..800;1,6..72,200..800", kind: "serif", role: ["display", "body"], feel: "newspaper text face, calm and readable" },
  "Cormorant Garamond": { spec: "ital,wght@0,300..700;1,300..700", kind: "serif", role: ["display"], feel: "delicate Garamond display, quiet luxury" },
  "Bodoni Moda": { spec: "ital,opsz,wght@0,6..96,400..900;1,6..96,400..900", kind: "serif", role: ["display"], feel: "razor-sharp didone, couture" },
  "Young Serif": { spec: "", kind: "serif", role: ["display"], feel: "chunky friendly serif with character" },
  Gloock: { spec: "", kind: "serif", role: ["display"], feel: "heavy, tight, contemporary serif headlines" },
  "Source Serif 4": { spec: "ital,opsz,wght@0,8..60,200..900;1,8..60,200..900", kind: "serif", role: ["body"], feel: "sturdy reading serif" },
  "EB Garamond": { spec: "ital,wght@0,400..800;1,400..800", kind: "serif", role: ["display", "body"], feel: "bookish, scholarly" },

  // Grotesques and sans display
  "Space Grotesk": { spec: "wght@300..700", kind: "sans", role: ["display", "body"], feel: "quirky geometric grotesk, technical" },
  Syne: { spec: "wght@400..800", kind: "sans", role: ["display"], feel: "wide, art-school, expressive at heavy weights" },
  "Bricolage Grotesque": { spec: "opsz,wght@12..96,200..800", kind: "sans", role: ["display", "body"], feel: "lively grotesk with ink traps, friendly-editorial" },
  Unbounded: { spec: "wght@200..900", kind: "sans", role: ["display"], feel: "wide rounded geometric, loud and modern" },
  Archivo: { spec: "ital,wdth,wght@0,62..125,100..900;1,62..125,100..900", kind: "sans", role: ["display", "body"], feel: "workhorse grotesk with a width axis, from condensed to extended" },
  Anton: { spec: "", kind: "sans", role: ["display"], feel: "tall condensed impact headlines, posters" },
  "Big Shoulders Display": { spec: "wght@100..900", kind: "sans", role: ["display"], feel: "industrial condensed, signage" },
  "Familjen Grotesk": { spec: "ital,wght@0,400..700;1,400..700", kind: "sans", role: ["display", "body"], feel: "Scandinavian grotesk, precise and warm" },
  "Schibsted Grotesk": { spec: "ital,wght@0,400..900;1,400..900", kind: "sans", role: ["display", "body"], feel: "news-room grotesk, confident" },
  "Hanken Grotesk": { spec: "ital,wght@0,100..900;1,100..900", kind: "sans", role: ["body", "display"], feel: "clean neutral grotesk" },
  "Inter Tight": { spec: "ital,wght@0,100..900;1,100..900", kind: "sans", role: ["display"], feel: "tight neutral display, Swiss" },
  Geist: { spec: "wght@100..900", kind: "sans", role: ["display", "body"], feel: "crisp developer-tool sans" },
  Manrope: { spec: "wght@200..800", kind: "sans", role: ["body", "display"], feel: "modern geometric-humanist, product UI" },
  "Plus Jakarta Sans": { spec: "ital,wght@0,200..800;1,200..800", kind: "sans", role: ["body", "display"], feel: "friendly geometric, consumer apps" },
  Sora: { spec: "wght@100..800", kind: "sans", role: ["display", "body"], feel: "wide geometric, fintech and web3" },
  Outfit: { spec: "wght@100..900", kind: "sans", role: ["display", "body"], feel: "round geometric, approachable" },
  Figtree: { spec: "ital,wght@0,300..900;1,300..900", kind: "sans", role: ["body"], feel: "clean, friendly, highly legible" },
  Onest: { spec: "wght@100..900", kind: "sans", role: ["body"], feel: "contemporary neutral UI sans" },
  Epilogue: { spec: "ital,wght@0,100..900;1,100..900", kind: "sans", role: ["display", "body"], feel: "slightly quirky grotesk, editorial web" },
  "Instrument Sans": { spec: "ital,wdth,wght@0,75..100,400..700;1,75..100,400..700", kind: "sans", role: ["body", "display"], feel: "precise, compact, design-studio" },
  "DM Sans": { spec: "ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000", kind: "sans", role: ["body"], feel: "low-contrast geometric, calm" },
  Inter: { spec: "ital,opsz,wght@0,14..32,100..900;1,14..32,100..900", kind: "sans", role: ["body"], feel: "neutral UI workhorse" },
  "IBM Plex Sans": { spec: "ital,wght@0,100..700;1,100..700", kind: "sans", role: ["body", "display"], feel: "engineered, corporate-technical" },
  Rubik: { spec: "ital,wght@0,300..900;1,300..900", kind: "sans", role: ["display", "body"], feel: "softly rounded corners, friendly" },
  Nunito: { spec: "ital,wght@0,200..1000;1,200..1000", kind: "sans", role: ["body", "display"], feel: "rounded terminals, gentle" },
  Fredoka: { spec: "wght@300..700", kind: "sans", role: ["display"], feel: "bubbly rounded, playful" },
  "Chakra Petch": { spec: "ital,wght@0,300;0,400;0,500;0,600;0,700;1,400", kind: "sans", role: ["display"], feel: "angular sci-fi, gaming" },

  "Libre Caslon Display": { spec: "", kind: "serif", role: ["display"], feel: "refined Caslon for big editorial headlines" },
  Literata: { spec: "ital,opsz,wght@0,7..72,200..900;1,7..72,200..900", kind: "serif", role: ["body", "display"], feel: "contemporary book face, long reading" },
  Italiana: { spec: "", kind: "serif", role: ["display"], feel: "thin high-fashion display, couture" },
  "Host Grotesk": { spec: "ital,wght@0,300..800;1,300..800", kind: "sans", role: ["display", "body"], feel: "rational Swiss-leaning grotesk" },
  Jost: { spec: "ital,wght@0,100..900;1,100..900", kind: "sans", role: ["body", "display"], feel: "Futura-like geometric, elegant at light weights" },
  Chivo: { spec: "ital,wght@0,100..900;1,100..900", kind: "sans", role: ["body", "display"], feel: "sturdy grotesk for dense interfaces" },
  "Albert Sans": { spec: "ital,wght@0,100..900;1,100..900", kind: "sans", role: ["body", "display"], feel: "clean Scandinavian retail sans" },
  "Public Sans": { spec: "ital,wght@0,100..900;1,100..900", kind: "sans", role: ["body"], feel: "neutral, civic, highly legible" },
  "Atkinson Hyperlegible": { spec: "ital,wght@0,400;0,700;1,400;1,700", kind: "sans", role: ["body"], feel: "designed for low vision, maximally legible" },
  "Nunito Sans": { spec: "ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000", kind: "sans", role: ["body"], feel: "soft, warm, readable" },
  Anybody: { spec: "ital,wdth,wght@0,50..150,100..900;1,50..150,100..900", kind: "sans", role: ["display"], feel: "wild width axis from compressed to ultra-expanded" },
  "Baloo 2": { spec: "wght@400..800", kind: "sans", role: ["display"], feel: "round, chunky, friendly" },
  Silkscreen: { spec: "wght@400;700", kind: "sans", role: ["display"], feel: "pixel bitmap, retro computing; large sizes only" },

  // Mono
  "Martian Mono": { spec: "wdth,wght@75..112.5,100..800", kind: "mono", role: ["mono"], feel: "wide technical mono with character" },
  "Azeret Mono": { spec: "ital,wght@0,100..900;1,100..900", kind: "mono", role: ["mono"], feel: "geometric mono, print-like" },
  "JetBrains Mono": { spec: "ital,wght@0,100..800;1,100..800", kind: "mono", role: ["mono"], feel: "developer mono" },
  "IBM Plex Mono": { spec: "ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,400", kind: "mono", role: ["mono"], feel: "typewriter-technical" },
  "Space Mono": { spec: "ital,wght@0,400;0,700;1,400;1,700", kind: "mono", role: ["mono", "display"], feel: "retro-futurist mono with character" },
  "Geist Mono": { spec: "wght@100..900", kind: "mono", role: ["mono"], feel: "clean modern mono" },
  "DM Mono": { spec: "ital,wght@0,300;0,400;0,500;1,400", kind: "mono", role: ["mono"], feel: "soft geometric mono" },
};

export const FONT_NAMES = Object.keys(FONTS);

const GENERIC = { serif: "Georgia, serif", sans: "system-ui, sans-serif", mono: "ui-monospace, monospace" };

export function fontStack(name, fallbackKind = "sans") {
  const f = FONTS[name];
  return `"${name}", ${GENERIC[f?.kind || fallbackKind]}`;
}

// One Google Fonts stylesheet URL for a set of families.
export function fontsUrl(names) {
  const families = [...new Set(names.filter((n) => FONTS[n]))].map((n) => {
    const spec = FONTS[n].spec;
    return "family=" + encodeURIComponent(n).replace(/%20/g, "+") + (spec ? ":" + spec : "");
  });
  return families.length ? `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap` : null;
}
