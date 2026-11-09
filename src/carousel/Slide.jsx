// Renders one carousel slide at its real pixel size (1080 wide). Previews
// scale it down with <ScaledSlide>; the exporter draws the same DOM, so what
// you see is what you export. Everything is inline-styled on purpose: the
// slide must look identical inside the app, offscreen and in a PNG.
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

// ---------- Text fitting ----------

// Shrinks every font size inside (they use var(--k)) until the content fits.
// It measures the laid-out content block, not scroll overflow: tight
// headlines let descenders hang below their line, which isn't overflow.
function Fit({ children, style, align = "start" }) {
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
    const over = () => box.offsetHeight > el.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1;
    let k = 1;
    el.style.setProperty("--k", "1");
    for (let i = 0; i < 16 && over() && k > 0.45; i++) {
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
      <div ref={inner} style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
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

// ---------- Pieces ----------

// A highlight band that stays inside its own line, so it never paints over
// the line above when headlines are set tight.
const band = (c) => `linear-gradient(to bottom, transparent 13%, ${c} 13%, ${c} 93%, transparent 93%)`;

function Highlighted({ text, highlight, st, pal, onPhoto }) {
  const t = String(text || "");
  const h = String(highlight || "").trim();
  const at = h ? t.toLowerCase().indexOf(h.toLowerCase()) : -1;
  if (at < 0) return t;
  const before = t.slice(0, at);
  const word = t.slice(at, at + h.length);
  const after = t.slice(at + h.length);
  // On photos (white text over a dark scrim) a dark accent won't read.
  const accentText = onPhoto ? (luminance(pal.accent) > 0.3 ? pal.accent : "#FFFFFF") : pal.accentText;
  const styles = {
    italic: { fontStyle: "italic", color: accentText, fontWeight: Math.max(400, st.titleWeight - 100) },
    color: { color: accentText },
    marker:
      st.background === "lined"
        ? { backgroundImage: `linear-gradient(100deg, transparent 0.6%, ${alpha(pal.accent, 0.85)} 1.5%, ${alpha(pal.accent, 0.85)} 97%, transparent 99%)`, backgroundSize: "100% 46%", backgroundPosition: "0 82%", backgroundRepeat: "no-repeat", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", padding: "0 0.08em" }
        : { backgroundImage: band(pal.accent), color: pal.onAccent, padding: "0 0.1em", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" },
    gradient: { backgroundImage: `linear-gradient(92deg, ${pal.accent}, ${mix(pal.accent, "#A78BFA", 0.65)})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" },
    box: { backgroundImage: band(pal.accent), color: pal.onAccent, padding: "0 0.14em", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" },
    underline: { textDecorationLine: "underline", textDecorationColor: pal.accent, textDecorationThickness: "0.09em", textUnderlineOffset: "0.12em" },
    sticker: { display: "inline-block", background: pal.accent, color: pal.onAccent, padding: "0.02em 0.16em 0.06em", borderRadius: "0.18em", transform: "rotate(-2.5deg)", lineHeight: 1 },
  };
  return (
    <>
      {before}
      <span style={styles[st.highlight] || styles.color}>{word}</span>
      {after}
    </>
  );
}

function Title({ text, highlight, st, pal, size, color, onPhoto, align = "left", style }) {
  return (
    <div
      style={{
        fontFamily: st.display,
        fontWeight: st.titleWeight,
        fontSize: fs(Math.round(size * st.titleScale)),
        lineHeight: st.titleLeading,
        letterSpacing: st.titleTracking,
        textTransform: st.titleCase === "upper" ? "uppercase" : "none",
        fontStretch: st.titleStretch || "normal",
        color: color || pal.ink,
        textAlign: align,
        textWrap: "balance",
        overflowWrap: "break-word",
        ...style,
      }}
    >
      <Highlighted text={text} highlight={highlight} st={st} pal={pal} onPhoto={onPhoto} />
    </div>
  );
}

function Kicker({ text, st, pal, onPhoto, style }) {
  if (!text) return null;
  const hand = st.chrome === "page";
  return (
    <div
      style={{
        fontFamily: hand ? st.hand : st.label,
        fontSize: fs(hand ? 44 : 24),
        fontWeight: hand ? 700 : 700,
        letterSpacing: hand ? "0" : "0.16em",
        textTransform: hand ? "none" : "uppercase",
        color: onPhoto ? "#FFFFFF" : st.highlight === "box" || st.chrome === "chip" ? pal.ink : pal.accentText,
        marginBottom: fs(26),
        display: "flex",
        alignItems: "center",
        gap: 14,
        ...style,
      }}
    >
      {st.chrome === "chip" || st.chrome === "sticker" ? (
        <span style={{ background: pal.accent, color: pal.onAccent, padding: "8px 18px", borderRadius: 999 }}>{text}</span>
      ) : (
        <>
          {!hand && <span style={{ width: 44, height: 4, background: onPhoto ? "#FFFFFF" : pal.accent, display: "inline-block" }} />}
          {text}
        </>
      )}
    </div>
  );
}

function Body({ text, st, pal, size = 36, color, style }) {
  if (!text) return null;
  return (
    <div style={{ fontFamily: st.body, fontSize: fs(size), lineHeight: 1.38, color: color || pal.muted, fontWeight: 450, textWrap: "pretty", marginTop: fs(30), ...style }}>{text}</div>
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

function Img({ img, treatment, pal, style }) {
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
            backgroundImage: `repeating-linear-gradient(135deg, ${alpha(pal.ink, 0.07)} 0 18px, transparent 18px 36px)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: alpha(pal.ink, 0.45),
            fontFamily: "system-ui, sans-serif",
            fontSize: 30,
            fontWeight: 600,
          }}
        >
          Photo
        </div>
      )}
      {img?.src && treatment === "duotone" && <div style={{ position: "absolute", inset: 0, background: pal.accent, mixBlendMode: "multiply", opacity: 0.82 }} />}
      {img?.src && (treatment === "grain" || treatment === "duotone") && <div style={{ position: "absolute", inset: 0, backgroundImage: grain(), opacity: 0.8 }} />}
    </div>
  );
}

// A photo placed as an object on the page (cut-out card, polaroid, tilted print).
function PhotoObject({ img, st, pal, treatment, width, height, rotate = 0, style }) {
  const frame = st.frame;
  const common = { position: "relative", width, height, flexShrink: 0, boxSizing: "border-box", transform: `rotate(${rotate}deg)`, ...style };
  if (frame === "polaroid") {
    return (
      <div style={{ ...common, background: "#FFFFFF", padding: "22px 22px 86px", boxShadow: "0 22px 44px -18px rgba(0,0,0,.35)" }}>
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <Img img={img} treatment={treatment} pal={pal} />
        </div>
        <div style={{ position: "absolute", top: -26, left: "50%", width: 170, height: 52, marginLeft: -85, background: "rgba(255,240,180,.75)", transform: "rotate(-4deg)", boxShadow: "0 2px 6px rgba(0,0,0,.08)" }} />
      </div>
    );
  }
  if (frame === "tilted") {
    return (
      <div style={{ ...common, background: "#FFFFFF", padding: 14, borderRadius: st.radius, boxShadow: "0 26px 50px -20px rgba(0,0,0,.4)" }}>
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: st.radius - 8, overflow: "hidden" }}>
          <Img img={img} treatment={treatment} pal={pal} />
        </div>
      </div>
    );
  }
  // cutout (bold): thick outline and a hard offset shadow
  return (
    <div style={{ ...common, borderRadius: st.radius, border: `6px solid ${pal.ink}`, boxShadow: `16px 16px 0 ${pal.ink}`, overflow: "hidden", background: pal.surface }}>
      <Img img={img} treatment={treatment} pal={pal} />
    </div>
  );
}

