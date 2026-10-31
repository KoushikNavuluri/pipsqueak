// Composition patterns: named, precise screen structures distilled from
// best-in-class apps. The planner assigns one to every screen so a flow never
// repeats the same skeleton, and the screen prompt receives its full recipe.
// Sizes are in px for a 390px-wide phone or a 1440px-wide web page.

export const PATTERNS = {
  // ----- onboarding -----
  "product-hero": {
    type: "onboarding",
    name: "Product as hero",
    recipe:
      "Top 55–60%: a real UI object from the product (a card, chart or notification) floating on a tinted field, cropped off an edge or tilted 4–8°. Headline 28–32px, at most two lines, left-aligned; one 15–17px supporting line. A full-width 52–56px primary button pinned above the home indicator with a quiet text link under it. No illustration.",
  },
  "editorial-cover": {
    type: "onboarding",
    name: "Editorial cover",
    recipe:
      "Full-bleed image running under the status bar with a dark scrim over the bottom 40%. Small wordmark top-center. Display headline 36–44px in white near the bottom, a one-line dek, one primary button.",
  },
  "one-question": {
    type: "onboarding",
    name: "One question per screen",
    recipe:
      "A 4px segmented progress bar and back chevron at top. The question at 24–28px. Four to six full-width option rows 56–64px tall with an icon on the left and a radio on the right, one pre-selected. A Continue button pinned at the bottom.",
  },
  manifesto: {
    type: "onboarding",
    name: "Typographic manifesto",
    recipe:
      "A solid canvas with a 40–56px statement set in short lines, tight tracking, no imagery; the accent color lands on exactly one word. A small proof line (a stat or quote) and one button at the bottom.",
  },

  // ----- home / dashboard -----
  ledger: {
    type: "home",
    name: "Big-number ledger",
    recipe:
      "A 13px secondary label, then the hero figure at 44–60px in tabular numerals (cents or units smaller), then a delta chip. A full-bleed line or area chart with no axes and a period selector under it (1D 1W 1M 1Y). Below, plain rows separated by hairlines, not cards.",
  },
  "front-page": {
    type: "home",
    name: "Today front page",
    recipe:
      "A large title that is the day or date, then one plain-language insight sentence with the key number inside it. A row of three equal score dials or stat columns. Then two or three modules that make sense for this moment of the day, each with a small header and 'See all'.",
  },
  bento: {
    type: "home",
    name: "Bento summary",
    recipe:
      "A two-column bento grid with 12px gutters and at most six tiles of mixed sizes: one 2×1 or 2×2 hero tile, the rest 1×1. Each tile: small label top-left, a 28–34px value bottom-left, and a micro-visual. Tiles differ by content type (ring, bars, map, number, list), not only by color.",
  },
  launcher: {
    type: "home",
    name: "Action-first launcher",
    recipe:
      "The main action fills the screen: a huge input, keypad, search pill or start button as the focal point, with saved shortcuts or recent items as a compact row below. Everything secondary stays small.",
  },
  agenda: {
    type: "home",
    name: "Agenda rail",
    recipe:
      "A seven-day date strip at top with today highlighted. Below, a vertical time rail with tinted blocks whose height matches duration, a 'now' line in the accent, and a compact summary line above the rail.",
  },

  // ----- feed / browse / explore -----
  shelves: {
    type: "browse",
    name: "Editorial shelves",
    recipe:
      "A full-width hero card (4:5 or 16:10) with its title set on the image. Then two or three horizontal shelves with 20–22px titles; shelves use different aspect ratios (square, 16:9, portrait) and the next card peeks 24–40px into view.",
  },
  "listing-stack": {
    type: "browse",
    name: "Big-photo listing stack",
    recipe:
      "A sticky row of category chips or icons at top. Then one listing per row: a 4:3 photo with 12–16px radius and a save icon, then three lines of uncontained text: title with a rating on the right, a muted meta line, and the price in bold.",
  },
  masonry: {
    type: "browse",
    name: "Masonry",
    recipe:
      "A two-column masonry grid of images at their natural aspect ratios with 6–8px gutters and at most one short line of text under each. A slim header with a search icon and filter.",
  },
  thread: {
    type: "browse",
    name: "Text-forward thread",
    recipe:
      "No cards: 36–40px avatars, name and time on one line, 15px body, media at full column width, small action row, hairline dividers between posts.",
  },
  "browse-grid": {
    type: "search",
    name: "Browse-grid zero state",
    recipe:
      "A large search field at top, then 'Browse all' with a two-column grid of saturated category tiles, each with a title top-left and a tilted, cropped image in the corner.",
  },
  "grouped-results": {
    type: "search",
    name: "Grouped results",
    recipe:
      "A focused search field with the query, a large 'Top result' row with an image, then typed sections (3–4 rows each) with section titles and 'See all'.",
  },
  "map-sheet": {
    type: "search",
    name: "Map plus sheet",
    recipe:
      "A full-bleed map (draw it with soft blocks and lines) with price or count pins, and a bottom sheet at half height with a grabber, a result count and the first results.",
  },

  // ----- detail -----
  "gallery-sheet": {
    type: "detail",
    name: "Gallery with overlapping sheet",
    recipe:
      "A photo filling the top 45–55% with a '1/12' counter and back/save buttons. A content sheet with a 20–24px top radius overlapping the photo by 20px: 24–28px title, rating line, then sections separated by hairlines and 24–32px gaps. A sticky bottom bar with price on the left and the primary action on the right.",
  },
  "spec-sheet": {
    type: "detail",
    name: "Spec sheet",
    recipe:
      "An identity row in mono or tabular type (a code, ticker or ID) above a giant status or value. A progress or timeline graphic. Then a two-column key-value grid: 12px muted labels over 17px semibold values.",
  },
  "long-read": {
    type: "detail",
    name: "Long-form editorial",
    recipe:
      "A full-bleed cover image, a 32–40px display title, a byline or metadata line, then 17px body at 1.5 leading with a pull quote and an image that breaks out of the text column.",
  },
  player: {
    type: "detail",
    name: "Artwork-tinted player",
    recipe:
      "A square artwork image with 24–32px margins taking about 45% of the height, on a background tinted from it. Title 22px with a like button, a scrubber with tabular elapsed and remaining times, and oversized transport controls.",
  },

  // ----- lists -----
  "inset-grouped": {
    type: "list",
    name: "Inset grouped",
    recipe: "A tinted canvas with grouped white sections at 10–12px radius, 48px rows with a leading icon tile, value and chevron, and small footnotes under groups.",
  },
  "ledger-list": {
    type: "list",
    name: "Ledger",
    recipe:
      "Sticky date headers; 40px circular icon or logo; name at 16px medium over a 13px category line; amounts right-aligned in tabular numerals. Income with a '+' in the positive color, spending in normal ink.",
  },
  ranked: {
    type: "list",
    name: "Ranked",
    recipe: "A fixed rank column with 20px numerals, the top three tinted, the user's own row highlighted and pinned, and a value column on the right.",
  },
  checklist: {
    type: "list",
    name: "Checklist",
    recipe: "Grouped tasks with 22px hollow circles, completed items faded, an inline '+ New' row at the end of each group, and a count in each group header.",
  },

  // ----- insights -----
  "narrative-insight": {
    type: "insights",
    name: "Narrative insight",
    recipe:
      "The headline is a sentence with the number inside it. One supporting chart with a dashed 'your normal' baseline and no legend; the highlighted bar or point is the only colored element. Then two or three short explanatory rows.",
  },
  rings: {
    type: "insights",
    name: "Rings and gauges",
    recipe: "Concentric progress rings or a 270° arc with a centered 40px+ numeral, colored by state, followed by a compact legend row of the ring values and one sentence of guidance.",
  },
  heatmap: {
    type: "insights",
    name: "Calendar heatmap",
    recipe: "A streak count headline, then a month grid where dot or cell intensity shows the value, then best-day and average stats in a ruled row.",
  },
  "target-bars": {
    type: "insights",
    name: "Bars against a target",
    recipe: "Horizontal bars per category with a target tick and the value at the end; a bar changes color only when it passes its threshold. A summary sentence on top.",
  },

  // ----- profile / settings -----
  "identity-tabs": {
    type: "profile",
    name: "Identity header with tabs",
    recipe: "An 80–96px avatar, 24px name and handle, three stats (18px numbers over 12px labels), a button pair, segmented tabs, then a content grid.",
  },
  "trophy-case": {
    type: "profile",
    name: "Passport / trophy case",
    recipe: "Lifetime totals as big numerals, a badge or stamp grid, and a shareable summary card. Settings live behind a small gear icon.",
  },
  "account-hub": {
    type: "profile",
    name: "Account hub",
    recipe: "A compact identity row, a plan or status banner, then grouped settings rows with icons and values.",
  },

  // ----- commerce -----
  "summary-sheet": {
    type: "checkout",
    name: "Summary sheet",
    recipe:
      "Tappable rows for address, payment and time, each with an icon, current value and chevron. A right-aligned totals block in tabular numerals. One large pay button pinned at the bottom.",
  },
  "cart-upsell": {
    type: "checkout",
    name: "Cart with upsell rail",
    recipe: "Line items with thumbnails and quantity steppers, an 'Add more' horizontal rail, tip or option chips, a collapsed fees line, and a sticky checkout bar with the total.",
  },
  "product-grid": {
    type: "browse",
    name: "Chip-refined product grid",
    recipe: "Sticky filter chips (active ones filled), a result count and sort control, then a two-column product grid with consistent image ratios, name, price and a quick-add.",
  },

  // ----- web -----
  "hero-slab": {
    type: "landing",
    name: "Statement plus product slab",
    recipe:
      "Centered: an eyebrow pill with real news, an H1 of 56–80px at -2 to -3% tracking in at most two lines, an 18–20px subtitle up to 560px wide, a filled primary plus ghost secondary button, then a 1100px product screenshot (built from real UI elements) bleeding off the fold. Then a logo or numbers strip.",
  },
  "split-editorial": {
    type: "landing",
    name: "Split editorial",
    recipe: "A 7/5 grid: left-aligned eyebrow, large headline and body with one CTA on the left; a large photograph on the right. Sections repeat eyebrow, headline, body, CTA with 64px gaps.",
  },
  "minimal-statement": {
    type: "landing",
    name: "Minimal statement",
    recipe: "A two-to-five word H1 at monumental size, two buttons, no screenshot, and a logo strip in the first scroll. Then alternating feature rows with real UI crops.",
  },
  "three-pane": {
    type: "dashboard",
    name: "Three-pane",
    recipe: "A 232px sidebar with 13px items on 30px rows, a list pane with 36px rows, and a detail pane. Hairline dividers, no card chrome, keyboard hints visible.",
  },
  "kpi-chart-table": {
    type: "dashboard",
    name: "KPI strip, chart, table",
    recipe: "Four KPIs separated by hairlines (13px label, 28–32px tabular value, delta), one 280px chart with a range picker, then a dense 14px table with right-aligned numbers.",
  },
  "record-table": {
    type: "dashboard",
    name: "Record table",
    recipe: "A toolbar with search, filters and view switcher, a table with a frozen first column and status badges, and a right side panel showing the selected record.",
  },
  "pricing-cards": {
    type: "pricing",
    name: "Three plans",
    recipe: "A monthly/annual toggle with a savings chip, three plan cards with the middle one marked by border or tint (not size): plan name, 48px price with a small '/mo', a one-line who-it's-for, CTA, and 6–8 feature checks.",
  },
  "sticky-buy": {
    type: "product",
    name: "Sticky buy column",
    recipe: "Left 60%: large product images stacked vertically. Right 40%, sticky: name, price, swatches, size grid, add to bag, delivery promise, then accordions for details.",
  },
};

