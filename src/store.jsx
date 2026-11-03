import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { uid } from "./util";
import { fetchProject, fetchRevs, fetchVersions, planSave, saveCloud, saveProject, withRemoteVersions } from "./cloud";

export const DEFAULT_PREFS = {
  reduce: false,
  aiQuality: "fast",
  designPlatform: "mobile",
};

// Older versions of the app seeded every new account with these sample
// projects. They aren't the user's work, so they're dropped on load.
const SEEDED_PROMPTS = new Set([
  "Food app for biryani and tiffin delivery in Hyderabad",
  "Split UPI bills and track your monthly budget",
  "Weekend trips planner from Hyderabad",
]);

export function cleanData(data) {
  return {
    activeId: data.activeId ?? null,
    projects: (data.projects || []).filter((p) => !(p.kind !== "canvas" && SEEDED_PROMPTS.has(p.prompt))),
    prefs: Object.fromEntries(Object.keys(DEFAULT_PREFS).map((k) => [k, data.prefs?.[k] ?? DEFAULT_PREFS[k]])),
  };
}

export const emptyData = () => ({ projects: [], activeId: null, prefs: { ...DEFAULT_PREFS } });

export const initial = (data) => ({
  data,
  view: "home",
  gen: null,
  toasts: [],
  hist: {},
  lastEdit: null,
  trash: null,
  // Designs whose version history has been loaded (see cloud.js).
  loaded: {},
  // Saving problems by design id: "changed" or "deleted" (saved elsewhere
  // while this copy had unsaved changes) or "stale" (the open design changed
  // elsewhere; this copy has nothing unsaved).
  conflicts: {},
});

// A design with its history merged in counts as the copy it came from when
// nothing new was added locally, so opening a design doesn't trigger a save.
const hydratedFrom = new WeakMap();
export const sameAsSaved = (saved, current) => hydratedFrom.get(current) === saved;

const without = (obj, key) => {
  if (!(key in obj)) return obj;
  const next = { ...obj };
  delete next[key];
  return next;
};

// Conversation, review, the star, generated images and the shared shell
// change only through silent edits, so they aren't in undo history: undo and
// redo restore the design and keep these as they are.
const keepMeta = (snapshot, current) => ({
  ...snapshot,
  chat: current.chat,
  review: current.review,
  fav: current.fav,
  kit: current.kit,
  shell: current.shell,
});

