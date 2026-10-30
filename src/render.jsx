import { FONTS, PALETTES } from "./data";
import { Icon } from "./icons";
import { initial } from "./store";

const h2r = (e) => {
  const t = parseInt(e.slice(1), 16);
  return [(t >> 16) & 255, (t >> 8) & 255, t & 255];
};

const r2h = (e) =>
  "#" +
  e
    .map((t) =>
      Math.round(Math.max(0, Math.min(255, t)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

const mix = (e, t, a) => {
  const r = h2r(e);
  const o = h2r(t);
  return r2h(r.map((i, s) => i * a + o[s] * (1 - a)));
};

const lum = (e) => {
  const [t, a, r] = h2r(e).map((o) => {
    o /= 255;
    if (o <= 0.03928) {
      return o / 12.92;
    } else {
      return Math.pow((o + 0.055) / 1.055, 2.4);
    }
  });
  return t * 0.2126 + a * 0.7152 + r * 0.0722;
};

export const contrast = (e, t) => {
  const a = lum(e);
  const r = lum(t);
  return (Math.max(a, r) + 0.05) / (Math.min(a, r) + 0.05);
};

export const bestOn = (e) =>
  contrast(e, "#ffffff") >= contrast(e, "#14121c") ? "#ffffff" : "#14121c";

export function ensureContrast(e, t, a = 3) {
  if (contrast(e, t) >= a) {
    return e;
  }
  const r = lum(t) > 0.5 ? "#000000" : "#ffffff";
  for (let o = 0.05; o <= 1.001; o += 0.05) {
    const i = mix(r, e, o);
    if (contrast(i, t) >= a) {
      return i;
    }
  }
  return r;
}

export function resolveTheme(e) {
  const t = PALETTES[e.pal] || PALETTES.candy;
  const a = FONTS[e.font] || FONTS.clean;
  const r = e.mode || "auto";
  const o = r === "dark" || (r === "auto" && !!t.dark);
  let i = t.bg;
  let s = t.ink;
  let l = t.soft;
  let u = "#ffffff";
  if (o && !t.dark) {
    i = "#111114";
    s = "#F3F3F6";
    l = "#25252C";
    u = "#1A1A20";
  } else if (o && t.dark) {
    u = t.soft;
  } else if (!o && t.dark) {
    i = "#F7F6FB";
    s = "#17142B";
    l = "#ECE9F7";
    u = "#ffffff";
  }
  const d = e.accent || t.p;
  const c = e.accent2 || t.a;
  const f = e.radius ?? 16;
  return {
    dark: o,
    bg: i,
    ink: s,
    soft: l,
    card: u,
    p: d,
    a: c,
    on: bestOn(d),
    onA: bestOn(c),
    mute: mix(s, i, 0.78),
    line: mix(s, i, 0.12),
    t1: mix(d, u, 0.16),
    t2: mix(c, u, 0.38),
    r: f,
    rs: Math.round(f * 0.6),
    rl: Math.round(f * 1.3),
    gap: e.density === "compact" ? 10 : 16,
    font: a.css,
  };
}

function themeVars(e) {
  const t = resolveTheme(e);
  return {
    "--p": t.p,
    "--a": t.a,
    "--bg": t.bg,
    "--ink": t.ink,
    "--soft": t.soft,
    "--card": t.card,
    "--on": t.on,
    "--onA": t.onA,
    "--mute": t.mute,
    "--line": t.line,
    "--t1": t.t1,
    "--t2": t.t2,
    "--r": t.r + "px",
    "--rs": t.rs + "px",
    "--rl": t.rl + "px",
    "--gap": t.gap + "px",
    "--font": t.font,
  };
}

const cardStyle = {
  background: "var(--card)",
  borderRadius: "var(--r)",
  border: "1px solid var(--line)",
};

const titleStyle = {
  fontFamily: "var(--font)",
  fontWeight: 700,
  fontSize: 19,
  margin: 0,
  letterSpacing: "-0.015em",
};

const muteStyle = {
  color: "var(--mute)",
};

const Title = ({ children }) => <h2 style={titleStyle}>{children}</h2>;

const Pill = ({ children, style }) => (
  <span
    style={{
      display: "inline-block",
      background: "var(--t1)",
      color: "var(--ink)",
      fontSize: 12,
      fontWeight: 700,
      padding: "3px 9px",
      borderRadius: 99,
      ...style,
    }}
  >
    {children}
  </span>
);

const Cta = ({ children, icon, go }) => (
  <div
    data-go={go}
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      background: "var(--p)",
      color: "var(--on)",
      fontFamily: "var(--font)",
      fontWeight: 700,
      fontSize: 16,
      padding: "15px 20px",
      borderRadius: "var(--rl)",
    }}
  >
    {children}
    {icon && <Icon name="ArrowRight" size={18} strokeWidth={2.4} />}
  </div>
);

function Art({ icon, size = 200 }) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      style={{
        display: "block",
      }}
      aria-hidden="true"
    >
      <circle
        cx="100"
        cy="100"
        r="96"
        fill="none"
        style={{
          stroke: "var(--line)",
        }}
        strokeWidth="1.5"
      />
      <circle
        cx="100"
        cy="100"
        r="72"
        style={{
          fill: "var(--t2)",
        }}
      />
      <circle
        cx="100"
        cy="100"
        r="48"
        style={{
          fill: "var(--p)",
        }}
      />
      <Icon
        name={icon}
        x={78}
        y={78}
        width={44}
        height={44}
        strokeWidth={2.2}
        style={{
          color: "var(--on)",
        }}
      />
      <circle
        cx="168"
        cy="52"
        r="7"
        style={{
          fill: "var(--a)",
        }}
      />
      <circle
        cx="30"
        cy="150"
        r="5"
        style={{
          fill: "var(--p)",
        }}
      />
    </svg>
  );
}

