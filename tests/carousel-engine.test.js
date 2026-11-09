import { describe, expect, it, vi } from "vitest";

vi.mock("../src/ai/client", () => ({ askCarousel: vi.fn() }));

import { applyImages } from "../src/carousel/engine";
import { emptySlide } from "../src/carousel/model";
import { withoutMissingPhoto } from "../src/carousel/Slide";
import { STYLES, STYLE_GROUPS, STYLE_IDS } from "../src/carousel/styles";

const photo = (id, extra = {}) => ({ ...emptySlide("photo"), id, image: { use: true, query: id, status: "searching" }, img: null, ...extra });

describe("photo results land on the right slide", () => {
  it("maps by slide id even after the slides were reordered", () => {
    const slides = [photo("b"), photo("a"), photo("c")];
    const result = {
      slides: [
        { index: 0, id: "a", chosen: { src: "a.jpg" }, candidates: [] },
        { index: 1, id: "b", chosen: { src: "b.jpg" }, candidates: [] },
        { index: 2, id: "c", chosen: null, candidates: [] },
      ],
    };
    const out = applyImages(slides, result);
    expect(out.map((s) => s.img?.src ?? null)).toEqual(["b.jpg", "a.jpg", null]);
    expect(out.map((s) => s.image.status)).toEqual(["ok", "ok", "none"]);
  });

  it("never replaces a photo the user picked meanwhile", () => {
    const slides = [photo("a", { img: { src: "mine.jpg" } })];
    const out = applyImages(slides, { slides: [{ index: 0, id: "a", chosen: { src: "pip.jpg" }, candidates: [] }] });
    expect(out[0].img.src).toBe("mine.jpg");
  });

  it("ignores results for slides that were deleted", () => {
    const out = applyImages([photo("a")], { slides: [{ index: 5, id: "gone", chosen: { src: "x.jpg" }, candidates: [] }] });
    expect(out[0].img).toBeNull();
  });
});

describe("slides without a photo", () => {
  it("become text slides instead of showing a placeholder", () => {
    const s = withoutMissingPhoto(photo("a", { image: { use: true, status: "none" } }));
    expect(s.layout).toBe("statement");
    expect(s.image.use).toBe(false);
    const cover = withoutMissingPhoto({ ...emptySlide("cover"), image: { use: true } });
    expect(cover.layout).toBe("cover");
    expect(cover.image.use).toBe(false);
  });
});

describe("themes", () => {
  const keys = ["cover", "photo", "shape", "align", "panel", "number", "kicker", "highlight", "background", "chrome"];
  it("are complete recipes", () => {
    expect(STYLE_IDS.length).toBe(16);
    for (const id of STYLE_IDS) {
      for (const k of keys) expect(STYLES[id][k], `${id}.${k}`).toBeTruthy();
      expect(STYLE_GROUPS).toContain(STYLES[id].group);
    }
  });

  it("never share the same composition", () => {
    const sig = (st) => [st.cover, st.photo, st.shape, st.align, st.panel, st.chrome, st.background].join("|");
    const seen = new Map();
    for (const id of STYLE_IDS) {
      expect(seen.has(sig(STYLES[id])), `${id} duplicates ${seen.get(sig(STYLES[id]))}`).toBe(false);
      seen.set(sig(STYLES[id]), id);
    }
  });
});