// Gradient behind text that sits on a photo.
// It stays dark across the whole text block, then fades out.
const scrim = (side, strength = 1) => {
  const a = (v) => Math.min(0.92, v * strength).toFixed(2);
  return side === "top"
    ? `linear-gradient(to bottom, rgba(0,0,0,${a(0.78)}) 0%, rgba(0,0,0,${a(0.66)}) 42%, rgba(0,0,0,${a(0.3)}) 64%, rgba(0,0,0,0) 82%)`
    : `linear-gradient(to top, rgba(0,0,0,${a(0.82)}) 0%, rgba(0,0,0,${a(0.68)}) 40%, rgba(0,0,0,${a(0.3)}) 62%, rgba(0,0,0,0) 80%)`;
};

// ---------- Backgrounds, continuity, chrome ----------

function Background({ st, pal, W, H, index, total }) {
  const layers = [];
  if (st.background === "paper" || st.background === "film") {
    layers.push(<div key="g" style={{ position: "absolute", inset: 0, backgroundImage: grain(), opacity: st.background === "film" ? 0.7 : 0.5 }} />);
  }
  if (st.background === "grid") {
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
  }
  if (st.background === "dots") {
    layers.push(<div key="dots" style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(${alpha(pal.ink, 0.13)} 1.6px, transparent 1.8px)`, backgroundSize: "36px 36px", backgroundPosition: "18px 18px" }} />);
  }
  if (st.background === "lined") {
    layers.push(
      <div key="lines" style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(to bottom, transparent 53px, ${alpha("#5B8BD9", 0.22)} 53px, ${alpha("#5B8BD9", 0.22)} 55px)`, backgroundSize: "100% 56px", backgroundPosition: "0 40px" }} />,
      <div key="margin" style={{ position: "absolute", top: 0, bottom: 0, left: 64, width: 3, background: alpha("#E25B5B", 0.45) }} />,
    );
  }
  if (st.background === "glow") {
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
      <div key="g" style={{ position: "absolute", inset: 0, backgroundImage: grain(), opacity: 0.35 }} />,
    );
  }
  if (st.background === "shapes") {
    const shapes = [
      { x: 0.78, y: 0.12, r: 260, c: alpha(pal.accent, 0.9), kind: "circle" },
      { x: 0.08, y: 0.86, r: 300, c: mix(pal.bg, pal.ink, 0.1), kind: "square" },
    ];
    shapes.forEach((s, i) => {
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
            transform: `rotate(${(index * 17 + i * 23) % 40 - 20}deg)`,
            opacity: i === 0 ? 0.16 : 0.6,
          }}
        />,
      );
    });
    layers.push(<div key="g" style={{ position: "absolute", inset: 0, backgroundImage: grain(), opacity: 0.45 }} />);
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

