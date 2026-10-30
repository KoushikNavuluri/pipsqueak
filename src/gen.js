import {
  CATEGORIES,
  PALETTES,
  SCREEN_SETS,
  SCREEN_TITLES,
  VIBES,
} from "./data";
import { initial } from "./store";

export const uid = () => Math.random().toString(36).slice(2, 9);

export function hash(e) {
  let t = 2166136261;
  for (let a = 0; a < e.length; a++) {
    t ^= e.charCodeAt(a);
    t = Math.imul(t, 16777619);
  }
  return t >>> 0;
}

const pick = (e, t) => e[t % e.length];

export const slug = (e) =>
  (e || "app")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "app";

export function detectCategory(e) {
  const t = e.toLowerCase();
  let a = "tasks";
  let r = 0;
  for (const [o, i] of Object.entries(CATEGORIES)) {
    const s = i.kw.reduce((l, u) => l + (t.includes(u) ? 1 : 0), 0);
    if (s > r) {
      r = s;
      a = o;
    }
  }
  return a;
}

export function extractName(e, t) {
  const a =
    e.match(/["“]([^"”]{2,22})["”]/) ||
    e.match(/\b(?:called|named)\s+([A-Z][\w'’]*(?:\s[A-Z][\w'’]*)?)/);
  if (a) {
    return a[1].trim();
  } else {
    return pick(CATEGORIES[t].names, hash(e));
  }
}

const makeBlock = (e, t, a) => ({
  id: uid(),
  type: e,
  props: t,
  ...(a
    ? {
        variant: a,
      }
    : {}),
});

function buildBlocks(e, t, a) {
  const r = CATEGORIES[t];
  const tab = (d) =>
    makeBlock("tabbar", {
      active: d,
      items: r.tabs.map(([c, f]) => ({
        label: c,
        icon: f,
      })),
    });
  const cards = () =>
    makeBlock("cards", {
      title: r.cardsTitle,
      items: r.cards.map((d) => ({
        title: d.t,
        sub: d.s,
        tag: d.g,
      })),
    });
  const list = (d = 4, c = r.listTitle) =>
    makeBlock("list", {
      title: c,
      items: r.list.slice(0, d).map((f) => ({
        title: f.t,
        sub: f.s,
        meta: f.m,
      })),
    });
  const stats = () =>
    makeBlock("stats", {
      items: r.stats.map((d) => ({
        label: d.l,
        value: d.v,
      })),
    });
  const header = (d, c) =>
    makeBlock("header", {
      title: d,
      sub: c,
      initial: r.profile.n[0],
    });
  switch (e) {
    case "welcome":
      return [
        makeBlock("onboard", {
          title: r.welcome.t,
          sub: r.welcome.s,
          cta: r.welcome.cta,
          icon: r.icon,
          step: 1,
        }),
      ];
    case "home":
      return [
        header(`Hi ${r.profile.n.split(" ")[0]}`, a),
        makeBlock("hero", {
          kicker: r.hero.kicker,
          title: r.hero.title,
          sub: r.hero.sub,
          cta: r.hero.cta,
          icon: r.hero.icon,
        }),
        makeBlock("chips", {
          items: r.chips,
          active: 0,
        }),
        cards(),
        list(2),
        tab(0),
      ];
    case "explore":
      return [
        header("Explore", r.tag),
        makeBlock("search", {
          placeholder: r.search,
        }),
        makeBlock("chips", {
          items: r.chips,
          active: 1,
        }),
        list(4, "Picked for you"),
        cards(),
        tab(1),
      ];
    case "detail":
      return [
        makeBlock("detail", {
          title: r.detail.t,
          sub: r.detail.s,
          body: r.detail.b,
          tag: r.detail.g,
          icon: r.detail.icon,
          cta: r.detail.cta,
        }),
        stats(),
      ];
    case "insights":
      return [
        header("Insights", "Your week at a glance"),
        makeBlock("ring", {
          label: r.ring.l,
          value: r.ring.v,
          pct: r.ring.pct,
          sub: r.ring.s,
        }),
        makeBlock("chart", {
          title: r.chartTitle,
          data: r.chart,
        }),
        stats(),
        tab(2),
      ];
    case "profile":
      return [
        makeBlock("profile", {
          name: r.profile.n,
          sub: r.profile.s,
          stats: r.stats.map((d) => ({
            label: d.l,
            value: d.v,
          })),
        }),
        makeBlock("toggles", {
          title: "Settings",
          items: [
            {
              title: "Notifications",
              on: true,
            },
            {
              title: "Dark appearance",
              on: false,
            },
            {
              title: "Haptics",
              on: true,
            },
            {
              title: "Weekly summary",
              on: true,
            },
          ],
        }),
        makeBlock("button", {
          label: "Share " + a,
        }),
        tab(3),
      ];
    default:
      return [header(SCREEN_TITLES[e] || "New screen", a), list(3), tab(0)];
  }
}

