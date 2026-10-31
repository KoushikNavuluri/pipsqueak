// The design engine: the staged pipeline behind Pipsqueak's studio.
//
//   understand  idea → product spec, app architecture, three direction picks
//   systems     spec + picks → three complete, distinct design systems
//   screen      one screen as HTML + Tailwind, written against a frozen system
//   edit        a screen or one element of it, rewritten in place
//   copilot     a request → a plan of system patches and screen edits
//   critique    the whole app → scores and fixable issues
//
// Each stage gets only what it needs, in a fixed order: identity, quality
// floor, frozen design spec, task.
import { CATALOG } from "./catalog.ts";

const SKILL_IDS = CATALOG.skills.map((s) => s.id);
const PATTERN_IDS = CATALOG.patterns.map((p) => p.id);
const FONT_NAMES = CATALOG.typefaces.map((t) => t.name);
const SCREEN_TYPES = ["onboarding", "home", "browse", "search", "detail", "list", "insights", "profile", "settings", "checkout", "landing", "pricing", "dashboard", "product", "other"];
const CATEGORY_KEYS = Object.keys(CATALOG.heroObjects);

const S = (description: string, maxLength?: number) => ({ type: "STRING", description, ...(maxLength ? { maxLength } : {}) });
const A = (items: unknown, description: string) => ({ type: "ARRAY", items, description });
const E = (values: readonly string[], description = "") => ({ type: "STRING", enum: [...values], description });

// ---------- shared guidance ----------

export const QUALITY_FLOOR = `QUALITY FLOOR (measurable, never trade these away)
- Text contrast at least 4.5:1 (3:1 for 24px+ or bold 19px+). Body text at least 15px on mobile, 16px on web; line height 1.4–1.7; lines at most ~70 characters. Nothing smaller than 11px, including eyebrows, captions, badges and tab labels.
- Spacing on a 4px grid, with rhythm: 4–8px inside a group, 24–40px between groups. Not 16px everywhere.
- Tap targets at least 44×44px on mobile. One obvious primary action per screen, within thumb reach on mobile.
- Never stack sibling regions on top of each other with absolute positioning, negative margins or transforms, except deliberate decorative overlaps.
- Decide the fate of variable-length text before writing it: wrap with line-clamp-2, or truncate. Keep big numerals and their units together with whitespace-nowrap.
- Images get explicit sizing (h-*, w-*, aspect-*) and object-cover.
- When rules conflict: accessible and readable > usable > clear hierarchy > stylistic expression > decoration.`;

export const RESTRAINT = `RESTRAINT
- Use the primary/accent color at most twice per screen besides the main action; neutrals do 90% of the work.
- Aim for roughly 80% proven patterns and 20% distinctive choices. One decisive flourish per screen beats many small decorations.
- A screen has one focal point. Everything else supports it.
- Build hierarchy with size steps that are clearly different (for example 12 / 15 / 20 / 32 / 56), weight and opacity, not with boxes.
- Spend boldness in one place. Before finishing, remove one decoration you don't need.
- Buttons say exactly what happens ("Request pickup", "Save changes"), never "Submit" or "Learn more".`;

export const CONTENT_RULES = `CONTENT
- Real, specific content from this product's world: named people, places, items, prices, dates and amounts that fit the audience and locale. Irregular, believable numbers (₹1,284.50, 7.4 km, 23 min), never round placeholders.
- Reuse the same names and figures across screens so the app feels like one world.
- Microcopy in the product's voice: short, concrete, human. Never "Unlock your potential", "Your journey starts here", "Welcome back, User", "Lorem ipsum", "John Doe", "Item 1".
- No designer metadata inside the product: no screen names, device labels, "Screen 2 of 5" or platform toggles in the UI.
- Build modules specific to this kind of app (player controls for media, streaks for habits, cart and delivery for commerce, ledgers for money), not generic card grids.`;

const antiPatterns = CATALOG.antiPatterns.map((a) => `- ${a}`).join("\n");
export const NEVER = `NEVER (these make UI look templated or AI-made)
${antiPatterns}
- Tailwind's default palette (indigo-500, gray-100, slate-*, blue-600…) or raw hex colors: use the design tokens only.
- Gradient text, decorative grid-line or dot backgrounds, glows and halos.
- transition-all; use transition-colors or transition-transform.

DEFAULTS TO AVOID unless the direction explicitly calls for them (each is a common AI tell)
- A headline with one italic or accent-colored word.
- A tracked uppercase eyebrow label stacked above every heading.
- An arrow appended to every button label; "A · B · C" metadata strings everywhere.
- 01 / 02 / 03 numbering for things that are not a sequence.
- Aphoristic copy ("Not a feature. A platform."), em-dash-heavy sentences.
- The default AI app skeleton: logo bar, greeting, one big rounded hero card, a chip row, a list of identical cards, a four-icon tab bar. Use it only when the product truly calls for it, and even then change its proportions and staging.
- Every section as a rounded card on a tinted background. Vary grouping: rules, whitespace, full-bleed bands, split columns, inline lists.`;

