// Exports for design-engine projects: a clickable HTML prototype, a React +
// Vite + Tailwind v4 project, DESIGN.md and tokens. Every export is a map of
// file path → contents, zipped by the caller.
import { ICON_FAMILIES, THEME, buildFrameDoc, esc, iconNames, resolveImages, systemVars, varsCss } from "./frameDoc.js";
import { fontsUrl } from "./fonts.js";
import { designMd, tokensCss } from "./system.js";
import { htmlToJsx } from "./htmlTools.js";
import { VIEWPORTS } from "./engine.js";

const slug = (s) => String(s || "app").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app";
const pascal = (s) => String(s || "Screen").replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1)).join("").replace(/^\d/, "S$&") || "Screen";

const NAV_SCRIPT = `<script>
document.addEventListener("click", function (e) {
  var el = e.target.closest("[data-nav]");
  if (el) { e.preventDefault(); location.href = el.getAttribute("data-nav") + ".html"; return; }
  if (e.target.closest("a,button")) e.preventDefault();
});
</script>`;

export function htmlPrototype(project) {
  const files = {};
  const screens = project.screens.filter((s) => s.html);
  const vp = project.spec?.platform === "mobile" ? VIEWPORTS.mobile : VIEWPORTS.desktop;
  for (const s of screens) {
    const doc = buildFrameDoc({ html: s.html, system: project.system, kit: project.kit, mode: "export", width: vp.w });
    files[`${s.id}.html`] = doc.replace("</body>", `${NAV_SCRIPT}\n</body>`);
  }
  const cards = screens
    .map(
      (s) => `<a class="card" href="${s.id}.html"><iframe src="${s.id}.html" width="${vp.w}" height="${vp.h}" loading="lazy" tabindex="-1"></iframe><span>${esc(s.name)}</span></a>`,
    )
    .join("\n");
  const scale = vp.w > 600 ? 0.3 : 0.6;
  files["index.html"] = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(project.name)}</title>
