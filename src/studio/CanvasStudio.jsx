import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  Crosshair,
  Download,
  Hand,
  ImageIcon,
  LoaderCircle,
  Maximize,
  Minus,
  MousePointer2,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Undo2,
  X,
} from "lucide-react";
import { useProject, useStore } from "../store";
import { Logo, PipGlyph } from "../brand";
import { Button, IconButton, Segmented, cx } from "../ui";
import { uid } from "../util";
import { VIEWPORTS } from "../design/engine.js";
import { removeAt } from "../design/htmlTools.js";
import { knownHeight, loadCss, rememberHeight } from "../design/cssCache.js";
import { skillById } from "../design/skills.js";
import { Canvas } from "./Canvas";
import { ScreenCard } from "./ScreenCard";
import { useStudio, withVersion } from "./useStudio";
import { Inspector } from "./panels/Inspector";
import { SystemPanel } from "./panels/SystemPanel";
import { ChatPanel } from "./panels/ChatPanel";
import { ReviewPanel } from "./panels/ReviewPanel";
import { HistoryPanel } from "./panels/HistoryPanel";
import { Present } from "./Present";
import { Compare, Variations } from "./Variations";
import { DesignExport } from "./DesignExport";

const TABS = [
  ["design", "Design"],
  ["system", "System"],
  ["chat", "Chat"],
  ["review", "Review"],
  ["history", "History"],
];

