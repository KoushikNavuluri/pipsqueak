import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { generateProject, uid } from "./gen";

const STORAGE_KEY = "pipsqueak.v2";

const seedProjects = () =>
  [
    generateProject({
      prompt: "Food app for biryani and tiffin delivery in Hyderabad",
      vibe: "sunset",
      count: 5,
    }),
    generateProject({
      prompt: "Split UPI bills and track your monthly budget",
      vibe: "midnight",
      count: 4,
    }),
    generateProject({
      prompt: "Weekend trips planner from Hyderabad",
      vibe: "matcha",
      count: 5,
    }),
  ].map((e, t) => ({
    ...e,
    created: Date.now() - (t + 1) * 86400000 * 2,
    fav: t === 0,
  }));

const fresh = () => ({
  projects: seedProjects(),
  activeId: null,
  prefs: {
    reduce: false,
    device: "iphone",
  },
});

function load() {
  try {
    const e = localStorage.getItem(STORAGE_KEY);
    if (e) {
      const t = JSON.parse(e);
      if (t && Array.isArray(t.projects)) {
        return {
          ...fresh(),
          ...t,
          prefs: {
            ...fresh().prefs,
            ...t.prefs,
          },
        };
      }
    }
  } catch {}
  return fresh();
}

export const initial = () => ({
  data: load(),
  view: "home",
  dialog: null,
  gen: null,
  toasts: [],
  hist: {},
  lastEdit: null,
  trash: null,
});