<style>
body{margin:0;font:15px/1.5 system-ui,sans-serif;background:#F1F0EC;color:#16161A}
header{padding:40px 48px 8px}h1{margin:0;font-size:28px}p{margin:4px 0 0;color:#62626A}
main{display:flex;flex-wrap:wrap;gap:40px;padding:32px 48px 64px}
.card{display:flex;flex-direction:column;gap:10px;text-decoration:none;color:inherit;font-weight:600}
.card iframe{border:0;pointer-events:none;width:${Math.round(vp.w * scale)}px;height:${Math.round(vp.h * scale)}px;zoom:1;transform-origin:0 0;border-radius:${vp.w > 600 ? 8 : 24}px;box-shadow:0 0 0 1px rgba(0,0,0,.06),0 20px 50px -20px rgba(0,0,0,.35);background:#fff}
</style>
<script>addEventListener("load",function(){document.querySelectorAll(".card iframe").forEach(function(f){f.style.width="${vp.w}px";f.style.height="${vp.h}px";f.style.transform="scale(${scale})";f.parentElement.style.width="${Math.round(vp.w * scale)}px";f.parentElement.style.height="${Math.round(vp.h * scale) + 30}px";});});</script>
</head><body>
<header><h1>${esc(project.name)}</h1><p>${esc(project.tagline || "")}</p></header>
<main>
${cards}
</main>
</body></html>`;
  files["DESIGN.md"] = designMd(project);
  return files;
}

const BASE_CSS = THEME.slice(THEME.indexOf("@layer base"));

export function reactProject(project) {
  const files = {};
  const screens = project.screens.filter((s) => s.html);
  const sys = project.system;
  const names = new Map();
  screens.forEach((s) => {
    let n = pascal(s.name);
    while ([...names.values()].includes(n)) {
      n += "2";
    }
    names.set(s.id, n);
  });
  const allIcons = [...new Set(screens.flatMap((s) => iconNames(s.html)))].sort();
  const iconFamily = (ICON_FAMILIES[sys.icons.set] || ICON_FAMILIES.rounded).replace(/ /g, "+");
  const fonts = fontsUrl([sys.fonts.display, sys.fonts.body, sys.fonts.mono]);
  const appName = slug(project.name);
  const vars = { ...systemVars(sys), "--pq-icon-family": `"${ICON_FAMILIES[sys.icons.set] || ICON_FAMILIES.rounded}"` };

  files["package.json"] = JSON.stringify(
    {
      name: appName,
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
      dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" },
      devDependencies: { "@vitejs/plugin-react": "^4.3.4", "@tailwindcss/vite": "^4.1.0", tailwindcss: "^4.1.0", vite: "^6.0.0" },
    },
    null,
    2,
  );
  files["vite.config.js"] = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`;
  files["index.html"] = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(project.name)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    ${fonts ? `<link rel="stylesheet" href="${fonts}" />` : ""}
    ${allIcons.length ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${iconFamily}:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=${allIcons.join(",")}&display=block" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
  files["src/index.css"] = `@import "tailwindcss";

/* Design tokens: ${sys.name} (${sys.skill}). Change these to restyle everything. */
${varsCss(vars).replace("{", " {\n  ").replace(/;/g, ";\n  ").replace(/\s*}$/, "\n}")}

${THEME.slice(0, THEME.indexOf("@layer base")).trim()}

${BASE_CSS}
`;
  files["src/main.jsx"] = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;
  const first = screens[0]?.id;
  files["src/App.jsx"] = `import { useState } from "react";
${screens.map((s) => `import ${names.get(s.id)} from "./screens/${names.get(s.id)}.jsx";`).join("\n")}

const SCREENS = {
${screens.map((s) => `  ${JSON.stringify(s.id)}: ${names.get(s.id)},`).join("\n")}
};

// A minimal router: screens call go(id) to move between them. Swap this for
// your router of choice (React Router, TanStack Router, Next.js pages).
export default function App() {
  const [current, setCurrent] = useState(${JSON.stringify(first)});
  const Screen = SCREENS[current] || SCREENS[${JSON.stringify(first)}];
  const go = (id) => {
    if (SCREENS[id]) {
      setCurrent(id);
      window.scrollTo(0, 0);
    }
  };
  return <Screen go={go} />;
}
`;
  for (const s of screens) {
    const html = resolveImages(s.html, sys, project.kit || []);
    const jsx = htmlToJsx(html, { indent: 3 });
    files[`src/screens/${names.get(s.id)}.jsx`] = `// ${s.name}: ${s.purpose || ""}
export default function ${names.get(s.id)}({ go }) {
  return (
    <>
${jsx}
    </>
  );
}
`;
  }
  files["DESIGN.md"] = designMd(project);
  files["README.md"] = `# ${project.name}

${project.tagline || ""}

Designed in Pipsqueak with the ${sys.name} design system.

## Run it

\`\`\`bash
npm install
npm run dev
\`\`\`

## How it's built

- React 18 + Vite, styled with Tailwind CSS v4.
- Design tokens live in \`src/index.css\` as CSS variables mapped into Tailwind's theme: \`bg-surface\`, \`text-ink\`, \`bg-primary\`, \`font-display\`, \`rounded-lg\`… Change a variable and the whole app follows.
- Each screen is a component in \`src/screens/\`. Elements that move between screens call \`go("screen-id")\`.
- Icons are Material Symbols (\`<span className="icon">name</span>\`).
- \`DESIGN.md\` documents the system for designers and coding agents.
`;
  return files;
}

export function tokensFile(project) {
  return tokensCss(project.system);
}

export async function renderScreenPng(screen, system, kit, width = 390, height = 844) {
  if (typeof document === "undefined") {
    return new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
  }
  const doc = buildFrameDoc({ html: screen.html, system, kit, mode: "export", width });
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = `${width}px`;
  iframe.style.height = `${height}px`;
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(doc);
    iframeDoc.close();

    await new Promise((resolve) => setTimeout(resolve, 300));

    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    }
    ctx.scale(2, 2);

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;">
          ${iframeDoc.documentElement.innerHTML}
        </div>
      </foreignObject>
    </svg>`;

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const blob = await new Promise((resolve) => {
      img.onload = () => {
        ctx.fillStyle = system?.colors?.bg || "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((b) => resolve(b || new Blob([], { type: "image/png" })), "image/png");
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        ctx.fillStyle = system?.colors?.bg || "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = system?.colors?.ink || "#000000";
        ctx.font = "20px system-ui";
        ctx.fillText(screen.name || "Screen", 24, 48);
        canvas.toBlob((b) => resolve(b || new Blob([], { type: "image/png" })), "image/png");
      };
      img.src = url;
    });

    return blob;
  } finally {
    iframe.remove();
  }
}

export function exportDesignTokensJson(project) {
  const sys = project?.system || {};
  const colors = sys.colors || {};
  const fonts = sys.fonts || {};
  return JSON.stringify(
    {
      name: project?.name || "Design System",
      version: "1.0.0",
      theme: {
        colors: {
          bg: colors.bg || "#FAFAF8",
          primary: colors.primary || "#16161A",
          accent: colors.accent || "#FF4D1A",
          ink: colors.ink || "#16161A",
          surface: colors.surface || "#FFFFFF",
          mute: colors.mute || "#8A8A93",
          line: colors.line || "#E5E5E2",
          danger: colors.danger || "#EF4444",
        },
        typography: {
          display: fonts.display || "Fraunces",
          body: fonts.body || "Geist",
          mono: fonts.mono || "Geist Mono",
        },
        radii: {
          sm: "0.375rem",
          md: "0.5rem",
          lg: "0.75rem",
          xl: "1rem",
          full: "9999px",
        },
        shadcn: {
          cssVars: {
            "--background": colors.bg || "#FAFAF8",
            "--foreground": colors.ink || "#16161A",
            "--card": colors.surface || "#FFFFFF",
            "--card-foreground": colors.ink || "#16161A",
            "--primary": colors.primary || "#16161A",
            "--primary-foreground": "#FFFFFF",
            "--accent": colors.accent || "#FF4D1A",
            "--accent-foreground": "#FFFFFF",
            "--muted": colors.line || "#E5E5E2",
            "--muted-foreground": colors.mute || "#8A8A93",
            "--border": colors.line || "#E5E5E2",
            "--radius": "0.75rem",
          },
        },
      },
    },
    null,
    2,
  );
}

export function exportShadcnConfig(project) {
  const sys = project?.system || {};
  const colors = sys.colors || {};
  const fonts = sys.fonts || {};

  const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        border: "hsl(var(--border))",
      },
      fontFamily: {
        display: ["${fonts.display || "Fraunces"}", "serif"],
        body: ["${fonts.body || "Geist"}", "sans-serif"],
        mono: ["${fonts.mono || "Geist Mono"}", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
`;

  const globalsCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --accent: 14 100% 55%;
    --accent-foreground: 0 0% 98%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --border: 240 5.9% 90%;
    --radius: 0.75rem;
  }
}
`;

  return { tailwindConfig, globalsCss };
}

export function openInStackBlitz(project) {
  if (typeof document === "undefined") return;
  const files = reactProject(project);
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "https://stackblitz.com/run";
  form.target = "_blank";

  const add = (name, val) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = typeof val === "string" ? val : JSON.stringify(val);
    form.appendChild(input);
  };

  add("project[title]", project.name || "Pipsqueak Design");
  add("project[description]", project.tagline || "Exported from Pipsqueak");
  add("project[template]", "node");

  for (const [path, content] of Object.entries(files)) {
    add(`project[files][${path}]`, content);
  }

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

export function generateStyleguideScreen(project) {
  const sys = project?.system || {};
  const sysName = sys.name || "Design System";
  const html = `<div class="min-h-full w-full bg-paper text-ink p-8 flex flex-col gap-8">
  <header class="border-b border-line pb-6">
    <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
      <span class="h-2 w-2 rounded-full bg-accent"></span>
      Design System Specimen
    </div>
    <h1 class="font-display text-3xl font-bold tracking-tight text-ink mt-2">${sysName} Styleguide</h1>
    <p class="text-sm text-mute mt-1">Foundational tokens, typography scale, color palette, and core components.</p>
  </header>

  <section>
    <div class="text-xs font-semibold uppercase tracking-wider text-mute mb-3">01 · Color Palette</div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="rounded-xl border border-line bg-surface p-3">
        <div class="h-12 w-full rounded-lg bg-primary mb-2 shadow-inner"></div>
        <div class="text-xs font-bold text-ink">Primary</div>
        <div class="text-[11px] font-mono text-mute">bg-primary</div>
      </div>
      <div class="rounded-xl border border-line bg-surface p-3">
        <div class="h-12 w-full rounded-lg bg-accent mb-2 shadow-inner"></div>
        <div class="text-xs font-bold text-ink">Accent</div>
        <div class="text-[11px] font-mono text-mute">bg-accent</div>
      </div>
      <div class="rounded-xl border border-line bg-surface p-3">
        <div class="h-12 w-full rounded-lg bg-surface border border-line mb-2 shadow-inner"></div>
        <div class="text-xs font-bold text-ink">Surface</div>
        <div class="text-[11px] font-mono text-mute">bg-surface</div>
      </div>
      <div class="rounded-xl border border-line bg-surface p-3">
        <div class="h-12 w-full rounded-lg bg-paper border border-line mb-2 shadow-inner"></div>
        <div class="text-xs font-bold text-ink">Paper / Canvas</div>
        <div class="text-[11px] font-mono text-mute">bg-paper</div>
      </div>
    </div>
  </section>

  <section>
    <div class="text-xs font-semibold uppercase tracking-wider text-mute mb-3">02 · Typography Scale</div>
    <div class="rounded-2xl border border-line bg-surface p-6 flex flex-col gap-4">
      <div class="flex items-baseline justify-between border-b border-line pb-3">
        <span class="text-xs font-mono text-mute">font-display 32px</span>
        <span class="font-display text-2xl font-bold text-ink">Hero Display Heading</span>
      </div>
      <div class="flex items-baseline justify-between border-b border-line pb-3">
        <span class="text-xs font-mono text-mute">font-display 20px</span>
        <span class="font-display text-lg font-semibold text-ink">Section & Modal Title</span>
      </div>
      <div class="flex items-baseline justify-between border-b border-line pb-3">
        <span class="text-xs font-mono text-mute">font-body 15px</span>
        <span class="text-sm leading-relaxed text-ink-2 max-w-md">Body copy designed for high legibility, clean rhythm, and effortless reading.</span>
      </div>
      <div class="flex items-baseline justify-between">
        <span class="text-xs font-mono text-mute">font-mono 12px</span>
        <span class="font-mono text-xs text-mute tracking-tight">TOKEN_ID: #4A90E2 · SYSTEM_READY</span>
      </div>
    </div>
  </section>

  <section>
    <div class="text-xs font-semibold uppercase tracking-wider text-mute mb-3">03 · UI Components & States</div>
    <div class="rounded-2xl border border-line bg-surface p-6 flex flex-col gap-6">
      <div>
        <div class="text-xs text-mute font-medium mb-2.5">Buttons</div>
        <div class="flex flex-wrap items-center gap-3">
          <button class="h-10 px-5 rounded-full bg-ink text-white font-semibold text-xs shadow-sm hover:bg-ink-2">Primary Button</button>
          <button class="h-10 px-5 rounded-full bg-accent text-white font-semibold text-xs shadow-sm hover:opacity-90">Accent Button</button>
          <button class="h-10 px-4 rounded-full border border-line bg-surface text-ink font-medium text-xs hover:border-ink">Secondary</button>
          <button class="h-10 px-3 text-mute font-medium text-xs hover:text-ink">Ghost Action</button>
        </div>
      </div>
      <div>
        <div class="text-xs text-mute font-medium mb-2.5">Badges & Tags</div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-deep">
            <span class="h-1.5 w-1.5 rounded-full bg-accent"></span> Featured
          </span>
          <span class="rounded-full bg-sunken px-3 py-1 text-xs font-medium text-ink-2">Neutral Tag</span>
          <span class="rounded-full border border-line px-3 py-1 text-xs font-medium text-mute">Outlined</span>
        </div>
      </div>
    </div>
  </section>
</div>`.trim();

  return {
    id: `styleguide-${Date.now().toString(36).slice(-4)}`,
    name: "Design System",
    type: "styleguide",
    purpose: "Visual design tokens, typography specimen, and component states.",
    html,
  };
}


