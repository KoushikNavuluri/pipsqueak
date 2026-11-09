// Pipsqueak's carousel engine.
//
// POST /functions/v1/carousel  { action, ...payload }
//   read     reads a web page to use as source material              free
//   plan     strategy, slide count, hooks and creative directions    1 credit
//   write    every slide of one direction, caption and hashtags      1 credit
//   images   finds, picks (AI photo editor) and stores slide images  1 credit
//   refine   edits slides from an instruction                        1 credit
//   paint    paints an illustration for one slide                    2 credits
//   search   image search for swapping a photo                       free, capped
//   pin      stores a chosen search result                           free, capped
//   upload   stores the user's own photo                             free, capped
//
// Every request needs a signed-in user. Runs are logged in public.ai_runs,
// which also enforces the daily credit quota shared with the `ai` function.
import { createClient } from "npm:@supabase/supabase-js@2";
import { HttpError, MODELS, generateJson, hasKey, paintImage, pickModels, requestBody, type Part } from "./gemini.ts";
import {
  FRAMEWORK_IDS,
  LAYOUT_IDS,
  PLAN_SYSTEM,
  RANK_SYSTEM,
  REFINE_SYSTEM,
  STYLE_IDS,
  WRITE_SYSTEM,
  paintPrompt,
  planRequestText,
  planSchema,
  rankSchema,
  refineRequestText,
  refineSchema,
  writeRequestText,
  writeSchema,
} from "./prompts.ts";
import { type Candidate, findCandidates, fromBase64, pinCandidate, readPage, sniffImage, storeBytes, thumbnailsFor } from "./media.ts";

const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") ?? 150);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Credits per action, and daily caps for the free ones.
const COST: Record<string, number> = { read: 0, plan: 1, write: 1, images: 1, refine: 1, paint: 2, search: 0, pin: 0, upload: 0 };
const FREE_CAP: Record<string, number> = { read: 40, search: 150, pin: 300, upload: 150 };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const clampInt = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
const HEX = /^#[0-9a-fA-F]{6}$/;
const folderOf = (v: unknown) => (/^[A-Za-z0-9_-]{1,64}$/.test(String(v ?? "")) ? String(v) : "misc");

// ---------- Input cleaning ----------

function brandOf(b: any) {
  const raw = b?.brand && typeof b.brand === "object" ? b.brand : {};
  let handle = str(raw.handle, 40).replace(/\s+/g, "");
  if (handle && !handle.startsWith("@")) handle = "@" + handle;
  return { handle: /^@[\w.]{1,30}$/.test(handle) ? handle : "", name: str(raw.name, 40) };
}

function baseOf(b: any) {
  const topic = str(b.topic, 500);
  if (topic.length < 3) throw new HttpError(400, "Describe the carousel's topic in a few words first.");
  return { topic, notes: str(b.notes, 2000), sourceText: str(b.sourceText, 12000), brand: brandOf(b) };
}

function cleanPalette(p: any) {
  const fallback = { bg: "#F6F1E7", ink: "#141210", muted: "#5E574C", accent: "#FF4D1A", onAccent: "#FFFFFF", surface: "#FFFFFF" };
  const out: Record<string, string> = {};
  for (const k of Object.keys(fallback) as (keyof typeof fallback)[]) out[k] = HEX.test(p?.[k]) ? p[k].toUpperCase() : fallback[k];
  return out;
}

function cleanDirection(d: any, i: number, slideFallback: number) {
  return {
    id: `d${i + 1}-${crypto.randomUUID().slice(0, 6)}`,
    style: STYLE_IDS.includes(d?.style) ? d.style : STYLE_IDS[i % STYLE_IDS.length],
    name: str(d?.name, 32) || `Direction ${i + 1}`,
    concept: str(d?.concept, 200),
    framework: FRAMEWORK_IDS.includes(d?.framework) ? d.framework : "listicle",
    slideCount: clampInt(d?.slideCount, 3, 20, slideFallback),
    hook: str(d?.hook, 90),
    imageApproach: ["photo_led", "photo_accents", "type_only", "illustrated"].includes(d?.imageApproach) ? d.imageApproach : "photo_accents",
    treatment: ["natural", "duotone", "mono", "darken", "grain", "framed", "polaroid"].includes(d?.treatment) ? d.treatment : "natural",
    continuity: ["none", "panorama", "thread"].includes(d?.continuity) ? d.continuity : "none",
    palette: cleanPalette(d?.palette),
  };
}

