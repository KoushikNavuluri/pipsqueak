// Talks to the carousel Edge Function and writes results into the store.
// Generation runs outside any component, so leaving the editor doesn't stop it.
import { askCarousel } from "../ai/client";
import { needsImage, normalizeSlide, slidesForApi, withVariant } from "./model";

// Search results per slide, kept for the session (not saved with the design).
const candidates = new Map();
export const candidatesFor = (slideId) => candidates.get(slideId) || null;
export const rememberCandidates = (slideId, list) => list?.length && candidates.set(slideId, list);

const running = new Map(); // variantId -> Promise

const brandOf = (c) => c.brand || {};

export async function planCarousel(request, { signal } = {}) {
  const { result } = await askCarousel(
    "plan",
    {
      topic: request.topic,
      notes: request.notes,
      sourceText: request.sourceText,
      brand: request.brand,
      variations: request.variations,
      custom: request.custom,
      quality: request.quality,
    },
    { signal },
  );
  return result;
}

export async function readSource(url, { signal } = {}) {
  const { result } = await askCarousel("read", { url }, { signal });
  return result;
}

// A design that was just added reaches the store on the next render.
async function waitForProject(api, id, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const p = api.get(id);
    if (p) return p;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

// Writes one variation, then finds its photos (and paints illustrations).
export function buildVariant({ api, projectId, variantId, request }) {
  if (running.has(variantId)) return running.get(variantId);
  let finish;
  const job = new Promise((r) => (finish = r));
  running.set(variantId, job);
  (async () => {
    const edit = (fn) => api.edit(projectId, (p) => withVariant(p, variantId, fn), { silent: true });
    const p0 = await waitForProject(api, projectId);
    const c = p0?.carousel;
    const v0 = c?.variants.find((v) => v.id === variantId);
    if (!c || !v0) {
      console.error("Carousel variation not found", projectId, variantId);
      return;
    }
    try {
      edit((v) => ({ ...v, status: "writing", error: "" }));
      const { result } = await askCarousel("write", {
        topic: c.topic,
        notes: c.notes,
        sourceText: request?.sourceText || "",
        brand: brandOf(c),
        plan: c.plan,
        direction: v0.direction,
        tone: c.tone,
        quality: request?.quality,
      });
      const slides = result.slides.map(normalizeSlide);
      edit((v) => ({ ...v, slides, caption: result.caption, hashtags: result.hashtags, status: "images" }));
      // Pass the new slides along: the store may not have them yet.
      await findImages({ api, projectId, variantId, slides });
      edit((v) => ({ ...v, status: "ready" }));
    } catch (err) {
      console.error("Carousel variation failed", err);
      edit((v) => ({ ...v, status: v.slides.length ? "ready" : "error", error: err.message || "Something went wrong." }));
      if (err.status === 429) api.toast(err.message, { tone: "error" });
    }
  })().finally(() => {
    running.delete(variantId);
    finish();
  });
  return job;
}

export const isRunning = (variantId) => running.has(variantId);

// Finds photos for the slides that need one (all, or `only` these indexes).
// `slides` is the current list when the caller just changed it (the store
// catches up on the next render); otherwise the stored slides are used.
export async function findImages({ api, projectId, variantId, only, slides: given }) {
  const p = await waitForProject(api, projectId);
  const c = p?.carousel;
  const found = c?.variants.find((x) => x.id === variantId);
  if (!found) return;
  const v = given ? { ...found, slides: given } : found;
  const idx = only || needsImage(v.slides);
  if (!idx.length) return;
  const edit = (fn) => api.edit(projectId, (pp) => withVariant(pp, variantId, fn), { silent: true });
  const illustrated = v.direction.imageApproach === "illustrated";
  const photoIdx = idx.filter((i) => v.slides[i]?.image?.kind !== "illustration" && !illustrated);
  const paintIdx = idx.filter((i) => !photoIdx.includes(i)).slice(0, 3);

  if (photoIdx.length) {
    const { result } = await askCarousel("images", {
      topic: c.topic,
      slides: slidesForApi(v.slides),
      only: photoIdx,
      style: v.direction.style,
      treatment: v.direction.treatment,
      licensed: c.licensed,
      projectId,
    });
    const byIndex = new Map(result.slides.map((s) => [s.index, s]));
    for (const s of result.slides) rememberCandidates(v.slides[s.index]?.id, s.candidates);
    edit((vv) => ({
      ...vv,
      slides: vv.slides.map((s, i) => {
        const got = byIndex.get(i);
        // Don't overwrite a photo the user picked while we were searching.
        return got?.chosen && !s.img?.src ? { ...s, img: got.chosen } : s;
      }),
    }));
  }
  for (const i of paintIdx) {
    const slide = v.slides[i];
    try {
      const { result } = await askCarousel("paint", {
        subject: slide.image.subject || slide.image.query || slide.title,
        style: v.direction.style,
        palette: v.direction.palette,
        aspect: c.format,
        projectId,
      });
      edit((vv) => ({ ...vv, slides: vv.slides.map((s) => (s.id === slide.id && !s.img?.src ? { ...s, img: result.image } : s)) }));
    } catch (err) {
      console.error("Painting failed", err);
      if (err.status === 429) throw err;
    }
  }
}

export async function searchPhotos(query, { licensed, entity } = {}) {
  const { result } = await askCarousel("search", { query, licensed, entity });
  return result.candidates;
}

export async function pinPhoto(candidate, projectId) {
  const { result } = await askCarousel("pin", { candidate, projectId });
  return result.image;
}

export async function paintPhoto({ subject, direction, format, projectId }) {
  const { result } = await askCarousel("paint", { subject, style: direction.style, palette: direction.palette, aspect: format, projectId });
  return result.image;
}

// Shrinks a photo in the browser and stores it.
export async function uploadPhoto(file, projectId) {
  if (!file?.type?.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 25 * 1024 * 1024) throw new Error("That photo is over 25 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.88));
  const data = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(blob);
  });
  const { result } = await askCarousel("upload", { data, name: file.name, projectId });
  return result.image;
}

export async function refineSlides({ project, variant, instruction, slideIndex, quality }) {
  const c = project.carousel;
  const { result } = await askCarousel("refine", {
    topic: c.topic,
    brand: c.brand,
    direction: variant.direction,
    slides: slidesForApi(variant.slides),
    instruction,
    slideIndex,
    quality,
  });
  return result;
}
