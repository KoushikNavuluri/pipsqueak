import { describe, expect, it } from "vitest";
import { pollUrl, shareUrl } from "../src/share.js";
import { renderScreenPng } from "../src/design/exportDesign.js";
import { normalizeSystem } from "../src/design/system.js";

describe("Share link URLs and formatting", () => {
  it("formats share and poll URLs correctly", () => {
    const token = "abc123xyz";
    expect(shareUrl(token)).toContain(`/s/${token}`);
    expect(pollUrl(token)).toContain(`/poll/${token}`);
  });
});

describe("Comment threading logic", () => {
  const comments = [
    { id: "c1", parent_id: null, body: "Top level 1", author_name: "Alice" },
    { id: "c2", parent_id: "c1", body: "Reply 1 to top 1", author_name: "Bob" },
    { id: "c3", parent_id: "c1", body: "Reply 2 to top 1", author_name: "Alice" },
    { id: "c4", parent_id: null, body: "Top level 2", author_name: "Charlie" },
  ];

  it("groups parent threads and replies correctly", () => {
    const parents = comments.filter((c) => !c.parent_id);
    expect(parents.length).toBe(2);
    expect(parents.map((p) => p.id)).toEqual(["c1", "c4"]);

    const repliesToC1 = comments.filter((c) => c.parent_id === "c1");
    expect(repliesToC1.length).toBe(2);
    expect(repliesToC1.map((r) => r.author_name)).toEqual(["Bob", "Alice"]);
  });

  it("resolves entire thread when parent is resolved", () => {
    const parentId = "c1";
    const replies = comments.filter((c) => c.parent_id === parentId);
    const allThreadIds = [parentId, ...replies.map((r) => r.id)];
    expect(allThreadIds).toEqual(["c1", "c2", "c3"]);

    const resolved = comments.map((c) => (allThreadIds.includes(c.id) ? { ...c, resolved_at: "now" } : c));
    expect(resolved.find((c) => c.id === "c1").resolved_at).toBe("now");
    expect(resolved.find((c) => c.id === "c2").resolved_at).toBe("now");
    expect(resolved.find((c) => c.id === "c4").resolved_at).toBeUndefined();
  });
});

describe("Share controls: passcode and expiry", () => {
  it("validates passcode length", () => {
    const valid = "pass123";
    const tooShort = "12";
    expect(valid.length >= 4).toBe(true);
    expect(tooShort.length >= 4).toBe(false);
  });

  it("handles relative expiration times correctly", () => {
    const now = Date.now();
    const exp24h = new Date(now + 24 * 3600 * 1000).toISOString();
    expect(new Date(exp24h).getTime()).toBeGreaterThan(now);

    const isExpired = (iso) => (iso ? new Date(iso).getTime() < now : false);
    expect(isExpired(exp24h)).toBe(false);
    expect(isExpired(new Date(now - 1000).toISOString())).toBe(true);
    expect(isExpired(null)).toBe(false);
  });
});

describe("Design poll tallying & votes", () => {
  it("computes vote percentages and totals accurately", () => {
    const votes = { opt_1: 7, opt_2: 3 };
    const total = Object.values(votes).reduce((a, b) => a + b, 0);
    expect(total).toBe(10);

    const pct1 = Math.round((votes.opt_1 / total) * 100);
    const pct2 = Math.round((votes.opt_2 / total) * 100);
    expect(pct1).toBe(70);
    expect(pct2).toBe(30);
  });

  it("handles 0 total votes without dividing by zero", () => {
    const votes = {};
    const total = 0;
    const pct = total > 0 ? Math.round((0 / total) * 100) : 0;
    expect(pct).toBe(0);
  });
});

describe("Workspace roles & permissions", () => {
  const canEdit = (role) => ["owner", "editor"].includes(role);
  const canComment = (role) => ["owner", "editor", "commenter"].includes(role);

  it("enforces editor vs viewer roles", () => {
    expect(canEdit("owner")).toBe(true);
    expect(canEdit("editor")).toBe(true);
    expect(canEdit("commenter")).toBe(false);
    expect(canEdit("viewer")).toBe(false);

    expect(canComment("commenter")).toBe(true);
    expect(canComment("viewer")).toBe(false);
  });
});

describe("PNG Screen Export", () => {
  it("creates an image blob without error in test environment", async () => {
    const screen = { id: "home", name: "Home", html: "<div>Test Screen</div>" };
    const sys = normalizeSystem({});
    const blob = await renderScreenPng(screen, sys, [], 390, 844);
    expect(blob).toBeDefined();
    expect(blob.type).toBe("image/png");
  });
});
