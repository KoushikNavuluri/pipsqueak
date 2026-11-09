// Talks to the carousel Edge Function and writes results into the store.
// Generation runs outside any component, so leaving the editor doesn't stop it.
import { askCarousel } from "../ai/client";
import { needsImage, normalizeSlide, slidesForApi, withVariant } from "./model";
import { uid } from "../util";

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Slides from a write get ids derived from the run, so a result recovered
// after a reload has the same ids the photo search was keyed on.
const slidesFromWrite = (result, run) =>
  result.slides.map((s, i) => {
    const slide = normalizeSlide({ ...s, id: `${run}-${i}` });
    return slide.image?.use && !slide.img?.src ? { ...slide, image: { ...slide.image, status: "searching" } } : slide;
  });

// Applies a photo-search result: by slide id (by position for old results).
// A photo the user picked meanwhile is never replaced.
export function applyImages(slides, result) {
  const rows = result?.slides || [];
  const byId = new Map(rows.filter((r) => r.id).map((r) => [r.id, r]));
  const byIndex = new Map(rows.filter((r) => !r.id).map((r) => [r.index, r]));
  return slides.map((s, i) => {
    const r = byId.get(s.id) || byIndex.get(i);
    if (!r) return s;
    rememberCandidates(s.id, r.candidates);
    if (s.img?.src) return { ...s, image: { ...s.image, status: "ok" } };
    return r.chosen ? { ...s, img: r.chosen, image: { ...s.image, status: "ok" } } : { ...s, image: { ...s.image, status: "none" } };
  });
}

const recover = async (projectId, variantId, run) => {
  try {
    const { result } = await askCarousel("recover", { projectId, variantId, run });
    return result || {};
  } catch {
    return {};
  }
};

// Writes one variation, then finds its photos (and paints illustrations).
// Every step's result is also kept on the server for this run, so after a
// reload `resumeVariant` picks up where it stopped without paying again.
export function buildVariant({ api, projectId, variantId, request, fresh = false }) {
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
    const run = fresh || !v0.run ? uid() : v0.run;
    try {
      edit((v) => ({ ...v, run, startedAt: v.run === run ? v.startedAt || Date.now() : Date.now(), status: "writing", error: "" }));
      const saved = fresh || !v0.run ? {} : await recover(projectId, variantId, run);
      const written =
        saved.write ||
        (
          await askCarousel("write", {
            topic: c.topic,
            notes: c.notes,
            sourceText: request?.sourceText || "",
            brand: brandOf(c),
            plan: c.plan,
            direction: v0.direction,
            tone: c.tone,
            quality: request?.quality,
            projectId,
            variantId,
            run,
          })
        ).result;
      const slides = slidesFromWrite(written, run);
      edit((v) => ({ ...v, slides, caption: written.caption, hashtags: written.hashtags, status: "images" }));
      if (saved.images) edit((v) => ({ ...v, slides: applyImages(v.slides, saved.images) }));
      else await findImages({ api, projectId, variantId, slides, run });
      edit((v) => ({ ...v, status: "ready" }));
    } catch (err) {
      console.error("Carousel variation failed", err);
      edit((v) => ({
        ...v,
        status: v.slides.length ? "ready" : "error",
        error: err.message || "Something went wrong.",
        slides: v.slides.map((s) => (s.image?.status === "searching" ? { ...s, image: { ...s.image, status: "none" } } : s)),
      }));
      if (err.status === 429) api.toast(err.message, { tone: "error" });
    }
  })().finally(() => {
    running.delete(variantId);
    finish();
  });
  return job;
}

export const isRunning = (variantId) => running.has(variantId);

