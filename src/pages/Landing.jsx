import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useInView, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ArrowUp, Check, Globe, Monitor, MousePointer2, Plus, Smartphone, X } from "lucide-react";
import { useSession } from "../session";
import { Aura, Logo, Mark, PipGlyph } from "../brand";
import { Button, EASE, Segmented, cx, useSpotlight } from "../ui";
import { PLATFORM_LABEL } from "../util";
import { SKILLS } from "../design/skills.js";
import { SPECIMEN_FONTS, specimen } from "../design/specimen.js";
import { ShowcaseCard, ShowcaseViewer, useShowcase } from "../showcase";

const IDEAS = ["A zine-style app for a music festival in Goa", "A booking site for a ceramics studio in Kyoto", "A control room for a cold-chain fleet", "A shared money app for couples"];
const thumb = (item, s) => `/showcase/${item.slug}/${s.id}.thumb.webp`;

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Pauses an element's CSS animations while it's off screen.
function usePausedOffscreen() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => el.classList.toggle("paused", !e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, className, delay = 0, y = 18 }) {
  return (
    <motion.div initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.8, delay, ease: EASE }} className={className}>
      {children}
    </motion.div>
  );
}

function Nav({ user, onStart, scroller }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    const on = () => setScrolled(el.scrollTop > 12);
    el?.addEventListener("scroll", on, { passive: true });
    return () => el?.removeEventListener("scroll", on);
  }, [scroller]);
  return (
    <header className={cx("sticky top-0 z-40 transition-[background-color,border-color] duration-300", scrolled ? "border-b border-line/70 bg-paper/85 backdrop-blur-md" : "border-b border-transparent")}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Logo />
        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {[
            ["how", "How it works"],
            ["showcase", "Showcase"],
            ["features", "Features"],
            ["faq", "FAQ"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => scrollToId(id)} className="rounded-full px-3.5 py-2 text-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink">
              {label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          {user ? (
            <Button size="sm" iconRight={ArrowRight} onClick={() => onStart()}>
              Open Pipsqueak
            </Button>
          ) : (
            <>
              <Link to="/signin" className="hidden rounded-full px-3.5 py-2 text-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink sm:inline-block">
                Sign in
              </Link>
              <Button size="sm" onClick={() => onStart()}>
                Start designing
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const WORDS = ["Design", "anything", "with", "a", "sentence"];

function Hero({ onStart }) {
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState("mobile");
  const [focused, setFocused] = useState(false);
  return (
    <section className="relative px-5 pb-10 pt-14 text-center sm:px-8 sm:pt-24">
      <Aura className="inset-x-0 -top-10 h-[680px]" strong={focused} />
      <div className="relative mx-auto max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 py-1.5 pl-1.5 pr-3.5 text-[13px] text-ink-2 backdrop-blur">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink">
            <PipGlyph size={12} />
          </span>
          Eighteen art directions. One design engine.
        </motion.div>
        <h1 className="display mx-auto mt-8 max-w-[14ch] text-[54px] leading-[0.98] sm:text-[88px] lg:text-[104px]" aria-label="Design anything with a sentence.">
          {WORDS.map((w, i) => (
            <motion.span
              key={w}
              aria-hidden="true"
              initial={{ opacity: 0, y: 28, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, delay: 0.08 + i * 0.07, ease: EASE }}
              className={cx("mr-[0.22em] inline-block last:mr-0", i === WORDS.length - 1 && "pip-dot")}
            >
              {w}
            </motion.span>
          ))}
        </h1>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.45, ease: EASE }} className="mx-auto mt-7 max-w-xl text-[17px] leading-relaxed text-ink-2 sm:text-[19px]">
          Pipsqueak works out what you're making, offers three distinct art directions, and designs every screen on a live canvas. Then it hands you the code.
        </motion.p>
        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.55, ease: EASE }}
          onSubmit={(e) => {
            e.preventDefault();
            onStart(prompt.trim(), platform);
          }}
          className={cx(
            "mx-auto mt-10 max-w-2xl rounded-[28px] border bg-surface p-2 text-left shadow-lift transition-[border-color,box-shadow] duration-300",
            focused ? "border-ink/40 shadow-[0_0_0_5px_rgba(255,77,26,.1),0_28px_64px_-24px_rgba(23,21,15,.32)]" : "border-line",
          )}
        >
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label="Describe what you want to design"
            placeholder="Describe what you want to design…"
            className="h-14 w-full bg-transparent px-4 text-[17px] outline-none placeholder:text-faint"
          />
          <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
            <Segmented
              id="hero-platform"
              value={platform}
              onChange={setPlatform}
              options={[
                { value: "mobile", label: <span className="hidden sm:inline">Mobile app</span>, icon: <Smartphone size={14} />, aria: "Mobile app" },
                { value: "web", label: <span className="hidden sm:inline">Web app</span>, icon: <Monitor size={14} />, aria: "Web app" },
                { value: "website", label: <span className="hidden sm:inline">Website</span>, icon: <Globe size={14} />, aria: "Website" },
              ]}
            />
            <motion.button whileTap={{ scale: 0.95 }} type="submit" className="flex h-11 items-center gap-2 rounded-full bg-accent pl-5 pr-2 text-[15px] font-medium text-white shadow-[0_10px_24px_-10px_rgba(255,77,26,.8)] transition-colors hover:bg-[#F2420F]">
              <span className="hidden sm:inline">Start designing</span>
              <span className="sm:hidden">Start</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                <ArrowUp size={15} strokeWidth={2.4} />
              </span>
            </motion.button>
          </div>
        </motion.form>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.8 }} className="nosb -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
          {IDEAS.map((idea) => (
            <button key={idea} onClick={() => setPrompt(idea)} className="shrink-0 whitespace-nowrap rounded-full border border-line bg-surface/60 px-3.5 py-1.5 text-[13px] text-ink-2 backdrop-blur transition-colors hover:border-line-strong hover:bg-surface hover:text-ink">
              {idea}
            </button>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// A drifting, tilted plane of real screens: the canvas, seen from afar.
function Wall({ items, scroller }) {
  const ref = usePausedOffscreen();
  const { scrollYProgress } = useScroll({ target: ref, container: scroller, offset: ["start end", "end start"] });
  const tilt = useTransform(scrollYProgress, [0, 0.5], [24, 4]);
  const shots = useMemo(() => {
    const all = [];
    for (const item of items) item.screens.forEach((s, n) => all.push({ item, s, n }));
    // Interleave so neighbouring screens come from different designs.
    return all.sort((a, b) => a.n - b.n);
  }, [items]);
  if (!shots.length) return <div className="h-[420px]" />;
  const rows = [shots.filter((_, i) => i % 2 === 0), shots.filter((_, i) => i % 2 === 1)];
  return (
    <div ref={ref} className="relative overflow-hidden pb-6 pt-6 [perspective:1600px]" aria-hidden="true">
      <motion.div style={{ rotateX: tilt }} className="mask-fade-x origin-top space-y-5">
        {rows.map((row, r) => (
          <div key={r} className={cx("flex w-max gap-5", r === 0 ? "animate-marquee" : "animate-marquee-reverse")} style={{ animationDuration: `${110 + r * 25}s` }}>
            {[...row, ...row].map(({ item, s }, i) => {
              const mobile = item.platform === "mobile";
              return (
                <figure key={i} className={cx("shrink-0 overflow-hidden bg-white shadow-[0_24px_50px_-24px_rgba(23,21,15,.45)] ring-1 ring-black/5", mobile ? "h-[340px] w-[166px] rounded-[22px]" : "h-[340px] w-[544px] rounded-xl")}>
                  <img src={thumb(item, s)} alt="" loading={i < 8 ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover object-top" />
                </figure>
              );
            })}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function StepCard({ n, title, body, active, onSelect }) {
  return (
    <button
      onMouseEnter={onSelect}
      onFocus={onSelect}
      onClick={onSelect}
      aria-pressed={active}
      className={cx("w-full rounded-3xl border p-6 text-left transition-[background-color,border-color,box-shadow] duration-500", active ? "border-line bg-surface shadow-lift" : "border-transparent hover:bg-surface/60")}
    >
      <div className="flex items-center gap-3">
        <span className={cx("flex h-7 w-7 items-center justify-center rounded-full font-mono text-[11px] transition-colors duration-500", active ? "bg-accent text-white" : "bg-sunken text-mute")}>{n}</span>
        <h3 className="display text-[24px]">{title}</h3>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-mute">{body}</p>
    </button>
  );
}

function BriefVisual({ item }) {
  const b = item.brief || {};
  return (
    <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 text-left shadow-pop">
      <div className="eyebrow flex items-center gap-2">
        {item.platform === "mobile" ? <Smartphone size={13} /> : <Monitor size={13} />} {PLATFORM_LABEL[item.platform]}
      </div>
      <div className="display mt-3 text-[34px] leading-none">{item.name}</div>
      <p className="mt-1.5 text-[15px] text-ink-2">{item.tagline}</p>
      {b.audience && <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-mute">For {b.audience.replace(/^\w/, (c) => c.toLowerCase())}</p>}
      <div className="eyebrow mt-6">Screens</div>
      <ul className="mt-2.5 grid gap-1.5">
        {item.screens.slice(0, 4).map((s, i) => (
          <motion.li key={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.1, ease: EASE, duration: 0.5 }} className="flex items-center gap-2.5 rounded-2xl border border-line px-3.5 py-2.5 text-sm">
            <Check size={13} className="text-success" strokeWidth={3} />
            <span className="truncate font-medium">{s.name}</span>
            {s.patternName && <span className="ml-auto shrink-0 rounded-full bg-sunken px-2 py-0.5 text-[11px] text-mute">{s.patternName}</span>}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function DirectionsVisual({ item }) {
  const dirs = (item.directions || []).slice(0, 3);
  return (
    <div className="grid w-full max-w-xl grid-cols-3 gap-3">
      {dirs.map((d, i) => (
        <motion.div
          key={d.name}
          initial={{ opacity: 0, y: 24, rotate: (i - 1) * 4 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.8, delay: i * 0.12, ease: EASE }}
          className={cx("flex min-w-0 flex-col rounded-3xl border bg-surface p-3 text-left shadow-lift sm:p-3.5", d.chosen ? "border-accent ring-4 ring-accent/15" : "border-line")}
        >
          <div className="eyebrow truncate text-[10px]">{d.skillName}</div>
          <div className="mt-1 truncate text-sm font-semibold">{d.name}</div>
          <div className="mt-2.5 flex -space-x-1">
            {["bg", "primary", "accent", "ink"].map((k) => (
              <span key={k} className="h-5 w-5 rounded-full border-2 border-surface" style={{ background: d.colors[k] }} />
            ))}
          </div>
          <div className="mt-3 flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl ring-1 ring-black/5" style={{ background: d.colors.bg, color: d.colors.ink }}>
            {d.chosen ? (
              <img src={thumb(item, item.screens[0])} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
            ) : (
              <span className="text-[38px] leading-none" style={{ fontFamily: `"${d.fonts.display}", ui-serif` }}>
                Aa<span style={{ color: d.colors.primary }}>.</span>
              </span>
            )}
          </div>
          {d.chosen && <div className="mt-2 text-center text-[11px] font-medium text-accent-deep">Chosen</div>}
        </motion.div>
      ))}
    </div>
  );
}

function CanvasVisual({ item }) {
  const mobile = item.platform === "mobile";
  const shots = item.screens.slice(0, mobile ? 4 : 2);
  return (
    <div className="dots relative w-full max-w-xl overflow-hidden rounded-3xl border border-line p-5 shadow-pop sm:p-6">
      <div className="flex items-start gap-3">
        {shots.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: i * 0.12, ease: EASE }} className={cx("relative min-w-0", mobile ? "w-1/4" : "w-1/2")}>
            <div className={cx("mb-1.5 truncate text-[10px] font-medium", i === 1 ? "text-accent-deep" : "text-mute")}>{s.name}</div>
            <div className={cx("overflow-hidden bg-white shadow-[0_16px_30px_-14px_rgba(0,0,0,.35)]", mobile ? "rounded-[14px]" : "rounded-md", i === 1 && "ring-2 ring-accent ring-offset-2 ring-offset-canvas")}>
              <img src={thumb(item, s)} alt="" loading="lazy" className={cx("w-full object-cover object-top", mobile ? "aspect-[390/797]" : "aspect-[1440/1100]")} />
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.6, ease: EASE }} className="mx-auto mt-5 flex max-w-sm items-center gap-2 rounded-full border border-line bg-surface p-1.5 pl-3.5 text-[13px] shadow-lift">
        <PipGlyph size={13} />
        <span className="flex-1 truncate text-ink-2">Make this screen calmer and add a search</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white">
          <ArrowUp size={13} />
        </span>
      </motion.div>
    </div>
  );
}

function HowItWorks({ items }) {
  const [step, setStep] = useState(0);
  const item = items.find((x) => x.platform === "mobile" && x.directions?.length === 3) || items[0];
  if (!item) return null;
  const steps = [
    ["It understands", "Who it's for, what the main screen is built around, and a map of screens where each gets its own composition, before a single pixel."],
    ["You pick a direction", "Three complete design systems, each with its own type, color strategy and point of view, previewed side by side on your own screen."],
    ["It designs every screen", "The rest of the product is built on a live canvas in that system. Select anything and ask Pip to change it."],
  ];
  return (
    <section id="how" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-28 sm:px-8">
      <Reveal className="max-w-2xl">
        <p className="eyebrow">How it works</p>
        <h2 className="display mt-4 text-[44px] leading-[1.02] sm:text-[60px]">From a sentence to a system</h2>
      </Reveal>
      <div className="mt-14 grid items-center gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-10">
        <div className="grid gap-2">
          {steps.map(([title, body], i) => (
            <StepCard key={title} n={i + 1} title={title} body={body} active={step === i} onSelect={() => setStep(i)} />
          ))}
        </div>
        <div className="relative flex min-h-[540px] items-center justify-center overflow-hidden rounded-[36px] border border-line bg-wash p-5 sm:p-10">
          <Aura className="inset-0 opacity-60" />
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.99 }} transition={{ duration: 0.5, ease: EASE }} className="relative flex w-full justify-center">
              {step === 0 ? <BriefVisual item={item} /> : step === 1 ? <DirectionsVisual item={item} /> : <CanvasVisual item={item} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

const FILTERS = [
  ["all", "All"],
  ["mobile", "Mobile apps"],
  ["web", "Web apps"],
  ["website", "Websites"],
];

function Showcase({ items, onOpen }) {
  const [filter, setFilter] = useState("all");
  const shown = items.filter((i) => filter === "all" || i.platform === filter);
  return (
    <section id="showcase" className="scroll-mt-20 border-y border-line bg-surface/50 py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">Showcase</p>
            <h2 className="display mt-4 text-[44px] leading-[1.02] sm:text-[60px]">Each one began as a sentence</h2>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-mute">First drafts, designed by Pip without any manual editing. Open one to walk through every screen.</p>
          </Reveal>
          <Segmented id="showcase-filter" value={filter} onChange={setFilter} options={FILTERS.map(([value, label]) => ({ value, label }))} className="hidden md:inline-flex" />
        </div>
        <div className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {shown.map((item, i) => (
              <motion.div key={item.slug} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.4, ease: EASE }}>
                <ShowcaseCard item={item} index={i} onOpen={onOpen} />
                <p className="mt-2 line-clamp-2 px-1 text-[13px] leading-relaxed text-faint">“{item.prompt}”</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function DirectionTile({ skill }) {
  const [bg, ink, accent] = specimen(skill.id);
  const t = skill.defaults.type;
  return (
    <div className="flex h-[150px] w-[220px] shrink-0 flex-col justify-between rounded-3xl p-5 ring-1 ring-black/5" style={{ background: bg, color: ink }}>
      <div className="flex items-start justify-between">
        <span className="text-[42px] leading-none" style={{ fontFamily: `"${skill.defaults.fonts.display}"`, fontWeight: t.displayWeight, letterSpacing: t.displayTracking, textTransform: t.displayCase === "upper" ? "uppercase" : "none" }}>
          Aa
        </span>
        <span className="h-5 w-5" style={{ background: accent, borderRadius: skill.defaults.radius.md > 10 ? 999 : skill.defaults.radius.md }} />
      </div>
      <div>
        <div className="text-sm font-semibold">{skill.name}</div>
        <div className="mt-0.5 truncate text-xs opacity-70">{skill.tagline}</div>
      </div>
    </div>
  );
}

function Directions() {
  const rows = [SKILLS.slice(0, 9), SKILLS.slice(9)];
  const marquee = usePausedOffscreen();
  return (
    <section className="overflow-hidden py-28">
      {SPECIMEN_FONTS && <link rel="stylesheet" href={SPECIMEN_FONTS} />}
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <p className="eyebrow">Art directions</p>
            <h2 className="display mt-4 text-[44px] leading-[1.02] sm:text-[60px]">Eighteen points of view</h2>
          </div>
          <p className="max-w-lg text-[17px] leading-relaxed text-mute lg:justify-self-end">
            Editorial, Swiss Grid, Quiet Luxury, Raw Brutalism, Risograph and more. Each comes with real rules for type, color, layout and imagery, and a list of clichés it refuses. Not a palette swap.
          </p>
        </Reveal>
      </div>
      <div ref={marquee} className="mask-fade-x mt-14 space-y-4" aria-hidden="true">
        {rows.map((row, r) => (
          <div key={r} className={cx("flex w-max gap-4 hover:[animation-play-state:paused]", r ? "animate-marquee-reverse" : "animate-marquee")} style={{ animationDuration: "70s" }}>
            {[...row, ...row].map((s, i) => (
              <DirectionTile key={s.id + i} skill={s} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function Selecting() {
  return (
    <div className="relative mx-auto h-[150px] w-[200px] rounded-[18px] border border-line bg-paper p-3">
      <div className="h-2.5 w-16 rounded-full bg-line" />
      <div className="mt-3 rounded-lg bg-ink px-2 py-2.5 font-display text-[15px] leading-tight text-white">Borrow tools, return chai</div>
      <div className="mt-2 h-2 w-full rounded-full bg-line" />
      <div className="mt-1.5 h-2 w-3/4 rounded-full bg-line" />
      <motion.div animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.2, 0.8, 1] }} className="absolute inset-x-[10px] top-[32px] h-[46px] rounded-[10px] border-2 border-accent" />
      <motion.div animate={{ x: [40, 0, 0, 40], y: [70, 14, 14, 70] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }} className="absolute left-24 top-8 text-ink">
        <MousePointer2 size={18} fill="#fff" />
      </motion.div>
    </div>
  );
}

const SYSTEMS = [
  ["#F7F1E8", "#2A231B", "#C8380C"],
  ["#0F1715", "#E5EDE9", "#6EE7B7"],
  ["#F3F3FF", "#16163A", "#5B4CF0"],
];

function Systems() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % SYSTEMS.length), 2200);
    return () => clearInterval(t);
  }, []);
  const [bg, ink, accent] = SYSTEMS[i];
  return (
    <motion.div animate={{ backgroundColor: bg, color: ink }} transition={{ duration: 0.8 }} className="mx-auto flex h-[150px] w-[200px] flex-col justify-between rounded-[18px] p-4 ring-1 ring-black/5">
      <div className="font-display text-[28px] leading-none">Aa</div>
      <div className="flex items-center gap-2">
        <motion.span animate={{ backgroundColor: accent }} transition={{ duration: 0.8 }} className="h-7 flex-1 rounded-full" />
        <motion.span animate={{ borderColor: ink }} transition={{ duration: 0.8 }} className="h-7 w-7 rounded-full border-2" />
      </div>
    </motion.div>
  );
}

function Copilot() {
  return (
    <div className="mx-auto grid w-[220px] gap-2 text-left text-[12px]">
      <motion.div initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="justify-self-end rounded-2xl rounded-br-md bg-ink px-3 py-2 text-white">
        Add a notifications screen
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.5 }} className="rounded-2xl rounded-bl-md bg-sunken px-3 py-2">
        <div className="flex items-center gap-1.5 font-medium">
          <PipGlyph size={11} /> On it.
        </div>
        {["Added Alerts", "Linked it from Home"].map((t, n) => (
          <motion.div key={t} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.9 + n * 0.4 }} className="mt-1 flex items-center gap-1.5 text-mute">
            <Check size={11} className="text-success" strokeWidth={3} /> {t}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function Review() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} className="mx-auto flex w-[220px] items-center gap-4">
      <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="38" cy="38" r="32" fill="none" stroke="#E4E0D6" strokeWidth="7" />
        <motion.circle cx="38" cy="38" r="32" fill="none" stroke="#FF4D1A" strokeWidth="7" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: inView ? 0.84 : 0 }} transition={{ duration: 1.6, ease: EASE }} />
      </svg>
      <div className="text-left text-[12px] leading-relaxed text-mute">
        <div className="display text-[26px] leading-none text-ink">84</div>
        Contrast, tap targets, hierarchy and copy, checked.
      </div>
    </div>
  );
}

function Prototype() {
  return (
    <div className="relative mx-auto h-[150px] w-[92px] rounded-[18px] border-[3px] border-ink bg-paper p-2">
      <div className="h-2 w-10 rounded-full bg-line" />
      <div className="mt-2 h-12 rounded-lg bg-accent-soft" />
      <div className="relative mt-2 h-6 rounded-full bg-ink">
        <motion.span animate={{ scale: [0, 2.4], opacity: [0.6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }} className="absolute left-[calc(50%-8px)] top-[calc(50%-8px)] h-4 w-4 rounded-full bg-white" />
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-line" />
    </div>
  );
}

function CodeLines() {
  const lines = ['<header className="flex …">', '  <h1 className="font-display', '    text-[44px] text-ink">', "  <button onClick={() =>", '    go("schedule")}>'];
  return (
    <div className="mx-auto w-[220px] rounded-2xl bg-night p-3.5 text-left font-mono text-[10.5px] leading-[1.7] text-white/80">
      {lines.map((l, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.18 }} className="truncate">
          <span className="mr-2 text-white/25">{i + 1}</span>
          {l}
        </motion.div>
      ))}
    </div>
  );
}

const FEATURES = [
  ["Select anything", "Click any element on any screen and say what should change. Only that element is rewritten.", Selecting],
  ["A living design system", "Change a color or a typeface and every screen follows. Contrast is checked and repaired as you go.", Systems],
  ["Pip, your copilot", "Ask for changes across the app. Pip plans them, restyles, adds screens and links them up.", Copilot],
  ["An honest review", "Rendered checks on every screen plus a critique of craft, hierarchy and copy, each with a fix.", Review],
  ["Tap-through prototype", "Screens link up into a prototype. Tap something unlinked and Pip offers to design what it opens.", Prototype],
  ["Code you can ship", "A React and Tailwind project with every screen as a component and navigation that works.", CodeLines],
];

function Features() {
  const spot = useSpotlight();
  return (
    <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-28 sm:px-8">
      <Reveal className="max-w-2xl">
        <p className="eyebrow">The studio</p>
        <h2 className="display mt-4 text-[44px] leading-[1.02] sm:text-[60px]">A canvas that listens</h2>
      </Reveal>
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([title, body, Visual], i) => (
          <Reveal key={title} delay={(i % 3) * 0.08} className="h-full">
            <article
              {...spot}
              className="relative h-full overflow-hidden rounded-[28px] border border-line bg-surface p-7 shadow-soft transition-shadow duration-500 hover:shadow-lift"
              style={{ backgroundImage: "radial-gradient(420px circle at var(--x, -200px) var(--y, -200px), rgba(255,77,26,.07), transparent 60%)" }}
            >
              <div className="flex h-[176px] items-center justify-center rounded-3xl bg-wash">
                <Visual />
              </div>
              <h3 className="mt-6 text-[17px] font-semibold">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-mute">{body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CodeBand({ sample }) {
  const files = ["package.json", "vite.config.js", "index.css", "App.jsx", sample?.file || "Home.jsx", "DESIGN.md"];
  return (
    <section className="relative overflow-hidden bg-night py-28 text-white">
      <Aura className="inset-x-0 top-0 h-full opacity-30" />
      <div className="relative mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <p className="eyebrow text-white/45">Export</p>
          <h2 className="display mt-4 text-[44px] leading-[1.02] sm:text-[60px]">Real code, not a picture of it</h2>
          <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/65">Download a React project that runs with two commands. The design system ships as Tailwind tokens, so changing one variable restyles the whole app.</p>
          <ul className="mt-8 grid gap-3 text-[15px] text-white/80">
            {["React and Tailwind CSS v4, every screen a component", "Working navigation between screens", "A clickable HTML prototype to share", "DESIGN.md for designers and coding agents"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Check size={11} strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#171612] shadow-[0_40px_100px_-30px_rgba(0,0,0,.8)]">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
                <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />
              ))}
              <span className="ml-3 truncate font-mono text-[11px] text-white/45">src/screens/{sample?.file || "Home.jsx"}</span>
            </div>
            <div className="grid sm:grid-cols-[150px_minmax(0,1fr)]">
              <ul className="hidden border-r border-white/10 py-3 font-mono text-[11px] text-white/45 sm:block">
                {files.map((f) => (
                  <li key={f} className={cx("truncate px-4 py-1", f === sample?.file && "bg-white/5 text-white")}>
                    {f}
                  </li>
                ))}
              </ul>
              <pre className="sb max-h-[380px] overflow-auto p-5 font-mono text-[12px] leading-[1.75] text-white/80">
                <code>{sample?.code || ""}</code>
              </pre>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const FAQS = [
  ["What can I design?", "Mobile apps, web apps and websites. Describe the product in a sentence, attach a sketch or screenshot if you have one, and choose one of three directions."],
  ["Is the code really usable?", "Yes. Exports are a React and Tailwind CSS v4 project with each screen as a component, working navigation and the design system as tokens. It builds and runs as-is."],
  ["Can I edit the design myself?", "Everything is editable. Select any element to change its text, type, color and spacing by hand, or ask Pip. Every change is saved as a version you can compare and restore."],
  ["Will it learn my brand?", "Add a brand voice in Settings, with tone, audience, locale and style notes, and Pip applies it to every brief, design system and review."],
  ["Where are my designs saved?", "In your Pipsqueak account, as you work. Sign in on any device and they're there. You can export everything as a file at any time."],
  ["How much can I make?", "Every account gets 150 credits a day, enough for several complete designs with their imagery. Failed requests are free."],
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="mx-auto grid max-w-7xl scroll-mt-20 gap-12 px-5 py-28 sm:px-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <Reveal>
        <p className="eyebrow">Questions</p>
        <h2 className="display mt-4 text-[44px] leading-[1.02] sm:text-[60px]">Good questions</h2>
      </Reveal>
      <div className="border-t border-line">
        {FAQS.map(([q, a], i) => (
          <div key={q} className="border-b border-line">
            <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-6 py-6 text-left">
              <span className="text-[17px] font-medium">{q}</span>
              <motion.span animate={{ rotate: open === i ? 45 : 0 }} transition={{ duration: 0.3, ease: EASE }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line">
                <Plus size={15} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} className="overflow-hidden">
                  <p className="max-w-2xl pb-6 text-[15px] leading-relaxed text-mute">{a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta({ onStart }) {
  return (
    <section className="px-5 pb-10 sm:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[40px] border border-line bg-surface px-6 py-24 text-center shadow-soft sm:py-32">
        <Aura className="inset-0" strong />
        <Reveal className="relative">
          <Mark size={44} className="mx-auto" />
          <h2 className="display pip-dot mx-auto mt-8 max-w-3xl text-[44px] leading-[1.02] sm:text-[72px]">Your next product starts with a sentence</h2>
          <p className="mx-auto mt-6 max-w-md text-[17px] leading-relaxed text-mute">Free to start. Your first design takes about two minutes.</p>
          <Button size="lg" iconRight={ArrowRight} onClick={() => onStart()} className="mt-10">
            Start designing
          </Button>
        </Reveal>
      </div>
    </section>
  );
}

function Footer({ user }) {
  return (
    <footer className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <div>
        <Logo />
        <p className="mt-3 text-sm text-mute">Design anything with a sentence.</p>
      </div>
      <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-mute">
        {[
          ["how", "How it works"],
          ["showcase", "Showcase"],
          ["faq", "FAQ"],
        ].map(([id, label]) => (
          <button key={id} onClick={() => scrollToId(id)} className="transition-colors hover:text-ink">
            {label}
          </button>
        ))}
        <Link to={user ? "/app" : "/signin"} className="transition-colors hover:text-ink">
          {user ? "Your designs" : "Sign in"}
        </Link>
        <span className="text-faint">© {new Date().getFullYear()} Pipsqueak</span>
      </nav>
    </footer>
  );
}

export function Landing() {
  const { user } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const scroller = useRef(null);
  const items = useShowcase() || [];
  const [viewing, setViewing] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice ?? null);

  const start = (prompt, platform) => {
    const q = new URLSearchParams();
    if (prompt) q.set("prompt", prompt);
    if (platform) q.set("platform", platform);
    const target = "/app" + (q.toString() ? `?${q}` : "");
    navigate(user ? target : `/signup?next=${encodeURIComponent(target)}`);
  };
  const sample = items.find((i) => i.code)?.code;

  return (
    <div ref={scroller} data-scroll="landing" className="sb relative h-full overflow-y-auto overflow-x-hidden bg-paper">
      <AnimatePresence>
        {notice && (
          <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }} className="fixed inset-x-0 top-3 z-50 mx-auto flex w-fit items-center gap-3 rounded-full bg-ink py-2 pl-4 pr-2 text-sm text-white shadow-pop" role="status">
            {notice}
            <button onClick={() => setNotice(null)} aria-label="Dismiss" className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <Nav user={user} onStart={start} scroller={scroller} />
      <main className="relative">
        <Hero onStart={start} />
        <Wall items={items} scroller={scroller} />
        <HowItWorks items={items} />
        {items.length > 0 && <Showcase items={items} onOpen={setViewing} />}
        <Directions />
        <Features />
        <CodeBand sample={sample} />
        <Faq />
        <FinalCta onStart={start} />
      </main>
      <Footer user={user} />
      <AnimatePresence>
        {viewing && (
          <ShowcaseViewer key="viewer" item={viewing} onClose={() => setViewing(null)} onRemix={() => start(viewing.prompt, viewing.platform)} remixLabel={user ? "Design something like this" : "Start designing"} />
        )}
      </AnimatePresence>
    </div>
  );
}
