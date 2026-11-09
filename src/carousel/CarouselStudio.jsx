// The carousel editor: variations side by side, a swipeable preview, a slide
// strip to reorder, and an inspector for text, photos, design and caption.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crosshair,
  Download,
  FileArchive,
  FileText,
  ImageIcon,
  LoaderCircle,
  Plus,
  Redo2,
  RefreshCw,
  Smartphone,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useProject, useStore } from "../store";
import { Button, Dialog, IconButton, Segmented, Switch, cx, useMedia } from "../ui";
import { inputClass } from "../pages/forms";
import { PipGlyph } from "../brand";
import { useCredits } from "../credits";
import { download, uid } from "../util";
import { FORMATS, STYLES, STYLE_IDS, ensureFonts, safePalette } from "./styles";
import { ScaledSlide, stepNumbers } from "./Slide";
import {
  ITEM_LAYOUTS,
  LAYOUTS,
  MAX_SLIDES,
  PHOTO_LAYOUTS,
  activeVariant,
  captionText,
  creditsOf,
  emptySlide,
  exportWarnings,
  mergeRefined,
  moveSlide,
  needsImage,
  settleLayouts,
  withSlide,
  withVariant,
} from "./model";
import { buildVariant, findImages, isRunning, refineSlides } from "./engine";
import { PhotoPicker } from "./PhotoPicker";

const STATUS = { writing: "Writing slides", images: "Finding photos", ready: "Ready", error: "Failed" };
const TREATMENTS = [
  ["natural", "Natural"],
  ["darken", "Darkened"],
  ["mono", "Black & white"],
  ["duotone", "Duotone"],
  ["grain", "Film grain"],
];
const CONTINUITY = [
  ["none", "None"],
  ["thread", "Line across slides"],
  ["panorama", "Glow across slides"],
];
const QUICK = ["Make the hook punchier", "Shorter text", "More specific examples", "Make it more fun", "Add a surprising fact"];

function useElementWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function Label({ children, hint }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-mute">{children}</span>
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
    </div>
  );
}

const area = "w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm leading-relaxed outline-none transition-colors hover:border-line-strong focus:border-ink/60";
const line = "h-9 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none transition-colors hover:border-line-strong focus:border-ink/60";

// ---------- Inspector: slide ----------

