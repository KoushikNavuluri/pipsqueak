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
  MessageSquarePlus,
  Mic,
  MicOff,
  Minus,
  MousePointer2,
  Palette,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Share2,
  Smartphone,
  Undo2,
  UploadCloud,
  Workflow,
  X,
} from "lucide-react";
import { displayName, useSession } from "../session";
import { addComment, anchorFrom, anchorLabel, setResolved } from "../share";
import { CommentsPanel, commentsInstruction, useComments } from "./panels/CommentsPanel";
import { ShareDialog } from "./ShareDialog";
import { NotificationBell } from "../components/NotificationBell";
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
import { extractScreenFlows } from "../design/flow.js";
import { FlowOverlay } from "./FlowOverlay";
import { usePresence } from "./usePresence";
import { RemoteCursors } from "./RemoteCursors";
import { reconstructScreenFromImage } from "../ai/vision.js";
import { generateStyleguideScreen } from "../design/exportDesign.js";
import { useSpeech } from "./useSpeech";

const TABS = [
  ["design", "Design"],
  ["system", "System"],
  ["chat", "Chat"],
  ["review", "Review"],
  ["comments", "Comments"],
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
  const [sharing, setSharing] = useState(null);
  const { user, profile } = useSession();
  const { peers, cursors, broadcastCursor } = usePresence(project.id, user, profile);
  const [showFlows, setShowFlows] = useState(false);
  const flows = useMemo(() => extractScreenFlows(project.screens), [project.screens]);
  const speech = useSpeech((text) => setPrompt((prev) => (prev ? `${prev} ${text}` : text)));
  const fileInputRef = useRef(null);
  const [visionBusy, setVisionBusy] = useState(false);

  const handleImportImage = async (file) => {
    if (!file) return;
    setVisionBusy(true);
    try {
      const reconstructed = await reconstructScreenFromImage(file, project);
      api.edit(project.id, (p) => ({
        ...p,
        screens: [...p.screens, reconstructed],
      }));
      api.toast(`Imported “${reconstructed.name}” with Pip Vision`);
      selectScreen(reconstructed.id);
    } catch (err) {
      api.toast(err.message || "Could not reconstruct screen", { tone: "error" });
    } finally {
      setVisionBusy(false);
    }
  };

  const handleAddStyleguide = () => {
    const styleguide = generateStyleguideScreen(project);
    api.edit(project.id, (p) => ({
      ...p,
      screens: [...p.screens, styleguide],
    }));
    api.toast("Generated Design System styleguide screen");
    selectScreen(styleguide.id);
  };

  // Comments: a draft pinned to a just-clicked element, where each open
  // comment's element is now ({ [screenId]: { [commentId]: { x, y, path, lost } } }),
  // and the one being looked at.
  const [draft, setDraft] = useState(null);
  const [pinPos, setPinPos] = useState({});
  const [focusComment, setFocusComment] = useState(null);
  // Frames whose CSS is cached open as static pages; look it up before mounting them.
  const [cssReady, setCssReady] = useState(false);
  useEffect(() => {
    loadCss(project.screens.map((sc) => sc.html)).finally(() => setCssReady(true));
    // Version history isn't part of the sign-in load; fetch it now.
    api.hydrate(project.id);
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
    if (m.type === "ready") relocate(screenId);
    else if (m.type === "size") relocateAll();
    if ((m.type === "size" || m.type === "ready") && m.h) {
      const h = Math.min(8000, Math.max(viewport.h, Math.ceil(m.h)));
      reportHeight(screenId, h);
      const sc = screenById(screenId);
      if (sc?.html && !studio.streams[screenId]) rememberHeight(viewport.w, sc.html, h);
    } else if (m.type === "select" && tool === "comment") {
      setSelection(m.path ? { screenId, info: m } : { screenId, info: null });
      setDraft({ screenId, info: m.path ? m : null });
      setTab("comments");
    } else if (m.type === "select") {
      setSelection(m.path ? { screenId, info: m } : { screenId, info: null });
      if (tab !== "comments") setTab("design");
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

  // ----- comments -----
  const commentState = useComments(project.id, (msg) => say(msg, "error"));
  const openComments = commentState.comments.filter((c) => !c.resolved_at);
  const openKey = openComments.map((c) => c.id + ":" + c.screen_id).join("|");
  const commentsByScreen = useMemo(() => {
    const m = new Map();
    openComments.forEach((c, i) => m.set(c.screen_id, [...(m.get(c.screen_id) || []), { ...c, n: i + 1 }]));
    return m;
  }, [openKey]);
  // Finds each open comment's element in its frame again (screens change).
  const relocate = async (screenId) => {
    const list = commentsByScreen.get(screenId) || [];
    const frame = studio.frames.current.get(screenId);
    if (!list.length || !frame) return setPinPos((p) => (p[screenId] ? { ...p, [screenId]: undefined } : p));
    const found = (await frame.locate(list.map((c) => c.anchor || {}))) || [];
    const spots = {};
    list.forEach((c, i) => {
      const hit = found[i];
      const r = hit?.rect || c.anchor?.rect;
      spots[c.id] = c.anchor?.tag ? (r ? { x: r.x + r.w, y: r.y, path: hit?.path || c.anchor.path, lost: !hit } : null) : { x: viewport.w - 36, y: 14, path: null };
    });
    setPinPos((p) => ({ ...p, [screenId]: spots }));
  };
  const relocateTimer = useRef(null);
  const relocateAll = () => {
    clearTimeout(relocateTimer.current);
    relocateTimer.current = setTimeout(() => project.screens.forEach((sc) => relocate(sc.id)), 250);
  };
  useEffect(relocateAll, [openKey, viewportKey, mounted]);
  const pinsFor = useMemo(() => {
    const out = {};
    for (const [screenId, list] of commentsByScreen) {
      out[screenId] = list
        .map((c) => {
          const at = pinPos[screenId]?.[c.id];
          return at && { id: c.id, n: c.n, x: at.x, y: at.y, lost: at.lost, focus: focusComment === c.id, title: `${c.author_name}: ${c.body.slice(0, 80)}` };
        })
        .filter(Boolean);
    }
    return out;
  }, [commentsByScreen, pinPos, focusComment]);

  const goToComment = (c) => {
    setFocusComment(c.id);
    const i = project.screens.findIndex((x) => x.id === c.screen_id);
    if (i < 0) return;
    const at = pinPos[c.screen_id]?.[c.id];
    canvas.current?.fit({ x: i * (viewport.w + gap) - 40, y: Math.max(-60, (at?.y || 0) - viewport.h / 2), w: viewport.w + 80, h: viewport.h + 120 }, 48);
    if (tool === "comment") setTool("select");
    const path = at?.path || c.anchor?.path;
    if (path) studio.frames.current.get(c.screen_id)?.post({ type: "select", path, report: true, scroll: true });
    else selectScreen(c.screen_id);
    setTimeout(() => setTab("comments"), 0);
  };
  const onPin = useCallback((id) => {
    const c = commentState.comments.find((x) => x.id === id);
    if (!c) return;
    setTab("comments");
    setFocusComment(id);
    setTimeout(() => document.getElementById(`comment-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 50);
  }, [commentState.comments]);

  const commentTarget = draft
    ? { label: anchorLabel(draft.info, screenById(draft.screenId)?.name), draft: true }
    : selection?.info?.path
      ? { label: anchorLabel(selection.info, selectedScreen?.name) }
      : selectedScreen
        ? { label: `${selectedScreen.name} (whole screen)` }
        : null;
  const postComment = async (body) => {
    const where = draft || selection;
    try {
      const c = await addComment({
        projectId: project.id,
        screenId: where.screenId,
        anchor: where.info ? anchorFrom(where.info) : {},
        body,
        authorName: displayName(user, profile).slice(0, 60),
        authorId: user.id,
      });
      commentState.setComments((list) => (list.some((x) => x.id === c.id) ? list : [...list, c]));
      setDraft(null);
      setFocusComment(c.id);
    } catch (err) {
      say(err.message, "error");
      throw err;
    }
  };
  // Pip reworks each screen with open comments, then resolves the comments on
  // screens it changed.
  const askPipAboutComments = async (list) => {
    const groups = new Map();
    for (const c of list) {
      if (!screenById(c.screen_id)?.html) continue;
      groups.set(c.screen_id, [...(groups.get(c.screen_id) || []), c]);
    }
    if (!groups.size) return;
    setWorking(true);
    try {
      const results = await Promise.all(
        [...groups].map(async ([screenId, cs]) => {
          try {
            // Use where each pin was last found on the canvas, if anywhere.
            const located = cs.map((c) => {
              const at = pinPos[screenId]?.[c.id];
              return at?.path && c.anchor?.tag ? { ...c, anchor: { ...c.anchor, path: at.path } } : c;
            });
            const { done } = await studio.resolveComments(screenId, located, (whole) => commentsInstruction(whole, screenById(screenId).name));
            const ids = new Set(done.map((c) => c.id));
            return { screenId, cs: cs.filter((c) => ids.has(c.id)), changed: done.length > 0, left: cs.length - done.length };
          } catch (err) {
            return { screenId, cs, error: err.message };
          }
        }),
      );
      const done = results.filter((r) => r.changed).flatMap((r) => r.cs);
      if (done.length) {
        await setResolved(done.map((c) => c.id), "Pip");
        const at = new Date().toISOString();
        commentState.setComments((all) => all.map((c) => (done.some((d) => d.id === c.id) ? { ...c, resolved_at: at, resolved_by: "Pip" } : c)));
      }
      const failed = results.filter((r) => r.error);
      const unchanged = results.filter((r) => !r.error && (!r.changed || r.left > 0));
      const summary = [
        done.length ? `Resolved ${done.length} comment${done.length === 1 ? "" : "s"} on ${results.filter((r) => r.changed).map((r) => screenById(r.screenId)?.name).join(", ")}.` : "",
        unchanged.length ? `Some comments on ${unchanged.map((r) => screenById(r.screenId)?.name).join(", ")} needed no change or couldn't be applied; they stay open.` : "",
        failed.length ? `Couldn't finish ${failed.map((r) => screenById(r.screenId)?.name).join(", ")}: ${failed[0].error}` : "",
      ]
        .filter(Boolean)
        .join(" ");
      logChat(list.length === 1 ? `Resolve the comment: “${list[0].body.slice(0, 120)}”` : `Resolve ${list.length} open comments`, summary, null);
      say(done.length ? `Pip resolved ${done.length} of ${list.length}` : failed.length ? failed[0].error : "Pip didn't need to change anything", failed.length && !done.length ? "error" : done.length ? "success" : undefined);
    } finally {
      setWorking(false);
    }
  };

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
        setDraft(null);
        if (tool === "comment") setTool("select");
      } else if (e.key.toLowerCase() === "p" && !present) {
        setPresent(selection?.screenId || project.screens[0]?.id);
      } else if (e.key.toLowerCase() === "v") {
        setTool("select");
      } else if (e.key.toLowerCase() === "h") {
        setTool("hand");
      } else if (e.key.toLowerCase() === "c" && !meta) {
        setTool("comment");
      } else if ((e.key === "Delete" || e.key === "Backspace") && selection?.info?.path && selectedScreen) {
        e.preventDefault();
        studio.commitScreen(selection.screenId, removeAt(selectedScreen.html, selection.info.path), "Deleted element");
        setSelection({ screenId: selection.screenId, info: null });
      } else if (e.key.toLowerCase() === "f") {
        setShowFlows((v) => !v);
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
        {peers.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-2 pr-2.5 text-xs font-medium">
            <div className="flex -space-x-1.5">
              {peers.slice(0, 3).map((p, idx) => (
                <span
                  key={p.userId || idx}
                  title={`${p.name} (live)`}
                  style={{ borderColor: p.color, backgroundColor: p.color }}
                  className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border-2 text-[9px] font-bold uppercase text-white shadow-sm"
                >
                  {p.avatar ? <img src={p.avatar} alt="" className="h-full w-full object-cover" /> : p.name.charAt(0)}
                </span>
              ))}
            </div>
            <span className="text-[11px] font-medium text-ink-2">{peers.length} active</span>
          </div>
        )}
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
          <IconButton icon={Smartphone} label="Preview on your phone" title="Preview on your phone" onClick={() => setSharing("phone")} iconSize={16} />
          <Button variant="secondary" size="sm" icon={Share2} aria-label="Share" onClick={() => setSharing("link")}>
            <span className="hidden sm:inline">Share</span>
          </Button>
          <NotificationBell />
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
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportImage(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={visionBusy || working}
            className="mx-2 mt-2 flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-3 py-2 text-sm text-mute transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
          >
            {visionBusy ? <LoaderCircle size={14} className="animate-spin" /> : <UploadCloud size={14} />} Import mockup
          </button>
          <button
            onClick={handleAddStyleguide}
            disabled={working}
            className="mx-2 mt-2 flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-3 py-2 text-sm text-mute transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
          >
            <Palette size={14} /> Styleguide screen
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

        <main
          className="relative min-w-0 flex-1 overflow-hidden"
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const v = canvas.current?.view();
            if (v) {
              const cx = (e.clientX - rect.left - v.x) / v.z;
              const cy = (e.clientY - rect.top - v.y) / v.z;
              broadcastCursor(cx, cy, selection?.screenId || null);
            }
          }}
        >
          <Canvas ref={canvas} tool={tool} onBackgroundClick={() => setSelection(null)}>
            {(view) => (
              <>
                {cssReady &&
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
                        mode={tool === "hand" ? "view" : tool === "comment" ? "comment" : "edit"}
                        pins={pinsFor[sc.id]}
                        onPin={onPin}
                        streaming={studio.streams[sc.id] ?? null}
                        busy={studio.busy[sc.id]}
                        issues={(project.review?.audits?.[sc.id] || []).length}
                        onSelect={stableSelect}
                        onMessage={callbacksFor(sc.id).message}
                        onAction={stableAction}
                        onRename={setRenaming}
                      />
                    </div>
                  ))}
                {showFlows && <FlowOverlay flows={flows} placed={placed} onSelectScreen={selectScreen} />}
                <RemoteCursors cursors={cursors} />
              </>
            )}
          </Canvas>

          <div className="absolute left-4 top-4 flex items-center gap-0.5 rounded-full border border-line bg-surface/90 p-1 shadow-soft backdrop-blur">
            {[
              ["select", MousePointer2, "Select (V)"],
              ["hand", Hand, "Pan (H or hold Space)"],
              ["comment", MessageSquarePlus, "Comment (C)"],
            ].map(([k, Icon, label]) => (
              <button key={k} onClick={() => setTool(k)} aria-label={label} title={label} className={cx("flex h-8 w-8 items-center justify-center rounded-full transition-colors", tool === k ? "bg-ink text-white" : "text-ink-2 hover:bg-sunken")}>
                <Icon size={15} />
              </button>
            ))}
            <button
              onClick={() => setShowFlows((v) => !v)}
              aria-label="Toggle screen flows (F)"
              title={`Screen Flows (${flows.length} links)`}
              className={cx("flex h-8 w-8 items-center justify-center rounded-full transition-colors", showFlows ? "bg-accent text-white" : "text-ink-2 hover:bg-sunken")}
            >
              <Workflow size={15} />
            </button>
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
                  placeholder={
                    speech.listening
                      ? "Listening to your voice… speak to Pip"
                      : working
                      ? "Pip is on it…"
                      : focusLabel && !wholeApp
                      ? `Ask Pip to change ${focusLabel}…`
                      : "Ask Pip for any change across the app…"
                  }
                  aria-label="Ask Pip"
                  className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-faint"
                />
                {speech.supported && (
                  <button
                    type="button"
                    onClick={speech.toggle}
                    aria-label={speech.listening ? "Stop voice input" : "Voice prompt Pip"}
                    title={speech.listening ? "Listening... click to stop" : "Speak to Pip"}
                    className={cx(
                      "mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all",
                      speech.listening
                        ? "animate-pulse bg-accent text-white shadow-md ring-4 ring-accent/25"
                        : "text-mute hover:bg-sunken hover:text-ink"
                    )}
                  >
                    <Mic size={15} />
                  </button>
                )}
                <button type="submit" disabled={working || !prompt.trim()} aria-label="Send" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-[background-color,transform,opacity] hover:bg-ink-2 active:scale-95 disabled:opacity-25">
                  {working ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowUp size={17} strokeWidth={2.4} />}
                </button>
              </div>
            </form>
          </div>
        </main>

        <aside className="hidden w-[340px] shrink-0 flex-col border-l border-line bg-white lg:flex" aria-label="Inspector">
          <div className="flex shrink-0 justify-between border-b border-line px-1.5">
            {TABS.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} aria-label={k === "comments" ? `Comments (${openComments.length} open)` : undefined} title={k === "comments" ? "Comments" : undefined} className={cx("relative shrink-0 px-[6px] py-3 text-[13px] font-semibold", tab === k ? "text-ink" : "text-faint hover:text-ink")}>
                {k === "comments" ? (
                  <span className="inline-flex items-center gap-1">
                    <MessageSquarePlus size={14} />
                    {openComments.length > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] leading-4 text-white">{openComments.length}</span>}
                  </span>
                ) : (
                  label
                )}
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
            {tab === "comments" && (
              <CommentsPanel
                project={project}
                state={commentState}
                target={commentTarget}
                focusId={focusComment}
                onPost={postComment}
                onCancelDraft={() => setDraft(null)}
                onGo={goToComment}
                onAskPip={askPipAboutComments}
                onToast={say}
              />
            )}
            {tab === "history" && (
              <HistoryPanel project={project} loaded={!!s.loaded[project.id]} screen={selectedScreen} viewport={viewport} onRestore={(v) => restore(selectedScreen.id, v)} onCompare={(v) => setCompare({ screenId: selectedScreen.id, version: v })} />
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
        {sharing && <ShareDialog key="share" project={project} initial={sharing} flush={api.flush} toast={say} onClose={() => setSharing(null)} />}
        {exporting && <DesignExport key="export" project={project} screen={selectedScreen} onClose={() => setExporting(false)} toast={say} />}
      </AnimatePresence>
    </div>
  );
}

export { withVersion };