function Chrome({ st, pal, index, total, brand, onPhoto, W, H }) {
  const n = String(index + 1).padStart(2, "0");
  const t = String(total).padStart(2, "0");
  const ink = onPhoto ? "#FFFFFF" : pal.ink;
  const muted = onPhoto ? "rgba(255,255,255,.8)" : pal.muted;
  const handle = brand?.handle || brand?.name || "";
  const label = { fontFamily: st.label, fontSize: 21, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 };
  const top = { position: "absolute", top: 52, left: P, right: P, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 5 };
  const last = index === total - 1;
  let head = null;
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
          <span style={{ fontFamily: st.label, fontSize: 22, color: onPhoto ? "#FFFFFF" : pal.accentText }}>[{n}/{t}]</span>
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
    default:
      head = null;
  }
  return (
    <>
      {head}
      {!last && st.chrome !== "page" && (
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

// ---------- Layouts ----------

function textSide(img) {
  return (img?.focus?.y ?? 45) > 55 ? "top" : "bottom";
}

function FullPhoto({ s, ctx, cover }) {
  const { st, pal, W, H, img, treatment, brand } = ctx;
  const side = textSide(img);
  const busy = img?.textArea === "busy" || st.card === "caption";
  const max = cover ? 168 : 120;
  const titleColor = "#FFFFFF";
  return (
    <>
      <Img img={img} treatment={treatment} pal={pal} />
      <div style={{ position: "absolute", inset: 0, background: scrim(side, busy ? 1.15 : 1) }} />
      {side !== "top" && <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 240, background: "linear-gradient(to bottom, rgba(0,0,0,.42), rgba(0,0,0,0))" }} />}
      <Fit
        align={side === "top" ? "start" : "end"}
        style={{ position: "absolute", left: P, right: P, top: side === "top" ? 150 : H * 0.34, bottom: side === "top" ? H * 0.38 : 120, zIndex: 3 }}
      >
        <Kicker text={s.kicker} st={st} pal={pal} onPhoto />
        {st.card === "caption" ? (
          <div style={{ alignSelf: "flex-start", maxWidth: "100%" }}>
            <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, max, 60, cover ? 904 * 420 : 904 * 300)} color={titleColor} onPhoto />
          </div>
        ) : (
          <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, max, 60, cover ? 904 * 420 : 904 * 300)} color={titleColor} onPhoto />
        )}
        <Body text={s.body} st={st} pal={pal} color="rgba(255,255,255,.92)" size={cover ? 42 : 40} />
        <Source text={s.source} st={st} pal={pal} onPhoto />
      </Fit>
      {cover && brand?.name && <div />}
    </>
  );
}

