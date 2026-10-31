// Client side of the design engine: calls each stage, normalizes what comes
// back, and keeps screens consistent (shared navigation, token-only classes).
import { askAi, streamAi } from "../ai/client";
import { supabase } from "../supabase";
import { uid } from "../util";
import { SKILLS, SKILL_IDS, skillById } from "./skills.js";
import { PATTERNS } from "./patterns.js";
import { normalizeSystem } from "./system.js";
import { cleanHtml, lintHtml } from "./lint.js";
import { extractHtml, sanitizeHtml } from "./htmlTools.js";

export const VIEWPORTS = {
  mobile: { w: 390, h: 797, label: "Mobile" },
  tablet: { w: 820, h: 1180, label: "Tablet" },
  desktop: { w: 1440, h: 900, label: "Desktop" },
};

const kebab = (s) =>
  String(s || "screen")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24) || "screen";

// ---------- understand ----------

export function normalizeSpec(raw, prompt) {
  const r = raw && typeof raw === "object" ? raw : {};
  const platform = ["mobile", "web", "website"].includes(r.platform) ? r.platform : "mobile";
  const used = new Set();
  const screens = (Array.isArray(r.screens) ? r.screens : [])
    .filter((s) => s && typeof s === "object")
    .slice(0, 8)
    .map((s) => {
      let id = kebab(s.id || s.name);
      while (used.has(id)) {
        id = `${id}-2`;
      }
      used.add(id);
      return {
        id,
        name: String(s.name || id).slice(0, 24),
        type: String(s.type || "other"),
        pattern: PATTERNS[s.pattern] ? s.pattern : null,
        purpose: String(s.purpose || "").slice(0, 200),
        content: String(s.content || "").slice(0, 600),
        primaryAction: String(s.primaryAction || "").slice(0, 48),
        inNav: !!s.inNav,
      };
    });
  if (!screens.length) {
    screens.push({ id: "home", name: "Home", type: "home", pattern: null, purpose: "The main screen", content: "", primaryAction: "", inNav: true });
  }
  const ids = new Set(screens.map((s) => s.id));
  const navItems = (Array.isArray(r.navigation?.items) ? r.navigation.items : [])
    .filter((i) => i && ids.has(kebab(i.screenId)))
    .slice(0, 6)
    .map((i) => ({ label: String(i.label || "").slice(0, 14), icon: String(i.icon || "circle").replace(/[^a-z0-9_]/g, "").slice(0, 32) || "circle", screenId: kebab(i.screenId) }));
  const directions = [];
  for (const d of Array.isArray(r.directions) ? r.directions : []) {
    if (SKILL_IDS.includes(d?.skill) && !directions.some((x) => x.skill === d.skill)) {
      directions.push({ skill: d.skill, why: String(d.why || "").slice(0, 240), twist: String(d.twist || "").slice(0, 240) });
    }
  }
  for (const s of SKILLS) {
    if (directions.length >= 3) {
      break;
    }
    if (!directions.some((x) => x.skill === s.id)) {
      directions.push({ skill: s.id, why: s.tagline, twist: "" });
    }
  }
  return {
    name: String(r.name || "Untitled").slice(0, 28),
    tagline: String(r.tagline || "").slice(0, 80),
    summary: String(r.summary || prompt || "").slice(0, 320),
    platform,
    audience: String(r.audience || "").slice(0, 160),
    tone: (Array.isArray(r.tone) ? r.tone : []).slice(0, 3).map((t) => String(t).slice(0, 20)),
    locale: String(r.locale || "").slice(0, 48),
    category: String(r.category || ""),
    heroObject: String(r.heroObject || "").slice(0, 160),
    world: String(r.world || "").slice(0, 1200),
    screens,
    navigation: {
      pattern: ["tabbar", "floating-tabbar", "sidebar", "topbar", "none"].includes(r.navigation?.pattern) ? r.navigation.pattern : platform === "mobile" ? "tabbar" : "topbar",
      items: navItems,
    },
    imagery: (Array.isArray(r.imagery) ? r.imagery : [])
      .slice(0, 6)
      .map((i) => ({ subject: String(i?.subject || "").slice(0, 180), aspect: ["portrait", "landscape", "square"].includes(i?.aspect) ? i.aspect : "landscape" }))
      .filter((i) => i.subject),
    directions: directions.slice(0, 3),
  };
}

