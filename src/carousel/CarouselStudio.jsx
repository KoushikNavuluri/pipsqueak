// The carousel editor.
//
// Desktop (lg and up): a slide rail on the left, the stage in the middle and
// the inspector on the right, each scrolling on its own.
// Tablet and phone: one scrolling column. The slide comes first (swipe to
// move between slides), then the slide strip, Ask Pip and the inspector.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Crosshair,
  Download,
  FileArchive,
  FileText,
  ImageIcon,
  LayoutGrid,
  LoaderCircle,
  Plus,
  Redo2,
  RefreshCw,
  Search,
  Smartphone,
  Sparkles,
  Trash2,
  Undo2,
  Video,
  X,
  Zap,
} from "lucide-react";
import { useProject, useStore } from "../store";
import { Button, Dialog, IconButton, Segmented, Switch, cx, useMedia } from "../ui";
import { PipGlyph } from "../brand";
import { useCredits } from "../credits";
import { download, uid } from "../util";
import { FORMATS, STYLES, STYLE_GROUPS, STYLE_IDS, ensureFonts, safePalette } from "./styles";
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
  loadBrandKit,
  mergeRefined,
  needsImage,
  saveBrandKit,
  settleLayouts,
  withSlide,
  withVariant,
} from "./model";
import { buildVariant, findImages, isRunning, refineSlides, resumeVariant } from "./engine";
import { PhotoPicker } from "./PhotoPicker";
import { carouselToCanvasProject } from "./bridge";

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
const BUSY = new Set(["writing", "images"]);

function useElementSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function Label({ children, hint }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-mute">{children}</span>
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
    </div>
  );
}

