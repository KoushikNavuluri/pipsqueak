import { cx } from "../ui";

// Warm, on-brand fallbacks for people without a photo.
const COLORS = ["#FF4D1A", "#3B3830", "#8C6BE8", "#2F8F6A", "#C8380C", "#B58A2E"];

function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ name, url, size = 32, className }) {
  const color = COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLORS.length];
  return (
    <span
      className={cx("inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-medium text-white", className)}
      style={{ width: size, height: size, background: url ? "#EEEBE3" : color, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}