export async function understand({ prompt, platform = "auto", image, recent = [], direction, reference, signal }) {
  const { result, model } = await askAi(
    "understand",
    { prompt, platform, recent, direction, reference, image: image ? { mimeType: image.mimeType, data: image.data } : undefined },
    { signal },
  );
  return { spec: normalizeSpec(result, prompt), model };
}

// ---------- systems ----------

export async function buildSystems({ spec, directions, instruction, signal }) {
  const { result } = await askAi("systems", { spec, directions, instruction }, { signal });
  const raw = Array.isArray(result?.systems) ? result.systems : [];
  return directions.map((d, i) => {
    const match = raw.find((s) => s?.skill === d.skill) || raw[i] || { skill: d.skill };
    return { ...normalizeSystem({ ...match, skill: d.skill }, d.skill), why: d.why, twist: d.twist };
  });
}

// ---------- screens ----------

const compactSpec = (spec) => ({ ...spec, directions: undefined, imagery: undefined });

function finishHtml(text) {
  const findings = lintHtml(text);
  return { html: cleanHtml(sanitizeHtml(text)), findings };
}

// Another screen of the app, shortened for a prompt: every element and class
// is kept (that's the visual language), long text and attribute values are cut.
export function compactHtml(html, max = 9000) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const walk = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = n.nodeValue.replace(/\s+/g, " ");
    n.nodeValue = t.length > 48 ? t.slice(0, 46).trimEnd() + "…" : t;
  }
  doc.body.querySelectorAll("*").forEach((el) => {
    for (const a of [...el.attributes]) {
      if (a.name !== "class" && a.value.length > 60) el.setAttribute(a.name, a.value.slice(0, 58) + "…");
    }
  });
  const out = doc.body.innerHTML.replace(/>\s+</g, "><");
  return out.length > max ? out.slice(0, max) + "<!-- … -->" : out;
}

// A screen's page: its single root element and the page color it sets
// ("bg-bg" when it sets none or a surface color, which reads the same).
const SURFACE_BG = /^bg-surface(-2)?(\/\d+)?$/;
function pageOf(html) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const root = doc.body.children.length === 1 ? doc.body.firstElementChild : null;
  const classes = (root?.getAttribute("class") || "").split(/\s+/).filter(Boolean);
  const bg = classes.find((c) => /^bg-(bg|surface|surface-2|ink|primary|accent)(\/\d+)?$|^bg-\[/.test(c));
  return { doc, root, classes, color: !bg || SURFACE_BG.test(bg) ? "bg-bg" : bg };
}

// Every screen sits on the same page as the rest of the app (see "ONE
// PRODUCT, ONE LOOK" in the screen prompt). A page laid on a surface color is
// moved onto the page background. A page in another color can't be swapped
// safely, since everything on it is styled for it, so it is reported with the
// color it should have; the studio then has it reworked to match.
function onSystemPage(html, findings, reference) {
  const page = pageOf(html);
  if (!page.root) return html;
  const want = reference ? pageOf(reference).color : null;
  if ((!want || want === "bg-bg") && page.classes.some((c) => SURFACE_BG.test(c))) {
    page.root.setAttribute("class", page.classes.map((c) => (SURFACE_BG.test(c) ? "bg-bg" : c)).join(" "));
    return page.doc.body.innerHTML;
  }
  if (want && page.color !== want) {
    findings.push({ kind: "off-theme", message: "This screen's page background differs from the rest of the app", severity: "medium", want });
  }
  return html;
}

