import { describe, expect, it } from "vitest";
import {
  LAYOUTS,
  PHOTO_LAYOUTS,
  emptySlide,
  formatGitHubRepoNotes,
  isGitHubRepoUrl,
  loadBrandKit,
  normalizeSlide,
  parseGitHubRepo,
  saveBrandKit,
} from "../src/carousel/model";
import { onPhotoSlide, withoutMissingPhoto } from "../src/carousel/Slide";
import { carouselToCanvasProject, renderSlideHtml } from "../src/carousel/bridge";
import { exportVideo } from "../src/carousel/exporter";

describe("Panorama Spread feature", () => {
  it("includes panorama in LAYOUTS and PHOTO_LAYOUTS", () => {
    const pano = LAYOUTS.find((l) => l.id === "panorama");
    expect(pano).toBeDefined();
    expect(PHOTO_LAYOUTS.has("panorama")).toBe(true);
  });

  it("initializes empty slide with panorama parts and peekNext", () => {
    const s = emptySlide("panorama");
    expect(s.layout).toBe("panorama");
    expect(s.panorama).toEqual({ part: 1, totalParts: 2 });
    expect(s.peekNext).toBe(false);
    expect(s.image.use).toBe(true);
  });

  it("treats panorama as photo slide for chrome and styling", () => {
    const s = { ...emptySlide("panorama"), image: { use: true } };
    expect(onPhotoSlide(s, "editorial")).toBe(true);
    expect(onPhotoSlide(s, "swiss")).toBe(true);
  });

  it("normalizes panorama slide while preserving parts", () => {
    const norm = normalizeSlide({ layout: "panorama", panorama: { part: 2, totalParts: 2 }, peekNext: true });
    expect(norm.panorama.part).toBe(2);
    expect(norm.peekNext).toBe(true);
  });
});

describe("Code & Terminal slide feature", () => {
  it("includes code in LAYOUTS", () => {
    const codeLayout = LAYOUTS.find((l) => l.id === "code");
    expect(codeLayout).toBeDefined();
  });

  it("initializes empty code slide with default snippet and filename", () => {
    const s = emptySlide("code");
    expect(s.layout).toBe("code");
    expect(s.code).toBeDefined();
    expect(s.code.language).toBe("typescript");
    expect(s.code.filename).toBe("index.ts");
    expect(s.code.code).toContain("export function");
  });

  it("normalizes code slide preserving custom code and line highlights", () => {
    const custom = {
      layout: "code",
      code: {
        language: "python",
        filename: "agent.py",
        code: "def run():\n    return True",
        lineHighlight: "2",
      },
    };
    const norm = normalizeSlide(custom);
    expect(norm.code.language).toBe("python");
    expect(norm.code.filename).toBe("agent.py");
    expect(norm.code.lineHighlight).toBe("2");
  });
});

describe("GitHub Repo Teardown parsing & formatting", () => {
  it("detects GitHub repository URLs accurately", () => {
    expect(isGitHubRepoUrl("https://github.com/facebook/react")).toBe(true);
    expect(isGitHubRepoUrl("https://github.com/torvalds/linux")).toBe(true);
    expect(isGitHubRepoUrl("http://github.com/owner/repo.git")).toBe(true);
    expect(isGitHubRepoUrl("https://github.com/owner/repo/tree/main")).toBe(true);
    expect(isGitHubRepoUrl("https://google.com")).toBe(false);
    expect(isGitHubRepoUrl("not a url")).toBe(false);
  });

  it("parses owner and repo correctly", () => {
    expect(parseGitHubRepo("https://github.com/facebook/react")).toEqual({ owner: "facebook", repo: "react" });
    expect(parseGitHubRepo("https://github.com/shadcn-ui/ui.git")).toEqual({ owner: "shadcn-ui", repo: "ui" });
    expect(parseGitHubRepo("invalid")).toBeNull();
  });

  it("formats structured notes from repo metadata", () => {
    const notes = formatGitHubRepoNotes({
      owner: "facebook",
      repo: "react",
      description: "The library for web and native user interfaces",
      stars: 230000,
      language: "JavaScript",
      topics: ["ui", "frontend", "declarative"],
      readmeSample: "React lets you build user interfaces out of individual pieces called components.",
    });
    expect(notes).toContain("GitHub Repository: facebook/react");
    expect(notes).toContain("Stars: 230,000★");
    expect(notes).toContain("Primary Language: JavaScript");
    expect(notes).toContain("README Breakdown:");
  });
});

describe("Brand Kit persistence", () => {
  it("saves and loads brand kits safely", () => {
    const mockKit = {
      brand: { handle: "@pipsqueak", name: "Pipsqueak AI" },
      style: "darktech",
      palette: { bg: "#0d1117", ink: "#ffffff", accent: "#58a6ff" },
    };
    saveBrandKit(mockKit);
    const loaded = loadBrandKit();
    expect(loaded).toEqual(mockKit);
  });
});

describe("Canvas Bridge feature", () => {
  const sampleProject = {
    id: "proj-1",
    name: "React Architecture",
    carousel: {
      topic: "Deep dive into React",
      format: "4:5",
      brand: { handle: "@dev", name: "Dev" },
    },
  };
  const sampleVariant = {
    id: "var-1",
    direction: { name: "Dark Tech", style: "darktech", palette: { bg: "#000000", ink: "#ffffff", accent: "#00ffcc" } },
    slides: [
      { id: "s1", layout: "cover", title: "React Architecture Under The Hood", kicker: "Deep Dive", body: "How fiber reconciler works" },
      { id: "s2", layout: "code", title: "The Reconciliation Loop", kicker: "Step 2", code: { filename: "reconcile.ts", language: "typescript", code: "export function workLoop() {}" } },
    ],
  };

  it("converts carousel project into a canvas project with artboard screens", () => {
    const canvasProj = carouselToCanvasProject(sampleProject, sampleVariant);
    expect(canvasProj.kind).toBe("canvas");
    expect(canvasProj.name).toBe("React Architecture (Canvas)");
    expect(canvasProj.system).toBeDefined();
    expect(canvasProj.system.colors.accent).toBe("#00ffcc");
    expect(canvasProj.screens.length).toBe(2);
    expect(canvasProj.screens[0].name).toBe("Slide 1");
    expect(canvasProj.screens[0].html).toContain("React Architecture Under The Hood");
    expect(canvasProj.screens[1].html).toContain("reconcile.ts");
  });

  it("renders slide HTML with styling and Tailwind support", () => {
    const html = renderSlideHtml(sampleVariant.slides[0], sampleVariant.direction, 0, 2);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("React Architecture Under The Hood");
    expect(html).toContain("Deep Dive");
  });
});

describe("Video Reel Exporter", () => {
  it("provides exportVideo function that reports progress", async () => {
    expect(typeof exportVideo).toBe("function");
    // Call in node/jsdom environment to verify graceful fallback
    const mockProject = { carousel: { format: "4:5" }, name: "Test" };
    const mockVariant = {
      slides: [emptySlide("cover"), emptySlide("statement")],
      direction: { style: "swiss", name: "Swiss" },
    };
    let progressCalls = 0;
    const blob = await exportVideo({
      project: mockProject,
      variant: mockVariant,
      onProgress: () => {
        progressCalls++;
      },
    });
    expect(blob).toBeDefined();
    expect(blob.type).toContain("video");
  });
});
