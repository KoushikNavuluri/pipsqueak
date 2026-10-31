import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { uid } from "./util";
import { saveCloud } from "./cloud";

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

const initial = (data) => ({
  data,
  view: "home",
  gen: null,
  toasts: [],
  hist: {},
  lastEdit: null,
  trash: null,
});

// Conversation and review belong to the project but not to its undo history:
// undo and redo restore the design and keep these as they are.
const keepMeta = (snapshot, current) => ({ ...snapshot, chat: current.chat, review: current.review });

function reducer(state, action) {
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
    default:
      return state;
  }
}

const StoreContext = createContext(null);

// `cloud.data` is what the user starts with; `cloud.saved` is what Supabase
// already holds (null when nothing has been saved yet). Changes are written
// back about half a second after they stop.
export function StoreProvider({ children, userId, cloud }) {
  const [state, dispatch] = useReducer(reducer, cloud.data, initial);
  const latest = useRef(state);
  latest.current = state;
  const saved = useRef(cloud.saved);
  const saving = useRef(null);
  const failing = useRef(false);

  const toast = useCallback((text, { tone, action, ms } = {}) => {
    const id = uid();
    dispatch({ t: "TOAST", toast: { id, text, tone, action } });
    setTimeout(() => dispatch({ t: "DISMISS", id }), ms || (action ? 5000 : 3200));
  }, []);

  const sync = useCallback(() => {
    if (saving.current) return saving.current;
    if (latest.current.data === saved.current) return Promise.resolve();
    const run = async () => {
      try {
        while (latest.current.data !== saved.current) {
          const next = latest.current.data;
          await saveCloud(userId, saved.current, next);
          saved.current = next;
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
      if (latest.current.data !== saved.current) {
        sync();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [sync]);

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
    }),
    [toast, sync],
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
