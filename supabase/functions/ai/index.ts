// Pipsqueak's design engine: one Edge Function for every AI action.
//
// POST /functions/v1/ai  { action, ...payload }
//   brief                                     sharpens an idea, asks questions
//   understand, systems, copilot, critique    JSON stages (see design.ts)
//   screen, edit_html                         streamed HTML (server-sent events)
//   image                                     paints an image for the kit
//
// Every request needs a signed-in user. Runs are logged in public.ai_runs,
// which also enforces a daily quota.
import { createClient } from "npm:@supabase/supabase-js@2";
import { BRIEF_SYSTEM, briefSchema, tasteText } from "./prompts.ts";
import {
  COPILOT_SYSTEM,
  CRITIQUE_SYSTEM,
  EDIT_HTML_SYSTEM,
  SCREEN_SYSTEM,
  SYSTEMS_SYSTEM,
  UNDERSTAND_SYSTEM,
  copilotRequestText,
  copilotSchema,
  critiqueRequestText,
  critiqueSchema,
  editRequestText,
  screenRequestText,
  systemsRequestText,
  systemsSchema,
  understandRequestText,
  understandSchema,
} from "./design.ts";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") ?? 150);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERTEX = "https://aiplatform.googleapis.com/v1/publishers/google/models";

const MODELS = {
  fast: { name: "gemini-3.5-flash", thinking: "minimal" },
  best: { name: "gemini-3.1-pro-preview", thinking: "low" },
  fallback: { name: "gemini-3-flash-preview", thinking: "minimal" },
  image: { name: "gemini-2.5-flash-image" },
};
const COST: Record<string, number> = {
  brief: 1,
  image: 2,
  understand: 1,
  systems: 1,
  screen: 1,
  edit_html: 1,
  copilot: 1,
  critique: 1,
};
// JSON stages of the design engine: [system prompt, schema, request text].
const DESIGN_JSON: Record<string, [string, unknown, (body: any, taste: string) => string]> = {
  understand: [UNDERSTAND_SYSTEM, understandSchema, understandRequestText],
  systems: [SYSTEMS_SYSTEM, systemsSchema, systemsRequestText],
  copilot: [COPILOT_SYSTEM, copilotSchema, (b) => copilotRequestText(b)],
  critique: [CRITIQUE_SYSTEM, critiqueSchema, (b) => critiqueRequestText(b)],
};
const RETRYABLE = new Set([404, 408, 429, 500, 502, 503, 504]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// ---------- Model calls ----------

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
type ModelChoice = { name: string; thinking?: string };

function requestBody(system: string, parts: Part[], schema: unknown | null, mime = "application/json") {
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: mime,
      ...(schema ? { responseSchema: schema } : {}),
      maxOutputTokens: 24576,
    },
  };
}

// The model's HTML, minus any code fences it wrapped around it.
const stripFences = (t: string) => t.trim().replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim();

function withThinking(body: Record<string, any>, model: ModelChoice) {
  if (!model.thinking) return body;
  return { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingLevel: model.thinking } } };
}