function cleanSlide(s: any, i: number, total: number) {
  const items = Array.isArray(s?.items) ? s.items.slice(0, 6).map((it: any) => ({ label: str(it?.label, 28), text: str(it?.text, 100) })).filter((it: any) => it.label || it.text) : [];
  let layout = LAYOUT_IDS.includes(s?.layout) ? s.layout : "statement";
  if (i === 0) layout = "cover";
  else if (i === total - 1) layout = "cta";
  else if (layout === "cover" || layout === "cta") layout = "statement";
  const img = s?.image && typeof s.image === "object" ? s.image : {};
  return {
    layout,
    kicker: str(s?.kicker, 32),
    title: str(s?.title, 90),
    highlight: str(s?.highlight, 40),
    body: str(s?.body, 220),
    items,
    stat: { value: str(s?.stat?.value, 8), label: str(s?.stat?.label, 60) },
    quote: { text: str(s?.quote?.text, 180), by: str(s?.quote?.by, 60) },
    source: str(s?.source, 80),
    image: {
      use: !!img.use && !!str(img.query, 70),
      kind: ["photo", "entity", "texture", "illustration"].includes(img.kind) ? img.kind : "photo",
      query: str(img.query, 70),
      altQuery: str(img.altQuery, 70),
      subject: str(img.subject, 160),
    },
    alt: str(s?.alt, 300),
  };
}

const cleanSlides = (list: unknown) => {
  const arr = Array.isArray(list) ? list.slice(0, 20) : [];
  return arr.map((s, i) => cleanSlide(s, i, arr.length));
};

const publicCandidate = (c: Candidate) => ({
  id: c.id,
  source: c.source,
  thumb: c.thumb,
  full: c.full,
  original: c.original,
  page: c.page,
  title: c.title,
  width: c.width,
  height: c.height,
  credit: c.credit,
  license: c.license,
});