function SlideInspector({ project, variant, slide, index, onEdit, onPhoto, busyImages }) {
  const set = (patch, key) => onEdit((s) => ({ ...s, ...patch }), key);
  const items = slide.items || [];
  const setItem = (i, patch) => set({ items: items.map((it, k) => (k === i ? { ...it, ...patch } : it)) }, `items-${i}`);
  const img = slide.img;
  const pickFocus = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 100);
    const y = Math.round(((e.clientY - r.top) / r.height) * 100);
    set({ img: { ...img, focus: { x, y } } }, "focus");
  };
  return (
    <div className="space-y-5">
      <div>
        <Label>Layout</Label>
        <select value={slide.layout} onChange={(e) => set({ layout: e.target.value, image: { ...slide.image, use: PHOTO_LAYOUTS.has(e.target.value) || slide.image.use } })} className={line} aria-label="Slide layout">
          {LAYOUTS.filter((l) => (index === 0 ? true : l.id !== "cover")).map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Kicker</Label>
        <input value={slide.kicker} onChange={(e) => set({ kicker: e.target.value.slice(0, 32) }, "kicker")} className={line} placeholder="Tiny label above the headline" />
      </div>
      <div>
        <Label hint={`${slide.title.length}/90`}>Headline</Label>
        <textarea value={slide.title} onChange={(e) => set({ title: e.target.value.slice(0, 90) }, "title")} rows={2} className={area} />
        <input value={slide.highlight} onChange={(e) => set({ highlight: e.target.value.slice(0, 40) }, "highlight")} className={cx(line, "mt-1.5 text-[13px]")} placeholder="Words to highlight (copied from the headline)" aria-label="Highlighted words" />
      </div>
      {slide.layout === "stat" && (
        <div className="grid grid-cols-[110px_1fr] gap-2">
          <div>
            <Label>Number</Label>
            <input value={slide.stat.value} onChange={(e) => set({ stat: { ...slide.stat, value: e.target.value.slice(0, 8) } }, "stat")} className={line} />
          </div>
          <div>
            <Label>Measures</Label>
            <input value={slide.stat.label} onChange={(e) => set({ stat: { ...slide.stat, label: e.target.value.slice(0, 60) } }, "stat-label")} className={line} />
          </div>
        </div>
      )}
      {slide.layout === "quote" && (
        <div className="space-y-2">
          <Label>Quote</Label>
          <textarea value={slide.quote.text} onChange={(e) => set({ quote: { ...slide.quote, text: e.target.value.slice(0, 180) } }, "quote")} rows={3} className={area} />
          <input value={slide.quote.by} onChange={(e) => set({ quote: { ...slide.quote, by: e.target.value.slice(0, 60) } }, "quote-by")} className={line} placeholder="Who said it" />
        </div>
      )}
      <div>
        <Label hint={`${slide.body.length}/220`}>Body</Label>
        <textarea value={slide.body} onChange={(e) => set({ body: e.target.value.slice(0, 220) }, "body")} rows={3} className={area} />
      </div>
      {ITEM_LAYOUTS.has(slide.layout) && slide.layout !== "step" && (
        <div>
          <Label hint={slide.layout === "compare" ? "left, then right" : "up to 6"}>Items</Label>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex gap-1.5">
                <input value={it.label} onChange={(e) => setItem(i, { label: e.target.value.slice(0, 28) })} className={cx(line, "w-28 shrink-0")} placeholder="Label" aria-label={`Item ${i + 1} label`} />
                <input value={it.text} onChange={(e) => setItem(i, { text: e.target.value.slice(0, 100) })} className={line} placeholder="Text" aria-label={`Item ${i + 1} text`} />
                {slide.layout !== "compare" && <IconButton icon={X} label={`Remove item ${i + 1}`} size={36} iconSize={14} onClick={() => set({ items: items.filter((_, k) => k !== i) })} />}
              </div>
            ))}
            {slide.layout !== "compare" && items.length < 6 && (
              <Button variant="ghost" size="sm" icon={Plus} onClick={() => set({ items: [...items, { label: "", text: "" }] })}>
                Add item
              </Button>
            )}
          </div>
        </div>
      )}
      <div>
        <Label>Source</Label>
        <input value={slide.source} onChange={(e) => set({ source: e.target.value.slice(0, 80) }, "source")} className={line} placeholder="For numbers and quotes, e.g. Pew Research, 2024" />
      </div>

      <div className="rounded-2xl border border-line p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold">Photo</span>
          <label className="flex items-center gap-2 text-xs text-mute">
            Show
            <Switch on={!!slide.image.use} onChange={(v) => set({ image: { ...slide.image, use: v } })} label="Show a photo on this slide" />
          </label>
        </div>
        {slide.image.use && (
          <div className="mt-3">
            {img?.src ? (
              <>
                <button type="button" onClick={pickFocus} title="Click the subject to keep it in frame" className="relative block aspect-[4/3] w-full cursor-crosshair overflow-hidden rounded-xl bg-sunken">
                  <img src={img.src} alt="" className="h-full w-full object-contain" crossOrigin="anonymous" />
                  <span className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black/40 text-white shadow" style={{ left: `${img.focus?.x ?? 50}%`, top: `${img.focus?.y ?? 45}%` }}>
                    <Crosshair size={14} />
                  </span>
                </button>
                <p className="mt-1.5 text-[11px] leading-snug text-mute">
                  Click the subject to keep it in frame. {img.credit && <>From {img.page ? <a href={img.page} target="_blank" rel="noreferrer noopener" className="underline hover:text-ink">{img.credit}</a> : img.credit}</>}
                  {img.license && <span className="block text-faint">{img.license}</span>}
                </p>
              </>
            ) : busyImages ? (
              <div className="flex aspect-[4/3] items-center justify-center gap-2 rounded-xl bg-sunken text-sm text-mute">
                <LoaderCircle size={16} className="animate-spin" /> Finding a photo…
              </div>
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-dashed border-line-strong text-center text-sm text-mute">
                <ImageIcon size={20} />
                <span className="mt-1">No photo yet</span>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button variant="secondary" size="sm" icon={ImageIcon} onClick={onPhoto}>
                {img?.src ? "Swap photo" : "Choose photo"}
              </Button>
              {img?.src && (
                <Button variant="ghost" size="sm" onClick={() => set({ img: null })}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      <div>
        <Label>Alt text</Label>
        <textarea value={slide.alt} onChange={(e) => set({ alt: e.target.value.slice(0, 300) }, "alt")} rows={2} className={area} placeholder="Describes the slide for screen readers" />
      </div>
    </div>
  );
}

// ---------- Inspector: design ----------

function DesignInspector({ project, variant, onEditVariant, onEditCarousel }) {
  const d = variant.direction;
  const pal = safePalette(d.palette, d.style);
  const c = project.carousel;
  const setDir = (patch, key) => onEditVariant((v) => ({ ...v, direction: { ...v.direction, ...patch } }), key);
  useEffect(() => STYLE_IDS.forEach(ensureFonts), []);
  const cover = variant.slides[0];
  return (
    <div className="space-y-6">
      <div>
        <Label hint="same words, new look">Style</Label>
        <div className="grid grid-cols-2 gap-2">
          {STYLE_IDS.map((id) => (
            <button
              key={id}
              onClick={() => setDir({ style: id, palette: STYLES[id].sample })}
              aria-pressed={d.style === id}
              className={cx("group overflow-hidden rounded-xl border text-left transition-[border-color,box-shadow]", d.style === id ? "border-ink shadow-[0_0_0_2px_rgba(23,21,15,.12)]" : "border-line hover:border-line-strong")}
            >
              {cover && (
                <ScaledSlide width={138} slide={{ ...cover, img: cover.img }} index={0} total={variant.slides.length} direction={{ ...d, style: id, palette: STYLES[id].sample, continuity: "none" }} brand={c.brand} format={c.format} />
              )}
              <span className="block px-2 py-1.5 text-xs font-medium">{STYLES[id].name}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label hint="kept readable automatically">Colors</Label>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["bg", "Background"],
            ["ink", "Text"],
            ["accent", "Accent"],
            ["muted", "Soft text"],
            ["surface", "Cards"],
            ["onAccent", "On accent"],
          ].map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 rounded-xl border border-line px-2 py-1.5 text-xs">
              <input type="color" value={pal[k]} onChange={(e) => setDir({ palette: { ...d.palette, [k]: e.target.value.toUpperCase() } }, `color-${k}`)} className="h-6 w-6 cursor-pointer rounded-md border-0 bg-transparent p-0" aria-label={label} />
              <span className="truncate">{label}</span>
            </label>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="mt-1.5" icon={RefreshCw} onClick={() => setDir({ palette: STYLES[d.style].sample })}>
          Use the style's colors
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Photo look</Label>
          <select value={d.treatment} onChange={(e) => setDir({ treatment: e.target.value })} className={line} aria-label="Photo look">
            {TREATMENTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Flow</Label>
          <select value={d.continuity} onChange={(e) => setDir({ continuity: e.target.value })} className={line} aria-label="Shape across slides">
            {CONTINUITY.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label>Format</Label>
        <Segmented id="studio-format" size="sm" value={c.format} onChange={(v) => onEditCarousel((cc) => ({ ...cc, format: v }))} options={Object.entries(FORMATS).map(([value, f]) => ({ value, label: value, aria: f.note }))} />
        <p className="mt-1 text-[11px] text-faint">{FORMATS[c.format]?.note}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Handle</Label>
          <input value={c.brand?.handle || ""} onChange={(e) => onEditCarousel((cc) => ({ ...cc, brand: { ...cc.brand, handle: e.target.value.slice(0, 31) } }), "handle")} className={line} placeholder="@handle" />
        </div>
        <div>
          <Label>Name</Label>
          <input value={c.brand?.name || ""} onChange={(e) => onEditCarousel((cc) => ({ ...cc, brand: { ...cc.brand, name: e.target.value.slice(0, 40) } }), "brand-name")} className={line} placeholder="Brand" />
        </div>
      </div>
    </div>
  );
}

// ---------- Inspector: caption ----------

function CopyButton({ text, label }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      icon={done ? Check : Copy}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {}
      }}
    >
      {done ? "Copied" : label}
    </Button>
  );
}

function CaptionInspector({ variant, onEditVariant }) {
  const credits = creditsOf(variant);
  return (
    <div className="space-y-5">
      <div>
        <Label hint={`${variant.caption.length}/2200`}>Caption</Label>
        <textarea value={variant.caption} onChange={(e) => onEditVariant((v) => ({ ...v, caption: e.target.value.slice(0, 2200) }), "caption")} rows={9} className={area} />
      </div>
      <div>
        <Label>Hashtags</Label>
        <input
          value={(variant.hashtags || []).map((h) => "#" + h).join(" ")}
          onChange={(e) => onEditVariant((v) => ({ ...v, hashtags: e.target.value.split(/[\s,]+/).map((h) => h.replace(/^#+/, "")).filter(Boolean).slice(0, 30) }), "tags")}
          className={line}
        />
      </div>
      <CopyButton text={captionText(variant)} label="Copy caption and hashtags" />
      <div>
        <Label>Photo credits</Label>
        {credits.length ? (
          <ul className="space-y-1.5 text-xs text-ink-2">
            {credits.map((r) => (
              <li key={r.slide} className="leading-snug">
                <span className="font-medium">Slide {r.slide}:</span> {r.page ? <a href={r.page} target="_blank" rel="noreferrer noopener" className="underline hover:text-ink">{r.credit || "source"}</a> : r.credit}
                {r.license && <span className="block text-faint">{r.license}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-mute">No photos in this carousel.</p>
        )}
      </div>
    </div>
  );
}

// ---------- Export ----------

function ExportDialog({ project, variant, index, onClose }) {
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const warnings = exportWarnings(variant);
  const run = async (kind) => {
    setBusy(kind);
    setError("");
    try {
      const { exportZip, exportPdf, slidePng, fileBase } = await import("./exporter");
      const base = fileBase(project, variant);
      const onProgress = (done, total) => setProgress({ done, total });
      if (kind === "zip") download(await exportZip({ project, variant, onProgress }), `${base}.zip`);
      if (kind === "pdf") download(await exportPdf({ project, variant, onProgress }), `${base}.pdf`);
      if (kind === "png") download(await slidePng({ project, variant, index }), `${base}-slide-${String(index + 1).padStart(2, "0")}.png`);
    } catch (err) {
      console.error("Export failed", err);
      setError(err.message || "Export failed. Try again.");
    } finally {
      setBusy("");
      setProgress(null);
    }
  };
  const fmt = FORMATS[project.carousel.format];
  const options = [
    { id: "zip", icon: FileArchive, title: "Instagram carousel", text: `${variant.slides.length} PNGs at ${fmt.w} × ${fmt.h}, plus caption, alt text and photo credits, in a ZIP` },
    { id: "pdf", icon: FileText, title: "LinkedIn document", text: "One PDF; LinkedIn shows it as a swipeable carousel" },
    { id: "png", icon: ImageIcon, title: `This slide only`, text: `Slide ${index + 1} as a PNG` },
  ];
  return (
    <Dialog title="Export" description={variant.direction.name} onClose={busy ? () => {} : onClose}>
      {warnings.length > 0 && (
        <ul className="mb-4 space-y-1.5 rounded-xl bg-[#FFF4E5] px-3.5 py-3 text-[13px] leading-snug text-[#7A4A00]">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        {options.map((o) => (
          <button key={o.id} onClick={() => run(o.id)} disabled={!!busy} className="flex w-full items-center gap-3.5 rounded-2xl border border-line p-3.5 text-left transition-colors hover:border-line-strong hover:bg-wash disabled:opacity-60">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sunken">{busy === o.id ? <LoaderCircle size={18} className="animate-spin" /> : <o.icon size={18} />}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{o.title}</span>
              <span className="block text-[13px] text-mute">{busy === o.id && progress ? `Rendering slide ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : o.text}</span>
            </span>
            <Download size={16} className="text-mute" />
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line-soft pt-4">
        <span className="text-[13px] text-mute">Caption with hashtags</span>
        <CopyButton text={captionText(variant)} label="Copy caption" />
      </div>
      {error && <p className="mt-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{error}</p>}
    </Dialog>
  );
}

// ---------- Phone preview ----------

function PhonePreview({ project, variant, index, setIndex, onClose }) {
  const c = project.carousel;
  const steps = stepNumbers(variant.slides);
  const fmt = FORMATS[c.format];
  const width = Math.min(380, typeof window !== "undefined" ? window.innerWidth - 40 : 380);
  const go = (n) => setIndex(Math.max(0, Math.min(variant.slides.length - 1, n)));
  useEffect(() => {
    const key = (e) => {
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  return (
    <Dialog title="Feed preview" description="Swipe or use the arrow keys" onClose={onClose} size="sm">
      <div className="mx-auto overflow-hidden rounded-[28px] border border-line bg-white shadow-lift" style={{ width }}>
        <div className="flex items-center gap-2.5 px-3.5 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">{(c.brand?.name || c.brand?.handle || "P").replace("@", "").slice(0, 1).toUpperCase()}</span>
          <span className="text-[13px] font-semibold">{(c.brand?.handle || "yourhandle").replace("@", "")}</span>
        </div>
        <div className="relative overflow-hidden" style={{ width, height: (fmt.h / fmt.w) * width }}>
          <motion.div
            className="flex"
            drag="x"
            dragConstraints={{ left: -(variant.slides.length - 1) * width, right: 0 }}
            animate={{ x: -index * width }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -50 || info.velocity.x < -400) go(index + 1);
              else if (info.offset.x > 50 || info.velocity.x > 400) go(index - 1);
            }}
            style={{ width: width * variant.slides.length, touchAction: "pan-y" }}
          >
            {variant.slides.map((s, i) => (
              <ScaledSlide key={s.id} width={width} slide={s} index={i} total={variant.slides.length} direction={variant.direction} brand={c.brand} format={c.format} goal={c.plan?.goal} stepNo={steps[i]} />
            ))}
          </motion.div>
        </div>
        <div className="flex justify-center gap-1 py-2.5">
          {variant.slides.map((s, i) => (
            <button key={s.id} onClick={() => go(i)} aria-label={`Slide ${i + 1}`} className={cx("h-1.5 w-1.5 rounded-full transition-colors", i === index ? "bg-[#3897F0]" : "bg-black/20")} />
          ))}
        </div>
        <p className="line-clamp-3 px-3.5 pb-4 text-[13px] leading-snug">
          <span className="font-semibold">{(c.brand?.handle || "yourhandle").replace("@", "")}</span> {variant.caption}
        </p>
      </div>
    </Dialog>
  );
}

// ---------- Studio ----------

export function CarouselStudio() {
  const { s, api } = useStore();
  const project = useProject();
  const c = project?.carousel;
  const variant = activeVariant(project);
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState("slide");
  const [picker, setPicker] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [phone, setPhone] = useState(false);
  const [ask, setAsk] = useState("");
  const [scope, setScope] = useState("slide");
  const [asking, setAsking] = useState(false);
  const [imagesBusy, setImagesBusy] = useState(false);
  const stage = useRef(null);
  const stageW = useElementWidth(stage);
  const wide = useMedia("(min-width: 1024px)");
  const { left } = useCredits(asking || imagesBusy ? 1 : 0);

  const slides = variant?.slides || [];
  const slide = slides[Math.min(index, slides.length - 1)] || null;
  const steps = useMemo(() => stepNumbers(slides), [slides]);

  useEffect(() => {
    if (index > slides.length - 1) setIndex(Math.max(0, slides.length - 1));
  }, [slides.length]);
  useEffect(() => {
    if (variant?.direction?.style) ensureFonts(variant.direction.style);
  }, [variant?.direction?.style]);

  const editProject = useCallback((fn, key) => api.edit(project.id, fn, key ? { key: `${project.id}:${key}` } : {}), [api, project?.id]);
  const editVariant = useCallback((fn, key) => editProject((p) => withVariant(p, variant.id, fn), key && `${variant.id}:${key}`), [editProject, variant?.id]);
  const editSlide = useCallback((fn, key) => editProject((p) => withSlide(p, variant.id, slide.id, fn), key && `${slide.id}:${key}`), [editProject, variant?.id, slide?.id]);
  const editCarousel = useCallback((fn, key) => editProject((p) => ({ ...p, carousel: fn(p.carousel) }), key), [editProject]);

  // Keyboard: arrows move between slides (outside text fields), undo/redo.
  useEffect(() => {
    const key = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        e.shiftKey ? api.redo(project.id) : api.undo(project.id);
        return;
      }
      if (typing || phone || picker || exporting) return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(slides.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [slides.length, phone, picker, exporting, project?.id]);

  if (!project || !c || !variant) return null;

  const busy = variant.status === "writing" || variant.status === "images";
  const interrupted = busy && !isRunning(variant.id);
  const hist = s.hist[project.id];

  const resume = () => {
    if (!variant.slides.length) buildVariant({ api, projectId: project.id, variantId: variant.id, request: { quality: s.data.prefs.aiQuality } });
    else {
      setImagesBusy(true);
      findImages({ api, projectId: project.id, variantId: variant.id })
        .catch((err) => api.toast(err.message, { tone: "error" }))
        .finally(() => {
          editVariant((v) => ({ ...v, status: "ready" }));
          setImagesBusy(false);
        });
    }
  };

  const regenerate = () => {
    editVariant((v) => ({ ...v, slides: [], status: "writing", error: "" }));
    setIndex(0);
    setTimeout(() => buildVariant({ api, projectId: project.id, variantId: variant.id, request: { quality: s.data.prefs.aiQuality } }), 0);
  };

  const addSlide = () => {
    if (slides.length >= MAX_SLIDES) return api.toast(`Instagram allows ${MAX_SLIDES} slides at most`, { tone: "error" });
    const at = Math.min(index + 1, slides.length - 1);
    editVariant((v) => ({ ...v, slides: settleLayouts([...v.slides.slice(0, at), emptySlide("statement"), ...v.slides.slice(at)]) }));
    setIndex(at);
  };
  const dupSlide = (i) => {
    if (slides.length >= MAX_SLIDES) return;
    editVariant((v) => ({ ...v, slides: settleLayouts([...v.slides.slice(0, i + 1), { ...v.slides[i], id: uid() }, ...v.slides.slice(i + 1)]) }));
    setIndex(i + 1);
  };
  const delSlide = (i) => {
    if (slides.length <= 2) return api.toast("A carousel needs at least 2 slides", { tone: "error" });
    editVariant((v) => ({ ...v, slides: settleLayouts(v.slides.filter((_, k) => k !== i)) }));
    api.toast("Slide deleted", { action: { label: "Undo", run: () => api.undo(project.id) } });
  };

  const askPip = async (instruction = ask) => {
    if (instruction.trim().length < 2 || asking) return;
    setAsking(true);
    try {
      const snapshot = variant.slides;
      const result = await refineSlides({ project, variant, instruction: instruction.trim(), slideIndex: scope === "slide" ? index : null, quality: s.data.prefs.aiQuality });
      const next = mergeRefined(snapshot, result.slides);
      editVariant((v) => ({ ...v, slides: next }));
      setAsk("");
      api.toast(result.note || "Done", { tone: "success", action: { label: "Undo", run: () => api.undo(project.id) } });
      const missing = needsImage(next);
      if (missing.length) {
        setImagesBusy(true);
        findImages({ api, projectId: project.id, variantId: variant.id, only: missing, slides: next })
          .catch((err) => api.toast(err.message, { tone: "error" }))
          .finally(() => setImagesBusy(false));
      }
    } catch (err) {
      api.toast(err.message || "Pip couldn't make that change.", { tone: "error" });
    } finally {
      setAsking(false);
    }
  };

  const previewW = Math.max(220, Math.min(stageW - 120, wide ? 520 : 440, (window.innerHeight - 330) * (FORMATS[c.format].w / FORMATS[c.format].h)));

  return (
    <div className="flex h-full flex-col bg-canvas">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-paper/90 px-2 backdrop-blur sm:px-3">
        <IconButton icon={ArrowLeft} label="Back to designs" onClick={() => api.home()} />
        <input
          value={project.name}
          onChange={(e) => api.edit(project.id, (p) => ({ ...p, name: e.target.value.slice(0, 40) }), { silent: true })}
          aria-label="Carousel name"
          className="min-w-0 max-w-[40vw] flex-1 truncate rounded-lg bg-transparent px-2 py-1 text-[15px] font-semibold outline-none hover:bg-sunken focus:bg-surface sm:max-w-xs"
        />
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-mute md:inline-flex">
            <PipGlyph size={10} /> {left}
          </span>
          <IconButton icon={Undo2} label="Undo" disabled={!hist?.past.length} onClick={() => api.undo(project.id)} />
          <IconButton icon={Redo2} label="Redo" disabled={!hist?.future.length} onClick={() => api.redo(project.id)} />
          <Button variant="secondary" size="sm" icon={Smartphone} className="hidden sm:inline-flex" onClick={() => setPhone(true)} disabled={!slides.length}>
            Preview
          </Button>
          <Button variant="primary" size="sm" icon={Download} onClick={() => setExporting(true)} disabled={!slides.length || busy}>
            Export
          </Button>
        </div>
      </header>

      {/* Variations */}
      <div className="nosb flex shrink-0 items-center gap-2 overflow-x-auto border-b border-line-soft bg-paper/60 px-3 py-2">
        {c.variants.map((v) => {
          const on = v.id === variant.id;
          const st = STYLES[v.direction.style] || STYLES.editorial;
          return (
            <button
              key={v.id}
              onClick={() => {
                editCarousel((cc) => ({ ...cc, active: v.id }));
                setIndex(0);
              }}
              aria-pressed={on}
              className={cx("flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[13px] transition-colors", on ? "border-ink bg-surface font-medium" : "border-transparent text-ink-2 hover:bg-surface")}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: safePalette(v.direction.palette, v.direction.style).bg, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.1)" }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: safePalette(v.direction.palette, v.direction.style).accent }} />
              </span>
              {v.direction.name}
              <span className="text-faint">· {st.name}</span>
              {(v.status === "writing" || v.status === "images") && isRunning(v.id) && <LoaderCircle size={13} className="animate-spin text-accent" />}
              {v.status === "error" && <span className="h-2 w-2 rounded-full bg-danger" title={v.error} />}
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Stage */}
        <main ref={stage} className="sb flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pb-4 pt-5">
          {variant.status === "error" && !slides.length ? (
            <div className="mt-16 max-w-sm text-center">
              <p className="text-[15px] font-semibold">This variation didn't come through</p>
              <p className="mt-1 text-sm text-mute">{variant.error}</p>
              <Button className="mt-4" icon={RefreshCw} onClick={regenerate}>
                Try again
              </Button>
            </div>
          ) : !slides.length ? (
            <div className="mt-6 flex flex-col items-center">
              <div className="animate-pulse rounded-2xl bg-sunken" style={{ width: previewW, height: previewW * (FORMATS[c.format].h / FORMATS[c.format].w) }} />
              <p className="mt-4 flex items-center gap-2 text-sm text-mute">
                {interrupted ? (
                  <>
                    Generation stopped before it finished.
                    <Button size="sm" variant="secondary" icon={RefreshCw} onClick={resume}>
                      Resume
                    </Button>
                  </>
                ) : (
                  <>
                    <LoaderCircle size={15} className="animate-spin text-accent" /> Pip is writing “{variant.direction.name}”…
                  </>
                )}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <IconButton icon={ChevronLeft} label="Previous slide" disabled={index === 0} onClick={() => setIndex(index - 1)} />
                <div className="overflow-hidden rounded-[18px] shadow-lift ring-1 ring-black/5">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div key={slide.id} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
                      <ScaledSlide width={previewW} slide={slide} index={index} total={slides.length} direction={variant.direction} brand={c.brand} format={c.format} goal={c.plan?.goal} stepNo={steps[index]} />
                    </motion.div>
                  </AnimatePresence>
                </div>
                <IconButton icon={ChevronRight} label="Next slide" disabled={index >= slides.length - 1} onClick={() => setIndex(index + 1)} />
              </div>
              <p className="mt-2.5 flex items-center gap-2 text-xs text-mute">
                Slide {index + 1} of {slides.length} · {LAYOUTS.find((l) => l.id === slide.layout)?.label}
                {(variant.status === "images" || imagesBusy) && !interrupted && (
                  <span className="flex items-center gap-1.5 text-accent">
                    <LoaderCircle size={12} className="animate-spin" /> finding photos
                  </span>
                )}
                {interrupted && (
                  <button onClick={resume} className="text-accent underline">
                    Finish finding photos
                  </button>
                )}
              </p>

              {/* Filmstrip */}
              <div className="mt-4 w-full max-w-full">
                <Reorder.Group
                  axis="x"
                  values={slides}
                  onReorder={(next) => {
                    const cur = slide?.id;
                    editVariant((v) => ({ ...v, slides: settleLayouts(next) }), "reorder");
                    const ni = next.findIndex((x) => x.id === cur);
                    if (ni >= 0) setIndex(ni);
                  }}
                  className="nosb mx-auto flex w-fit max-w-full gap-2.5 overflow-x-auto px-1 pb-2 pt-1"
                >
                  {slides.map((sl, i) => (
                    <Reorder.Item key={sl.id} value={sl} className="group relative shrink-0" whileDrag={{ scale: 1.05, zIndex: 10 }}>
                      <button onClick={() => setIndex(i)} aria-label={`Slide ${i + 1}`} aria-current={i === index} className={cx("block overflow-hidden rounded-lg ring-offset-2 ring-offset-canvas transition", i === index ? "ring-2 ring-ink" : "opacity-80 hover:opacity-100")}>
                        <ScaledSlide width={78} slide={sl} index={i} total={slides.length} direction={variant.direction} brand={c.brand} format={c.format} goal={c.plan?.goal} stepNo={steps[i]} />
                      </button>
                      <span className="pointer-events-none absolute -bottom-0.5 left-1 font-mono text-[10px] text-mute">{i + 1}</span>
                      <span className="absolute -right-1.5 -top-1.5 hidden gap-0.5 group-hover:flex group-focus-within:flex">
                        <button onClick={() => dupSlide(i)} aria-label={`Duplicate slide ${i + 1}`} className="flex h-5 w-5 items-center justify-center rounded-full bg-surface shadow ring-1 ring-black/10 hover:bg-wash">
                          <Copy size={10} />
                        </button>
                        <button onClick={() => delSlide(i)} aria-label={`Delete slide ${i + 1}`} className="flex h-5 w-5 items-center justify-center rounded-full bg-surface text-danger shadow ring-1 ring-black/10 hover:bg-wash">
                          <Trash2 size={10} />
                        </button>
                      </span>
                    </Reorder.Item>
                  ))}
                  <button onClick={addSlide} aria-label="Add a slide" className="flex shrink-0 items-center justify-center rounded-lg border border-dashed border-line-strong text-mute transition-colors hover:border-ink hover:text-ink" style={{ width: 78, height: 78 * (FORMATS[c.format].h / FORMATS[c.format].w) }}>
                    <Plus size={18} />
                  </button>
                </Reorder.Group>
              </div>

              {/* Ask Pip */}
              <div className="mt-3 w-full max-w-2xl rounded-2xl border border-line bg-surface p-2 shadow-soft">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    askPip();
                  }}
                  className="flex items-center gap-2"
                >
                  <Segmented id="ask-scope" size="sm" value={scope} onChange={setScope} options={[{ value: "slide", label: "This slide" }, { value: "all", label: "All slides" }]} />
                  <input value={ask} onChange={(e) => setAsk(e.target.value)} disabled={asking} placeholder={scope === "slide" ? "Ask Pip to change this slide…" : "Ask Pip to change the carousel…"} className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-faint" aria-label="Instruction for Pip" />
                  <Button type="submit" size="sm" variant="accent" icon={asking ? LoaderCircle : Sparkles} disabled={asking || ask.trim().length < 2}>
                    {asking ? "Working" : "Ask"}
                  </Button>
                </form>
                <div className="nosb mt-1.5 flex gap-1.5 overflow-x-auto px-1">
                  {QUICK.map((q) => (
                    <button key={q} disabled={asking} onClick={() => askPip(q)} className="shrink-0 rounded-full bg-sunken px-2.5 py-1 text-[11px] text-ink-2 transition-colors hover:text-ink disabled:opacity-50">
                      {q}
                    </button>
                  ))}
                  <button disabled={busy} onClick={regenerate} className="shrink-0 rounded-full px-2.5 py-1 text-[11px] text-mute underline-offset-2 hover:text-ink hover:underline disabled:opacity-50">
                    Rewrite this variation · 2–3 credits
                  </button>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Inspector */}
        <aside className="sb shrink-0 overflow-y-auto border-t border-line bg-surface lg:w-[340px] lg:border-l lg:border-t-0">
          <div className="sticky top-0 z-10 border-b border-line-soft bg-surface/95 px-4 py-2.5 backdrop-blur">
            <Segmented id="inspector-tab" full size="sm" value={tab} onChange={setTab} options={[{ value: "slide", label: "Slide" }, { value: "design", label: "Design" }, { value: "caption", label: "Caption" }]} />
          </div>
          <div className="p-4">
            {tab === "slide" && slide && <SlideInspector key={slide.id} project={project} variant={variant} slide={slide} index={index} onEdit={editSlide} onPhoto={() => setPicker(true)} busyImages={(variant.status === "images" && isRunning(variant.id)) || imagesBusy} />}
            {tab === "slide" && !slide && <p className="text-sm text-mute">Slides appear here as Pip writes them.</p>}
            {tab === "design" && <DesignInspector project={project} variant={variant} onEditVariant={editVariant} onEditCarousel={editCarousel} />}
            {tab === "caption" && <CaptionInspector variant={variant} onEditVariant={editVariant} />}
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {picker && slide && (
          <PhotoPicker
            key="picker"
            project={project}
            variant={variant}
            slide={slide}
            onClose={() => setPicker(false)}
            onPick={(img) => {
              const id = slide.id;
              editProject((p) => withSlide(p, variant.id, id, (sl) => ({ ...sl, img, image: { ...sl.image, use: true } })));
            }}
          />
        )}
        {exporting && <ExportDialog key="export" project={project} variant={variant} index={index} onClose={() => setExporting(false)} />}
        {phone && <PhonePreview key="phone" project={project} variant={variant} index={index} setIndex={setIndex} onClose={() => setPhone(false)} />}
      </AnimatePresence>
    </div>
  );
}