function Cover({ s, ctx }) {
  const { st, pal, W, H, img, treatment } = ctx;
  const hasImg = s.image?.use;
  if (hasImg && st.frame === "bleed") return <FullPhoto s={s} ctx={ctx} cover />;
  if (hasImg && st.frame === "block") {
    const imgH = Math.round(H * 0.44);
    return (
      <>
        <Fit style={{ position: "absolute", left: P, right: P, top: 150, bottom: imgH + 50 }} align="end">
          <Kicker text={s.kicker} st={st} pal={pal} />
          <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, 150, 72, 904 * 380)} />
          <Body text={s.body} st={st} pal={pal} size={38} />
        </Fit>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: imgH }}>
          <Img img={img} treatment={treatment} pal={pal} />
        </div>
      </>
    );
  }
  if (hasImg) {
    // A photo object in the lower half, the title above and overlapping it.
    const w = st.frame === "polaroid" ? 620 : 660;
    const h = Math.round(H * 0.4);
    return (
      <>
        <div style={{ position: "absolute", right: st.frame === "polaroid" ? 150 : 90, bottom: 130, zIndex: 1 }}>
          <PhotoObject img={img} st={st} pal={pal} treatment={treatment} width={w} height={h} rotate={st.frame === "cutout" ? 3 : st.frame === "polaroid" ? -4 : 5} />
        </div>
        <Fit style={{ position: "absolute", left: P, right: P, top: 160, bottom: 130 + h + 36, zIndex: 2 }}>
          <Kicker text={s.kicker} st={st} pal={pal} />
          <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, 156, 72, 904 * 360)} />
          <Body text={s.body} st={st} pal={pal} size={38} />
        </Fit>
      </>
    );
  }
  // Type only: the headline is the picture.
  return (
    <>
      {st.background === "paper" && <div style={{ position: "absolute", right: P - 10, top: 150, fontFamily: st.display, fontStyle: "italic", fontSize: 360, lineHeight: 1, color: alpha(pal.accent, 0.12) }}>&amp;</div>}
      {st.chrome === "bar" && <div style={{ position: "absolute", left: P, top: 170, width: 150, height: 150, background: pal.accent }} />}
      <Fit style={{ position: "absolute", left: P, right: P, top: st.chrome === "bar" ? 360 : 170, bottom: 140 }} align="end">
        <Kicker text={s.kicker} st={st} pal={pal} />
        <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, 196, 92, 904 * 620)} />
        <Body text={s.body} st={st} pal={pal} size={42} />
      </Fit>
    </>
  );
}

