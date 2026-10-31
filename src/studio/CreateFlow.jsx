import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Check, ChevronDown, Globe, Maximize2, Monitor, RotateCcw, Smartphone, Users, X, Zap } from "lucide-react";
import { useStore } from "../store";
import { uid } from "../util";
import { Button, EASE, IconButton, Switch, cx, fireBurst } from "../ui";
import { Aura, Mark, PipGlyph, PipLoader } from "../brand";
import { PLATFORM_LABEL } from "../util";
import { buildSystems, extractShell, shellSource, understand, VIEWPORTS, writeScreen } from "../design/engine.js";
import { PATTERNS } from "../design/patterns.js";
import { SKILLS, skillById } from "../design/skills.js";
import { fontsUrl } from "../design/fonts.js";
import { Frame } from "./Frame";

// Three directions not shown yet, ranked by how well they suit the product.
function alternateSkills(spec, shown) {
  const text = `${spec.category} ${spec.summary} ${spec.audience} ${spec.tagline}`.toLowerCase();
  return SKILLS.filter((k) => !shown.includes(k.id))
    .map((k) => ({ k, score: k.bestFor.filter((w) => text.includes(w)).length + Math.random() * 0.9 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ k }) => ({ skill: k.id, why: `An alternative take: ${k.tagline.toLowerCase()}`, twist: "" }));
}

// What the user settled in the refine step, one item per question. They are
// shown back to them and travel with the spec as requirements every later
// stage honors.
function decisionsOf(b) {
  if (!b) return [];
  return [
    b.name && { label: "Name", values: [b.name] },
    ...(b.answers || []).map((a) => ({ label: a.question, values: a.picks || [a.answer] })),
    b.notes && { label: "Also", values: [b.notes] },
  ].filter(Boolean);
}

const pad = (n) => String(n).padStart(2, "0");
const STEPS = ["Understand", "Directions", "Build"];

function Stepper({ at }) {
  return (
    <ol className="hidden items-center md:flex" aria-label="Progress">
      {STEPS.map((l, i) => (
        <li key={l} className="flex items-center" aria-current={i === at ? "step" : undefined}>
          <span className={cx("inline-flex items-center gap-2 text-xs font-medium transition-colors duration-500", i <= at ? "text-ink" : "text-faint")}>
            <span
              className={cx(
                "flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] transition-[background-color,box-shadow] duration-500",
                i < at ? "bg-ink text-white" : i === at ? "bg-accent text-white shadow-[0_0_0_4px_rgba(255,77,26,.14)]" : "border border-line-strong",
              )}
            >
              {i < at ? <Check size={11} strokeWidth={3} /> : i + 1}
            </span>
            {l}
          </span>
          {i < STEPS.length - 1 && (
            <span className="relative mx-3 h-px w-10 overflow-hidden bg-line-strong">
              <motion.span className="absolute inset-0 origin-left bg-ink" initial={false} animate={{ scaleX: i < at ? 1 : 0 }} transition={{ duration: 0.7, ease: EASE }} />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

const LINES = ["Reading the idea", "Finding who it's for", "Deciding what the main screen is built around", "Mapping the screens and how they connect", "Choosing three directions worth comparing"];

function Thinking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const h = setInterval(() => setI((n) => Math.min(LINES.length - 1, n + 1)), 3200);
    return () => clearInterval(h);
  }, []);
  return (
    <ol className="mx-auto mt-12 grid w-fit gap-3.5 text-left text-[15px]">
      {LINES.map((l, j) => (
        <motion.li
          key={l}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: j > i ? 0.35 : 1, x: 0 }}
          transition={{ duration: 0.5, delay: j * 0.08, ease: EASE }}
          className="flex items-center gap-3"
        >
          <span className="flex h-5 w-5 items-center justify-center">
            {j < i ? (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }} className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white">
                <Check size={11} strokeWidth={3} />
              </motion.span>
            ) : j === i ? (
              <PipGlyph size={15} pulse />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
            )}
          </span>
          <span className={j === i ? "shine-text font-medium" : ""}>{l}</span>
        </motion.li>
      ))}
    </ol>
  );
}

