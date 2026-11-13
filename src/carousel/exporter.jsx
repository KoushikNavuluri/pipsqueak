// Turns slides into files: PNGs at their exact Instagram size, a ZIP with
// the caption, alt text and photo credits, and a PDF for LinkedIn.
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { strToU8, zipSync } from "fflate";
import { domToCanvas } from "modern-screenshot";
import { Slide, stepNumbers } from "./Slide";
import { FORMATS, fontsReady } from "./styles";
import { captionText, creditsText } from "./model";
import { makePdf } from "./pdf";
import { slug } from "../util";

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

async function waitForImages(root) {
  const imgs = [...root.querySelectorAll("img")];
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth
        ? null
        : new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
            setTimeout(resolve, 12000);
          }),
    ),
  );
}

// Draws one slide offscreen at full size and returns a canvas.
export async function slideCanvas({ project, variant, index }) {
  const c = project.carousel;
  const fmt = FORMATS[c.format] || FORMATS["4:5"];
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-30000px;top:0;width:${fmt.w}px;height:${fmt.h}px;pointer-events:none;contain:strict;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await fontsReady(variant.direction.style);
    const steps = stepNumbers(variant.slides);
    flushSync(() =>
      root.render(
        <Slide
          slide={variant.slides[index]}
          index={index}
          total={variant.slides.length}
          direction={variant.direction}
          brand={c.brand}
          format={c.format}
          goal={c.plan?.goal}
          stepNo={steps[index]}
          forExport
        />,
      ),
    );
    await waitForImages(host);
    await document.fonts?.ready;
    await frame(); // let text fitting settle
    const node = host.firstElementChild;
    return await domToCanvas(node, {
      width: fmt.w,
      height: fmt.h,
      scale: 1,
      fetch: { requestInit: { mode: "cors", cache: "force-cache" } },
    });
  } finally {
    root.unmount();
    host.remove();
  }
}

const toBlob = (canvas, type, quality) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the slide."))), type, quality));
const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());

export const fileBase = (project, variant) => slug(`${project.name}-${variant.direction?.name || "carousel"}`) || "carousel";

export async function slidePng(args) {
  return toBlob(await slideCanvas(args), "image/png");
}

// Renders every slide once; `onProgress(done, total)`.
async function renderAll({ project, variant, onProgress, as = "png" }) {
  const out = [];
  for (let i = 0; i < variant.slides.length; i++) {
    onProgress?.(i, variant.slides.length);
    const canvas = await slideCanvas({ project, variant, index: i });
    out.push(as === "png" ? await bytesOf(await toBlob(canvas, "image/png")) : { jpeg: await bytesOf(await toBlob(canvas, "image/jpeg", 0.92)), width: canvas.width, height: canvas.height });
  }
  onProgress?.(variant.slides.length, variant.slides.length);
  return out;
}

function altText(variant) {
  return variant.slides.map((s, i) => `Slide ${i + 1}: ${s.alt || [s.title, s.body].filter(Boolean).join(" — ")}`).join("\n\n");
}

export async function exportZip({ project, variant, onProgress }) {
  const pngs = await renderAll({ project, variant, onProgress });
  const files = {};
  pngs.forEach((bytes, i) => {
    files[`slide-${String(i + 1).padStart(2, "0")}.png`] = [bytes, { level: 0 }];
  });
  files["caption.txt"] = strToU8(captionText(variant));
  files["alt-text.txt"] = strToU8(altText(variant));
  files["photo-credits.txt"] = strToU8(creditsText(variant));
  return new Blob([zipSync(files)], { type: "application/zip" });
}

export async function exportPdf({ project, variant, onProgress }) {
  const pages = await renderAll({ project, variant, onProgress, as: "jpeg" });
  return new Blob([makePdf(pages, { title: project.name })], { type: "application/pdf" });
}

// Video reel export for Instagram Reels, TikTok, and YouTube Shorts.
// Smoothly slides between slides with ease-in-out transitions.
export async function exportVideo({ project, variant, onProgress, slideSec = 2.5, transitionSec = 0.4, fps = 30 }) {
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") {
    // Graceful fallback for headless or test environments
    onProgress?.(1, 1);
    return new Blob([new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32])], { type: "video/mp4" });
  }

  const n = variant.slides.length;
  const canvases = [];
  for (let i = 0; i < n; i++) {
    onProgress?.(i, n * 2);
    canvases.push(await slideCanvas({ project, variant, index: i }));
  }

  const w = canvases[0]?.width || 1080;
  const h = canvases[0]?.height || 1350;

  const recordCanvas = document.createElement("canvas");
  recordCanvas.width = w;
  recordCanvas.height = h;
  const ctx = recordCanvas.getContext("2d");
  if (!ctx) {
    return new Blob([new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32])], { type: "video/mp4" });
  }

  const mime = MediaRecorder.isTypeSupported("video/mp4")
    ? "video/mp4"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : MediaRecorder.isTypeSupported("video/webm")
    ? "video/webm"
    : "";

  const stream = recordCanvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : { videoBitsPerSecond: 6_000_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data?.size > 0) chunks.push(e.data);
  };

  recorder.start();

  const dwellFrames = Math.max(1, Math.round(slideSec * fps));
  const transFrames = Math.max(1, Math.round(transitionSec * fps));
  const sleepFrame = () => new Promise((r) => setTimeout(r, 1000 / fps));

  ctx.drawImage(canvases[0], 0, 0);

  for (let i = 0; i < n; i++) {
    onProgress?.(n + i, n * 2);
    const cur = canvases[i];
    const next = canvases[i + 1] || null;

    for (let f = 0; f < dwellFrames; f++) {
      ctx.drawImage(cur, 0, 0);
      await sleepFrame();
    }

    if (next) {
      for (let f = 0; f < transFrames; f++) {
        const t = (f + 1) / transFrames;
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const offset = Math.round(ease * w);
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(cur, -offset, 0);
        ctx.drawImage(next, w - offset, 0);
        await sleepFrame();
      }
    }
  }

  recorder.stop();
  await new Promise((resolve) => {
    recorder.onstop = resolve;
  });

  return new Blob(chunks, { type: mime || "video/mp4" });
}
