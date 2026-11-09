import { describe, expect, it } from "vitest";
import { contrast, safePalette, STYLE_IDS, STYLES } from "../src/carousel/styles";
import { titleSize } from "../src/carousel/Slide";
import {
  captionText,
  creditsText,
  emptySlide,
  exportWarnings,
  mergeRefined,
  moveSlide,
  needsImage,
  newCarouselProject,
  settleLayouts,
  shortName,
} from "../src/carousel/model";
import { makePdf } from "../src/carousel/pdf";

describe("carousel palettes", () => {
  it("keeps text readable whatever colors the AI picks", () => {
    const awful = { bg: "#777777", ink: "#7A7A7A", muted: "#787878", accent: "#FFFF00", onAccent: "#FFFF10", surface: "#777777" };
    for (const style of STYLE_IDS) {
      const p = safePalette(awful, style);
      expect(contrast(p.ink, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.muted, p.bg)).toBeGreaterThanOrEqual(3);
      expect(contrast(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("ships style samples that already pass", () => {
    for (const id of STYLE_IDS) {
      const s = STYLES[id].sample;
      expect(contrast(s.ink, s.bg), id).toBeGreaterThanOrEqual(7);
      expect(contrast(s.onAccent, s.accent), id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("ignores values that aren't hex colors", () => {
    const p = safePalette({ bg: "red", ink: "url(javascript:1)" }, "swiss");
    expect(p.bg).toBe(STYLES.swiss.sample.bg);
    expect(p.ink).toBe(STYLES.swiss.sample.ink);
  });
});

describe("headline sizing", () => {
  it("shrinks with length and stays within bounds", () => {
    expect(titleSize("Short", 150, 60)).toBe(150);
    expect(titleSize("x".repeat(200), 150, 60)).toBe(60);
    expect(titleSize("A medium length headline here", 150, 60)).toBeLessThan(titleSize("Shorter one", 150, 60) + 1);
  });
});

describe("carousel model", () => {
  const plan = { title: "Why Kyoto's tiny coffee bars feel so calm and quiet", audience: "a", goal: "saves", angle: "b", reasoning: "c", slideCount: 6, hooks: [] };
  const directions = [{ id: "d1", style: "editorial", name: "One" }, { id: "d2", style: "noir", name: "Two" }];

  it("creates a project with one variation per direction", () => {
    const p = newCarouselProject({ request: { topic: "kyoto", format: "4:5", brand: { handle: "@x", name: "" } }, plan, directions });
    expect(p.kind).toBe("carousel");
    expect(p.screens).toEqual([]);
    expect(p.carousel.variants.map((v) => v.id)).toEqual(["d1", "d2"]);
    expect(p.carousel.active).toBe("d1");
    expect(p.name.length).toBeLessThanOrEqual(40);
    expect(p.name.endsWith(" ")).toBe(false);
  });

  it("cuts names at a word boundary", () => {
    expect(shortName("Why Kyoto's Tiny Coffee Bars Feel So Calm and Quiet")).toBe("Why Kyoto's Tiny Coffee Bars Feel So");
    expect(shortName("Short title")).toBe("Short title");
  });

  it("keeps the first slide a cover and the last a call to action", () => {
    const slides = [emptySlide("cover"), emptySlide("statement"), emptySlide("cta")];
    const moved = settleLayouts(moveSlide(slides, 0, 2));
    expect(moved[0].layout).toBe("statement");
    expect(moved[2].layout).toBe("statement");
    expect(moveSlide(slides, 0, 9)).toBe(slides);
  });

  it("keeps photos when an AI edit doesn't change what the slide needs", () => {
    const old = [{ ...emptySlide("photo"), image: { use: true, query: "tea house" }, img: { src: "a.jpg" } }, { ...emptySlide("photo"), image: { use: true, query: "street" }, img: { src: "b.jpg" } }];
    const next = mergeRefined(old, [
      { ...old[0], title: "New words" },
      { ...old[1], image: { use: true, query: "night market" } },
    ]);
    expect(next[0].img.src).toBe("a.jpg");
    expect(next[0].id).toBe(old[0].id);
    expect(next[1].img).toBeNull();
    expect(needsImage(next)).toEqual([1]);
  });

  it("writes the caption, credits and warnings", () => {
    const v = {
      caption: "Hello",
      hashtags: ["kyoto", "#coffee"],
      slides: [
        { ...emptySlide("cover"), image: { use: true }, img: { src: "a", source: "web", credit: "example.com", license: "Unknown: check", page: "https://example.com/p" } },
        { ...emptySlide("stat"), stat: { value: "73%", label: "x" } },
        { ...emptySlide("photo"), image: { use: true, query: "q" }, img: null },
      ],
    };
    expect(captionText(v)).toBe("Hello\n\n#kyoto #coffee");
    expect(creditsText(v)).toContain("Slide 1: example.com · Unknown: check");
    const w = exportWarnings(v).join(" ");
    expect(w).toContain("Slide 3 has no photo");
    expect(w).toContain("Slide 2 has a number or quote");
    expect(w).toContain("unknown license");
  });
});

describe("PDF export", () => {
  it("writes a valid cross-reference table", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
    const bytes = makePdf([{ jpeg, width: 1080, height: 1350 }, { jpeg, width: 1080, height: 1350 }], { title: "Test (1)" });
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Count 2");
    expect(text).toContain("/MediaBox [0 0 540 675]");
    const start = Number(/startxref\n(\d+)/.exec(text)[1]);
    expect(text.slice(start, start + 4)).toBe("xref");
    const offsets = text.slice(start).split("\n").slice(3).filter((l) => / 00000 n $/.test(l)).map((l) => Number(l.slice(0, 10)));
    offsets.forEach((off, i) => expect(text.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  });
});

describe("carousel mobile preview sizing", () => {
  it("computes preview width constrained by window and aspect ratio", () => {
    const ratio = 1.25; // 4:5
    const windowW = 390;
    const windowH = 844;
    const sizeW = 0; // fallback before observer
    const previewW = Math.max(220, Math.min((sizeW || windowW) - 32, 520, (windowH * 0.58) / ratio));
    expect(previewW).toBe(358);
    expect(previewW * ratio).toBeLessThan(windowH * 0.6);
  });
});