const skillText = (id: string) => CATALOG.skills.find((s) => s.id === id)?.text ?? "";
const patternText = (id: string) => {
  const p = CATALOG.patterns.find((x) => x.id === id);
  return p ? `COMPOSITION PATTERN: ${p.name}\n${p.recipe}` : "";
};
const skillMenu = CATALOG.skills.map((s) => `- ${s.id}: ${s.name}. Good for ${s.bestFor.join(", ")}.`).join("\n");
const patternMenu = (() => {
  const byType: Record<string, string[]> = {};
  for (const p of CATALOG.patterns) (byType[p.type] ||= []).push(`${p.id} (${p.name})`);
  return Object.entries(byType).map(([t, ps]) => `- ${t}: ${ps.join(", ")}`).join("\n");
})();
const typefaceMenu = CATALOG.typefaces.map((t) => `- ${t.name} [${t.kind}; ${t.role.join("/")}]: ${t.feel}`).join("\n");

// ---------- 1. understand ----------

export const understandSchema = {
  type: "OBJECT",
  properties: {
    name: S("Product name, 1–2 words, distinctive", 24),
    tagline: S("Benefit-led line", 70),
    summary: S("What it is and why it matters, 1–2 sentences", 280),
    platform: E(["mobile", "web", "website"], "mobile app, web app (logged-in product), or website (marketing pages)"),
    audience: S("Who it is for, specific", 140),
    tone: A(S("Adjective", 20), "Three tone words"),
    locale: S("Locale, currency and spelling, e.g. 'India · ₹ · en-IN'", 40),
    category: E(CATEGORY_KEYS, "Closest product category"),
    heroObject: S("The one thing the main screen is built around", 120),
    world: S("A paragraph of concrete world-building every screen reuses: named people, places, items, prices, dates, statuses", 900),
    screens: A(
      {
        type: "OBJECT",
        properties: {
          id: S("kebab-case id, unique", 24),
          name: S("1–2 words as it appears in navigation", 20),
          type: E(SCREEN_TYPES),
          pattern: E(PATTERN_IDS, "Composition pattern for this screen"),
          purpose: S("The job of this screen in one sentence", 160),
          content: S("Concrete content and modules on this screen, top to bottom", 500),
          primaryAction: S("The one main action", 40),
          inNav: { type: "BOOLEAN", description: "Appears in the persistent navigation" },
        },
        required: ["id", "name", "type", "pattern", "purpose", "content", "primaryAction", "inNav"],
        propertyOrdering: ["id", "name", "type", "pattern", "purpose", "content", "primaryAction", "inNav"],
      },
      "The app's screens in flow order",
    ),
    navigation: {
      type: "OBJECT",
      properties: {
        pattern: E(["tabbar", "floating-tabbar", "sidebar", "topbar", "none"]),
        items: A(
          {
            type: "OBJECT",
            properties: { label: S("1 word", 14), icon: S("Material Symbols name, snake_case", 32), screenId: S("Screen id", 24) },
            required: ["label", "icon", "screenId"],
          },
          "Navigation items",
        ),
      },
      required: ["pattern", "items"],
    },
    imagery: A(
      {
        type: "OBJECT",
        properties: { subject: S("A specific photographic or illustrative subject from this product's world", 160), aspect: E(["portrait", "landscape", "square"]) },
        required: ["subject", "aspect"],
      },
      "4 to 6 images worth painting for this app",
    ),
    directions: A(
      {
        type: "OBJECT",
        properties: {
          skill: E(SKILL_IDS),
          why: S("Why this direction suits the product and audience", 200),
          twist: S("A specific twist that makes it this product's own", 200),
        },
        required: ["skill", "why", "twist"],
      },
      "Exactly three clearly different directions",
    ),
  },
  required: ["name", "tagline", "summary", "platform", "audience", "tone", "locale", "category", "heroObject", "world", "screens", "navigation", "imagery", "directions"],
  propertyOrdering: ["name", "tagline", "summary", "platform", "audience", "tone", "locale", "category", "heroObject", "world", "screens", "navigation", "imagery", "directions"],
};

export const UNDERSTAND_SYSTEM = `You are a principal product designer starting a new project. Before any pixels, you understand the product: who it is for, what job it does, what its main screen is built around, and which screens and navigation it needs. Then you propose three genuinely different art directions.

PLATFORM
- mobile: a native-feeling phone app (390px wide). 4–6 screens.
- web: a logged-in web product or dashboard (1440px wide, responsive). 3–5 screens.
- website: marketing pages (1440px wide, responsive). 1–4 pages.
Respect the platform the user asked for; otherwise choose the one the idea implies.

ARCHITECTURE
- Screens are listed in flow order, each with a single job. Include the screen types this product actually needs (for example checkout for commerce, a player for media, a paywall only if the business model needs it).
- Assign every screen a composition pattern that fits its job. No two screens may share the same pattern, and their tops must look different. Choose patterns for this product's real use, not the most common ones: a field guide, a trading desk and a recipe app should not share a skeleton.
- Decisions the user already made (in the idea or under "Decisions") are requirements, not suggestions.
- Home screens are built around the product's hero object. Hero objects by category: ${Object.entries(CATALOG.heroObjects).map(([k, v]) => `${k}: ${v}`).join("; ")}.
- Navigation: mobile apps usually use tabbar or floating-tabbar with 3–5 items; web apps use sidebar or topbar; websites use topbar. Items point at screen ids. Screens with inNav=true appear in it.

PATTERNS BY SCREEN TYPE (use these ids)
${patternMenu}

DIRECTIONS
Pick three skills that would each produce a convincing but clearly different product, and give each a specific twist tied to this product (a material, a place, a cultural artifact the audience knows by heart, a signature component). Do not pick three variations of the same mood.
- One direction may be the category's strongest conventional answer, played straight and well. The other two are challengers that a great studio would pitch.
- If someone could guess a direction from the product category alone, make its twist more specific.
- Avoid the directions listed under RECENTLY USED unless one is clearly the best fit.
${skillMenu}

${CONTENT_RULES}`;

