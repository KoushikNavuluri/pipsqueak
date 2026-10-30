import { hash, insertBlock, mapStrings, newBlock } from "./gen";
import { FONTS, PALETTES } from "./data";

const PALETTE_WORDS = [
  ["candy", ["pink", "candy", "bubblegum", "cute"]],
  ["matcha", ["green", "matcha", "fresh", "nature", "calm"]],
  ["blueberry", ["blue", "blueberry", "indigo", "purple", "violet"]],
  ["sunset", ["orange", "sunset", "warm", "peach"]],
  ["midnight", ["midnight", "night sky"]],
  ["ocean", ["teal", "ocean", "aqua", "cyan", "sea"]],
  ["cherry", ["red", "cherry", "bold", "spicy"]],
  ["mono", ["mono", "minimal", "lime", "plain", "clean"]],
];

const FONT_WORDS = [
  ["editorial", ["serif", "editorial", "classy", "elegant", "magazine"]],
  ["techy", ["techy", "modern", "sharp", "geometric", "startup"]],
  ["rounded", ["rounded", "bubbly", "playful", "fun", "round font"]],
  ["clean", ["clean", "simple font", "neutral"]],
];

const BLOCK_WORDS = [
  ["chart", ["chart", "graph", "bars"]],
  ["list", ["list", "feed", "rows"]],
  ["stats", ["stats", "numbers", "metrics"]],
  ["cards", ["carousel", "cards"]],
  ["search", ["search"]],
  ["ring", ["ring", "progress", "donut"]],
  ["button", ["button", "cta"]],
  ["form", ["form", "signup", "sign up"]],
  ["hero", ["hero", "banner"]],
  ["chips", ["chips", "filters", "tags"]],
  ["toggles", ["toggle", "settings"]],
  ["profile", ["profile"]],
];

