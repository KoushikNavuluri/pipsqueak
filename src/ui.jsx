import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import { AlertCircle, Check, ChevronDown, Info, X } from "lucide-react";
import { useStore } from "./store";

export const cx = (...c) => c.filter(Boolean).join(" ");
export const EASE = [0.22, 1, 0.36, 1];
export const SPRING = { type: "spring", stiffness: 520, damping: 38, mass: 0.8 };

export function useMedia(query) {
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}

const VARIANTS = {
  primary: "bg-ink text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_1px_2px_rgba(23,21,15,.2)] hover:bg-ink-2",
  accent: "bg-accent text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_6px_18px_-6px_rgba(255,77,26,.6)] hover:bg-[#F2420F]",
  secondary: "border border-line bg-surface text-ink shadow-[0_1px_2px_rgba(23,21,15,.05)] hover:border-line-strong hover:bg-wash",
  ghost: "text-ink hover:bg-sunken",
  danger: "border border-danger-line bg-surface text-danger hover:bg-danger-soft",
  light: "bg-white text-ink hover:bg-white/90",
};
const SIZES = { sm: "h-9 px-3.5 text-[13px] gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-6 text-[15px] gap-2" };

export function Button({ variant = "primary", size = "md", icon: Icon, iconRight: IconRight, children, className, full, ...rest }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className={cx(
        "group/btn inline-flex select-none items-center justify-center whitespace-nowrap rounded-full font-medium transition-[background-color,border-color,box-shadow,color] duration-200 disabled:pointer-events-none disabled:opacity-40",
        SIZES[size],
        VARIANTS[variant],
        full && "w-full",
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={size === "sm" ? 15 : 16} strokeWidth={2} />}
      {children}
      {IconRight && <IconRight size={16} strokeWidth={2} className="transition-transform duration-300 ease-out group-hover/btn:translate-x-0.5" />}
    </motion.button>
  );
}

export function IconButton({ icon: Icon, label, title, active, className, size = 36, iconSize = 17, ...rest }) {
  return (
    <button
      aria-label={label}
      title={title || label}
      style={{ width: size, height: size }}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-35",
        active && "bg-sunken text-ink",
        className,
      )}
      {...rest}
    >
      <Icon size={iconSize} strokeWidth={1.9} />
    </button>
  );
}

