import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { useSession } from "../session";
import { uid } from "../util";
import { applyShell, copilotPlan, critique, editScreen, extractShell, matchTheApp, paintKitImage, writeScreen } from "../design/engine.js";
import { elementAt, replaceAt } from "../design/htmlTools.js";
import { patchSystem } from "../design/system.js";
import { PATTERNS } from "../design/patterns.js";

const MAX_VERSIONS = 24;
const PARALLEL_SCREENS = 4;
const PARALLEL_IMAGES = 2;

// The spec the engine sees: product facts plus the live list of screens.
export function specOf(p) {
  return {
    ...p.spec,
    screens: p.screens.map(({ id, name, type, pattern, purpose, content, primaryAction, inNav }) => ({ id, name, type, pattern, purpose, content, primaryAction, inNav })),
  };
}

const squash = (h) => String(h || "").replace(/\s+/g, " ").trim();

// Other finished screens of the project, the navigation-owning one first.
function siblings(p, screenId) {
  return p.screens
    .filter((sc) => sc.id !== screenId && sc.html && sc.status === "ready")
    .sort((a, b) => (b.id === p.shellSourceId) - (a.id === p.shellSourceId))
    .map((sc) => ({ name: sc.name, html: sc.html }));
}

// The screen a new one takes its look from; none for the very first screen.
export const styleReference = (p, screenId) => siblings(p, screenId)[0];

// A screen with new HTML, keeping the old HTML as a restorable version.
export function withVersion(sc, html, label, extra = {}) {
  const versions = sc.html
    ? [{ id: uid(), html: sc.html, label: sc.changeLabel || "First draft", at: sc.changedAt || Date.now() }, ...(sc.versions || [])].slice(0, MAX_VERSIONS)
    : sc.versions || [];
  return { ...sc, ...extra, html, status: "ready", changeLabel: label, changedAt: Date.now(), versions };
}