function Statement({ s, ctx }) {
  const { st, pal, H, invert } = ctx;
  return (
    <Fit style={{ position: "absolute", left: P, right: P, top: 160, bottom: 140 }} align="center">
      <Kicker text={s.kicker} st={st} pal={pal} />
      <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, 140, 72, 904 * 520)} color={invert ? pal.onAccent : undefined} />
      <Body text={s.body} st={st} pal={pal} size={42} color={invert ? alpha(pal.onAccent, 0.85) : undefined} />
      <Source text={s.source} st={st} pal={pal} />
    </Fit>
  );
}

function Split({ s, ctx }) {
  const { st, pal, W, H, img, treatment, index } = ctx;
  const imgTop = index % 2 === 1;
  const imgH = Math.round(H * 0.5);
  const objectFrame = ["cutout", "polaroid", "tilted"].includes(st.frame);
  const photo = objectFrame ? (
    <div style={{ position: "absolute", left: 0, right: 0, [imgTop ? "top" : "bottom"]: imgTop ? 130 : 110, height: imgH - 40, display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1 }}>
      <PhotoObject img={img} st={st} pal={pal} treatment={treatment} width={W - 2 * P - 120} height={imgH - 150} rotate={index % 2 ? -3 : 3} />
    </div>
  ) : (
    <div style={{ position: "absolute", left: 0, right: 0, [imgTop ? "top" : "bottom"]: 0, height: imgH }}>
      <Img img={img} treatment={treatment} pal={pal} />
    </div>
  );
  return (
    <>
      {photo}
      <Fit
        style={{ position: "absolute", left: P, right: P, top: imgTop ? imgH + 56 : 150, bottom: imgTop ? 120 : imgH + 50, zIndex: 2 }}
        align={imgTop ? "start" : "end"}
      >
        <Kicker text={s.kicker} st={st} pal={pal} />
        <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, 116, 60, 904 * 280)} />
        <Body text={s.body} st={st} pal={pal} size={39} />
        <Source text={s.source} st={st} pal={pal} />
      </Fit>
    </>
  );
}

function PhotoSlide({ s, ctx }) {
  const { st, pal, W, H, img, treatment } = ctx;
  if (["polaroid", "tilted"].includes(st.frame)) {
    const h = Math.round(H * 0.44);
    return (
      <>
        <div style={{ position: "absolute", left: 0, right: 0, top: 150, height: h + 40, display: "flex", justifyContent: "center", zIndex: 1 }}>
          <PhotoObject img={img} st={st} pal={pal} treatment={treatment} width={W - 2 * P - 60} height={h} rotate={-2.5} />
        </div>
        <Fit style={{ position: "absolute", left: P, right: P, top: 150 + h + 70, bottom: 120, zIndex: 2 }}>
          <Kicker text={s.kicker} st={st} pal={pal} />
          <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, 108, 58, 904 * 240)} />
          <Body text={s.body} st={st} pal={pal} size={38} />
        </Fit>
      </>
    );
  }
  return <FullPhoto s={s} ctx={ctx} />;
}