// ---------- 2. systems ----------

const componentRecipes = {
  type: "OBJECT",
  description: "Tailwind v4 class strings using only the token utilities. Every screen reuses these exactly.",
  properties: {
    buttonPrimary: S("Primary button classes", 300),
    buttonSecondary: S("Secondary button classes", 300),
    buttonGhost: S("Tertiary/text button classes", 300),
    card: S("Container/card classes (may be just a hairline or nothing if the direction avoids cards)", 300),
    input: S("Text input classes", 300),
    chip: S("Chip/tag classes, and the selected variant after a |", 300),
    listRow: S("List row classes", 300),
    sectionTitle: S("Section title classes", 300),
    eyebrow: S("Kicker/label classes", 300),
    displayHeadline: S("Screen headline classes", 300),
    bigNumber: S("Hero numeral classes", 300),
    nav: S("Persistent navigation container classes (tab bar, sidebar or top bar)", 300),
    navItem: S("Navigation item classes, and the active variant after a |", 300),
    divider: S("Divider classes", 200),
  },
  required: ["buttonPrimary", "buttonSecondary", "buttonGhost", "card", "input", "chip", "listRow", "sectionTitle", "eyebrow", "displayHeadline", "bigNumber", "nav", "navItem", "divider"],
};

const colorsSchema = {
  type: "OBJECT",
  properties: {
    bg: S("Page background", 7),
    surface: S("Raised surface", 7),
    surface2: S("Recessed or alternate surface", 7),
    ink: S("Primary text", 7),
    muted: S("Secondary text, still 4.5:1 on bg", 7),
    line: S("Hairlines and borders", 7),
    primary: S("Brand / main action", 7),
    onPrimary: S("Text on primary", 7),
    accent: S("Secondary accent", 7),
    onAccent: S("Text on accent", 7),
  },
  required: ["bg", "surface", "surface2", "ink", "muted", "line", "primary", "onPrimary", "accent", "onAccent"],
  propertyOrdering: ["bg", "surface", "surface2", "ink", "muted", "line", "primary", "onPrimary", "accent", "onAccent"],
};

export const systemsSchema = {
  type: "OBJECT",
  properties: {
    systems: A(
      {
        type: "OBJECT",
        properties: {
          skill: E(SKILL_IDS),
          name: S("Evocative 2–3 word name for this direction", 32),
          pitch: S("One sentence: the idea behind this look for this product", 200),
          scene: S("One sentence of physical scene: who uses this, where, under what light. It decides light or dark.", 200),
          strategy: E(["restrained", "committed", "full", "drenched"], "Color strategy"),
          colors: colorsSchema,
          fonts: {
            type: "OBJECT",
            properties: { display: S("Display typeface name from the list", 32), body: S("Body typeface name from the list", 32), mono: S("Mono typeface name from the list", 32) },
            required: ["display", "body", "mono"],
          },
          type: {
            type: "OBJECT",
            properties: {
              displayWeight: { type: "INTEGER", description: "100–900" },
              displayTracking: S("CSS letter-spacing for display, e.g. -0.03em", 10),
              displayCase: E(["none", "uppercase"]),
              scale: S("The size steps in px used across screens, e.g. 12/15/20/32/56", 60),
            },
            required: ["displayWeight", "displayTracking", "displayCase", "scale"],
          },
          radius: {
            type: "OBJECT",
            properties: { sm: { type: "INTEGER" }, md: { type: "INTEGER" }, lg: { type: "INTEGER" }, xl: { type: "INTEGER" } },
            required: ["sm", "md", "lg", "xl"],
          },
          icons: {
            type: "OBJECT",
            properties: { set: E(["outlined", "rounded", "sharp"]), weight: { type: "INTEGER", description: "100–700" }, fill: { type: "INTEGER", description: "0 or 1" } },
            required: ["set", "weight", "fill"],
          },
          shadow: E(["none", "soft", "crisp", "hard", "glow"]),
          density: E(["airy", "balanced", "compact"]),
          imagery: S("Art direction for photography or illustration in this system", 300),
          motion: S("Motion principles in one sentence", 200),
          signature: A(S("A signature move", 140), "3–4 signature moves specific to this product"),
          layout: {
            type: "OBJECT",
            description: "The layout language every screen in this direction is composed with. It must differ structurally from the other directions.",
            properties: {
              grid: S("Grid and alignment, e.g. 'asymmetric 12-column with a wide left margin', 'single centered column', 'bento of unequal tiles', 'two-column split'", 180),
              header: S("How every screen's top is built, e.g. 'oversized title bleeding off the left edge', 'masthead with a hairline rule', 'compact toolbar', 'no bar: content starts with the hero object'", 180),
              surfaces: S("How content is grouped, e.g. 'flat with hairline rules, no cards', 'outlined blocks with hard offset shadows', 'soft raised cards on a tinted page', 'full-bleed color bands'", 180),
              navigation: S("Styling of the persistent navigation within the platform's pattern, e.g. 'floating pill tab bar', 'text-only tabs with an underline', 'icon rail', 'top tabs'", 180),
              imagery: S("How images are placed: full-bleed, framed with captions, circular crops, collage, duotone, or none", 160),
              rhythm: S("Spacing and density rhythm down the page", 140),
              heroComposition: S("How this direction stages the main screen's hero object, clearly different from the other two directions", 260),
            },
            required: ["grid", "header", "surfaces", "navigation", "imagery", "rhythm", "heroComposition"],
          },
          components: componentRecipes,
        },
        required: ["skill", "name", "pitch", "scene", "strategy", "colors", "fonts", "type", "radius", "icons", "shadow", "density", "imagery", "motion", "signature", "layout", "components"],
        propertyOrdering: ["skill", "name", "pitch", "scene", "strategy", "colors", "fonts", "type", "radius", "icons", "shadow", "density", "imagery", "motion", "signature", "layout", "components"],
      },
      "One design system per requested direction, in the same order",
    ),
  },
  required: ["systems"],
};