// After a reload: a variation still marked as generating is finished from
// the results saved on the server. A write that is still in flight there is
// waited for (up to two minutes after it started); only then is the
// variation marked as stopped.
export function resumeVariant({ api, projectId, variantId }) {
  if (running.has(variantId)) return running.get(variantId);
  let finish;
  const job = new Promise((r) => (finish = r));
  running.set(variantId, job);
  (async () => {
    const edit = (fn) => api.edit(projectId, (p) => withVariant(p, variantId, fn), { silent: true });
    const p0 = await waitForProject(api, projectId);
    const v0 = p0?.carousel?.variants.find((v) => v.id === variantId);
    if (!v0) return;
    if (!v0.run) {
      edit((v) => ({ ...v, status: v.slides.length ? "ready" : "stopped" }));
      return;
    }
    const deadline = (v0.startedAt || 0) + 120_000;
    let saved = await recover(projectId, variantId, v0.run);
    while (!saved.write && !v0.slides.length && Date.now() < deadline) {
      await sleep(4000);
      saved = await recover(projectId, variantId, v0.run);
    }
    try {
      // Work from the slides in hand: an edit reaches the store only on the
      // next render, so reading it back here would still see the old list.
      let slides = v0.slides;
      if (saved.write && !slides.length) {
        slides = slidesFromWrite(saved.write, v0.run);
        edit((v) => ({ ...v, slides, caption: saved.write.caption, hashtags: saved.write.hashtags, status: "images" }));
      }
      if (!slides.length) {
        edit((v) => ({ ...v, status: "stopped" }));
        return;
      }
      edit((v) => ({ ...v, status: "images" }));
      if (saved.images) edit((v) => ({ ...v, slides: applyImages(v.slides, saved.images) }));
      else await findImages({ api, projectId, variantId, slides, run: v0.run });
      edit((v) => ({ ...v, status: "ready" }));
    } catch (err) {
      console.error("Resuming failed", err);
      edit((v) => ({ ...v, status: v.slides.length ? "ready" : "stopped", slides: v.slides.map((s) => (s.image?.status === "searching" ? { ...s, image: { ...s.image, status: "none" } } : s)) }));
    }
  })().finally(() => {
    running.delete(variantId);
    finish();
  });
  return job;
}

// Finds photos for the slides that need one (all, or `only` these indexes).
// `slides` is the current list when the caller just changed it (the store
// catches up on the next render); otherwise the stored slides are used.
export async function findImages({ api, projectId, variantId, only, slides: given, run }) {
  const p = await waitForProject(api, projectId);
  const c = p?.carousel;
  const found = c?.variants.find((x) => x.id === variantId);
  if (!found) return;
  const v = given ? { ...found, slides: given } : found;
  const idx = only || needsImage(v.slides);
  if (!idx.length) return;
  const edit = (fn) => api.edit(projectId, (pp) => withVariant(pp, variantId, fn), { silent: true });
  const targets = new Set(idx.map((i) => v.slides[i]?.id).filter(Boolean));
  const mark = (status) => edit((vv) => ({ ...vv, slides: vv.slides.map((s) => (targets.has(s.id) && !s.img?.src ? { ...s, image: { ...s.image, status } } : s)) }));
  mark("searching");
  const illustrated = v.direction.imageApproach === "illustrated";
  const photoIdx = idx.filter((i) => v.slides[i]?.image?.kind !== "illustration" && !illustrated);
  const paintIdx = idx.filter((i) => !photoIdx.includes(i)).slice(0, 3);
  try {
    if (photoIdx.length) {
      const { result } = await askCarousel("images", {
        topic: c.topic,
        slides: slidesForApi(v.slides),
        ids: v.slides.map((s) => s.id),
        only: photoIdx,
        style: v.direction.style,
        treatment: v.direction.treatment,
        licensed: c.licensed,
        projectId,
        variantId,
        run: run || found.run,
      });
      edit((vv) => ({ ...vv, slides: applyImages(vv.slides, result) }));
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
        edit((vv) => ({ ...vv, slides: vv.slides.map((s) => (s.id === slide.id && !s.img?.src ? { ...s, img: result.image, image: { ...s.image, status: "ok" } } : s)) }));
      } catch (err) {
        console.error("Painting failed", err);
        if (err.status === 429) throw err;
      }
    }
  } finally {
    // Anything still searching (a failed request) has no photo.
    edit((vv) => ({ ...vv, slides: vv.slides.map((s) => (targets.has(s.id) && !s.img?.src && s.image?.status === "searching" ? { ...s, image: { ...s.image, status: "none" } } : s)) }));
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
