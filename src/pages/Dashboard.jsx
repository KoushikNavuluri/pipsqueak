import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Copy, Ellipsis, Globe, ImagePlus, Monitor, PenLine, Search, Smartphone, Star, Trash2, Wand, X } from "lucide-react";
import { useStore } from "../store";
import { displayName, useSession } from "../session";
import { Aura, Logo, PipGlyph } from "../brand";
import { Button, EASE, IconButton, Menu, Segmented, cx, fireBurst } from "../ui";
import { PLATFORM_LABEL, ago } from "../util";
import { useCredits } from "../credits";
import { toAttachment } from "../ai/images";
import { BriefPanel, briefOf } from "../ai/BriefPanel";
import { CanvasThumbs, DirectionPicker } from "../studio/DirectionGallery";
import { skillById } from "../design/skills.js";
import { ShowcaseCard, ShowcaseViewer, remixShowcase, useShowcase } from "../showcase";
import { UserMenu } from "./UserMenu";

const IDEAS = [
  "A zine-style app for an independent music festival in Goa",
  "A booking site for a ceramics studio in Kyoto",
  "A shared money app for couples planning rent and savings",
  "A control room for a cold-chain logistics fleet",
  "A field guide to birds for weekend walkers",
  "A portfolio for a small architecture studio in Lisbon",
];

const PLATFORMS = [
  { value: "mobile", label: "Mobile app", icon: <Smartphone size={14} /> },
  { value: "web", label: "Web app", icon: <Monitor size={14} /> },
  { value: "website", label: "Website", icon: <Globe size={14} /> },
];

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

// Types ideas into the box's placeholder while it's empty. It writes the
// placeholder directly, so the composer doesn't re-render on every keystroke.
function useTypewriter(ref, list, paused) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (paused) {
      el.placeholder = "Describe what you want to design…";
      return;
    }
    let i = 0;
    let n = 0;
    let deleting = false;
    let timer;
    const tick = () => {
      const word = list[i % list.length];
      n += deleting ? -1 : 1;
      el.placeholder = word.slice(0, n) || " ";
      if (!deleting && n === word.length) {
        deleting = true;
        timer = setTimeout(tick, 2200);
      } else if (deleting && n === 0) {
        deleting = false;
        i++;
        timer = setTimeout(tick, 350);
      } else {
        timer = setTimeout(tick, deleting ? 18 : 38);
      }
    };
    timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
  }, [ref, list, paused]);
}

