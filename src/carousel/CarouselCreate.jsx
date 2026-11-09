// Creating a carousel: topic and source → "Let Pip decide" or custom setup →
// Pip's plan (strategy, slide count, hooks, creative directions) → generate.
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, FileText, Link2, LoaderCircle, Minus, Plus, Sparkles, Wand, X } from "lucide-react";
import { useStore } from "../store";
import { Button, EASE, IconButton, Segmented, Switch, cx, fireBurst } from "../ui";
import { inputClass } from "../pages/forms";
import { FORMATS, STYLES, STYLE_IDS } from "./styles";
import { ScaledSlide } from "./Slide";
import { newCarouselProject } from "./model";
import { buildVariant, planCarousel, readSource } from "./engine";

const IDEAS = [
  "7 money habits that quietly make people in their 20s rich",
  "Why Kyoto's tiny coffee bars feel so calm",
  "The 5-minute morning routine that fixed my focus",
  "What first-time founders get wrong about pricing",
];

const TONES = ["Friendly", "Bold", "Expert", "Witty", "Calm", "Inspiring"];
const GOALS = [
  { value: "", label: "Pip decides" },
  { value: "saves", label: "Saves" },
  { value: "shares", label: "Shares" },
  { value: "comments", label: "Comments" },
  { value: "follows", label: "Follows" },
];
const FRAMEWORK_LABEL = {
  listicle: "Listicle",
  how_to: "How-to",
  myth_vs_fact: "Myth vs fact",
  story: "Story",
  before_after: "Before / after",
  data_story: "Data story",
  contrarian: "Contrarian take",
  breakdown: "Breakdown",
  checklist: "Checklist",
  comparison: "Comparison",
};
const IMAGE_LABEL = { photo_led: "Photo-led", photo_accents: "Photo accents", type_only: "Type only", illustrated: "Illustrated" };

const BRAND_KEY = "pq.carousel.brand";
const loadBrand = () => {
  try {
    return JSON.parse(localStorage.getItem(BRAND_KEY) || "{}");
  } catch {
    return {};
  }
};

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        {hint && <span className="text-xs text-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Stepper({ value, onChange, min, max, label }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1">
      <IconButton icon={Minus} label={`Fewer ${label}`} size={28} iconSize={14} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} />
      <span className="min-w-8 text-center font-mono text-sm tabular-nums">{value}</span>
      <IconButton icon={Plus} label={`More ${label}`} size={28} iconSize={14} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} />
    </div>
  );
}

// A cover preview for a direction: its style, palette and hook, no photo.
function DirectionCover({ d, width = 132, format, brand }) {
  const slide = useMemo(
    () => ({ id: "preview", layout: "cover", kicker: FRAMEWORK_LABEL[d.framework] || "", title: d.hook || "Your hook here", highlight: "", body: "", items: [], stat: {}, quote: {}, image: { use: false }, img: null }),
    [d.hook, d.framework],
  );
  return <ScaledSlide width={width} slide={slide} index={0} total={d.slideCount || 8} direction={{ ...d, continuity: "none" }} brand={brand} format={format} className="rounded-xl shadow-soft ring-1 ring-black/5" />;
}

