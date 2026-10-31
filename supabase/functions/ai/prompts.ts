// The brief stage (sharpening a rough idea) and the user's brand voice. The
// design engine's own stages live in design.ts.

// Every string has a hard length cap. Vertex rejects maxItems in these
// schemas, so array lengths live in the descriptions instead.
const S = (description: string, maxLength: number) => ({ type: "STRING", description, maxLength });
const A = (items: unknown, description: string) => ({ type: "ARRAY", items, description });

export const briefSchema = {
  type: "OBJECT",
  properties: {
    pitch: S("The sharpened idea in one sentence, max 120 characters", 140),
    audience: S("Who it is for, max 80 characters", 100),
    names: A(S("Product name", 24), "4 distinctive product names"),
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: S("Max 70 characters", 80),
          options: A(S("Answer", 48), "3 or 4 specific answers, max 40 characters each"),
          multi: { type: "BOOLEAN", description: "True if several answers can apply" },
        },
        required: ["question", "options", "multi"],
      },
    },
  },
  required: ["pitch", "audience", "names", "questions"],
  propertyOrdering: ["pitch", "audience", "names", "questions"],
};

export function tasteText(taste: Record<string, string> | null, displayName?: string | null) {
  const t = taste || {};
  const parts = [
    displayName ? `Designer's name: ${displayName}` : "",
    t.voice ? `Brand voice they like: ${t.voice}` : "",
    t.audience ? `Usual audience: ${t.audience}` : "",
    t.locale ? `Locale, currency and spelling: ${t.locale}` : "",
    t.notes ? `Style notes: ${t.notes}` : "",
  ].filter(Boolean);
  return parts.length ? `USER TASTE PROFILE (apply unless the request says otherwise)\n${parts.join("\n")}` : "";
}

export const BRIEF_SYSTEM = `You are a sharp product strategist helping someone shape a rough product idea before it is designed. It may be a mobile app, a web app or a website.
Sharpen the idea into a crisp one-line pitch, name the audience, propose 4 distinctive product names (no generic "-ify" or "-ly" names, nothing that already exists), and ask the 3 questions whose answers would most change the design. Each question gets 3 or 4 options written for this specific idea, never generic options like "Other" or "Not sure".

CONTENT AND VOICE
- Be specific: real places, audiences and situations that fit the idea and its locale.
- Write short, concrete, human copy with a point of view. Avoid hype and filler: seamless, unlock, elevate, empower, effortless, revolutionize, journey, supercharge, game-changer, all-in-one. No emoji.
- Use the currency and spelling of the locale. If the idea gives no locale, use the user's taste profile; otherwise default to neutral English.`;