function Composer() {
  const { s, api } = useStore();
  const prefs = s.data.prefs;
  const [params, setParams] = useSearchParams();
  const [prompt, setPrompt] = useState(() => params.get("prompt") || "");
  const [platform, setPlatform] = useState(() => (PLATFORM_LABEL[params.get("platform")] ? params.get("platform") : prefs.designPlatform || "mobile"));
  const [direction, setDirection] = useState("auto");
  const [image, setImage] = useState(null);
  const [refining, setRefining] = useState(null);
  const [focused, setFocused] = useState(false);
  const box = useRef(null);
  const file = useRef(null);
  useTypewriter(box, IDEAS, focused || prompt.length > 0);

  useEffect(() => {
    // Ideas carried over from the landing page fill the box once.
    if (params.has("prompt") || params.has("platform")) setParams({}, { replace: true });
    if (params.get("prompt")) box.current?.focus();
  }, []);

  const attach = async (f) => {
    if (!f) return;
    try {
      setImage(await toAttachment(f));
    } catch (err) {
      api.toast(err.message, { tone: "error" });
    }
  };

  const start = (brief = null) => {
    const text = prompt.trim();
    if (text.length < 3) {
      box.current?.focus();
      api.toast("Describe what you'd like to design first", { tone: "error" });
      return;
    }
    // With the refine panel open, its answers go along even from the main button.
    // The panel stays open underneath, so backing out of the design keeps them.
    api.startGen({ prompt: text, platform, direction: direction === "auto" ? null : direction, image, brief: brief || (refining ? briefOf(refining) : null) });
  };

  const choosePlatform = (v) => {
    setPlatform(v);
    api.pref({ designPlatform: v });
  };

  const imageFrom = (list) => [...(list || [])].find((x) => x.type?.startsWith("image/"));

  return (
    <div className="relative">
      <Aura className={cx("-inset-x-24 -top-28 bottom-[-40px] transition-opacity duration-700", focused ? "opacity-100" : "opacity-70")} strong={focused} />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
        onDragOver={(e) => [...e.dataTransfer.items].some((x) => x.type.startsWith("image/")) && e.preventDefault()}
        onDrop={(e) => {
          const f = imageFrom(e.dataTransfer.files);
          if (f) {
            e.preventDefault();
            attach(f);
          }
        }}
        className={cx(
          "relative rounded-[28px] border bg-surface p-2.5 text-left shadow-lift transition-[border-color,box-shadow] duration-300",
          focused ? "border-ink/40 shadow-[0_0_0_5px_rgba(255,77,26,.10),0_28px_64px_-24px_rgba(23,21,15,.32)]" : "border-line",
        )}
      >
        <textarea
          ref={box}
          aria-label="Describe what you want to design"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPaste={(e) => {
            const f = imageFrom(e.clipboardData.files);
            if (f) {
              e.preventDefault();
              attach(f);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              start();
            }
          }}
          rows={3}
          maxLength={600}
          placeholder="Describe what you want to design…"
          className="block w-full resize-none bg-transparent px-3.5 pb-2 pt-3 text-[17px] leading-relaxed outline-none placeholder:text-faint"
        />
        <AnimatePresence>
          {image && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mx-2 mb-2 flex w-fit items-center gap-2.5 rounded-2xl border border-line bg-wash p-1.5 pr-2">
                <img src={image.preview} alt="" className="h-11 w-11 rounded-xl object-cover" />
                <div className="min-w-0 text-xs">
                  <div className="max-w-[200px] truncate font-medium">{image.name || "Reference image"}</div>
                  <div className="text-mute">Pip will design from this</div>
                </div>
                <IconButton icon={X} label="Remove reference image" size={28} iconSize={14} onClick={() => setImage(null)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex flex-wrap items-center gap-2 px-1.5 pb-0.5">
          <Segmented id="composer-platform" value={platform} onChange={choosePlatform} options={PLATFORMS.map((p) => ({ ...p, label: <span className="hidden sm:inline">{p.label}</span>, aria: p.label }))} />
          <DirectionPicker value={direction} onChange={setDirection} />
          <div className="ml-auto flex items-center gap-1">
            <IconButton icon={ImagePlus} label="Attach a sketch, screenshot or moodboard" onClick={() => file.current?.click()} />
            <input
              ref={file}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              aria-label="Choose a reference image"
              onChange={(e) => {
                attach(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={Wand}
              aria-label="Refine the idea"
              aria-expanded={!!refining}
              className={cx("px-2.5 sm:px-3.5", refining && "bg-sunken")}
              onClick={() => {
                if (prompt.trim().length < 3) {
                  box.current?.focus();
                  api.toast("Describe what you'd like to design first", { tone: "error" });
                } else setRefining(refining === prompt.trim() ? null : prompt.trim());
              }}
            >
              <span className="hidden sm:inline">Refine</span>
            </Button>
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => start()}
              aria-label="Start designing"
              className={cx(
                "flex h-10 items-center gap-2 rounded-full pl-4 pr-3 text-sm font-medium text-white transition-colors duration-300",
                prompt.trim().length >= 3 ? "bg-accent shadow-[0_8px_20px_-8px_rgba(255,77,26,.7)] hover:bg-[#F2420F]" : "bg-ink hover:bg-ink-2",
              )}
            >
              Design
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                <ArrowUp size={14} strokeWidth={2.4} />
              </span>
            </motion.button>
          </div>
        </div>
      </motion.div>
      <AnimatePresence>
        {refining && <BriefPanel key={refining} prompt={refining} quality={prefs.aiQuality} onClose={() => setRefining(null)} onGenerate={(brief) => start(brief)} />}
      </AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35, duration: 0.6 }} className="nosb relative -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
        {IDEAS.slice(0, 4).map((idea) => (
          <button
            key={idea}
            onClick={() => {
              setPrompt(idea);
              box.current?.focus();
            }}
            className="shrink-0 whitespace-nowrap rounded-full border border-line bg-surface/80 px-3.5 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-line-strong hover:bg-surface hover:text-ink"
          >
            {idea}
          </button>
        ))}
      </motion.div>
    </div>
  );
}

const ProjectCard = forwardRef(function ProjectCard({ p, index }, ref) {
  const { api } = useStore();
  const [renaming, setRenaming] = useState(false);
  const skill = skillById(p.system?.skill);
  const mobile = (p.spec?.platform || p.platform) === "mobile";
  return (
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.04, ease: EASE }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-soft transition-[box-shadow,transform] duration-300 [contain-intrinsic-size:auto_276px] [content-visibility:auto] hover:-translate-y-0.5 hover:shadow-lift"
    >
      <button onClick={() => api.open(p.id)} aria-label={`Open ${p.name}`} className="relative block h-[200px] overflow-hidden text-left" style={{ background: p.system?.colors?.bg || "#EEEBE3" }}>
        <span aria-hidden="true" className="absolute inset-0" style={{ background: `radial-gradient(90% 70% at 50% 110%, ${p.system?.colors?.primary || "#FF4D1A"}26, transparent 70%)` }} />
        <span className="absolute inset-x-0 top-5 flex justify-center transition-transform duration-500 ease-out group-hover:-translate-y-1.5">
          <CanvasThumbs project={p} height={mobile ? 250 : 206} limit={mobile ? 2 : 1} />
        </span>
      </button>
      <div className="flex items-center gap-3 border-t border-line-soft px-4 py-3.5">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              autoFocus
              defaultValue={p.name}
              aria-label="Design name"
              onBlur={(e) => {
                const name = e.target.value.trim().slice(0, 40);
                if (name && name !== p.name) api.edit(p.id, (x) => ({ ...x, name }), { silent: true });
                setRenaming(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setRenaming(false);
              }}
              className="w-full rounded-lg border border-ink/60 px-2 py-0.5 text-[15px] font-semibold outline-none"
            />
          ) : (
            <h3 className="truncate text-[15px] font-semibold">{p.name}</h3>
          )}
          <p className="mt-0.5 truncate text-[13px] text-mute">
            {skill.name} · {p.screens.length} screens · {ago(p.created)}
          </p>
        </div>
        <button
          onClick={() => api.fav(p.id)}
          aria-label={p.fav ? "Unstar" : "Star"}
          aria-pressed={!!p.fav}
          className={cx("flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-sunken", p.fav ? "text-accent" : "text-faint opacity-0 focus-visible:opacity-100 group-hover:opacity-100")}
        >
          <Star size={16} fill={p.fav ? "currentColor" : "none"} />
        </button>
        <Menu
          trigger={() => (
            <span role="button" tabIndex={0} aria-label={`More actions for ${p.name}`} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-mute transition-colors hover:bg-sunken hover:text-ink">
              <Ellipsis size={17} />
            </span>
          )}
          items={[
            { label: "Rename", icon: PenLine, onClick: () => setRenaming(true) },
            { label: "Duplicate", icon: Copy, onClick: () => api.dup(p.id) },
            { sep: true },
            { label: "Delete", icon: Trash2, danger: true, onClick: () => api.del(p.id) },
          ]}
        />
      </div>
    </motion.article>
  );
});

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-dashed border-line-strong bg-surface/50 px-6 py-14 text-center">
      <svg width="72" height="72" viewBox="0 0 72 72" className="mx-auto" aria-hidden="true">
        <motion.path d="M36 60 C36 46 36 40 36 34" stroke="#17150F" strokeWidth="2.5" strokeLinecap="round" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: EASE, delay: 0.2 }} />
        <motion.path d="M36 42 C28 40 23 34 22 26 C30 27 35 32 36 42Z" fill="#17150F" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ originX: "36px", originY: "42px" }} transition={{ delay: 0.9, type: "spring", stiffness: 260, damping: 16 }} />
        <motion.path d="M36 38 C44 35 49 29 50 21 C42 22 37 28 36 38Z" fill="#FF4D1A" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ originX: "36px", originY: "38px" }} transition={{ delay: 1.1, type: "spring", stiffness: 260, damping: 16 }} />
        <ellipse cx="36" cy="61" rx="13" ry="2.5" fill="#17150F" opacity=".08" />
      </svg>
      <h3 className="display mt-5 text-2xl">Your first design is one sentence away</h3>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-mute">Describe a product above. Pip works out who it's for, offers three directions and designs every screen. Or remix a showcase design below.</p>
    </div>
  );
}

