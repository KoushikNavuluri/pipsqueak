import { describe, expect, it } from "vitest";
import { initial, reducer, sameAsSaved } from "../src/store.jsx";

const v = (id, at) => ({ id, at, html: "<p/>", label: id });
const design = (id, extra = {}) => ({ id, kind: "canvas", name: id, fav: false, kit: [], screens: [{ id: "home", name: "Home", html: "<main/>", versions: [] }], ...extra });
const start = (...projects) => initial({ projects, activeId: projects[0]?.id ?? null, prefs: {} });
const get = (s, id) => s.data.projects.find((p) => p.id === id);

describe("undo and redo", () => {
  it("restore the design but keep chat, review, star, image kit and shell", () => {
    let s = start(design("p"));
    s = reducer(s, { t: "EDIT", id: "p", fn: (p) => ({ ...p, name: "Renamed" }) });
    s = reducer(s, { t: "EDIT", id: "p", silent: true, fn: (p) => ({ ...p, fav: true, chat: [1], kit: [{ status: "done", url: "u" }], shell: "<nav/>" }) });
    s = reducer(s, { t: "UNDO", id: "p" });
    const p = get(s, "p");
    expect(p.name).toBe("p");
    expect(p.fav).toBe(true);
    expect(p.chat).toEqual([1]);
    expect(p.kit[0].status).toBe("done");
    expect(p.shell).toBe("<nav/>");
    s = reducer(s, { t: "REDO", id: "p" });
    expect(get(s, "p").name).toBe("Renamed");
  });

  it("do nothing for a design that's gone", () => {
    const s = { ...start(), hist: { p: { past: [design("p")], future: [] } } };
    expect(reducer(s, { t: "UNDO", id: "p" })).toBe(s);
  });
});

describe("loading history (HYDRATE)", () => {
  it("merges remote history and counts as saved when nothing is local-only", () => {
    const p = design("p");
    let s = start(p);
    s = reducer(s, { t: "HYDRATE", id: "p", remote: { home: [v("old", 1)] } });
    const merged = get(s, "p");
    expect(merged.screens[0].versions.map((x) => x.id)).toEqual(["old"]);
    expect(sameAsSaved(p, merged)).toBe(true);
    expect(s.loaded.p).toBe(true);
  });

  it("stays unsaved when a version exists only here", () => {
    const p = design("p", { screens: [{ id: "home", name: "Home", html: "<main/>", versions: [v("local", 2)] }] });
    let s = start(p);
    s = reducer(s, { t: "HYDRATE", id: "p", remote: { home: [v("old", 1)] } });
    const merged = get(s, "p");
    expect(merged.screens[0].versions.map((x) => x.id)).toEqual(["local", "old"]);
    expect(sameAsSaved(p, merged)).toBe(false);
  });

  it("counts as saved when it carries the copy that was just saved with it", () => {
    const p = design("p", { screens: [{ id: "home", name: "Home", html: "<main/>", versions: [v("local", 2)] }] });
    let s = start(p);
    s = reducer(s, { t: "HYDRATE", id: "p", remote: { home: [v("old", 1)] }, base: p });
    expect(sameAsSaved(p, get(s, "p"))).toBe(true);
  });
});

describe("remote changes", () => {
  it("REPLACE takes the saved copy and drops undo history and the conflict", () => {
    let s = start(design("p"));
    s = reducer(s, { t: "EDIT", id: "p", fn: (p) => ({ ...p, name: "Mine" }) });
    s = reducer(s, { t: "CONFLICTS", patch: { p: "changed" } });
    s = reducer(s, { t: "REPLACE", project: design("p", { name: "Theirs" }) });
    expect(get(s, "p").name).toBe("Theirs");
    expect(s.hist.p).toBeUndefined();
    expect(s.conflicts.p).toBeUndefined();
  });

  it("REMOVE_LOCAL closes the design if it was open", () => {
    let s = { ...start(design("p")), view: "studio" };
    s = reducer(s, { t: "REMOVE_LOCAL", id: "p" });
    expect(s.data.projects).toHaveLength(0);
    expect(s.data.activeId).toBe(null);
    expect(s.view).toBe("home");
  });

  it("ADD_REMOTE adds designs made elsewhere without duplicates", () => {
    let s = start(design("p"));
    s = reducer(s, { t: "ADD_REMOTE", projects: [design("p"), design("q")] });
    expect(s.data.projects.map((p) => p.id)).toEqual(["p", "q"]);
  });

  it("CONFLICTS sets and clears entries", () => {
    let s = start(design("p"));
    s = reducer(s, { t: "CONFLICTS", patch: { p: "stale" } });
    expect(s.conflicts).toEqual({ p: "stale" });
    s = reducer(s, { t: "CONFLICTS", patch: { p: null } });
    expect(s.conflicts).toEqual({});
  });
});
