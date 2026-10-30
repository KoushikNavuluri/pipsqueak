import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CodeXml,
  Copy,
  Download,
  FileBraces,
  History as HistoryIcon,
  Image as ImageIcon,
  MessageSquare,
  Palette,
  Play as PlayIcon,
  Plus,
  RotateCcw,
  Shuffle,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useProject, useStore } from "./store";
import { DEVICES, FONTS, PALETTES, SCREEN_TITLES } from "./data";
import {
  Button,
  Dialog,
  EASE,
  Field,
  Kbd,
  Label,
  Segmented,
  Select,
  cx,
  fireBurst,
} from "./ui";
import {
  buildFigmaJSON,
  buildHTML,
  buildPrompt,
  buildPrototypeHTML,
  buildTokens,
  copyText,
  download,
  elementToPng,
  zipBlobs,
} from "./exporters";
import { hash, makeScreen, slug } from "./gen";
import { Scaled, Screen, bestOn } from "./render";

function Row({ icon: Icon2, title, desc, children }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#EFEEE9] py-4 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F2F1ED]">
          <Icon2 size={19} strokeWidth={1.9} />
        </span>
        <div>
          <div className="text-[15px] font-semibold">{title}</div>
          <div className="text-sm text-[#62626A]">{desc}</div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-[52px] sm:pl-0">
        {children}
      </div>
    </div>
  );
}

export function ExportDialog({ id, onClose }) {
  const { api, s: r } = useStore();
  const o = useProject(id);
  const [i, s] = useState("claude");
  const [l, u] = useState("");
  if (!o) {
    return null;
  }
  const d = DEVICES.find((g) => g.k === r.data.prefs.device) || DEVICES[0];
  const done = (g) => {
    api.toast(g);
    fireBurst();
  };
  const doHtml = () => {
    download(
      new Blob([buildHTML(o, d.plat)], {
        type: "text/html",
      }),
      `${slug(o.name)}-screens.html`,
    );
    done("HTML downloaded");
  };
  const doCssCopy = () =>
    copyText(buildTokens(o)).then((g) =>
      g
        ? done("CSS variables copied")
        : api.toast("Couldn't copy, try the download"),
    );
  const doCssDl = () => {
    download(
      new Blob([buildTokens(o)], {
        type: "text/css",
      }),
      `${slug(o.name)}-tokens.css`,
    );
    done("Tokens downloaded");
  };
  const doJson = () => {
    download(
      new Blob([buildFigmaJSON(o)], {
        type: "application/json",
      }),
      `${slug(o.name)}-layers.json`,
    );
    done("Layers JSON downloaded");
  };
  const doPrompt = (g) => {
    const m = buildPrompt(o, i);
    if (g) {
      copyText(m).then((y) =>
        y
          ? done("Prompt copied")
          : api.toast("Couldn't copy, try the download"),
      );
    } else {
      download(
        new Blob([m], {
          type: "text/markdown",
        }),
        `${slug(o.name)}-${i}-prompt.md`,
      );
      done("Prompt downloaded");
    }
  };
  const doPng = async () => {
    u(`0/${o.screens.length}`);
    try {
      const g = [];
      for (let m = 0; m < o.screens.length; m++) {
        const y = await elementToPng(
          <Screen
            screen={o.screens[m]}
            theme={o.theme}
            width={d.w}
            height={d.h}
            platform={d.plat}
          />,
          d.w,
          d.h,
          2,
        );
        g.push([`${m + 1}-${slug(o.screens[m].title)}.png`, y]);
        u(`${m + 1}/${o.screens.length}`);
      }
      download(
        g.length === 1 ? g[0][1] : await zipBlobs(g),
        g.length === 1 ? g[0][0] : `${slug(o.name)}-screens.zip`,
      );
      done("Images downloaded");
    } catch {
      api.toast("Couldn't render images here");
    }
    u("");
  };
  return (
    <Dialog title={`Export ${o.name}`} onClose={onClose}>
      <Row
        icon={CodeXml}
        title="Static screens (HTML)"
        desc="One file with every screen laid out side by side"
      >
        <Button variant="secondary" icon={Download} onClick={doHtml}>
          Download .html
        </Button>
      </Row>
      <Row
        icon={PlayIcon}
        title="Clickable prototype"
        desc="A standalone HTML file where tabs, cards and buttons navigate"
      >
        <Button
          variant="secondary"
          icon={Download}
          onClick={() => {
            download(
              new Blob([buildPrototypeHTML(o, d)], {
                type: "text/html",
              }),
              `${slug(o.name)}-prototype.html`,
            );
            done("Prototype downloaded");
          }}
        >
          Download .html
        </Button>
      </Row>
      <Row
        icon={Palette}
        title="Design tokens"
        desc="Colors, font, radius and spacing as CSS variables"
      >
        <Button variant="secondary" icon={Copy} onClick={doCssCopy}>
          Copy
        </Button>
        <Button variant="secondary" icon={Download} onClick={doCssDl}>
          .css
        </Button>
      </Row>
      <Row
        icon={FileBraces}
        title="Layers (JSON)"
        desc="Figma-style layer tree with tokens. Not a native .fig file"
      >
        <Button variant="secondary" icon={Download} onClick={doJson}>
          Download .json
        </Button>
      </Row>
      <Row
        icon={MessageSquare}
        title="Prompt for an AI coder"
        desc="Hand the design to Claude, Codex or v0"
      >
        <Segmented
          id="tgt"
          value={i}
          onChange={s}
          options={[
            {
              value: "claude",
              label: "Claude",
            },
            {
              value: "codex",
              label: "Codex",
            },
            {
              value: "v0",
              label: "v0",
            },
          ]}
        />
        <Button variant="secondary" icon={Copy} onClick={() => doPrompt(true)}>
          Copy
        </Button>
        <Button
          variant="secondary"
          icon={Download}
          onClick={() => doPrompt(false)}
        >
          .md
        </Button>
      </Row>
      <Row
        icon={ImageIcon}
        title="Screen images"
        desc={`PNG at 2x for ${d.label} (${d.w * 2} x ${d.h * 2}), zipped`}
      >
        <Button
          variant="secondary"
          icon={Download}
          onClick={doPng}
          disabled={!!l}
        >
          {l ? `Rendering ${l}` : "Download .zip"}
        </Button>
      </Row>
      <Row
        icon={Smartphone}
        title="App Store screenshots"
        desc="Headline, background and device frame, 1290 x 2796"
      >
        <Button
          onClick={() =>
            api.dialog("shots", {
              id: o.id,
            })
          }
        >
          Open shot maker
        </Button>
      </Row>
    </Dialog>
  );
}