function Items({ s, ctx, mode }) {
  const { st, pal } = ctx;
  const items = (s.items || []).slice(0, mode === "checklist" ? 6 : 5);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: fs(mode === "checklist" ? 20 : 26), marginTop: fs(44) }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: fs(28), alignItems: "flex-start" }}>
          {mode === "checklist" ? (
            <div style={{ width: fs(54), height: fs(54), flexShrink: 0, borderRadius: st.background === "lined" ? 10 : Math.min(12, st.radius), border: `3.5px solid ${pal.ink}`, display: "flex", alignItems: "center", justifyContent: "center", background: alpha(pal.accent, i < 2 ? 0.9 : 0), marginTop: fs(4) }}>
              {i < 2 && <Icon name="check" size={34} color={contrastInk(pal.accent)} stroke={3.4} />}
            </div>
          ) : (
            <div style={{ width: fs(70), flexShrink: 0, fontFamily: st.number === "mono" ? st.label : st.display, fontStyle: st.number === "serif-italic" ? "italic" : "normal", fontWeight: 700, fontSize: fs(46), lineHeight: 1.1, color: pal.accentText }}>
              {String(i + 1).padStart(2, "0")}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0, borderBottom: st.card === "rule" && i < items.length - 1 ? `1.5px solid ${alpha(pal.ink, 0.18)}` : "none", paddingBottom: st.card === "rule" ? fs(22) : 0 }}>
            {it.label && <div style={{ fontFamily: st.display, fontWeight: Math.min(800, st.titleWeight), textTransform: st.titleCase === "upper" ? "uppercase" : "none", fontSize: fs(st.titleCase === "upper" ? 52 : 46), lineHeight: 1.1, color: pal.ink, letterSpacing: st.titleTracking }}>{it.label}</div>}
            {it.text && <div style={{ fontFamily: st.body, fontSize: fs(34), lineHeight: 1.34, color: pal.muted, marginTop: fs(6) }}>{it.text}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

const contrastInk = (bg) => (isDark(bg) ? "#FFFFFF" : "#111111");

function ListSlide({ s, ctx, mode }) {
  const { st, pal } = ctx;
  return (
    <Fit style={{ position: "absolute", left: P, right: P, top: 160, bottom: 130 }} align="center">
      <Kicker text={s.kicker} st={st} pal={pal} />
      <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, 116, 62, 904 * 220)} />
      {s.body && <Body text={s.body} st={st} pal={pal} size={36} style={{ marginTop: fs(20) }} />}
      <Items s={s} ctx={ctx} mode={mode} />
    </Fit>
  );
}

function Step({ s, ctx }) {
  const { st, pal, W, H, img, treatment, stepNo } = ctx;
  const hasImg = s.image?.use;
  const imgH = hasImg ? Math.round(H * 0.34) : 0;
  return (
    <>
      <Fit style={{ position: "absolute", left: P, right: P, top: 160, bottom: hasImg ? imgH + 70 : 140 }} align={hasImg ? "start" : "center"}>
        <div style={{ marginBottom: fs(36), display: "flex" }}>
          <Num n={stepNo} st={st} pal={pal} size={hasImg ? 170 : 230} />
        </div>
        <Kicker text={s.kicker} st={st} pal={pal} />
        <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, 132, 66, 904 * 380)} />
        <Body text={s.body} st={st} pal={pal} size={41} />
        <Source text={s.source} st={st} pal={pal} />
      </Fit>
      {hasImg &&
        (["cutout", "polaroid", "tilted"].includes(st.frame) ? (
          <div style={{ position: "absolute", right: P, bottom: 110 }}>
            <PhotoObject img={img} st={st} pal={pal} treatment={treatment} width={W * 0.62} height={imgH - 40} rotate={-2} />
          </div>
        ) : (
          <div style={{ position: "absolute", left: st.frame === "bleed" ? 0 : P, right: st.frame === "bleed" ? 0 : P, bottom: st.frame === "bleed" ? 0 : 110, height: imgH, borderRadius: st.frame === "bleed" ? 0 : st.radius, overflow: "hidden" }}>
            <Img img={img} treatment={treatment} pal={pal} />
          </div>
        ))}
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
    <Fit style={{ position: "absolute", left: P, right: P, top: 160, bottom: 130 }} align="center">
      <Kicker text={s.kicker} st={st} pal={pal} />
      <div style={{ fontFamily: st.display, fontWeight: st.number === "serif-italic" ? 500 : 800, fontStyle: st.number === "serif-italic" ? "italic" : "normal", fontStretch: st.titleStretch || "normal", fontSize: fs(size * st.titleScale), lineHeight: 0.86, letterSpacing: "-0.045em", color: pal.accentText, whiteSpace: "nowrap" }}>{value}</div>
      {meter !== null && (
        <div style={{ marginTop: fs(36), height: fs(34), background: alpha(pal.ink, 0.1), borderRadius: Math.min(st.radius, 17), overflow: "hidden" }}>
          <div style={{ width: `${meter}%`, height: "100%", background: pal.accent, borderRadius: Math.min(st.radius, 17) }} />
        </div>
      )}
      {s.stat?.label && <div style={{ fontFamily: st.label, fontSize: fs(30), fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.muted, marginTop: fs(30) }}>{s.stat.label}</div>}
      <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, 96, 56, 904 * 200)} style={{ marginTop: fs(26) }} />
      <Body text={s.body} st={st} pal={pal} size={38} />
      <Source text={s.source} st={st} pal={pal} />
    </Fit>
  );
}