export const SYSTEMS_SYSTEM = `You are a design-systems lead. For each art direction you are given, you build a complete, production-grade design system for this specific product, so that every screen designed later is consistent. The systems you produce must be clearly different from each other in typography, color, shape and composition, while each is coherent on its own.

LAYOUT LANGUAGE
- Each system defines how screens are composed, not only how they are colored. Three systems that share a grid, header style, card treatment and navigation styling are the same design in three skins: that is a failure.
- Across the three systems, no two may share the same header approach, the same surface treatment, or the same navigation styling. Vary the grid too (centered column, asymmetric split, bento, editorial columns, full-bleed stacks).
- heroComposition says how the main screen stages its hero object in this direction (scale, position, cropping, what surrounds it). The three must look different at a glance, as if from three studios.
- Ground every choice in the product and its audience, not in novelty: variety comes from what each direction believes about this product.

SCENE AND STRATEGY
- First write the scene: who uses the product, where, under what light. Let it decide light or dark, not the category.
- Then pick a color strategy: restrained (tinted neutrals, accent under 10%), committed (one saturated color owns 30–60%), full (3–4 named color roles), or drenched (the surface is the color). Follow the direction's own strategy unless the scene argues otherwise.

COLOR
- bg, surface and surface2 are close but distinct steps; ink and muted pass 4.5:1 on bg and surface; onPrimary passes 4.5:1 on primary; onAccent passes 4.5:1 on accent.
- Prefer tinted neutrals over pure #FFFFFF and #000000. Choose primary and accent for this product's identity, not defaults.
- Follow the direction's color strategy exactly (for example paper-and-ink, monochrome with one signal color, earth tones, near-black panels).

TYPE
- Pick fonts only from this list, by exact name, following the direction's typography:
${typefaceMenu}
- Display and body may be the same family when the direction calls for one family.

COMPONENT RECIPES
- Write Tailwind v4 class strings that every screen will reuse verbatim. Use only these token utilities for color: bg-bg, bg-surface, bg-surface-2, text-ink, text-muted, border-line, bg-primary, text-on-primary, bg-accent, text-on-accent (opacity modifiers like bg-primary/10 are allowed). Fonts: font-display, font-body, font-mono. Radius: rounded-sm, rounded-md, rounded-lg, rounded-xl, rounded-full. Shadow: shadow-card. Arbitrary values like text-[44px] and tracking-[-0.03em] are welcome.
- Recipes must embody the direction (square and ruled for Swiss, thick borders and hard shadows for brutalist, hairlines for editorial…).
- Include hover:, active: and focus-visible: states and transition classes where they matter.

${RESTRAINT}`;

// ---------- 3. screen ----------