export function CanvasStudio() {
  const project = useProject();
  const { s, api } = useStore();
  const studio = useStudio(project);
  const canvas = useRef(null);
  const [selection, setSelection] = useState(null);
  const [tool, setTool] = useState("select");
  const [tab, setTab] = useState("design");
  const [viewportKey, setViewportKey] = useState(project.spec?.platform === "mobile" ? "mobile" : "desktop");
  const [present, setPresent] = useState(null);
  const [variations, setVariations] = useState(null);
  const [compare, setCompare] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [wholeApp, setWholeApp] = useState(false);
  const [working, setWorking] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [zoom, setZoom] = useState(0.5);
  // Frames whose CSS is cached open as static pages; look it up before mounting them.
  const [cssReady, setCssReady] = useState(false);
  useEffect(() => {
    loadCss(project.screens.map((sc) => sc.html)).finally(() => setCssReady(true));
  }, [project.id]);
  // Frames then mount one at a time, left to right: every page mounting
  // at once made the browser lay them all out in one long freeze.
  const [mounted, setMounted] = useState(0);
  useEffect(() => {
    if (!cssReady) return;
    const total = project.screens.length;
    let n = 1;
    let timer;
    const next = () => {
      n += 1;
      if (n >= total) return setMounted(Infinity);
      setMounted(n);
      timer = setTimeout(next, 180);
    };
    if (n >= total) setMounted(Infinity);
    else {
      setMounted(n);
      timer = setTimeout(next, 250);
    }
    return () => clearTimeout(timer);
  }, [cssReady, project.id]);
  // Screens show at full length on the canvas; the prototype scrolls them.
  // Known heights let frames mount at their final size (one layout, not two).
  const knownHeights = (vp) => Object.fromEntries(project.screens.map((sc) => [sc.id, sc.html ? knownHeight(vp.w, sc.html) : null]).filter(([, h]) => h));
  const [heights, setHeights] = useState(() => knownHeights(VIEWPORTS[project.spec?.platform === "mobile" ? "mobile" : "desktop"]));
  // Frames report their height as they load; apply the reports once per frame.
  const pendingHeights = useRef({});
  const heightsFrame = useRef(0);
  const reportHeight = (screenId, h) => {
    pendingHeights.current[screenId] = h;
    if (heightsFrame.current) return;
    heightsFrame.current = requestAnimationFrame(() => {
      heightsFrame.current = 0;
      const batch = pendingHeights.current;
      pendingHeights.current = {};
      setHeights((all) => {
        const changed = Object.entries(batch).filter(([id, v]) => Math.abs((all[id] || 0) - v) > 2);
        return changed.length ? { ...all, ...Object.fromEntries(changed) } : all;
      });
    });
  };
  const viewport = VIEWPORTS[viewportKey];
  const hist = s.hist[project.id] || { past: [], future: [] };

  const gap = Math.round(viewport.w * 0.12 + 48);
  const placed = useMemo(() => project.screens.map((sc, i) => ({ ...sc, _x: i * (viewport.w + gap), _y: 0 })), [project.screens, viewport.w, gap]);
  const bounds = { x: -40, y: -60, w: placed.length * (viewport.w + gap) - gap + 80, h: viewport.h + 140 };

  const tallest = Math.max(viewport.h, ...project.screens.map((sc) => heights[sc.id] || 0));
  const fitAll = useCallback(() => canvas.current?.fit({ ...bounds, h: tallest + 140 }, 72), [bounds.w, tallest]);
  const firstViewport = useRef(true);
  useEffect(() => {
    if (firstViewport.current) {
      firstViewport.current = false;
      return;
    }
    setHeights(knownHeights(viewport));
  }, [viewportKey]);
  // Open at a legible zoom: everything if it fits, otherwise from the first screen.
  useEffect(() => {
    const t = setTimeout(() => canvas.current?.fit(bounds, 72, viewport.w < 600 ? 0.55 : 0.42), 60);
    return () => clearTimeout(t);
  }, [viewportKey, project.screens.length]);

  const selectedScreen = project.screens.find((sc) => sc.id === selection?.screenId);
  const screenById = (id) => project.screens.find((sc) => sc.id === id);

  const focusLabel = selection?.info?.path ? `${selection.info.tag} on ${selectedScreen?.name}` : selectedScreen ? selectedScreen.name : null;

  const selectScreen = (id) => {
    if (selection?.screenId !== id || selection?.info) {
      setSelection({ screenId: id, info: null });
    }
  };

  const handleFrameMessage = (screenId, m) => {
    if ((m.type === "size" || m.type === "ready") && m.h) {
      const h = Math.min(8000, Math.max(viewport.h, Math.ceil(m.h)));
      reportHeight(screenId, h);
      const sc = screenById(screenId);
      if (sc?.html && !studio.streams[screenId]) rememberHeight(viewport.w, sc.html, h);
    } else if (m.type === "select") {
      setSelection(m.path ? { screenId, info: m } : { screenId, info: null });
      setTab("design");
      setWholeApp(false);
    } else if (m.type === "text") {
      const frame = studio.frames.current.get(screenId);
      frame?.expect(m.html);
      studio.commitScreen(screenId, m.html, "Edited text");
    } else if (m.type === "key") {
      if (m.meta && m.key.toLowerCase() === "z") (m.shift ? api.redo : api.undo)(project.id);
      else if (m.key === "Escape") setSelection(null);
    } else if (m.type === "wheel" && !m.zoom) {
      canvas.current.panBy(-m.dx, -m.dy);
    } else if (m.type === "wheel" && m.zoom) {
      const el = document.querySelector(`[data-frame-host="${screenId}"]`);
      const r = el?.getBoundingClientRect();
      if (r) {
        const z = canvas.current.view().z;
        canvas.current.wheelFromFrame(m.dy, r.left + m.x * z, r.top + m.y * z);
      }
    }
  };

  // Per-screen callbacks that stay the same between renders, so a screen card
  // only re-renders when its own props change.
  const latestHandlers = useRef({});
  latestHandlers.current = { message: handleFrameMessage, select: (id) => selectScreen(id), action: (...a) => onAction(...a) };
  const cardCallbacks = useRef(new Map());
  const callbacksFor = (id) => {
    let c = cardCallbacks.current.get(id);
    if (!c) {
      c = {
        ref: (r) => (r ? studio.frames.current.set(id, r) : studio.frames.current.delete(id)),
        message: (m) => latestHandlers.current.message(id, m),
      };
      cardCallbacks.current.set(id, c);
    }
    return c;
  };
  const stableSelect = useCallback((id) => latestHandlers.current.select(id), []);
  const stableAction = useCallback((...a) => latestHandlers.current.action(...a), []);

  // Keep the canvas zoom readout in sync.
  useEffect(() => {
    const t = setInterval(() => {
      const v = canvas.current?.view();
      if (v && Math.abs(v.z - zoom) > 0.001) setZoom(v.z);
    }, 150);
    return () => clearInterval(t);
  }, [zoom]);

  const say = (text, tone) => api.toast(text, { tone });

  const logChat = (userText, reply, focus) =>
    api.edit(
      project.id,
      (p) => ({
        ...p,
        chat: [...(p.chat || []), { id: uid(), role: "user", text: userText, focus, at: Date.now() }, { id: uid(), role: "ai", text: reply, status: "done", at: Date.now() }].slice(-60),
      }),
      { silent: true },
    );

  const direct = async (screenId, text, path) => {
    setWorking(true);
    try {
      const res = await studio.aiEdit(screenId, text, { path });
      const where = path ? `the selected ${selection?.info?.tag || "element"} on ${screenById(screenId)?.name}` : screenById(screenId)?.name;
      logChat(text, res.changed ? `Updated ${where}.` : "Pip didn't change anything. Try saying it differently.", focusLabel);
      if (!res.changed) say("No change was made. Try rephrasing.");
    } catch (err) {
      say(err.message || "That edit didn't work", "error");
    } finally {
      setWorking(false);
    }
  };

  const send = async (raw) => {
    const text = (raw ?? prompt).trim();
    if (!text || working) {
      return;
    }
    setPrompt("");
    // Typed requests aim at the selection; chips and suggestions go to the copilot.
    if (raw === undefined && !wholeApp && selection?.info?.path) {
      return direct(selection.screenId, text, selection.info.path);
    }
    if (raw === undefined && !wholeApp && selectedScreen) {
      return direct(selection.screenId, text);
    }
    setTab("chat");
    setWorking(true);
    try {
      await studio.runCopilot(text, focusLabel && !wholeApp ? { label: focusLabel, describe: selection?.info?.outer?.slice(0, 600) || focusLabel } : null);
    } finally {
      setWorking(false);
    }
  };

  const duplicateScreen = (id) => {
    const src = screenById(id);
    let nid = `${id}-copy`;
    while (project.screens.some((sc) => sc.id === nid)) nid += "-2";
    api.edit(project.id, (p) => {
      const i = p.screens.findIndex((sc) => sc.id === id);
      const copy = { ...src, id: nid, name: `${src.name} copy`, versions: [], inNav: false };
      return { ...p, screens: [...p.screens.slice(0, i + 1), copy, ...p.screens.slice(i + 1)] };
    });
  };
  const deleteScreen = (id) => {
    if (project.screens.length <= 1) return say("A design needs at least one screen", "error");
    api.edit(project.id, (p) => ({ ...p, screens: p.screens.filter((sc) => sc.id !== id) }));
    setSelection(null);
    api.toast("Screen deleted", { action: { label: "Undo", run: () => api.undo(project.id) }, ms: 5000 });
  };

  const onAction = (kind, screenId, text, path) => {
    if (kind === "ask-screen") return direct(screenId, text);
    if (kind === "ask-element") return direct(screenId, text, path);
    if (kind === "regenerate") return studio.regenerate(screenId);
    if (kind === "variations") return setVariations(screenId);
    if (kind === "history") {
      selectScreen(screenId);
      return setTab("history");
    }
    if (kind === "duplicate") return duplicateScreen(screenId);
    if (kind === "delete") return deleteScreen(screenId);
    if (kind === "play") return setPresent(screenId);
  };

  const restore = (screenId, version) => {
    const sc = screenById(screenId);
    studio.commitScreen(screenId, version.html, `Restored “${version.label}”`);
    setCompare(null);
    say(`Restored ${sc.name}`, "success");
  };

  const designNext = (fromId, tapped) => {
    setPresent(null);
    setTab("chat");
    const from = screenById(fromId);
    studio.runCopilot(`Add the screen that opens when someone taps “${tapped || "the main action"}” on ${from?.name}. Then link that element on ${from?.name} to the new screen with data-nav.`, null);
  };

  // Keyboard shortcuts for the studio.
  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        (e.shiftKey ? api.redo : api.undo)(project.id);
      } else if (typing) {
        return;
      } else if (e.key === "Escape") {
        setSelection(null);
      } else if (e.key.toLowerCase() === "p" && !present) {
        setPresent(selection?.screenId || project.screens[0]?.id);
      } else if (e.key.toLowerCase() === "v") {
        setTool("select");
      } else if (e.key.toLowerCase() === "h") {
        setTool("hand");
      } else if ((e.key === "Delete" || e.key === "Backspace") && selection?.info?.path && selectedScreen) {
        e.preventDefault();
        studio.commitScreen(selection.screenId, removeAt(selectedScreen.html, selection.info.path), "Deleted element");
        setSelection({ screenId: selection.screenId, info: null });
      } else if (e.key === "1" && e.shiftKey) {
        fitAll();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  // Point the frames' bridges at the current selection.
  useEffect(() => {
    for (const [id, frame] of studio.frames.current) {
      frame?.post({ type: "select", path: id === selection?.screenId ? selection?.info?.path || null : null });
    }
  }, [selection?.screenId, selection?.info?.path?.join(".")]);

  const kit = project.kit || [];
  const kitDone = kit.filter((k) => k.status === "done").length;
  const anyBusy = Object.values(studio.busy).some(Boolean);
  const skill = skillById(project.system.skill);

  return (
    <div className="flex h-full flex-col bg-canvas">
      <header className="relative z-10 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-paper/90 px-3 backdrop-blur">
        <Logo to="/app" compact={true} className="p-1" />
        <span className="h-5 w-px bg-line" aria-hidden="true" />
        <input
          value={project.name}
          onChange={(e) => api.edit(project.id, (p) => ({ ...p, name: e.target.value.slice(0, 40) }), { key: "rename" })}
          aria-label="Design name"
          className="w-28 min-w-0 rounded-lg bg-transparent px-2 py-1.5 text-sm font-semibold sm:w-44 outline-none transition-colors hover:bg-sunken focus:bg-surface focus:ring-2 focus:ring-ink/80"
        />
        <button onClick={() => setTab("system")} className="hidden items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-xs font-medium transition-colors hover:border-line-strong md:inline-flex" title="Design system">
          <span className="flex -space-x-1">
            {["primary", "accent", "ink"].map((k) => (
              <span key={k} className="h-5 w-5 rounded-full border-2 border-white" style={{ background: project.system.colors[k] }} />
            ))}
          </span>
          {project.system.name} · {skill.name}
        </button>
        <AnimatePresence>
          {anyBusy && (
            <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="hidden items-center gap-2 text-xs font-medium lg:inline-flex">
              <PipGlyph size={14} pulse /> <span className="shine-text">Pip is designing</span>
            </motion.span>
          )}
        </AnimatePresence>
        <div className="ml-auto flex items-center gap-1">
          <IconButton icon={Undo2} label="Undo" title="Undo (⌘Z)" onClick={() => api.undo(project.id)} disabled={!hist.past.length} iconSize={16} />
          <IconButton icon={Redo2} label="Redo" title="Redo (⇧⌘Z)" onClick={() => api.redo(project.id)} disabled={!hist.future.length} iconSize={16} />
          {project.spec?.platform !== "mobile" && (
            <Segmented
              id="studio-viewport"
              size="sm"
              className="ml-1 hidden sm:inline-flex"
              value={viewportKey}
              onChange={setViewportKey}
              options={["desktop", "tablet", "mobile"].map((k) => ({ value: k, label: VIEWPORTS[k].label }))}
            />
          )}
          <Button variant="secondary" size="sm" icon={Play} className="ml-1" aria-label="Play" onClick={() => setPresent(selection?.screenId || project.screens[0]?.id)}>
            <span className="hidden sm:inline">Play</span>
          </Button>
          <Button size="sm" icon={Download} aria-label="Export" onClick={() => setExporting(true)}>
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="sb hidden w-56 shrink-0 flex-col overflow-y-auto border-r border-line bg-paper md:flex" aria-label="Screens">
          <div className="eyebrow px-4 pb-2 pt-5">Screens · {project.screens.length}</div>
          <ul className="px-2">
            {project.screens.map((sc) => (
              <li key={sc.id}>
                {renaming === sc.id ? (
                  <input
                    autoFocus
                    defaultValue={sc.name}
                    onBlur={(e) => {
                      const name = e.target.value.trim().slice(0, 24);
                      if (name) api.edit(project.id, (p) => ({ ...p, screens: p.screens.map((x) => (x.id === sc.id ? { ...x, name } : x)) }));
                      setRenaming(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    className="w-full rounded-md border border-ink px-2 py-1.5 text-sm outline-none"
                  />
                ) : (
                  <button
                    onClick={() => {
                      selectScreen(sc.id);
                      const i = project.screens.findIndex((x) => x.id === sc.id);
                      canvas.current?.fit({ x: i * (viewport.w + gap) - 40, y: -60, w: viewport.w + 80, h: viewport.h + 120 }, 48);
                    }}
                    onDoubleClick={() => setRenaming(sc.id)}
                    className={cx("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors", selection?.screenId === sc.id ? "bg-ink text-white" : "hover:bg-sunken")}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{sc.name}</span>
                    {studio.busy[sc.id] ? (
                      <LoaderCircle size={13} className="shrink-0 animate-spin" />
                    ) : sc.status === "pending" ? (
                      <span className="text-[11px] opacity-60">queued</span>
                    ) : null}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button onClick={() => send("Add one more screen this app clearly needs, designed in the same system.")} disabled={working} className="mx-2 mt-2 flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-3 py-2 text-sm text-mute transition-colors hover:border-ink hover:text-ink disabled:opacity-40">
            <Plus size={14} /> Suggest a screen
          </button>
          {kit.length > 0 && (
            <div className="mt-auto border-t border-line p-4">
              <div className="eyebrow mb-2.5 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5">
                  <ImageIcon size={12} /> Image kit
                </span>
                <span>
                  {kitDone}/{kit.length}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {kit.map((k, i) => (
                  <div key={i} className="aspect-square overflow-hidden rounded-lg bg-line" title={k.subject}>
                    {k.url ? (
                      <img src={k.url} alt="" className="h-full w-full object-cover" />
                    ) : k.status === "failed" ? (
                      <button
                        onClick={() => api.edit(project.id, (p) => ({ ...p, kit: p.kit.map((x, j) => (j === i ? { ...x, status: "pending" } : x)) }), { silent: true })}
                        aria-label={`Paint again: ${k.subject}`}
                        title="Painting failed. Try again"
                        className="flex h-full w-full items-center justify-center bg-line-soft text-mute hover:text-ink"
                      >
                        <RotateCcw size={14} />
                      </button>
                    ) : (
                      <div className={cx("h-full w-full", k.status === "pending" ? "skel" : "bg-line-soft")} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="relative min-w-0 flex-1">
          <Canvas ref={canvas} tool={tool} onBackgroundClick={() => setSelection(null)}>
            {(view) =>
              cssReady &&
              placed.map((sc, i) => (
                <div key={sc.id} data-frame-host={sc.id}>
                  <ScreenCard
                    ref={callbacksFor(sc.id).ref}
                    project={project}
                    screen={sc}
                    deferred={i >= mounted && studio.streams[sc.id] == null}
                    viewport={viewport}
                    height={heights[sc.id]}
                    zoom={view.z}
                    selected={selection?.screenId === sc.id}
                    mode={tool === "select" ? "edit" : "view"}
                    streaming={studio.streams[sc.id] ?? null}
                    busy={studio.busy[sc.id]}
                    issues={(project.review?.audits?.[sc.id] || []).length}
                    onSelect={stableSelect}
                    onMessage={callbacksFor(sc.id).message}
                    onAction={stableAction}
                    onRename={setRenaming}
                  />
                </div>
              ))
            }
          </Canvas>

          <div className="absolute left-4 top-4 flex items-center gap-0.5 rounded-full border border-line bg-surface/90 p-1 shadow-soft backdrop-blur">
            {[
              ["select", MousePointer2, "Select (V)"],
              ["hand", Hand, "Pan (H or hold Space)"],
            ].map(([k, Icon, label]) => (
              <button key={k} onClick={() => setTool(k)} aria-label={label} title={label} className={cx("flex h-8 w-8 items-center justify-center rounded-full transition-colors", tool === k ? "bg-ink text-white" : "text-ink-2 hover:bg-sunken")}>
                <Icon size={15} />
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-line" />
            <button onClick={() => canvas.current?.zoomBy(1 / 1.25)} aria-label="Zoom out" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-sunken">
              <Minus size={15} />
            </button>
            <button onClick={() => canvas.current?.setZoom(1)} className="w-12 text-center font-mono text-[11px] font-medium tabular-nums text-ink-2" title="Zoom to 100%">
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={() => canvas.current?.zoomBy(1.25)} aria-label="Zoom in" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-sunken">
              <Plus size={15} />
            </button>
            <button onClick={fitAll} aria-label="Fit all screens" title="Fit (⇧1)" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-sunken">
              <Maximize size={15} />
            </button>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-3 sm:px-24">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="group/ask pointer-events-auto relative w-full max-w-xl rounded-[22px] border border-line bg-surface/95 p-2 shadow-lift backdrop-blur transition-[border-color,box-shadow] duration-300 focus-within:border-ink/70 focus-within:shadow-[0_0_0_4px_rgba(255,77,26,.10),0_22px_48px_-20px_rgba(23,21,15,.3)]"
            >
              <AnimatePresence initial={false}>
                {focusLabel && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="flex items-center gap-2 px-2 pb-1.5 pt-0.5 text-xs">
                      <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", wholeApp ? "bg-sunken text-mute line-through" : "bg-accent-soft text-accent-deep")}>
                        <Crosshair size={11} /> {focusLabel}
                      </span>
                      <button type="button" onClick={() => setWholeApp((w) => !w)} className="font-medium text-mute hover:text-ink">
                        {wholeApp ? "Aim at selection" : "Whole app instead"}
                      </button>
                      <button type="button" onClick={() => setSelection(null)} aria-label="Clear selection" className="ml-auto text-faint hover:text-ink">
                        <X size={13} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex items-end gap-2">
                <span className="mb-2.5 ml-2 transition-transform duration-500 group-focus-within/ask:rotate-[20deg]">
                  <PipGlyph size={16} pulse={working} />
                </span>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  maxLength={1200}
                  disabled={working}
                  placeholder={working ? "Pip is on it…" : focusLabel && !wholeApp ? `Ask Pip to change ${focusLabel}…` : "Ask Pip for any change across the app…"}
                  aria-label="Ask Pip"
                  className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-faint"
                />
                <button type="submit" disabled={working || !prompt.trim()} aria-label="Send" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-[background-color,transform,opacity] hover:bg-ink-2 active:scale-95 disabled:opacity-25">
                  {working ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowUp size={17} strokeWidth={2.4} />}
                </button>
              </div>
            </form>
          </div>
        </main>

        <aside className="hidden w-[340px] shrink-0 flex-col border-l border-line bg-white lg:flex" aria-label="Inspector">
          <div className="flex shrink-0 border-b border-line px-2">
            {TABS.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={cx("relative px-2.5 py-3 text-[13px] font-semibold", tab === k ? "text-ink" : "text-faint hover:text-ink")}>
                {label}
                {tab === k && <motion.span layoutId="studio-tab" className="absolute inset-x-1.5 bottom-0 h-0.5 rounded-full bg-ink" />}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {tab === "design" && (
              <Inspector
                project={project}
                studio={studio}
                selection={selection}
                onSelectPath={(path) => {
                  if (!path || !path.length) return setSelection({ screenId: selection.screenId, info: null });
                  studio.frames.current.get(selection.screenId)?.post({ type: "select", path, report: true });
                }}
                onAction={onAction}
                onTab={setTab}
              />
            )}
            {tab === "system" && (
              <SystemPanel
                project={project}
                onChange={(system, key) => api.edit(project.id, (p) => ({ ...p, system }), { key })}
                onAsk={(text) => {
                  setWholeApp(true);
                  send(`Restyle the design system only (no screen rewrites): ${text}`);
                }}
              />
            )}
            {tab === "chat" && <ChatPanel project={project} busy={working} onSend={(t) => send(t)} />}
            {tab === "review" && (
              <ReviewPanel
                project={project}
                onRun={studio.runReview}
                onGo={(id) => selectScreen(id)}
                onFix={async (issue, i) => {
                  const res = await studio.aiEdit(issue.screenId, issue.fix, { label: `Fix: ${issue.title}` });
                  api.edit(project.id, (p) => ({ ...p, review: p.review && { ...p.review, fixed: [...(p.review.fixed || []), i] } }), { silent: true });
                  if (!res.changed) say("Nothing needed changing for that one");
                }}
                onFixAutomated={async (id, list) => {
                  const res = await studio.aiEdit(id, `Fix these automated findings without changing the design's character:\n${list.slice(0, 12).map((x) => `- ${x.message}${x.text ? ` ("${x.text}")` : ""}`).join("\n")}`, { label: "Fixed automated findings" });
                  api.edit(project.id, (p) => ({ ...p, review: p.review && { ...p.review, audits: { ...p.review.audits, [id]: [] } } }), { silent: true });
                  if (!res.changed) say("Nothing needed changing");
                }}
              />
            )}
            {tab === "history" && (
              <HistoryPanel project={project} screen={selectedScreen} viewport={viewport} onRestore={(v) => restore(selectedScreen.id, v)} onCompare={(v) => setCompare({ screenId: selectedScreen.id, version: v })} />
            )}
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {present && <Present key="present" project={project} startId={present} onClose={() => setPresent(null)} onDesignNext={designNext} />}
        {variations && (
          <Variations
            key="variations"
            project={project}
            screenId={variations}
            viewport={viewport}
            quality={studio.quality}
            onClose={() => setVariations(null)}
            onPick={(html, label) => {
              studio.commitScreen(variations, html, label);
              setVariations(null);
            }}
          />
        )}
        {compare && <Compare key="compare" project={project} screen={screenById(compare.screenId)} version={compare.version} viewport={viewport} onRestore={(v) => restore(compare.screenId, v)} onClose={() => setCompare(null)} />}
        {exporting && <DesignExport key="export" project={project} screen={selectedScreen} onClose={() => setExporting(false)} toast={say} />}
      </AnimatePresence>
    </div>
  );
}

export { withVersion };