export function makeScreen(e, t, a) {
  return {
    id: uid(),
    kind: e,
    title: SCREEN_TITLES[e] || "New screen",
    blocks: buildBlocks(e, t, a),
  };
}

export function generateProject({
  prompt,
  vibe = "candy",
  count = 5,
  platform = "iOS",
  seedBump = 0,
}) {
  const i = (prompt || "").trim() || "A cozy to-do app";
  const s = detectCategory(i);
  const l = extractName(i, s);
  const u = VIBES.find((c) => c.key === vibe) || VIBES[0];
  const d = SCREEN_SETS[count] || SCREEN_SETS[5];
  return {
    id: uid(),
    name: l,
    tagline: CATEGORIES[s].tag,
    prompt: i,
    cat: s,
    platform: platform,
    fav: false,
    created: Date.now(),
    shots: null,
    theme: {
      pal: u.pal,
      font: u.font,
      radius: u.radius,
      density: "cozy",
      mode: "auto",
      accent: null,
    },
    screens: d.map((c) => makeScreen(c, s, l)),
  };
}

const PALETTE_KEYS = Object.keys(PALETTES);

export function setPath(e, t, a) {
  if (!t.length) {
    return a;
  }
  const [r, ...o] = t;
  const i = Array.isArray(e)
    ? e.slice()
    : {
        ...e,
      };
  i[r] = setPath(e[r], o, a);
  return i;
}

export function mapStrings(
  e,
  t,
  a = ["icon", "initial", "variant", "type", "id", "kind"],
) {
  if (typeof e == "string") {
    return t(e);
  }
  if (Array.isArray(e)) {
    return e.map((r) => mapStrings(r, t, a));
  }
  if (e && typeof e == "object") {
    const r = {};
    for (const o of Object.keys(e)) {
      r[o] = a.includes(o) ? e[o] : mapStrings(e[o], t, a);
    }
    return r;
  }
  return e;
}

export function newBlock(e, t, a) {
  const r = CATEGORIES[t] || CATEGORIES.tasks;
  const o = {
    hero: () =>
      makeBlock("hero", {
        kicker: r.hero.kicker,
        title: r.hero.title,
        sub: r.hero.sub,
        cta: r.hero.cta,
        icon: r.hero.icon,
      }),
    cards: () =>
      makeBlock("cards", {
        title: r.cardsTitle,
        items: r.cards.map((i) => ({
          title: i.t,
          sub: i.s,
          tag: i.g,
        })),
      }),
    list: () =>
      makeBlock("list", {
        title: r.listTitle,
        items: r.list.slice(0, 3).map((i) => ({
          title: i.t,
          sub: i.s,
          meta: i.m,
        })),
      }),
    stats: () =>
      makeBlock("stats", {
        items: r.stats.map((i) => ({
          label: i.l,
          value: i.v,
        })),
      }),
    chart: () =>
      makeBlock("chart", {
        title: r.chartTitle,
        data: r.chart,
      }),
    ring: () =>
      makeBlock("ring", {
        label: r.ring.l,
        value: r.ring.v,
        pct: r.ring.pct,
        sub: r.ring.s,
      }),
    search: () =>
      makeBlock("search", {
        placeholder: r.search,
      }),
    chips: () =>
      makeBlock("chips", {
        items: r.chips,
        active: 0,
      }),
    button: () =>
      makeBlock("button", {
        label: "Let's do it",
      }),
    form: () =>
      makeBlock("form", {
        title: "Quick note",
        fields: ["Your name", "Phone or email", "What's on your mind?"],
        cta: "Send",
      }),
    toggles: () =>
      makeBlock("toggles", {
        title: "Preferences",
        items: [
          {
            title: "Reminders",
            on: true,
          },
          {
            title: "Sounds",
            on: false,
          },
          {
            title: "Sync",
            on: true,
          },
        ],
      }),
    profile: () =>
      makeBlock("profile", {
        name: r.profile.n,
        sub: r.profile.s,
        stats: r.stats.map((i) => ({
          label: i.l,
          value: i.v,
        })),
      }),
  };
  return (o[e] || o.list)();
}

export function insertBlock(e, t) {
  const a = e.blocks.slice();
  const r = a.findIndex((o) => o.type === "tabbar");
  a.splice(r < 0 ? a.length : r, 0, t);
  return {
    ...e,
    blocks: a,
  };
}

export function shuffleLayout(e) {
  const keep = (i) =>
    i.type === "tabbar" ||
    i.type === "header" ||
    i.type === "onboard" ||
    i.type === "detail";
  const a = e.blocks.filter((i) => !keep(i));
  if (a.length < 2) {
    return e;
  }
  const r = a.slice(1).concat(a[0]);
  let o = 0;
  return {
    ...e,
    blocks: e.blocks.map((i) => (keep(i) ? i : r[o++])),
  };
}
