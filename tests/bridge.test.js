import { beforeAll, describe, expect, it, vi } from "vitest";
import { BRIDGE } from "../src/design/bridge.js";

// The bridge runs inside each screen's iframe. Here it runs in the test page
// itself, which is its own parent, so its replies arrive as messages here too.
function ask(msg) {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    const on = (e) => {
      if (e.data?.__pq && e.data.id === id && e.data.frame === "t") {
        removeEventListener("message", on);
        resolve(e.data);
      }
    };
    addEventListener("message", on);
    dispatchEvent(new MessageEvent("message", { data: { __pq: 1, ...msg, id }, source: window }));
  });
}

describe("finding a commented element again", () => {
  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    document.body.innerHTML = `<header><h1>Welcome</h1></header><main><p>Intro</p><button>Get started</button></main>`;
    window.__PQ = { mode: "view", frameId: "t" };
    new Function(BRIDGE)();
  });

  it("finds it by path while the path still holds it", async () => {
    const { found } = await ask({ type: "locate", anchors: [{ path: [1, 1], tag: "button", text: "Get started" }] });
    expect(found[0].path).toEqual([1, 1]);
  });

  it("finds it by tag and text after the screen was rearranged", async () => {
    document.querySelector("main").insertAdjacentHTML("afterbegin", "<p>New banner</p>");
    const { found } = await ask({ type: "locate", anchors: [{ path: [1, 1], tag: "button", text: "Get started" }] });
    expect(found[0].path).toEqual([1, 2]);
  });

  it("reports elements that are gone", async () => {
    const { found } = await ask({ type: "locate", anchors: [{ path: [0, 0], tag: "h2", text: "Removed" }] });
    expect(found[0]).toBe(null);
  });
});