function candidateFrom(v: any): Candidate {
  const c = v && typeof v === "object" ? v : {};
  const url = (u: unknown) => (typeof u === "string" && /^https?:\/\//.test(u) ? u.slice(0, 2000) : undefined);
  const full = url(c.full) || url(c.original);
  if (!full) throw new HttpError(400, "Pick an image first.");
  return {
    id: str(c.id, 120) || "link",
    source: ["web", "wikimedia", "openverse"].includes(c.source) ? c.source : "web",
    thumb: url(c.thumb) || full,
    full,
    original: url(c.original),
    page: url(c.page),
    title: str(c.title, 140),
    credit: str(c.credit, 120),
    license: str(c.license, 160),
  };
}

// The user's image choice in a custom setup, mapped to an image approach.
const IMAGE_CHOICE: Record<string, string> = { most: "photo_led", some: "photo_accents", none: "type_only", illustrated: "illustrated" };

// ---------- Actions ----------

async function plan(b: any, taste: string) {
  const base = baseOf(b);
  const custom = b.custom && typeof b.custom === "object" ? b.custom : {};
  const variations = clampInt(b.variations, 1, 4, 3);
  const slides = custom.slides ? clampInt(custom.slides, 3, 20, 8) : 0;
  const styles = Array.isArray(custom.styles) ? custom.styles.filter((s: unknown) => STYLE_IDS.includes(String(s))).slice(0, 4) : [];
  const request = {
    ...base,
    variations,
    custom: { slides, styles, tone: str(custom.tone, 80), goal: str(custom.goal, 20), extra: str(custom.extra, 400), images: IMAGE_CHOICE[custom.images] ? custom.images : "" },
    taste,
  };
  const result = await generateJson(pickModels(b.quality), requestBody(PLAN_SYSTEM, [{ text: planRequestText(request) }], planSchema, 0.9));
  const d = result.data || {};
  const recommended = clampInt(d.slideCount, 3, 20, 8);
  let directions = (Array.isArray(d.directions) ? d.directions : []).slice(0, variations).map((x: any, i: number) => cleanDirection(x, i, recommended));
  if (!directions.length) throw new HttpError(502, "Pip couldn't plan this one. Try again.");
  // The user's choices win over the model's.
  const images = IMAGE_CHOICE[custom.images] ?? null;
  directions = directions.map((x: any, i: number) => ({ ...x, ...(slides ? { slideCount: slides } : {}), ...(styles[i] ? { style: styles[i] } : {}), ...(images ? { imageApproach: images } : {}) }));
  // Without an explicit choice, never return only text-only designs.
  if (!images && directions.length > 1 && directions.every((x: any) => x.imageApproach === "type_only")) {
    directions = directions.map((x: any, i: number) => (i === directions.length - 1 ? x : { ...x, imageApproach: i === 0 ? "photo_led" : "photo_accents" }));
  }
  return {
    out: {
      title: str(d.title, 60) || base.topic.slice(0, 60),
      audience: str(d.audience, 120),
      goal: ["saves", "shares", "comments", "follows"].includes(d.goal) ? d.goal : "saves",
      angle: str(d.angle, 200),
      slideCount: slides || recommended,
      reasoning: str(d.reasoning, 240),
      hooks: (Array.isArray(d.hooks) ? d.hooks : []).map((h: unknown) => str(h, 90)).filter(Boolean).slice(0, 5),
      directions,
    },
    result,
  };
}

async function write(b: any, taste: string) {
  const base = baseOf(b);
  const direction = cleanDirection(b.direction, 0, 8);
  direction.id = str(b.direction?.id, 40) || direction.id;
  const plan = b.plan && typeof b.plan === "object" ? b.plan : {};
  const text = writeRequestText({
    ...base,
    plan: { audience: str(plan.audience, 120), goal: str(plan.goal, 20), angle: str(plan.angle, 200) },
    direction,
    tone: str(b.tone, 80),
    taste,
  });
  const result = await generateJson(pickModels(b.quality), requestBody(WRITE_SYSTEM, [{ text }], writeSchema, 0.85), 120_000);
  const slides = cleanSlides(result.data?.slides);
  if (slides.length < 2) throw new HttpError(502, "Pip's draft came back incomplete. Try again.");
  return {
    out: {
      slides,
      caption: str(result.data?.caption, 1400),
      hashtags: (Array.isArray(result.data?.hashtags) ? result.data.hashtags : []).map((h: unknown) => str(h, 40).replace(/^#/, "").replace(/\s+/g, "")).filter(Boolean).slice(0, 12),
    },
    result,
  };
}

// Finds candidates for every slide that needs a photo, lets the model act as
// photo editor, then stores the picks. Slides whose picks all fail to download
// come back with candidates but no image, and the editor offers to swap.
async function images(b: any, admin: any, userId: string) {
  const slides = cleanSlides(b.slides);
  const wanted = Array.isArray(b.only) ? new Set(b.only.map(Number)) : null;
  const licensed = b.licensed === true;
  const folder = folderOf(b.projectId);
  const style = STYLE_IDS.includes(b.style) ? b.style : "editorial";
  const needs = slides
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => s.image.use && s.image.kind !== "illustration" && (!wanted || wanted.has(i)));
  if (!needs.length) return { out: { slides: [] }, result: null };

  const found = await Promise.all(needs.map(({ s }) => findCandidates(s.image, { licensed, limit: 7 })));
  const all = found.flat();
  const thumbs = await thumbnailsFor(all);
  const letters = "ABCDEFGH";

  // The photo editor sees each slide's brief and its candidates.
  const parts: Part[] = [{ text: `CAROUSEL TOPIC: ${str(b.topic, 300)}\nSTYLE: ${style}\nPHOTO TREATMENT: ${str(b.treatment, 20) || "natural"}` }];
  const shown = new Map<string, Candidate[]>();
  needs.forEach(({ s, i }, n) => {
    const usable = found[n].filter((c) => thumbs.has(c.id));
    if (!usable.length) return;
    shown.set(String(i + 1), usable);
    parts.push({ text: `SLIDE ${i + 1} (${s.layout}) headline: "${s.title}". Image brief: ${s.image.subject || s.image.query}.` });
    usable.forEach((c, k) => {
      parts.push({ text: `${i + 1}.${letters[k]}${c.title ? ` (${c.title.slice(0, 80)})` : ""}` });
      parts.push({ inlineData: thumbs.get(c.id)! });
    });
  });

  let picks: any[] = [];
  let result: any = null;
  if (shown.size) {
    try {
      result = await generateJson([MODELS.fast, MODELS.fallback], requestBody(RANK_SYSTEM, parts, rankSchema, 0.2), 90_000);
      picks = Array.isArray(result.data?.picks) ? result.data.picks : [];
    } catch (err) {
      // Without the editor, fall back to search order rather than fail the carousel.
      console.error("Ranking failed; using search order", String(err));
    }
  }

  const used = new Set<string>();
  const out = await Promise.all(
    needs.map(async ({ i }, n) => {
      const list = shown.get(String(i + 1)) ?? [];
      const pick = picks.find((p) => Number(p?.slide) === i + 1);
      const ordered: Candidate[] = [];
      for (const label of Array.isArray(pick?.order) ? pick.order : []) {
        // Accept "B", "3.B" or "3B".
        const letter = /([A-H])\s*$/i.exec(String(label).trim())?.[1]?.toUpperCase() ?? "";
        const c = letter ? list[letters.indexOf(letter)] : undefined;
        if (c && !ordered.includes(c)) ordered.push(c);
      }
      // Without the editor's verdict (it failed, or previews didn't load),
      // fall back to the top search results.
      if (!pick) ordered.push(...(list.length ? list : found[n] ?? []).slice(0, 3));
      const focus = { x: clampInt(pick?.focusX, 0, 100, 50), y: clampInt(pick?.focusY, 0, 100, 45) };
      let chosen: any = null;
      let problem = ordered.length ? "" : "No suitable photo found";
      for (const c of ordered) {
        if (used.has(c.id)) continue;
        try {
          const src = await pinCandidate(admin, userId, folder, c);
          used.add(c.id);
          chosen = { ...publicCandidate(c), src, focus, textArea: ["light", "dark", "busy"].includes(pick?.textArea) ? pick.textArea : "busy" };
          break;
        } catch (err) {
          problem = String((err as Error)?.message ?? err).slice(0, 160);
          console.error("Pin failed", c.id, problem);
        }
      }
      // Nothing usable: one more try with the slide's second search, top results in order.
      if (!chosen) {
        const s = slides[i];
        const retry = s.image.altQuery ? await findCandidates({ query: s.image.altQuery, kind: s.image.kind }, { licensed, limit: 4 }) : [];
        for (const c of retry) {
          if (used.has(c.id)) continue;
          try {
            const src = await pinCandidate(admin, userId, folder, c);
            used.add(c.id);
            chosen = { ...publicCandidate(c), src, focus: { x: 50, y: 45 }, textArea: "busy" };
            found[n] = [...(found[n] ?? []), ...retry];
            break;
          } catch (err) {
            problem = String((err as Error)?.message ?? err).slice(0, 160);
          }
        }
      }
      return { index: i, chosen, problem: chosen ? "" : problem, candidates: (found[n] ?? []).map(publicCandidate) };
    }),
  );
  return { out: { slides: out, stats: { found: all.length, previews: thumbs.size, ranked: picks.length } }, result };
}

async function refine(b: any, taste: string) {
  const base = baseOf(b);
  const slides = cleanSlides(b.slides);
  if (!slides.length) throw new HttpError(400, "There are no slides to edit.");
  const instruction = str(b.instruction, 600);
  if (instruction.length < 2) throw new HttpError(400, "Tell Pip what to change.");
  const slideIndex = Number.isInteger(b.slideIndex) && b.slideIndex >= 0 && b.slideIndex < slides.length ? b.slideIndex : null;
  const d = cleanDirection(b.direction, 0, slides.length);
  const text = refineRequestText({ ...base, direction: d, slides, slideIndex, instruction }) + (taste ? `\n\n${taste}` : "");
  const result = await generateJson(pickModels(b.quality), requestBody(REFINE_SYSTEM, [{ text }], refineSchema, 0.7), 120_000);
  const next = cleanSlides(result.data?.slides);
  if (next.length < 2) throw new HttpError(502, "Pip's edit came back incomplete. Try again.");
  return { out: { slides: next, note: str(result.data?.note, 160) }, result };
}

async function paint(b: any, admin: any, userId: string) {
  const subject = str(b.subject, 300);
  if (!subject) throw new HttpError(400, "Describe what to paint first.");
  const style = STYLE_IDS.includes(b.style) ? b.style : "editorial";
  const aspect = ["4:5", "1:1", "3:4"].includes(b.aspect) ? b.aspect : "4:5";
  const img = await paintImage(paintPrompt(subject, style, b.palette), aspect);
  const bytes = fromBase64(img.data);
  const kind = sniffImage(bytes);
  if (!kind) throw new HttpError(502, "Pip's painting came back unreadable. Try again.");
  const src = await storeBytes(admin, userId, folderOf(b.projectId), bytes, kind);
  return {
    out: { image: { id: `ai:${crypto.randomUUID().slice(0, 8)}`, source: "ai", src, thumb: src, full: src, credit: "Painted by Pip (AI)", license: "AI-generated", focus: { x: 50, y: 45 }, textArea: "busy" } },
    result: { model: img.model, usage: img.usage },
  };
}

async function upload(b: any, admin: any, userId: string) {
  const data = typeof b.data === "string" ? b.data : "";
  if (!data || data.length > 8_000_000 || !/^[A-Za-z0-9+/=]+$/.test(data.slice(0, 200))) throw new HttpError(400, "That photo is too large. Keep it under 6 MB.");
  const bytes = fromBase64(data);
  const kind = sniffImage(bytes);
  if (!kind) throw new HttpError(415, "Upload a JPEG, PNG, WebP or AVIF photo.");
  const src = await storeBytes(admin, userId, folderOf(b.projectId), bytes, kind);
  const name = str(b.name, 80);
  return { id: `upload:${src.slice(-28)}`, source: "upload", src, thumb: src, full: src, title: name, credit: "Your photo", license: "Yours", focus: { x: 50, y: 45 }, textArea: "busy" };
}

// ---------- Handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Use POST." });
  if (!hasKey()) return json(500, { error: "Pipsqueak isn't configured yet." });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  let runId: number | null = null;
  const started = Date.now();
  const finish = async (status: "ok" | "error", fields: Record<string, unknown> = {}) => {
    if (runId === null) return;
    await admin.from("ai_runs").update({ status, latency_ms: Date.now() - started, ...fields }).eq("id", runId);
  };
  const done = async (result: any) =>
    finish("ok", result ? { model: result.model, input_tokens: result.usage?.input ?? null, output_tokens: result.usage?.output ?? null } : {});

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: auth } = await userClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    const user = auth?.user;
    if (!user) throw new HttpError(401, "Sign in to keep designing.");

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, "The request body must be JSON.");
    }
    const action = String(body?.action ?? "");
    if (!(action in COST)) throw new HttpError(400, "Unknown action.");
    const logged = `carousel_${action}`;

    // Log the run first so parallel requests count toward the quota.
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { data: run, error: runError } = await admin.from("ai_runs").insert({ user_id: user.id, action: logged, cost: COST[action] }).select("id").single();
    if (runError) throw new Error("Couldn't log the run: " + runError.message);
    runId = run.id;
    const { data: today } = await admin.from("ai_runs").select("cost, action").eq("user_id", user.id).neq("status", "error").gte("created_at", since.toISOString());
    const used = (today ?? []).reduce((n, r) => n + r.cost, 0);
    const quota = { used, limit: DAILY_LIMIT };
    if (COST[action] > 0 && used > DAILY_LIMIT) {
      await finish("error", { error: "quota", cost: 0 });
      runId = null;
      throw new HttpError(429, `You've used today's ${DAILY_LIMIT} credits. They reset at midnight UTC.`, { quota });
    }
    if (FREE_CAP[action] && (today ?? []).filter((r) => r.action === logged).length > FREE_CAP[action]) {
      await finish("error", { error: "cap", cost: 0 });
      runId = null;
      throw new HttpError(429, "You've reached today's limit for this. It resets at midnight UTC.", { quota });
    }

    const { data: profile } = await admin.from("profiles").select("display_name, ai_taste").eq("id", user.id).maybeSingle();
    const t = profile?.ai_taste || {};
    const taste = [t.voice && `Brand voice they like: ${t.voice}`, t.audience && `Usual audience: ${t.audience}`, t.locale && `Locale: ${t.locale}`]
      .filter(Boolean)
      .join("\n");

    switch (action) {
      case "read": {
        const page = await readPage(str(body.url, 2000));
        await done(null);
        return json(200, { result: page, quota });
      }
      case "plan": {
        const { out, result } = await plan(body, taste);
        await done(result);
        return json(200, { result: out, quota });
      }
      case "write": {
        const { out, result } = await write(body, taste);
        await done(result);
        return json(200, { result: out, quota });
      }
      case "images": {
        const { out, result } = await images(body, admin, user.id);
        await done(result);
        return json(200, { result: out, quota });
      }
      case "refine": {
        const { out, result } = await refine(body, taste);
        await done(result);
        return json(200, { result: out, quota });
      }
      case "paint": {
        const { out, result } = await paint(body, admin, user.id);
        await done(result);
        return json(200, { result: out, quota });
      }
      case "search": {
        const query = str(body.query, 100);
        if (query.length < 2) throw new HttpError(400, "Type what the photo should show.");
        const list = await findCandidates({ query, kind: body.entity ? "entity" : "photo" }, { licensed: body.licensed === true, limit: 16 });
        await done(null);
        return json(200, { result: { candidates: list.map(publicCandidate) }, quota });
      }
      case "pin": {
        const c = candidateFrom(body.candidate);
        const src = await pinCandidate(admin, user.id, folderOf(body.projectId), c);
        await done(null);
        return json(200, { result: { image: { ...publicCandidate(c), src, focus: { x: 50, y: 45 }, textArea: "busy" } }, quota });
      }
      case "upload": {
        const image = await upload(body, admin, user.id);
        await done(null);
        return json(200, { result: { image }, quota });
      }
    }
    throw new HttpError(400, "Unknown action.");
  } catch (err) {
    const timeout = err instanceof DOMException && err.name === "TimeoutError";
    const status = err instanceof HttpError ? err.status : timeout ? 504 : 500;
    const message = err instanceof HttpError ? err.message : timeout ? "That took too long. Try again." : "Something went wrong on our side. Try again.";
    if (!(err instanceof HttpError) || status >= 500) console.error("Carousel request failed", err);
    await finish("error", { error: String((err as Error)?.message ?? err).slice(0, 300), cost: 0 });
    return json(status, { error: message, ...(err instanceof HttpError ? err.extra : {}) });
  }
});