function reducer(e, t) {
  const D = (r) => ({
    ...e,
    data: {
      ...e.data,
      ...r,
    },
  });
  switch (t.t) {
    case "VIEW":
      return {
        ...e,
        view: t.view,
        dialog: null,
      };
    case "DIALOG":
      return {
        ...e,
        dialog: t.dialog,
      };
    case "GEN_START":
      return {
        ...e,
        gen: t.project,
        dialog: null,
      };
    case "GEN_CANCEL":
      return {
        ...e,
        gen: null,
      };
    case "ADD":
      return {
        ...D({
          projects: [t.project, ...e.data.projects],
          activeId: t.project.id,
        }),
        gen: null,
        view: "studio",
        dialog: null,
      };
    case "OPEN":
      return {
        ...D({
          activeId: t.id,
        }),
        view: "studio",
        dialog: null,
      };
    case "TOAST":
      return {
        ...e,
        toasts: [...e.toasts, t.toast].slice(-3),
      };
    case "DISMISS":
      return {
        ...e,
        toasts: e.toasts.filter((r) => r.id !== t.id),
      };
    case "PREF":
      return D({
        prefs: {
          ...e.data.prefs,
          ...t.patch,
        },
      });
    case "EDIT": {
      const r = e.data.projects.find((c) => c.id === t.id);
      if (!r) {
        return e;
      }
      const o = t.fn(r);
      if (o === r) {
        return e;
      }
      const i = e.data.projects.map((c) => (c.id === t.id ? o : c));
      if (t.silent) {
        return D({
          projects: i,
        });
      }
      const s = e.hist[t.id] || {
        past: [],
        future: [],
      };
      const l = Date.now();
      const d =
        t.key &&
        e.lastEdit &&
        e.lastEdit.key === t.key &&
        l - e.lastEdit.t < 900
          ? s.past
          : [...s.past, r].slice(-50);
      return {
        ...D({
          projects: i,
        }),
        hist: {
          ...e.hist,
          [t.id]: {
            past: d,
            future: [],
          },
        },
        lastEdit: {
          key: t.key,
          t: l,
        },
      };
    }
    case "UNDO": {
      const r = e.hist[t.id];
      if (!r || !r.past.length) {
        return e;
      }
      const o = e.data.projects.find((s) => s.id === t.id);
      const i = r.past[r.past.length - 1];
      return {
        ...D({
          projects: e.data.projects.map((s) => (s.id === t.id ? i : s)),
        }),
        hist: {
          ...e.hist,
          [t.id]: {
            past: r.past.slice(0, -1),
            future: [o, ...r.future],
          },
        },
        lastEdit: null,
      };
    }
    case "REDO": {
      const r = e.hist[t.id];
      if (!r || !r.future.length) {
        return e;
      }
      const o = e.data.projects.find((s) => s.id === t.id);
      const i = r.future[0];
      return {
        ...D({
          projects: e.data.projects.map((s) => (s.id === t.id ? i : s)),
        }),
        hist: {
          ...e.hist,
          [t.id]: {
            past: [...r.past, o],
            future: r.future.slice(1),
          },
        },
        lastEdit: null,
      };
    }
    case "DELETE": {
      const r = e.data.projects.findIndex((i) => i.id === t.id);
      if (r < 0) {
        return e;
      }
      const o = e.data.projects[r];
      return {
        ...D({
          projects: e.data.projects.filter((i) => i.id !== t.id),
          activeId: e.data.activeId === t.id ? null : e.data.activeId,
        }),
        view: e.data.activeId === t.id ? "home" : e.view,
        trash: {
          project: o,
          idx: r,
        },
      };
    }
    case "RESTORE": {
      if (!e.trash) {
        return e;
      }
      const r = e.data.projects.slice();
      r.splice(Math.min(e.trash.idx, r.length), 0, e.trash.project);
      return {
        ...D({
          projects: r,
        }),
        trash: null,
      };
    }
    case "RESET":
      return {
        ...initial(),
        data: fresh(),
      };
    default:
      return e;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [t, a] = useReducer(reducer, undefined, initial);
  const r = useRef(t);
  r.current = t;
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(t.data));
    } catch {}
  }, [t.data]);
  const o = useCallback((l, u = {}) => {
    const d = uid();
    a({
      t: "TOAST",
      toast: {
        id: d,
        text: l,
        action: u.action,
      },
    });
    setTimeout(
      () =>
        a({
          t: "DISMISS",
          id: d,
        }),
      u.ms || 3000,
    );
  }, []);
  const i = useMemo(
    () => ({
      toast: o,
      home: () =>
        a({
          t: "VIEW",
          view: "home",
        }),
      open: (l) =>
        a({
          t: "OPEN",
          id: l,
        }),
      dialog: (l, u) =>
        a({
          t: "DIALOG",
          dialog: l
            ? {
                name: l,
                props: u || {},
              }
            : null,
        }),
      startGen: (l) =>
        a({
          t: "GEN_START",
          project: l,
        }),
      cancelGen: () =>
        a({
          t: "GEN_CANCEL",
        }),
      add: (l) =>
        a({
          t: "ADD",
          project: l,
        }),
      edit: (l, u, d = {}) =>
        a({
          t: "EDIT",
          id: l,
          fn: u,
          ...d,
        }),
      undo: (l) =>
        a({
          t: "UNDO",
          id: l,
        }),
      redo: (l) =>
        a({
          t: "REDO",
          id: l,
        }),
      del: (l) => {
        a({
          t: "DELETE",
          id: l,
        });
        o("Project deleted", {
          action: {
            label: "Undo",
            run: () =>
              a({
                t: "RESTORE",
              }),
          },
          ms: 5000,
        });
      },
      dup: (l) => {
        const u = r.current.data.projects.find((c) => c.id === l);
        if (!u) {
          return;
        }
        const d = JSON.parse(JSON.stringify(u));
        d.id = uid();
        d.name = u.name + " copy";
        d.created = Date.now();
        d.fav = false;
        a({
          t: "ADD",
          project: d,
        });
        o("Duplicated");
      },
      fav: (l) =>
        a({
          t: "EDIT",
          id: l,
          silent: true,
          fn: (u) => ({
            ...u,
            fav: !u.fav,
          }),
        }),
      pref: (l) =>
        a({
          t: "PREF",
          patch: l,
        }),
      reset: () => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
        a({
          t: "RESET",
        });
      },
    }),
    [o],
  );
  const s = useMemo(
    () => ({
      s: t,
      d: a,
      api: i,
    }),
    [t, i],
  );
  return <StoreContext.Provider value={s}>{children}</StoreContext.Provider>;
}

export const useStore = () => useContext(StoreContext);

export function useProject(e) {
  const { s } = useStore();
  const a = e ?? s.data.activeId;
  return s.data.projects.find((r) => r.id === a) || null;
}