// A pill toggle with a sliding thumb.
export function Segmented({ value, onChange, options, id = "seg", className, full, size = "md" }) {
  return (
    <div role="radiogroup" className={cx("inline-flex rounded-full bg-sunken p-1", full && "flex w-full", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={on}
            aria-label={o.aria}
            title={o.aria}
            onClick={() => onChange(o.value)}
            className={cx(
              "relative flex min-w-9 items-center justify-center rounded-full font-medium transition-colors duration-200",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3.5 text-[13px]",
              full && "flex-1",
              on ? "text-ink" : "text-mute hover:text-ink",
            )}
          >
            {on && <motion.span layoutId={id} transition={SPRING} className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_3px_rgba(23,21,15,.12),0_0_0_1px_rgba(23,21,15,.04)]" />}
            <span className="relative flex items-center gap-1.5">
              {o.icon}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ on, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx("relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200", on ? "bg-ink" : "bg-line-strong")}
    >
      <motion.span animate={{ x: on ? 16 : 0 }} transition={SPRING} className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm" />
    </button>
  );
}

export function Kbd({ children, className }) {
  return <kbd className={cx("rounded-md border border-line bg-wash px-1.5 py-0.5 font-mono text-[11px] text-mute", className)}>{children}</kbd>;
}

export function Select({ value, onChange, options, label, className }) {
  return (
    <label className={cx("relative inline-flex items-center", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-line bg-surface pl-3.5 pr-9 text-sm text-ink outline-none transition-colors hover:border-line-strong focus:border-ink"
      >
        {options.map((o) => (
          <option value={o.value} key={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3 text-mute" />
    </label>
  );
}

// A small popover menu. `trigger(open)` renders the button.
// A floating panel anchored to a trigger. It renders into document.body, so
// it is never clipped by overflow or trapped under a stacking context of the
// component that opened it (transforms, filters and backdrop blur all create
// one), and it flips above the trigger when there is no room below.
export function Popover({ anchor, open, onClose, align = "left", className, children, label, role = "dialog" }) {
  const panel = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!open) return setPos(null);
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const el = panel.current;
      if (!a || !el) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const below = vh - a.bottom - 8;
      const up = below < h + 8 && a.top > below;
      let left = align === "right" ? a.right - w : a.left;
      left = Math.max(8, Math.min(left, vw - w - 8));
      const top = up ? Math.max(8, a.top - h - 8) : a.bottom + 8;
      setPos({ left, top, up, maxHeight: up ? a.top - 16 : below - 8 });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, align]);
  useEffect(() => {
    if (!open) return;
    const down = (e) => !panel.current?.contains(e.target) && !anchor.current?.contains(e.target) && onClose();
    const key = (e) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open, onClose, anchor]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panel}
          role={role}
          aria-label={label}
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: pos ? 1 : 0, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.16, ease: EASE }}
          style={{ position: "fixed", left: pos?.left ?? -9999, top: pos?.top ?? 0, maxHeight: pos?.maxHeight, transformOrigin: pos?.up ? "bottom" : "top" }}
          className={cx("z-[100] overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 text-left shadow-lift sb", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// A small popover menu. `trigger(open)` renders the button.
export function Menu({ trigger, items, align = "right", width = "min-w-52" }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <span ref={anchor} className="inline-flex" onClick={() => setOpen((o) => !o)}>
        {trigger(open)}
      </span>
      <Popover anchor={anchor} open={open} onClose={close} align={align} className={width} role="menu">
        {items.map((it, i) =>
          it.sep ? (
            <div className="mx-2 my-1 h-px bg-line-soft" key={i} />
          ) : it.heading ? (
            <div className="px-3 pb-1 pt-2" key={"h" + i}>
              {it.heading}
            </div>
          ) : (
            <button
              role="menuitem"
              key={it.label}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={cx("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-sunken", it.danger ? "text-danger" : "text-ink")}
            >
              {it.icon && <it.icon size={16} strokeWidth={1.9} className={it.danger ? "" : "text-mute"} />}
              <span className="flex-1">{it.label}</span>
              {it.checked && <Check size={15} strokeWidth={2.4} />}
            </button>
          ),
        )}
      </Popover>
    </>
  );
}

export function Dialog({ title, description, onClose, children, size = "md", footer }) {
  const width = size === "lg" ? "sm:max-w-3xl" : size === "sm" ? "sm:max-w-md" : "sm:max-w-xl";
  useEffect(() => {
    const key = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/35 backdrop-blur-[3px] sm:items-center sm:p-6"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 24, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 16, opacity: 0, scale: 0.99 }}
        transition={{ duration: 0.3, ease: EASE }}
        className={cx("flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface shadow-pop sm:rounded-3xl", width)}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <div>
            <h2 className="display text-[22px] leading-tight">{title}</h2>
            {description && <p className="mt-1 text-sm text-mute">{description}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2 -mt-1" />
        </div>
        <div className="sb min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line-soft bg-wash px-6 py-3.5">{footer}</div>}
      </motion.div>
    </motion.div>
  );
}

const TONES = {
  success: [Check, "bg-[#3DDC97] text-ink"],
  error: [AlertCircle, "bg-[#FF7A5C] text-ink"],
  info: [Info, "bg-white/15 text-white"],
};

export function Toasts() {
  const { s, d } = useStore();
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {s.toasts.map((t) => {
          const [Icon, tone] = TONES[t.tone] || TONES.info;
          return (
            <motion.div
              layout
              key={t.id}
              initial={{ y: 18, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 8, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full bg-ink/95 py-2 pl-2.5 pr-4 text-[13px] font-medium text-white shadow-pop backdrop-blur"
            >
              <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", tone)}>
                <Icon size={13} strokeWidth={2.6} />
              </span>
              <span>{t.text}</span>
              {t.action && (
                <button
                  onClick={() => {
                    t.action.run();
                    d({ t: "DISMISS", id: t.id });
                  }}
                  className="-mr-1 rounded-full px-2.5 py-1 font-semibold text-[#FF9C7A] transition-colors hover:bg-white/10"
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// Follows the pointer a little: for the one button that matters most.
export function Magnetic({ children, strength = 0.2, className }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 300, damping: 18 });
  const sy = useSpring(y, { stiffness: 300, damping: 18 });
  return (
    <motion.div
      className={className}
      style={{ x: sx, y: sy, display: "inline-block" }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

// A light that follows the pointer across a card.
export function useSpotlight() {
  return {
    onPointerMove: (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
      e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
    },
  };
}

export function fireBurst(x, y) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pq-burst", { detail: { x: x ?? window.innerWidth / 2, y: y ?? window.innerHeight * 0.4 } }));
  }
}

const BURST = ["#FF4D1A", "#17150F", "#FFB08F", "#C4B2FF", "#FFC59E"];

function Particles({ x, y }) {
  return Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2 + (i % 3) * 0.3;
    const dist = 60 + ((i * 37) % 70);
    return (
      <motion.span
        key={i}
        initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 45 }}
        animate={{ x: Math.cos(angle) * dist, y: [0, Math.sin(angle) * dist, Math.sin(angle) * dist + 40], scale: [0, 1, 0.7], opacity: [1, 1, 0], rotate: 45 + ((i * 53) % 180) }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        style={{ position: "absolute", left: x, top: y, width: 7, height: 10, borderRadius: "50% 50% 50% 0", background: BURST[i % BURST.length] }}
      />
    );
  });
}

// Pips scattering from a point: the celebration when a design is created.
export function BurstLayer() {
  const [bursts, setBursts] = useState([]);
  useEffect(() => {
    const on = (e) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.querySelector(".reduce")) return;
      const id = Math.random();
      setBursts((b) => [...b, { id, ...e.detail }].slice(-3));
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1300);
    };
    window.addEventListener("pq-burst", on);
    return () => window.removeEventListener("pq-burst", on);
  }, []);
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[95] overflow-hidden">
      {bursts.map((b) => (
        <Particles x={b.x} y={b.y} key={b.id} />
      ))}
    </div>
  );
}

