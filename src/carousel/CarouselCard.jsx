// A carousel on the dashboard: its first slides fanned out, like a deck.
import { forwardRef, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Ellipsis, GalleryHorizontal, PenLine, Star, Trash2 } from "lucide-react";
import { useStore } from "../store";
import { EASE, Menu, cx } from "../ui";
import { ago } from "../util";
import { ScaledSlide, stepNumbers } from "./Slide";
import { FORMATS, safePalette } from "./styles";
import { activeVariant, summaryOf } from "./model";

export const CarouselCard = forwardRef(function CarouselCard({ p, index }, ref) {
  const { api } = useStore();
  const [renaming, setRenaming] = useState(false);
  const c = p.carousel || {};
  const v = activeVariant(p);
  const slides = v?.slides || [];
  const pal = safePalette(v?.direction?.palette, v?.direction?.style);
  const steps = stepNumbers(slides);
  const w = 118;
  const h = w * ((FORMATS[c.format] || FORMATS["4:5"]).h / 1080);
  return (
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.04, ease: EASE }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-soft transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <button onClick={() => api.open(p.id)} aria-label={`Open ${p.name}`} className="relative block h-[200px] overflow-hidden" style={{ background: `linear-gradient(160deg, ${pal.bg}, ${pal.surface})` }}>
        <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
          <GalleryHorizontal size={12} /> Carousel
        </span>
        {slides.length ? (
          <span className="absolute inset-x-0 top-6 flex justify-center">
            {slides.slice(0, 3).map((s, i) => (
              <span
                key={s.id}
                className="overflow-hidden rounded-lg shadow-lift ring-1 ring-black/10 transition-transform duration-500 ease-out"
                style={{ marginLeft: i ? -34 : 0, transform: `rotate(${(i - 1) * 6}deg) translateY(${Math.abs(i - 1) * 8}px)`, zIndex: 3 - i }}
              >
                <ScaledSlide width={w} slide={s} index={i} total={slides.length} direction={v.direction} brand={c.brand} format={c.format} goal={c.plan?.goal} stepNo={steps[i]} />
              </span>
            ))}
          </span>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="animate-pulse rounded-lg bg-black/10" style={{ width: w, height: h }} />
          </span>
        )}
      </button>
      <div className="flex items-center gap-3 border-t border-line-soft px-4 py-3.5">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              autoFocus
              defaultValue={p.name}
              aria-label="Carousel name"
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
            {summaryOf(p)} · {ago(p.created)}
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
