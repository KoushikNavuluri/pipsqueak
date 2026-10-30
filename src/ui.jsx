import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
} from "framer-motion";
import { Check, ChevronDown, X } from "lucide-react";
import { useStore } from "./store";

export const cx = (...e) => e.filter(Boolean).join(" ");

export const SPRING = {
  type: "spring",
  stiffness: 420,
  damping: 38,
};

export const EASE = [0.22, 1, 0.36, 1];

export function useMedia(e) {
  const [t, a] = useState(
    () => typeof window !== "undefined" && window.matchMedia(e).matches,
  );
  useEffect(() => {
    const r = window.matchMedia(e);
    const h = () => a(r.matches);
    h();
    r.addEventListener("change", h);
    return () => r.removeEventListener("change", h);
  }, [e]);
  return t;
}

const BUTTON_VARIANTS = {
  primary: "bg-[#16161A] text-white hover:bg-[#2B2B32] border border-[#16161A]",
  secondary:
    "bg-white text-[#16161A] border border-[#E6E5E0] hover:bg-[#F7F6F3]",
  ghost:
    "bg-transparent text-[#16161A] border border-transparent hover:bg-[#F2F1ED]",
  danger: "bg-white text-[#B42318] border border-[#F3D0CC] hover:bg-[#FEF3F2]",
  accent:
    "bg-[#FF4D1A] text-[#16161A] border border-[#FF4D1A] hover:bg-[#FF6234]",
};

export function Button({
  variant = "primary",
  size = "md",
  icon: Icon2,
  iconRight: IconRight,
  children,
  className,
  full,
  ...l
}) {
  return (
    <motion.button
      whileTap={{
        scale: 0.97,
      }}
      transition={{
        duration: 0.1,
      }}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40",
        size === "sm"
          ? "h-9 px-3"
          : size === "lg"
            ? "h-12 px-6 text-[15px]"
            : "h-10 px-4",
        BUTTON_VARIANTS[variant],
        full && "w-full",
        className,
      )}
      {...l}
    >
      {Icon2 && <Icon2 size={size === "sm" ? 16 : 17} strokeWidth={2.2} />}
      {children}
      {IconRight && <IconRight size={16} strokeWidth={2.2} />}
    </motion.button>
  );
}

export function IconButton({
  icon: Icon2,
  label,
  active,
  className,
  size = 36,
  ...i
}) {
  return (
    <button
      aria-label={label}
      title={label}
      style={{
        width: size,
        height: size,
      }}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-lg text-[#16161A] transition-colors hover:bg-[#F2F1ED] disabled:pointer-events-none disabled:opacity-35",
        active && "bg-[#F2F1ED]",
        className,
      )}
      {...i}
    >
      <Icon2 size={18} strokeWidth={2.1} />
    </button>
  );
}

