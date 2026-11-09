// Renders one carousel slide at its real pixel size (1080 wide). Previews
// scale it down with <ScaledSlide>; the exporter draws the same DOM, so what
// you see is what you export. Everything is inline-styled on purpose: the
// slide must look identical inside the app, offscreen and in a PNG.
//
// Each theme in styles.js is a recipe: how the cover is composed, how photo
// slides are composed, the photo shape, alignment, panels, numbers and the
// slide chrome. The layouts below read that recipe, so themes differ in
// composition and not only in colors and fonts.
import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FORMATS, alpha, ensureFonts, fontsReady, isDark, luminance, mix, safePalette, styleOf } from "./styles";

const P = 88; // outer margin
const fs = (n) => `calc(${n}px * var(--k, 1))`;

// Film-grain texture: a small noise PNG made once in the browser. A plain
// image (not an SVG filter) renders the same on screen and in exported PNGs.
let grainCache = null;
function grain() {
  if (grainCache !== null) return grainCache;
  if (typeof document === "undefined") return (grainCache = "none");
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 220;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(220, 220);
    let seed = 7;
    for (let i = 0; i < img.data.length; i += 4) {
      seed = (seed * 16807) % 2147483647;
      const v = seed % 256;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 46;
    }
    ctx.putImageData(img, 0, 0);
    grainCache = `url(${c.toDataURL("image/png")})`;
  } catch {
    grainCache = "none";
  }
  return grainCache;
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
const contrastInk = (bg) => (isDark(bg) ? "#FFFFFF" : "#111111");

// ---------- Text fitting ----------

// Shrinks every font size inside (they use var(--k)) until the content fits.
// It measures the laid-out content block, not scroll overflow: tight
// headlines let descenders hang below their line, which isn't overflow.
function Fit({ children, style, align = "start", center = false }) {
  const ref = useRef(null);
  const inner = useRef(null);
  const [fontTick, setFontTick] = useState(0);
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => live && setFontTick((t) => t + 1));
    return () => {
      live = false;
    };
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    const box = inner.current;
    if (!el || !box) return;
    // Too tall, or a word wider than its column (any headline line overflowing).
    const wide = () => [...box.querySelectorAll("[data-title]")].some((t) => t.scrollWidth > t.clientWidth + 1);
    const over = () => box.offsetHeight > el.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1 || wide();
    let k = 1;
    el.style.setProperty("--k", "1");
    for (let i = 0; i < 22 && over() && k > 0.35; i++) {
      k *= 0.94;
      el.style.setProperty("--k", k.toFixed(3));
    }
  });
  return (
    <div
      ref={ref}
      data-fit=""
      data-font-tick={fontTick}
      style={{ display: "flex", flexDirection: "column", justifyContent: align === "end" ? "flex-end" : align === "center" ? "center" : "flex-start", minHeight: 0, ...style }}
    >
      <div ref={inner} style={{ display: "flex", flexDirection: "column", minWidth: 0, alignItems: center ? "center" : "stretch", textAlign: center ? "center" : "left" }}>
        {children}
      </div>
    </div>
  );
}

// Headline size from its length and the room it has: the largest size at
// which the text fills about `area` square pixels, between min and max.
export function titleSize(text, max, min = 54, area = 904 * 360) {
  const n = Math.max(1, String(text || "").length);
  const size = Math.sqrt(area / (n * 0.52));
  return Math.round(Math.max(min, Math.min(max, size)));
}

// ---------- Text pieces ----------

// A highlight band that stays inside its own line, so it never paints over
// the line above when headlines are set tight.
const band = (c) => `linear-gradient(to bottom, transparent 13%, ${c} 13%, ${c} 93%, transparent 93%)`;
const clone = { boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" };

function Highlighted({ text, highlight, st, pal, onPhoto }) {
  const t = String(text || "");
  const h = String(highlight || "").trim();
  const at = h ? t.toLowerCase().indexOf(h.toLowerCase()) : -1;
  if (at < 0) return t;
  const before = t.slice(0, at);
  const word = t.slice(at, at + h.length);
  // Punctuation right after the highlight stays on its line.
  const punct = /^[,.;:!?’'")\]]+/.exec(t.slice(at + h.length))?.[0] || "";
  const after = t.slice(at + h.length + punct.length);
  // On photos (white text over a dark scrim) a dark accent won't read.
  const accentText = onPhoto ? (luminance(pal.accent) > 0.3 ? pal.accent : "#FFFFFF") : pal.accentText;
  const styles = {
    italic: { fontStyle: "italic", color: accentText, fontWeight: Math.max(400, st.titleWeight - 100) },
    color: { color: accentText },
    marker:
      st.background === "lined"
        ? { backgroundImage: `linear-gradient(100deg, transparent 0.6%, ${alpha(pal.accent, 0.85)} 1.5%, ${alpha(pal.accent, 0.85)} 97%, transparent 99%)`, backgroundSize: "100% 46%", backgroundPosition: "0 82%", backgroundRepeat: "no-repeat", padding: "0 0.08em", ...clone }
        : { backgroundImage: band(pal.accent), color: pal.onAccent, padding: "0 0.1em", ...clone },
    gradient: { backgroundImage: `linear-gradient(92deg, ${pal.accent}, ${mix(pal.accent, "#A78BFA", 0.65)})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" },
    box: { backgroundImage: band(pal.accent), color: pal.onAccent, padding: "0 0.14em", ...clone },
    invert: { backgroundImage: band(onPhoto ? "#FFFFFF" : pal.ink), color: onPhoto ? "#000000" : pal.bg, padding: "0 0.1em", ...clone },
    underline: { textDecorationLine: "underline", textDecorationColor: pal.accent, textDecorationThickness: "0.09em", textUnderlineOffset: "0.12em" },
    sticker: { display: "inline-block", background: pal.accent, color: pal.onAccent, padding: "0.02em 0.16em 0.06em", borderRadius: "0.18em", transform: "rotate(-2.5deg)", lineHeight: 1 },
  };
  return (
    <>
      {before}
      {punct ? (
        <span style={{ whiteSpace: "nowrap" }}>
          <span style={styles[st.highlight] || styles.color}>{word}</span>
          {punct}
        </span>
      ) : (
        <span style={styles[st.highlight] || styles.color}>{word}</span>
      )}
      {after}
    </>
  );
}

function Title({ text, highlight, st, pal, size, color, onPhoto, align, style }) {
  return (
    <div
      data-title=""
      style={{
        fontFamily: st.display,
        fontWeight: st.titleWeight,
        fontSize: fs(Math.round(size * st.titleScale)),
        lineHeight: st.titleLeading,
        letterSpacing: st.titleTracking,
        textTransform: st.titleCase === "upper" ? "uppercase" : "none",
        fontStretch: st.titleStretch || "normal",
        color: color || pal.ink,
        textAlign: align || (st.align === "center" ? "center" : "left"),
        textWrap: "balance",
        // Whole words only: a word too long for the column makes Fit shrink
        // the type instead of splitting the word.
        overflowWrap: "normal",
        wordBreak: "normal",
        hyphens: "manual",
        ...style,
      }}
    >
      <Highlighted text={text} highlight={highlight} st={st} pal={pal} onPhoto={onPhoto} />
    </div>
  );
}

function Kicker({ text, st, pal, onPhoto, style }) {
  if (!text) return null;
  const center = st.align === "center";
  const ink = onPhoto ? "#FFFFFF" : pal.ink;
  const accent = onPhoto ? "#FFFFFF" : pal.accentText;
  const base = { display: "flex", alignItems: "center", gap: 14, marginBottom: fs(28), justifyContent: center ? "center" : "flex-start", fontFamily: st.label, fontSize: fs(24), fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", ...style };
  switch (st.kicker) {
    case "hand":
      return <div style={{ ...base, fontFamily: st.hand, fontSize: fs(44), letterSpacing: 0, textTransform: "none", color: ink }}>{text}</div>;
    case "pill":
      return (
        <div style={base}>
          <span style={{ background: pal.accent, color: pal.onAccent, padding: "8px 20px", borderRadius: 999 }}>{text}</span>
        </div>
      );
    case "tint":
      return (
        <div style={base}>
          <span style={{ background: alpha(onPhoto ? "#FFFFFF" : pal.accent, onPhoto ? 0.2 : 0.14), color: onPhoto ? "#FFFFFF" : pal.accentText, padding: "10px 22px", borderRadius: 999, letterSpacing: "0.08em", fontSize: fs(22) }}>{text}</span>
        </div>
      );
    case "box":
      return (
        <div style={base}>
          <span style={{ border: `4px solid ${ink}`, color: ink, padding: "6px 16px", letterSpacing: "0.04em" }}>{text}</span>
        </div>
      );
    case "flank":
      return (
        <div style={{ ...base, color: accent, letterSpacing: "0.32em", fontSize: fs(22), fontWeight: 600 }}>
          <span style={{ width: 56, height: 1.5, background: accent, display: "inline-block" }} />
          {text}
          <span style={{ width: 56, height: 1.5, background: accent, display: "inline-block" }} />
        </div>
      );
    case "plain":
      return <div style={{ ...base, color: accent, letterSpacing: "0.22em", fontSize: fs(22), fontWeight: 600 }}>{text}</div>;
    default:
      return (
        <div style={{ ...base, color: onPhoto ? "#FFFFFF" : st.highlight === "box" ? pal.ink : pal.accentText }}>
          <span style={{ width: 44, height: 4, background: onPhoto ? "#FFFFFF" : pal.accent, display: "inline-block" }} />
          {text}
        </div>
      );
  }
}

function Body({ text, st, pal, size = 36, color, style }) {
  if (!text) return null;
  return (
    <div style={{ fontFamily: st.body, fontSize: fs(size), lineHeight: 1.4, color: color || pal.muted, fontWeight: 450, textWrap: "pretty", marginTop: fs(30), textAlign: st.align === "center" ? "center" : "left", ...style }}>
      {text}
    </div>
  );
}

function Source({ text, st, pal, onPhoto }) {
  if (!text) return null;
  return <div style={{ fontFamily: st.label, fontSize: 19, letterSpacing: "0.02em", color: onPhoto ? "rgba(255,255,255,.75)" : pal.muted, marginTop: fs(24) }}>Source: {text}</div>;
}

const ICONS = {
  arrow: "M5 12h14M13 6l6 6-6 6",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  comment: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  heart: "M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.3 4.5 7 4.5c2.1 0 3.6 1.1 5 3 1.4-1.9 2.9-3 5-3 3.7 0 6 3.8 4.5 7.3C19.5 16.4 12 21 12 21z",
  check: "M4 12.5l5 5L20 6.5",
  cross: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
};

export function Icon({ name, size = 40, color = "currentColor", stroke = 2.4, fill = "none" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: "block" }}>
      <path d={ICONS[name]} />
    </svg>
  );
}

// ---------- Photos ----------

function Img({ img, treatment, pal, style, searching }) {
  const focus = img?.focus || { x: 50, y: 45 };
  const filter = treatment === "mono" || treatment === "duotone" ? "grayscale(1) contrast(1.12)" : treatment === "darken" ? "brightness(.8) saturate(.95)" : "none";
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: mix(pal.bg, pal.ink, 0.12), ...style }}>
      {img?.src ? (
        <img
          src={img.src}
          alt=""
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${focus.x}% ${focus.y}%`, filter, display: "block" }}
        />
      ) : (
        <div
          data-missing-photo=""
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(110deg, ${alpha(pal.ink, 0.06)} 30%, ${alpha(pal.ink, 0.14)} 50%, ${alpha(pal.ink, 0.06)} 70%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: alpha(pal.ink, 0.5),
            fontFamily: "system-ui, sans-serif",
            fontSize: 30,
            fontWeight: 600,
          }}
        >
          {searching ? "Finding a photo…" : "Photo"}
        </div>
      )}
      {img?.src && treatment === "duotone" && <div style={{ position: "absolute", inset: 0, background: pal.accent, mixBlendMode: "multiply", opacity: 0.82 }} />}
      {img?.src && (treatment === "grain" || treatment === "duotone") && <div style={{ position: "absolute", inset: 0, backgroundImage: grain(), opacity: 0.8 }} />}
    </div>
  );
}