export function AddScreenDialog({ id, onClose }) {
  const { api } = useStore();
  const r = useProject(id);
  if (!r) {
    return null;
  }
  const add = (i) => {
    api.edit(r.id, (s) => ({
      ...s,
      screens: [...s.screens, makeScreen(i, s.cat, s.name)],
    }));
    api.toast(`${SCREEN_TITLES[i]} screen added`);
    onClose();
  };
  return (
    <Dialog title="Add a screen" onClose={onClose} size="sm">
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(SCREEN_TITLES).map(([i, s]) => (
          <button
            onClick={() => add(i)}
            className="flex items-center gap-2 rounded-xl border border-[#E6E5E0] px-3.5 py-3.5 text-left text-[15px] font-semibold hover:bg-[#F7F6F3]"
            key={i}
          >
            <Plus size={16} className="text-[#62626A]" />
            {s}
          </button>
        ))}
      </div>
    </Dialog>
  );
}

export function ShortcutsDialog({ onClose }) {
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose} size="sm">
      <ul className="grid gap-3">
        {[
          ["Command palette", ["⌘", "K"]],
          ["Play clickable prototype", ["P"]],
          ["Undo", ["⌘", "Z"]],
          ["Redo", ["⇧", "⌘", "Z"]],
          ["Previous / next screen", ["←", "→"]],
          ["Delete selected block", ["Delete"]],
          ["Deselect", ["Esc"]],
          ["Generate (on the home page)", ["⌘", "↵"]],
        ].map(([a, r]) => (
          <li className="flex items-center justify-between text-sm" key={a}>
            <span>{a}</span>
            <span className="flex gap-1">
              {r.map((o) => (
                <Kbd key={o}>{o}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-[#62626A]">
        On Windows and Linux, use Ctrl instead of ⌘.
      </p>
    </Dialog>
  );
}

const SHOT_COLORS = [
  "#FF4D1A",
  "#16161A",
  "#F3EFE6",
  "#DCE8FF",
  "#E1F3E6",
  "#FCE4EC",
  "#FFE7A3",
  "#CFC8FF",
];

const SHOT_HEADLINES = {
  welcome: (e) => `Meet ${e}`,
  home: (e, t) => t,
  explore: () => "Find your next favorite",
  detail: () => "Every little detail",
  insights: () => "Your week at a glance",
  profile: () => "Made just for you",
};

const SHOT_SUBS = {
  welcome: "Simple, fast and friendly",
  home: "Everything in one place",
  explore: "Browse, filter, decide",
  detail: "Beautiful from edge to edge",
  insights: "Charts that make sense",
  profile: "Your space, your rules",
};

function defaultShots(e) {
  return {
    slides: e.screens.slice(0, 4).map((t, a) => ({
      id: t.id + "-shot",
      screenId: t.id,
      headline: (SHOT_HEADLINES[t.kind] || (() => t.title))(e.name, e.tagline),
      sub: SHOT_SUBS[t.kind] || "",
      bg: SHOT_COLORS[(a * 3) % SHOT_COLORS.length],
      layout: ["peek", "duo", "center", "peek"][a % 4],
    })),
  };
}

function Device({ screen, theme, scale = 0.8, rot = 0 }) {
  const o = scale * 52;
  return (
    <div
      style={{
        width: scale * 390 + 20,
        height: scale * 844 + 20,
        borderRadius: o + 10,
        background: "#16161A",
        padding: 10,
        transform: `rotate(${rot}deg)`,
        boxShadow: "0 24px 48px rgba(20,20,26,.28)",
      }}
    >
      <div
        style={{
          width: scale * 390,
          height: scale * 844,
          borderRadius: o,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: 390,
            height: 844,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          <Screen screen={screen} theme={theme} />
        </div>
        <div
          style={{
            position: "absolute",
            top: scale * 10 + 2,
            left: "50%",
            marginLeft: scale * -48,
            width: scale * 96,
            height: scale * 26,
            borderRadius: 99,
            background: "#16161A",
          }}
        />
      </div>
    </div>
  );
}

function ShotCard({ slide, project }) {
  const a =
    project.screens.find((s) => s.id === slide.screenId) || project.screens[0];
  const r =
    project.screens[(project.screens.indexOf(a) + 1) % project.screens.length];
  const o = bestOn(slide.bg);
  const i = o === "#ffffff";
  return (
    <div
      style={{
        width: 430,
        height: 932,
        position: "relative",
        overflow: "hidden",
        background: slide.bg,
        color: o,
        fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -120,
          top: -120,
          width: 380,
          height: 380,
          borderRadius: 999,
          background: i ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.05)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -140,
          bottom: -160,
          width: 420,
          height: 420,
          borderRadius: 999,
          background: i ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.04)",
        }}
      />
      <div
        style={{
          position: "relative",
          padding: "68px 36px 0",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 56,
            lineHeight: 1.02,
            fontWeight: 600,
            letterSpacing: "-0.035em",
            textWrap: "balance",
          }}
        >
          {slide.headline}
        </div>
        {slide.sub && (
          <div
            style={{
              fontSize: 23,
              fontWeight: 500,
              marginTop: 14,
              opacity: 0.85,
              fontFamily: "Inter, system-ui, sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            {slide.sub}
          </div>
        )}
      </div>
      {slide.layout === "peek" && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 330,
            marginLeft: -339.79999999999995 / 2,
          }}
        >
          <Device screen={a} theme={project.theme} scale={0.82} />
        </div>
      )}
      {slide.layout === "center" && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 300,
            marginLeft: -285.20000000000005 / 2,
          }}
        >
          <Device screen={a} theme={project.theme} scale={0.68} />
        </div>
      )}
      {slide.layout === "duo" && (
        <>
          <div
            style={{
              position: "absolute",
              left: 4,
              top: 390,
            }}
          >
            <Device screen={r} theme={project.theme} scale={0.7} rot={-8} />
          </div>
          <div
            style={{
              position: "absolute",
              right: 4,
              top: 330,
            }}
          >
            <Device screen={a} theme={project.theme} scale={0.76} rot={6} />
          </div>
        </>
      )}
    </div>
  );
}

export function ShotsDialog({ id, onClose }) {
  const { api } = useStore();
  const r = useProject(id);
  const [o, i] = useState(0);
  const [s, l] = useState("");
  useEffect(() => {
    if (r && !r.shots) {
      api.edit(
        r.id,
        (v) => ({
          ...v,
          shots: defaultShots(v),
        }),
        {
          silent: true,
        },
      );
    }
  }, [r?.id, r?.shots]);
  if (!r || !r.shots) {
    return null;
  }
  const u = r.shots.slides;
  const d = u[Math.min(o, u.length - 1)];
  const setSlides = (v) =>
    api.edit(
      r.id,
      (g) => ({
        ...g,
        shots: {
          slides: v(g.shots.slides),
        },
      }),
      {
        silent: true,
      },
    );
  const patch = (v) =>
    setSlides((g) =>
      g.map((m) =>
        m.id === d.id
          ? {
              ...m,
              ...v,
            }
          : m,
      ),
    );
  const one = async () => {
    l("one");
    try {
      download(
        await elementToPng(<ShotCard slide={d} project={r} />, 430, 932, 3),
        `${slug(r.name)}-store-shot-${o + 1}.png`,
      );
      api.toast("Saved 1290 x 2796 PNG");
    } catch {
      api.toast("Couldn't render that here");
    }
    l("");
  };
  const all = async () => {
    l("all");
    try {
      const v = [];
      for (let g = 0; g < u.length; g++) {
        v.push([
          `${slug(r.name)}-store-shot-${g + 1}.png`,
          await elementToPng(
            <ShotCard slide={u[g]} project={r} />,
            430,
            932,
            3,
          ),
        ]);
      }
      download(await zipBlobs(v), `${slug(r.name)}-store-shots.zip`);
      api.toast(`Zipped ${v.length} shots`);
    } catch {
      api.toast("Couldn't render those here");
    }
    l("");
  };
  const add = () => {
    const v = r.screens[u.length % r.screens.length];
    setSlides((g) => [
      ...g,
      {
        id: v.id + "-shot-" + Date.now(),
        screenId: v.id,
        headline: "Say something clear",
        sub: "A short line underneath",
        bg: SHOT_COLORS[g.length % SHOT_COLORS.length],
        layout: "peek",
      },
    ]);
    i(u.length);
  };
  const rm = () => {
    if (u.length < 2) {
      api.toast("Keep at least one shot");
      return;
    }
    setSlides((v) => v.filter((g) => g.id !== d.id));
    i(Math.max(0, o - 1));
  };
  return (
    <Dialog title="App Store screenshots" onClose={onClose} size="lg">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div className="canvasbg grid place-items-center rounded-xl border border-[#E6E5E0] p-5">
            <div className="overflow-hidden rounded-2xl shadow-[0_16px_40px_-14px_rgba(20,20,26,.35)]">
              <Scaled scale={0.5} w={430} h={932}>
                <ShotCard slide={d} project={r} />
              </Scaled>
            </div>
          </div>
          <div className="nosb mt-3 flex gap-2 overflow-x-auto pb-1">
            {u.map((v, g) => (
              <button
                onClick={() => i(g)}
                aria-label={`Shot ${g + 1}`}
                aria-pressed={g === o}
                className={cx(
                  "shrink-0 overflow-hidden rounded-lg border-2",
                  g === o ? "border-[#FF4D1A]" : "border-transparent",
                )}
                key={v.id}
              >
                <Scaled scale={0.14} w={430} h={932}>
                  <ShotCard slide={v} project={r} />
                </Scaled>
              </button>
            ))}
            <button
              onClick={add}
              aria-label="Add a shot"
              className="flex w-[60px] shrink-0 items-center justify-center rounded-lg border border-dashed border-[#B9B7AE]"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
        <div className="grid content-start gap-4">
          <Field
            label="Headline"
            value={d.headline}
            onChange={(v) =>
              patch({
                headline: v,
              })
            }
          />
          <Field
            label="Subtitle"
            value={d.sub}
            onChange={(v) =>
              patch({
                sub: v,
              })
            }
          />
          <div>
            <Label>Background</Label>
            <div className="flex flex-wrap gap-2">
              {SHOT_COLORS.map((v) => (
                <button
                  aria-label={`Background ${v}`}
                  aria-pressed={d.bg === v}
                  onClick={() =>
                    patch({
                      bg: v,
                    })
                  }
                  className={cx(
                    "h-8 w-8 rounded-full border border-black/10",
                    d.bg === v && "ring-2 ring-[#16161A] ring-offset-2",
                  )}
                  style={{
                    background: v,
                  }}
                  key={v}
                />
              ))}
            </div>
          </div>
          <div>
            <Label>Layout</Label>
            <Segmented
              full={true}
              id="lay"
              value={d.layout}
              onChange={(v) =>
                patch({
                  layout: v,
                })
              }
              options={[
                {
                  value: "peek",
                  label: "Single",
                },
                {
                  value: "center",
                  label: "Small",
                },
                {
                  value: "duo",
                  label: "Pair",
                },
              ]}
            />
          </div>
          <Select
            label="Screen shown"
            value={d.screenId}
            onChange={(v) =>
              patch({
                screenId: v,
              })
            }
            options={r.screens.map((v) => ({
              value: v.id,
              label: v.title,
            }))}
            className="w-full [&>select]:w-full"
          />
          <div className="grid gap-2 pt-1">
            <Button icon={Download} onClick={one} disabled={!!s}>
              {s === "one" ? "Rendering…" : "Download PNG"}
            </Button>
            <Button
              variant="secondary"
              icon={Download}
              onClick={all}
              disabled={!!s}
            >
              {s === "all" ? "Zipping…" : "Download all (.zip)"}
            </Button>
            <Button variant="ghost" icon={Trash2} onClick={rm}>
              Remove this shot
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function makeVariants(e, t) {
  const a = Object.keys(PALETTES).filter((i) => i !== e.theme.pal);
  const r = Object.keys(FONTS);
  const o = [4, 10, 16, 24, 30];
  return Array.from(
    {
      length: 6,
    },
    (i, s) => {
      const l = hash(`${e.id}:${t}:${s}`);
      const u = a[l % a.length];
      return {
        pal: u,
        font: r[(l >>> 4) % r.length],
        radius: o[(l >>> 8) % o.length],
        density: e.theme.density,
        mode: PALETTES[u].dark
          ? "auto"
          : (l >>> 12) % 4 === 0
            ? "dark"
            : "light",
        accent: null,
        accent2: null,
      };
    },
  );
}

export function VariationsDialog({ id, sIdx = 0, onClose }) {
  const { api, s: o } = useStore();
  const i = useProject(id);
  const [s, l] = useState(1);
  if (!i) {
    return null;
  }
  const u = DEVICES.find((p) => p.k === o.data.prefs.device) || DEVICES[0];
  const d = i.screens[Math.min(sIdx, i.screens.length - 1)];
  const c = makeVariants(i, s);
  const apply = (p) => {
    api.edit(i.id, (h) => ({
      ...h,
      theme: p,
    }));
    api.toast("Variation applied", {
      action: {
        label: "Undo",
        run: () => api.undo(i.id),
      },
    });
    fireBurst();
    onClose();
  };
  return (
    <Dialog
      title="Style variations"
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#62626A]">
            Showing “{d.title}” in six new looks. Pick one to apply.
          </span>
          <Button
            variant="secondary"
            icon={Shuffle}
            onClick={() => l((p) => p + 1)}
          >
            Shuffle
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {c.map((p, h) => (
          <motion.button
            initial={{
              opacity: 0,
              y: 14,
              scale: 0.97,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            transition={{
              delay: h * 0.05,
              duration: 0.35,
              ease: EASE,
            }}
            whileHover={{
              y: -4,
            }}
            onClick={() => apply(p)}
            aria-label={`Apply ${PALETTES[p.pal].name} with ${FONTS[p.font].name} font`}
            className="group rounded-xl border border-[#E6E5E0] bg-[#F7F6F3] p-3 text-left transition-shadow hover:shadow-[0_12px_28px_-12px_rgba(20,20,26,.3)]"
            key={s + "-" + h}
          >
            <div className="mx-auto w-fit overflow-hidden rounded-lg border border-[#E6E5E0]">
              <Scaled scale={0.3} w={u.w} h={u.h}>
                <Screen
                  screen={d}
                  theme={p}
                  width={u.w}
                  height={u.h}
                  platform={u.plat}
                />
              </Scaled>
            </div>
            <div className="mt-2.5 text-sm font-semibold">
              {PALETTES[p.pal].name}
              {p.mode === "dark" ? " · dark" : ""}
            </div>
            <div className="text-xs text-[#62626A]">
              {FONTS[p.font].name} · {p.radius}px corners
            </div>
          </motion.button>
        ))}
      </div>
    </Dialog>
  );
}

export function HistoryDialog({ id, onClose }) {
  const { api } = useStore();
  const r = useProject(id);
  const [o, i] = useState("");
  if (!r) {
    return null;
  }
  const s = r.snapshots || [];
  const save = () => {
    const c = o.trim() || `Snapshot ${s.length + 1}`;
    api.edit(
      r.id,
      (f) => ({
        ...f,
        snapshots: [
          {
            id: Math.random().toString(36).slice(2, 9),
            name: c,
            at: Date.now(),
            data: JSON.parse(
              JSON.stringify({
                name: f.name,
                theme: f.theme,
                screens: f.screens,
              }),
            ),
          },
          ...(f.snapshots || []),
        ].slice(0, 12),
      }),
      {
        silent: true,
      },
    );
    i("");
    api.toast(`Saved \u201C${c}\u201D`);
    fireBurst();
  };
  const restore = (c) => {
    api.edit(r.id, (f) => ({
      ...f,
      ...JSON.parse(JSON.stringify(c.data)),
    }));
    api.toast(`Restored \u201C${c.name}\u201D`, {
      action: {
        label: "Undo",
        run: () => api.undo(r.id),
      },
    });
    onClose();
  };
  const remove = (c) =>
    api.edit(
      r.id,
      (f) => ({
        ...f,
        snapshots: (f.snapshots || []).filter((p) => p.id !== c.id),
      }),
      {
        silent: true,
      },
    );
  return (
    <Dialog title="Version history" onClose={onClose} size="md">
      <div className="mb-5 flex items-end gap-2">
        <div className="flex-1">
          <Field
            label="Name this version"
            value={o}
            onChange={i}
            placeholder={`Snapshot ${s.length + 1}`}
          />
        </div>
        <Button icon={Plus} onClick={save}>
          Save snapshot
        </Button>
      </div>
      {s.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D6D4CD] px-6 py-10 text-center">
          <HistoryIcon
            className="mx-auto mb-2 text-[#62626A]"
            size={26}
            strokeWidth={1.6}
          />
          <div className="display text-base font-semibold">
            No snapshots yet
          </div>
          <p className="mx-auto mt-1 max-w-xs text-sm text-[#62626A]">
            Save a version before a big change. You can jump back to it any
            time.
          </p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {s.map((c, f) => (
            <motion.li
              layout={true}
              initial={{
                opacity: 0,
                y: 8,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: f * 0.03,
              }}
              className="flex items-center gap-3 rounded-xl border border-[#E6E5E0] p-2.5"
              key={c.id}
            >
              <span className="overflow-hidden rounded-md border border-[#E6E5E0]">
                <Scaled scale={0.1}>
                  <Screen screen={c.data.screens[0]} theme={c.data.theme} />
                </Scaled>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {c.name}
                </span>
                <span className="block text-xs text-[#62626A]">
                  {c.data.screens.length} screens ·{" "}
                  {new Date(c.at).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </span>
              <Button
                size="sm"
                variant="secondary"
                icon={RotateCcw}
                onClick={() => restore(c)}
              >
                Restore
              </Button>
              <button
                aria-label={`Delete ${c.name}`}
                onClick={() => remove(c)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#62626A] hover:bg-[#F2F1ED]"
              >
                <Trash2 size={16} />
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
