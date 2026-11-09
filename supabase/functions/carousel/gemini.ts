// Gemini calls for the carousel function (same models and fallbacks as `ai`).

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const VERTEX = "https://aiplatform.googleapis.com/v1/publishers/google/models";
const RETRYABLE = new Set([404, 408, 429, 500, 502, 503, 504]);

export type ModelChoice = { name: string; thinking?: string };
export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

export const MODELS = {
  fast: { name: "gemini-3.5-flash", thinking: "minimal" },
  best: { name: "gemini-3.1-pro-preview", thinking: "low" },
  fallback: { name: "gemini-3-flash-preview", thinking: "minimal" },
  image: { name: "gemini-2.5-flash-image" },
};

export const pickModels = (quality: unknown): ModelChoice[] =>
  quality === "best" ? [MODELS.best, MODELS.fast, MODELS.fallback] : [MODELS.fast, MODELS.fallback];

export const hasKey = () => !!GEMINI_KEY;

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

export function requestBody(system: string, parts: Part[], schema: unknown | null, temperature?: number) {
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      ...(schema ? { responseSchema: schema } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
      maxOutputTokens: 24576,
    },
  };
}

function withThinking(body: Record<string, any>, model: ModelChoice) {
  if (!model.thinking) return body;
  return { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingLevel: model.thinking } } };
}

// Calls the first model that answers; moves down the list on capacity errors.
export async function callModel(models: ModelChoice[], body: Record<string, any>, timeoutMs: number) {
  let last = "";
  for (const model of models) {
    const url = `${VERTEX}/${model.name}:generateContent?key=${GEMINI_KEY}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withThinking(body, model)),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      last = `${model.name}: ${String(err).slice(0, 200)}`;
      continue;
    }
    if (res.ok) return { res, model: model.name };
    last = `${model.name} ${res.status}: ${(await res.text()).slice(0, 300)}`;
    if (!RETRYABLE.has(res.status)) break;
  }
  console.error("All models failed", last);
  throw new HttpError(502, "Pip is very busy right now. Try again in a moment.");
}

function textOf(payload: any) {
  const cand = payload?.candidates?.[0];
  return (cand?.content?.parts ?? [])
    .filter((p: any) => typeof p.text === "string" && !p.thought)
    .map((p: any) => p.text)
    .join("");
}

export function usageOf(payload: any) {
  const u = payload?.usageMetadata ?? {};
  return { input: u.promptTokenCount ?? null, output: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) || null };
}

// Non-streaming JSON call, retried once if the output doesn't parse.
export async function generateJson(models: ModelChoice[], body: Record<string, any>, timeoutMs = 90_000) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { res, model } = await callModel(models, body, timeoutMs);
    const payload = await res.json();
    const finish = payload?.candidates?.[0]?.finishReason;
    if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT") {
      throw new HttpError(422, "Pip can't help with that topic. Try rephrasing it.");
    }
    try {
      return { data: JSON.parse(textOf(payload)), model, usage: usageOf(payload) };
    } catch {
      console.error("Unparseable model output", finish, textOf(payload).slice(0, 200));
    }
  }
  throw new HttpError(502, "That answer came back incomplete. Try again.");
}

// Paints one image (no text in it) and returns its bytes.
export async function paintImage(prompt: string, aspect: string) {
  const { res, model } = await callModel([MODELS.image], {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } },
  }, 90_000);
  const payload = await res.json();
  const part = (payload?.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData?.data);
  if (!part) throw new HttpError(422, "Pip couldn't paint that one. Try again.");
  return { mimeType: String(part.inlineData.mimeType), data: String(part.inlineData.data), model, usage: usageOf(payload) };
}
