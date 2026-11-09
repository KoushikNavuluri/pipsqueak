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
