import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractScreenFlows, setElementNavigation } from "../src/design/flow.js";
import { extractPaletteFromImage, reconstructScreenFromImage } from "../src/ai/vision.js";
import {
  exportDesignTokensJson,
  exportShadcnConfig,
  generateStyleguideScreen,
} from "../src/design/exportDesign.js";
import { getShareStats, recordShareView } from "../src/share.js";

const sampleProject = {
  id: "proj-1",
  name: "Atlas Fleet",
  tagline: "Cold-chain logistics platform",
  spec: { platform: "mobile" },
  system: {
    name: "Precision Dark",
    colors: {
      bg: "#121216",
      surface: "#1E1E24",
      ink: "#FFFFFF",
      primary: "#FFFFFF",
      accent: "#FF4D1A",
      mute: "#8A8A93",
      line: "#2E2E36",
    },
    fonts: {
      display: "Fraunces",
      body: "Geist",
      mono: "Geist Mono",
    },
  },
  screens: [
    {
      id: "home",
      name: "Dashboard",
      html: `
        <div class="p-6">
          <h1>Atlas Control</h1>
          <button data-nav="fleet-details" data-transition="slide">View Fleet</button>
          <a data-nav="settings">Preferences</a>
        </div>
      `,
    },
    {
      id: "fleet-details",
      name: "Fleet Details",
      html: `
        <div class="p-6">
          <h2>Truck 04</h2>
          <button data-nav="home" data-transition="push">Back to Home</button>
        </div>
      `,
    },
    {
      id: "settings",
      name: "Settings",
      html: `<div class="p-6"><h2>Account</h2></div>`,
    },
  ],
};

describe("Feature 1: Interactive Prototyping & Screen Flow Wiring", () => {
  it("extracts all screen flow links between screens", () => {
    const flows = extractScreenFlows(sampleProject.screens);
    expect(flows).toHaveLength(3);

    const homeToFleet = flows.find((f) => f.fromScreenId === "home" && f.toScreenId === "fleet-details");
    expect(homeToFleet).toBeDefined();
    expect(homeToFleet.label).toBe("View Fleet");
    expect(homeToFleet.transition).toBe("slide");

    const fleetToHome = flows.find((f) => f.fromScreenId === "fleet-details" && f.toScreenId === "home");
    expect(fleetToHome).toBeDefined();
    expect(fleetToHome.label).toBe("Back to Home");
    expect(fleetToHome.transition).toBe("push");
  });

  it("links and unlinks elements with data-nav and data-transition", () => {
    const rawHtml = `<div><header>Title</header><button id="btn">Click me</button></div>`;
    // button is child index 1 of body's first div: path [0, 1]
    const linkedHtml = setElementNavigation(rawHtml, [0, 1], "fleet-details", "fade");
    expect(linkedHtml).toContain('data-nav="fleet-details"');
    expect(linkedHtml).toContain('data-transition="fade"');

    // Unlinking removes attributes cleanly
    const unlinkedHtml = setElementNavigation(linkedHtml, [0, 1], null);
    expect(unlinkedHtml).not.toContain("data-nav");
    expect(unlinkedHtml).not.toContain("data-transition");
  });
});

describe("Feature 2: Multiplayer Presence & Collaborator Cursors", () => {
  it("exports usePresence and RemoteCursors modules without error", async () => {
    const { usePresence } = await import("../src/studio/usePresence.js");
    const { RemoteCursors } = await import("../src/studio/RemoteCursors.jsx");
    expect(typeof usePresence).toBe("function");
    expect(typeof RemoteCursors).toBe("object");
  });
});

describe("Feature 3: AI Vision & Screenshot Reconstructor", () => {
  it("reconstructs an image into an editable Tailwind screen", async () => {
    // Generate a 1x1 test PNG data url
    const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const result = await reconstructScreenFromImage(tinyPng, sampleProject);

    expect(result).toBeDefined();
    expect(result.name).toBeDefined();
    expect(result.html).toContain("Live Reconstructed");
    expect(result.html).toContain("Overview & Activity");
    expect(result.palette).toBeDefined();
    expect(result.palette.accent).toBeDefined();
  });
});

describe("Feature 4: Developer Experience & Instant Deploy", () => {
  it("exports structured design tokens JSON including shadcn css variables", () => {
    const tokensJson = exportDesignTokensJson(sampleProject);
    const parsed = JSON.parse(tokensJson);

    expect(parsed.name).toBe("Atlas Fleet");
    expect(parsed.theme.colors.accent).toBe("#FF4D1A");
    expect(parsed.theme.typography.display).toBe("Fraunces");
    expect(parsed.theme.shadcn.cssVars["--accent"]).toBe("#FF4D1A");
  });

  it("exports standalone shadcn and tailwind configuration files", () => {
    const { tailwindConfig, globalsCss } = exportShadcnConfig(sampleProject);
    expect(tailwindConfig).toContain("Fraunces");
    expect(tailwindConfig).toContain("Geist");
    expect(globalsCss).toContain("@tailwind base;");
    expect(globalsCss).toContain("--accent: 14 100% 55%;");
  });

  it("generates an art direction styleguide screen showcasing design tokens and components", () => {
    const styleguide = generateStyleguideScreen(sampleProject);
    expect(styleguide.id).toContain("styleguide");
    expect(styleguide.name).toBe("Design System");
    expect(styleguide.html).toContain("Design System Specimen");
    expect(styleguide.html).toContain("01 · Color Palette");
    expect(styleguide.html).toContain("02 · Typography Scale");
    expect(styleguide.html).toContain("03 · UI Components & States");
  });
});

describe("Feature 5: Collaboration Insights & Voice Prompts", () => {
  it("records share view with screen and dwell time metrics", async () => {
    // Ensure recordShareView runs without throwing
    await expect(recordShareView("test-token", "mobile", "https://google.com", "home", "Dashboard", 4200)).resolves.not.toThrow();
  });

  it("exports useSpeech hook without error", async () => {
    const { useSpeech } = await import("../src/studio/useSpeech.js");
    expect(typeof useSpeech).toBe("function");
  });
});