export function reducer(state, action) {
  const data = (patch) => ({ ...state, data: { ...state.data, ...patch } });
  switch (action.t) {
    case "VIEW":
      return { ...state, view: action.view };
    case "GEN_START":
      return { ...state, gen: action.request };
    case "GEN_CANCEL":
      return { ...state, gen: null };
    case "ADD":
      return { ...data({ projects: [action.project, ...state.data.projects], activeId: action.project.id }), gen: null, view: "studio" };
    case "OPEN":
      return { ...data({ activeId: action.id }), view: "studio" };
    case "TOAST":
      return { ...state, toasts: [...state.toasts, action.toast].slice(-3) };
    case "DISMISS":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case "PREF":
      return data({ prefs: { ...state.data.prefs, ...action.patch } });
    case "EDIT": {
      const current = state.data.projects.find((p) => p.id === action.id);
      if (!current) return state;
      const next = action.fn(current);
      if (next === current) return state;
      const projects = state.data.projects.map((p) => (p.id === action.id ? next : p));
      if (action.silent) return data({ projects });
      const h = state.hist[action.id] || { past: [], future: [] };
      const now = Date.now();
      // Rapid edits with the same key (typing a name, dragging a slider) undo as one.
      const merge = action.key && state.lastEdit?.key === action.key && now - state.lastEdit.t < 900;
      return {
        ...data({ projects }),
        hist: { ...state.hist, [action.id]: { past: merge ? h.past : [...h.past, current].slice(-50), future: [] } },
        lastEdit: { key: action.key, t: now },
      };
    }
    case "UNDO": {
      const h = state.hist[action.id];
      if (!h?.past.length) return state;
      const current = state.data.projects.find((p) => p.id === action.id);
      if (!current) return state;
      const prev = h.past[h.past.length - 1];
      return {
        ...data({ projects: state.data.projects.map((p) => (p.id === action.id ? keepMeta(prev, current) : p)) }),
        hist: { ...state.hist, [action.id]: { past: h.past.slice(0, -1), future: [current, ...h.future] } },
        lastEdit: null,
      };
    }
    case "REDO": {
      const h = state.hist[action.id];
      if (!h?.future.length) return state;
      const current = state.data.projects.find((p) => p.id === action.id);
      if (!current) return state;
      const next = h.future[0];
      return {
        ...data({ projects: state.data.projects.map((p) => (p.id === action.id ? keepMeta(next, current) : p)) }),
        hist: { ...state.hist, [action.id]: { past: [...h.past, current], future: h.future.slice(1) } },
        lastEdit: null,
      };
    }
    case "DELETE": {
      const idx = state.data.projects.findIndex((p) => p.id === action.id);
      if (idx < 0) return state;
      const wasActive = state.data.activeId === action.id;
      return {
        ...data({ projects: state.data.projects.filter((p) => p.id !== action.id), activeId: wasActive ? null : state.data.activeId }),
        view: wasActive ? "home" : state.view,
        trash: { project: state.data.projects[idx], idx },
      };
    }
    case "RESTORE": {
      if (!state.trash) return state;
      const projects = state.data.projects.slice();
      projects.splice(Math.min(state.trash.idx, projects.length), 0, state.trash.project);
      return { ...data({ projects }), trash: null };
    }
    case "IMPORT":
      return data({ projects: [...action.projects, ...state.data.projects] });
    case "HYDRATE": {
      // Remote history arrived. `base` is the copy that was just saved along
      // with it; otherwise this is clean only if no version is local-only.
      const current = state.data.projects.find((p) => p.id === action.id);
      if (!current) return { ...state, loaded: { ...state.loaded, [action.id]: true } };
      const merged = withRemoteVersions(current, action.remote);
      const remote = action.remote || {};
      const localOnly = current.screens.some((sc) => (sc.versions || []).some((v) => !(remote[sc.id] || []).some((r) => r.id === v.id)));
      if (action.base ? current === action.base : !localOnly) hydratedFrom.set(merged, current);
      return {
        ...data({ projects: state.data.projects.map((p) => (p.id === action.id ? merged : p)) }),
        loaded: { ...state.loaded, [action.id]: true },
      };
    }
    case "REPLACE":
      // The saved copy wins. Its undo history no longer applies.
      return {
        ...data({ projects: state.data.projects.map((p) => (p.id === action.project.id ? action.project : p)) }),
        hist: without(state.hist, action.project.id),
        conflicts: without(state.conflicts, action.project.id),
      };
    case "ADD_REMOTE":
      return data({ projects: [...state.data.projects, ...action.projects.filter((p) => !state.data.projects.some((x) => x.id === p.id))] });
    case "REMOVE_LOCAL": {
      const wasActive = state.data.activeId === action.id;
      return {
        ...data({ projects: state.data.projects.filter((p) => p.id !== action.id), activeId: wasActive ? null : state.data.activeId }),
        view: wasActive ? "home" : state.view,
        hist: without(state.hist, action.id),
        conflicts: without(state.conflicts, action.id),
      };
    }
    case "CONFLICTS": {
      let conflicts = state.conflicts;
      for (const [id, kind] of Object.entries(action.patch)) conflicts = kind ? { ...conflicts, [id]: kind } : without(conflicts, id);
      return conflicts === state.conflicts ? state : { ...state, conflicts };
    }
    default:
      return state;
  }
}

const StoreContext = createContext(null);