export const SCREEN_SYSTEM = `You are a world-class product designer who also writes production front-end code. You design ONE screen of an app as HTML with Tailwind CSS v4 utility classes. It must look art-directed by a top studio: specific to this product, faithful to the frozen design system, and unmistakably in its visual direction.

OUTPUT
- Only the screen's HTML: the content that goes inside <body>. No <html>, <head>, <script>, markdown fences, comments or explanations.
- Wrap the screen in a single root element (<div> or <main>) with min-h-screen and bg-bg.

WHAT DECIDES WHAT
- The screen's job, content and primary action come from the plan.
- The design system's LAYOUT LANGUAGE decides how it is composed: grid, how the top is built, how content is grouped, navigation styling, image placement and rhythm. The composition pattern is a starting structure for the screen's job; express it in the layout language rather than as a generic template.
- The direction lends the type, palette, density, shape language and one signature move.
- The platform's conventions keep it usable. A direction never turns a phone screen into a poster that can't be used.

ONE PRODUCT, ONE LOOK
- Every screen of an app must look like it belongs to the same product. Same page background (bg-bg), same treatment of the top of the screen, same surfaces and card style, same type scale and weights, same button and chip styles, same spacing rhythm, same image treatment.
- Never switch a single screen to a dark or differently colored page unless the design system itself is dark. Immersive moments (players, visualizers, maps, cameras, galleries) live in a contained panel or full-bleed band inside the page, using the system's tokens (bg-ink, bg-surface-2, an image).
- When a STYLE REFERENCE is provided, it is an approved screen from this app. Match its visual language exactly; do not copy its layout or content.
- ADDITIONAL DIRECTION from the user wins over the style reference and these rules where they conflict (for example "make this screen dark").

DESIGN SYSTEM USAGE
- Colors only through token utilities: bg-bg, bg-surface, bg-surface-2, text-ink, text-muted, border-line, bg-primary, text-on-primary, bg-accent, text-on-accent, text-primary, border-primary, ring-primary and opacity modifiers (bg-primary/10). Never raw hex, never Tailwind's built-in palette, never bg-white or text-black.
- Typography: font-display for headlines and hero numerals, font-body for text, font-mono where the direction uses it. Use the type scale given; arbitrary values (text-[44px] leading-[0.95] tracking-[-0.03em]) are expected.
- Reuse the component recipes verbatim for buttons, cards, inputs, chips, list rows, section titles, labels, navigation and dividers. Only adjust layout classes (width, margin, grid) around them.
- Radius via rounded-sm/md/lg/xl/full and shadows via shadow-card only.

STRUCTURE AND INTERACTION
- Semantic HTML: header, main, nav, section, h1–h3, p, ul/li, button, a, label, input. Buttons are <button type="button">. Icon-only buttons get aria-label.
- Links between screens: add data-nav="SCREEN_ID" to any element that should open another screen in the plan (tabs, cards, rows, buttons). Use the exact screen ids.
- The persistent navigation (if the plan has one) appears on every screen that is in it, with identical markup except the active item; mark its container with data-shell="nav".
- Hover and focus states on interactive elements (hover:, focus-visible:ring-2 ring-primary), transition-colors duration-200, active:scale-[0.98] on buttons.

ICONS AND IMAGES
- Icons: <span class="icon">name</span> with Material Symbols names in snake_case (home, search, arrow_forward, favorite, notifications, tune, add, check, close, chevron_right, calendar_month, shopping_bag, play_arrow…). Size with text-[20px] etc. Add class "filled" for the filled style. Never emoji, never inline SVG icons.
- Images: <img data-img="specific subject in this product's world" alt="…" class="… object-cover">, with explicit size classes and NO src. When an image kit is provided, prefer data-kit="N" for matching subjects. Charts, maps and diagrams are built in HTML (divs, inline SVG paths, grids), not images.

PLATFORM
- mobile: your canvas is 390×797. The device frame draws the status bar above it, so start your design right at the top (a top bar needs only pt-3 or pt-4). Pin bottom navigation or action bars with fixed bottom-0 inset-x-0 and pb-6 for the home indicator, and give scrolling content enough bottom padding to clear them. Design for thumbs.
- web and website: design at 1440px wide but write it mobile-first responsive (base styles for 390px, then md: and lg: refinements) so it works from phone to desktop. Max content width around 1200–1280px, centered.

${QUALITY_FLOOR}

${RESTRAINT}

${CONTENT_RULES}

${NEVER}`;

type Json = Record<string, any>;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function systemDoc(system: Json) {
  const c = system.colors || {};
  const comp = system.components || {};
  return [
    `DESIGN SYSTEM: ${str(system.name, 40)} (${str(system.skill, 20)})`,
    system.pitch ? `Idea: ${str(system.pitch, 300)}` : "",
    system.scene ? `Scene: ${str(system.scene, 240)} Color strategy: ${str(system.strategy, 20)}.` : "",
    `Colors (reference only, use the token utilities): bg ${c.bg}, surface ${c.surface}, surface-2 ${c.surface2}, ink ${c.ink}, muted ${c.muted}, line ${c.line}, primary ${c.primary} on ${c.onPrimary}, accent ${c.accent} on ${c.onAccent}.`,
    `Fonts: display ${system.fonts?.display}, body ${system.fonts?.body}, mono ${system.fonts?.mono}. Display weight ${system.type?.displayWeight}, tracking ${system.type?.displayTracking}, case ${system.type?.displayCase}. Type scale: ${str(system.type?.scale, 80)}.`,
    `Radius: sm ${system.radius?.sm}px, md ${system.radius?.md}px, lg ${system.radius?.lg}px, xl ${system.radius?.xl}px. Shadow: ${system.shadow}. Density: ${system.density}. Icons: ${system.icons?.set}, weight ${system.icons?.weight}${system.icons?.fill ? ", filled" : ""}.`,
    system.imagery ? `Imagery: ${str(system.imagery, 400)}` : "",
    system.motion ? `Motion: ${str(system.motion, 300)}` : "",
    Array.isArray(system.signature) && system.signature.length ? `Signature moves: ${system.signature.map((s: string) => str(s, 160)).join("; ")}.` : "",
    system.layout
      ? [
        "LAYOUT LANGUAGE (compose every screen with it):",
        `- Grid: ${str(system.layout.grid, 200)}`,
        `- Screen tops: ${str(system.layout.header, 200)}`,
        `- Surfaces and grouping: ${str(system.layout.surfaces, 200)}`,
        `- Navigation styling: ${str(system.layout.navigation, 200)}`,
        `- Images: ${str(system.layout.imagery, 180)}`,
        `- Rhythm: ${str(system.layout.rhythm, 160)}`,
      ].join("\n")
      : "",
    "Component recipes (reuse verbatim):",
    ...Object.entries(comp).map(([k, v]) => `- ${k}: ${str(v, 400)}`),
  ]
    .filter(Boolean)
    .join("\n");
}

