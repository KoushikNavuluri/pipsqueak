import { useState } from "react";
import { motion } from "framer-motion";
import { Braces, Code2, Copy, ExternalLink, FileCode2, FileText, ImageIcon, Palette, Play, X } from "lucide-react";
import { strToU8, zipSync } from "fflate";
import { Button } from "../ui";
import { download } from "../util";
import { exportDesignTokensJson, exportShadcnConfig, htmlPrototype, openInStackBlitz, reactProject, renderScreenPng, tokensFile } from "../design/exportDesign.js";
import { designMd } from "../design/system.js";
import { VIEWPORTS } from "../design/engine.js";

const slug = (s) => String(s || "app").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app";

function zip(files, folder) {
  const tree = {};
  for (const [path, content] of Object.entries(files)) {
    tree[`${folder}/${path}`] = typeof content === "string" ? strToU8(content) : new Uint8Array(content);
  }
  return new Blob([zipSync(tree, { level: 6 })], { type: "application/zip" });
}

function Row({ icon: Icon, title, desc, children }) {
  return (
    <div className="flex items-center gap-4 border-b border-line-soft py-4 last:border-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sunken">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-sm text-mute">{desc}</div>
      </div>
      <div className="flex shrink-0 gap-2">{children}</div>
    </div>
  );
}

export function DesignExport({ project, screen, onClose, toast }) {
  const [busy, setBusy] = useState(null);
  const name = slug(project.name);
  const ready = project.screens.filter((s) => s.html).length;
  const vp = project.spec?.platform === "mobile" ? VIEWPORTS.mobile : VIEWPORTS.desktop;

  const run = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast(err.message || "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const exportAllPngs = async () => {
    const screens = project.screens.filter((s) => s.html);
    const files = {};
    for (const sc of screens) {
      const blob = await renderScreenPng(sc, project.system, project.kit, vp.w, vp.h);
      const buf = await blob.arrayBuffer();
      files[`${slug(sc.name)}.png`] = new Uint8Array(buf);
    }
    download(zip(files, `${name}-screens`), `${name}-screens-png.zip`);
  };

  const exportSinglePng = async (sc) => {
    const blob = await renderScreenPng(sc, project.system, project.kit, vp.w, vp.h);
    download(blob, `${slug(sc.name)}.png`);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <motion.div
        initial={{ y: 16, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Export"
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_-12px_rgba(20,20,26,.4)]"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h2 className="display text-lg font-semibold">Export {project.name}</h2>
            <p className="text-xs text-mute">{ready} screens · {project.system.name}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-sunken">
            <X size={17} />
          </button>
        </div>
        <div className="px-5">
          <Row icon={FileCode2} title="React + Tailwind project" desc="A Vite app with every screen as a component, tokens in Tailwind v4 and working navigation.">
            <Button size="sm" variant="secondary" icon={ExternalLink} disabled={!!busy} onClick={() => run("sb", () => openInStackBlitz(project))}>
              Open in StackBlitz
            </Button>
            <Button size="sm" disabled={!!busy} onClick={() => run("react", () => download(zip(reactProject(project), name), `${name}-react.zip`))}>
              {busy === "react" ? "Packing…" : "Download .zip"}
            </Button>
          </Row>
          <Row icon={Code2} title="Design tokens & shadcn" desc="Export tokens.json and shadcn/Tailwind configuration.">
            <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run("tokens-json", () => download(new Blob([exportDesignTokensJson(project)], { type: "application/json" }), `${name}-tokens.json`))}>
              tokens.json
            </Button>
            <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run("shadcn-cfg", () => {
              const { tailwindConfig } = exportShadcnConfig(project);
              download(new Blob([tailwindConfig], { type: "text/javascript" }), "tailwind.config.js");
            })}>
              tailwind.config.js
            </Button>
          </Row>
          <Row icon={Play} title="Clickable HTML prototype" desc="One page per screen plus an index, linked the way the prototype is.">
            <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run("html", () => download(zip(htmlPrototype(project), name), `${name}-prototype.zip`))}>
              {busy === "html" ? "Packing…" : "Download .zip"}
            </Button>
          </Row>
          <Row icon={ImageIcon} title="Screen Images (PNG)" desc="High-resolution PNG screenshots of your screens.">
            <div className="flex gap-2">
              {screen?.html && (
                <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run("png-current", () => exportSinglePng(screen))}>
                  {busy === "png-current" ? "Rendering…" : "This screen"}
                </Button>
              )}
              <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run("png-all", exportAllPngs)}>
                {busy === "png-all" ? "Rendering…" : "All screens (.zip)"}
              </Button>
            </div>
          </Row>
          <Row icon={FileText} title="DESIGN.md" desc="The design system as tokens plus rules, for designers and coding agents.">
            <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run("md", () => download(new Blob([designMd(project)], { type: "text/markdown" }), "DESIGN.md"))}>
              Download
            </Button>
          </Row>
          <Row icon={Palette} title="Tailwind tokens" desc="An @theme block with the colors, fonts and radii.">
            <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run("css", () => download(new Blob([tokensFile(project)], { type: "text/css" }), `${name}-tokens.css`))}>
              .css
            </Button>
          </Row>
          {screen?.html && (
            <Row icon={Braces} title={`${screen.name} HTML`} desc="This screen's markup with Tailwind classes, ready to paste.">
              <Button
                size="sm"
                variant="secondary"
                icon={Copy}
                onClick={() =>
                  run("copy", async () => {
                    await navigator.clipboard.writeText(screen.html);
                    toast("Copied");
                  })
                }
              >
                Copy
              </Button>
            </Row>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

