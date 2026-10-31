import { Link } from "react-router-dom";
import { cx } from "./ui";

// The pip: a seed, because every design here starts as one sentence.
const PIP = "M16 6.5c3.9 4.6 6.5 8.2 6.5 11.5a6.5 6.5 0 0 1-13 0c0-3.3 2.6-6.9 6.5-11.5z";

export function Mark({ size = 28, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={cx("shrink-0", className)}>
      <rect width="32" height="32" rx="9.5" fill="#17150F" />
      <g transform="rotate(45 16 16)">
        <path d={PIP} fill="#FF4D1A" />
        <circle cx="13.7" cy="17.6" r="1.7" fill="#FFE3D6" opacity=".9" />
      </g>
    </svg>
  );
}

export function Wordmark({ className, light = false }) {
  return (
    <span
      className={cx("font-display text-[21px] font-semibold leading-none tracking-[-0.035em]", light ? "text-white" : "text-ink", className)}
      style={{ fontVariationSettings: '"SOFT" 100, "opsz" 48' }}
    >
      pipsqueak
    </span>
  );
}

export function Logo({ to = "/", light = false, compact = false, className }) {
  return (
    <Link to={to} aria-label="Pipsqueak home" className={cx("group inline-flex items-center gap-2 rounded-lg", className)}>
      <span className="transition-transform duration-500 ease-out group-hover:rotate-[-8deg] group-hover:scale-105">
        <Mark size={compact ? 26 : 28} />
      </span>
      {!compact && <Wordmark light={light} />}
    </Link>
  );
}

// A soft, slowly moving glow in the brand's warm colors. Purely decorative.
// Drawn with radial gradients that fade to transparent on their own, and
// moved only with transforms, so it never costs a repaint: blur filters and
// masks on large animated layers made every frame expensive.
const GLOW = {
  soft: "radial-gradient(38% 50% at 30% 42%, rgba(255,122,69,.20), transparent 70%), radial-gradient(36% 48% at 72% 34%, rgba(196,178,255,.26), transparent 70%), radial-gradient(42% 28% at 50% 60%, rgba(255,197,158,.28), transparent 70%)",
  strong: "radial-gradient(38% 50% at 30% 42%, rgba(255,122,69,.32), transparent 70%), radial-gradient(36% 48% at 72% 34%, rgba(196,178,255,.38), transparent 70%), radial-gradient(42% 28% at 50% 60%, rgba(255,197,158,.42), transparent 70%)",
};
export function Aura({ className, strong = false }) {
  return (
    <div aria-hidden="true" className={cx("pointer-events-none absolute overflow-hidden", className)}>
      <div className="absolute inset-[-10%] animate-drift transition-opacity duration-700 will-change-transform" style={{ backgroundImage: GLOW.soft }} />
      <div className={cx("absolute inset-[-10%] animate-drift transition-opacity duration-700 will-change-transform", strong ? "opacity-100" : "opacity-0")} style={{ backgroundImage: GLOW.strong, animationDelay: "-9s", animationDuration: "28s" }} />
    </div>
  );
}

// Loading state: the pip breathing inside a ripple.
export function PipLoader({ size = 40, label = "Loading", className }) {
  return (
    <span role="status" aria-label={label} className={cx("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <span className="absolute inset-0 animate-ring rounded-full border border-accent/50" />
      <span className="absolute inset-0 animate-ring rounded-full border border-accent/40" style={{ animationDelay: "-.9s" }} />
      <svg width={size * 0.55} height={size * 0.55} viewBox="9 6 14 19" aria-hidden="true" className="animate-pip">
        <path d={PIP} fill="#FF4D1A" />
      </svg>
    </span>
  );
}

// The pip on its own, for inline use: Pip's avatar, the prompt bar, status.
export function PipGlyph({ size = 16, pulse = false, className }) {
  return (
    <svg width={size} height={size} viewBox="6 6 20 20" aria-hidden="true" className={cx("shrink-0", pulse && "animate-pip", className)} style={pulse ? undefined : { transform: "rotate(45deg)" }}>
      <path d={PIP} fill="#FF4D1A" />
    </svg>
  );
}