function Quote({ s, ctx }) {
  const { st, pal, img } = ctx;
  const text = s.quote?.text || s.title;
  const by = s.quote?.by;
  return (
    <Fit style={{ position: "absolute", left: P, right: P, top: 150, bottom: 130 }} align="center">
      <div style={{ fontFamily: st.background === "lined" ? st.hand : "Georgia, serif", fontSize: fs(260), lineHeight: 0.7, height: fs(150), color: pal.accentText, fontWeight: 700 }}>“</div>
      <Title text={text} highlight={s.highlight} st={{ ...st, titleCase: "none", titleScale: Math.min(1, st.titleScale) }} pal={pal} size={titleSize(text, 112, 58, 904 * 500)} style={{ fontStyle: st.highlight === "italic" ? "italic" : "normal", fontWeight: st.highlight === "italic" ? 500 : st.titleWeight }} />
      {by && (
        <div style={{ display: "flex", alignItems: "center", gap: fs(22), marginTop: fs(44) }}>
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
    </Fit>
  );
}

function Compare({ s, ctx }) {
  const { st, pal } = ctx;
  const [a, b] = [s.items?.[0] || { label: "Before", text: "" }, s.items?.[1] || { label: "After", text: "" }];
  const row = (it, good) => (
    <Card st={st} pal={pal} tone={good ? "accent" : "plain"} style={{ display: "flex", gap: fs(26), alignItems: "flex-start" }}>
      <div style={{ width: fs(64), height: fs(64), borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: good ? (st.card === "solid" || st.card === "caption" || st.card === "paper" ? pal.ink : pal.accent) : alpha(pal.ink, 0.12) }}>
        <Icon name={good ? "check" : "cross"} size={34} color={good ? (st.card === "solid" || st.card === "caption" || st.card === "paper" ? pal.bg : pal.onAccent) : pal.ink} stroke={3.2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: st.label, fontSize: fs(25), fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: good && ["solid", "caption", "paper"].includes(st.card) ? (st.background === "lined" ? pal.ink : pal.onAccent) : good ? pal.accentText : pal.muted }}>{it.label}</div>
        <div style={{ fontFamily: st.body, fontWeight: 600, fontSize: fs(42), lineHeight: 1.26, marginTop: fs(10), color: good && ["solid", "caption", "paper"].includes(st.card) ? (st.background === "lined" ? pal.ink : pal.onAccent) : pal.ink }}>{it.text}</div>
      </div>
    </Card>
  );
  return (
    <Fit style={{ position: "absolute", left: P, right: P, top: 160, bottom: 130 }} align="center">
      <Kicker text={s.kicker} st={st} pal={pal} />
      <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, 112, 60, 904 * 220)} />
      <div style={{ display: "flex", flexDirection: "column", gap: fs(30), marginTop: fs(46) }}>
        {row(a, false)}
        {row(b, true)}
      </div>
      {s.body && <Body text={s.body} st={st} pal={pal} size={31} />}
      <Source text={s.source} st={st} pal={pal} />
    </Fit>
  );
}