export function CarouselCreate({ onClose, initialTopic = "" }) {
  const { s, api } = useStore();
  const saved = useMemo(loadBrand, []);
  const [step, setStep] = useState("brief"); // brief | planning | plan
  const [topic, setTopic] = useState(initialTopic);
  const [notes, setNotes] = useState("");
  const [sourceMode, setSourceMode] = useState("none");
  const [sourceText, setSourceText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [handle, setHandle] = useState(saved.handle || "");
  const [brandName, setBrandName] = useState(saved.name || "");
  const [mode, setMode] = useState("auto");
  const [variations, setVariations] = useState(3);
  const [autoSlides, setAutoSlides] = useState(true);
  const [slides, setSlides] = useState(8);
  const [styles, setStyles] = useState([]);
  const [tone, setTone] = useState("");
  const [goal, setGoal] = useState("");
  const [extra, setExtra] = useState("");
  const [images, setImages] = useState("");
  const [format, setFormat] = useState("4:5");
  const [licensed, setLicensed] = useState(false);
  const [plan, setPlan] = useState(null);
  const [picked, setPicked] = useState({});
  const [error, setError] = useState("");
  const abort = useRef(null);
  const box = useRef(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (step === "brief") box.current?.focus();
  }, [step]);

  const brand = { handle: handle.trim() ? (handle.trim().startsWith("@") ? handle.trim() : "@" + handle.trim()) : "", name: brandName.trim() };

  const request = () => ({
    topic: topic.trim(),
    notes: notes.trim(),
    sourceText: sourceMode === "text" ? sourceText.trim() : sourceMode === "link" ? sourceText : "",
    sourceUrl: sourceMode === "link" ? sourceUrl.trim() : "",
    sourceTitle,
    brand,
    format,
    licensed,
    quality: s.data.prefs.aiQuality,
    variations: mode === "auto" ? 3 : variations,
    custom: mode === "auto" ? {} : { slides: autoSlides ? 0 : slides, styles, tone, goal, extra: extra.trim(), images },
  });

  const makePlan = async () => {
    if (topic.trim().length < 3) {
      box.current?.focus();
      setError("Describe what the carousel is about first.");
      return;
    }
    setError("");
    localStorage.setItem(BRAND_KEY, JSON.stringify({ handle: brand.handle, name: brand.name }));
    setStep("planning");
    abort.current?.abort();
    abort.current = new AbortController();
    try {
      if (sourceMode === "link" && sourceUrl.trim()) {
        const page = await readSource(sourceUrl.trim(), { signal: abort.current.signal });
        setSourceText(page.text);
        setSourceTitle(page.title);
        const r = { ...request(), sourceText: page.text, sourceTitle: page.title };
        const result = await planCarousel(r, { signal: abort.current.signal });
        setPlan(result);
      } else {
        setPlan(await planCarousel(request(), { signal: abort.current.signal }));
      }
      setPicked({});
      setStep("plan");
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message || "Pip couldn't plan that. Try again.");
      setStep("brief");
    }
  };

  const directions = plan?.directions || [];
  const chosen = directions.filter((d) => picked[d.id] !== false);
  const cost = chosen.length * 3;

  const updateDirection = (id, patch) => setPlan((p) => ({ ...p, directions: p.directions.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));

  const generate = () => {
    if (!chosen.length) return;
    const req = request();
    const project = newCarouselProject({ request: req, plan, directions: chosen });
    api.add(project);
    fireBurst();
    for (const v of project.carousel.variants) buildVariant({ api, projectId: project.id, variantId: v.id, request: req });
    onClose();
  };

  const toggleStyle = (id) =>
    setStyles((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(-(mode === "auto" ? 3 : variations))));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/35 backdrop-blur-[3px] sm:items-center sm:p-6"
      onClick={() => step !== "planning" && onClose()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="New carousel"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 24, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 16, opacity: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface shadow-pop sm:max-w-4xl sm:rounded-3xl"
        onKeyDown={(e) => e.key === "Escape" && step !== "planning" && onClose()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-6 pb-4 pt-5">
          <div className="flex items-start gap-2">
            {step === "plan" && <IconButton icon={ArrowLeft} label="Back to the brief" onClick={() => setStep("brief")} className="-ml-2" />}
            <div>
              <p className="eyebrow">Instagram carousel</p>
              <h2 className="display mt-1 text-[24px] leading-tight">{step === "plan" ? "Pip's plan" : step === "planning" ? "Pip is planning…" : "What's your carousel about?"}</h2>
            </div>
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2" disabled={step === "planning"} />
        </div>

        <div className="sb min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait" initial={false}>
            {step === "brief" && (
              <motion.div key="brief" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
                <div>
                  <textarea
                    ref={box}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) makePlan();
                    }}
                    rows={2}
                    maxLength={500}
                    aria-label="Carousel topic"
                    placeholder="A topic, an idea or a hot take, e.g. “7 money habits that quietly make people in their 20s rich”"
                    className="block w-full resize-none rounded-2xl border border-line bg-wash px-4 py-3.5 text-[17px] leading-relaxed outline-none transition-colors placeholder:text-faint focus:border-ink/60"
                  />
                  <div className="nosb mt-2.5 flex gap-2 overflow-x-auto">
                    {IDEAS.map((idea) => (
                      <button key={idea} onClick={() => setTopic(idea)} className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
                        {idea}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Source material" hint="optional">
                    <Segmented
                      id="car-source"
                      size="sm"
                      value={sourceMode}
                      onChange={setSourceMode}
                      options={[
                        { value: "none", label: "None" },
                        { value: "text", label: <span className="flex items-center gap-1"><FileText size={13} /> Paste text</span>, aria: "Paste text" },
                        { value: "link", label: <span className="flex items-center gap-1"><Link2 size={13} /> From a link</span>, aria: "From a link" },
                      ]}
                    />
                    {sourceMode === "text" && (
                      <textarea aria-label="Source text" value={sourceText} onChange={(e) => setSourceText(e.target.value)} rows={4} maxLength={12000} placeholder="Paste a blog post, thread, notes or a transcript. Pip builds the carousel from it." className={cx(inputClass, "mt-2 h-auto py-2.5 text-sm")} />
                    )}
                    {sourceMode === "link" && <input aria-label="Source link" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://… an article or blog post" className={cx(inputClass, "mt-2 text-sm")} />}
                  </Field>
                  <Field label="Notes for Pip" hint="optional">
                    <input aria-label="Notes for Pip" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="Audience, offer, must-mention points…" className={cx(inputClass, "text-sm")} />
                  </Field>
                  <Field label="Your handle" hint="shown on slides">
                    <input aria-label="Your handle" value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={31} placeholder="@yourhandle" className={cx(inputClass, "text-sm")} />
                  </Field>
                  <Field label="Brand or name" hint="optional">
                    <input aria-label="Brand or name" value={brandName} onChange={(e) => setBrandName(e.target.value)} maxLength={40} placeholder="Shown on the last slide" className={cx(inputClass, "text-sm")} />
                  </Field>
                </div>

                <div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { id: "auto", title: "Let Pip decide", text: "Pip reads your topic and picks the structure, slide count, three distinct design directions and the photos.", tag: "Recommended" },
                      { id: "custom", title: "Custom", text: "Choose the number of designs, slides, styles, tone and goal yourself. Pip fills in the rest." },
                    ].map((o) => (
                      <button
                        key={o.id}
                        onClick={() => setMode(o.id)}
                        aria-pressed={mode === o.id}
                        className={cx("relative rounded-2xl border p-4 text-left transition-[border-color,box-shadow]", mode === o.id ? "border-ink shadow-[0_0_0_3px_rgba(23,21,15,.08)]" : "border-line hover:border-line-strong")}
                      >
                        <span className="flex items-center gap-2 text-[15px] font-semibold">
                          {o.id === "auto" ? <Sparkles size={16} className="text-accent" /> : <Wand size={16} />} {o.title}
                          {o.tag && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">{o.tag}</span>}
                        </span>
                        <span className="mt-1 block text-[13px] leading-relaxed text-mute">{o.text}</span>
                        {mode === o.id && <Check size={16} className="absolute right-4 top-4" />}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence initial={false}>
                    {mode === "custom" && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mt-4 grid gap-5 rounded-2xl border border-line-soft bg-wash p-4 sm:grid-cols-2">
                          <Field label="Designs to create">
                            <Stepper value={variations} onChange={setVariations} min={1} max={4} label="designs" />
                          </Field>
                          <Field label="Slides per carousel">
                            <div className="flex items-center gap-3">
                              <Segmented id="car-slides" size="sm" value={autoSlides ? "auto" : "set"} onChange={(v) => setAutoSlides(v === "auto")} options={[{ value: "auto", label: "Pip decides" }, { value: "set", label: "Set" }]} />
                              {!autoSlides && <Stepper value={slides} onChange={setSlides} min={3} max={20} label="slides" />}
                            </div>
                          </Field>
                          <Field label="Styles" hint={styles.length ? `${styles.length} picked` : "Pip decides"}>
                            <div className="flex flex-wrap gap-1.5">
                              {STYLE_IDS.map((id) => (
                                <button
                                  key={id}
                                  onClick={() => toggleStyle(id)}
                                  aria-pressed={styles.includes(id)}
                                  title={STYLES[id].blurb}
                                  className={cx("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors", styles.includes(id) ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:border-line-strong")}
                                >
                                  <span className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10" style={{ background: STYLES[id].sample.accent }} />
                                  {STYLES[id].name}
                                </button>
                              ))}
                            </div>
                          </Field>
                          <Field label="Images">
                            <Segmented
                              id="car-images"
                              size="sm"
                              value={images}
                              onChange={setImages}
                              options={[
                                { value: "", label: "Pip decides" },
                                { value: "most", label: "Most slides" },
                                { value: "some", label: "A few" },
                                { value: "none", label: "Text only" },
                              ]}
                            />
                          </Field>
                          <Field label="Goal">
                            <Segmented id="car-goal" size="sm" value={goal} onChange={setGoal} options={GOALS} />
                          </Field>
                          <Field label="Tone" hint="pick one or type your own">
                            <div className="flex flex-wrap gap-1.5">
                              {TONES.map((t) => (
                                <button key={t} onClick={() => setTone(tone === t ? "" : t)} aria-pressed={tone === t} className={cx("rounded-full border px-2.5 py-1 text-xs transition-colors", tone === t ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:border-line-strong")}>
                                  {t}
                                </button>
                              ))}
                              <input aria-label="Other tone" value={TONES.includes(tone) ? "" : tone} onChange={(e) => setTone(e.target.value)} placeholder="Other…" maxLength={80} className="h-7 w-28 rounded-full border border-line bg-surface px-3 text-xs outline-none focus:border-ink/60" />
                            </div>
                          </Field>
                          <Field label="Anything else">
                            <input aria-label="Other requirements" value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={400} placeholder="e.g. end with a free checklist offer" className={cx(inputClass, "h-9 text-sm")} />
                          </Field>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Format">
                    <Segmented id="car-format" size="sm" value={format} onChange={setFormat} options={Object.entries(FORMATS).map(([value, f]) => ({ value, label: f.label, aria: f.note }))} />
                    <p className="mt-1.5 text-xs text-faint">{FORMATS[format].note}</p>
                  </Field>
                  <Field label="Photos">
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
                      <span className="text-[13px] leading-snug text-ink-2">
                        Only images marked free to use commercially
                        <span className="block text-xs text-faint">Off: Pip searches the whole web; check licenses before publishing.</span>
                      </span>
                      <Switch on={licensed} onChange={setLicensed} label="Only commercially licensed images" />
                    </label>
                  </Field>
                </div>
                {error && <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{error}</p>}
              </motion.div>
            )}

            {step === "planning" && (
              <motion.div key="planning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20 text-center">
                <LoaderCircle size={28} className="animate-spin text-accent" />
                <p className="mt-4 text-[15px] font-medium">Reading the topic, choosing a structure and three directions</p>
                <p className="mt-1 text-sm text-mute">This takes about 15 seconds.</p>
                <Button variant="ghost" size="sm" className="mt-6" onClick={() => { abort.current?.abort(); setStep("brief"); }}>
                  Cancel
                </Button>
              </motion.div>
            )}

            {step === "plan" && plan && (
              <motion.div key="plan" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="rounded-2xl border border-line-soft bg-wash p-4 sm:p-5">
                  <p className="text-[13px] font-medium text-mute">Strategy</p>
                  <h3 className="display mt-1 text-xl leading-snug">{plan.title}</h3>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-faint">Audience</dt>
                      <dd className="mt-0.5 text-ink-2">{plan.audience}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-faint">Built to win</dt>
                      <dd className="mt-0.5 capitalize text-ink-2">{plan.goal}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-faint">Recommended length</dt>
                      <dd className="mt-0.5 text-ink-2">{plan.slideCount} slides</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-sm leading-relaxed text-ink-2">
                    <span className="font-medium">Angle:</span> {plan.angle}
                  </p>
                  {plan.reasoning && <p className="mt-1 text-sm leading-relaxed text-mute">{plan.reasoning}</p>}
                </div>

                <div>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <h3 className="text-[15px] font-semibold">Creative directions</h3>
                      <p className="text-[13px] text-mute">Each one is a different story and look. Untick any you don't want, or tweak them.</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {directions.map((d) => {
                      const on = picked[d.id] !== false;
                      return (
                        <div key={d.id} className={cx("flex gap-4 rounded-2xl border p-3 transition-opacity sm:p-4", on ? "border-line" : "border-line-soft opacity-55")}>
                          <DirectionCover d={d} format={format} brand={brand} width={124} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="text-[15px] font-semibold">{d.name}</h4>
                                <p className="mt-0.5 text-[13px] leading-relaxed text-mute">{d.concept}</p>
                              </div>
                              <Switch on={on} onChange={(v) => setPicked((p) => ({ ...p, [d.id]: v }))} label={`Include ${d.name}`} />
                            </div>
                            <label className="mt-2.5 block">
                              <span className="sr-only">Hook</span>
                              <input aria-label={`Hook for ${d.name}`} value={d.hook} onChange={(e) => updateDirection(d.id, { hook: e.target.value.slice(0, 90) })} className="h-9 w-full rounded-xl border border-line bg-surface px-3 text-sm font-medium outline-none focus:border-ink/60" />
                            </label>
                            {plan.hooks?.length > 0 && (
                              <div className="nosb mt-1.5 flex gap-1.5 overflow-x-auto">
                                {plan.hooks.filter((h) => h !== d.hook).slice(0, 4).map((h) => (
                                  <button key={h} onClick={() => updateDirection(d.id, { hook: h })} className="shrink-0 rounded-full bg-sunken px-2.5 py-1 text-[11px] text-ink-2 hover:text-ink" title="Use this hook">
                                    {h}
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                              <select value={d.style} onChange={(e) => updateDirection(d.id, { style: e.target.value, palette: STYLES[e.target.value].sample })} aria-label="Style" className="h-8 rounded-full border border-line bg-surface px-2.5 outline-none">
                                {STYLE_IDS.map((id) => (
                                  <option key={id} value={id}>
                                    {STYLES[id].name}
                                  </option>
                                ))}
                              </select>
                              <select value={d.framework} onChange={(e) => updateDirection(d.id, { framework: e.target.value })} aria-label="Story structure" className="h-8 rounded-full border border-line bg-surface px-2.5 outline-none">
                                {Object.entries(FRAMEWORK_LABEL).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                              <select value={d.imageApproach} onChange={(e) => updateDirection(d.id, { imageApproach: e.target.value })} aria-label="Images" className="h-8 rounded-full border border-line bg-surface px-2.5 outline-none">
                                {Object.entries(IMAGE_LABEL).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                              <span className="flex items-center gap-1.5 text-mute">
                                Slides <Stepper value={d.slideCount} onChange={(n) => updateDirection(d.id, { slideCount: n })} min={3} max={20} label="slides" />
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line-soft bg-wash px-6 py-3.5">
          <p className="text-xs text-mute">
            {step === "plan" ? `${cost} credits · about a minute` : step === "brief" ? "Planning uses 1 credit. You review the plan before anything is generated." : ""}
          </p>
          {step === "brief" && (
            <Button variant="accent" icon={Sparkles} onClick={makePlan}>
              Plan my carousel
            </Button>
          )}
          {step === "plan" && (
            <Button variant="accent" icon={Sparkles} onClick={generate} disabled={!chosen.length}>
              Generate {chosen.length === 1 ? "1 carousel" : `${chosen.length} carousels`}
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
