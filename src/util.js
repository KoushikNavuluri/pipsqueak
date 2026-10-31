export const uid = () => Math.random().toString(36).slice(2, 9);

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const slug = (s) =>
  String(s || "app")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "app";

// "2 days ago", "just now"…
export function ago(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const units = [
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
    [Infinity, "year"],
  ];
  let n = s / 60;
  for (const [step, unit] of units) {
    if (n < step) {
      const v = Math.floor(n);
      return `${v} ${unit}${v === 1 ? "" : "s"} ago`;
    }
    n /= step;
  }
  return "";
}

export const PLATFORM_LABEL = { mobile: "Mobile app", web: "Web app", website: "Website" };
