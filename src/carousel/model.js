// What a carousel project looks like, and the pure helpers around it.
//
// project = {
//   id, kind: "carousel", name, created, fav, screens: [],
//   carousel: {
//     topic, notes, sourceUrl, sourceTitle, format, licensed, brand: { handle, name },
//     plan: { title, audience, goal, angle, reasoning, slideCount, hooks },
//     variants: [{ id, direction, slides, caption, hashtags, status, error }],
//     active,                       // id of the variant on screen
//   }
// }
// slide = { id, layout, kicker, title, highlight, body, items, stat, quote,
//           source, image: { use, kind, query, altQuery, subject }, alt, img }
// img   = { id, source, src, thumb, page, credit, license, title, focus, textArea }
//
// Image search results ("candidates") are kept in memory only, so saved
// designs stay small.
import { uid } from "../util";
import { STYLE_IDS } from "./styles";

export const LAYOUTS = [
  { id: "cover", label: "Cover" },
  { id: "statement", label: "Statement" },
  { id: "photo", label: "Photo" },
  { id: "split", label: "Photo + text" },
  { id: "list", label: "List" },
  { id: "step", label: "Step" },
  { id: "stat", label: "Big number" },
  { id: "quote", label: "Quote" },
  { id: "compare", label: "Compare" },
  { id: "checklist", label: "Checklist" },
  { id: "cta", label: "Call to action" },
];

export const PHOTO_LAYOUTS = new Set(["photo", "split"]);
export const ITEM_LAYOUTS = new Set(["list", "step", "compare", "checklist"]);
export const MAX_SLIDES = 20;

export const emptySlide = (layout = "statement") => ({
  id: uid(),
  layout,
  kicker: "",
  title: layout === "cta" ? "Save this for later" : "New slide",
  highlight: "",
  body: "",
  items: layout === "compare" ? [{ label: "Before", text: "" }, { label: "After", text: "" }] : [],
  stat: { value: "", label: "" },
  quote: { text: "", by: "" },
  source: "",
  image: { use: PHOTO_LAYOUTS.has(layout), kind: "photo", query: "", altQuery: "", subject: "" },
  alt: "",
  img: null,
});

export function normalizeSlide(s) {
  const base = emptySlide(s?.layout || "statement");
  return {
    ...base,
    ...s,
    id: s?.id || uid(),
    items: Array.isArray(s?.items) ? s.items : base.items,
    stat: { ...base.stat, ...(s?.stat || {}) },
    quote: { ...base.quote, ...(s?.quote || {}) },
    image: { ...base.image, ...(s?.image || {}) },
    img: s?.img || null,
  };
}

// Up to 40 characters, cut at a word boundary.
export function shortName(text, max = 40) {
  const t = String(text || "Carousel").trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1).replace(/\s+\S*$/, "");
  return (cut.length >= 12 ? cut : t.slice(0, max)).replace(/[\s,.;:–—-]+$/, "");
}

export function newVariant(direction) {
  return { id: direction.id || uid(), direction, slides: [], caption: "", hashtags: [], status: "writing", error: "" };
}

export function newCarouselProject({ request, plan, directions }) {
  const id = uid();
  const variants = directions.map(newVariant);
  return {
    id,
    kind: "carousel",
    name: shortName(plan.title || request.topic),
    prompt: request.topic,
    created: Date.now(),
    fav: false,
    screens: [],
    carousel: {
      topic: request.topic,
      notes: request.notes || "",
      sourceUrl: request.sourceUrl || "",
      sourceTitle: request.sourceTitle || "",
      format: request.format || "4:5",
      licensed: !!request.licensed,
      tone: request.custom?.tone || "",
      brand: request.brand || { handle: "", name: "" },
      plan: {
        title: plan.title,
        audience: plan.audience,
        goal: plan.goal,
        angle: plan.angle,
        reasoning: plan.reasoning,
        slideCount: plan.slideCount,
        hooks: plan.hooks || [],
      },
      variants,
      active: variants[0]?.id || null,
    },
  };
}

export const activeVariant = (project) => {
  const c = project?.carousel;
  if (!c) return null;
  return c.variants.find((v) => v.id === c.active) || c.variants[0] || null;
};

// Applies `fn` to one variant of a project, returning a new project.
export function withVariant(project, variantId, fn) {
  return {
    ...project,
    carousel: {
      ...project.carousel,
      variants: project.carousel.variants.map((v) => (v.id === variantId ? fn(v) : v)),
    },
  };
}

