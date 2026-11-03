import { describe, expect, it, vi } from "vitest";
import { MAX_VERSIONS, mergeVersions, planSave, saveCloud, saveProject, stripVersions, versionsChanged, withRemoteVersions } from "../src/cloud.js";
import { fakeDb } from "./fakeDb.js";

const v = (id, at) => ({ id, at, html: `<p>${id}</p>`, label: id });
const design = (id, versions = []) => ({ id, kind: "canvas", name: id, created: 1, screens: [{ id: "home", name: "Home", html: "<main/>", versions }] });
const ctxFor = (revs = {}, { hydrated = [], legacy = [] } = {}) => ({
  revs: new Map(Object.entries(revs)),
  hydrated: new Set(hydrated),
  legacy: new Set(legacy),
  onRemoteVersions: vi.fn(),
});

describe("version history helpers", () => {
  it("merges newest first, without duplicates, capped", () => {
    const local = [v("c", 3), v("b", 2)];
    const remote = [v("b", 2), v("a", 1)];
    expect(mergeVersions(local, remote).map((x) => x.id)).toEqual(["c", "b", "a"]);
    const many = Array.from({ length: 40 }, (_, i) => v("v" + i, i));
    expect(mergeVersions(many, [])).toHaveLength(MAX_VERSIONS);
    expect(mergeVersions(many, [])[0].id).toBe("v39");
  });

  it("keeps history out of the saved design data", () => {
    const p = design("p1", [v("a", 1)]);
    expect(stripVersions(p).screens[0]).not.toHaveProperty("versions");
    expect(p.screens[0].versions).toHaveLength(1);
  });

  it("folds remote history into screens", () => {
    const p = design("p1", [v("new", 5)]);
    const merged = withRemoteVersions(p, { home: [v("old", 1)] });
    expect(merged.screens[0].versions.map((x) => x.id)).toEqual(["new", "old"]);
  });

  it("notices history changes only when a screen's history changes", () => {
    const a = design("p1", [v("a", 1)]);
    expect(versionsChanged(a, { ...a, name: "Renamed" })).toBe(false);
    expect(versionsChanged(a, { ...a, screens: [{ ...a.screens[0], versions: [v("b", 2), v("a", 1)] }] })).toBe(true);
    expect(versionsChanged(a, { ...a, screens: [] })).toBe(true);
  });
});

describe("planSave", () => {
  const prefs = {};
  it("finds changed, removed and skipped designs", () => {
    const a = design("a");
    const b = design("b");
    const prev = { projects: [a, b], prefs, activeId: null };
    const a2 = { ...a, name: "A2" };
    const plan = planSave(prev, { projects: [a2], prefs, activeId: null });
    expect(plan.changed).toEqual([a2]);
    expect(plan.removed).toEqual(["b"]);
    expect(plan.settings).toBe(false);
    const skipped = planSave(prev, { projects: [a2], prefs, activeId: null }, new Set(["a", "b"]));
    expect(skipped.empty).toBe(true);
  });

  it("treats copies declared the same as saved, and adopts them", () => {
    const a = design("a");
    const merged = { ...a };
    const plan = planSave({ projects: [a], prefs, activeId: null }, { projects: [merged], prefs, activeId: null }, new Set(), (s, c) => s === a && c === merged);
    expect(plan.empty).toBe(true);
    expect(plan.adopted).toEqual([merged]);
  });

  it("saves settings on first save or when they change", () => {
    expect(planSave(null, { projects: [], prefs, activeId: null }).settings).toBe(true);
    expect(planSave({ projects: [], prefs, activeId: null }, { projects: [], prefs, activeId: "x" }).settings).toBe(true);
  });
});