function DecisionChips({ items, className }) {
  return (
    <span className={cx("flex flex-wrap gap-1.5", className)}>
      {items
        .flatMap((d) => d.values.map((value) => ({ label: d.label, value })))
        .map((d, i) => (
          <motion.span
            key={d.label + d.value}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05, duration: 0.4, ease: EASE }}
            title={d.label}
            className="max-w-full rounded-xl bg-accent-soft px-2.5 py-1 text-xs font-medium leading-snug text-accent-deep"
          >
            {d.value}
          </motion.span>
        ))}
    </span>
  );
}

function Fact({ icon: Icon, label, children }) {
  return (
    <div>
      <dt className="eyebrow flex items-center gap-1.5">
        <Icon size={12} /> {label}
      </dt>
      <dd className="mt-1.5 leading-relaxed text-ink-2">{children}</dd>
    </div>
  );
}

// The product as Pip understood it, with the screens to design and the
// user's own decisions, above the directions.
function BriefBar({ spec, decisions, included, toggle, paint, setPaint }) {
  const [open, setOpen] = useState(false);
  const lead = shellSource(spec).id;
  const PlatformIcon = spec.platform === "mobile" ? Smartphone : spec.platform === "web" ? Monitor : Globe;
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="rounded-[28px] border border-line bg-surface shadow-soft" aria-label="The brief">
      <div className="grid gap-x-12 gap-y-6 p-6 sm:px-8 sm:py-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="min-w-0">
          <div className="eyebrow flex items-center gap-2">
            <PlatformIcon size={13} /> {PLATFORM_LABEL[spec.platform] || "Website"}
          </div>
          <h1 className="display mt-2.5 text-[38px] leading-[0.95] sm:text-[46px]">{spec.name}</h1>
          <p className="mt-2.5 text-[17px] leading-snug text-ink-2">{spec.tagline}</p>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-mute">{spec.summary}</p>
          {decisions.length > 0 && (
            <div className="mt-5">
              <div className="eyebrow flex items-center gap-1.5">
                <Check size={12} /> Your decisions
              </div>
              <DecisionChips items={decisions} className="mt-2" />
            </div>
          )}
        </div>
        <dl className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5 text-sm lg:border-l lg:border-line-soft lg:pl-10">
          <Fact icon={Users} label="Who it's for">
            {spec.audience}
          </Fact>
          {spec.heroObject && (
            <Fact icon={Zap} label="Built around">
              {spec.heroObject}
            </Fact>
          )}
        </dl>
      </div>
      <div className="border-t border-line-soft px-6 py-4 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="text-sm">
            <span className="font-semibold">Screens</span>
            <span className="text-mute">
              {" "}
              · {included.size} of {spec.screens.length} will be designed
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2.5 text-sm">
              <Switch on={paint} onChange={setPaint} label="Paint an image kit" />
              <span title="Four art-directed images in the direction's style, painted while the screens are built">
                Paint an image kit <span className="text-mute">· 8 credits</span>
              </span>
            </div>
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 transition-colors hover:text-ink">
              {open ? "Hide details" : "Screen details"}
              <ChevronDown size={14} className={cx("transition-transform duration-300", open && "rotate-180")} />
            </button>
          </div>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {spec.screens.map((sc) => {
            const on = included.has(sc.id);
            const isLead = sc.id === lead;
            return (
              <li key={sc.id}>
                <button
                  type="button"
                  onClick={() => toggle(sc.id)}
                  aria-pressed={on}
                  disabled={isLead}
                  title={isLead ? "Previewed below, always designed" : sc.purpose}
                  className={cx(
                    "inline-flex h-9 items-center gap-2 rounded-full border pl-2 pr-3.5 text-[13px] transition-colors",
                    on ? "border-line-strong bg-surface text-ink" : "border-dashed border-line text-faint",
                    !isLead && "hover:border-ink/50",
                  )}
                >
                  <span className={cx("flex h-5 w-5 items-center justify-center rounded-full transition-colors", on ? "bg-ink text-white" : "border border-line-strong")}>{on && <Check size={10} strokeWidth={3} />}</span>
                  <span className={cx(!on && "line-through decoration-line-strong")}>{sc.name}</span>
                  {isLead && <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-deep">Preview</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} className="overflow-hidden">
              <ol className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-3">
                {spec.screens.map((sc, i) => (
                  <li key={sc.id} className={cx("rounded-2xl border border-line-soft bg-wash p-4 transition-opacity", !included.has(sc.id) && "opacity-50")}>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="font-mono text-[11px] text-faint">{pad(i + 1)}</span>
                      <span className="min-w-0 truncate">{sc.name}</span>
                      {PATTERNS[sc.pattern] && <span className="ml-auto shrink-0 rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium text-mute">{PATTERNS[sc.pattern].name}</span>}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-mute">{sc.purpose}</p>
                  </li>
                ))}
              </ol>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function Elapsed({ since }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const h = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(h);
  }, []);
  return <span className="tabular-nums">{Math.max(0, Math.round((Date.now() - since) / 1000))}s</span>;
}

function Preview({ id, system, preview, viewport, kit, scale, height }) {
  const done = preview?.status === "done";
  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0", width: viewport.w }}>
      {preview?.html || preview?.status === "running" ? (
        <Frame id={id} html={done ? preview.html : ""} streaming={done ? null : preview.html || ""} system={system} kit={kit} width={viewport.w} height={height} />
      ) : preview?.status === "error" ? (
        <div style={{ width: viewport.w, height }} />
      ) : (
        <div className="skel" style={{ width: viewport.w, height }} />
      )}
    </div>
  );
}

function DirectionCard({ system, preview, viewport, onChoose, onExpand, onRetry, index, kit }) {
  const skill = skillById(system.skill);
  const [stage, width] = useWidth();
  const mobile = viewport.w < 600;
  const frameH = mobile ? viewport.h : 1000;
  const inner = mobile ? Math.min(width, 300) : width;
  const scale = inner / viewport.w;
  const stageH = mobile ? Math.min(frameH * scale, 500) : Math.min(frameH * scale, 340);
  const status = preview?.status || "running";
  const done = status === "done";
  // Streamed length is the honest progress signal: a screen is a few thousand
  // characters of HTML and arrives as it's written.
  const progress = done ? 1 : 1 - Math.exp(-(preview?.html?.length || 0) / 6000);
  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: index * 0.1, ease: EASE }}
      className="group/card flex min-w-0 flex-col overflow-hidden rounded-[28px] border border-line bg-surface shadow-soft transition-[box-shadow,transform] duration-500 hover:-translate-y-1 hover:shadow-lift"
    >
      <div
        ref={stage}
        className="relative overflow-hidden border-b border-line-soft bg-wash px-5 pt-6 sm:px-6"
        style={{ backgroundImage: `radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, ${system.colors.primary} 14%, transparent), transparent 70%)` }}
      >
        <div
          className={cx("relative mx-auto overflow-hidden bg-white shadow-[0_24px_60px_-28px_rgba(23,21,15,.5),0_0_0_1px_rgba(23,21,15,.06)]", mobile ? "rounded-t-[30px]" : "rounded-t-xl")}
          style={{ width: inner || "100%", height: width ? stageH : mobile ? 460 : 220 }}
        >
          {width > 0 && <Preview id={"dir-" + index} system={system} preview={preview} viewport={viewport} kit={kit} scale={scale} height={frameH} />}
          {status === "error" && (
            <div className="absolute inset-0 grid place-items-center bg-surface p-6 text-center">
              <div>
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-danger-soft text-danger">
                  <AlertTriangle size={17} />
                </span>
                <p className="mt-3 text-sm font-medium">This preview didn't come together</p>
                <Button size="sm" variant="secondary" icon={RotateCcw} className="mt-3" onClick={onRetry}>
                  Try again
                </Button>
              </div>
            </div>
          )}
          {done && (
            <button
              onClick={onExpand}
              aria-label={`Enlarge ${system.name}`}
              className="absolute inset-0 flex items-end justify-end p-3 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100 focus-visible:opacity-100"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-xs font-medium text-white">
                <Maximize2 size={12} /> Enlarge
              </span>
            </button>
          )}
        </div>
        <AnimatePresence>
          {status === "running" && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="pointer-events-none absolute inset-x-0 top-0">
              <div className="h-[3px] bg-ink/5">
                <motion.div className="h-full origin-left bg-accent" initial={{ scaleX: 0 }} animate={{ scaleX: Math.max(0.04, progress) }} transition={{ duration: 0.6, ease: "easeOut" }} />
              </div>
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-2.5 py-1 text-[11px] font-medium text-ink-2 shadow-sm">
                <PipGlyph size={11} pulse />
                {preview?.html ? "Designing" : "Starting"} · {preview?.startedAt ? <Elapsed since={preview.startedAt} /> : "0s"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="eyebrow text-accent-deep">{skill.name}</span>
          <span className="font-mono text-[11px] text-faint">{pad(index + 1)}</span>
        </div>
        <h3 className="mt-2 text-[26px] font-semibold leading-[1.1]" style={{ fontFamily: `"${system.fonts.display}"`, letterSpacing: system.type.displayTracking }}>
          {system.name}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-mute">{system.pitch}</p>
        <div className="mt-5 flex items-center gap-4 border-t border-line-soft pt-5">
          <div className="flex -space-x-1.5">
            {["bg", "surface2", "primary", "accent", "ink"].map((k, i) => (
              <motion.span
                key={k}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.35 + index * 0.1 + i * 0.05, type: "spring", stiffness: 420, damping: 18 }}
                className="h-7 w-7 rounded-full border-2 border-surface shadow-sm"
                style={{ background: system.colors[k] }}
              />
            ))}
          </div>
          <div className="min-w-0 text-xs text-mute">
            <div className="truncate text-ink-2" style={{ fontFamily: `"${system.fonts.display}"` }}>
              {system.fonts.display}
            </div>
            <div className="truncate" style={{ fontFamily: `"${system.fonts.body}"` }}>
              {system.fonts.body}
            </div>
          </div>
        </div>
        <div className="mt-auto pt-6">
          <Button full={true} variant={done ? "primary" : "secondary"} iconRight={done ? ArrowRight : undefined} disabled={!done} onClick={onChoose}>
            {done ? "Design with this" : status === "error" ? "Preview failed" : "Preview on its way"}
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

function CardSkeleton({ mobile, index }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.08 }} className="flex min-w-0 flex-col overflow-hidden rounded-[28px] border border-line bg-surface shadow-soft">
      <div className="border-b border-line-soft bg-wash px-6 pt-6">
        <div className={cx("skel mx-auto w-full", mobile ? "h-[440px] max-w-[300px] rounded-t-[30px]" : "h-[230px] rounded-t-xl")} />
      </div>
      <div className="flex flex-col gap-3 p-6">
        <div className="skel h-3 w-24 rounded-full" />
        <div className="skel h-7 w-48 rounded-full" />
        <div className="skel h-10 w-full rounded-xl" />
        <div className="mt-2 flex items-center gap-2 text-xs text-mute">
          <PipGlyph size={12} pulse /> Building a design system
        </div>
      </div>
    </motion.div>
  );
}

