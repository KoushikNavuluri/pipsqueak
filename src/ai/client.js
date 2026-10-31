import { supabase } from "../supabase";

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai`;

export class AiError extends Error {
  constructor(message, { status = 0, quota = null } = {}) {
    super(message);
    this.status = status;
    this.quota = quota;
  }
}

async function headers() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new AiError("Sign in again to use AI features.", { status: 401 });
  }
  return {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
  };
}

async function post(body, signal) {
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw err;
    }
    throw new AiError("Can't reach Pipsqueak. Check your connection.");
  }
  if (!res.ok) {
    let payload = {};
    try {
      payload = await res.json();
    } catch {}
    throw new AiError(
      payload.error || `Something went wrong (${res.status}). Try again.`,
      {
        status: res.status,
        quota: payload.quota ?? null,
      },
    );
  }
  return res;
}

// One request, one JSON answer. Resolves to { result, quota }.
export async function askAi(action, payload, { signal } = {}) {
  const res = await post({ action, ...payload }, signal);
  return res.json();
}

// Streams a text action (screen, edit_html). onText receives the
// full text written so far; resolves to { text, usage, quota }.
export async function streamAi(action, payload, { signal, onStart, onText } = {}) {
  const res = await post({ action, ...payload }, signal);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let done = null;
  for (;;) {
    const { value, done: finished } = await reader.read();
    if (finished) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const event = /^event: (\w+)/m.exec(raw)?.[1];
      const data = JSON.parse(/^data: (.*)$/m.exec(raw)?.[1] ?? "null");
      if (event === "start") {
        onStart?.(data);
      } else if (event === "delta") {
        text += data.text;
        onText?.(text);
      } else if (event === "error") {
        throw new AiError(data.message);
      } else if (event === "done") {
        done = data;
      }
    }
  }
  if (!done) {
    throw new AiError("The connection dropped. Try again.");
  }
  return { text, ...done };
}