// `cloud.data` is what the user starts with; `cloud.saved` is what Supabase
// already holds (null when nothing has been saved yet), with `cloud.revs`
// (saved revision by design id) and `cloud.legacy` (designs whose history is
// still inside `data`). Changes are written back about half a second after
// they stop. Designs changed in another tab or on another device are picked
// up when this tab comes back into focus.
export function StoreProvider({ children, userId, cloud }) {
  const [state, dispatch] = useReducer(reducer, cloud.data, initial);
  const latest = useRef(state);
  latest.current = state;
  const saved = useRef(cloud.saved);
  const saving = useRef(null);
  const failing = useRef(false);
  // Bumped by every completed save, so a refresh that overlapped one is dropped.
  const saveSeq = useRef(0);
  // Designs not to save until the user settles a conflict.
  const blocked = useRef(new Set());
  const dismissed = useRef(new Map());
  const hydrating = useRef(new Set());
  const ctx = useRef(null);
  if (!ctx.current) {
    ctx.current = {
      revs: new Map(Object.entries(cloud.revs || {})),
      hydrated: new Set(),
      legacy: new Set(cloud.legacy || []),
      onRemoteVersions: (id, base, remote) => dispatch({ t: "HYDRATE", id, remote, base }),
    };
  }
  const channel = useRef(null);

  const toast = useCallback((text, { tone, action, ms } = {}) => {
    const id = uid();
    dispatch({ t: "TOAST", toast: { id, text, tone, action } });
    setTimeout(() => dispatch({ t: "DISMISS", id }), ms || (action ? 5000 : 3200));
  }, []);

  const savedEntry = (id) => saved.current?.projects.find((p) => p.id === id);
  const setSavedEntry = (id, project) => {
    const base = saved.current || { projects: [], prefs: latest.current.data.prefs, activeId: latest.current.data.activeId };
    const rest = base.projects.filter((p) => p.id !== id);
    saved.current = { ...base, projects: project ? [...rest, project] : rest };
  };
  // Nothing unsaved in this copy of a design.
  const isClean = (id, current) => {
    const s = savedEntry(id);
    return !!s && (s === current || sameAsSaved(s, current));
  };
  const conflict = (id, kind) => {
    if (kind === "changed" || kind === "deleted") blocked.current.add(id);
    else blocked.current.delete(id);
    dispatch({ t: "CONFLICTS", patch: { [id]: kind } });
  };

  const sync = useCallback(() => {
    if (saving.current) return saving.current;
    const run = async () => {
      try {
        for (;;) {
          const next = latest.current.data;
          const plan = planSave(saved.current, next, blocked.current, sameAsSaved);
          if (plan.adopted.length && saved.current) {
            const adopted = new Map(plan.adopted.map((p) => [p.id, p]));
            saved.current = { ...saved.current, projects: saved.current.projects.map((p) => adopted.get(p.id) || p) };
          }
          if (plan.empty) break;
          const conflicts = await saveCloud(userId, plan, next, ctx.current);
          // What's saved now is `next`, except designs that hit a conflict
          // (or were already blocked): they keep their last saved copy.
          const skip = new Set([...blocked.current, ...conflicts.keys()]);
          const prevById = new Map((saved.current?.projects || []).map((p) => [p.id, p]));
          const projects = next.projects.flatMap((p) => (skip.has(p.id) ? (prevById.has(p.id) ? [prevById.get(p.id)] : []) : [p]));
          for (const [id, p] of prevById) if (skip.has(id) && !next.projects.some((x) => x.id === id)) projects.push(p);
          saved.current = { ...next, projects };
          saveSeq.current += 1;
          for (const [id, kind] of conflicts) conflict(id, kind);
          channel.current?.postMessage("saved");
        }
        failing.current = false;
      } catch (err) {
        console.error("Saving failed", err);
        if (!failing.current) {
          failing.current = true;
          toast("Couldn't save your changes. Retrying…", { tone: "error", ms: 4000 });
        }
        setTimeout(() => sync(), 5000);
      }
    };
    saving.current = run().finally(() => {
      saving.current = null;
    });
    return saving.current;
  }, [userId, toast]);

  useEffect(() => {
    const h = setTimeout(sync, 600);
    return () => clearTimeout(h);
  }, [state.data, sync]);

  useEffect(() => {
    const before = (e) => {
      if (!planSave(saved.current, latest.current.data, new Set(), sameAsSaved).empty) {
        sync();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [sync]);

  // Takes the saved copy of a design as the one to show and keep.
  const adoptRemote = (id, remote) => {
    if (!remote) {
      ctx.current.revs.delete(id);
      ctx.current.hydrated.delete(id);
      setSavedEntry(id, null);
      dispatch({ t: "REMOVE_LOCAL", id });
      return;
    }
    ctx.current.revs.set(id, remote.rev);
    if ((remote.project.screens || []).some((sc) => sc.versions?.length) && !ctx.current.hydrated.has(id)) ctx.current.legacy.add(id);
    setSavedEntry(id, remote.project);
    if (latest.current.data.projects.some((p) => p.id === id)) dispatch({ t: "REPLACE", project: remote.project });
    else dispatch({ t: "ADD_REMOTE", projects: [remote.project] });
  };

  // Picks up changes saved by other tabs and devices.
  const refreshing = useRef(false);
  const lastRefresh = useRef(0);
  const refresh = useCallback(async ({ force = false } = {}) => {
    if (refreshing.current || saving.current || document.visibilityState === "hidden") return;
    if (!force && Date.now() - lastRefresh.current < 5000) return;
    refreshing.current = true;
    lastRefresh.current = Date.now();
    const seq = saveSeq.current;
    const stillValid = () => seq === saveSeq.current && !saving.current;
    try {
      const remote = await fetchRevs();
      if (!stillValid()) return;
      const st = latest.current;
      const local = new Map(st.data.projects.map((p) => [p.id, p]));
      for (const [id, rev] of remote) {
        const known = ctx.current.revs.get(id);
        if (known === undefined) {
          // A design made elsewhere (one of ours that isn't saved yet has no rev
          // and isn't in `remote`).
          if (!local.has(id) && st.trash?.project?.id !== id) {
            const got = await fetchProject(id);
            if (got && stillValid() && !ctx.current.revs.has(id)) adoptRemote(id, got);
          }
          continue;
        }
        if (rev <= known || blocked.current.has(id) || !local.has(id)) continue;
        if (!isClean(id, local.get(id))) {
          conflict(id, "changed");
        } else if (st.view === "studio" && st.data.activeId === id) {
          // Don't swap the open design under the user; offer it instead.
          if (dismissed.current.get(id) !== rev) conflict(id, "stale");
        } else {
          const got = await fetchProject(id, { withVersions: ctx.current.hydrated.has(id) });
          if (stillValid() && latest.current.data.projects.find((p) => p.id === id) === local.get(id)) adoptRemote(id, got);
        }
      }
      for (const id of [...ctx.current.revs.keys()]) {
        if (remote.has(id) || !local.has(id) || blocked.current.has(id)) continue;
        if (isClean(id, local.get(id)) && !(st.view === "studio" && st.data.activeId === id)) adoptRemote(id, null);
        else conflict(id, "deleted");
      }
    } catch (err) {
      console.warn("Checking for changes failed", err);
    } finally {
      refreshing.current = false;
    }
  }, []);

  useEffect(() => {
    const onFocus = () => refresh();
    const onVisible = () => document.visibilityState === "visible" && refresh();
    addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => refresh(), 60000);
    let bc = null;
    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel(`pipsqueak:${userId}`);
      bc.onmessage = () => setTimeout(() => refresh({ force: true }), 300);
      channel.current = bc;
    }
    return () => {
      removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
      bc?.close();
      channel.current = null;
    };
  }, [refresh, userId]);

  const api = useMemo(
    () => ({
      toast,
      home: () => dispatch({ t: "VIEW", view: "home" }),
      open: (id) => dispatch({ t: "OPEN", id }),
      startGen: (request) => dispatch({ t: "GEN_START", request }),
      cancelGen: () => dispatch({ t: "GEN_CANCEL" }),
      add: (project) => dispatch({ t: "ADD", project }),
      edit: (id, fn, opts = {}) => dispatch({ t: "EDIT", id, fn, ...opts }),
      undo: (id) => dispatch({ t: "UNDO", id }),
      redo: (id) => dispatch({ t: "REDO", id }),
      del: (id) => {
        dispatch({ t: "DELETE", id });
        toast("Design deleted", { action: { label: "Undo", run: () => dispatch({ t: "RESTORE" }) } });
      },
      dup: (id) => {
        const p = latest.current.data.projects.find((x) => x.id === id);
        if (!p) return;
        const copy = { ...JSON.parse(JSON.stringify(p)), id: uid(), name: `${p.name} copy`, created: Date.now(), fav: false };
        dispatch({ t: "ADD", project: copy });
        toast("Duplicated", { tone: "success" });
      },
      fav: (id) => dispatch({ t: "EDIT", id, silent: true, fn: (p) => ({ ...p, fav: !p.fav }) }),
      pref: (patch) => dispatch({ t: "PREF", patch }),
      importProjects: (list) => {
        const now = Date.now();
        dispatch({ t: "IMPORT", projects: list.map((p, i) => ({ ...p, id: uid(), created: now - i })) });
      },
      // Resolves once every pending change has been written.
      flush: () => sync(),
      // Loads a design's version history (once).
      hydrate: (id) => {
        if (ctx.current.hydrated.has(id) || hydrating.current.has(id)) return;
        if (!ctx.current.revs.has(id)) {
          // Not saved yet: there's no history anywhere else.
          ctx.current.hydrated.add(id);
          dispatch({ t: "HYDRATE", id, remote: {} });
          return;
        }
        hydrating.current.add(id);
        fetchVersions(id)
          .then((remote) => {
            ctx.current.hydrated.add(id);
            dispatch({ t: "HYDRATE", id, remote });
          })
          .catch((err) => {
            console.error("Loading history failed", err);
            toast("Couldn't load this design's history. It will load when you're back online.", { tone: "error" });
          })
          .finally(() => hydrating.current.delete(id));
      },
      // Conflict choices.
      keepMine: async (id) => {
        await saving.current;
        const p = latest.current.data.projects.find((x) => x.id === id);
        if (!p) return;
        try {
          await saveProject(userId, p, savedEntry(id), ctx.current, { force: true });
          setSavedEntry(id, p);
          saveSeq.current += 1;
          dismissed.current.delete(id);
          conflict(id, null);
          channel.current?.postMessage("saved");
          toast("Kept your version", { tone: "success" });
          sync();
        } catch (err) {
          toast(err.message || "Couldn't save your version. Try again.", { tone: "error" });
        }
      },
      useTheirs: async (id) => {
        await saving.current;
        try {
          const got = await fetchProject(id, { withVersions: ctx.current.hydrated.has(id) });
          blocked.current.delete(id);
          dismissed.current.delete(id);
          adoptRemote(id, got);
          dispatch({ t: "CONFLICTS", patch: { [id]: null } });
          toast(got ? "Loaded the latest version" : "That design was deleted on another device", { tone: got ? "success" : undefined });
        } catch (err) {
          toast(err.message || "Couldn't load the latest version. Try again.", { tone: "error" });
        }
      },
      dismissStale: (id) => {
        dismissed.current.set(id, ctx.current.revs.get(id));
        fetchRevs()
          .then((r) => dismissed.current.set(id, r.get(id)))
          .catch(() => {});
        dispatch({ t: "CONFLICTS", patch: { [id]: null } });
      },
      refresh: () => refresh({ force: true }),
    }),
    [toast, sync, refresh, userId],
  );

  const value = useMemo(() => ({ s: state, d: dispatch, api }), [state, api]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => useContext(StoreContext);

export function useProject(id) {
  const { s } = useStore();
  const want = id ?? s.data.activeId;
  return s.data.projects.find((p) => p.id === want) || null;
}