// Calls the first model that answers; moves down the list on capacity errors.
async function callModel(models: ModelChoice[], body: Record<string, any>, stream: boolean, timeoutMs: number, signal?: AbortSignal) {
  let last = "";
  for (const model of models) {
    const url = `${VERTEX}/${model.name}:${stream ? "streamGenerateContent?alt=sse&" : "generateContent?"}key=${GEMINI_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withThinking(body, model)),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) return { res, model: model.name };
    last = `${model.name} ${res.status}: ${(await res.text()).slice(0, 300)}`;
    console.error("Model error", last);
    if (!RETRYABLE.has(res.status)) break;
  }
  throw new HttpError(502, "Pipsqueak is very busy right now. Try again in a moment.");
}

function textOf(payload: any) {
  const cand = payload?.candidates?.[0];
  return (cand?.content?.parts ?? [])
    .filter((p: any) => typeof p.text === "string" && !p.thought)
    .map((p: any) => p.text)
    .join("");
}

function usageOf(payload: any) {
  const u = payload?.usageMetadata ?? {};
  return { input: u.promptTokenCount ?? null, output: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) || null };
}

// Non-streaming JSON call, retried once if the output doesn't parse.
async function generateJson(models: ModelChoice[], body: Record<string, any>, timeoutMs = 90_000) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { res, model } = await callModel(models, body, false, timeoutMs);
    const payload = await res.json();
    const finish = payload?.candidates?.[0]?.finishReason;
    if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT") {
      throw new HttpError(422, "Pip can't help with that request. Try rephrasing it.");
    }
    try {
      return { data: JSON.parse(textOf(payload)), model, usage: usageOf(payload) };
    } catch {
      console.error("Unparseable model output", finish, textOf(payload).slice(0, 200));
    }
  }
  throw new HttpError(502, "That answer came back incomplete. Try again.");
}

// ---------- Validation ----------

function validImage(img: any) {
  if (!img) return null;
  const mime = str(img.mimeType, 40);
  const data = typeof img.data === "string" ? img.data : "";
  if (!["image/png", "image/jpeg", "image/webp"].includes(mime)) throw new HttpError(400, "Images must be PNG, JPEG or WebP.");
  if (!data || data.length > 6_000_000 || !/^[A-Za-z0-9+/=]+$/.test(data.slice(0, 200))) {
    throw new HttpError(400, "That image is too large. Keep it under 4 MB.");
  }
  return { inlineData: { mimeType: mime, data } };
}

const pickModels = (quality: unknown) =>
  quality === "best" ? [MODELS.best, MODELS.fast, MODELS.fallback] : [MODELS.fast, MODELS.fallback];

// ---------- Actions ----------

function briefRequest(body: any, taste: string) {
  const prompt = str(body.prompt, 1500);
  if (prompt.length < 3) throw new HttpError(400, "Describe your idea in a few words first.");
  return requestBody(BRIEF_SYSTEM, [{ text: [`Rough idea: ${prompt}`, taste].filter(Boolean).join("\n\n") }], briefSchema);
}

async function paint(body: any) {
  const subject = str(body.subject, 300);
  if (!subject) throw new HttpError(400, "Nothing to paint yet.");
  const app = body.app && typeof body.app === "object" ? body.app : {};
  // Kit images follow the design system's own art direction.
  const direction = str(body.direction, 400) || "an editorial photograph with natural light, real textures and a shallow depth of field";
  const colors = [str(app.accent, 9), str(app.accent2, 9), str(app.background, 9)].filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
  const prompt = `Create an image in this art direction: ${direction}. It is for a product called "${str(app.name, 30)}". Subject: ${subject}. ${colors.length ? `Let these colors lead the palette: ${colors.join(", ")}.` : ""} Specific and characterful, like a still from a real product, not generic stock imagery. No text, no letters, no logos, no user interface, no phone or device frames.`;
  const ASPECTS: Record<string, string> = { portrait: "3:4", landscape: "4:3", square: "1:1", wide: "16:9" };
  const aspect = ASPECTS[body.aspect] ?? "4:3";
  const { res, model } = await callModel([MODELS.image], {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } },
  }, false, 90_000);
  const payload = await res.json();
  const part = (payload?.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData?.data);
  if (!part) throw new HttpError(422, "Pip couldn't paint that one. Try again.");
  return { data: { mimeType: part.inlineData.mimeType, data: part.inlineData.data }, model, usage: usageOf(payload) };
}

// ---------- Handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Use POST." });
  if (!GEMINI_KEY) return json(500, { error: "Pipsqueak isn't configured yet." });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  let runId: number | null = null;
  const started = Date.now();
  const finish = async (status: "ok" | "error", fields: Record<string, unknown> = {}) => {
    if (runId === null) return;
    await admin.from("ai_runs").update({ status, latency_ms: Date.now() - started, ...fields }).eq("id", runId);
  };

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
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

    // Log the run first so parallel requests count toward the quota.
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { data: run, error: runError } = await admin
      .from("ai_runs")
      .insert({ user_id: user.id, action, cost: COST[action] })
      .select("id")
      .single();
    if (runError) throw new Error("Couldn't log the run: " + runError.message);
    runId = run.id;
    const { data: today } = await admin
      .from("ai_runs")
      .select("cost")
      .eq("user_id", user.id)
      .neq("status", "error")
      .gte("created_at", since.toISOString());
    const used = (today ?? []).reduce((n, r) => n + r.cost, 0);
    const quota = { used, limit: DAILY_LIMIT };
    if (used > DAILY_LIMIT) {
      await finish("error", { error: "quota", cost: 0 });
      runId = null;
      throw new HttpError(429, `You've used today's ${DAILY_LIMIT} credits. They reset at midnight UTC.`, { quota });
    }

    const { data: profile } = await admin.from("profiles").select("display_name, ai_taste").eq("id", user.id).maybeSingle();
    const taste = tasteText(profile?.ai_taste ?? null, profile?.display_name);

    if (action === "image") {
      const result = await paint(body);
      await finish("ok", { model: result.model, input_tokens: result.usage.input, output_tokens: result.usage.output });
      return json(200, { image: result.data, quota });
    }

    if (DESIGN_JSON[action]) {
      const [system, schema, text] = DESIGN_JSON[action];
      const parts: Part[] = [{ text: text(body, taste) }];
      const image = action === "understand" ? validImage(body.image) : null;
      if (image) parts.push(image);
      const result = await generateJson([MODELS.fast, MODELS.fallback], requestBody(system, parts, schema));
      await finish("ok", { model: result.model, input_tokens: result.usage.input, output_tokens: result.usage.output });
      return json(200, { result: result.data, quota });
    }

    if (action === "brief") {
      const result = await generateJson(pickModels(body.quality), briefRequest(body, taste));
      await finish("ok", { model: result.model, input_tokens: result.usage.input, output_tokens: result.usage.output });
      return json(200, { result: result.data, quota });
    }

    // Streamed actions: relay the model's stream as our own server-sent events.
    let request: Record<string, any>;
    let validate: (text: string) => boolean;
    if (action === "screen") {
      const parts: Part[] = [{ text: screenRequestText(body) }];
      const image = validImage(body.image);
      if (image) parts.push(image);
      request = requestBody(SCREEN_SYSTEM, parts, null, "text/plain");
      validate = (t) => /<[a-z][\s\S]*>/i.test(stripFences(t)) && stripFences(t).length > 80;
    } else {
      request = requestBody(EDIT_HTML_SYSTEM, [{ text: editRequestText(body) }], null, "text/plain");
      // A selected element may come back as bare text; the client rewraps it.
      validate = body.selected ? (t) => stripFences(t).trim().length > 0 : (t) => /<[a-z][\s\S]*>/i.test(stripFences(t));
    }
    const upstreamAbort = new AbortController();
    const { res, model } = await callModel(pickModels(body.quality), request, true, 150_000, upstreamAbort.signal);
    const encoder = new TextEncoder();
    let full = "";
    let usage = { input: null as number | null, output: null as number | null };
    let finishReason = "";

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) =>
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        send("start", { quota });
        const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              let chunk: any;
              try {
                chunk = JSON.parse(line.slice(5));
              } catch {
                continue;
              }
              const text = textOf(chunk);
              if (text) {
                full += text;
                send("delta", { text });
              }
              if (chunk.usageMetadata) usage = usageOf(chunk);
              finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
            }
          }
          if (!validate(full)) {
            const message = finishReason === "MAX_TOKENS"
              ? "That screen ran long and was cut off. Try again."
              : finishReason === "SAFETY"
              ? "Pip can't help with that request. Try rephrasing it."
              : "That screen didn't come together. Try again.";
            send("error", { message });
            await finish("error", { model, error: `incomplete (${finishReason})`, input_tokens: usage.input, output_tokens: usage.output });
          } else {
            send("done", { usage, quota: { used, limit: DAILY_LIMIT } });
            await finish("ok", { model, input_tokens: usage.input, output_tokens: usage.output });
          }
        } catch (err) {
          console.error("Stream failed", err);
          send("error", { message: "The connection dropped. Try again." });
          await finish("error", { model, error: String(err).slice(0, 300) });
        } finally {
          controller.close();
        }
      },
      async cancel() {
        upstreamAbort.abort();
        await finish("error", { model, error: "cancelled" });
      },
    });
    return new Response(stream, {
      headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : err instanceof DOMException && err.name === "TimeoutError" ? 504 : 500;
    const message = err instanceof HttpError
      ? err.message
      : status === 504
      ? "That took too long. Try again."
      : "Something went wrong on our side. Try again.";
    if (!(err instanceof HttpError) || status >= 500) console.error("AI request failed", err);
    await finish("error", { error: String((err as Error)?.message ?? err).slice(0, 300) });
    return json(status, { error: message, ...(err instanceof HttpError ? err.extra : {}) });
  }
});