export function specDoc(spec: Json) {
  const screens = (Array.isArray(spec.screens) ? spec.screens : []).slice(0, 10);
  const nav = spec.navigation || {};
  return [
    `PRODUCT: ${str(spec.name, 40)} — ${str(spec.tagline, 100)}`,
    `What it is: ${str(spec.summary, 400)}`,
    `Audience: ${str(spec.audience, 200)}. Tone: ${(spec.tone || []).map((t: string) => str(t, 20)).join(", ")}. Locale: ${str(spec.locale, 60)}. Platform: ${str(spec.platform, 10)}.`,
    `Main screen is built around: ${str(spec.heroObject, 200)}.`,
    `World (reuse these names and figures): ${str(spec.world, 1200)}`,
    `SCREENS IN THIS APP (id: name, purpose):`,
    ...screens.map((s: Json) => `- ${str(s.id, 30)}: ${str(s.name, 30)}, ${str(s.purpose, 200)}`),
    `NAVIGATION: ${str(nav.pattern, 20)}${Array.isArray(nav.items) ? " → " + nav.items.map((i: Json) => `${str(i.label, 20)} [${str(i.icon, 32)}] → ${str(i.screenId, 30)}`).join(", ") : ""}`,
    spec.decisions ? `DECISIONS THE USER MADE (requirements; honor them on every screen):\n${str(spec.decisions, 1500)}` : "",
  ].filter(Boolean).join("\n");
}