export function withSlide(project, variantId, slideId, fn) {
  return withVariant(project, variantId, (v) => ({ ...v, slides: v.slides.map((s) => (s.id === slideId ? fn(s) : s)) }));
}

// Slide numbering fix-ups after reorder/add/remove: first stays a cover, last a cta.
export function settleLayouts(slides) {
  return slides.map((s, i) => {
    if (i === 0 && s.layout === "cta" && slides.length > 1) return { ...s, layout: "statement" };
    if (i === slides.length - 1 && s.layout === "cover" && slides.length > 1) return { ...s, layout: "statement" };
    if (i > 0 && s.layout === "cover") return { ...s, layout: "statement" };
    return s;
  });
}

export function moveSlide(slides, from, to) {
  if (from === to || from < 0 || to < 0 || from >= slides.length || to >= slides.length) return slides;
  const next = slides.slice();
  const [s] = next.splice(from, 1);
  next.splice(to, 0, s);
  return next;
}

// Keeps image picks and ids for slides whose image need didn't change after an AI edit.
export function mergeRefined(oldSlides, newSlides) {
  return newSlides.map((n, i) => {
    const o = oldSlides[i];
    const keep = !!o?.img && !!n.image?.use && (!n.image.query || n.image.query === o.image?.query);
    return normalizeSlide({ ...n, id: o?.id || uid(), img: keep ? o.img : null });
  });
}

// Indexes of slides that need an image but have none.
export const needsImage = (slides) => slides.map((s, i) => (s.image?.use && !s.img?.src ? i : -1)).filter((i) => i >= 0);

export function captionText(variant) {
  const tags = (variant.hashtags || []).map((h) => "#" + String(h).replace(/^#/, "")).join(" ");
  return [variant.caption || "", tags].filter(Boolean).join("\n\n");
}

// Photo credits, one line per slide that shows an image.
export function creditsOf(variant) {
  return (variant.slides || [])
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.image?.use && s.img?.src)
    .map(({ s, i }) => ({
      slide: i + 1,
      source: s.img.source,
      credit: s.img.credit || "",
      license: s.img.license || "",
      page: s.img.page || "",
      title: s.img.title || "",
    }));
}

export function creditsText(variant) {
  const rows = creditsOf(variant);
  if (!rows.length) return "No photos in this carousel.";
  return rows
    .map((r) => `Slide ${r.slide}: ${r.title ? r.title + " · " : ""}${r.credit}${r.license ? ` · ${r.license}` : ""}${r.page ? `\n  ${r.page}` : ""}`)
    .join("\n");
}

// Things worth knowing before export.
export function exportWarnings(variant) {
  const out = [];
  const missing = needsImage(variant.slides || []);
  if (missing.length) out.push(`${missing.length === 1 ? "Slide" : "Slides"} ${missing.map((i) => i + 1).join(", ")} ${missing.length === 1 ? "has" : "have"} no photo yet, so ${missing.length === 1 ? "it exports" : "they export"} as text only.`);
  const facts = (variant.slides || []).map((s, i) => ((s.layout === "stat" && s.stat?.value) || (s.layout === "quote" && s.quote?.text) ? i + 1 : 0)).filter(Boolean);
  if (facts.length) out.push(`${facts.length === 1 ? "Slide" : "Slides"} ${facts.join(", ")} ${facts.length === 1 ? "has" : "have"} a number or quote written by AI. Check it against its source before posting.`);
  const unknown = creditsOf(variant).filter((r) => r.source === "web" && /unknown/i.test(r.license));
  if (unknown.length) out.push(`${unknown.length} ${unknown.length === 1 ? "photo comes" : "photos come"} from the open web with an unknown license. Check the source pages in the credits before publishing.`);
  return out;
}

export const validStyle = (id) => (STYLE_IDS.includes(id) ? id : "editorial");

// A short line for dashboard cards.
export function summaryOf(project) {
  const c = project.carousel || {};
  const v = activeVariant(project);
  const n = v?.slides?.length || c.plan?.slideCount || 0;
  return `${c.variants?.length || 0} ${c.variants?.length === 1 ? "variation" : "variations"} · ${n} slides`;
}

// The payload the engine needs for any slide-level request.
export const slidesForApi = (slides) => slides.map(({ id, img, ...s }) => s);