// A photo placed as a shaped object. `kind` comes from the theme.
function Shape({ kind, img, ctx, width, height, rotate = 0, style }) {
  const { pal, treatment, st, searching } = ctx;
  const common = { position: "relative", width, height, flexShrink: 0, boxSizing: "border-box", transform: rotate ? `rotate(${rotate}deg)` : undefined, ...style };
  const photo = (s) => <Img img={img} treatment={treatment} pal={pal} style={s} searching={searching} />;
  switch (kind) {
    case "polaroid":
      return (
        <div style={{ ...common, background: "#FFFFFF", padding: "22px 22px 86px", boxShadow: "0 22px 44px -18px rgba(0,0,0,.35)" }}>
          <div style={{ position: "relative", width: "100%", height: "100%" }}>{photo()}</div>
          <div style={{ position: "absolute", top: -26, left: "50%", width: 170, height: 52, marginLeft: -85, background: "rgba(255,240,180,.75)", transform: "rotate(-4deg)", boxShadow: "0 2px 6px rgba(0,0,0,.08)" }} />
        </div>
      );
    case "tilted":
      return (
        <div style={{ ...common, background: "#FFFFFF", padding: 14, borderRadius: st.radius, boxShadow: "0 26px 50px -20px rgba(0,0,0,.4)" }}>
          <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: st.radius - 8, overflow: "hidden" }}>{photo()}</div>
        </div>
      );
    case "cutout":
      return <div style={{ ...common, borderRadius: st.radius, border: `6px solid ${pal.ink}`, boxShadow: `16px 16px 0 ${pal.ink}`, overflow: "hidden", background: pal.surface }}>{photo()}</div>;
    case "arch":
      return (
        <div style={{ ...common, borderRadius: `${width / 2}px ${width / 2}px 0 0`, overflow: "hidden", boxShadow: st.background === "lux" ? `0 0 0 2px ${pal.bg}, 0 0 0 4px ${alpha(pal.accent, 0.8)}` : "0 30px 60px -30px rgba(0,0,0,.35)" }}>
          {photo()}
        </div>
      );
    case "circle":
      return <div style={{ ...common, borderRadius: "50%", overflow: "hidden", boxShadow: `0 0 0 10px ${alpha(pal.surface, 0.9)}` }}>{photo()}</div>;
    case "rounded":
      return (
        <div
          style={{
            ...common,
            borderRadius: st.radius,
            overflow: "hidden",
            boxShadow: st.background === "glow" ? `0 0 0 2px ${alpha(pal.accent, 0.55)}, 0 40px 90px -30px ${alpha(pal.accent, 0.55)}` : "0 30px 60px -30px rgba(11,27,51,.35)",
          }}
        >
          {photo()}
        </div>
      );
    case "offset":
      return (
        <div style={{ ...common }}>
          <div style={{ position: "absolute", inset: 0, transform: "translate(-22px, 22px)", borderRadius: st.radius, background: pal.accent }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: st.radius, overflow: "hidden", border: `5px solid ${pal.ink}` }}>{photo()}</div>
        </div>
      );
    case "boxed":
      return <div style={{ ...common, border: `8px solid ${pal.ink}`, overflow: "hidden", background: pal.surface }}>{photo({ filter: "grayscale(1) contrast(1.15)" })}</div>;
    case "card":
      return (
        <div style={{ ...common, padding: 18, borderRadius: st.radius, background: alpha(pal.surface, 0.55), border: `1.5px solid ${alpha(pal.ink, 0.22)}`, boxShadow: "0 40px 80px -36px rgba(0,0,0,.55)" }}>
          <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: st.radius - 12, overflow: "hidden" }}>{photo()}</div>
        </div>
      );
    default:
      return <div style={{ ...common, overflow: "hidden", borderRadius: st.radius > 12 ? 12 : 0 }}>{photo()}</div>;
  }
}

// Gradient behind text that sits on a photo.
// It stays dark across the whole text block, then fades out.
const scrim = (side, strength = 1) => {
  const a = (v) => Math.min(0.92, v * strength).toFixed(2);
  return side === "top"
    ? `linear-gradient(to bottom, rgba(0,0,0,${a(0.78)}) 0%, rgba(0,0,0,${a(0.66)}) 42%, rgba(0,0,0,${a(0.3)}) 64%, rgba(0,0,0,0) 82%)`
    : `linear-gradient(to top, rgba(0,0,0,${a(0.82)}) 0%, rgba(0,0,0,${a(0.68)}) 40%, rgba(0,0,0,${a(0.3)}) 62%, rgba(0,0,0,0) 80%)`;
};

// ---------- Panels and regions ----------

// The content area of a text slide, inside the theme's panel when it has one.
function Region({ ctx, top = 170, bottom = 140, left = P, right = P, align = "center", children, panel = true, zIndex = 2 }) {
  const { st, pal } = ctx;
  const center = st.align === "center";
  const kind = panel ? st.panel : "none";
  if (kind === "none") {
    return (
      <Fit style={{ position: "absolute", left, right, top, bottom, zIndex }} align={align} center={center}>
        {children}
      </Fit>
    );
  }
  const panels = {
    card: { background: pal.surface, borderRadius: 36, boxShadow: `0 40px 80px -48px ${alpha("#0B1B33", 0.45)}, 0 0 0 1px ${alpha(pal.ink, 0.06)}` },
    glass: { background: alpha(pal.surface, 0.45), borderRadius: 44, border: `1.5px solid ${alpha(pal.ink, 0.18)}`, boxShadow: "0 40px 90px -40px rgba(0,0,0,.55)" },
    border: { background: pal.surface, border: `7px solid ${pal.ink}`, boxShadow: `16px 16px 0 ${pal.ink}` },
    outline: { border: `2px solid ${alpha(pal.ink, 0.2)}`, borderRadius: st.radius },
  };
  const pad = 60;
  return (
    <div style={{ position: "absolute", left: left - 28, right: right - 28, top: top - 24, bottom: bottom - 24, padding: pad, boxSizing: "border-box", zIndex, ...panels[kind] }}>
      <Fit style={{ position: "relative", width: "100%", height: "100%" }} align={align} center={center}>
        {children}
      </Fit>
    </div>
  );
}

