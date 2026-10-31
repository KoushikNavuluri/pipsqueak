import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Shuffle, X } from "lucide-react";
import { Button, EASE, cx } from "./ui";
import { PLATFORM_LABEL, uid } from "./util";

// Showcase designs live in /public/showcase: index.json lists them, each has
// project.json (the full, remixable design) and pre-rendered screen images.
let cache = null;
export function loadShowcase() {
  cache ||= fetch("/showcase/index.json")
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);
  return cache;
}

export function useShowcase() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let live = true;
    loadShowcase().then((list) => live && setItems(list));
    return () => {
      live = false;
    };
  }, []);
  return items;
}

// A copy of a showcase design, ready to add to the user's account.
export async function remixShowcase(item) {
  const res = await fetch(`/showcase/${item.slug}/project.json`);
  if (!res.ok) throw new Error("Couldn't load that design. Try again.");
  const p = await res.json();
  const now = Date.now();
  return {
    ...p,
    id: uid(),
    created: now,
    fav: false,
    chat: [],
    review: null,
    remixOf: item.slug,
    kit: (p.kit || []).map((k) => ({ ...k, url: k.url ? new URL(k.url, location.origin).href : null })),
    screens: p.screens.map((s) => ({ ...s, versions: [], changedAt: now })),
  };
}

const src = (item, screen, kind = "thumb") => `/showcase/${item.slug}/${screen.id}${kind === "thumb" ? ".thumb" : ""}.webp`;

// The card: phones fanned out, or a browser window with a page behind it.
export function ShowcaseCard({ item, onOpen, onRemix, index = 0, compact = false }) {
  const mobile = item.platform === "mobile";
  const shots = item.screens.slice(0, mobile ? 3 : 2);
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: (index % 4) * 0.06, ease: EASE }}
      className="group flex flex-col [contain-intrinsic-size:auto_380px] [content-visibility:auto]"
    >
      <motion.button
        initial="rest"
        whileHover="hover"
        animate="rest"
        onClick={() => onOpen(item)}
        aria-label={`View ${item.name}`}
        className={cx("relative isolate overflow-hidden rounded-[28px] border border-black/5 transition-shadow duration-500 group-hover:shadow-lift", compact ? "h-[230px]" : "h-[300px] sm:h-[340px]")}
        style={{ background: item.colors.bg }}
      >
        <span aria-hidden="true" className="absolute inset-0 opacity-60" style={{ background: `radial-gradient(120% 80% at 50% 120%, ${item.colors.primary}33, transparent 60%)` }} />
        {mobile ? (
          <span className="absolute inset-x-0 bottom-0 top-8 flex items-start justify-center">
            {shots.map((s, i) => {
              const side = i === 0 ? 0 : i === 1 ? -1 : 1;
              return (
                <motion.span
                  key={s.id}
                  variants={{
                    rest: { x: `${side * 58}%`, y: side ? 22 : 0, rotate: side * 5 },
                    hover: { x: `${side * 70}%`, y: side ? 14 : -6, rotate: side * 8 },
                  }}
                  transition={{ type: "spring", stiffness: 200, damping: 22 }}
                  className={cx("absolute top-0 w-[38%] max-w-[170px] overflow-hidden rounded-[18px] bg-white shadow-[0_18px_40px_-14px_rgba(0,0,0,.35)] ring-1 ring-black/5", side === 0 ? "z-10" : "z-0")}
                >
                  <img src={src(item, s)} alt="" loading="lazy" decoding="async" width="390" height="797" className="block aspect-[390/797] w-full object-cover object-top" />
                </motion.span>
              );
            })}
          </span>
        ) : (
          <span className="absolute inset-x-6 top-10 sm:inset-x-10">
            {shots[1] && (
              <span className="absolute inset-x-6 top-0 -translate-y-3 scale-[.94] overflow-hidden rounded-xl opacity-70 ring-1 ring-black/5 transition-transform duration-700 ease-out group-hover:-translate-y-5">
                <img src={src(item, shots[1])} alt="" loading="lazy" decoding="async" width="720" height="550" className="block h-auto w-full" />
              </span>
            )}
            <span className="relative block overflow-hidden rounded-xl bg-white shadow-[0_18px_40px_-14px_rgba(0,0,0,.35)] ring-1 ring-black/5 transition-transform duration-700 ease-out group-hover:-translate-y-1.5">
              <span className="flex h-6 items-center gap-1 border-b border-black/5 bg-[#F4F2EC] px-3">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="h-2 w-2 rounded-full bg-black/15" />
                ))}
              </span>
              <img src={src(item, shots[0])} alt="" loading="lazy" decoding="async" width="720" height="550" className="block h-auto w-full" />
            </span>
          </span>
        )}
      </motion.button>
      <div className="mt-4 flex items-start justify-between gap-4 px-1">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold">{item.name}</h3>
          <p className="mt-0.5 truncate text-[13px] text-mute">
            {item.skillName} · {PLATFORM_LABEL[item.platform]}
          </p>
        </div>
        {onRemix && (
          <Button size="sm" variant="secondary" icon={Shuffle} onClick={() => onRemix(item)} className="shrink-0">
            Remix
          </Button>
        )}
      </div>
    </motion.article>
  );
}

// Browse every screen of a showcase design.
export function ShowcaseViewer({ item, onClose, onRemix, remixLabel = "Remix this design" }) {
  const [i, setI] = useState(0);
  const mobile = item.platform === "mobile";
  const screen = item.screens[i];
  useEffect(() => {
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((n) => Math.min(item.screens.length - 1, n + 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [item, onClose]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[85] flex flex-col bg-night/90 text-white backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
    >
      <div className="flex shrink-0 items-center gap-4 px-5 py-4 sm:px-8">
        <div className="min-w-0 flex-1">
          <div className="display truncate text-2xl">{item.name}</div>
          <p className="mt-0.5 line-clamp-1 text-sm text-white/60">“{item.prompt}”</p>
        </div>
        {onRemix && (
          <Button variant="light" size="sm" iconRight={ArrowRight} onClick={() => onRemix(item)} className="hidden sm:inline-flex">
            {remixLabel}
          </Button>
        )}
        <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20">
          <X size={18} />
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={screen.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: EASE }}
            className={cx("mx-auto overflow-hidden bg-white shadow-pop", mobile ? "w-full max-w-[390px] rounded-[32px]" : "w-full max-w-[1100px] rounded-xl")}
          >
            <img src={src(item, screen, "full")} alt={`${item.name}: ${screen.name}`} className="block w-full" width={screen.w} height={screen.h} />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex shrink-0 items-center justify-center gap-2 border-t border-white/10 px-4 py-3">
        <button onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0} aria-label="Previous screen" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30">
          <ChevronLeft size={18} />
        </button>
        <div className="nosb flex max-w-[70vw] gap-1.5 overflow-x-auto">
          {item.screens.map((s, n) => (
            <button
              key={s.id}
              onClick={() => setI(n)}
              className={cx("shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors", n === i ? "bg-white text-ink" : "text-white/70 hover:bg-white/10 hover:text-white")}
            >
              {s.name}
            </button>
          ))}
        </div>
        <button onClick={() => setI((n) => Math.min(item.screens.length - 1, n + 1))} disabled={i === item.screens.length - 1} aria-label="Next screen" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30">
          <ChevronRight size={18} />
        </button>
      </div>
    </motion.div>
  );
}
