// Converts a carousel variation into full editable artboard screens on
// Pipsqueak's infinite canvas.
import { uid } from "../util";
import { safePalette, styleOf } from "./styles";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderSlideHtml(slide, direction, index, total) {
  const pal = safePalette(direction?.palette, direction?.style);
  const isCover = slide.layout === "cover";
  const kicker = escapeHtml(slide.kicker);
  const title = escapeHtml(slide.title);
  const body = escapeHtml(slide.body);
  const n = String(index + 1).padStart(2, "0");
  const tot = String(total).padStart(2, "0");

  let contentHtml = "";
  if (slide.layout === "code" && slide.code) {
    const code = escapeHtml(slide.code.code || "");
    const fn = escapeHtml(slide.code.filename || "terminal.sh");
    contentHtml = `
      <div class="mt-6 rounded-2xl bg-[#0d1117] border border-white/10 p-5 font-mono text-sm text-[#e6edf3] shadow-xl">
        <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-3 text-xs text-white/50">
          <div class="flex gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-red-500"></span><span class="w-2.5 h-2.5 rounded-full bg-yellow-500"></span><span class="w-2.5 h-2.5 rounded-full bg-green-500"></span></div>
          <span>${fn}</span>
          <span class="text-teal-400 font-bold">${escapeHtml(slide.code.language || "code")}</span>
        </div>
        <pre class="overflow-x-auto whitespace-pre font-mono leading-relaxed"><code>${code}</code></pre>
      </div>`;
  } else if (slide.items?.length) {
    const itemsHtml = slide.items
      .map(
        (it, i) => `
        <div class="flex items-start gap-3 py-2 border-b border-black/5 last:border-0">
          <span class="font-mono text-xs font-bold text-teal-600 mt-1">${String(i + 1).padStart(2, "0")}</span>
          <div>
            ${it.label ? `<div class="font-bold text-base">${escapeHtml(it.label)}</div>` : ""}
            ${it.text ? `<div class="text-sm opacity-80 mt-0.5">${escapeHtml(it.text)}</div>` : ""}
          </div>
        </div>
      `,
      )
      .join("");
    contentHtml = `<div class="mt-6 flex flex-col gap-2">${itemsHtml}</div>`;
  } else if (slide.stat?.value) {
    contentHtml = `
      <div class="mt-8 text-center p-6 rounded-2xl bg-black/5">
        <div class="font-bold text-5xl tracking-tight text-teal-600">${escapeHtml(slide.stat.value)}</div>
        <div class="text-sm uppercase tracking-wider opacity-70 mt-2 font-medium">${escapeHtml(slide.stat.label)}</div>
      </div>`;
  }

  const imgHtml = slide.img?.src
    ? `<div class="mt-6 rounded-2xl overflow-hidden aspect-[16/10] bg-black/5 shadow-md"><img src="${escapeHtml(slide.img.src)}" alt="${escapeHtml(slide.alt || title)}" class="w-full h-full object-cover"/></div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <style>
    body { background-color: ${pal.bg}; color: ${pal.ink}; font-family: system-ui, sans-serif; }
  </style>
</head>
<body class="p-8 min-h-full flex flex-col justify-between">
  <div>
    <div class="flex items-center justify-between text-xs font-mono font-bold tracking-widest uppercase opacity-60 pb-6 border-b border-black/10">
      <span>${isCover ? "COVER" : `SLIDE ${n} / ${tot}`}</span>
      <span>${escapeHtml(direction?.name || "CAROUSEL")}</span>
    </div>
    <div class="pt-8">
      ${kicker ? `<div class="text-xs uppercase font-bold tracking-widest text-teal-600 mb-2">${kicker}</div>` : ""}
      <h1 class="text-3xl font-extrabold tracking-tight leading-tight">${title}</h1>
      ${body ? `<p class="mt-4 text-base opacity-80 leading-relaxed">${body}</p>` : ""}
      ${imgHtml}
      ${contentHtml}
    </div>
  </div>
  <div class="pt-8 flex items-center justify-between text-xs opacity-50 font-mono">
    <span>Pipsqueak Studio</span>
    <span>Swipe ➔</span>
  </div>
</body>
</html>`;
}

export function carouselToCanvasProject(project, variant) {
  const pal = safePalette(variant.direction?.palette, variant.direction?.style);
  return {
    id: uid(),
    kind: "canvas",
    name: `${project.name} (Canvas)`,
    prompt: project.carousel?.topic || project.name,
    created: Date.now(),
    fav: false,
    system: {
      colors: {
        bg: pal.bg,
        surface: pal.surface || pal.bg,
        surface2: pal.bg,
        ink: pal.ink,
        muted: pal.muted,
        line: pal.line || "rgba(0,0,0,0.1)",
        primary: pal.accent,
        onPrimary: pal.onAccent || "#ffffff",
        accent: pal.accent,
        onAccent: pal.onAccent || "#ffffff",
      },
      fonts: {
        display: "Inter",
        body: "Inter",
        mono: "JetBrains Mono",
      },
      radius: { sm: 6, md: 10, lg: 16, xl: 24 },
      shadow: "soft",
    },
    screens: variant.slides.map((slide, i) => ({
      id: uid(),
      name: `Slide ${i + 1}`,
      html: renderSlideHtml(slide, variant.direction, i, variant.slides.length),
      versions: [],
    })),
  };
}