export function screenRequestText(body: Json) {
  const spec = body.spec || {};
  const system = body.system || {};
  const screen = body.screen || {};
  const kit = Array.isArray(body.kit) ? body.kit.slice(0, 8) : [];
  const shell = str(body.shell, 6000);
  const reference = body.reference && typeof body.reference === "object" ? body.reference : null;
  const hero = system.layout?.heroComposition && (body.first || !reference);
  return [
    specDoc(spec),
    skillText(str(system.skill, 20)),
    systemDoc(system),
    kit.length ? `IMAGE KIT (use data-kit="N" for matching subjects):\n${kit.map((k: Json, i: number) => `${i}: ${str(k.subject, 160)}`).join("\n")}` : "",
    shell ? `SHARED NAVIGATION MARKUP (reuse exactly on this screen, only move the active state):\n${shell}` : "",
    reference
      ? `STYLE REFERENCE: "${str(reference.name, 40)}", an approved screen from this same app (text shortened). Match its page background, top-of-screen treatment, surfaces and cards, type scale and weights, buttons and chips, spacing rhythm and image treatment. Do not copy its layout or content.\n${str(reference.html, 9000)}`
      : "This is the first screen of the app: it establishes the visual language every other screen will follow.",
    hero ? `HERO STAGING FOR THIS DIRECTION: ${str(system.layout.heroComposition, 300)}` : "",
    patternText(str(screen.pattern, 30)),
    `THIS SCREEN: id "${str(screen.id, 30)}", "${str(screen.name, 40)}" (${str(screen.type, 20)}).\nPurpose: ${str(screen.purpose, 300)}\nContent: ${str(screen.content, 800)}\nPrimary action: ${str(screen.primaryAction, 60)}\nIn navigation: ${screen.inNav ? "yes" : "no"}`,
    body.instruction ? `ADDITIONAL DIRECTION FOR THIS VERSION: ${str(body.instruction, 800)}` : "",
    "Write the screen now.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------- 4. edit ----------

export const EDIT_HTML_SYSTEM = `You are the design partner inside a design tool, editing an existing screen written in HTML with Tailwind CSS v4. Apply exactly the change requested, keep everything else identical, and stay inside the frozen design system.

OUTPUT
- If a SELECTED ELEMENT is given: output only the new HTML for that element, starting with its opening tag, even when only its text changes. It replaces the selected element exactly, so keep a single root element unless the user asked for more. Keep its data-nav and data-shell attributes unless asked to change them.
- Otherwise: output the complete updated screen HTML (everything inside <body>).
- No markdown fences, comments or explanations.

RULES
- Keep the same token utilities, component recipes, fonts, icon and image conventions as the screen already uses (icons as <span class="icon">name</span>, images as <img data-img="…"> without src, links with data-nav).
- Do not change parts of the screen the request is not about. Keep existing copy unless the request is about copy.
- Keep the content specific and consistent with the product's world.

CONSISTENCY WITH THE REST OF THE APP
- REFERENCE SCREENS show how the rest of this app looks. Unless the request asks this screen to look different, keep it consistent with them.
- When the request asks this screen to match the others (their theme, style or look), rebuild its page background, top-of-screen treatment, surfaces, typography, buttons, chips and image treatment to match the references, keeping this screen's own content, job and navigation. Change the whole screen, not one element.
- When the request asks this one screen to take a different theme, change only this screen, using the design tokens (for example a bg-ink page with text-on-primary type, or bg-primary bands); never invent colors and never assume other screens change.

${QUALITY_FLOOR}

${NEVER}`;

export function editRequestText(body: Json) {
  const selected = str(body.selected, 12000);
  const references = (Array.isArray(body.references) ? body.references : []).slice(0, 2);
  return [
    specDoc(body.spec || {}),
    systemDoc(body.system || {}),
    ...references.map((r: Json) => `REFERENCE SCREEN "${str(r?.name, 40)}" (another screen of this app, text shortened):\n${str(r?.html, 7000)}`),
    `CURRENT SCREEN HTML ("${str(body.screen?.name, 40)}"):\n${str(body.html, 60000)}`,
    selected ? `SELECTED ELEMENT (replace this):\n${selected}` : "",
    `REQUEST: ${str(body.instruction, 1500)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------- 5. copilot ----------

export const copilotSchema = {
  type: "OBJECT",
  properties: {
    reply: S("One or two plain sentences to the user about what you will do, or one question if unclear", 320),
    system: {
      type: "OBJECT",
      description: "Only the design-system fields to change",
      properties: {
        colors: { type: "OBJECT", properties: Object.fromEntries(Object.keys(colorsSchema.properties).map((k) => [k, S("#RRGGBB", 7)])) },
        fonts: { type: "OBJECT", properties: { display: S("Typeface", 32), body: S("Typeface", 32), mono: S("Typeface", 32) } },
        radius: { type: "OBJECT", properties: { sm: { type: "INTEGER" }, md: { type: "INTEGER" }, lg: { type: "INTEGER" }, xl: { type: "INTEGER" } } },
        icons: { type: "OBJECT", properties: { set: E(["outlined", "rounded", "sharp"]), weight: { type: "INTEGER" }, fill: { type: "INTEGER" } } },
        shadow: E(["none", "soft", "crisp", "hard", "glow"]),
        displayWeight: { type: "INTEGER" },
        displayTracking: S("CSS letter-spacing", 10),
        displayCase: E(["none", "uppercase"]),
      },
    },
    screenEdits: A(
      {
        type: "OBJECT",
        properties: { screenId: S("Existing screen id", 24), instruction: S("Precise instruction for the screen editor", 600) },
        required: ["screenId", "instruction"],
      },
      "Screens to rewrite, each with a precise instruction",
    ),
    newScreens: A(
      {
        type: "OBJECT",
        properties: {
          id: S("kebab-case id", 24),
          name: S("1–2 words", 20),
          type: E(SCREEN_TYPES),
          pattern: E(PATTERN_IDS),
          purpose: S("Job of the screen", 160),
          content: S("Content top to bottom", 500),
          primaryAction: S("Main action", 40),
          inNav: { type: "BOOLEAN" },
        },
        required: ["id", "name", "type", "pattern", "purpose", "content", "primaryAction", "inNav"],
      },
      "Screens to add",
    ),
    removeScreenIds: A(S("Screen id", 24), "Screens to delete"),
    suggestions: A(S("Next step, max 40 characters", 48), "Three next steps specific to this app"),
  },
  required: ["reply", "screenEdits", "newScreens", "removeScreenIds", "suggestions"],
  propertyOrdering: ["reply", "system", "screenEdits", "newScreens", "removeScreenIds", "suggestions"],
};

export const COPILOT_SYSTEM = `You are the design partner inside a design studio. The user asks for a change to their app in plain words. You decide the smallest set of operations that achieves it, then the studio carries them out:
- system: change design tokens. This restyles every screen instantly with no rewriting, so prefer it for global color, font, radius, icon or shadow changes ("warmer", "bolder type", "dark mode" means new colors in system.colors with the same roles).
- screenEdits: rewrite specific screens, each with a precise, self-contained instruction (the screen editor sees that instruction, the screen and reference screens from the app).
- newScreens: add screens to the plan; they are designed in the current system.
- removeScreenIds: delete screens.
SCOPE
- A request about one screen (it is in focus, or named) is handled with a screenEdit for that screen only. Never patch the system for it: the system restyles every screen.
- Patch the system only when the user asks for an app-wide change.
- "Make this screen match the others" or "fix the theme of X" is a screenEdit for that screen whose instruction says to rebuild its look to match the reference screens. The screen editor sees the current screen plus one or two reference screens from the app.
- Keep every screen consistent with the app's established look unless the user explicitly asks for a different one.
If something is selected, the user is probably talking about it. If the request is unclear, change nothing and ask one short question in reply. Fonts must come from this list: ${FONT_NAMES.join(", ")}.
Keep color roles valid: ink and muted readable on bg and surface (4.5:1), on-primary readable on primary.`;

export function copilotRequestText(body: Json) {
  const screens = (Array.isArray(body.screens) ? body.screens : []).slice(0, 12);
  const history = (Array.isArray(body.history) ? body.history.slice(-8) : [])
    .map((m: Json) => `${m?.role === "user" ? "User" : "You"}: ${str(m?.text, 400)}`)
    .join("\n");
  return [
    specDoc(body.spec || {}),
    systemDoc(body.system || {}),
    `CURRENT SCREENS:\n${screens.map((s: Json) => `- ${str(s.id, 30)}: ${str(s.name, 30)} — ${str(s.summary, 300)}`).join("\n")}`,
    body.focus ? `IN FOCUS: ${str(body.focus, 600)}` : "",
    history ? `CONVERSATION SO FAR:\n${history}` : "",
    `REQUEST: ${str(body.instruction, 1500)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------- 6. critique ----------

export const critiqueSchema = {
  type: "OBJECT",
  properties: {
    headline: S("One-sentence verdict", 160),
    overall: { type: "INTEGER", description: "0–100" },
    scores: A(
      {
        type: "OBJECT",
        properties: {
          dimension: E(["Craft", "Hierarchy", "Consistency", "Originality", "Copy"]),
          score: { type: "INTEGER" },
          note: S("Specific note", 140),
        },
        required: ["dimension", "score", "note"],
      },
      "Five scores",
    ),
    strengths: A(S("A specific strength", 160), "2–4 strengths"),
    issues: A(
      {
        type: "OBJECT",
        properties: {
          severity: E(["high", "medium", "low"]),
          screenId: S("Screen id or empty for app-wide", 24),
          title: S("Short title", 80),
          detail: S("What is wrong and why it matters, quoting real copy or elements", 240),
          fix: S("A precise instruction the screen editor can carry out on its own", 500),
        },
        required: ["severity", "screenId", "title", "detail", "fix"],
        propertyOrdering: ["severity", "screenId", "title", "detail", "fix"],
      },
      "3–6 issues, most important first",
    ),
  },
  required: ["headline", "overall", "scores", "strengths", "issues"],
  propertyOrdering: ["headline", "overall", "scores", "strengths", "issues"],
};

export const CRITIQUE_SYSTEM = `You are a demanding design director reviewing an app designed in HTML and Tailwind before it ships. Be honest and specific: good first drafts score 60–80. Score Craft (spacing, alignment, type detailing), Hierarchy (one focal point, clear actions), Consistency (system usage, shared components and figures across screens), Originality (does it avoid templated, AI-looking patterns and feel art-directed for this product), Copy (specific, human, consistent). Quote real copy or name real elements. Each fix is a precise instruction the screen editor can apply to one screen. Automated checks have already flagged these issues, include the important ones: see AUTOMATED FINDINGS.

${NEVER}`;

export function critiqueRequestText(body: Json) {
  const screens = (Array.isArray(body.screens) ? body.screens : []).slice(0, 8);
  return [
    specDoc(body.spec || {}),
    systemDoc(body.system || {}),
    ...screens.map((s: Json) => `SCREEN ${str(s.id, 30)} ("${str(s.name, 30)}"):\n${str(s.html, 14000)}`),
    body.findings ? `AUTOMATED FINDINGS:\n${str(body.findings, 3000)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function understandRequestText(body: Json, taste: string) {
  const recent = Array.isArray(body.recent) ? body.recent.slice(0, 6).map((r: unknown) => str(r, 20)).filter(Boolean) : [];
  return [
    `IDEA: ${str(body.prompt, 2000)}`,
    recent.length ? `RECENTLY USED DIRECTIONS (rotate away from these): ${recent.join(", ")}` : "",
    body.direction ? `The user wants this direction as one of the three: ${str(body.direction, 20)}.` : "",
    body.platform && body.platform !== "auto" ? `Platform requested: ${str(body.platform, 10)}.` : "",
    body.reference ? `REFERENCE NOTES FROM THE USER: ${str(body.reference, 1200)}` : "",
    taste,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function systemsRequestText(body: Json, taste: string) {
  const spec = body.spec || {};
  const picks = (Array.isArray(body.directions) ? body.directions : []).slice(0, 3);
  return [
    specDoc(spec),
    ...picks.map((d: Json, i: number) => `DIRECTION ${i + 1}: ${str(d.skill, 20)}\nWhy: ${str(d.why, 300)}\nTwist: ${str(d.twist, 300)}\n${skillText(str(d.skill, 20))}`),
    body.instruction ? `USER NOTE: ${str(body.instruction, 600)}` : "",
    taste,
    `Build ${picks.length} design systems, one per direction, in order.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