function PreviewProgress({ systems, previews }) {
  const ready = previews.filter((p) => p?.status === "done").length;
  const total = systems ? systems.length : 3;
  const label = !systems ? "Building three design systems" : ready === total ? "All three previews are ready" : `Designing previews · ${ready} of ${total} ready`;
  return (
    <div className="mt-6 flex items-center gap-3 text-[13px] text-mute" aria-live="polite">
      <span className="flex gap-1">
        {Array.from({ length: total }, (_, i) => {
          const st = previews[i]?.status;
          return <span key={i} className={cx("h-1.5 w-6 rounded-full transition-colors duration-500", st === "done" ? "bg-ink" : st === "error" ? "bg-danger" : systems ? "bg-accent/40" : "bg-line-strong")} />;
        })}
      </span>
      {label}
    </div>
  );
}

// The creation flow: understand → three directions → build in the studio.
export function CreateFlow({ request }) {
  const { s, api } = useStore();
  const [stage, setStage] = useState("understanding");
  const [spec, setSpec] = useState(null);
  const [included, setIncluded] = useState(new Set());
  const [systems, setSystems] = useState(null);
  const [previews, setPreviews] = useState([]);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [note, setNote] = useState("");
  const [paint, setPaint] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const shown = useRef([]);
  const ctrls = useRef([]);
  const quality = s.data.prefs.aiQuality || "fast";
  const decisions = useMemo(() => decisionsOf(request.brief), [request.brief]);
  const recent = useMemo(
    () => s.data.projects.filter((p) => p.kind === "canvas").slice(0, 4).map((p) => p.system?.skill).filter(Boolean),
    [],
  );

  const abortAll = () => ctrls.current.forEach((c) => c.abort());
  useEffect(() => abortAll, []);

  const setPreview = (i, fn) => setPreviews((pv) => pv.map((p, j) => (j === i ? fn(p) : p)));

  const runPreview = (sp, system, i) => {
    const ctrl = new AbortController();
    ctrls.current.push(ctrl);
    setPreview(i, () => ({ status: "running", html: "", startedAt: Date.now() }));
    writeScreen({
      spec: sp,
      system,
      screen: shellSource(sp),
      kit: sp.imagery || [],
      first: true,
      quality,
      image: request.image,
      signal: ctrl.signal,
      onHtml: (h) => setPreview(i, (p) => ({ ...p, html: h })),
    })
      .then(({ html }) => setPreview(i, () => ({ status: "done", html })))
      .catch((err) => err.name !== "AbortError" && setPreview(i, () => ({ status: "error", html: "", error: err.message })));
  };

  const directions = async (sp, extraNote, skills) => {
    setSystems(null);
    setPreviews([]);
    const ctrl = new AbortController();
    ctrls.current.push(ctrl);
    const picks = skills || sp.directions;
    shown.current = [...new Set([...shown.current, ...picks.map((d) => d.skill)])];
    const list = await buildSystems({ spec: sp, directions: picks, instruction: extraNote, signal: ctrl.signal });
    setSystems(list);
    setPreviews(list.map(() => ({ status: "running", html: "", startedAt: Date.now() })));
    list.forEach((system, i) => runPreview(sp, system, i));
  };

  useEffect(() => {
    let live = true;
    const ctrl = new AbortController();
    ctrls.current.push(ctrl);
    setError(null);
    setStage("understanding");
    const b = request.brief;
    const idea = [
      request.prompt,
      b?.pitch && `Sharpened pitch: ${b.pitch}`,
      b?.audience && `Audience: ${b.audience}`,
      b?.name && `Use the app name: ${b.name}`,
      ...(b?.answers || []).map((a) => `${a.question} ${a.answer}`),
      b?.notes && `Also: ${b.notes}`,
    ]
      .filter(Boolean)
      .join("\n");
    understand({ prompt: idea, platform: request.platform, image: request.image, recent, direction: request.direction, signal: ctrl.signal })
      .then(async ({ spec: sp }) => {
        if (!live) return;
        if (request.direction && !sp.directions.some((d) => d.skill === request.direction)) {
          sp.directions = [{ skill: request.direction, why: "Your pick", twist: "" }, ...sp.directions].slice(0, 3);
        }
        if (b?.name) sp.name = b.name;
        if (decisions.length) sp.decisions = decisions.map((d) => `- ${d.label}: ${d.values.join("; ")}`).join("\n");
        setSpec(sp);
        setIncluded(new Set(sp.screens.map((x) => x.id)));
        setStage("directions");
        await directions(sp);
      })
      .catch((err) => {
        if (err.name !== "AbortError" && live) {
          setError(err.message || "Something went wrong.");
        }
      });
    return () => {
      live = false;
      ctrl.abort();
    };
  }, [attempt]);

  const toggle = (id) =>
    setIncluded((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const choose = (index) => {
    const system = systems[index];
    const heroHtml = previews[index].html;
    const hero = shellSource(spec);
    const keep = spec.screens.filter((x) => included.has(x.id) || x.id === hero.id);
    const now = Date.now();
    const project = {
      id: uid(),
      kind: "canvas",
      name: spec.name,
      tagline: spec.tagline,
      prompt: request.prompt,
      platform: spec.platform,
      fav: false,
      created: now,
      spec: { ...spec, screens: undefined },
      directions: systems,
      system,
      shell: extractShell(heroHtml),
      shellSourceId: hero.id,
      screens: keep.map((x) =>
        x.id === hero.id
          ? { ...x, html: heroHtml, status: "ready", changeLabel: "First draft", changedAt: now, versions: [] }
          : { ...x, html: "", status: "pending", versions: [] },
      ),
      kit: paint ? (spec.imagery || []).slice(0, 4).map((k) => ({ ...k, status: "pending", url: null })) : (spec.imagery || []).map((k) => ({ ...k, status: "skipped", url: null })),
      chat: [],
      review: null,
    };
    abortAll();
    api.add(project);
    api.toast(`Designing ${project.name} in ${system.name}`);
    fireBurst();
  };

  const cancel = () => {
    abortAll();
    api.cancelGen();
  };

  const steer = (e) => {
    e.preventDefault();
    abortAll();
    ctrls.current = [];
    // A note steers the same directions; no note means three different ones.
    directions(spec, note || "", note ? systems.map((x) => ({ skill: x.skill, why: x.why, twist: x.twist })) : alternateSkills(spec, shown.current)).catch(
      (err) => err.name !== "AbortError" && setError(err.message),
    );
  };

  const viewport = spec?.platform === "mobile" ? VIEWPORTS.mobile : VIEWPORTS.desktop;
  const mobile = viewport.w < 600;
  const fontLink = useMemo(() => (systems ? fontsUrl(systems.flatMap((x) => [x.fonts.display, x.fonts.body])) : null), [systems]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="sb fixed inset-0 z-50 overflow-y-auto bg-paper" role="dialog" aria-label="New design">
      {fontLink && <link rel="stylesheet" href={fontLink} />}
      <Aura className={cx("fixed inset-x-0 top-0 h-[70vh] transition-opacity duration-1000", stage === "understanding" ? "opacity-80" : "opacity-40")} strong={stage === "understanding"} />
      <header className="sticky top-0 z-10 border-b border-line/70 bg-paper/90 backdrop-blur-md">
        <div className="mx-auto grid h-16 max-w-[1480px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:px-8 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <Mark size={26} />
            <div className="min-w-0 truncate text-sm">
              <span className="font-semibold">New design</span>
              <span className="hidden text-mute lg:inline"> · “{request.prompt.slice(0, 60)}{request.prompt.length > 60 ? "…" : ""}”</span>
            </div>
          </div>
          <Stepper at={stage === "understanding" ? 0 : 1} />
          <div className="flex justify-end">
            <IconButton icon={X} label="Close" onClick={cancel} />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1480px] px-4 pb-16 pt-8 sm:px-8 sm:pt-10 lg:px-10">
        <AnimatePresence mode="wait" initial={false}>
          {error ? (
            <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto mt-16 max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-lift">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
                <AlertTriangle size={20} />
              </span>
              <h2 className="display mt-5 text-[28px]">That didn't come together</h2>
              <p className="mt-2 text-sm text-mute">{error}</p>
              <div className="mt-6 flex justify-center gap-2">
                <Button icon={RotateCcw} onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </Button>
                <Button variant="secondary" onClick={cancel}>
                  Back
                </Button>
              </div>
            </motion.div>
          ) : stage === "understanding" ? (
            <motion.div key="understanding" exit={{ opacity: 0, y: -12, transition: { duration: 0.3 } }} className="mx-auto max-w-2xl pt-10 text-center sm:pt-16">
              <PipLoader size={56} className="mx-auto" label="Understanding your idea" />
              <p className="eyebrow mt-10">Understanding the product</p>
              <motion.h1 initial={{ opacity: 0, y: 12, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.8, ease: EASE }} className="display mt-4 text-[32px] leading-[1.15] sm:text-[44px]">
                “{request.prompt.slice(0, 160)}”
              </motion.h1>
              {decisions.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs text-mute">Keeping your decisions</p>
                  <DecisionChips items={decisions} className="mt-2 justify-center" />
                </div>
              )}
              <Thinking />
            </motion.div>
          ) : (
            <motion.div key="directions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              <BriefBar spec={spec} decisions={decisions} included={included} toggle={toggle} paint={paint} setPaint={setPaint} />

              <section className="mt-12" aria-label="Directions">
                <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
                  <div className="max-w-2xl">
                    <p className="eyebrow">Three directions</p>
                    <h2 className="display mt-2 text-[32px] leading-[1.05] sm:text-[40px]">Pick the one that feels right</h2>
                    <p className="mt-2 text-[15px] leading-relaxed text-mute">Each is a complete design system, previewed on your {shellSource(spec).name} screen. The rest of the screens follow the one you choose.</p>
                  </div>
                  <form onSubmit={steer} className="flex w-full items-center gap-2 rounded-full border border-line bg-surface p-1.5 pl-4 shadow-soft transition-[border-color,box-shadow] focus-within:border-ink/40 focus-within:shadow-glow lg:w-[28rem]">
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="More playful, darker, more editorial…" aria-label="Steer the directions" className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
                    <Button size="sm" variant={note.trim() ? "primary" : "secondary"} icon={RotateCcw} type="submit" disabled={!systems}>
                      {note.trim() ? "Steer" : "New directions"}
                    </Button>
                  </form>
                </div>

                <PreviewProgress systems={systems} previews={previews} />

                <div className={cx("mt-6 grid gap-6 lg:gap-8", mobile ? "md:grid-cols-3" : "lg:grid-cols-3")}>
                  {systems
                    ? systems.map((system, i) => (
                        <DirectionCard
                          key={system.name + i}
                          index={i}
                          system={system}
                          preview={previews[i]}
                          viewport={viewport}
                          kit={spec.imagery || []}
                          onChoose={() => choose(i)}
                          onExpand={() => setExpanded(i)}
                          onRetry={() => runPreview(spec, system, i)}
                        />
                      ))
                    : [0, 1, 2].map((i) => <CardSkeleton key={i} index={i} mobile={mobile} />)}
                </div>
                <p className="mt-8 flex items-center gap-2 text-xs text-mute">
                  <PipGlyph size={12} /> After you choose, the rest of the screens are designed in that system, live on the canvas.
                </p>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <AnimatePresence>
        {expanded !== null && systems?.[expanded] && (
          <Enlarged key="enlarged" system={systems[expanded]} preview={previews[expanded]} viewport={viewport} kit={spec.imagery || []} onClose={() => setExpanded(null)} onChoose={() => choose(expanded)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Enlarged({ system, preview, viewport, kit, onClose, onChoose }) {
  const mobile = viewport.w < 600;
  const frameH = mobile ? viewport.h : 900;
  const scale = Math.min(1, (window.innerWidth - 120) / viewport.w, (window.innerHeight - 150) / frameH);
  useEffect(() => {
    const key = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-ink/70 p-6 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
        className={cx("overflow-hidden bg-white shadow-2xl", mobile ? "rounded-[36px]" : "rounded-xl")}
        style={{ width: viewport.w * scale, height: frameH * scale }}
      >
        <Preview id="dir-enlarged" system={system} preview={preview} viewport={viewport} kit={kit} scale={scale} height={frameH} />
      </motion.div>
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <span className="mr-2 text-sm font-semibold text-white">{system.name}</span>
        <Button variant="secondary" onClick={onClose}>
          Back
        </Button>
        <Button iconRight={ArrowRight} onClick={onChoose}>
          Design with this
        </Button>
      </div>
    </motion.div>
  );
}