const CRISIS_RE =
  /(kill myself|suicide|self[- ]?harm|end it all|hurt myself|don'?t want to live)/i;

const has = (e, t) => t.some((a) => e.includes(a));

const ok = (e, t) => ({
  label: e,
  fn: t,
});

export function respond(e, t, a) {
  const r = e.toLowerCase().trim();
  if (CRISIS_RE.test(e)) {
    return {
      mood: "oops",
      text: "I'm really glad you said that. I'm only a design helper, so please reach out to someone you trust or a local helpline right now. You deserve real support.",
      chips: [],
      edits: [],
    };
  }
  if (!r) {
    return {
      mood: "idle",
      text: "Tell me what to change!",
      chips: SUGGESTIONS,
      edits: [],
    };
  }
  const o = [];
  const i = [];
  const s = t.cat;
  const l = t.screens[a];
  const u = e.match(
    /(?:rename (?:it |app )?to|call it|name it|rename the app to)\s+["“]?([A-Za-z][\w'’ ]{1,20})["”]?/i,
  );
  if (u) {
    const p = u[1].trim();
    o.push(
      ok(`Renamed to ${p}`, (h) => ({
        ...h,
        name: p,
        screens: h.screens.map((x) =>
          mapStrings(x, (S) => S.split(h.name).join(p)),
        ),
      })),
    );
    i.push(`Renamed it to ${p}`);
  }
  if (/\b(dark mode|dark theme|make it dark|go dark)\b/.test(r)) {
    o.push(
      ok("Dark mode", (p) => ({
        ...p,
        theme: {
          ...p.theme,
          mode: "dark",
        },
      })),
    );
    i.push("Switched to dark mode");
  } else if (/\b(light mode|light theme|make it light|go light)\b/.test(r)) {
    o.push(
      ok("Light mode", (p) => ({
        ...p,
        theme: {
          ...p.theme,
          mode: "light",
        },
      })),
    );
    i.push("Switched to light mode");
  }
  const d = e.match(/#[0-9a-fA-F]{6}\b/);
  if (d) {
    o.push(
      ok("Custom accent", (p) => ({
        ...p,
        theme: {
          ...p.theme,
          accent: d[0],
        },
      })),
    );
    i.push(`Set the accent to ${d[0]}`);
  }
  if (/surprise|shuffle|remix|random|dice/.test(r)) {
    const p = Object.keys(PALETTES);
    const h = Object.keys(FONTS);
    const x = hash(r + Date.now());
    const S = p[x % p.length];
    const v = h[(x >>> 3) % h.length];
    const g = [4, 10, 18, 26, 32][(x >>> 5) % 5];
    o.push(
      ok("Shuffled the look", (m) => ({
        ...m,
        theme: {
          ...m.theme,
          pal: S,
          font: v,
          radius: g,
        },
      })),
    );
    i.push(`Shuffled to ${PALETTES[S].name}, ${FONTS[v].name}, ${g}px corners`);
  } else {
    for (const [p, h] of PALETTE_WORDS) {
      if (has(r, h) && !u) {
        o.push(
          ok(`${PALETTES[p].name} palette`, (x) => ({
            ...x,
            theme: {
              ...x.theme,
              pal: p,
            },
          })),
        );
        i.push(`Mixed up ${PALETTES[p].name}`);
        break;
      }
    }
    for (const [p, h] of FONT_WORDS) {
      if (has(r, h)) {
        o.push(
          ok(`${FONTS[p].name} font`, (x) => ({
            ...x,
            theme: {
              ...x.theme,
              font: p,
            },
          })),
        );
        i.push(`Switched to the ${FONTS[p].name} font`);
        break;
      }
    }
    if (/round|bubbl|pill|soft(er)? corners|squish/.test(r)) {
      o.push(
        ok("Rounder corners", (p) => ({
          ...p,
          theme: {
            ...p.theme,
            radius: Math.min(32, p.theme.radius + 10),
          },
        })),
      );
      i.push("Made corners rounder");
    }
    if (/sharp|square|boxy|crisp|less round/.test(r)) {
      o.push(
        ok("Sharper corners", (p) => ({
          ...p,
          theme: {
            ...p.theme,
            radius: Math.max(0, p.theme.radius - 10),
          },
        })),
      );
      i.push("Sharpened the corners");
    }
    if (/compact|tight|dense/.test(r)) {
      o.push(
        ok("Compact spacing", (p) => ({
          ...p,
          theme: {
            ...p.theme,
            density: "compact",
          },
        })),
      );
      i.push("Tightened the spacing");
    }
    if (/cozy|spacious|airy|breathe|roomy/.test(r)) {
      o.push(
        ok("Cozy spacing", (p) => ({
          ...p,
          theme: {
            ...p.theme,
            density: "cozy",
          },
        })),
      );
      i.push("Gave it room to breathe");
    }
  }
  const c = /\b(add|insert|put|include|more)\b/.test(r);
  const f = /\b(remove|delete|drop|lose|get rid of|no more)\b/.test(r);
  for (const [p, h] of BLOCK_WORDS) {
    if (has(r, h)) {
      if (f) {
        o.push(
          ok(`Removed ${p}`, (x) => ({
            ...x,
            screens: x.screens.map((S, v) => {
              if (v !== a) {
                return S;
              }
              const g = S.blocks.findIndex((m) => m.type === p);
              if (g < 0) {
                return S;
              } else {
                return {
                  ...S,
                  blocks: S.blocks.filter((m, y) => y !== g),
                };
              }
            }),
          })),
        );
        i.push(`Removed the ${p}`);
      } else if (c) {
        o.push(
          ok(`Added ${p}`, (x) => ({
            ...x,
            screens: x.screens.map((S, v) =>
              v === a ? insertBlock(S, newBlock(p, s, x.name)) : S,
            ),
          })),
        );
        i.push(`Added a ${p} to ${l?.title || "this screen"}`);
      }
      break;
    }
  }
  if (o.length) {
    return {
      mood: "happy",
      text: `${["Done.", "Got it.", "Updated.", "On it."][hash(r) % 4]} ${i.join(". ")}.`,
      chips: ["Undo that", "Surprise me", "Rounder corners"],
      edits: o,
    };
  } else if (/^(hi|hello|hey|yo|sup)\b/.test(r)) {
    return {
      mood: "happy",
      text: 'Hi! Tell me a color, a mood, or a block to add. Try "make it dark" or "add a chart".',
      chips: SUGGESTIONS,
      edits: [],
    };
  } else if (/(thanks|thank you|cute|love|nice|great)/.test(r)) {
    return {
      mood: "happy",
      text: "Glad it works. Want me to shuffle the look?",
      chips: ["Surprise me", "Export it"],
      edits: [],
    };
  } else {
    return {
      mood: "idle",
      text: "I can recolor, switch fonts, round corners, rename the app, switch dark mode, and add or remove blocks. Try one of these.",
      chips: SUGGESTIONS,
      edits: [],
    };
  }
}

export const SUGGESTIONS = [
  "Dark mode",
  "Add a chart",
  "Rounder corners",
  "Use a serif font",
  "Rename to Boba",
  "Surprise me",
];