describe("saveProject", () => {
  it("inserts a new design with its history in the versions column", async () => {
    const db = fakeDb();
    const ctx = ctxFor();
    const p = design("p1", [v("a", 1)]);
    const out = await saveProject("u1", p, undefined, ctx, {}, db);
    expect(out).toEqual({ rev: 1 });
    const row = db.table.get("p1");
    expect(row.data.screens[0]).not.toHaveProperty("versions");
    expect(row.versions.home.map((x) => x.id)).toEqual(["a"]);
    expect(ctx.hydrated.has("p1")).toBe(true);
  });

  it("updates only on top of the rev it last saw, and skips history when it didn't change", async () => {
    const saved = design("p1", [v("a", 1)]);
    const db = fakeDb([{ id: "p1", rev: 3, data: stripVersions(saved), versions: { home: [v("a", 1)] } }]);
    const ctx = ctxFor({ p1: 3 }, { hydrated: ["p1"] });
    const renamed = { ...saved, name: "New name" };
    expect(await saveProject("u1", renamed, saved, ctx, {}, db)).toEqual({ rev: 4 });
    const update = db.calls.find((c) => c.op === "update");
    expect(update.payload).not.toHaveProperty("versions");
    expect(update.filters).toContainEqual(["rev", 3]);
    expect(ctx.revs.get("p1")).toBe(4);
  });

  it("reports a conflict instead of overwriting a newer save", async () => {
    const saved = design("p1");
    const db = fakeDb([{ id: "p1", rev: 7, data: saved }]);
    const ctx = ctxFor({ p1: 5 }, { hydrated: ["p1"] });
    const out = await saveProject("u1", { ...saved, name: "Mine" }, saved, ctx, {}, db);
    expect(out).toEqual({ conflict: "changed" });
    expect(db.table.get("p1").data.name).toBe("p1");
    expect(db.table.get("p1").rev).toBe(7);
  });

  it("reports a design deleted elsewhere, and can put it back on request", async () => {
    const saved = design("p1");
    const db = fakeDb([]);
    const ctx = ctxFor({ p1: 2 }, { hydrated: ["p1"] });
    expect(await saveProject("u1", saved, saved, ctx, {}, db)).toEqual({ conflict: "deleted" });
    expect(await saveProject("u1", saved, saved, ctx, { force: true }, db)).toEqual({ rev: 1 });
    expect(db.table.has("p1")).toBe(true);
  });

  it("keeps the user's copy when forced over a newer save", async () => {
    const saved = design("p1");
    const db = fakeDb([{ id: "p1", rev: 9, data: { ...saved, name: "Theirs" } }]);
    const ctx = ctxFor({ p1: 4 }, { hydrated: ["p1"] });
    expect(await saveProject("u1", { ...saved, name: "Mine" }, saved, ctx, { force: true }, db)).toEqual({ rev: 10 });
    expect(db.table.get("p1").data.name).toBe("Mine");
  });

  it("never replaces history it hasn't loaded: merges the saved history in first", async () => {
    const saved = design("p1");
    const db = fakeDb([{ id: "p1", rev: 1, data: stripVersions(saved), versions: { home: [v("old", 1)] } }]);
    const ctx = ctxFor({ p1: 1 });
    const edited = { ...saved, screens: [{ ...saved.screens[0], versions: [v("new", 2)] }] };
    await saveProject("u1", edited, saved, ctx, {}, db);
    expect(db.table.get("p1").versions.home.map((x) => x.id)).toEqual(["new", "old"]);
    expect(ctx.onRemoteVersions).toHaveBeenCalledWith("p1", edited, { home: [v("old", 1)] });
    expect(ctx.hydrated.has("p1")).toBe(true);
  });

  it("moves history out of data the first time a legacy design is saved", async () => {
    const legacy = design("p1", [v("inline", 1)]);
    const db = fakeDb([{ id: "p1", rev: 1, data: legacy, versions: null }]);
    const ctx = ctxFor({ p1: 1 }, { legacy: ["p1"] });
    await saveProject("u1", { ...legacy, name: "Renamed" }, legacy, ctx, {}, db);
    const row = db.table.get("p1");
    expect(row.data.screens[0]).not.toHaveProperty("versions");
    expect(row.versions.home.map((x) => x.id)).toEqual(["inline"]);
    expect(ctx.legacy.has("p1")).toBe(false);
  });
});

describe("saveCloud", () => {
  it("saves what it can and returns conflicts by id", async () => {
    const a = design("a");
    const b = design("b");
    const db = fakeDb([
      { id: "a", rev: 1, data: a },
      { id: "b", rev: 5, data: b },
    ]);
    const ctx = ctxFor({ a: 1, b: 2 }, { hydrated: ["a", "b"] });
    const next = { projects: [{ ...a, name: "A!" }, { ...b, name: "B!" }], prefs: {}, activeId: null };
    const plan = planSave({ projects: [a, b], prefs: next.prefs, activeId: null }, next);
    const conflicts = await saveCloud("u1", plan, next, ctx, db);
    expect([...conflicts]).toEqual([["b", "changed"]]);
    expect(db.table.get("a").data.name).toBe("A!");
    expect(db.table.get("b").data.name).toBe("b");
  });
});