// ---------- Backgrounds, continuity, chrome ----------

function Background({ st, pal, W, H, index }) {
  const layers = [];
  const g = (op) => <div key="g" style={{ position: "absolute", inset: 0, backgroundImage: grain(), opacity: op }} />;
  switch (st.background) {
    case "paper":
    case "film":
      layers.push(g(st.background === "film" ? 0.7 : 0.5));
      break;
    case "grid":
      layers.push(
        <div
          key="grid"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(to right, ${alpha(pal.ink, 0.06)} 1px, transparent 1px), linear-gradient(to bottom, ${alpha(pal.ink, 0.06)} 1px, transparent 1px)`,
            backgroundSize: `${(W - 2 * P) / 6}px ${(W - 2 * P) / 6}px`,
            backgroundPosition: `${P}px ${P}px`,
          }}
        />,
      );
      break;
    case "dots":
      layers.push(<div key="dots" style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(${alpha(pal.ink, 0.13)} 1.6px, transparent 1.8px)`, backgroundSize: "36px 36px", backgroundPosition: "18px 18px" }} />);
      break;
    case "lined":
      layers.push(
        <div key="lines" style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(to bottom, transparent 53px, ${alpha("#5B8BD9", 0.22)} 53px, ${alpha("#5B8BD9", 0.22)} 55px)`, backgroundSize: "100% 56px", backgroundPosition: "0 40px" }} />,
        <div key="margin" style={{ position: "absolute", top: 0, bottom: 0, left: 64, width: 3, background: alpha("#E25B5B", 0.45) }} />,
      );
      break;
    case "glow": {
      // Glows sit on slide edges in "world" coordinates, so they continue across a swipe.
      const second = mix(pal.accent, "#7C5CFF", 0.7);
      const x = -index * W;
      layers.push(
        <div
          key="glow"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `radial-gradient(520px 520px at ${x + W * (index % 2 ? 1 : 0)}px ${H * (index % 2 ? 0.18 : 0.85)}px, ${alpha(pal.accent, 0.3)}, transparent 70%), radial-gradient(640px 640px at ${x + W * (index + 1)}px ${H * (index % 2 ? 0.8 : 0.25)}px, ${alpha(second, 0.28)}, transparent 70%)`,
          }}
        />,
        g(0.35),
      );
      break;
    }
    case "shapes":
      [
        { x: 0.78, y: 0.12, r: 260, c: alpha(pal.accent, 0.9), kind: "circle" },
        { x: 0.08, y: 0.86, r: 300, c: mix(pal.bg, pal.ink, 0.1), kind: "square" },
      ].forEach((s, i) => {
        const flip = (index + i) % 2;
        layers.push(
          <div
            key={"s" + i}
            style={{
              position: "absolute",
              left: (flip ? 1 - s.x : s.x) * W - s.r / 2,
              top: s.y * H - s.r / 2,
              width: s.r,
              height: s.r,
              background: s.c,
              borderRadius: s.kind === "circle" ? "50%" : 28,
              transform: `rotate(${((index * 17 + i * 23) % 40) - 20}deg)`,
              opacity: i === 0 ? 0.16 : 0.6,
            }}
          />,
        );
      });
      layers.push(g(0.45));
      break;
    case "mesh": {
      // Soft pastel blobs; positions drift from slide to slide.
      const a = mix(pal.accent, "#FFFFFF", 0.62);
      const b = mix(pal.bg, "#E9D8FF", 0.55);
      const c = mix(pal.bg, "#FFE3C7", 0.6);
      const o = (index % 3) * 0.12;
      layers.push(
        <div
          key="mesh"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `radial-gradient(60% 45% at ${12 + o * 100}% 8%, ${a}, transparent 70%), radial-gradient(55% 45% at ${92 - o * 80}% 38%, ${b}, transparent 72%), radial-gradient(70% 50% at 30% ${96 - o * 40}%, ${c}, transparent 70%)`,
          }}
        />,
        g(0.28),
      );
      break;
    }
    case "vivid": {
      const x = -index * W;
      layers.push(
        <div
          key="vivid"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `radial-gradient(700px 700px at ${x + W * (index + 0.1)}px ${H * 0.1}px, ${alpha(pal.accent, 0.85)}, transparent 70%), radial-gradient(760px 760px at ${x + W * (index + 1)}px ${H * 0.62}px, ${alpha("#6C5CFF", 0.9)}, transparent 70%), radial-gradient(620px 620px at ${x + W * index}px ${H * 1.02}px, ${alpha("#00C2FF", 0.7)}, transparent 70%)`,
          }}
        />,
        g(0.3),
      );
      break;
    }
    case "lux":
      layers.push(
        <div key="vig" style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(90% 70% at 50% 40%, ${mix(pal.bg, "#FFFFFF", 0.06)}, ${mix(pal.bg, "#000000", 0.35)} 100%)` }} />,
        g(0.35),
      );
      break;
    case "sunburst":
      layers.push(
        <div
          key="rays"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `repeating-conic-gradient(from 0deg at 50% 112%, ${mix(pal.bg, pal.accent, 0.16)} 0deg 7deg, ${pal.bg} 7deg 14deg)`,
          }}
        />,
        <div key="fade" style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, ${pal.bg} 6%, ${alpha(pal.bg, 0)} 46%)` }} />,
        g(0.4),
      );
      break;
    case "brutal":
      layers.push(<div key="frame" style={{ position: "absolute", inset: 22, border: `6px solid ${pal.ink}` }} />);
      break;
    case "corp":
      layers.push(
        <div key="c1" style={{ position: "absolute", right: -220, top: -220, width: 560, height: 560, borderRadius: "50%", background: alpha(pal.accent, 0.08) }} />,
        <div key="c2" style={{ position: "absolute", left: -160, bottom: -200, width: 420, height: 420, borderRadius: "50%", background: alpha(pal.accent, 0.06) }} />,
      );
      break;
    default:
      break;
  }
  return <>{layers}</>;
}

// A shape or line that runs across all slides; each slide shows its stretch.
function Continuity({ kind, pal, W, H, index, total }) {
  if (kind === "none" || !kind) return null;
  const world = W * total;
  if (kind === "thread") {
    const pts = [];
    // Runs between the header and the content, clear of any text.
    for (let x = 0; x <= world; x += 30) pts.push(`${x},${(122 + Math.sin(x / 210) * 12).toFixed(1)}`);
    return (
      <svg width={world} height={H} style={{ position: "absolute", top: 0, left: -index * W, pointerEvents: "none" }}>
        <polyline points={pts.join(" ")} fill="none" stroke={pal.accent} strokeWidth="6" strokeLinecap="round" opacity=".9" />
      </svg>
    );
  }
  // panorama: soft glows centred on the seams between slides
  return (
    <svg width={world} height={H} style={{ position: "absolute", top: 0, left: -index * W, pointerEvents: "none" }}>
      <defs>
        <radialGradient id={`pano-${index}`}>
          <stop offset="0%" stopColor={pal.accent} stopOpacity={isDark(pal.bg) ? 0.34 : 0.26} />
          <stop offset="100%" stopColor={pal.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      {Array.from({ length: total - 1 }, (_, k) => (
        <circle key={k} cx={(k + 1) * W} cy={H * (k % 2 ? 0.2 : 0.78)} r={340} fill={`url(#pano-${index})`} />
      ))}
    </svg>
  );
}