export const PATTERN_IDS = Object.keys(PATTERNS);

export function patternText(id) {
  const p = PATTERNS[id];
  return p ? `COMPOSITION PATTERN: ${p.name}\n${p.recipe}` : "";
}

// Signals of templated, AI-made UI. Sent with every screen request.
export const ANTI_PATTERNS = [
  "The same skeleton on every screen (greeting header, gradient hero card, carousel, list)",
  "A 'Good morning, Alex' header with avatar and bell as the default home top",
  "Indigo-to-purple gradients, gradient buttons, glowing blobs",
  "Everything inside a card, cards nested in cards, a shadow on every card",
  "The same large radius on every element; pills used for everything",
  "A thick colored left border on a rounded card",
  "Three equal feature cards, or grids of icon-in-tinted-circle + title + two lines",
  "Emoji used as icons; generic decorative icons with no meaning",
  "A flat type scale where sizes barely differ; only two weights",
  "Evenly spaced identical blocks with no rhythm (16px everywhere)",
  "Fake 'Live' or 'New' badges with pulsing dots; tracked eyebrow labels on every section",
  "Generic copy ('Your journey starts here', 'Unlock your potential') and fake data (John Doe, $500.00, round numbers)",
  "Desktop dashboards squeezed onto phones (six KPI tiles with tiny charts)",
  "Several competing primary buttons; the main action out of thumb reach",
  "Charts with full gridlines, legends and rainbow palettes; donuts for everything",
  "Glass blur with nothing behind it; centering everything on mobile",
];

// What each kind of product's home screen should be built around.
export const HERO_OBJECTS = {
  finance: "the number: a balance, total or net worth",
  health: "the score: a ring, gauge or vital with its state",
  fitness: "the score or today's session",
  food: "the photo: appetizing food, with ETA and price next",
  travel: "photo, map and dates together",
  productivity: "the list: today's tasks or the next block of time",
  social: "the content itself, chrome receding",
  commerce: "the product photo",
  media: "the artwork",
  education: "the next lesson and the streak",
  wellness: "a single session or a mood field",
  saas: "the key metric and the work queue",
  community: "the people and what's happening nearby",
};