// The edit that brings an off-theme screen back in line with its siblings.
export const matchTheApp = (want) =>
  `This screen doesn't look like the rest of the app. Rebuild its look to match the reference screens: the same page background (the page root uses ${want}), top-of-screen treatment, surfaces and cards, type scale, buttons, chips and image treatment. Keep this screen's content, job and navigation.`;

const asReference = (r, max) => (r?.html ? { name: r.name, html: compactHtml(r.html, max) } : undefined);

// The screen whose navigation becomes the shared shell: the first one in nav.
export function shellSource(spec) {
  const navIds = new Set(spec.navigation.items.map((i) => i.screenId));
  return spec.screens.find((s) => navIds.has(s.id)) || spec.screens.find((s) => s.inNav) || spec.screens[0];
}

// reference: an approved screen of the same app ({ name, html }) whose visual
// language this one must match. Omitted for the first screen, which sets it.
// first: this is the app's lead screen (it gets the direction's hero staging).
// ownLook: the user asked for this screen to look its own way, so its page
// background is left as written.
export async function writeScreen({ spec, system, screen, kit, shell, reference, first, ownLook, instruction, quality, image, signal, onHtml }) {
  let last = 0;
  const { text } = await streamAi(
    "screen",
    {
      spec: compactSpec(spec),
      system,
      screen,
      kit: (kit || []).map((k) => ({ subject: k.subject })),
      shell: shell || undefined,
      reference: asReference(reference, 9000),
      first: first || undefined,
      instruction,
      quality,
      image: image ? { mimeType: image.mimeType, data: image.data } : undefined,
    },
    {
      signal,
      onText: (t) => {
        if (onHtml && Date.now() - last > 350) {
          last = Date.now();
          onHtml(cleanHtml(sanitizeHtml(t)));
        }
      },
    },
  );
  const out = finishHtml(text);
  const html = ownLook ? out.html : onSystemPage(out.html, out.findings, reference?.html);
  return { ...out, html: shell ? applyShell(html, shell, screen.id) : html };
}

// references: other screens of the app, so "match the others" can be done.
export async function editScreen({ spec, system, screen, html, selected, references = [], instruction, quality, signal, onHtml }) {
  let last = 0;
  const { text } = await streamAi(
    "edit_html",
    {
      spec: compactSpec(spec),
      system,
      screen: { id: screen.id, name: screen.name },
      html,
      selected,
      references: references.slice(0, 2).map((r) => asReference(r, 7000)).filter(Boolean),
      instruction,
      quality,
    },
    {
      signal,
      onText: (t) => {
        if (onHtml && !selected && Date.now() - last > 350) {
          last = Date.now();
          onHtml(cleanHtml(sanitizeHtml(t)));
        }
      },
    },
  );
  const out = extractHtml(text).trim();
  if (selected && out && !/<[a-z][\s\S]*>/i.test(out)) {
    // Asked to rewrite copy, the model sometimes answers with the text alone:
    // keep the selected element and swap its text.
    const el = new DOMParser().parseFromString(`<body>${selected}</body>`, "text/html").body.firstElementChild;
    if (el) {
      el.textContent = out.replace(/^["“]|["”]$/g, "");
      return finishHtml(el.outerHTML);
    }
  }
  return finishHtml(text);
}

export async function copilotPlan({ spec, system, screens, instruction, focus, history, signal }) {
  const { result } = await askAi(
    "copilot",
    {
      spec: compactSpec(spec),
      system,
      screens: screens.map((s) => ({ id: s.id, name: s.name, summary: `${s.purpose} ${s.content}`.slice(0, 300) })),
      instruction,
      focus,
      history,
    },
    { signal },
  );
  return result;
}