function Chrome({ st, pal, index, total, brand, onPhoto, W, H, isCover }) {
  const n = String(index + 1).padStart(2, "0");
  const t = String(total).padStart(2, "0");
  const ink = onPhoto ? "#FFFFFF" : pal.ink;
  const muted = onPhoto ? "rgba(255,255,255,.8)" : pal.muted;
  const handle = brand?.handle || brand?.name || "";
  const label = { fontFamily: st.label, fontSize: 21, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 };
  const top = { position: "absolute", top: 52, left: P, right: P, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 5 };
  const last = index === total - 1;
  let head = null;
  let arrow = !last;
  switch (st.chrome) {
    case "folio":
      head = (
        <div style={{ ...top, borderBottom: `2px solid ${alpha(ink, 0.85)}`, paddingBottom: 16 }}>
          <span style={{ ...label, color: ink }}>{handle}</span>
          <span style={{ fontFamily: st.display, fontStyle: "italic", fontSize: 28, color: ink }}>No. {n}</span>
        </div>
      );
      break;
    case "chip":
      head = (
        <div style={top}>
          <span style={{ ...label, letterSpacing: "0.04em", textTransform: "none", fontSize: 24, color: ink }}>{handle}</span>
          <span style={{ background: onPhoto ? "#FFFFFF" : pal.ink, color: onPhoto ? "#111" : pal.bg, fontFamily: st.body, fontWeight: 800, fontSize: 24, padding: "8px 20px", borderRadius: 999 }}>
            {index + 1}/{total}
          </span>
        </div>
      );
      break;
    case "bar":
      head = (
        <>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 10, background: alpha(ink, 0.08), zIndex: 5 }}>
            <div style={{ width: `${((index + 1) / total) * 100}%`, height: "100%", background: pal.accent }} />
          </div>
          <div style={{ ...top, top: 46 }}>
            <span style={{ ...label, color: ink }}>{n}</span>
            <span style={{ ...label, color: muted, letterSpacing: "0.06em", textTransform: "none" }}>{handle}</span>
          </div>
        </>
      );
      break;
    case "mono":
      head = (
        <div style={top}>
          <span style={{ fontFamily: st.label, fontSize: 22, color: onPhoto ? "#FFFFFF" : pal.accentText }}>
            [{n}/{t}]
          </span>
          <span style={{ fontFamily: st.label, fontSize: 22, color: muted }}>{handle}</span>
        </div>
      );
      break;
    case "lowerthird":
      head = (
        <div style={top}>
          <span style={{ ...label, fontSize: 24, color: ink }}>{handle}</span>
          <span style={{ ...label, fontSize: 24, color: ink }}>
            {n} <span style={{ color: pal.accent }}>—</span> {t}
          </span>
        </div>
      );
      break;
    case "page":
      arrow = false;
      head = (
        <>
          <div style={{ ...top, top: 40 }}>
            <span style={{ fontFamily: st.hand, fontSize: 40, fontWeight: 700, color: ink }}>{handle}</span>
            <span />
          </div>
          <div style={{ position: "absolute", right: P, bottom: 34, fontFamily: st.hand, fontSize: 40, fontWeight: 700, color: muted, zIndex: 5 }}>p. {index + 1}</div>
          {index === 0 && !last && (
            <div style={{ position: "absolute", left: P, bottom: 34, fontFamily: st.hand, fontSize: 42, fontWeight: 700, color: ink, zIndex: 5, display: "flex", alignItems: "center", gap: 10 }}>
              swipe <Icon name="arrow" size={38} color={ink} stroke={2.2} />
            </div>
          )}
        </>
      );
      break;
    case "figure":
      head = (
        <div style={top}>
          <span style={{ fontFamily: st.label, fontSize: 21, letterSpacing: "0.08em", color: onPhoto ? "#FFFFFF" : pal.accentText }}>
            FIG. {n} / {t}
          </span>
          <span style={{ fontFamily: st.label, fontSize: 21, color: muted }}>{handle}</span>
        </div>
      );
      break;
    case "sticker":
      head = (
        <div style={top}>
          <span style={{ ...label, letterSpacing: "0.02em", textTransform: "none", fontSize: 25, fontWeight: 700, color: ink }}>{handle}</span>
          <span style={{ width: 86, height: 86, borderRadius: "50%", background: pal.ink, color: pal.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: st.display, fontWeight: 800, fontSize: 30, transform: "rotate(-10deg)" }}>
            {index + 1}/{total}
          </span>
        </div>
      );
      break;
    case "dots":
      arrow = index === 0 && !last;
      head = (
        <>
          <div style={{ ...top, justifyContent: "center" }}>
            <span style={{ ...label, fontSize: 20, letterSpacing: "0.24em", color: muted }}>{handle}</span>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 52, display: "flex", justifyContent: "center", gap: 14, zIndex: 5 }}>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} style={{ width: i === index ? 40 : 12, height: 12, borderRadius: 999, background: i === index ? (onPhoto ? "#FFFFFF" : pal.accent) : alpha(ink, 0.22) }} />
            ))}
          </div>
        </>
      );
      break;
    case "frame":
      head = (
        <>
          <div style={{ position: "absolute", inset: 36, border: `2px solid ${alpha(onPhoto ? "#FFFFFF" : pal.accent, 0.75)}`, zIndex: 5, pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 64, display: "flex", justifyContent: "center", zIndex: 6 }}>
            <span style={{ ...label, fontSize: 19, letterSpacing: "0.36em", color: onPhoto ? "#FFFFFF" : pal.accentText, background: onPhoto ? "transparent" : pal.bg, padding: "0 18px" }}>{handle}</span>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 58, display: "flex", justifyContent: "center", zIndex: 6 }}>
            <span style={{ fontFamily: st.display, fontSize: 30, letterSpacing: "0.2em", color: onPhoto ? "#FFFFFF" : pal.accentText }}>{ROMAN[index + 1] || index + 1}</span>
          </div>
        </>
      );
      arrow = false;
      break;
    case "corp": {
      const initial = (brand?.name || brand?.handle || "•").replace("@", "").slice(0, 1).toUpperCase();
      head = (
        <>
          <div style={{ ...top, top: 50 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ width: 50, height: 50, borderRadius: 14, background: pal.accent, color: pal.onAccent, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: st.display, fontWeight: 800, fontSize: 26 }}>{initial}</span>
              <span style={{ fontFamily: st.body, fontWeight: 700, fontSize: 24, color: ink }}>{brand?.name || handle}</span>
            </span>
            {!isCover && <span style={{ fontFamily: st.body, fontWeight: 700, fontSize: 21, color: pal.muted, background: pal.surface, padding: "6px 14px", borderRadius: 999, boxShadow: `0 0 0 1px ${alpha(pal.ink, 0.08)}` }}>{index + 1} / {total}</span>}
          </div>
          <div style={{ position: "absolute", left: P, right: P, bottom: 56, height: 6, borderRadius: 3, background: alpha(ink, 0.1), zIndex: 5 }}>
            <div style={{ width: `${((index + 1) / total) * 100}%`, height: "100%", borderRadius: 3, background: pal.accent }} />
          </div>
        </>
      );
      arrow = false;
      break;
    }
    case "brutal":
      head = (
        <div style={{ ...top, top: 60 }}>
          <span style={{ fontFamily: st.label, fontWeight: 700, fontSize: 22, color: ink, border: `4px solid ${ink}`, padding: "6px 14px", background: onPhoto ? "transparent" : pal.bg }}>{handle || "INDEX"}</span>
          <span style={{ fontFamily: st.label, fontWeight: 700, fontSize: 22, color: onPhoto ? "#000" : pal.bg, background: onPhoto ? "#FFF" : pal.ink, padding: "10px 16px" }}>
            {n}/{t}
          </span>
        </div>
      );
      break;
    case "retro":
      head = (
        <div style={top}>
          <span style={{ fontFamily: st.body, fontWeight: 700, fontSize: 22, color: ink, border: `3px solid ${ink}`, borderRadius: 999, padding: "6px 18px" }}>{handle}</span>
          <span style={{ width: 74, height: 74, borderRadius: "50%", background: pal.accent, color: pal.onAccent, border: `3px solid ${pal.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: st.display, fontSize: 30 }}>{index + 1}</span>
        </div>
      );
      break;
    case "masthead":
      if (isCover) break;
      head = (
        <div style={{ ...top, borderBottom: `1.5px solid ${alpha(ink, 0.9)}`, paddingBottom: 14 }}>
          <span style={{ fontFamily: st.display, fontStyle: "italic", fontWeight: 700, fontSize: 30, color: ink }}>{brand?.name || handle}</span>
          <span style={{ ...label, fontSize: 19, letterSpacing: "0.2em", color: ink }}>Nº {n}</span>
        </div>
      );
      break;
    default:
      head = null;
  }
  return (
    <>
      {head}
      {arrow && (
        <div style={{ position: "absolute", right: P - 6, bottom: 40, color: muted, zIndex: 5, display: "flex", alignItems: "center", gap: 10, fontFamily: st.label, fontSize: 22, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {index === 0 && <span>Swipe</span>}
          <Icon name="arrow" size={index === 0 ? 40 : 34} color={index === 0 ? (onPhoto ? "#FFFFFF" : pal.accentText) : muted} stroke={2.4} />
        </div>
      )}
    </>
  );
}

// ---------- Numbers ----------

function Num({ n, st, pal, size = 220 }) {
  const s = String(n).padStart(2, "0");
  const common = { fontFamily: st.display, lineHeight: 0.9, flexShrink: 0 };
  switch (st.number) {
    case "serif-italic":
      return <div style={{ ...common, fontStyle: "italic", fontWeight: 500, fontSize: fs(size), color: pal.accentText }}>{s}</div>;
    case "outline":
      return <div style={{ ...common, fontSize: fs(size * 1.15), color: "transparent", WebkitTextStroke: `4px ${pal.ink}` }}>{s}</div>;
    case "huge":
      return <div style={{ ...common, fontWeight: 900, fontSize: fs(size * 1.25), letterSpacing: "-0.06em", color: pal.accentText }}>{s}</div>;
    case "mono":
      return <div style={{ fontFamily: st.label, fontSize: fs(size * 0.45), fontWeight: 600, color: pal.accentText, lineHeight: 1 }}>[{s}]</div>;
    case "box":
      return <div style={{ ...common, fontWeight: 700, fontSize: fs(size * 0.6), background: pal.accent, color: pal.onAccent, padding: "10px 26px 14px", alignSelf: "flex-start" }}>{s}</div>;
    case "hand":
      return (
        <div style={{ fontFamily: st.hand, fontWeight: 700, fontSize: fs(size * 0.7), color: pal.ink, width: fs(size * 0.95), height: fs(size * 0.95), border: `5px solid ${pal.ink}`, borderRadius: "50% 46% 52% 44%", display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-6deg)", background: alpha(pal.accent, 0.6) }}>
          {n}
        </div>
      );
    case "sticker":
      return (
        <div style={{ ...common, fontWeight: 800, fontSize: fs(size * 0.55), background: pal.accent, color: pal.onAccent, width: fs(size * 0.95), height: fs(size * 0.95), borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-8deg)" }}>
          {n}
        </div>
      );
    case "rule":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: fs(20), fontFamily: st.label, fontSize: fs(size * 0.2), letterSpacing: "0.2em", color: pal.accentText, fontWeight: 600 }}>
          <span style={{ width: fs(60), height: 2, background: pal.accent }} />
          {s}
          <span style={{ width: fs(60), height: 2, background: pal.accent }} />
        </div>
      );
    case "roman":
      return <div style={{ ...common, fontStyle: "italic", fontWeight: 500, fontSize: fs(size * 0.62), color: pal.accentText, letterSpacing: "0.04em" }}>{ROMAN[n] || n}</div>;
    case "circle":
      return (
        <div style={{ ...common, width: fs(size * 0.7), height: fs(size * 0.7), borderRadius: "50%", border: `2.5px solid ${pal.accentText}`, color: pal.accentText, display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs(size * 0.34), fontStyle: "italic" }}>
          {n}
        </div>
      );
    case "pill":
      return (
        <div style={{ ...common, fontFamily: st.body, fontWeight: 800, fontSize: fs(size * 0.3), background: pal.accent, color: pal.onAccent, padding: `${fs(size * 0.07)} ${fs(size * 0.14)}`, borderRadius: fs(size * 0.12), lineHeight: 1 }}>
          {s}
        </div>
      );
    case "badge":
      return (
        <div style={{ ...common, width: fs(size * 0.72), height: fs(size * 0.72), borderRadius: "50%", background: pal.accent, color: pal.onAccent, border: `5px solid ${pal.ink}`, boxShadow: `-8px 8px 0 ${pal.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs(size * 0.38) }}>
          {n}
        </div>
      );
    case "brutal":
      return <div style={{ ...common, fontWeight: 400, fontSize: fs(size * 0.5), background: pal.ink, color: pal.bg, padding: `${fs(size * 0.06)} ${fs(size * 0.12)}`, lineHeight: 1 }}>{s}</div>;
    case "serif":
      return <div style={{ ...common, fontWeight: 400, fontSize: fs(size * 1.05), color: pal.ink, letterSpacing: "-0.04em" }}>{n}</div>;
    default:
      return <div style={{ ...common, fontWeight: 800, fontSize: fs(size), color: pal.accentText }}>{s}</div>;
  }
}