export function useStudio(project) {
  const { s, api } = useStore();
  const { user } = useSession();
  const quality = s.data.prefs.aiQuality || "fast";
  const projRef = useRef(project);
  projRef.current = project;
  const [streams, setStreams] = useState({});
  const [busy, setBusy] = useState({});
  const started = useRef(new Set());
  const painting = useRef(new Set());
  const aborts = useRef(new Map());
  const frames = useRef(new Map());

  useEffect(
    () => () => {
      for (const c of aborts.current.values()) {
        c.abort();
      }
    },
    [],
  );

  const edit = useCallback((fn, opts = {}) => api.edit(project.id, fn, opts), [api, project.id]);

  // Copilot replies still "thinking" when the studio opens were cut off by a
  // reload or crash: nothing from an earlier session is still running.
  useEffect(() => {
    if ((project.chat || []).some((m) => m.status === "thinking" || m.status === "working")) {
      edit(
        (p) => ({
          ...p,
          chat: p.chat.map((m) =>
            m.status === "thinking" || m.status === "working"
              ? { ...m, status: "error", text: m.text || "This was interrupted before it finished.", ops: (m.ops || []).filter((o) => o.done) }
              : m,
          ),
        }),
        { silent: true },
      );
    }
  }, []);
  const setBusyFor = (id, v) => setBusy((b) => ({ ...b, [id]: v }));
  const setStream = (id, h) => setStreams((st) => ({ ...st, [id]: h }));
  const clearStream = (id) =>
    setStreams((st) => {
      const n = { ...st };
      delete n[id];
      return n;
    });

  const commitScreen = useCallback(
    (screenId, html, label, { silent = false, extra = {} } = {}) =>
      edit((p) => ({ ...p, screens: p.screens.map((sc) => (sc.id === screenId ? withVersion(sc, html, label, extra) : sc)) }), silent ? { silent: true } : {}),
    [edit],
  );

  // Writes (or rewrites) one screen, streaming it into its frame. Every screen
  // but the first is written against an approved one, so the app keeps one look.
  const generate = useCallback(
    async (screenId, { instruction, ownLook = false, label = "Generated", silent = false } = {}) => {
      const p = projRef.current;
      const screen = p.screens.find((x) => x.id === screenId);
      if (!screen) {
        return;
      }
      aborts.current.get(screenId)?.abort();
      const ctrl = new AbortController();
      aborts.current.set(screenId, ctrl);
      setBusyFor(screenId, instruction ? "Redesigning" : "Designing");
      setStream(screenId, "");
      try {
        const useShell = p.shell && screenId !== p.shellSourceId ? p.shell : null;
        let { html, findings } = await writeScreen({
          spec: specOf(p),
          system: p.system,
          screen,
          kit: p.kit,
          shell: useShell,
          reference: styleReference(p, screenId),
          first: screenId === p.shellSourceId,
          ownLook,
          instruction,
          quality,
          signal: ctrl.signal,
          onHtml: (h) => setStream(screenId, h),
        });
        // A screen that came out in a different look is reworked to match the
        // others right away, rather than left for the user to notice.
        const off = findings.find((f) => f.kind === "off-theme");
        if (off) {
          setBusyFor(screenId, "Matching the app");
          try {
            const fixed = await editScreen({
              spec: specOf(p),
              system: p.system,
              screen,
              html,
              references: siblings(projRef.current, screenId),
              instruction: matchTheApp(off.want),
              quality,
              signal: ctrl.signal,
              onHtml: (h) => setStream(screenId, h),
            });
            html = useShell ? applyShell(fixed.html, useShell, screenId) : fixed.html;
            findings = findings.filter((f) => f !== off);
          } catch (err) {
            if (err.name === "AbortError") throw err;
          }
        }
        commitScreen(screenId, html, label, { silent, extra: { findings } });
        if (!projRef.current.shell && screenId === projRef.current.shellSourceId) {
          const shell = extractShell(html);
          if (shell) {
            edit((x) => ({ ...x, shell }), { silent: true });
          }
        }
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        edit((x) => ({ ...x, screens: x.screens.map((sc) => (sc.id === screenId && !sc.html ? { ...sc, status: "error" } : sc)) }), { silent: true });
        api.toast(err.message || "That screen didn't come together", { tone: "error" });
      } finally {
        started.current.delete(screenId);
        clearStream(screenId);
        setBusyFor(screenId, null);
      }
    },
    [api, commitScreen, edit, quality],
  );

  // Build queue: the navigation-owning screen first, then the rest in parallel.
  useEffect(() => {
    const pending = project.screens.filter((sc) => sc.status === "pending" && !started.current.has(sc.id));
    if (!pending.length) {
      return;
    }
    const source = project.screens.find((sc) => sc.id === project.shellSourceId);
    if (!project.shell && source && !source.html) {
      if (!started.current.has(source.id) && source.status === "pending") {
        started.current.add(source.id);
        generate(source.id, { silent: true, label: "First draft" });
      }
      return;
    }
    const room = PARALLEL_SCREENS - started.current.size;
    for (const sc of pending.slice(0, Math.max(0, room))) {
      started.current.add(sc.id);
      generate(sc.id, { silent: true, label: "First draft" });
    }
  }, [project.screens, project.shell, project.shellSourceId, generate]);

  // Image kit: paint pending images in the background.
  useEffect(() => {
    const kit = project.kit || [];
    const pending = kit.map((k, i) => [k, i]).filter(([k, i]) => k.status === "pending" && !painting.current.has(i));
    const room = PARALLEL_IMAGES - painting.current.size;
    for (const [item, index] of pending.slice(0, Math.max(0, room))) {
      painting.current.add(index);
      paintKitImage({ userId: user.id, projectId: project.id, item, system: project.system, name: project.name })
        .then((url) => edit((p) => ({ ...p, kit: p.kit.map((k, i) => (i === index ? { ...k, url, status: "done" } : k)) }), { silent: true }))
        .catch((err) => {
          console.error("Painting failed", err);
          edit((p) => ({ ...p, kit: p.kit.map((k, i) => (i === index ? { ...k, status: "failed" } : k)) }), { silent: true });
        })
        .finally(() => painting.current.delete(index));
    }
  }, [project.kit, project.id, project.name, project.system, user.id, edit]);

  // An AI edit of a whole screen, or of one element when a path is given.
  const aiEdit = useCallback(
    async (screenId, instruction, { path = null, label } = {}) => {
      const p = projRef.current;
      const screen = p.screens.find((x) => x.id === screenId);
      if (!screen?.html) {
        return { changed: false };
      }
      const selected = path ? elementAt(screen.html, path) : null;
      const ctrl = new AbortController();
      aborts.current.set(screenId, ctrl);
      setBusyFor(screenId, path ? "Editing section" : "Editing");
      try {
        const { html: out } = await editScreen({
          spec: specOf(p),
          system: p.system,
          screen,
          html: screen.html,
          selected,
          references: siblings(p, screenId),
          instruction,
          quality,
          signal: ctrl.signal,
          onHtml: path ? null : (h) => setStream(screenId, h),
        });
        let next = selected ? replaceAt(screen.html, path, out) : out;
        if (p.shell) {
          next = applyShell(next, p.shell, screenId);
        }
        if (squash(next) === squash(screen.html)) {
          return { changed: false };
        }
        commitScreen(screenId, next, label || instruction.slice(0, 60));
        return { changed: true };
      } finally {
        clearStream(screenId);
        setBusyFor(screenId, null);
      }
    },
    [commitScreen, quality],
  );

  // The copilot: plan the change, then carry the plan out.
  const runCopilot = useCallback(
    async (text, focus) => {
      const p = projRef.current;
      const userMsg = { id: uid(), role: "user", text, focus: focus?.label || null, at: Date.now() };
      const replyId = uid();
      const saveChat = (fn) => edit((x) => ({ ...x, chat: fn(x.chat || []).slice(-60) }), { silent: true });
      saveChat((c) => [...c, userMsg, { id: replyId, role: "ai", status: "thinking", text: "", ops: [], at: Date.now() }]);
      const update = (patch) => saveChat((c) => c.map((m) => (m.id === replyId ? { ...m, ...patch } : m)));
      try {
        const plan = await copilotPlan({
          spec: specOf(p),
          system: p.system,
          screens: p.screens,
          instruction: text,
          focus: focus?.describe,
          history: (p.chat || []).slice(-8).map((m) => ({ role: m.role, text: m.text })),
        });
        const ops = [];
        update({ text: plan?.reply || "", status: "working" });
        if (plan?.system && Object.keys(plan.system).length) {
          edit((x) => ({ ...x, system: patchSystem(x.system, plan.system) }));
          ops.push({ kind: "system", label: "Restyled the design system", done: true });
        }
        const removing = (plan?.removeScreenIds || []).filter((id) => p.screens.some((sc) => sc.id === id));
        if (removing.length) {
          edit((x) => ({ ...x, screens: x.screens.filter((sc) => !removing.includes(sc.id) || x.screens.length <= 1) }));
          ops.push({ kind: "remove", label: `Removed ${removing.length} screen${removing.length > 1 ? "s" : ""}`, done: true });
        }
        const adding = (plan?.newScreens || []).slice(0, 4).map((n) => {
          let id = String(n.id || n.name || "screen").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "screen";
          while (p.screens.some((sc) => sc.id === id)) {
            id += "-2";
          }
          return {
            id,
            name: String(n.name || id).slice(0, 24),
            type: n.type || "other",
            pattern: PATTERNS[n.pattern] ? n.pattern : null,
            purpose: String(n.purpose || ""),
            content: String(n.content || ""),
            primaryAction: String(n.primaryAction || ""),
            inNav: false,
            html: "",
            status: "pending",
            versions: [],
          };
        });
        if (adding.length) {
          edit((x) => ({ ...x, screens: [...x.screens, ...adding] }));
          ops.push(...adding.map((a) => ({ kind: "add", label: `Designing ${a.name}`, screenId: a.id, done: false })));
        }
        const edits = (plan?.screenEdits || []).filter((e) => p.screens.some((sc) => sc.id === e.screenId)).slice(0, 6);
        ops.push(...edits.map((e) => ({ kind: "edit", label: `Reworking ${p.screens.find((sc) => sc.id === e.screenId).name}`, screenId: e.screenId, done: false })));
        update({ ops: [...ops] });
        await Promise.all(
          edits.map(async (e) => {
            let result;
            try {
              result = await aiEdit(e.screenId, e.instruction, { label: text.slice(0, 60) });
            } catch (err) {
              result = { changed: false, error: err.message };
            }
            const op = ops.find((o) => o.kind === "edit" && o.screenId === e.screenId);
            op.done = true;
            op.label = result.changed ? op.label.replace("Reworking", "Reworked") : `${op.label.replace("Reworking ", "")}: ${result.error || "no change needed"}`;
            update({ ops: [...ops] });
          }),
        );
        update({ status: "done", ops: ops.map((o) => (o.kind === "add" ? { ...o, label: o.label.replace("Designing", "Added"), done: true } : o)), suggestions: (plan?.suggestions || []).slice(0, 3) });
      } catch (err) {
        update({ status: "error", text: err.message || "That didn't work. Try again." });
      }
    },
    [aiEdit, edit],
  );

  // Design review: rendered audits, lint findings and a critique.
  const runReview = useCallback(async () => {
    const p = projRef.current;
    const audits = {};
    await Promise.all(
      p.screens.map(async (sc) => {
        const result = await frames.current.get(sc.id)?.audit?.();
        audits[sc.id] = result?.issues || [];
      }),
    );
    const lines = p.screens.flatMap((sc) => [
      ...(audits[sc.id] || []).slice(0, 8).map((i) => `${sc.id}: ${i.message}${i.text ? ` ("${i.text}")` : ""}`),
      ...(sc.findings || []).map((f) => `${sc.id}: ${f.message}`),
    ]);
    const result = await critique({ spec: specOf(p), system: p.system, screens: p.screens.filter((sc) => sc.html), findings: lines.slice(0, 40).join("\n") });
    edit((x) => ({ ...x, review: { ...result, audits, at: new Date().toISOString(), fixed: [] } }), { silent: true });
    return result;
  }, [edit]);

  const regenerate = useCallback((screenId, note) => generate(screenId, { instruction: note || "A fresh take on this screen: same job and content, a different composition.", ownLook: !!note, label: note ? `Regenerated: ${note.slice(0, 40)}` : "Regenerated" }), [generate]);

  return { quality, streams, busy, frames, commitScreen, generate, regenerate, aiEdit, runCopilot, runReview, edit };
}