export function Segmented({
  value,
  onChange,
  options,
  id = "seg",
  className,
  full,
}) {
  return (
    <div
      role="tablist"
      className={cx(
        "inline-flex rounded-lg bg-[#F2F1ED] p-0.5",
        full && "w-full",
        className,
      )}
    >
      {options.map((s) => {
        const l = s.value === value;
        return (
          <button
            role="tab"
            aria-selected={l}
            aria-label={s.aria}
            title={s.aria}
            onClick={() => onChange(s.value)}
            className={cx(
              "relative flex h-8 min-w-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
              full && "flex-1",
              l ? "text-[#16161A]" : "text-[#62626A] hover:text-[#16161A]",
            )}
            key={String(s.value)}
          >
            {l && (
              <motion.span
                layoutId={id}
                transition={SPRING}
                className="absolute inset-0 rounded-md bg-white shadow-[0_1px_2px_rgba(20,20,26,.12)]"
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {s.icon}
              {s.label}
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
      className={cx(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors",
        on ? "bg-[#16161A]" : "bg-[#D9D8D2]",
      )}
    >
      <motion.span
        animate={{
          x: on ? 16 : 0,
        }}
        transition={SPRING}
        className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white"
      />
    </button>
  );
}

export function Field({
  label,
  value,
  onChange,
  multiline,
  placeholder,
  id,
  mono,
}) {
  const l =
    "w-full rounded-lg border border-[#E6E5E0] bg-white px-3 py-2 text-sm text-[#16161A] outline-none transition-shadow placeholder:text-[#8A8A92] focus:border-[#16161A] focus:ring-2 focus:ring-[#FF4D1A]/25 " +
    (mono ? "font-mono" : "");
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#62626A]">
        {label}
      </span>
      {multiline ? (
        <textarea
          rows={3}
          value={value ?? ""}
          onChange={(u) => onChange(u.target.value)}
          placeholder={placeholder}
          id={id}
          className={l + " resize-none"}
        />
      ) : (
        <input
          value={value ?? ""}
          onChange={(u) => onChange(u.target.value)}
          placeholder={placeholder}
          id={id}
          className={l}
        />
      )}
    </label>
  );
}

export function Label({ children, right, tight }) {
  return (
    <div className={cx("flex items-center justify-between", !tight && "mb-2")}>
      <span className="text-xs font-semibold uppercase tracking-wider text-[#62626A]">
        {children}
      </span>
      {right}
    </div>
  );
}

export function Kbd({ children }) {
  return (
    <kbd className="rounded border border-[#E6E5E0] bg-[#F7F6F3] px-1.5 py-0.5 font-mono text-xs text-[#62626A]">
      {children}
    </kbd>
  );
}

export function Select({ value, onChange, options, label, className }) {
  return (
    <label className={cx("relative inline-flex items-center", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(i) => onChange(i.target.value)}
        className="h-9 cursor-pointer appearance-none rounded-lg border border-[#E6E5E0] bg-white pl-3 pr-8 text-sm font-medium text-[#16161A] outline-none hover:bg-[#F7F6F3] focus:border-[#16161A]"
      >
        {options.map((i) => (
          <option value={i.value} key={i.value}>
            {i.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-2.5 text-[#62626A]"
      />
    </label>
  );
}

export function Menu({ trigger, items, align = "right" }) {
  const [r, o] = useState(false);
  const i = useRef(null);
  useEffect(() => {
    if (!r) {
      return;
    }
    const h = (u) => {
      if (!i.current?.contains(u.target)) {
        o(false);
      }
    };
    const k = (u) => {
      if (u.key === "Escape") {
        o(false);
      }
    };
    document.addEventListener("pointerdown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("pointerdown", h);
      document.removeEventListener("keydown", k);
    };
  }, [r]);
  return (
    <div ref={i} className="relative">
      <span onClick={() => o((s) => !s)}>{trigger(r)}</span>
      <AnimatePresence>
        {r && (
          <motion.div
            initial={{
              opacity: 0,
              y: -4,
              scale: 0.98,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: -4,
            }}
            transition={{
              duration: 0.12,
            }}
            role="menu"
            className={cx(
              "absolute top-full z-40 mt-1.5 min-w-48 rounded-xl border border-[#E6E5E0] bg-white p-1 shadow-[0_12px_32px_-8px_rgba(20,20,26,.2)]",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            {items.map((s, l) =>
              s.sep ? (
                <div className="my-1 h-px bg-[#E6E5E0]" key={l} />
              ) : s.heading ? (
                <div
                  className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-[#62626A]"
                  key={"h" + s.heading}
                >
                  {s.heading}
                </div>
              ) : (
                <button
                  role="menuitem"
                  onClick={() => {
                    o(false);
                    s.onClick();
                  }}
                  className={cx(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium hover:bg-[#F2F1ED]",
                    s.danger && "text-[#B42318]",
                  )}
                  key={s.label}
                >
                  {s.icon && <s.icon size={16} strokeWidth={2.1} />}
                  <span className="flex-1">{s.label}</span>
                  {s.checked && <Check size={15} strokeWidth={2.6} />}
                </button>
              ),
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Dialog({ title, onClose, children, size = "md", footer }) {
  const i =
    size === "lg"
      ? "sm:max-w-4xl"
      : size === "sm"
        ? "sm:max-w-md"
        : "sm:max-w-xl";
  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      exit={{
        opacity: 0,
      }}
      transition={{
        duration: 0.15,
      }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#16161A]/40 sm:items-center sm:p-6"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(s) => s.stopPropagation()}
        initial={{
          y: 28,
          opacity: 0,
          scale: 0.98,
        }}
        animate={{
          y: 0,
          opacity: 1,
          scale: 1,
        }}
        exit={{
          y: 20,
          opacity: 0,
        }}
        transition={{
          duration: 0.25,
          ease: EASE,
        }}
        className={cx(
          "flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_24px_64px_-12px_rgba(20,20,26,.35)] sm:rounded-2xl",
          i,
        )}
      >
        <div className="flex items-center justify-between border-b border-[#E6E5E0] px-5 py-3.5">
          <h2 className="display text-lg font-semibold">{title}</h2>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="sb min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="border-t border-[#E6E5E0] bg-[#FAFAF8] px-5 py-3">
            {footer}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export function Toasts() {
  const { s, d } = useStore();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence>
        {s.toasts.map((a) => (
          <motion.div
            layout={true}
            initial={{
              y: 16,
              opacity: 0,
            }}
            animate={{
              y: 0,
              opacity: 1,
            }}
            exit={{
              y: 8,
              opacity: 0,
            }}
            transition={{
              duration: 0.2,
              ease: EASE,
            }}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-[#16161A] py-2.5 pl-3 pr-3 text-sm font-medium text-white shadow-[0_12px_32px_-8px_rgba(20,20,26,.5)]"
            key={a.id}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#34D399] text-[#16161A]">
              <Check size={13} strokeWidth={3.2} />
            </span>
            <span>{a.text}</span>
            {a.action && (
              <button
                onClick={() => {
                  a.action.run();
                  d({
                    t: "DISMISS",
                    id: a.id,
                  });
                }}
                className="rounded-md px-2 py-1 text-sm font-semibold text-[#FF8A66] hover:bg-white/10"
              >
                {a.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Magnetic({ children, strength = 0.22, className }) {
  const r = useMotionValue(0);
  const o = useMotionValue(0);
  const i = useSpring(r, {
    stiffness: 300,
    damping: 18,
  });
  const s = useSpring(o, {
    stiffness: 300,
    damping: 18,
  });
  return (
    <motion.div
      className={className}
      style={{
        x: i,
        y: s,
        display: "inline-block",
      }}
      onPointerMove={(l) => {
        const u = l.currentTarget.getBoundingClientRect();
        r.set((l.clientX - (u.left + u.width / 2)) * strength);
        o.set((l.clientY - (u.top + u.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        r.set(0);
        o.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

export function Tilt({ children, max = 7, className }) {
  const r = useMotionValue(0);
  const o = useMotionValue(0);
  const i = useSpring(r, {
    stiffness: 220,
    damping: 20,
  });
  const s = useSpring(o, {
    stiffness: 220,
    damping: 20,
  });
  return (
    <motion.div
      className={className}
      style={{
        rotateX: i,
        rotateY: s,
        transformPerspective: 800,
      }}
      onPointerMove={(l) => {
        const u = l.currentTarget.getBoundingClientRect();
        const d = (l.clientX - u.left) / u.width - 0.5;
        const c = (l.clientY - u.top) / u.height - 0.5;
        o.set(d * max * 2);
        r.set(-c * max * 2);
      }}
      onPointerLeave={() => {
        r.set(0);
        o.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

export function fireBurst(e, t) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("pq-burst", {
        detail: {
          x: e ?? window.innerWidth / 2,
          y: t ?? window.innerHeight * 0.38,
        },
      }),
    );
  }
}

const BURST_COLORS = [
  "#FF4D1A",
  "#16161A",
  "#FFB199",
  "#34D399",
  "#7C9CFF",
  "#FFD166",
];

function Particles({ x, y }) {
  return Array.from(
    {
      length: 20,
    },
    (r, o) => {
      const i = (o / 20) * Math.PI * 2 + (o % 3) * 0.25;
      const s = 70 + ((o * 37) % 80);
      return {
        i: o,
        dx: Math.cos(i) * s,
        dy: Math.sin(i) * s,
        c: BURST_COLORS[o % BURST_COLORS.length],
        sz: 6 + (o % 3) * 2,
        rot: (o * 83) % 360,
        kind: o % 3,
      };
    },
  ).map((r) => (
    <motion.span
      initial={{
        x: 0,
        y: 0,
        scale: 0,
        opacity: 1,
        rotate: 0,
      }}
      animate={{
        x: r.dx,
        y: [0, r.dy, r.dy + 46],
        scale: [0, 1, 0.8],
        rotate: r.rot,
        opacity: [1, 1, 0],
      }}
      transition={{
        duration: 1,
        ease: "easeOut",
      }}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: r.sz,
        height: r.kind === 2 ? r.sz * 0.5 : r.sz,
        borderRadius: r.kind === 0 ? 99 : 2,
        background: r.c,
      }}
      key={r.i}
    />
  ));
}

export function BurstLayer() {
  const [e, t] = useState([]);
  useEffect(() => {
    const h = (r) => {
      if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        document.querySelector(".reduce")
      ) {
        return;
      }
      const o = Math.random();
      t((i) =>
        [
          ...i,
          {
            id: o,
            ...r.detail,
          },
        ].slice(-3),
      );
      setTimeout(() => t((i) => i.filter((s) => s.id !== o)), 1300);
    };
    window.addEventListener("pq-burst", h);
    return () => window.removeEventListener("pq-burst", h);
  }, []);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70] overflow-hidden"
    >
      {e.map((a) => (
        <Particles x={a.x} y={a.y} key={a.id} />
      ))}
    </div>
  );
}

export function useBox() {
  const e = useRef(null);
  const [t, a] = useState({
    w: 600,
    h: 600,
  });
  useEffect(() => {
    const r = e.current;
    if (!r) {
      return;
    }
    const o = new ResizeObserver(() =>
      a({
        w: r.clientWidth,
        h: r.clientHeight,
      }),
    );
    o.observe(r);
    a({
      w: r.clientWidth,
      h: r.clientHeight,
    });
    return () => o.disconnect();
  }, []);
  return [e, t];
}