function Card({ st, pal, children, tone = "plain", style }) {
  const base = { position: "relative", padding: "30px 34px", borderRadius: st.radius };
  const kinds = {
    rule: { borderTop: `2px solid ${alpha(pal.ink, 0.85)}`, borderRadius: 0, padding: "26px 0 8px" },
    solid: { background: tone === "accent" ? pal.accent : pal.surface, border: `5px solid ${pal.ink}`, boxShadow: `10px 10px 0 ${pal.ink}` },
    outline: { border: `2px solid ${tone === "accent" ? pal.accent : alpha(pal.ink, 0.22)}`, background: tone === "accent" ? alpha(pal.accent, 0.08) : "transparent" },
    glass: { background: tone === "accent" ? alpha(pal.accent, 0.14) : alpha(pal.surface, 0.72), border: `1.5px solid ${tone === "accent" ? alpha(pal.accent, 0.6) : alpha(pal.ink, 0.12)}`, boxShadow: "0 30px 60px -30px rgba(0,0,0,.6)" },
    caption: { background: tone === "accent" ? pal.accent : pal.surface, borderLeft: `8px solid ${pal.accent}`, borderRadius: 0 },
    paper: { background: tone === "accent" ? alpha(pal.accent, st.background === "lined" ? 0.55 : 1) : pal.surface, boxShadow: "0 16px 30px -18px rgba(0,0,0,.35)" },
  };
  return <div style={{ ...base, ...(kinds[st.card] || kinds.outline), ...style }}>{children}</div>;
}

// ---------- Layout pieces ----------

const textSide = (img) => ((img?.focus?.y ?? 45) > 55 ? "top" : "bottom");

// Kicker, headline, body and source: the text block every layout shares.
function TextBlock({ s, ctx, max, min, area, bodySize = 38, onPhoto, titleColor, bodyColor, children }) {
  const { st, pal } = ctx;
  return (
    <>
      <Kicker text={s.kicker} st={st} pal={pal} onPhoto={onPhoto} />
      <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, max, min, area)} color={titleColor} onPhoto={onPhoto} />
      {children}
      <Body text={s.body} st={st} pal={pal} size={bodySize} color={bodyColor} />
      <Source text={s.source} st={st} pal={pal} onPhoto={onPhoto} />
    </>
  );
}