function Cta({ s, ctx }) {
  const { st, pal, brand, goal } = ctx;
  const actions = [
    { id: "saves", icon: "bookmark", label: "Save" },
    { id: "shares", icon: "send", label: "Share" },
    { id: "comments", icon: "comment", label: "Comment" },
    { id: "follows", icon: "plus", label: "Follow" },
  ];
  return (
    <Fit style={{ position: "absolute", left: P, right: P, top: 160, bottom: 130 }} align="center">
      <Kicker text={s.kicker} st={st} pal={pal} />
      <Title text={s.title} highlight={s.highlight} st={st} pal={pal} size={titleSize(s.title, 150, 70, 904 * 380)} />
      <Body text={s.body} st={st} pal={pal} size={40} />
      <div style={{ display: "flex", gap: fs(18), marginTop: fs(56), flexWrap: "wrap" }}>
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
                borderRadius: 999,
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
        <div style={{ marginTop: fs(64), display: "flex", alignItems: "center", gap: fs(20) }}>
          <div style={{ width: fs(84), height: fs(84), borderRadius: "50%", background: pal.ink, color: pal.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: st.display, fontWeight: 800, fontSize: fs(38) }}>
            {(brand.name || brand.handle).replace("@", "").slice(0, 1).toUpperCase()}
          </div>
          <div>
            {brand.name && <div style={{ fontFamily: st.body, fontWeight: 800, fontSize: fs(32), color: pal.ink }}>{brand.name}</div>}
            {brand.handle && <div style={{ fontFamily: st.label, fontSize: fs(26), color: pal.muted }}>{brand.handle}</div>}
          </div>
        </div>
      )}
    </Fit>
  );
}

// ---------- Slide ----------

// Which slides read as "on a photo" (white chrome).
export function onPhotoSlide(slide, style) {
  const st = styleOf(style);
  if (!slide?.image?.use) return false;
  if (slide.layout === "photo") return !["polaroid", "tilted"].includes(st.frame);
  if (slide.layout === "cover") return st.frame === "bleed";
  return false;
}

// For export: a slide still waiting for a photo becomes a clean text slide
// instead of showing the placeholder.
function withoutMissingPhoto(slide) {
  if (!slide?.image?.use || slide.img?.src) return slide;
  const layout = slide.layout === "photo" || slide.layout === "split" ? "statement" : slide.layout;
  return { ...slide, layout, image: { ...slide.image, use: false } };
}

export const Slide = forwardRef(function Slide({ slide: given, index, total, direction, brand, format = "4:5", goal, stepNo = 1, forExport = false }, ref) {
  const slide = forExport ? withoutMissingPhoto(given) : given;
  const fmt = FORMATS[format] || FORMATS["4:5"];
  const W = fmt.w;
  const H = fmt.h;
  const st = styleOf(direction?.style);
  const basePal = safePalette(direction?.palette, direction?.style);
  // Bold type alternates color fields on statements for rhythm.
  const invert = st.background === "flat" && slide.layout === "statement" && index % 2 === 0;
  const pal = invert ? { ...basePal, bg: basePal.ink, ink: basePal.bg, muted: mix(basePal.bg, basePal.ink, 0.25), accentText: basePal.accent } : basePal;
  useEffect(() => ensureFonts(direction?.style), [direction?.style]);
  const ctx = { st, pal, W, H, img: slide.img, treatment: direction?.treatment || "natural", brand, index, total, stepNo, goal, invert };
  const onPhoto = onPhotoSlide(slide, direction?.style);
  let body;
  switch (slide.layout) {
    case "cover":
      body = <Cover s={slide} ctx={ctx} />;
      break;
    case "photo":
      body = <PhotoSlide s={slide} ctx={ctx} />;
      break;
    case "split":
      body = <Split s={slide} ctx={ctx} />;
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
      <Chrome st={st} pal={pal} index={index} total={total} brand={brand} onPhoto={onPhoto} W={W} H={H} />
    </div>
  );
});

// A slide shown at any width; it keeps its real size inside and scales.
export function ScaledSlide({ width, format = "4:5", className, style, ...props }) {
  const fmt = FORMATS[format] || FORMATS["4:5"];
  const scale = width / fmt.w;
  return (
    <div className={className} style={{ width, height: fmt.h * scale, overflow: "hidden", position: "relative", ...style }}>
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