export async function critique({ spec, system, screens, findings, signal }) {
  const { result } = await askAi(
    "critique",
    { spec: compactSpec(spec), system, screens: screens.map((s) => ({ id: s.id, name: s.name, html: s.html })), findings },
    { signal },
  );
  return result;
}

// ---------- shared navigation ----------

const parse = (html) => new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");

export function extractShell(html) {
  return parse(html).body.querySelector('[data-shell="nav"]')?.outerHTML || null;
}

// Puts the canonical navigation into a screen with the right item active.
// Active styling is moved by swapping classes between the item that was
// active in the canonical shell and the item for this screen.
export function applyShell(html, shell, screenId) {
  const doc = parse(html);
  const current = doc.body.querySelector('[data-shell="nav"]');
  if (!current || !shell) {
    return html;
  }
  const tpl = doc.createElement("template");
  tpl.innerHTML = shell;
  const nav = tpl.content.firstElementChild;
  if (!nav) {
    return html;
  }
  const items = [...nav.querySelectorAll("[data-nav]")];
  const target = items.find((i) => i.getAttribute("data-nav") === screenId);
  if (!target) {
    // This screen isn't a navigation destination: keep its own shell.
    return html;
  }
  const active = items.find((i) => i.getAttribute("aria-current") === "page") || items.find((i) => i !== target && /\b(filled|text-primary|bg-primary|text-on-primary|font-semibold|font-bold)\b/.test(i.outerHTML) && !/\btext-muted\b/.test(i.getAttribute("class") || ""));
  if (active && active !== target) {
    const a = [active, ...active.querySelectorAll("*")];
    const b = [target, ...target.querySelectorAll("*")];
    if (a.length === b.length) {
      a.forEach((el, i) => {
        const ca = el.getAttribute("class");
        const cb = b[i].getAttribute("class");
        if (ca !== null) b[i].setAttribute("class", ca);
        if (cb !== null) el.setAttribute("class", cb);
      });
    }
    active.removeAttribute("aria-current");
  }
  target.setAttribute("aria-current", "page");
  current.replaceWith(nav);
  return doc.body.innerHTML.trim();
}

// ---------- imagery ----------

const ASPECT = { portrait: "3:4", landscape: "4:3", square: "1:1" };

async function shrink(base64, mime, maxSide) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode image"))), "image/webp", 0.85));
}

// Paints one image of the project's kit in the system's art direction and
// stores a web-sized copy. Resolves to its public URL.
export async function paintKitImage({ userId, projectId, item, system, name, signal }) {
  const ask = () =>
    askAi(
      "image",
      {
        kind: "kit",
        subject: item.subject,
        aspect: item.aspect,
        direction: system.imagery,
        app: { name, accent: system.colors.primary, accent2: system.colors.accent, background: system.colors.bg },
      },
      { signal },
    );
  // The image model is often briefly overloaded (502 from our function);
  // retrying after a growing pause usually lands. Failures cost no credits.
  let image;
  for (const wait of [0, 5000, 12000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      ({ image } = await ask());
      break;
    } catch (err) {
      if (err.status !== 502 || wait === 12000) throw err;
    }
  }
  const blob = await shrink(image.data, image.mimeType, 1100);
  let path = `${userId}/${projectId}/kit-${uid()}.webp`;
  // Storage occasionally answers with a transient 5xx; try once more.
  let { error } = await supabase.storage.from("artwork").upload(path, blob, { contentType: "image/webp" });
  if (error && /5\d\d|fetch|network/i.test(error.message)) {
    await new Promise((r) => setTimeout(r, 1200));
    path = `${userId}/${projectId}/kit-${uid()}.webp`;
    ({ error } = await supabase.storage.from("artwork").upload(path, blob, { contentType: "image/webp" }));
  }
  if (error) {
    throw new Error("Couldn't save the image: " + error.message);
  }
  return supabase.storage.from("artwork").getPublicUrl(path).data.publicUrl;
}

export const skillName = (id) => skillById(id).name;
export { ASPECT };