// Text over a full-bleed photo.
function FullPhoto({ s, ctx, cover }) {
  const { st, pal, H, img, treatment, searching } = ctx;
  const side = textSide(img);
  const busy = img?.textArea === "busy" || st.card === "caption";
  return (
    <>
      <Img img={img} treatment={treatment} pal={pal} searching={searching} />
      {st.photoDim ? <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${st.photoDim})` }} /> : null}
      <div style={{ position: "absolute", inset: 0, background: scrim(side, busy ? 1.15 : 1) }} />
      {side !== "top" && <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 240, background: "linear-gradient(to bottom, rgba(0,0,0,.42), rgba(0,0,0,0))" }} />}
      <Region ctx={ctx} panel={false} align={side === "top" ? "start" : "end"} top={side === "top" ? 160 : H * 0.34} bottom={side === "top" ? H * 0.38 : st.chrome === "frame" || st.chrome === "dots" ? 130 : 120} zIndex={3}>
        <TextBlock s={s} ctx={ctx} max={cover ? 168 : 120} min={60} area={cover ? 904 * 420 : 904 * 300} bodySize={cover ? 42 : 40} onPhoto titleColor="#FFFFFF" bodyColor="rgba(255,255,255,.92)" />
      </Region>
    </>
  );
}

// A magazine cover: masthead, full-bleed photo and cover lines.
function MagazineCover({ s, ctx, hasImg }) {
  const { st, pal, W, H, img, treatment, brand, searching } = ctx;
  const name = (brand?.name || (brand?.handle || "").replace("@", "") || "The Brief").toUpperCase();
  const masthead = Math.round(Math.min(250, (W - 2 * P) / Math.max(3, name.length * 0.66)));
  const ink = hasImg ? "#FFFFFF" : pal.ink;
  return (
    <>
      {hasImg && (
        <>
          <Img img={img} treatment={treatment} pal={pal} searching={searching} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 45%, rgba(0,0,0,.75) 100%)" }} />
        </>
      )}
      <div style={{ position: "absolute", left: P, right: P, top: 56, textAlign: "center", zIndex: 4 }}>
        <div style={{ fontFamily: st.display, fontWeight: 900, fontSize: masthead, lineHeight: 0.9, letterSpacing: "-0.03em", color: ink, whiteSpace: "nowrap" }}>{name}</div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", fontFamily: st.label, fontSize: 19, fontWeight: 700, letterSpacing: "0.22em", color: ink, borderTop: `1.5px solid ${alpha(ink, 0.8)}`, paddingTop: 10 }}>
          <span>ISSUE Nº 01</span>
          <span>{(s.kicker || "SPECIAL EDITION").toUpperCase()}</span>
        </div>
      </div>
      <Region ctx={ctx} panel={false} align="end" top={hasImg ? H * 0.42 : 400} bottom={hasImg ? 120 : 160} zIndex={4}>
        <div style={{ width: 90, height: 8, background: pal.accent, marginBottom: fs(28) }} />
        <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, 170, 70, 904 * 440)} color={ink} onPhoto={hasImg} />
        <Body text={s.body} st={st} pal={pal} size={40} color={hasImg ? "rgba(255,255,255,.92)" : undefined} />
      </Region>
    </>
  );
}

function Cover({ s, ctx }) {
  const { st, pal, W, H, img, treatment } = ctx;
  const hasImg = !!s.image?.use;
  if (st.cover === "magazine") return <MagazineCover s={s} ctx={ctx} hasImg={hasImg} />;
  if (hasImg) {
    switch (st.cover) {
      case "bleed":
        return <FullPhoto s={s} ctx={ctx} cover />;
      case "block":
      case "blocktop": {
        const imgH = Math.round(H * (st.cover === "block" ? 0.44 : 0.48));
        const photoTop = st.cover === "blocktop";
        return (
          <>
            <div style={{ position: "absolute", left: 0, right: 0, [photoTop ? "top" : "bottom"]: 0, height: imgH }}>
              <Img img={img} treatment={treatment} pal={pal} searching={ctx.searching} />
              {photoTop && (
                <div style={{ position: "absolute", left: P, bottom: 22, fontFamily: st.label, fontSize: 19, letterSpacing: "0.1em", color: "#FFFFFF", background: alpha("#000000", 0.55), padding: "6px 12px" }}>
                  FIG. 01
                </div>
              )}
            </div>
            <Region ctx={ctx} align={photoTop ? "start" : "end"} top={photoTop ? imgH + 64 : 160} bottom={photoTop ? 130 : imgH + 56}>
              <TextBlock s={s} ctx={ctx} max={150} min={70} area={904 * 380} />
            </Region>
          </>
        );
      }
      case "object": {
        const w = st.shape === "polaroid" ? 620 : 660;
        const h = Math.round(H * 0.4);
        return (
          <>
            <div style={{ position: "absolute", right: st.shape === "polaroid" ? 150 : 90, bottom: 130, zIndex: 1 }}>
              <Shape kind={st.shape} img={img} ctx={ctx} width={w} height={h} rotate={st.shape === "cutout" ? 3 : st.shape === "polaroid" ? -4 : 5} />
            </div>
            <Region ctx={ctx} align="start" top={160} bottom={130 + h + 36}>
              <TextBlock s={s} ctx={ctx} max={156} min={72} area={904 * 360} />
            </Region>
          </>
        );
      }
      case "stack": {
        // A shaped photo above centered text.
        const w = st.shape === "arch" ? Math.round(W * 0.6) : st.shape === "card" ? Math.round(W * 0.72) : Math.round(W * 0.56);
        const h = Math.round(H * (st.shape === "rect" ? 0.38 : 0.44));
        const topY = st.shape === "rect" ? 200 : 150;
        return (
          <>
            <div style={{ position: "absolute", left: (W - w) / 2, top: topY, zIndex: 1 }}>
              <Shape kind={st.shape} img={img} ctx={ctx} width={w} height={h} />
            </div>
            <Region ctx={ctx} panel={false} align="start" top={topY + h + 56} bottom={st.chrome === "dots" || st.chrome === "retro" ? 110 : 130}>
              <TextBlock s={s} ctx={ctx} max={st.titleScale < 0.9 ? 140 : 130} min={60} area={904 * 260} bodySize={34} />
            </Region>
          </>
        );
      }
      case "rounded": {
        const h = Math.round(H * 0.42);
        return (
          <>
            <Region ctx={ctx} panel={false} align="end" top={150} bottom={h + 150}>
              <TextBlock s={s} ctx={ctx} max={150} min={66} area={904 * 360} />
            </Region>
            <div style={{ position: "absolute", left: P, bottom: 110 }}>
              <Shape kind="rounded" img={img} ctx={ctx} width={W - 2 * P} height={h} />
            </div>
          </>
        );
      }
      case "side": {
        const col = Math.round(W * 0.44);
        return (
          <>
            <div style={{ position: "absolute", right: 0, top: 130, bottom: 130, width: col, borderRadius: `${st.radius * 1.5}px 0 0 ${st.radius * 1.5}px`, overflow: "hidden" }}>
              <Img img={img} treatment={treatment} pal={pal} searching={ctx.searching} />
            </div>
            <Region ctx={ctx} panel={false} align="center" top={150} bottom={140} right={col + 56}>
              <TextBlock s={s} ctx={ctx} max={118} min={56} area={540 * 420} bodySize={32} />
            </Region>
          </>
        );
      }
      case "poster": {
        const titleBottom = Math.round(H * 0.44);
        return (
          <>
            <Region ctx={ctx} panel={false} align="end" top={150} bottom={titleBottom}>
              <Kicker text={s.kicker} st={st} pal={pal} />
              <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, 230, 90, 904 * 520)} />
            </Region>
            <div style={{ position: "absolute", left: P, right: P, top: H - titleBottom + 34, bottom: s.body ? 250 : 130 }}>
              <Shape kind="boxed" img={img} ctx={ctx} width="100%" height="100%" />
            </div>
            {s.body && (
              <div style={{ position: "absolute", left: P, right: P, bottom: 120, height: 104, display: "flex", alignItems: "center", fontFamily: st.body, fontSize: 28, lineHeight: 1.35, color: pal.ink, borderTop: `6px solid ${pal.ink}`, paddingTop: 14, overflow: "hidden" }}>
                {s.body}
              </div>
            )}
          </>
        );
      }
      default:
        return <FullPhoto s={s} ctx={ctx} cover />;
    }
  }
  // Type only: the headline is the picture.
  const center = st.align === "center";
  return (
    <>
      {st.background === "paper" && <div style={{ position: "absolute", right: P - 10, top: 150, fontFamily: st.display, fontStyle: "italic", fontSize: 360, lineHeight: 1, color: alpha(pal.accent, 0.12) }}>&amp;</div>}
      {st.chrome === "bar" && <div style={{ position: "absolute", left: P, top: 170, width: 150, height: 150, background: pal.accent }} />}
      {st.number === "badge" && <div style={{ position: "absolute", left: "50%", top: 200, width: 120, height: 120, marginLeft: -60, borderRadius: "50%", background: pal.accent, border: `5px solid ${pal.ink}` }} />}
      <Region ctx={ctx} align={center ? "center" : "end"} top={st.chrome === "bar" ? 360 : st.number === "badge" ? 360 : 170} bottom={140}>
        <TextBlock s={s} ctx={ctx} max={st.cover === "poster" ? 240 : 196} min={88} area={904 * 620} bodySize={42} />
      </Region>
    </>
  );
}

function Statement({ s, ctx }) {
  const { st, pal, invert } = ctx;
  return (
    <Region ctx={ctx} align="center">
      {st.cover === "magazine" && !s.kicker && <div style={{ width: 80, height: 8, background: pal.accent, marginBottom: fs(30) }} />}
      <TextBlock s={s} ctx={ctx} max={140} min={72} area={904 * 520} bodySize={42} bodyColor={invert ? alpha(pal.ink, 0.82) : undefined} />
    </Region>
  );
}

// Photo slides ("photo" is photo-led, "split" shares the slide with text).
function PhotoLayout({ s, ctx, split }) {
  const { st, pal, W, H, img, treatment, index, searching } = ctx;
  const mode = st.photo === "bleed" && split ? "band" : st.photo;
  if (mode === "bleed") return <FullPhoto s={s} ctx={ctx} />;
  if (mode === "side") {
    const col = Math.round(W * (split ? 0.4 : 0.44));
    const right = index % 2 === 0;
    return (
      <>
        <div style={{ position: "absolute", [right ? "right" : "left"]: 0, top: st.chrome === "masthead" ? 128 : 0, bottom: 0, width: col, overflow: "hidden", borderRadius: st.panel === "card" ? (right ? `${st.radius * 1.5}px 0 0 0` : `0 ${st.radius * 1.5}px 0 0`) : 0 }}>
          <Img img={img} treatment={treatment} pal={pal} searching={searching} />
        </div>
        <Region ctx={ctx} panel={false} align="center" top={st.chrome === "masthead" ? 190 : 160} bottom={140} left={right ? P : col + 56} right={right ? col + 56 : P}>
          <TextBlock s={s} ctx={ctx} max={104} min={52} area={480 * 360} bodySize={32} />
        </Region>
      </>
    );
  }
  if (mode === "band") {
    const imgTop = !split || index % 2 === 1;
    const imgH = Math.round(H * (split ? 0.48 : 0.56));
    return (
      <>
        <div style={{ position: "absolute", left: 0, right: 0, [imgTop ? "top" : "bottom"]: 0, height: imgH }}>
          <Img img={img} treatment={treatment} pal={pal} searching={searching} />
        </div>
        <Region ctx={ctx} align={imgTop ? "start" : "end"} top={imgTop ? imgH + 56 : 160} bottom={imgTop ? 120 : imgH + 50}>
          <TextBlock s={s} ctx={ctx} max={116} min={58} area={904 * (split ? 280 : 220)} bodySize={36} />
        </Region>
      </>
    );
  }
  // A shaped photo with text below (or alternating above and below for splits).
  const center = st.align === "center";
  const objectish = ["polaroid", "tilted", "cutout"].includes(st.shape);
  const w = st.shape === "circle" ? Math.round(H * 0.42) : st.shape === "arch" ? Math.round(W * (split ? 0.52 : 0.6)) : Math.round(W - 2 * P - (objectish ? 60 : 0) - (center && st.shape === "rect" ? 200 : 0));
  const h = st.shape === "circle" ? w : Math.round(H * (split ? 0.4 : 0.48));
  const imgTop = !split || index % 2 === 1 || st.shape === "arch";
  const rotate = objectish ? (index % 2 ? -2.5 : 2.5) : 0;
  const y = imgTop ? 150 : H - h - 130;
  return (
    <>
      <div style={{ position: "absolute", left: center || objectish ? (W - w) / 2 : P, top: y, zIndex: 1 }}>
        <Shape kind={st.shape} img={img} ctx={ctx} width={w} height={h} rotate={rotate} />
      </div>
      <Region ctx={ctx} panel={false} align={imgTop ? "start" : "end"} top={imgTop ? y + h + (objectish ? 110 : 64) : 160} bottom={imgTop ? (st.chrome === "dots" ? 110 : 120) : H - y + 50}>
        <TextBlock s={s} ctx={ctx} max={108} min={56} area={904 * 240} bodySize={34} />
      </Region>
    </>
  );
}

function Items({ s, ctx, mode }) {
  const { st, pal } = ctx;
  const items = (s.items || []).slice(0, mode === "checklist" ? 6 : 5);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: fs(mode === "checklist" ? 20 : 26), marginTop: fs(44), alignSelf: "stretch", textAlign: "left" }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: fs(28), alignItems: "flex-start" }}>
          {mode === "checklist" ? (
            <div style={{ width: fs(54), height: fs(54), flexShrink: 0, borderRadius: st.background === "lined" ? 10 : Math.min(12, st.radius), border: `3.5px solid ${pal.ink}`, display: "flex", alignItems: "center", justifyContent: "center", background: alpha(pal.accent, i < 2 ? 0.9 : 0), marginTop: fs(4) }}>
              {i < 2 && <Icon name="check" size={34} color={contrastInk(pal.accent)} stroke={3.4} />}
            </div>
          ) : st.number === "pill" || st.number === "badge" || st.number === "brutal" || st.number === "circle" ? (
            <div style={{ flexShrink: 0, marginTop: fs(2) }}>
              <Num n={i + 1} st={st} pal={pal} size={110} />
            </div>
          ) : (
            <div style={{ width: fs(70), flexShrink: 0, fontFamily: st.number === "mono" ? st.label : st.display, fontStyle: ["serif-italic", "roman"].includes(st.number) ? "italic" : "normal", fontWeight: 700, fontSize: fs(46), lineHeight: 1.1, color: pal.accentText }}>
              {st.number === "roman" ? ROMAN[i + 1] : String(i + 1).padStart(2, "0")}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0, borderBottom: (st.card === "rule" || st.align === "center") && i < items.length - 1 ? `1.5px solid ${alpha(pal.ink, 0.16)}` : "none", paddingBottom: st.card === "rule" || st.align === "center" ? fs(22) : 0 }}>
            {it.label && <div style={{ fontFamily: st.display, fontWeight: Math.min(800, st.titleWeight), textTransform: st.titleCase === "upper" ? "uppercase" : "none", fontSize: fs(st.titleCase === "upper" ? 50 : 46), lineHeight: 1.1, color: pal.ink, letterSpacing: st.titleCase === "upper" ? "0.02em" : st.titleTracking }}>{it.label}</div>}
            {it.text && <div style={{ fontFamily: st.body, fontSize: fs(34), lineHeight: 1.34, color: pal.muted, marginTop: fs(6) }}>{it.text}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListSlide({ s, ctx, mode }) {
  const { st, pal } = ctx;
  return (
    <Region ctx={ctx} align="center" top={160} bottom={130}>
      <Kicker text={s.kicker} st={st} pal={pal} />
      <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, 116, 62, 904 * 220)} />
      {s.body && <Body text={s.body} st={st} pal={pal} size={36} style={{ marginTop: fs(20) }} />}
      <Items s={s} ctx={ctx} mode={mode} />
    </Region>
  );
}

function Step({ s, ctx }) {
  const { st, pal, W, H, img, treatment, stepNo, searching } = ctx;
  const hasImg = !!s.image?.use;
  const center = st.align === "center";
  const number = (
    <div style={{ marginBottom: fs(36), display: "flex", justifyContent: center ? "center" : "flex-start" }}>
      <Num n={stepNo} st={st} pal={pal} size={hasImg ? 170 : 230} />
    </div>
  );
  if (!hasImg) {
    return (
      <Region ctx={ctx} align="center">
        {number}
        <TextBlock s={s} ctx={ctx} max={132} min={66} area={904 * 380} bodySize={41} />
      </Region>
    );
  }
  // Side-photo themes put the photo in a column; others under the text.
  if (st.photo === "side") {
    const col = Math.round(W * 0.4);
    return (
      <>
        <div style={{ position: "absolute", right: 0, top: st.chrome === "masthead" ? 128 : 130, bottom: 130, width: col, overflow: "hidden", borderRadius: st.panel === "card" ? `${st.radius * 1.5}px 0 0 ${st.radius * 1.5}px` : 0 }}>
          <Img img={img} treatment={treatment} pal={pal} searching={searching} />
        </div>
        <Region ctx={ctx} panel={false} align="center" top={170} bottom={140} right={col + 56}>
          {number}
          <TextBlock s={s} ctx={ctx} max={104} min={52} area={520 * 380} bodySize={32} />
        </Region>
      </>
    );
  }
  const imgH = Math.round(H * 0.34);
  const shaped = st.photo === "shape";
  const kind = shaped ? st.shape : "rect";
  const w = kind === "circle" ? imgH : kind === "arch" ? Math.round(W * 0.5) : shaped && ["polaroid", "tilted", "cutout"].includes(kind) ? Math.round(W * 0.62) : W - 2 * P;
  const bleed = !shaped && st.photo === "band";
  return (
    <>
      <Region ctx={ctx} panel={false} align="start" top={160} bottom={imgH + (bleed ? 0 : 110) + 44}>
        {number}
        <TextBlock s={s} ctx={ctx} max={120} min={60} area={904 * 300} bodySize={36} />
      </Region>
      {bleed ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: imgH }}>
          <Img img={img} treatment={treatment} pal={pal} searching={searching} />
        </div>
      ) : (
        <div style={{ position: "absolute", bottom: 110, ...(center ? { left: (W - w) / 2 } : ["polaroid", "tilted", "cutout"].includes(kind) ? { right: P } : { left: P }) }}>
          <Shape kind={kind} img={img} ctx={ctx} width={w} height={imgH - (kind === "polaroid" ? 0 : 20)} rotate={["polaroid", "tilted", "cutout"].includes(kind) ? -2 : 0} />
        </div>
      )}
    </>
  );
}

function Stat({ s, ctx }) {
  const { st, pal } = ctx;
  const value = s.stat?.value || "";
  const size = Math.round(Math.min(400, 1500 / Math.max(2.6, value.length)));
  const pct = /^(\d{1,3}(?:\.\d+)?)\s*%$/.exec(value);
  const meter = pct && Number(pct[1]) <= 100 ? Number(pct[1]) : null;
  return (
    <Region ctx={ctx} align="center" top={160} bottom={130}>
      <Kicker text={s.kicker} st={st} pal={pal} />
      <div style={{ fontFamily: st.display, fontWeight: st.number === "serif-italic" || st.titleWeight < 600 ? 500 : 800, fontStyle: st.number === "serif-italic" ? "italic" : "normal", fontStretch: st.titleStretch || "normal", fontSize: fs(size * Math.min(1.1, st.titleScale)), lineHeight: 0.86, letterSpacing: "-0.045em", color: pal.accentText, whiteSpace: "nowrap" }}>{value}</div>
      {meter !== null && (
        <div style={{ marginTop: fs(36), height: fs(34), alignSelf: "stretch", background: alpha(pal.ink, 0.1), borderRadius: Math.min(st.radius, 17), overflow: "hidden" }}>
          <div style={{ width: `${meter}%`, height: "100%", background: pal.accent, borderRadius: Math.min(st.radius, 17) }} />
        </div>
      )}
      {s.stat?.label && <div style={{ fontFamily: st.label, fontSize: fs(30), fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.muted, marginTop: fs(30) }}>{s.stat.label}</div>}
      <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, 96, 56, 904 * 200)} style={{ marginTop: fs(26) }} />
      <Body text={s.body} st={st} pal={pal} size={38} />
      <Source text={s.source} st={st} pal={pal} />
    </Region>
  );
}

function Quote({ s, ctx }) {
  const { st, pal, img } = ctx;
  const text = s.quote?.text || s.title;
  const by = s.quote?.by;
  const center = st.align === "center";
  return (
    <Region ctx={ctx} align="center" top={150} bottom={130}>
      <div style={{ fontFamily: st.background === "lined" ? st.hand : st.highlight === "italic" ? st.display : "Georgia, serif", fontSize: fs(260), lineHeight: 0.7, height: fs(150), color: pal.accentText, fontWeight: 700, textAlign: center ? "center" : "left" }}>“</div>
      <Title text={text} highlight={s.highlight} st={{ ...st, titleCase: "none", titleTracking: st.titleCase === "upper" ? "0" : st.titleTracking, titleScale: Math.min(1, st.titleScale) }} pal={pal} size={titleSize(text, 112, 58, 904 * 500)} style={{ fontStyle: st.highlight === "italic" ? "italic" : "normal", fontWeight: st.highlight === "italic" ? 500 : st.titleWeight }} />
      {by && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: center ? "center" : "flex-start", gap: fs(22), marginTop: fs(44) }}>
          {s.image?.use && img?.src && (
            <div style={{ position: "relative", width: fs(120), height: fs(120), borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: `4px solid ${pal.accent}` }}>
              <Img img={img} treatment="natural" pal={pal} />
            </div>
          )}
          <div style={{ fontFamily: st.label, fontSize: fs(28), fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.ink }}>— {by}</div>
        </div>
      )}
      {s.body && <Body text={s.body} st={st} pal={pal} size={32} />}
      <Source text={s.source} st={st} pal={pal} />
    </Region>
  );
}

function Compare({ s, ctx }) {
  const { st, pal } = ctx;
  const [a, b] = [s.items?.[0] || { label: "Before", text: "" }, s.items?.[1] || { label: "After", text: "" }];
  const filled = ["solid", "caption", "paper"].includes(st.card);
  const onFill = st.background === "lined" ? pal.ink : pal.onAccent;
  const row = (it, good) => (
    <Card st={st} pal={pal} tone={good ? "accent" : "plain"} style={{ display: "flex", gap: fs(26), alignItems: "flex-start", textAlign: "left" }}>
      <div style={{ width: fs(64), height: fs(64), borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: good ? (filled ? pal.ink : pal.accent) : alpha(pal.ink, 0.12) }}>
        <Icon name={good ? "check" : "cross"} size={34} color={good ? (filled ? pal.bg : pal.onAccent) : pal.ink} stroke={3.2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: st.label, fontSize: fs(25), fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: good && filled ? onFill : good ? pal.accentText : pal.muted }}>{it.label}</div>
        <div style={{ fontFamily: st.body, fontWeight: 600, fontSize: fs(42), lineHeight: 1.26, marginTop: fs(10), color: good && filled ? onFill : pal.ink }}>{it.text}</div>
      </div>
    </Card>
  );
  return (
    <Region ctx={ctx} align="center" top={160} bottom={130}>
      <Kicker text={s.kicker} st={st} pal={pal} />
      <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, 112, 60, 904 * 220)} />
      <div style={{ display: "flex", flexDirection: "column", gap: fs(30), marginTop: fs(46), alignSelf: "stretch" }}>
        {row(a, false)}
        {row(b, true)}
      </div>
      {s.body && <Body text={s.body} st={st} pal={pal} size={31} />}
      <Source text={s.source} st={st} pal={pal} />
    </Region>
  );
}

function Cta({ s, ctx }) {
  const { st, pal, brand, goal } = ctx;
  const center = st.align === "center";
  const actions = [
    { id: "saves", icon: "bookmark", label: "Save" },
    { id: "shares", icon: "send", label: "Share" },
    { id: "comments", icon: "comment", label: "Comment" },
    { id: "follows", icon: "plus", label: "Follow" },
  ];
  return (
    <Region ctx={ctx} align="center" top={160} bottom={130}>
      <TextBlock s={s} ctx={ctx} max={150} min={70} area={904 * 380} bodySize={40} />
      <div style={{ display: "flex", gap: fs(18), marginTop: fs(56), flexWrap: "wrap", justifyContent: center ? "center" : "flex-start" }}>
        {actions.map((a) => {
          const on = a.id === (goal || "saves");
          return (
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: fs(12),
                padding: `${fs(16)} ${fs(26)}`,
                borderRadius: st.radius === 0 && st.panel === "border" ? 0 : 999,
                border: `3px solid ${on ? pal.accent : alpha(pal.ink, 0.2)}`,
                background: on ? pal.accent : "transparent",
                color: on ? pal.onAccent : pal.ink,
                fontFamily: st.body,
                fontWeight: 700,
                fontSize: fs(28),
              }}
            >
              <Icon name={a.icon} size={30} color={on ? pal.onAccent : pal.ink} stroke={2.4} />
              {a.label}
            </div>
          );
        })}
      </div>
      {(brand?.handle || brand?.name) && (
        <div style={{ marginTop: fs(64), display: "flex", alignItems: "center", justifyContent: center ? "center" : "flex-start", gap: fs(20), textAlign: "left" }}>
          <div style={{ width: fs(84), height: fs(84), borderRadius: "50%", background: pal.ink, color: pal.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: st.display, fontWeight: 800, fontSize: fs(38) }}>
            {(brand.name || brand.handle).replace("@", "").slice(0, 1).toUpperCase()}
          </div>
          <div>
            {brand.name && <div style={{ fontFamily: st.body, fontWeight: 800, fontSize: fs(32), color: pal.ink }}>{brand.name}</div>}
            {brand.handle && <div style={{ fontFamily: st.label, fontSize: fs(26), color: pal.muted }}>{brand.handle}</div>}
          </div>
        </div>
      )}
    </Region>
  );
}

// ---------- Slide ----------

// Which slides read as "on a photo" (white chrome).
export function onPhotoSlide(slide, style) {
  const st = styleOf(style);
  if (!slide?.image?.use) return false;
  if (slide.layout === "photo") return st.photo === "bleed";
  if (slide.layout === "cover") return st.cover === "bleed" || st.cover === "magazine";
  return false;
}

// A slide whose photo can't be shown becomes a clean text slide instead of
// showing a placeholder: always in exports, and on screen once the photo
// search has finished without a result.
export function withoutMissingPhoto(slide) {
  if (!slide?.image?.use || slide.img?.src) return slide;
  const layout = slide.layout === "photo" || slide.layout === "split" ? "statement" : slide.layout;
  return { ...slide, layout, image: { ...slide.image, use: false } };
}

export const Slide = forwardRef(function Slide({ slide: given, index, total, direction, brand, format = "4:5", goal, stepNo = 1, forExport = false }, ref) {
  const waiting = given?.image?.use && !given?.img?.src;
  // A photo slide without a photo: a shimmer while Pip searches, a "Photo"
  // placeholder right after the user switches a photo on ("empty"), and
  // otherwise (search found nothing, or older designs) a clean text slide.
  const status = given?.image?.status;
  const searching = waiting && status === "searching";
  const slide = waiting && (forExport || (status !== "searching" && status !== "empty")) ? withoutMissingPhoto(given) : given;
  const fmt = FORMATS[format] || FORMATS["4:5"];
  const W = fmt.w;
  const H = fmt.h;
  const st = styleOf(direction?.style);
  const basePal = safePalette(direction?.palette, direction?.style);
  // Bold type alternates color fields on statements for rhythm.
  const invert = st.background === "flat" && slide.layout === "statement" && index % 2 === 0;
  const pal = invert ? { ...basePal, bg: basePal.ink, ink: basePal.bg, muted: mix(basePal.bg, basePal.ink, 0.25), accentText: basePal.accent } : basePal;
  useEffect(() => ensureFonts(direction?.style), [direction?.style]);
  const ctx = { st, pal, W, H, img: slide.img, treatment: direction?.treatment || "natural", brand, index, total, stepNo, goal, invert, searching };
  const onPhoto = onPhotoSlide(slide, direction?.style);
  let body;
  switch (slide.layout) {
    case "cover":
      body = <Cover s={slide} ctx={ctx} />;
      break;
    case "photo":
      body = <PhotoLayout s={slide} ctx={ctx} />;
      break;
    case "split":
      body = <PhotoLayout s={slide} ctx={ctx} split />;
      break;
    case "list":
      body = <ListSlide s={slide} ctx={ctx} mode="list" />;
      break;
    case "checklist":
      body = <ListSlide s={slide} ctx={ctx} mode="checklist" />;
      break;
    case "step":
      body = <Step s={slide} ctx={ctx} />;
      break;
    case "stat":
      body = <Stat s={slide} ctx={ctx} />;
      break;
    case "quote":
      body = <Quote s={slide} ctx={ctx} />;
      break;
    case "compare":
      body = <Compare s={slide} ctx={ctx} />;
      break;
    case "cta":
      body = <Cta s={slide} ctx={ctx} />;
      break;
    default:
      body = <Statement s={slide} ctx={ctx} />;
  }
  return (
    <div
      ref={ref}
      data-slide={index}
      style={{
        position: "relative",
        width: W,
        height: H,
        overflow: "hidden",
        background: invert ? pal.bg : basePal.bg,
        color: pal.ink,
        fontFamily: st.body,
        WebkitFontSmoothing: "antialiased",
        textRendering: "optimizeLegibility",
      }}
    >
      <Background st={st} pal={pal} W={W} H={H} index={index} total={total} />
      {!onPhoto && <Continuity kind={direction?.continuity} pal={pal} W={W} H={H} index={index} total={total} />}
      {body}
      <Chrome st={st} pal={pal} index={index} total={total} brand={brand} onPhoto={onPhoto} W={W} H={H} isCover={slide.layout === "cover"} />
    </div>
  );
});

// A slide shown at any width; it keeps its real size inside and scales.
export function ScaledSlide({ width, format = "4:5", className, style, ...props }) {
  const fmt = FORMATS[format] || FORMATS["4:5"];
  const scale = width / fmt.w;
  return (
    <div className={className} style={{ width, height: fmt.h * scale, overflow: "hidden", position: "relative", flexShrink: 0, ...style }}>
      <div style={{ width: fmt.w, height: fmt.h, transform: `scale(${scale})`, transformOrigin: "0 0", pointerEvents: "none" }}>
        <Slide format={format} {...props} />
      </div>
    </div>
  );
}

// Step numbers count only step slides, in order.
export function stepNumbers(slides) {
  let n = 0;
  return slides.map((s) => (s.layout === "step" ? ++n : n || 1));
}

export { fontsReady };