function Section({ title, children, action }) {
  return (
    <section className="border-b border-line-soft px-4 py-5 last:border-0 sm:px-5">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-[13px] font-semibold text-ink">{title}</h3>}
          {action}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

const area = "w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm leading-relaxed outline-none transition-colors hover:border-line-strong focus:border-ink/60";
const line = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none transition-colors hover:border-line-strong focus:border-ink/60";

// ---------- Inspector: slide ----------

function PhotoPanel({ slide, onEdit, onPhoto, onRetry, searching }) {
  const img = slide.img;
  const set = (patch, key) => onEdit((s) => ({ ...s, ...patch }), key);
  const pickFocus = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 100);
    const y = Math.round(((e.clientY - r.top) / r.height) * 100);
    set({ img: { ...img, focus: { x, y } } }, "focus");
  };
  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-ink-2">Show a photo on this slide</span>
        <Switch on={!!slide.image.use} onChange={(v) => set({ image: { ...slide.image, use: v, status: v && !img?.src ? "empty" : slide.image.status } })} label="Show a photo on this slide" />
      </label>
      {slide.image.use &&
        (img?.src ? (
          <>
            <button type="button" onClick={pickFocus} title="Click the subject to keep it in frame" className="relative block aspect-[4/3] w-full cursor-crosshair overflow-hidden rounded-xl bg-sunken">
              <img src={img.src} alt="" className="h-full w-full object-contain" crossOrigin="anonymous" />
              <span className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black/40 text-white shadow" style={{ left: `${img.focus?.x ?? 50}%`, top: `${img.focus?.y ?? 45}%` }}>
                <Crosshair size={14} />
              </span>
            </button>
            <p className="text-[12px] leading-snug text-mute">
              Click the subject to keep it in frame.{" "}
              {img.credit && (
                <>
                  From{" "}
                  {img.page ? (
                    <a href={img.page} target="_blank" rel="noreferrer noopener" className="underline hover:text-ink">
                      {img.credit}
                    </a>
                  ) : (
                    img.credit
                  )}
                  .
                </>
              )}
              {img.license && <span className="block text-faint">{img.license}</span>}
            </p>
          </>
        ) : searching ? (
          <div className="flex aspect-[4/3] items-center justify-center gap-2 rounded-xl bg-sunken text-sm text-mute">
            <LoaderCircle size={16} className="animate-spin" /> Finding a photo…
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line-strong p-4 text-[13px] leading-relaxed text-mute">
            <p className="flex items-center gap-2 font-medium text-ink-2">
              <AlertCircle size={15} /> No good photo found yet
            </p>
            <p className="mt-1">This slide shows as text until you choose one.</p>
          </div>
        ))}
      {slide.image.use && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={ImageIcon} onClick={onPhoto}>
            {img?.src ? "Swap photo" : "Choose photo"}
          </Button>
          {!img?.src && !searching && (
            <Button variant="ghost" size="sm" icon={Search} onClick={onRetry}>
              Search again
            </Button>
          )}
          {img?.src && (
            <Button variant="ghost" size="sm" onClick={() => set({ img: null, image: { ...slide.image, status: "none" } })}>
              Remove
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function HookLabModal({ topic, currentTitle, onApply, onClose }) {
  const t = topic || currentTitle || "Your Topic";
  const cleanTopic = t.replace(/^Why\s+/i, "").replace(/^How\s+to\s+/i, "").replace(/[?.!]+$/, "");

  const hooks = [
    {
      id: "contrarian",
      badge: "Contrarian / Unpopular Truth",
      icon: "🎯",
      kicker: "Unpopular truth",
      title: `Stop doing ${cleanTopic.slice(0, 35)} the traditional way.`,
      why: "Creates an immediate controversy frame that stops people mid-scroll.",
    },
    {
      id: "curiosity",
      badge: "Curiosity Gap",
      icon: "🔍",
      kicker: "The hidden truth",
      title: `The 1 pattern behind ${cleanTopic.slice(0, 38)} that changes everything.`,
      why: "Triggers psychological curiosity; users swipe to close the information gap.",
    },
    {
      id: "datashock",
      badge: "Data & Stat Shock",
      icon: "📊",
      kicker: "By the numbers",
      title: `90% of people get ${cleanTopic.slice(0, 38)} completely wrong.`,
      why: "High perceived value and authority; prompts readers to verify where they stand.",
    },
    {
      id: "architecture",
      badge: "Engineering Deep Dive",
      icon: "⚡",
      kicker: "Under the hood",
      title: `Inside ${cleanTopic.slice(0, 38)}: What really happens behind the scenes.`,
      why: "Appeals to developers and technical builders who want depth over fluff.",
    },
    {
      id: "blueprint",
      badge: "The Complete Blueprint",
      icon: "🚀",
      kicker: "Step-by-step",
      title: `The complete blueprint to master ${cleanTopic.slice(0, 35)} from zero.`,
      why: "Action-oriented and promise-driven; high save and bookmark rates.",
    },
  ];

  return (
    <Dialog title="Viral Hook Lab" description="Test 5 high-converting opening hooks to maximize swipe rate" onClose={onClose}>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {hooks.map((h) => (
          <div key={h.id} className="rounded-2xl border border-line bg-surface p-4 hover:border-ink transition-colors flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-accent">
                  <span>{h.icon}</span> {h.badge}
                </span>
                <span className="text-[11px] uppercase tracking-wider font-mono text-mute">{h.kicker}</span>
              </div>
              <h4 className="text-[15px] font-bold leading-snug text-ink">{h.title}</h4>
              <p className="mt-1 text-xs text-mute leading-relaxed">{h.why}</p>
            </div>
            <div className="flex justify-end pt-1">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onApply({ kicker: h.kicker, title: h.title });
                  onClose();
                }}
              >
                Apply Hook
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

function SlideInspector({ slide, index, onEdit, onPhoto, onRetry, searching, onOpenHookLab, onDupSpread }) {
  const set = (patch, key) => onEdit((s) => ({ ...s, ...patch }), key);
  const items = slide.items || [];
  const setItem = (i, patch) => set({ items: items.map((it, k) => (k === i ? { ...it, ...patch } : it)) }, `items-${i}`);
  return (
    <>
      <Section title="Content">
        <div>
          <Label>Layout</Label>
          <select value={slide.layout} onChange={(e) => {
              const use = PHOTO_LAYOUTS.has(e.target.value) || slide.image.use;
              set({ layout: e.target.value, image: { ...slide.image, use, status: use && !slide.img?.src && !slide.image.use ? "empty" : slide.image.status } });
            }} className={line} aria-label="Slide layout">
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
          <textarea value={slide.title} onChange={(e) => set({ title: e.target.value.slice(0, 90) }, "title")} rows={2} className={area} aria-label="Headline" />
          <input value={slide.highlight} onChange={(e) => set({ highlight: e.target.value.slice(0, 40) }, "highlight")} className={cx(line, "mt-2 text-[13px]")} placeholder="Words to highlight (copied from the headline)" aria-label="Highlighted words" />
          {index === 0 && onOpenHookLab && (
            <div className="mt-2.5">
              <Button variant="secondary" size="sm" icon={Zap} onClick={onOpenHookLab} className="w-full justify-center">
                Viral Hook Lab (Test 5 Angles)
              </Button>
            </div>
          )}
        </div>
        {slide.layout === "panorama" && (
          <div className="space-y-2.5 rounded-xl border border-line bg-sunken/40 p-3">
            <div className="flex items-center justify-between">
              <Label>Spread Part</Label>
              <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs">
                <button
                  type="button"
                  className={cx("px-2.5 py-1 rounded font-medium", (!slide.panorama?.part || slide.panorama.part === 1) ? "bg-ink text-white" : "text-ink-2")}
                  onClick={() => set({ panorama: { ...slide.panorama, part: 1 } }, "pano-part")}
                >
                  Part 1 (Left)
                </button>
                <button
                  type="button"
                  className={cx("px-2.5 py-1 rounded font-medium", slide.panorama?.part === 2 ? "bg-ink text-white" : "text-ink-2")}
                  onClick={() => set({ panorama: { ...slide.panorama, part: 2 } }, "pano-part")}
                >
                  Part 2 (Right)
                </button>
              </div>
            </div>
            {onDupSpread && (
              <Button variant="ghost" size="sm" icon={Plus} onClick={onDupSpread} className="w-full justify-center text-xs">
                Split image to next slide
              </Button>
            )}
          </div>
        )}
        {slide.layout === "code" && (
          <div className="space-y-3 rounded-xl border border-line bg-sunken/40 p-3">
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <div>
                <Label>Filename</Label>
                <input
                  value={slide.code?.filename || ""}
                  onChange={(e) => set({ code: { ...(slide.code || {}), filename: e.target.value.slice(0, 32) } }, "code-fn")}
                  className={line}
                  placeholder="e.g. index.ts or bash"
                />
              </div>
              <div>
                <Label>Language</Label>
                <select
                  value={slide.code?.language || "typescript"}
                  onChange={(e) => set({ code: { ...(slide.code || {}), language: e.target.value } }, "code-lang")}
                  className={line}
                >
                  <option value="typescript">TypeScript</option>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="bash">Bash / Shell</option>
                  <option value="rust">Rust</option>
                  <option value="go">Go</option>
                  <option value="sql">SQL</option>
                  <option value="json">JSON</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Code snippet</Label>
              <textarea
                value={slide.code?.code || ""}
                onChange={(e) => set({ code: { ...(slide.code || {}), code: e.target.value } }, "code-snippet")}
                rows={5}
                className={cx(area, "font-mono text-xs leading-relaxed")}
                placeholder="// Paste code snippet or terminal commands here..."
              />
            </div>
            <div>
              <Label hint="e.g. 2, 4">Highlight lines</Label>
              <input
                value={slide.code?.lineHighlight || ""}
                onChange={(e) => set({ code: { ...(slide.code || {}), lineHighlight: e.target.value } }, "code-highlight")}
                className={line}
                placeholder="Lines to highlight, e.g. 2 or 2,3"
              />
            </div>
          </div>
        )}
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
          <textarea value={slide.body} onChange={(e) => set({ body: e.target.value.slice(0, 220) }, "body")} rows={3} className={area} aria-label="Body" />
        </div>
        {ITEM_LAYOUTS.has(slide.layout) && slide.layout !== "step" && (
          <div>
            <Label hint={slide.layout === "compare" ? "left, then right" : "up to 6"}>Items</Label>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex gap-1.5">
                  <input value={it.label} onChange={(e) => setItem(i, { label: e.target.value.slice(0, 28) })} className={cx(line, "w-24 shrink-0 sm:w-28")} placeholder="Label" aria-label={`Item ${i + 1} label`} />
                  <input value={it.text} onChange={(e) => setItem(i, { text: e.target.value.slice(0, 100) })} className={line} placeholder="Text" aria-label={`Item ${i + 1} text`} />
                  {slide.layout !== "compare" && <IconButton icon={X} label={`Remove item ${i + 1}`} size={40} iconSize={14} onClick={() => set({ items: items.filter((_, k) => k !== i) })} />}
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
        <div className="flex items-center justify-between py-1 border-t border-line-soft mt-3 pt-3">
          <div>
            <div className="text-xs font-medium text-ink">Curiosity peek</div>
            <div className="text-[11px] text-mute">Swipe incentive cue on right edge</div>
          </div>
          <Switch checked={!!slide.peekNext} onChange={(checked) => set({ peekNext: checked }, "peekNext")} />
        </div>
      </Section>
      <Section title="Photo">
        <PhotoPanel slide={slide} onEdit={onEdit} onPhoto={onPhoto} onRetry={onRetry} searching={searching} />
      </Section>
      <Section title="Accessibility">
        <div>
          <Label>Alt text</Label>
          <textarea value={slide.alt} onChange={(e) => set({ alt: e.target.value.slice(0, 300) }, "alt")} rows={2} className={area} placeholder="Describes the slide for screen readers" />
        </div>
      </Section>
    </>
  );
}

// ---------- Inspector: design ----------

// One theme thumbnail: the current cover in that theme. Memoized because the
// gallery renders 16 of them.
const ThemeThumb = memo(function ThemeThumb({ id, on, cover, total, direction, brand, format, onPick, width }) {
  const st = STYLES[id];
  return (
    <button onClick={() => onPick(id)} aria-pressed={on} className={cx("group overflow-hidden rounded-xl border bg-surface text-left transition-[border-color,box-shadow]", on ? "border-ink shadow-[0_0_0_2px_rgba(23,21,15,.14)]" : "border-line hover:border-line-strong")}>
      {cover ? (
        <ScaledSlide width={width} slide={cover} index={0} total={total} direction={{ ...direction, style: id, palette: st.sample, continuity: "none" }} brand={brand} format={format} />
      ) : (
        <div style={{ width, height: width * 1.25, background: st.sample.bg }} />
      )}
      <span className="flex items-center justify-between gap-1 px-2 py-1.5">
        <span className="truncate text-xs font-medium">{st.name}</span>
        {on && <Check size={13} className="shrink-0" />}
      </span>
    </button>
  );
});

function DesignInspector({ project, variant, onEditVariant, onEditCarousel, onToast }) {
  const d = variant.direction;
  const pal = safePalette(d.palette, d.style);
  const c = project.carousel;
  const [group, setGroup] = useState("All");
  const box = useRef(null);
  const { w } = useElementSize(box);
  const setDir = (patch, key) => onEditVariant((v) => ({ ...v, direction: { ...v.direction, ...patch } }), key);
  useEffect(() => STYLE_IDS.forEach(ensureFonts), []);
  const cover = variant.slides[0];
  const ids = STYLE_IDS.filter((id) => group === "All" || STYLES[id].group === group);
  const cols = w > 420 ? 3 : 2;
  const thumbW = w ? Math.floor((w - (cols - 1) * 10) / cols) - 2 : 140;
  const pick = useCallback((id) => setDir({ style: id, palette: STYLES[id].sample }), [onEditVariant]);
  return (
    <>
      <Section title="Theme" action={<span className="text-xs text-mute">{STYLES[d.style]?.name}</span>}>
        <p className="-mt-1 text-[12px] leading-snug text-mute">Same words, a different composition. Each theme has its own layouts, type and photo shapes.</p>
        <div className="nosb -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {["All", ...STYLE_GROUPS].map((g) => (
            <button key={g} onClick={() => setGroup(g)} aria-pressed={group === g} className={cx("shrink-0 rounded-full border px-3 py-1 text-xs transition-colors", group === g ? "border-ink bg-ink text-white" : "border-line text-ink-2 hover:border-line-strong")}>
              {g}
            </button>
          ))}
        </div>
        <div ref={box} className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {ids.map((id) => (
            <ThemeThumb key={id} id={id} on={d.style === id} cover={cover} total={variant.slides.length} direction={d} brand={c.brand} format={c.format} onPick={pick} width={thumbW} />
          ))}
        </div>
      </Section>
      <Section title="Colors" action={<Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => setDir({ palette: STYLES[d.style].sample })}>Reset</Button>}>
        <p className="-mt-1 text-[12px] text-mute">Kept readable automatically.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            ["bg", "Background"],
            ["ink", "Text"],
            ["accent", "Accent"],
            ["muted", "Soft text"],
            ["surface", "Cards"],
            ["onAccent", "On accent"],
          ].map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 rounded-xl border border-line px-2.5 py-2 text-xs">
              <input type="color" value={pal[k]} onChange={(e) => setDir({ palette: { ...d.palette, [k]: e.target.value.toUpperCase() } }, `color-${k}`)} className="h-6 w-6 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0" aria-label={label} />
              <span className="truncate">{label}</span>
            </label>
          ))}
        </div>
      </Section>
      <Section title="Photos and flow">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <Label>Across slides</Label>
            <select value={d.continuity} onChange={(e) => setDir({ continuity: e.target.value })} className={line} aria-label="Shape across slides">
              {CONTINUITY.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>
      <Section title="Format and brand">
        <div>
          <Segmented id="studio-format" size="sm" full value={c.format} onChange={(v) => onEditCarousel((cc) => ({ ...cc, format: v }))} options={Object.entries(FORMATS).map(([value, f]) => ({ value, label: value, aria: f.note }))} />
          <p className="mt-1.5 text-[11px] text-faint">{FORMATS[c.format]?.note}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Handle</Label>
            <input value={c.brand?.handle || ""} onChange={(e) => onEditCarousel((cc) => ({ ...cc, brand: { ...cc.brand, handle: e.target.value.slice(0, 31) } }), "handle")} className={line} placeholder="@handle" />
          </div>
          <div>
            <Label>Name</Label>
            <input value={c.brand?.name || ""} onChange={(e) => onEditCarousel((cc) => ({ ...cc, brand: { ...cc.brand, name: e.target.value.slice(0, 40) } }), "brand-name")} className={line} placeholder="Brand" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-line-soft">
          <Button
            variant="secondary"
            size="sm"
            icon={Bookmark}
            onClick={() => {
              saveBrandKit({ brand: c.brand, style: d.style, palette: d.palette });
              if (onToast) onToast("Brand kit saved as default!");
            }}
          >
            Save Brand Kit
          </Button>
          {loadBrandKit() && (
            <Button
              variant="ghost"
              size="sm"
              icon={Sparkles}
              onClick={() => {
                const kit = loadBrandKit();
                if (kit) {
                  if (kit.brand) onEditCarousel((cc) => ({ ...cc, brand: kit.brand }));
                  if (kit.style) setDir({ style: kit.style, ...(kit.palette ? { palette: kit.palette } : {}) });
                  if (onToast) onToast("Brand kit applied!");
                }
              }}
            >
              Apply My Brand Kit
            </Button>
          )}
        </div>
      </Section>
    </>
  );
}

// ---------- Inspector: caption ----------

function CopyButton({ text, label, size = "sm" }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="secondary"
      size={size}
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
    <>
      <Section title="Caption" action={<CopyButton text={captionText(variant)} label="Copy" />}>
        <div>
          <Label hint={`${variant.caption.length}/2200`}>Text</Label>
          <textarea value={variant.caption} onChange={(e) => onEditVariant((v) => ({ ...v, caption: e.target.value.slice(0, 2200) }), "caption")} rows={9} className={area} aria-label="Caption" />
        </div>
        <div>
          <Label>Hashtags</Label>
          <input
            value={(variant.hashtags || []).map((h) => "#" + h).join(" ")}
            onChange={(e) => onEditVariant((v) => ({ ...v, hashtags: e.target.value.split(/[\s,]+/).map((h) => h.replace(/^#+/, "")).filter(Boolean).slice(0, 30) }), "tags")}
            className={line}
            aria-label="Hashtags"
          />
        </div>
      </Section>
      <Section title="Photo credits">
        {credits.length ? (
          <ul className="space-y-2 text-xs text-ink-2">
            {credits.map((r) => (
              <li key={r.slide} className="leading-snug">
                <span className="font-medium">Slide {r.slide}:</span>{" "}
                {r.page ? (
                  <a href={r.page} target="_blank" rel="noreferrer noopener" className="underline hover:text-ink">
                    {r.credit || "source"}
                  </a>
                ) : (
                  r.credit
                )}
                {r.license && <span className="block text-faint">{r.license}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-mute">No photos in this carousel.</p>
        )}
      </Section>
    </>
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
      const { exportZip, exportPdf, exportVideo, slidePng, fileBase } = await import("./exporter");
      const base = fileBase(project, variant);
      const onProgress = (done, total) => setProgress({ done, total });
      if (kind === "zip") download(await exportZip({ project, variant, onProgress }), `${base}.zip`);
      if (kind === "video") download(await exportVideo({ project, variant, onProgress }), `${base}.mp4`);
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
    { id: "video", icon: Video, title: "Video Reel (MP4 / WebM)", text: `Auto-advancing 30fps video reel with smooth transitions for Reels & TikTok` },
    { id: "pdf", icon: FileText, title: "LinkedIn document", text: "One PDF; LinkedIn shows it as a swipeable carousel" },
    { id: "png", icon: ImageIcon, title: "This slide only", text: `Slide ${index + 1} as a PNG` },
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
            <Download size={16} className="shrink-0 text-mute" />
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

// ---------- Swipeable preview ----------

// The slide on stage. On touch screens it swipes; the neighbours sit beside it.
function Stage({ project, variant, index, setIndex, width, steps, swipe }) {
  const c = project.carousel;
  const slides = variant.slides;
  const ratio = FORMATS[c.format].h / FORMATS[c.format].w;
  const go = (n) => setIndex(Math.max(0, Math.min(slides.length - 1, n)));
  if (!swipe) {
    const s = slides[index];
    return (
      <div className="overflow-hidden rounded-[18px] bg-surface shadow-lift ring-1 ring-black/5" style={{ width, height: width * ratio }}>
        <ScaledSlide width={width} slide={s} index={index} total={slides.length} direction={variant.direction} brand={c.brand} format={c.format} goal={c.plan?.goal} stepNo={steps[index]} />
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-[16px] shadow-lift ring-1 ring-black/5" style={{ width, height: width * ratio }}>
      <motion.div
        className="flex"
        drag="x"
        dragConstraints={{ left: -(slides.length - 1) * width, right: 0 }}
        dragElastic={0.12}
        animate={{ x: -index * width }}
        transition={{ type: "spring", stiffness: 380, damping: 40 }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -50 || info.velocity.x < -400) go(index + 1);
          else if (info.offset.x > 50 || info.velocity.x > 400) go(index - 1);
        }}
        style={{ width: width * slides.length, touchAction: "pan-y" }}
      >
        {slides.map((s, i) =>
          Math.abs(i - index) <= 1 ? (
            <ScaledSlide key={s.id} width={width} slide={s} index={i} total={slides.length} direction={variant.direction} brand={c.brand} format={c.format} goal={c.plan?.goal} stepNo={steps[i]} />
          ) : (
            <div key={s.id} style={{ width, height: width * ratio, flexShrink: 0 }} />
          ),
        )}
      </motion.div>
    </div>
  );
}

function PhonePreview({ project, variant, index, setIndex, onClose }) {
  const c = project.carousel;
  const steps = stepNumbers(variant.slides);
  const width = Math.min(380, typeof window !== "undefined" ? window.innerWidth - 48 : 380);
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
        <Stage project={project} variant={variant} index={index} setIndex={setIndex} width={width} steps={steps} swipe />
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

// ---------- Slide strip ----------

function SlideStrip({ project, variant, index, setIndex, steps, vertical, onReorder, onAdd, onDup, onDel }) {
  const c = project.carousel;
  const slides = variant.slides;
  const ratio = FORMATS[c.format].h / FORMATS[c.format].w;
  const thumb = vertical ? 96 : 72;
  const busyIds = new Set(slides.filter((s) => s.image?.use && !s.img?.src && s.image?.status === "searching").map((s) => s.id));
  return (
    <Reorder.Group
      axis={vertical ? "y" : "x"}
      values={slides}
      onReorder={onReorder}
      className={cx(vertical ? "flex flex-col items-center gap-3 px-3 py-4" : "nosb mx-auto flex w-fit max-w-full gap-2.5 overflow-x-auto px-4 pb-3 pt-2")}
    >
      {slides.map((sl, i) => (
        <Reorder.Item key={sl.id} value={sl} className="group relative shrink-0" whileDrag={{ scale: 1.05, zIndex: 10 }}>
          <button
            onClick={() => setIndex(i)}
            aria-label={`Slide ${i + 1}`}
            aria-current={i === index}
            className={cx("relative block overflow-hidden rounded-lg ring-offset-2 ring-offset-canvas transition", i === index ? "ring-2 ring-ink" : "opacity-85 ring-1 ring-black/5 hover:opacity-100")}
          >
            <ScaledSlide width={thumb} slide={sl} index={i} total={slides.length} direction={variant.direction} brand={c.brand} format={c.format} goal={c.plan?.goal} stepNo={steps[i]} />
            {busyIds.has(sl.id) && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                <LoaderCircle size={16} className="animate-spin text-white" />
              </span>
            )}
          </button>
          <span className={cx("pointer-events-none absolute font-mono text-[10px] text-mute", vertical ? "-left-5 top-1" : "-bottom-0.5 left-1")}>{i + 1}</span>
          <span className={cx("absolute -right-1.5 -top-1.5 gap-0.5", i === index ? "flex sm:hidden group-focus-within:flex group-hover:flex" : "hidden group-focus-within:flex group-hover:flex")}>
            <button onClick={() => onDup(i)} aria-label={`Duplicate slide ${i + 1}`} className="flex h-6 w-6 items-center justify-center rounded-full bg-surface shadow ring-1 ring-black/10 hover:bg-wash">
              <Copy size={11} />
            </button>
            <button onClick={() => onDel(i)} aria-label={`Delete slide ${i + 1}`} className="flex h-6 w-6 items-center justify-center rounded-full bg-surface text-danger shadow ring-1 ring-black/10 hover:bg-wash">
              <Trash2 size={11} />
            </button>
          </span>
        </Reorder.Item>
      ))}
      <button onClick={onAdd} aria-label="Add a slide" className="flex shrink-0 items-center justify-center rounded-lg border border-dashed border-line-strong text-mute transition-colors hover:border-ink hover:text-ink" style={{ width: thumb, height: thumb * ratio }}>
        <Plus size={18} />
      </button>
    </Reorder.Group>
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [phone, setPhone] = useState(false);
  const [hookLab, setHookLab] = useState(false);
  const [ask, setAsk] = useState("");
  const [scope, setScope] = useState("slide");
  const [asking, setAsking] = useState(false);
  const [imagesBusy, setImagesBusy] = useState(false);
  const stage = useRef(null);
  const touchStartY = useRef(null);
  const size = useElementSize(stage);
  const wide = useMedia("(min-width: 1024px)");
  const touch = useMedia("(pointer: coarse)");
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

  // Variations still marked as generating (the page was reloaded or closed
  // meanwhile) are finished from the results saved on the server.
  useEffect(() => {
    if (!project) return;
    for (const v of c.variants) {
      const unfinished = BUSY.has(v.status) || (v.status === "stopped" && v.slides.length > 0);
      if (unfinished && !isRunning(v.id)) resumeVariant({ api, projectId: project.id, variantId: v.id });
    }
  }, [project?.id]);

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

  const generating = BUSY.has(variant.status) && isRunning(variant.id);
  const stopped = !slides.length && (variant.status === "stopped" || variant.status === "error" || (BUSY.has(variant.status) && !isRunning(variant.id)));
  const searching = (sl) => !!sl?.image?.use && !sl?.img?.src && (sl.image.status === "searching" || (variant.status === "images" && isRunning(variant.id)));
  const hist = s.hist[project.id];
  const ratio = FORMATS[c.format].h / FORMATS[c.format].w;

  const regenerate = () => {
    editVariant((v) => ({ ...v, slides: [], status: "writing", error: "" }));
    setIndex(0);
    setTimeout(() => buildVariant({ api, projectId: project.id, variantId: variant.id, request: { quality: s.data.prefs.aiQuality }, fresh: true }), 0);
  };

  const retryPhotos = (only) => {
    setImagesBusy(true);
    findImages({ api, projectId: project.id, variantId: variant.id, only })
      .catch((err) => api.toast(err.message, { tone: "error" }))
      .finally(() => setImagesBusy(false));
  };

  const addSlide = () => {
    if (slides.length >= MAX_SLIDES) return api.toast(`Instagram allows ${MAX_SLIDES} slides at most`, { tone: "error" });
    const at = Math.min(index + 1, slides.length - 1);
    editVariant((v) => ({ ...v, slides: settleLayouts([...v.slides.slice(0, at), emptySlide("statement"), ...v.slides.slice(at)]) }));
    setIndex(at);
  };
  const dupSlide = (i) => {
    if (slides.length >= MAX_SLIDES) return api.toast(`Instagram allows ${MAX_SLIDES} slides at most`, { tone: "error" });
    editVariant((v) => ({ ...v, slides: settleLayouts([...v.slides.slice(0, i + 1), { ...v.slides[i], id: uid() }, ...v.slides.slice(i + 1)]) }));
    setIndex(i + 1);
  };
  const dupSpread = (i) => {
    if (slides.length >= MAX_SLIDES) return api.toast(`Instagram allows ${MAX_SLIDES} slides at most`, { tone: "error" });
    const s1 = { ...slides[i], layout: "panorama", panorama: { part: 1, totalParts: 2 } };
    const s2 = { ...slides[i], id: uid(), layout: "panorama", panorama: { part: 2, totalParts: 2 }, kicker: "Part 2", title: "Spread continues" };
    editVariant((v) => ({ ...v, slides: settleLayouts([...v.slides.slice(0, i), s1, s2, ...v.slides.slice(i + 1)]) }));
    setIndex(i + 1);
    api.toast("Created 2-slide panorama spread!", { tone: "success" });
  };
  const openInCanvas = () => {
    try {
      const canvasProj = carouselToCanvasProject(project, variant);
      api.add(canvasProj);
      api.toast("Opened in Canvas! Each slide is an editable artboard.", { tone: "success" });
    } catch (err) {
      api.toast("Couldn't open in canvas: " + err.message, { tone: "error" });
    }
  };
  const delSlide = (i) => {
    if (slides.length <= 2) return api.toast("A carousel needs at least 2 slides", { tone: "error" });
    editVariant((v) => ({ ...v, slides: settleLayouts(v.slides.filter((_, k) => k !== i)) }));
    api.toast("Slide deleted", { action: { label: "Undo", run: () => api.undo(project.id) } });
  };
  const reorder = (next) => {
    const cur = slide?.id;
    editVariant((v) => ({ ...v, slides: settleLayouts(next) }), "reorder");
    const ni = next.findIndex((x) => x.id === cur);
    if (ni >= 0) setIndex(ni);
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

  // Preview size: as large as the stage allows.
  const previewW = wide
    ? Math.max(240, Math.min(size.w - 120, (size.h - 60) / ratio, 600))
    : Math.max(220, Math.min((size.w || (typeof window !== "undefined" ? window.innerWidth : 360)) - 32, 520, (typeof window !== "undefined" ? window.innerHeight * 0.58 : 500) / ratio));

  const variationBar = (
    <div className="nosb flex items-center gap-2 overflow-x-auto px-3 py-2 sm:px-4">
      {c.variants.map((v) => {
        const on = v.id === variant.id;
        const vp = safePalette(v.direction.palette, v.direction.style);
        const busy = BUSY.has(v.status) && isRunning(v.id);
        return (
          <button
            key={v.id}
            onClick={() => {
              editCarousel((cc) => ({ ...cc, active: v.id }));
              setIndex(0);
            }}
            aria-pressed={on}
            className={cx("flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[13px] transition-colors", on ? "border-ink bg-surface font-medium shadow-soft" : "border-line bg-surface/60 text-ink-2 hover:bg-surface")}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: vp.bg, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)" }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: vp.accent }} />
            </span>
            <span className="max-w-[9rem] truncate sm:max-w-none">{v.direction.name}</span>
            <span className="hidden text-faint sm:inline">· {STYLES[v.direction.style]?.name}</span>
            {busy && <LoaderCircle size={13} className="animate-spin text-accent" />}
            {!v.slides.length && !busy && (v.status === "error" || v.status === "stopped") && <span className="h-2 w-2 rounded-full bg-danger" title={v.error || "Stopped"} />}
          </button>
        );
      })}
    </div>
  );

  const askBar = (
    <div className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-2 shadow-soft">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          askPip();
        }}
        className="flex flex-wrap items-center gap-2 sm:flex-nowrap"
      >
        <Segmented id="ask-scope" size="sm" value={scope} onChange={setScope} options={[{ value: "slide", label: "This slide" }, { value: "all", label: "All slides" }]} />
        <div className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto sm:flex-1">
          <input value={ask} onChange={(e) => setAsk(e.target.value)} disabled={asking} placeholder={scope === "slide" ? "Ask Pip to change this slide…" : "Ask Pip to change the carousel…"} className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-faint" aria-label="Instruction for Pip" />
          <Button type="submit" size="sm" variant="accent" icon={asking ? LoaderCircle : Sparkles} disabled={asking || ask.trim().length < 2}>
            {asking ? "Working" : "Ask"}
          </Button>
        </div>
      </form>
      <div className="nosb mt-1.5 flex gap-1.5 overflow-x-auto px-1">
        {QUICK.map((q) => (
          <button key={q} disabled={asking} onClick={() => askPip(q)} className="shrink-0 rounded-full bg-sunken px-2.5 py-1 text-[11px] text-ink-2 transition-colors hover:text-ink disabled:opacity-50">
            {q}
          </button>
        ))}
        <button disabled={generating} onClick={regenerate} className="shrink-0 rounded-full px-2.5 py-1 text-[11px] text-mute underline-offset-2 hover:text-ink hover:underline disabled:opacity-50">
          Rewrite this variation · 2–3 credits
        </button>
      </div>
    </div>
  );

  const stageBody = stopped ? (
    <div className="mx-auto mt-10 max-w-sm px-4 text-center">
      <p className="text-[15px] font-semibold">This variation didn't finish</p>
      <p className="mt-1 text-sm text-mute">{variant.error || "Generation stopped before any slides were saved."}</p>
      <Button className="mt-4" icon={RefreshCw} onClick={regenerate}>
        Generate it again
      </Button>
    </div>
  ) : !slides.length ? (
    <div className="flex flex-col items-center px-4 pt-4">
      <div className="animate-pulse rounded-2xl bg-sunken" style={{ width: previewW, height: previewW * ratio }} />
      <p className="mt-4 flex items-center gap-2 text-sm text-mute">
        <LoaderCircle size={15} className="animate-spin text-accent" /> Pip is writing “{variant.direction.name}”…
      </p>
    </div>
  ) : (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2 sm:gap-3">
        {!touch && <IconButton icon={ChevronLeft} label="Previous slide" disabled={index === 0} onClick={() => setIndex(index - 1)} />}
        <Stage project={project} variant={variant} index={index} setIndex={setIndex} width={previewW} steps={steps} swipe={touch || !wide} />
        {!touch && <IconButton icon={ChevronRight} label="Next slide" disabled={index >= slides.length - 1} onClick={() => setIndex(index + 1)} />}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 text-xs text-mute">
        <span>
          Slide {index + 1} of {slides.length} · {LAYOUTS.find((l) => l.id === slide.layout)?.label}
        </span>
        {(slides.some(searching) || imagesBusy) && (
          <span className="flex items-center gap-1.5 text-accent">
            <LoaderCircle size={12} className="animate-spin" /> finding photos
          </span>
        )}
        {!wide && (
          <span className="flex gap-1" aria-hidden="true">
            {slides.map((sl, i) => (
              <span key={sl.id} className={cx("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-ink" : "w-1.5 bg-ink/20")} />
            ))}
          </span>
        )}
      </div>
    </div>
  );

  const inspector = (
    <>
      <div className="sticky top-0 z-10 border-b border-line-soft bg-surface/95 px-4 py-2.5 backdrop-blur sm:px-5">
        <Segmented id="inspector-tab" full size="sm" value={tab} onChange={setTab} options={[{ value: "slide", label: "Slide" }, { value: "design", label: "Design" }, { value: "caption", label: "Caption" }]} />
      </div>
      {tab === "slide" && slide && (
        <SlideInspector
          key={slide.id}
          slide={slide}
          index={index}
          onEdit={editSlide}
          onPhoto={() => setPicker(true)}
          onRetry={() => retryPhotos([index])}
          searching={searching(slide) || imagesBusy}
          onOpenHookLab={() => setHookLab(true)}
          onDupSpread={() => dupSpread(index)}
        />
      )}
      {tab === "slide" && !slide && <p className="p-5 text-sm text-mute">Slides appear here as Pip writes them.</p>}
      {tab === "design" && <DesignInspector project={project} variant={variant} onEditVariant={editVariant} onEditCarousel={editCarousel} onToast={(msg) => api.toast(msg, { tone: "success" })} />}
      {tab === "caption" && <CaptionInspector variant={variant} onEditVariant={editVariant} />}
    </>
  );

  const strip = slides.length > 0 && (
    <SlideStrip project={project} variant={variant} index={index} setIndex={setIndex} steps={steps} vertical={wide} onReorder={reorder} onAdd={addSlide} onDup={dupSlide} onDel={delSlide} />
  );

  return (
    <div className={cx("flex h-full flex-col bg-canvas", !wide && "overflow-hidden relative")}>
      {/* Header */}
      <header className="z-20 flex h-14 shrink-0 items-center gap-1.5 border-b border-line bg-paper/95 px-2 backdrop-blur sm:gap-2 sm:px-3">
        <IconButton icon={ArrowLeft} label="Back to designs" onClick={() => api.home()} />
        <input
          value={project.name}
          onChange={(e) => api.edit(project.id, (p) => ({ ...p, name: e.target.value.slice(0, 40) }), { silent: true })}
          aria-label="Carousel name"
          className="min-w-0 flex-1 truncate rounded-lg bg-transparent px-2 py-1 text-[15px] font-semibold outline-none hover:bg-sunken focus:bg-surface sm:max-w-xs"
        />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <span className="mr-1 hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-mute md:inline-flex" title="Credits left today">
            <PipGlyph size={10} /> {left}
          </span>
          <span className="hidden sm:flex">
            <IconButton icon={Undo2} label="Undo" disabled={!hist?.past.length} onClick={() => api.undo(project.id)} />
            <IconButton icon={Redo2} label="Redo" disabled={!hist?.future.length} onClick={() => api.redo(project.id)} />
          </span>
          <Button variant="secondary" size="sm" icon={LayoutGrid} onClick={openInCanvas} disabled={!slides.length} aria-label="Open in Canvas">
            <span className="hidden md:inline">Open in Canvas</span>
          </Button>
          <Button variant="secondary" size="sm" icon={Smartphone} onClick={() => setPhone(true)} disabled={!slides.length} aria-label="Feed preview">
            <span className="hidden sm:inline">Preview</span>
          </Button>
          <Button variant="primary" size="sm" icon={Download} onClick={() => setExporting(true)} disabled={!slides.length || generating} aria-label="Export">
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </header>

      <div className="shrink-0 border-b border-line-soft bg-paper/70">{variationBar}</div>

      {wide ? (
        <div className="grid min-h-0 flex-1 grid-cols-[136px_minmax(0,1fr)_minmax(340px,380px)] xl:grid-cols-[152px_minmax(0,1fr)_400px]">
          <aside className="sb min-h-0 overflow-y-auto border-r border-line-soft bg-paper/40" aria-label="Slides">
            {strip}
          </aside>
          <main className="flex min-h-0 flex-col">
            <div ref={stage} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-6 py-5">
              {stageBody}
            </div>
            <div className="flex shrink-0 justify-center border-t border-line-soft bg-paper/40 px-6 py-3">{askBar}</div>
          </main>
          <aside className="sb min-h-0 overflow-y-auto border-l border-line bg-surface" aria-label="Inspector">
            {inspector}
          </aside>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Scrollable Stage Area: slide preview, strip, and ask bar */}
          <div className="flex-1 overflow-y-auto pb-3">
            <main ref={stage} className="shrink-0 pb-2 pt-3">
              {stageBody}
            </main>
            {strip && <div className="shrink-0">{strip}</div>}
            {slides.length > 0 && <div className="flex shrink-0 justify-center px-3 pb-2 sm:px-4">{askBar}</div>}
          </div>

          {/* Compact bottom dock: visible at the bottom of the screen */}
          <div className="shrink-0 border-t border-line bg-surface/95 px-3 py-2 backdrop-blur">
            <div className="mx-auto flex max-w-md items-center gap-2">
              <div className="flex-1">
                <Segmented
                  id="mobile-inspector-dock"
                  full
                  size="sm"
                  value={tab}
                  onChange={(nextTab) => {
                    setTab(nextTab);
                    setMobileOpen(true);
                  }}
                  options={[
                    { value: "slide", label: "Slide" },
                    { value: "design", label: "Design" },
                    { value: "caption", label: "Caption" },
                  ]}
                />
              </div>
              <button
                onClick={() => setMobileOpen((o) => !o)}
                className="flex h-8 items-center gap-1 rounded-full bg-sunken px-2.5 text-xs font-medium text-ink-2 hover:bg-line hover:text-ink transition-colors"
                aria-label={mobileOpen ? "Bring down panel" : "Open editor panel"}
                title={mobileOpen ? "Bring down panel" : "Open editor panel"}
              >
                {mobileOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                <span>{mobileOpen ? "Hide" : "Edit"}</span>
              </button>
            </div>
          </div>

          {/* Mobile Bottom Sheet Overlay */}
          <AnimatePresence>
            {mobileOpen && (
              <>
                <motion.div
                  key="sheet-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setMobileOpen(false)}
                  className="absolute inset-0 z-30 bg-black/35 backdrop-blur-[1px]"
                  aria-label="Bring down panel"
                />

                <motion.div
                  key="sheet-panel"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 28, stiffness: 320 }}
                  className="absolute inset-x-0 bottom-0 z-40 flex max-h-[78vh] flex-col rounded-t-3xl border-t border-line bg-surface shadow-lift"
                  role="dialog"
                  aria-label="Carousel editor"
                >
                  {/* Sheet Header: Pull handle + tabs + Bring down button */}
                  <div
                    className="shrink-0 border-b border-line-soft bg-surface/95 px-3 pb-2 pt-2 backdrop-blur"
                    onTouchStart={(e) => {
                      touchStartY.current = e.touches[0].clientY;
                    }}
                    onTouchEnd={(e) => {
                      if (touchStartY.current !== null) {
                        const delta = e.changedTouches[0].clientY - touchStartY.current;
                        if (delta > 40) setMobileOpen(false);
                        touchStartY.current = null;
                      }
                    }}
                  >
                    <div
                      className="mx-auto -mt-0.5 mb-1.5 flex h-4 w-20 cursor-pointer touch-none items-center justify-center active:opacity-70"
                      onClick={() => setMobileOpen(false)}
                      title="Bring down panel to see carousel"
                      aria-label="Bring down panel to see carousel"
                    >
                      <div className="h-1.5 w-12 rounded-full bg-line-strong hover:bg-mute" />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Segmented
                          id="mobile-sheet-tab"
                          full
                          size="sm"
                          value={tab}
                          onChange={(nextTab) => {
                            if (nextTab === tab) {
                              setMobileOpen(false);
                            } else {
                              setTab(nextTab);
                            }
                          }}
                          options={[
                            { value: "slide", label: "Slide" },
                            { value: "design", label: "Design" },
                            { value: "caption", label: "Caption" },
                          ]}
                        />
                      </div>
                      <button
                        onClick={() => setMobileOpen(false)}
                        className="flex h-8 items-center gap-1 rounded-full bg-sunken px-2.5 text-xs font-medium text-ink-2 hover:bg-line hover:text-ink transition-colors"
                        aria-label="Bring down panel"
                        title="Bring down panel to see carousel"
                      >
                        <ChevronDown size={16} />
                        <span className="text-[11px]">Hide</span>
                      </button>
                    </div>
                  </div>

                  {/* Sheet Content: scrollable inspector */}
                  <div className="sb min-h-0 flex-1 overflow-y-auto px-1 pb-6">
                    <div className="mx-auto max-w-2xl">
                      {tab === "slide" && slide && (
                        <SlideInspector
                          key={slide.id}
                          slide={slide}
                          index={index}
                          onEdit={editSlide}
                          onPhoto={() => setPicker(true)}
                          onRetry={() => retryPhotos([index])}
                          searching={searching(slide) || imagesBusy}
                          onOpenHookLab={() => setHookLab(true)}
                          onDupSpread={() => dupSpread(index)}
                        />
                      )}
                      {tab === "slide" && !slide && <p className="p-5 text-sm text-mute">Slides appear here as Pip writes them.</p>}
                      {tab === "design" && <DesignInspector project={project} variant={variant} onEditVariant={editVariant} onEditCarousel={editCarousel} onToast={(msg) => api.toast(msg, { tone: "success" })} />}
                      {tab === "caption" && <CaptionInspector variant={variant} onEditVariant={editVariant} />}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}

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
              editProject((p) => withSlide(p, variant.id, id, (sl) => ({ ...sl, img, image: { ...sl.image, use: true, status: "ok" } })));
            }}
          />
        )}
        {hookLab && (
          <HookLabModal
            key="hook-lab"
            topic={c.topic}
            currentTitle={slide?.title}
            onApply={({ kicker, title }) => {
              editSlide((s) => ({ ...s, kicker, title }));
              api.toast("Applied viral hook to cover!", { tone: "success" });
            }}
            onClose={() => setHookLab(false)}
          />
        )}
        {exporting && <ExportDialog key="export" project={project} variant={variant} index={index} onClose={() => setExporting(false)} />}
        {phone && <PhonePreview key="phone" project={project} variant={variant} index={index} setIndex={setIndex} onClose={() => setPhone(false)} />}
      </AnimatePresence>
    </div>
  );
}
