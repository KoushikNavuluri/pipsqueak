import { describe, expect, it } from "vitest";
import { anchorFrom, anchorLabel, remixFromShare } from "../src/share.js";
import { commentsInstruction } from "../src/studio/panels/CommentsPanel.jsx";
import { nextReset, resetInLabel } from "../src/credits.js";
import { contrast, normalizeSystem } from "../src/design/system.js";
import { findAnchor, looksTruncated } from "../src/design/htmlTools.js";
import { htmlPrototype, reactProject } from "../src/design/exportDesign.js";

describe("comment anchors", () => {
  const info = {
    path: [0, 2, 1],
    tag: "button",
    text: "Get started " + "x".repeat(400),
    outer: "<button class='" + "a ".repeat(3000) + "'>Get started</button>",
    doc: { x: 10.4, y: 20.6, w: 100, h: 40 },
  };

  it("stay under the database's 2 KB limit", () => {
    const a = anchorFrom(info);
    expect(new TextEncoder().encode(JSON.stringify(a)).length).toBeLessThan(2048);
    expect(a.rect).toEqual({ x: 10, y: 21, w: 100, h: 40 });
  });

  it("read naturally", () => {
    expect(anchorLabel({ tag: "h1", text: "Hello there" }, "Home")).toBe("h1 “Hello there” on Home");
    expect(anchorLabel({}, "Home")).toBe("Home (whole screen)");
  });

  it("give Pip one numbered instruction per screen", () => {
    const text = commentsInstruction(
      [
        { body: "Make it bigger", anchor: { tag: "button", text: "Go" } },
        { body: "Warmer colours", anchor: {} },
      ],
      "Home",
    );
    expect(text).toContain("Home screen");
    expect(text).toContain("1. About the button that read “Go”: Make it bigger");
    expect(text).toContain("2. About the screen as a whole: Warmer colours");
    expect(text).toContain("Return the complete screen.");
    // No element markup: it led the model to answer with that element alone.
    expect(text).not.toMatch(/<button/);
  });
});

describe("remixing a shared design", () => {
  it("makes a fresh copy without the owner's chat, review or history", () => {
    const shared = { project: { id: "orig", name: "Tiffin", system: {}, chat: [1], review: {}, screens: [{ id: "home", html: "<p/>", versions: [1] }] } };
    const copy = remixFromShare(shared, "new1");
    expect(copy.id).toBe("new1");
    expect(copy.name).toBe("Tiffin remix");
    expect(copy.chat).toEqual([]);
    expect(copy.review).toBe(null);
    expect(copy.screens[0].versions).toEqual([]);
    expect(copy.kind).toBe("canvas");
  });
});

describe("credit reset time", () => {
  it("is the next midnight UTC", () => {
    const now = new Date("2026-11-03T20:00:00Z");
    expect(nextReset(now).toISOString()).toBe("2026-11-04T00:00:00.000Z");
    expect(resetInLabel(now)).toBe("4 h");
    expect(resetInLabel(new Date("2026-11-03T23:30:00Z"))).toBe("30 min");
  });
});

describe("design system", () => {
  it("measures contrast", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("repairs unreadable text colours", () => {
    const sys = normalizeSystem({ colors: { bg: "#FFFFFF", surface: "#FFFFFF", ink: "#EEEEEE", muted: "#F0F0F0" } });
    expect(contrast(sys.colors.ink, sys.colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(sys.colors.muted, sys.colors.bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("exports", () => {
  const evil = {
    id: "p",
    name: "<img src=x onerror=alert(1)>",
    tagline: "a & b",
    spec: { platform: "mobile" },
    system: normalizeSystem({}),
    kit: [],
    screens: [{ id: "home", name: "<b>Home</b>", html: "<main>hi</main>" }],
  };

  it("escape names in the HTML prototype", () => {
    const index = htmlPrototype(evil)["index.html"];
    expect(index).not.toContain("<img src=x");
    expect(index).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(index).toContain("a &amp; b");
    expect(index).toContain("&lt;b&gt;Home&lt;/b&gt;");
  });

  it("escape the title in the React project", () => {
    const html = reactProject({ ...evil, screens: [] })["index.html"];
    expect(html).toContain("<title>&lt;img src=x onerror=alert(1)&gt;</title>");
  });
});

describe("Pip edits for comments", () => {
  const page = `<header><h1 class="uppercase">Welcome</h1></header><main>${"<p>Line</p>".repeat(30)}<button>Get started</button></main>`;

  it("refuses a whole-screen rewrite that kept only one element", () => {
    expect(looksTruncated(page, '<h1 class="text-5xl">Welcome</h1>')).toBe(true);
    expect(looksTruncated(page, page.replace("Welcome", "Hello"))).toBe(false);
    expect(looksTruncated("<p>tiny</p>", "<p>x</p>")).toBe(false);
  });

  it("finds a commented element by path, or by tag and text after the screen changed", () => {
    expect(findAnchor(page, { path: [1, 30], tag: "button", text: "Get started" })).toEqual([1, 30]);
    const moved = page.replace("<main>", "<main><p>New banner</p>");
    expect(findAnchor(moved, { path: [1, 30], tag: "button", text: "Get started" })).toEqual([1, 31]);
    // Text captured from the screen can be upper-cased by CSS.
    expect(findAnchor(page, { path: [0, 0], tag: "h1", text: "WELCOME" })).toEqual([0, 0]);
    expect(findAnchor(page, { path: [0, 0], tag: "h2", text: "Gone" })).toBe(null);
    expect(findAnchor(page, {})).toBe(null);
  });
});