// Projects from the earlier block-based editor can't be opened on the canvas;
// they can be recreated from their original prompt.
function LegacyProjects({ list, onRecreate }) {
  const { api } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-10 rounded-3xl border border-line bg-surface/60">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <span>
          <span className="text-sm font-semibold">From the previous version · {list.length}</span>
          <span className="mt-0.5 block text-[13px] text-mute">Designs made before the canvas. Recreate any of them with today's engine.</span>
        </span>
        <span className="text-sm font-medium text-mute">{open ? "Hide" : "Show"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-line-soft">
            {list.map((p) => (
              <li key={p.id} className="flex items-center gap-3 border-b border-line-soft px-5 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="truncate text-[13px] text-mute">{p.prompt}</div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => onRecreate(p)}>
                  Recreate
                </Button>
                <IconButton icon={Trash2} label={`Delete ${p.name}`} onClick={() => api.del(p.id)} />
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}

export function Dashboard() {
  const { s, api } = useStore();
  const { user, profile } = useSession();
  const { left } = useCredits(s.gen ? 1 : 0);
  const [query, setQuery] = useState("");
  const [starred, setStarred] = useState(false);
  const [viewing, setViewing] = useState(null);
  const showcase = useShowcase();
  const canvas = s.data.projects.filter((p) => p.kind === "canvas");
  const legacy = s.data.projects.filter((p) => p.kind !== "canvas");
  const first = displayName(user, profile).split(/[\s.@_]/)[0];
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return canvas
      .filter((p) => (!starred || p.fav) && (!q || `${p.name} ${p.prompt} ${p.tagline || ""}`.toLowerCase().includes(q)))
      .sort((a, b) => b.created - a.created);
  }, [canvas, query, starred]);

  const remix = async (item) => {
    try {
      const project = await remixShowcase(item);
      setViewing(null);
      api.add(project);
      api.toast(`${project.name} is yours to edit`, { tone: "success" });
      fireBurst();
    } catch (err) {
      api.toast(err.message, { tone: "error" });
    }
  };

  return (
    <div data-scroll="dashboard" className="sb relative h-full overflow-y-auto overflow-x-hidden">
      <header className="sticky top-0 z-30 border-b border-transparent bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo to="/app" />
          <div className="flex items-center gap-2">
            <Link
              to="/app/settings#usage"
              title="Credits left today"
              className="hidden items-center gap-1.5 rounded-full border border-line bg-surface/70 px-3 py-1.5 font-mono text-[11px] text-mute transition-colors hover:border-line-strong hover:text-ink sm:inline-flex"
            >
              <PipGlyph size={11} /> {left} credits
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-28 sm:px-6">
        <section className="mx-auto max-w-3xl pb-16 pt-12 text-center sm:pt-20">
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="eyebrow">
            {greeting()}, {first}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: EASE }}
            className="display pip-dot mt-4 text-[40px] leading-[1.04] sm:text-[60px]"
          >
            What shall we design today
          </motion.h1>
          <div className="mt-10">
            <Composer />
          </div>
        </section>

        <section aria-labelledby="designs" className="pt-2">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="designs" className="display text-[28px] leading-tight">
                Your designs
              </h2>
              {canvas.length > 0 && <p className="mt-1 text-sm text-mute">{canvas.length === 1 ? "One design" : `${canvas.length} designs`}, saved as you work.</p>}
            </div>
            {canvas.length > 3 && (
              <div className="flex items-center gap-2">
                <label className="relative">
                  <span className="sr-only">Search designs</span>
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search"
                    className="h-9 w-40 rounded-full border border-line bg-surface pl-9 pr-3 text-sm outline-none transition-[border-color,width] focus:w-52 focus:border-ink/60 sm:w-48"
                  />
                </label>
                {canvas.some((p) => p.fav) && (
                  <Segmented
                    id="designs-filter"
                    size="sm"
                    value={starred ? "starred" : "all"}
                    onChange={(v) => setStarred(v === "starred")}
                    options={[
                      { value: "all", label: "All" },
                      { value: "starred", label: "Starred" },
                    ]}
                  />
                )}
              </div>
            )}
          </div>
          {canvas.length === 0 ? (
            <EmptyState />
          ) : shown.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line-strong px-6 py-12 text-center text-sm text-mute">Nothing matches “{query}”.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {shown.map((p, i) => (
                  <ProjectCard key={p.id} p={p} index={i} />
                ))}
              </AnimatePresence>
            </div>
          )}
          {legacy.length > 0 && <LegacyProjects list={legacy} onRecreate={(p) => api.startGen({ prompt: p.prompt, platform: "mobile", direction: null, image: null, brief: null })} />}
        </section>

        {showcase?.length > 0 && (
          <section aria-labelledby="showcase" className="pt-20">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Showcase</p>
                <h2 id="showcase" className="display mt-2 text-[28px] leading-tight">
                  Start from something finished
                </h2>
                <p className="mt-1 max-w-lg text-sm text-mute">Every one was designed by Pip from a single sentence. Remix one to make it yours.</p>
              </div>
            </div>
            <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {showcase.slice(0, canvas.length ? 4 : 8).map((item, i) => (
                <ShowcaseCard key={item.slug} item={item} index={i} compact onOpen={setViewing} onRemix={remix} />
              ))}
            </div>
          </section>
        )}
      </main>
      <AnimatePresence>{viewing && <ShowcaseViewer key="viewer" item={viewing} onClose={() => setViewing(null)} onRemix={remix} />}</AnimatePresence>
    </div>
  );
}