const BLOCKS = {
  header: ({ p }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 99,
          background: "var(--t1)",
          color: "var(--ink)",
          display: "grid",
          placeItems: "center",
          fontWeight: 700,
          fontSize: 17,
          fontFamily: "var(--font)",
        }}
      >
        {p.initial}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font)",
            fontWeight: 700,
            fontSize: 25,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          {p.title}
        </div>
        <div
          style={{
            ...muteStyle,
            fontSize: 14,
            fontWeight: 500,
            marginTop: 2,
          }}
        >
          {p.sub}
        </div>
      </div>
      <div
        data-go="toast:No new notifications"
        style={{
          width: 40,
          height: 40,
          borderRadius: 99,
          ...cardStyle,
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon name="Bell" size={19} />
      </div>
    </div>
  ),
  onboard: ({ p }) => (
    <div
      style={{
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 14,
        paddingBottom: 16,
      }}
    >
      <Art icon={p.icon} size={236} />
      <div
        style={{
          fontFamily: "var(--font)",
          fontWeight: 700,
          fontSize: 33,
          lineHeight: 1.08,
          letterSpacing: "-0.03em",
          padding: "0 6px",
        }}
      >
        {p.title}
      </div>
      <div
        style={{
          ...muteStyle,
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.45,
          padding: "0 12px",
        }}
      >
        {p.sub}
      </div>
      <div
        style={{
          display: "flex",
          gap: 6,
          margin: "2px 0 6px",
        }}
      >
        {[0, 1, 2].map((t) => (
          <span
            style={{
              width: t === 0 ? 22 : 7,
              height: 7,
              borderRadius: 99,
              background: t === 0 ? "var(--p)" : "var(--line)",
            }}
            key={t}
          />
        ))}
      </div>
      <div
        style={{
          alignSelf: "stretch",
        }}
      >
        <Cta icon={true} go="kind:home">
          {p.cta}
        </Cta>
      </div>
    </div>
  ),
  hero: ({ p }) => (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: "var(--p)",
        color: "var(--on)",
        borderRadius: "var(--rl)",
        padding: 20,
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -34,
          top: -34,
          width: 150,
          height: 150,
          borderRadius: 99,
          background: "var(--on)",
          opacity: 0.12,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 20,
          top: 20,
          opacity: 0.9,
        }}
      >
        <Icon name={p.icon} size={30} strokeWidth={2} />
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          opacity: 0.85,
        }}
      >
        {p.kicker}
      </div>
      <div
        style={{
          fontFamily: "var(--font)",
          fontWeight: 700,
          fontSize: 27,
          lineHeight: 1.08,
          letterSpacing: "-0.025em",
          margin: "6px 56px 6px 0",
        }}
      >
        {p.title}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 500,
          opacity: 0.92,
          marginBottom: 16,
        }}
      >
        {p.sub}
      </div>
      <div
        data-go="kind:detail"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "var(--on)",
          color: "var(--p)",
          fontWeight: 700,
          fontSize: 15,
          padding: "10px 16px",
          borderRadius: 99,
          fontFamily: "var(--font)",
        }}
      >
        {p.cta}
        <Icon name="ArrowRight" size={16} strokeWidth={2.6} />
      </div>
    </div>
  ),
  chips: ({ p }) => (
    <div
      style={{
        display: "flex",
        gap: 8,
        overflow: "hidden",
        margin: "0 -20px",
        padding: "2px 20px",
      }}
    >
      {p.items.map((t, a) => (
        <span
          style={{
            flexShrink: 0,
            padding: "8px 14px",
            borderRadius: 99,
            fontWeight: 600,
            fontSize: 14,
            background: a === p.active ? "var(--ink)" : "var(--card)",
            color: a === p.active ? "var(--bg)" : "var(--ink)",
            border:
              "1px solid " + (a === p.active ? "var(--ink)" : "var(--line)"),
          }}
          key={a}
        >
          {t}
        </span>
      ))}
    </div>
  ),
  search: ({ p }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        ...cardStyle,
        borderRadius: 99,
        padding: "13px 16px",
        ...muteStyle,
        fontSize: 16,
        fontWeight: 500,
      }}
    >
      <Icon name="Search" size={19} />
      {p.placeholder}
    </div>
  ),
  cards: ({ p }) => (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 10,
        }}
      >
        <Title>{p.title}</Title>
        <span
          style={{
            ...muteStyle,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          See all
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          overflow: "hidden",
          margin: "0 -20px",
          padding: "2px 20px 4px",
        }}
      >
        {p.items.map((t, a) => (
          <div
            data-go="kind:detail"
            style={{
              ...cardStyle,
              width: 156,
              flexShrink: 0,
              padding: 8,
            }}
            key={a}
          >
            <div
              style={{
                height: 88,
                borderRadius: "var(--rs)",
                background: "linear-gradient(135deg, var(--t1), var(--t2))",
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  background: "var(--card)",
                  color: "var(--ink)",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 99,
                }}
              >
                {t.tag}
              </span>
            </div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                margin: "9px 4px 0",
                lineHeight: 1.2,
              }}
            >
              {t.title}
            </div>
            <div
              style={{
                ...muteStyle,
                fontSize: 13,
                fontWeight: 500,
                margin: "2px 4px 4px",
              }}
            >
              {t.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
  list: ({ p }) => (
    <div>
      <div
        style={{
          marginBottom: 10,
        }}
      >
        <Title>{p.title}</Title>
      </div>
      <div
        style={{
          ...cardStyle,
          overflow: "hidden",
        }}
      >
        {p.items.map((t, a) => (
          <div
            data-go="kind:detail"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderTop: a ? "1px solid var(--line)" : "none",
            }}
            key={a}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--rs)",
                background: "var(--t1)",
                color: "var(--ink)",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontFamily: "var(--font)",
                fontSize: 17,
                flexShrink: 0,
              }}
            >
              {(t.title || "?")[0]}
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 15.5,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {t.title}
              </div>
              <div
                style={{
                  ...muteStyle,
                  fontSize: 13.5,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {t.sub}
              </div>
            </div>
            <span
              style={{
                ...muteStyle,
                fontSize: 13.5,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {t.meta}
            </span>
          </div>
        ))}
      </div>
    </div>
  ),
  stats: ({ p }) => (
    <div
      style={{
        ...cardStyle,
        display: "flex",
      }}
    >
      {p.items.map((t, a) => (
        <div
          style={{
            flex: 1,
            padding: "13px 14px",
            borderLeft: a ? "1px solid var(--line)" : "none",
          }}
          key={a}
        >
          <div
            style={{
              fontFamily: "var(--font)",
              fontWeight: 700,
              fontSize: 21,
              letterSpacing: "-0.02em",
            }}
          >
            {t.value}
          </div>
          <div
            style={{
              ...muteStyle,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {t.label}
          </div>
        </div>
      ))}
    </div>
  ),
  chart: ({ p }) => {
    const t = Math.max(...p.data, 1);
    const a = p.data.indexOf(t);
    const r = ["M", "T", "W", "T", "F", "S", "S", "M", "T"];
    return (
      <div
        style={{
          ...cardStyle,
          padding: 16,
        }}
      >
        <Title>{p.title}</Title>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            height: 120,
            marginTop: 14,
          }}
        >
          {p.data.map((o, i) => (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                height: "100%",
                gap: 6,
              }}
              key={i}
            >
              <div
                style={{
                  width: "100%",
                  height: `${Math.max(8, (o / t) * 86)}%`,
                  borderRadius: 8,
                  background: i === a ? "var(--p)" : "var(--t1)",
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  ...muteStyle,
                }}
              >
                {r[i % r.length]}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  },
  ring: ({ p }) => {
    const a = Math.PI * 2 * 42;
    const r = Math.max(0, Math.min(100, p.pct));
    return (
      <div
        style={{
          ...cardStyle,
          padding: 18,
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <svg width="108" height="108" viewBox="0 0 108 108" aria-hidden="true">
          <circle
            cx="54"
            cy="54"
            r={42}
            fill="none"
            style={{
              stroke: "var(--t1)",
            }}
            strokeWidth="11"
          />
          <circle
            cx="54"
            cy="54"
            r={42}
            fill="none"
            style={{
              stroke: "var(--p)",
            }}
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={`${(r / 100) * a} ${a}`}
            transform="rotate(-90 54 54)"
          />
        </svg>
        <div>
          <div
            style={{
              ...muteStyle,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {p.label}
          </div>
          <div
            style={{
              fontFamily: "var(--font)",
              fontWeight: 700,
              fontSize: 40,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
            }}
          >
            {p.value}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              marginTop: 2,
              ...muteStyle,
            }}
          >
            {p.sub}
          </div>
        </div>
      </div>
    );
  },
  detail: ({ p }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        flexGrow: 1,
      }}
    >
      <div
        style={{
          position: "relative",
          height: 250,
          background: "linear-gradient(160deg, var(--t1), var(--t2))",
          display: "grid",
          placeItems: "center",
          borderRadius: "var(--rl)",
        }}
      >
        <div
          style={{
            width: 112,
            height: 112,
            borderRadius: 99,
            background: "var(--card)",
            display: "grid",
            placeItems: "center",
            color: "var(--ink)",
          }}
        >
          <Icon name={p.icon} size={50} strokeWidth={1.8} />
        </div>
        <div
          data-go="back"
          style={{
            position: "absolute",
            left: 14,
            top: 14,
            width: 40,
            height: 40,
            borderRadius: 99,
            background: "var(--card)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name="ChevronLeft" size={21} strokeWidth={2.4} />
        </div>
        <div
          style={{
            position: "absolute",
            right: 14,
            top: 14,
            width: 40,
            height: 40,
            borderRadius: 99,
            background: "var(--card)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name="Heart" size={19} strokeWidth={2.2} />
        </div>
      </div>
      <div>
        <Pill>{p.tag}</Pill>
      </div>
      <div
        style={{
          fontFamily: "var(--font)",
          fontWeight: 700,
          fontSize: 31,
          lineHeight: 1.06,
          letterSpacing: "-0.03em",
        }}
      >
        {p.title}
      </div>
      <div
        style={{
          ...muteStyle,
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        {p.sub}
      </div>
      <div
        style={{
          fontSize: 16,
          lineHeight: 1.55,
          fontWeight: 500,
        }}
      >
        {p.body}
      </div>
      <div
        style={{
          flexGrow: 1,
        }}
      />
      <Cta icon={true} go="toast:Saved. A real app would do the thing here.">
        {p.cta}
      </Cta>
    </div>
  ),
  button: ({ p }) => <Cta go="toast:Button tapped">{p.label}</Cta>,
  form: ({ p }) => (
    <div
      style={{
        ...cardStyle,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <Title>{p.title}</Title>
      {p.fields.map((t, a) => (
        <div
          style={{
            background: "var(--bg)",
            border: "1px solid var(--line)",
            borderRadius: "var(--rs)",
            padding: "12px 14px",
            ...muteStyle,
            fontWeight: 500,
            fontSize: 15,
          }}
          key={a}
        >
          {t}
        </div>
      ))}
      <Cta go="toast:Sent. Thank you!">{p.cta}</Cta>
    </div>
  ),
  toggles: ({ p }) => (
    <div>
      <div
        style={{
          marginBottom: 10,
        }}
      >
        <Title>{p.title}</Title>
      </div>
      <div
        style={{
          ...cardStyle,
          overflow: "hidden",
        }}
      >
        {p.items.map((t, a) => (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "13px 16px",
              borderTop: a ? "1px solid var(--line)" : "none",
              fontWeight: 600,
              fontSize: 15.5,
            }}
            key={a}
          >
            {t.title}
            <span
              style={{
                width: 46,
                height: 28,
                borderRadius: 99,
                background: t.on ? "var(--p)" : "var(--line)",
                position: "relative",
                display: "inline-block",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: t.on ? 21 : 3,
                  width: 22,
                  height: 22,
                  borderRadius: 99,
                  background: t.on ? "var(--on)" : "var(--card)",
                }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  ),
  profile: ({ p }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          paddingTop: 4,
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 99,
            background: "var(--t1)",
            color: "var(--ink)",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font)",
            fontWeight: 700,
            fontSize: 38,
          }}
        >
          {(p.name || "?")[0]}
        </div>
        <div
          style={{
            fontFamily: "var(--font)",
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: "-0.02em",
            marginTop: 8,
          }}
        >
          {p.name}
        </div>
        <div
          style={{
            ...muteStyle,
            fontSize: 15,
            fontWeight: 500,
          }}
        >
          {p.sub}
        </div>
      </div>
      <div
        style={{
          ...cardStyle,
          display: "flex",
        }}
      >
        {p.stats.map((t, a) => (
          <div
            style={{
              flex: 1,
              padding: 12,
              textAlign: "center",
              borderLeft: a ? "1px solid var(--line)" : "none",
            }}
            key={a}
          >
            <div
              style={{
                fontFamily: "var(--font)",
                fontWeight: 700,
                fontSize: 20,
              }}
            >
              {t.value}
            </div>
            <div
              style={{
                ...muteStyle,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {t.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
};

function StatusBar() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 48,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        padding: "0 28px 8px",
        fontWeight: 600,
        fontSize: 15,
        zIndex: 3,
        pointerEvents: "none",
        background: "linear-gradient(var(--bg) 55%, transparent)",
      }}
    >
      <span>9:41</span>
      <span
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
          <rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" />
          <rect x="5" y="5" width="3" height="7" rx="1" fill="currentColor" />
          <rect
            x="10"
            y="2.5"
            width="3"
            height="9.5"
            rx="1"
            fill="currentColor"
          />
          <rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true">
          <rect
            x="0.5"
            y="0.5"
            width="22"
            height="11"
            rx="3.5"
            fill="none"
            stroke="currentColor"
            opacity=".5"
          />
          <rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" />
          <rect
            x="24"
            y="4"
            width="2"
            height="4"
            rx="1"
            fill="currentColor"
            opacity=".5"
          />
        </svg>
      </span>
    </div>
  );
}

function TabBar({ p, android }) {
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        padding: "0 6px",
        zIndex: 4,
        ...(android
          ? {
              left: 0,
              right: 0,
              bottom: 0,
              height: 72,
              borderRadius: 0,
              borderTop: "1px solid var(--line)",
              background: "var(--card)",
            }
          : {
              left: 16,
              right: 16,
              bottom: 22,
              height: 64,
              borderRadius: "var(--rl)",
              border: "1px solid var(--line)",
              background: "var(--card)",
              boxShadow: "0 8px 24px rgba(0,0,0,.08)",
            }),
      }}
    >
      {p.items.map((r, o) => (
        <div
          data-go={`tab:${o}`}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            padding: "7px 14px",
            borderRadius: "var(--r)",
            background: o === p.active ? "var(--t1)" : "transparent",
            color: o === p.active ? "var(--ink)" : "var(--mute)",
            minWidth: 64,
          }}
          key={o}
        >
          <Icon
            name={r.icon}
            size={21}
            strokeWidth={o === p.active ? 2.4 : 2}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {r.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export const BLOCK_LABELS = {
  header: "Header",
  onboard: "Welcome",
  hero: "Hero card",
  chips: "Chips",
  search: "Search",
  cards: "Card carousel",
  list: "List",
  stats: "Stats",
  chart: "Chart",
  ring: "Progress ring",
  detail: "Detail",
  button: "Button",
  form: "Form",
  toggles: "Toggles",
  profile: "Profile",
  tabbar: "Tab bar",
};

export function Screen({
  screen,
  theme,
  selectedId,
  onSelect,
  scroll = false,
  width = 390,
  height = 844,
  platform = "iOS",
  reveal = false,
  className,
}) {
  const c = screen.blocks.find((v) => v.type === "tabbar");
  const f = screen.blocks.filter((v) => v.type !== "tabbar");
  const p = !!onSelect;
  const h = platform === "Android";
  const sel = (v) => (g) => {
    g.stopPropagation();
    onSelect(v);
  };
  const chip = (v) => (
    <span
      style={{
        position: "absolute",
        top: -22,
        left: 0,
        background: "#FF4D1A",
        color: "#fff",
        fontSize: 12,
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 5,
        zIndex: 6,
        whiteSpace: "nowrap",
        fontFamily: "Inter, system-ui, sans-serif",
        lineHeight: 1.3,
      }}
    >
      {BLOCK_LABELS[v] || v}
    </span>
  );
  return (
    <div
      className={className}
      style={{
        ...themeVars(theme),
        width: width,
        height: height,
        position: "relative",
        overflow: "hidden",
        background: "var(--bg)",
        color: "var(--ink)",
        fontFamily: "var(--font)",
        fontWeight: 500,
        textAlign: "left",
      }}
    >
      <StatusBar />
      <div
        className="nosb"
        onClick={p ? () => onSelect(null) : undefined}
        style={{
          position: "absolute",
          inset: 0,
          overflowY: scroll ? "auto" : "hidden",
          padding: `58px 20px ${c ? (h ? 100 : 118) : 40}px`,
          display: "flex",
          flexDirection: "column",
          gap: "var(--gap)",
        }}
      >
        {f.map((v, g) => {
          const Comp = BLOCKS[v.type];
          if (!Comp) {
            return null;
          }
          const L = {
            flexShrink: 0,
            ...(v.type === "onboard" || v.type === "detail"
              ? {
                  flexGrow: 1,
                  display: "flex",
                  flexDirection: "column",
                }
              : {}),
            ...(reveal
              ? {
                  animation: `rise .55s cubic-bezier(.22,1,.36,1) ${Math.min(g, 8) * 60 + 40}ms both`,
                }
              : {}),
          };
          if (p) {
            return (
              <div
                className="blk"
                data-block={v.id}
                data-sel={selectedId === v.id}
                onClick={sel(v.id)}
                style={L}
                key={v.id}
              >
                {selectedId === v.id && chip(v.type)}
                <Comp p={v.props} />
              </div>
            );
          } else {
            return (
              <div style={L} key={v.id}>
                <Comp p={v.props} />
              </div>
            );
          }
        })}
      </div>
      {c &&
        (p ? (
          <div
            className="blk"
            data-block={c.id}
            data-sel={selectedId === c.id}
            onClick={sel(c.id)}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: h ? 72 : 108,
              zIndex: 4,
              borderRadius: 0,
            }}
          >
            {selectedId === c.id && (
              <span
                style={{
                  position: "absolute",
                  top: -22,
                  left: 12,
                  background: "#FF4D1A",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "2px 7px",
                  borderRadius: 5,
                  zIndex: 6,
                }}
              >
                Tab bar
              </span>
            )}
            <TabBar p={c.props} android={h} />
          </div>
        ) : (
          <TabBar p={c.props} android={h} />
        ))}
      {!h && (
        <div
          style={{
            position: "absolute",
            bottom: 7,
            left: "50%",
            marginLeft: -67,
            width: 134,
            height: 5,
            borderRadius: 9,
            background: "var(--ink)",
            opacity: 0.3,
            zIndex: 5,
          }}
        />
      )}
    </div>
  );
}

export function Scaled({ scale = 0.4, w = 390, h = 844, children, style }) {
  return (
    <div
      style={{
        width: w * scale,
        height: h * scale,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        style={{
          width: w,
          height: h,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          left: 0,
          top: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function Frame({ w = 390, h = 844, scale = 0.6, children, bezel = 6 }) {
  const i = Math.max(10, (w > 600 ? 26 : 44) * scale);
  return (
    <div
      style={{
        width: w * scale + bezel * 2,
        height: h * scale + bezel * 2,
        borderRadius: i + bezel,
        background: "#16161A",
        padding: bezel,
        boxShadow:
          "0 1px 2px rgba(20,20,26,.2), 0 18px 40px -12px rgba(20,20,26,.28)",
        flexShrink: 0,
      }}
    >
      <Scaled
        scale={scale}
        w={w}
        h={h}
        style={{
          borderRadius: i,
        }}
      >
        {children}
      </Scaled>
    </div>
  );
}
