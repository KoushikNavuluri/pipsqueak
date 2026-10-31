// Exports for design-engine projects: a clickable HTML prototype, a React +
// Vite + Tailwind v4 project, DESIGN.md and tokens. Every export is a map of
// file path → contents, zipped by the caller.
import { ICON_FAMILIES, THEME, buildFrameDoc, iconNames, resolveImages, systemVars, varsCss } from "./frameDoc.js";
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
      (s) => `<a class="card" href="${s.id}.html"><iframe src="${s.id}.html" width="${vp.w}" height="${vp.h}" loading="lazy" tabindex="-1"></iframe><span>${s.name}</span></a>`,
    )
    .join("\n");
  const scale = vp.w > 600 ? 0.3 : 0.6;
  files["index.html"] = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${project.name}</title>
<style>
body{margin:0;font:15px/1.5 system-ui,sans-serif;background:#F1F0EC;color:#16161A}
header{padding:40px 48px 8px}h1{margin:0;font-size:28px}p{margin:4px 0 0;color:#62626A}
main{display:flex;flex-wrap:wrap;gap:40px;padding:32px 48px 64px}
.card{display:flex;flex-direction:column;gap:10px;text-decoration:none;color:inherit;font-weight:600}
.card iframe{border:0;pointer-events:none;width:${Math.round(vp.w * scale)}px;height:${Math.round(vp.h * scale)}px;zoom:1;transform-origin:0 0;border-radius:${vp.w > 600 ? 8 : 24}px;box-shadow:0 0 0 1px rgba(0,0,0,.06),0 20px 50px -20px rgba(0,0,0,.35);background:#fff}
</style>
<script>addEventListener("load",function(){document.querySelectorAll(".card iframe").forEach(function(f){f.style.width="${vp.w}px";f.style.height="${vp.h}px";f.style.transform="scale(${scale})";f.parentElement.style.width="${Math.round(vp.w * scale)}px";f.parentElement.style.height="${Math.round(vp.h * scale) + 30}px";});});</script>
</head><body>
<header><h1>${project.name}</h1><p>${project.tagline || ""}</p></header>
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
    <title>${project.name}</title>
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
