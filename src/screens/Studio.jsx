import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Command,
  Copy,
  Download,
  Ellipsis,
  Eye as EyeIcon,
  FolderOpen,
  History as HistoryIcon,
  Image as ImageIcon,
  Keyboard,
  LayoutGrid,
  Moon,
  Palette,
  Pencil,
  Pipette,
  Play as PlayIcon,
  Plus,
  Redo2,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  Smartphone,
  Sparkles,
  Square as SquareIcon,
  Star,
  Sun,
  Trash2,
  TriangleAlert,
  Type,
  Undo2,
  WandSparkles,
} from "lucide-react";
import {
  Button,
  EASE,
  Field,
  IconButton,
  Label,
  Menu,
  SPRING,
  Segmented,
  Select,
  Switch,
  cx,
  fireBurst,
  useMedia,
} from "../ui";
import { extractColors } from "../imagecolors";
import {
  BLOCK_LABELS,
  Frame,
  Scaled,
  Screen,
  contrast,
  ensureContrast,
  resolveTheme,
} from "../render";
import { useProject, useStore } from "../store";
import { SUGGESTIONS, respond } from "../ai";
import { BLOCK_TYPES, DEVICES, FONTS, PALETTES } from "../data";
import {
  insertBlock,
  makeScreen,
  newBlock,
  setPath,
  shuffleLayout,
  uid,
} from "../gen";
import { Logo } from "./Home";
import { Icon } from "../icons";
import { CommandPalette } from "../palette";
import { Present } from "../play";

const FIELD_LABELS = {
  title: "Title",
  sub: "Subtitle",
  kicker: "Small label",
  cta: "Button text",
  placeholder: "Placeholder",
  label: "Label",
  value: "Value",
  name: "Name",
  body: "Description",
  tag: "Tag",
  meta: "Right side",
};

const SKIP_KEYS = ["icon", "initial", "variant", "step", "active"];

const isTyping = (e) => {
  const t = e.target;
  return (
    t &&
    (t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "SELECT" ||
      t.isContentEditable)
  );
};

function Fields({ block, update }) {
  const a = block.props;
  const r = [];
  Object.entries(a).forEach(([o, i]) => {
    if (!SKIP_KEYS.includes(o)) {
      if (typeof i == "string") {
        r.push(
          <Field
            label={FIELD_LABELS[o] || o}
            value={i}
            multiline={o === "body"}
            onChange={(s) => update([o], s)}
            key={o}
          />,
        );
      } else if (typeof i == "number" && o === "pct") {
        r.push(
          <label className="block" key={o}>
            <span className="mb-1 flex justify-between text-xs font-medium text-[#62626A]">
              <span>Progress</span>
              <span>{i}%</span>
            </span>
            <input
              className="rng"
              type="range"
              min="0"
              max="100"
              value={i}
              aria-label="Progress"
              onChange={(s) => update([o], +s.target.value)}
            />
          </label>,
        );
      } else if (Array.isArray(i)) {
        if (typeof i[0] == "string") {
          i.forEach((s, l) =>
            r.push(
              <Field
                label={`${o === "items" ? "Chip" : o === "fields" ? "Field" : FIELD_LABELS[o] || o} ${l + 1}`}
                value={s}
                onChange={(u) => update([o, l], u)}
                key={o + l}
              />,
            ),
          );
        } else if (typeof i[0] == "number") {
          r.push(
            <div key={o}>
              <div className="mb-1 text-xs font-medium text-[#62626A]">
                Values
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {i.map((s, l) => (
                  <input
                    aria-label={`Value ${l + 1}`}
                    type="number"
                    value={s}
                    onChange={(u) => update([o, l], +u.target.value || 0)}
                    className="w-full min-w-0 rounded-lg border border-[#E6E5E0] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#16161A]"
                    key={l}
                  />
                ))}
              </div>
            </div>,
          );
        } else {
          i.forEach((s, l) =>
            r.push(
              <div
                className="grid grid-cols-[minmax(0,1fr)] gap-2 rounded-xl border border-[#E6E5E0] bg-[#FAFAF8] p-3"
                key={o + l}
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-[#62626A]">
                  Item {l + 1}
                </div>
                {Object.entries(s).map(([u, d]) =>
                  typeof d == "string" && !SKIP_KEYS.includes(u) ? (
                    <Field
                      label={FIELD_LABELS[u] || u}
                      value={d}
                      onChange={(c) => update([o, l, u], c)}
                      key={u}
                    />
                  ) : typeof d == "boolean" ? (
                    <div
                      className="flex items-center justify-between text-sm font-medium"
                      key={u}
                    >
                      Switched on
                      <Switch
                        on={d}
                        label="Toggle"
                        onChange={(c) => update([o, l, u], c)}
                      />
                    </div>
                  ) : null,
                )}
              </div>,
            ),
          );
        }
      }
    }
  });
  return <div className="grid grid-cols-[minmax(0,1fr)] gap-3">{r}</div>;
}

function ImagePalette({ onPrimary, onAccent, toast }) {
  const [r, o] = useState(null);
  const [i, s] = useState(false);
  const l = useRef(null);
  return (
    <div>
      <input
        ref={l}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choose an image"
        onChange={async (d) => {
          const c = d.target.files?.[0];
          d.target.value = "";
          if (c) {
            s(true);
            try {
              const f = await extractColors(c);
              if (!f.length) {
                toast("No colors found in that image");
              }
              o(f);
            } catch {
              toast("Couldn't read that image");
            }
            s(false);
          }
        }}
      />
      <Button
        variant="secondary"
        full={true}
        icon={Pipette}
        onClick={() => l.current?.click()}
        disabled={i}
      >
        {i ? "Reading image…" : "Pull colors from an image"}
      </Button>
      <AnimatePresence initial={false}>
        {r && r.length > 0 && (
          <motion.div
            initial={{
              opacity: 0,
              height: 0,
            }}
            animate={{
              opacity: 1,
              height: "auto",
            }}
            exit={{
              opacity: 0,
              height: 0,
            }}
            className="overflow-hidden"
          >
            <div className="mt-3 grid grid-cols-5 gap-2">
              {r.map((d, c) => (
                <motion.div
                  initial={{
                    scale: 0.6,
                    opacity: 0,
                  }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                  }}
                  transition={{
                    delay: c * 0.05,
                    ...SPRING,
                  }}
                  className="grid justify-items-center gap-1"
                  key={d}
                >
                  <button
                    aria-label={`Use ${d} as primary`}
                    onClick={() => onPrimary(d)}
                    className="h-10 w-full rounded-lg border border-black/10 transition-transform hover:scale-105"
                    style={{
                      background: d,
                    }}
                  />
                  <button
                    aria-label={`Use ${d} as accent`}
                    onClick={() => onAccent(d)}
                    className="text-xs font-medium text-[#62626A] underline"
                  >
                    accent
                  </button>
                </motion.div>
              ))}
            </div>
            <p className="mt-2 text-xs text-[#62626A]">
              Tap a swatch for the primary color, or “accent” for the secondary
              one. The image never leaves this device.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const VISION_SIMS = {
  none: {
    label: "Normal vision",
    m: null,
  },
  protanopia: {
    label: "Protanopia (no red)",
    m: "0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0",
  },
  deuteranopia: {
    label: "Deuteranopia (no green)",
    m: "0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0",
  },
  tritanopia: {
    label: "Tritanopia (no blue)",
    m: "0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0",
  },
  gray: {
    label: "Grayscale",
    m: "0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0",
  },
};

function Checks({ p, fix }) {
  const a = resolveTheme(p.theme);
  const r = [
    {
      k: "body",
      label: "Body text on background",
      fg: a.ink,
      bg: a.bg,
      need: 4.5,
    },
    {
      k: "muted",
      label: "Secondary text on background",
      fg: a.mute,
      bg: a.bg,
      need: 4.5,
    },
    {
      k: "card",
      label: "Secondary text on cards",
      fg: a.mute,
      bg: a.card,
      need: 4.5,
    },
    {
      k: "btn",
      label: "Text on primary buttons",
      fg: a.on,
      bg: a.p,
      need: 4.5,
    },
    {
      k: "ui",
      label: "Primary color on background",
      fg: a.p,
      bg: a.bg,
      need: 3,
      fixable: true,
      hint: "Icons and controls need 3:1",
    },
    {
      k: "chip",
      label: "Text on accent color",
      fg: a.onA,
      bg: a.a,
      need: 4.5,
    },
  ].map((s) => ({
    ...s,
    ratio: contrast(s.fg, s.bg),
  }));
  const o = r.filter((s) => s.ratio < s.need);
  const i = r.length - o.length;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div
        className={cx(
          "flex items-center gap-3.5 rounded-xl px-3.5 py-3",
          o.length
            ? "bg-[#FEF3E6] text-[#8A4B08]"
            : "bg-[#E7F6EF] text-[#0B6B48]",
        )}
      >
        <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
          <circle
            cx="26"
            cy="26"
            r="21"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".18"
            strokeWidth="5"
          />
          <motion.circle
            cx="26"
            cy="26"
            r="21"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            transform="rotate(-90 26 26)"
            initial={{
              pathLength: 0,
            }}
            animate={{
              pathLength: i / r.length,
            }}
            transition={{
              duration: 0.9,
              ease: EASE,
            }}
            key={i}
          />
          <text
            x="26"
            y="31"
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill="currentColor"
          >
            {i}/{r.length}
          </text>
        </svg>
        <div className="text-sm font-semibold leading-snug">
          {o.length
            ? `${o.length} contrast ${o.length === 1 ? "issue" : "issues"} to look at`
            : "Contrast looks good everywhere"}
        </div>
      </div>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {r.map((s) => {
          const l = s.ratio >= s.need;
          return (
            <li
              className="flex items-center gap-3 rounded-xl border border-[#E6E5E0] p-2.5"
              key={s.k}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E6E5E0] text-sm font-bold"
                style={{
                  background: s.bg,
                  color: s.fg,
                }}
              >
                Aa
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {s.label}
                </span>
                <span className="block text-xs text-[#62626A]">
                  {s.ratio.toFixed(1)}:1 · needs {s.need}:1
                </span>
              </span>
              {l ? (
                <Check size={17} className="text-[#0B6B48]" strokeWidth={2.6} />
              ) : s.fixable ? (
                <Button size="sm" variant="secondary" onClick={fix}>
                  Fix
                </Button>
              ) : (
                <TriangleAlert size={17} className="text-[#B45309]" />
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs leading-relaxed text-[#62626A]">
        Checks use the WCAG contrast formula on the current palette and
        appearance. Smallest text in generated screens is 12 px.
      </p>
    </div>
  );
}

export function Studio() {
  const { s: e, api } = useStore();
  const a = useProject();
  const r = useMedia("(min-width: 1024px)");
  const [o, i] = useState(0);
  const [s, l] = useState(1);
  const [u, d] = useState(null);
  const [c, f] = useState("edit");
  const [p, h] = useState(false);
  const [x, S] = useState("one");
  const v = x === "all";
  const setOverview = (C) => S(C ? "all" : "one");
  const [m, y] = useState("fit");
  const [L, A] = useState("none");
  const [E, I] = useState(false);
  const [P, R] = useState(false);
  const [b, M] = useState(false);
  const N = useRef(null);
  const [U, $] = useState({
    w: 600,
    h: 600,
  });
  const [re, Ue] = useState([
    {
      from: "ai",
      text: 'Tell me what to change, for example "dark mode" or "add a chart".',
      chips: SUGGESTIONS.slice(0, 4),
    },
  ]);
  const [oe, Le] = useState("");
  const Xe = useRef(null);
  const Ce = DEVICES.find((C) => C.k === e.data.prefs.device) || DEVICES[0];
  useLayoutEffect(() => {
    const C = N.current;
    if (!C) {
      return;
    }
    const D = new ResizeObserver(() => {
      const _ = C.getBoundingClientRect();
      $({
        w: _.width,
        h: _.height,
      });
    });
    D.observe(C);
    $({
      w: C.clientWidth,
      h: C.clientHeight,
    });
    return () => D.disconnect();
  }, [!!a]);
  useEffect(() => {
    Xe.current?.scrollIntoView({
      block: "end",
    });
  }, [re, c]);
  const vt = a
    ? e.hist[a.id] || {
        past: [],
        future: [],
      }
    : {
        past: [],
        future: [],
      };
  const dt = a ? a.screens.length : 0;
  const le = Math.min(o, Math.max(0, dt - 1));
  const pe = a ? a.screens[le] : null;
  const ke = (pe && pe.blocks.find((C) => C.id === u)) || null;
  const go = (C) => {
    if (!!a && !(C < 0) && !(C >= dt)) {
      l(C > le ? 1 : -1);
      i(C);
      d(null);
    }
  };
  const editScreen = (C, D) =>
    api.edit(
      a.id,
      (_) => ({
        ..._,
        screens: _.screens.map((J) => (J.id === pe.id ? C(J) : J)),
      }),
      {
        key: D,
      },
    );
  const theme = (C, D) =>
    api.edit(
      a.id,
      (_) => ({
        ..._,
        theme: {
          ..._.theme,
          ...C,
        },
      }),
      {
        key: D,
      },
    );
  const update = (C, D) =>
    editScreen(
      (_) => ({
        ..._,
        blocks: _.blocks.map((J) =>
          J.id === u
            ? {
                ...J,
                props: setPath(J.props, C, D),
              }
            : J,
        ),
      }),
      "t" + u + C.join("."),
    );
  const moveBlock = (C, D) =>
    editScreen((_) => {
      const J = _.blocks.slice();
      const _a = C + D;
      if (
        _a < 0 ||
        _a >= J.length ||
        J[_a].type === "tabbar" ||
        J[C].type === "tabbar"
      ) {
        return _;
      } else {
        [J[C], J[_a]] = [J[_a], J[C]];
        return {
          ..._,
          blocks: J,
        };
      }
    });
  const dupBlock = (C) =>
    editScreen((D) => {
      const _ = D.blocks.slice();
      const J = JSON.parse(JSON.stringify(_[C]));
      J.id = uid();
      _.splice(C + 1, 0, J);
      return {
        ...D,
        blocks: _,
      };
    });
  const delBlock = (C) => {
    const D = pe.blocks[C];
    editScreen((_) => ({
      ..._,
      blocks: _.blocks.filter((J, _a) => _a !== C),
    }));
    if (u === D.id) {
      d(null);
    }
    api.toast("Block removed", {
      action: {
        label: "Undo",
        run: () => api.undo(a.id),
      },
    });
  };
  const addBlock = (C) => {
    const D = newBlock(C, a.cat, a.name);
    editScreen((_) => insertBlock(_, D));
    d(D.id);
  };
  const select = (C) => {
    d(C);
    if (C) {
      f("edit");
      h(true);
    }
  };
  const delScreen = () => {
    if (dt < 2) {
      return;
    }
    const C = pe.id;
    api.edit(a.id, (D) => ({
      ...D,
      screens: D.screens.filter((_) => _.id !== C),
    }));
    i(Math.max(0, le - 1));
    d(null);
    api.toast("Screen deleted", {
      action: {
        label: "Undo",
        run: () => api.undo(a.id),
      },
    });
  };
  const dupScreen = () => {
    api.edit(a.id, (C) => {
      const D = JSON.parse(JSON.stringify(pe));
      D.id = uid();
      D.title = pe.title + " copy";
      D.blocks = D.blocks.map((J) => ({
        ...J,
        id: uid(),
      }));
      const _ = C.screens.slice();
      _.splice(le + 1, 0, D);
      return {
        ...C,
        screens: _,
      };
    });
    i(le + 1);
    api.toast("Screen duplicated");
  };
  const moveScreen = (C) => {
    const D = le + C;
    if (!(D < 0) && !(D >= dt)) {
      api.edit(a.id, (_) => {
        const J = _.screens.slice();
        [J[D], J[le]] = [J[le], J[D]];
        return {
          ..._,
          screens: J,
        };
      });
      i(D);
    }
  };
  const send = (C) => {
    const D = (C ?? oe).trim();
    if (D) {
      Le("");
      Ue((_) => [
        ..._,
        {
          from: "me",
          text: D,
        },
      ]);
      if (/^undo/i.test(D)) {
        api.undo(a.id);
        Ue((_) => [
          ..._,
          {
            from: "ai",
            text: "Undone.",
            chips: SUGGESTIONS.slice(0, 3),
          },
        ]);
        return;
      }
      Ue((_) => [
        ..._,
        {
          from: "ai",
          text: "…",
          typing: true,
        },
      ]);
      setTimeout(() => {
        const _ = respond(D, a, le);
        _.edits.forEach((J) => api.edit(a.id, J.fn, {}));
        Ue((J) => [
          ...J.filter((_a) => !_a.typing),
          {
            from: "ai",
            text: _.text,
            chips: _.chips,
          },
        ]);
      }, 450);
    }
  };
  useEffect(() => {
    const h = (D) => {
      if (!a) {
        return;
      }
      const _ = D.metaKey || D.ctrlKey;
      if (_ && D.key.toLowerCase() === "k") {
        D.preventDefault();
        R((J) => !J);
        return;
      }
      if (_ && D.key.toLowerCase() === "z") {
        if (isTyping(D)) {
          return;
        }
        D.preventDefault();
        if (D.shiftKey) {
          api.redo(a.id);
        } else {
          api.undo(a.id);
        }
        return;
      }
      if (_ && D.key.toLowerCase() === "y") {
        if (isTyping(D)) {
          return;
        }
        D.preventDefault();
        api.redo(a.id);
        return;
      }
      if (!isTyping(D) && !_) {
        if (D.key.toLowerCase() === "p" && !E) {
          D.preventDefault();
          I(true);
        } else if (D.key === "ArrowLeft") {
          D.preventDefault();
          go(le - 1);
        } else if (D.key === "ArrowRight") {
          D.preventDefault();
          go(le + 1);
        } else if ((D.key === "Delete" || D.key === "Backspace") && u) {
          D.preventDefault();
          const J = pe.blocks.findIndex((_a) => _a.id === u);
          if (J >= 0) {
            delBlock(J);
          }
        } else if (D.key === "Escape") {
          if (u) {
            d(null);
          } else if (x !== "one") {
            S("one");
          }
        }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  useEffect(() => {
    if (!a) {
      api.home();
    }
  }, [a]);
  if (!a || !pe) {
    return null;
  }
  const Fr = resolveTheme(a.theme);
  const KP = Math.max(
    0.2,
    Math.min((U.w - 56) / (Ce.w + 12), (U.h - 56) / (Ce.h + 12), 1.1),
  );
  const XP = m === "fit" ? KP : m;
  const ZP = Math.max(0.25, Math.min(0.5, (U.h - 110) / 1036));
  const QP = L === "none" ? undefined : `url(#vis-${L})`;
  const YP = r ? 0.4 : 0.3;
  const JP = [
    ["edit", "Edit"],
    ["style", "Style"],
    ["ask", "Ask"],
    ["checks", "Checks"],
  ];
  const eT = [
    ...a.screens.map((C, D) => ({
      id: "go" + C.id,
      label: `Go to ${C.title}`,
      group: "Screens",
      icon: SquareIcon,
      hint: String(D + 1),
      run: () => {
        go(D);
        S("one");
      },
    })),
    {
      id: "play",
      label: "Play clickable prototype",
      group: "Preview",
      icon: PlayIcon,
      hint: "P",
      run: () => I(true),
    },
    {
      id: "mode",
      label: Fr.dark ? "Switch to light mode" : "Switch to dark mode",
      group: "Preview",
      icon: Fr.dark ? Sun : Moon,
      run: () =>
        theme({
          mode: Fr.dark ? "light" : "dark",
        }),
    },
    ...DEVICES.map((C) => ({
      id: "dev" + C.k,
      label: `Preview on ${C.label}`,
      group: "Preview",
      icon: Smartphone,
      hint: `${C.w}\xD7${C.h}`,
      run: () =>
        api.pref({
          device: C.k,
        }),
    })),
    {
      id: "v1",
      label: "View: single screen",
      group: "Preview",
      icon: SquareIcon,
      run: () => S("one"),
    },
    {
      id: "v2",
      label: "View: all screens",
      group: "Preview",
      icon: LayoutGrid,
      run: () => S("all"),
    },
    {
      id: "v3",
      label: "View: compare devices side by side",
      group: "Preview",
      icon: Smartphone,
      run: () => S("devices"),
    },
    ...Object.entries(VISION_SIMS)
      .filter(([C]) => C !== "none")
      .map(([C, D]) => ({
        id: "vis" + C,
        label: `Simulate ${D.label}`,
        group: "Accessibility",
        icon: EyeIcon,
        run: () => A(C),
      })),
    {
      id: "vis0",
      label: "Normal vision",
      group: "Accessibility",
      icon: EyeIcon,
      run: () => A("none"),
    },
    {
      id: "checks",
      label: "Open contrast checks",
      group: "Accessibility",
      icon: ShieldCheck,
      run: () => {
        f("checks");
        h(true);
      },
    },
    ...BLOCK_TYPES.map(([C, D]) => ({
      id: "add" + C,
      label: `Add ${D}`,
      group: "Add to this screen",
      icon: Plus,
      run: () => addBlock(C),
    })),
    {
      id: "variations",
      label: "Explore style variations",
      group: "Style",
      icon: WandSparkles,
      run: () =>
        api.dialog("variations", {
          id: a.id,
          sIdx: le,
        }),
    },
    ...Object.entries(PALETTES).map(([C, D]) => ({
      id: "pal" + C,
      label: `Palette: ${D.name}`,
      group: "Style",
      icon: Palette,
      run: () =>
        theme({
          pal: C,
          accent: null,
          accent2: null,
        }),
    })),
    ...Object.entries(FONTS).map(([C, D]) => ({
      id: "font" + C,
      label: `Font: ${D.name}`,
      group: "Style",
      icon: Type,
      run: () =>
        theme({
          font: C,
        }),
    })),
    {
      id: "shuf",
      label: "Shuffle layout",
      group: "This screen",
      icon: Shuffle,
      run: () => editScreen((C) => shuffleLayout(C)),
    },
    {
      id: "dup",
      label: "Duplicate screen",
      group: "This screen",
      icon: Copy,
      run: dupScreen,
    },
    {
      id: "hist",
      label: "Version history",
      group: "Project",
      icon: HistoryIcon,
      run: () =>
        api.dialog("history", {
          id: a.id,
        }),
    },
    {
      id: "export",
      label: "Export…",
      group: "Project",
      icon: Download,
      run: () =>
        api.dialog("export", {
          id: a.id,
        }),
    },
    {
      id: "shots",
      label: "App Store screenshots",
      group: "Project",
      icon: ImageIcon,
      run: () =>
        api.dialog("shots", {
          id: a.id,
        }),
    },
    {
      id: "undo",
      label: "Undo",
      group: "Project",
      icon: Undo2,
      hint: "⌘Z",
      run: () => api.undo(a.id),
    },
    {
      id: "redo",
      label: "Redo",
      group: "Project",
      icon: Redo2,
      hint: "⇧⌘Z",
      run: () => api.redo(a.id),
    },
    {
      id: "home",
      label: "All projects",
      group: "Project",
      icon: FolderOpen,
      run: api.home,
    },
  ];
  const gather = (C) => {
    if (c === C && !r) {
      h((D) => !D);
    } else {
      f(C);
      h(true);
    }
  };
  return (
    <div className="flex h-full flex-col bg-[#FAFAF8]">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-[#E6E5E0] bg-white px-2 sm:px-3">
        <Logo compact={true} onClick={api.home} />
        <span className="mx-0.5 text-[#C9C7BF]">/</span>
        {b ? (
          <input
            autoFocus={true}
            aria-label="Project name"
            defaultValue={a.name}
            maxLength={22}
            onBlur={(C) => {
              M(false);
              const D = C.target.value.trim();
              if (D && D !== a.name) {
                api.edit(a.id, (_) => ({
                  ..._,
                  name: D,
                }));
              }
            }}
            onKeyDown={(C) => {
              if (C.key === "Enter") {
                C.currentTarget.blur();
              }
              if (C.key === "Escape") {
                C.currentTarget.value = a.name;
                C.currentTarget.blur();
              }
            }}
            className="h-9 w-40 rounded-lg border border-[#16161A] px-2 text-sm font-semibold outline-none"
          />
        ) : (
          <button
            onClick={() => M(true)}
            aria-label="Rename project"
            className="flex h-9 max-w-[40vw] items-center gap-1.5 truncate rounded-lg px-2 text-sm font-semibold hover:bg-[#F2F1ED] sm:max-w-xs"
          >
            <span className="truncate">{a.name}</span>
            <Pencil size={13} className="shrink-0 text-[#62626A]" />
          </button>
        )}
        <span className="ml-1 hidden items-center gap-1 text-xs text-[#62626A] md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
          Saved
        </span>
        <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
          <IconButton
            icon={Undo2}
            label="Undo"
            disabled={!vt.past.length}
            onClick={() => api.undo(a.id)}
          />
          <IconButton
            icon={Redo2}
            label="Redo"
            className="hidden sm:inline-flex"
            disabled={!vt.future.length}
            onClick={() => api.redo(a.id)}
          />
          <IconButton
            icon={Command}
            label="Command palette (⌘K)"
            className="hidden sm:inline-flex"
            onClick={() => R(true)}
          />
          <Menu
            trigger={() => (
              <span
                role="button"
                tabIndex={0}
                aria-label="Project menu"
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg hover:bg-[#F2F1ED]"
              >
                <Ellipsis size={18} />
              </span>
            )}
            items={[
              {
                label: "Rename",
                icon: Pencil,
                onClick: () => M(true),
              },
              {
                label: a.fav ? "Remove star" : "Star project",
                icon: Star,
                onClick: () => api.fav(a.id),
              },
              {
                label: "Duplicate project",
                icon: Copy,
                onClick: () => api.dup(a.id),
              },
              {
                label: "Version history",
                icon: HistoryIcon,
                onClick: () =>
                  api.dialog("history", {
                    id: a.id,
                  }),
              },
              {
                label: "Keyboard shortcuts",
                icon: Keyboard,
                onClick: () => api.dialog("shortcuts"),
              },
              {
                sep: true,
              },
              {
                label: "All projects",
                icon: FolderOpen,
                onClick: api.home,
              },
              {
                label: "Delete project",
                icon: Trash2,
                danger: true,
                onClick: () => api.del(a.id),
              },
            ]}
          />
          <Button
            size="sm"
            variant="secondary"
            icon={PlayIcon}
            onClick={() => I(true)}
            className="ml-1"
            aria-label="Play prototype"
          >
            <span className="hidden sm:inline">Play</span>
          </Button>
          <Button
            size="sm"
            icon={Download}
            onClick={() =>
              api.dialog("export", {
                id: a.id,
              })
            }
          >
            Export
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {r && (
          <aside
            className="sb flex w-60 shrink-0 flex-col border-r border-[#E6E5E0] bg-white"
            aria-label="Screens"
          >
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <Label tight={true}>Screens</Label>
              <span className="text-xs text-[#62626A]">{dt}</span>
            </div>
            <Reorder.Group
              axis="y"
              values={a.screens}
              onReorder={(C) =>
                api.edit(
                  a.id,
                  (D) => ({
                    ...D,
                    screens: C,
                  }),
                  {
                    key: "reorder",
                  },
                )
              }
              className="sb m-0 min-h-0 flex-1 list-none overflow-y-auto px-3 pb-3"
            >
              {a.screens.map((C, D) => (
                <Reorder.Item
                  value={C}
                  as="li"
                  className="mb-2 list-none"
                  key={C.id}
                >
                  <button
                    onClick={() => {
                      go(D);
                      setOverview(false);
                    }}
                    aria-label={`Screen ${D + 1}: ${C.title}`}
                    aria-current={D === le}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors",
                      D === le
                        ? "border-[#16161A] bg-[#FAFAF8]"
                        : "border-transparent hover:bg-[#F7F6F3]",
                    )}
                  >
                    <span className="overflow-hidden rounded-md border border-[#E6E5E0]">
                      <Scaled scale={0.14}>
                        <Screen screen={C} theme={a.theme} platform={Ce.plat} />
                      </Scaled>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {C.title}
                      </span>
                      <span className="block text-xs text-[#62626A]">
                        {D + 1} of {dt}
                      </span>
                    </span>
                  </button>
                </Reorder.Item>
              ))}
            </Reorder.Group>
            <div className="border-t border-[#E6E5E0] p-3">
              <Button
                variant="secondary"
                full={true}
                icon={Plus}
                onClick={() =>
                  api.dialog("addscreen", {
                    id: a.id,
                  })
                }
              >
                Add screen
              </Button>
            </div>
          </aside>
        )}
        <section
          className="flex min-h-0 min-w-0 flex-1 flex-col"
          aria-label="Canvas"
        >
          {!r && (
            <div className="nosb flex shrink-0 gap-2 overflow-x-auto border-b border-[#E6E5E0] bg-white px-3 py-2">
              {a.screens.map((C, D) => (
                <button
                  onClick={() => {
                    go(D);
                    setOverview(false);
                  }}
                  aria-current={D === le}
                  className={cx(
                    "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium",
                    D === le
                      ? "border-[#16161A] bg-[#16161A] text-white"
                      : "border-[#E6E5E0] bg-white",
                  )}
                  key={C.id}
                >
                  {C.title}
                </button>
              ))}
              <button
                onClick={() =>
                  api.dialog("addscreen", {
                    id: a.id,
                  })
                }
                aria-label="Add screen"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-[#B9B7AE]"
              >
                <Plus size={16} />
              </button>
            </div>
          )}
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b border-[#E6E5E0] bg-white px-3 py-2 sm:justify-between">
            <div className="hidden items-center gap-1 sm:flex">
              <IconButton
                icon={ChevronLeft}
                label="Previous screen"
                disabled={le === 0}
                onClick={() => go(le - 1)}
              />
              <span className="min-w-14 text-center text-sm font-medium tabular-nums">
                {le + 1} / {dt}
              </span>
              <IconButton
                icon={ChevronRight}
                label="Next screen"
                disabled={le === dt - 1}
                onClick={() => go(le + 1)}
              />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Select
                label="Preview device"
                value={Ce.k}
                onChange={(C) =>
                  api.pref({
                    device: C,
                  })
                }
                options={DEVICES.map((C) => ({
                  value: C.k,
                  label: C.label,
                }))}
              />
              <Segmented
                id="mode"
                value={Fr.dark ? "dark" : "light"}
                onChange={(C) =>
                  theme({
                    mode: C,
                  })
                }
                options={[
                  {
                    value: "light",
                    aria: "Light appearance",
                    icon: <Sun size={15} />,
                  },
                  {
                    value: "dark",
                    aria: "Dark appearance",
                    icon: <Moon size={15} />,
                  },
                ]}
              />
              <Menu
                align="right"
                trigger={() => (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="View options"
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#E6E5E0] bg-white px-3 text-sm font-medium hover:bg-[#F7F6F3]"
                  >
                    <EyeIcon size={15} />
                    {m === "fit" ? "Fit" : Math.round(m * 100) + "%"}
                    {L !== "none" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#FF4D1A]" />
                    )}
                  </span>
                )}
                items={[
                  {
                    heading: "Zoom",
                  },
                  ...[
                    ["fit", "Fit to screen"],
                    [0.5, "50%"],
                    [0.75, "75%"],
                    [1, "100%"],
                  ].map(([C, D]) => ({
                    label: D,
                    checked: m === C,
                    onClick: () => {
                      y(C);
                      S("one");
                    },
                  })),
                  {
                    sep: true,
                  },
                  {
                    heading: "Simulate vision",
                  },
                  ...Object.entries(VISION_SIMS).map(([C, D]) => ({
                    label: D.label,
                    checked: L === C,
                    onClick: () => A(C),
                  })),
                ]}
              />
              <Segmented
                id="view"
                value={x}
                onChange={S}
                options={[
                  {
                    value: "one",
                    aria: "Single screen",
                    icon: <SquareIcon size={15} />,
                  },
                  {
                    value: "all",
                    aria: "All screens",
                    icon: <LayoutGrid size={15} />,
                  },
                  {
                    value: "devices",
                    aria: "Compare devices",
                    icon: <Smartphone size={15} />,
                  },
                ]}
              />
            </div>
          </div>
          <div
            ref={N}
            onClick={() => d(null)}
            className="canvasbg relative min-h-0 flex-1 overflow-hidden"
          >
            <svg width="0" height="0" className="absolute" aria-hidden="true">
              <defs>
                {Object.entries(VISION_SIMS)
                  .filter(([, C]) => C.m)
                  .map(([C, D]) => (
                    <filter
                      id={"vis-" + C}
                      colorInterpolationFilters="sRGB"
                      key={C}
                    >
                      <feColorMatrix type="matrix" values={D.m} />
                    </filter>
                  ))}
              </defs>
            </svg>
            <div
              className="absolute inset-0"
              style={{
                filter: QP,
                transition: "filter .3s",
              }}
            >
              {x === "one" && (
                <div className="sb absolute inset-0 overflow-auto">
                  <div className="flex min-h-full min-w-full items-center justify-center p-7">
                    <AnimatePresence
                      mode="popLayout"
                      custom={s}
                      initial={false}
                    >
                      <motion.div
                        custom={s}
                        initial={{
                          opacity: 0,
                          x: s * 40,
                          scale: 0.985,
                        }}
                        animate={{
                          opacity: 1,
                          x: 0,
                          scale: 1,
                        }}
                        exit={{
                          opacity: 0,
                          x: -s * 40,
                        }}
                        transition={{
                          duration: 0.3,
                          ease: EASE,
                        }}
                        key={pe.id + Ce.k}
                      >
                        <Frame w={Ce.w} h={Ce.h} scale={XP}>
                          <Screen
                            screen={pe}
                            theme={a.theme}
                            selectedId={u}
                            onSelect={select}
                            scroll={true}
                            reveal={true}
                            width={Ce.w}
                            height={Ce.h}
                            platform={Ce.plat}
                          />
                        </Frame>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              )}
              {x === "all" && (
                <div className="sb absolute inset-0 overflow-auto p-6">
                  <div className="mx-auto flex w-fit max-w-full flex-wrap justify-center gap-x-8 gap-y-8">
                    {a.screens.map((C, D) => (
                      <motion.button
                        initial={{
                          opacity: 0,
                          y: 18,
                          scale: 0.96,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          scale: 1,
                        }}
                        transition={{
                          delay: D * 0.05,
                          duration: 0.4,
                          ease: EASE,
                        }}
                        whileHover={{
                          y: -4,
                        }}
                        onClick={(_) => {
                          _.stopPropagation();
                          go(D);
                          S("one");
                        }}
                        aria-label={`Open ${C.title}`}
                        className="group text-center"
                        key={C.id}
                      >
                        <div
                          className={cx(
                            "rounded-[34px] transition-shadow",
                            D === le && "shadow-[0_0_0_3px_#FF4D1A]",
                          )}
                        >
                          <Frame w={Ce.w} h={Ce.h} scale={YP} bezel={4}>
                            <Screen
                              screen={C}
                              theme={a.theme}
                              width={Ce.w}
                              height={Ce.h}
                              platform={Ce.plat}
                            />
                          </Frame>
                        </div>
                        <div className="mt-2.5 text-sm font-semibold">
                          {C.title}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
              {x === "devices" && (
                <div className="sb absolute inset-0 overflow-auto p-6">
                  <div className="mx-auto flex w-fit max-w-full flex-wrap items-end justify-center gap-x-8 gap-y-8">
                    {DEVICES.map((C, D) => (
                      <motion.button
                        initial={{
                          opacity: 0,
                          y: 20,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        transition={{
                          delay: D * 0.07,
                          duration: 0.45,
                          ease: EASE,
                        }}
                        whileHover={{
                          y: -4,
                        }}
                        onClick={(_) => {
                          _.stopPropagation();
                          api.pref({
                            device: C.k,
                          });
                          S("one");
                        }}
                        aria-label={`Preview on ${C.label}`}
                        className="text-center"
                        key={C.k}
                      >
                        <div
                          className={cx(
                            "rounded-[34px] transition-shadow",
                            C.k === Ce.k && "shadow-[0_0_0_3px_#FF4D1A]",
                          )}
                        >
                          <Frame w={C.w} h={C.h} scale={ZP} bezel={5}>
                            <Screen
                              screen={pe}
                              theme={a.theme}
                              width={C.w}
                              height={C.h}
                              platform={C.plat}
                            />
                          </Frame>
                        </div>
                        <div className="mt-2.5 text-sm font-semibold">
                          {C.label}
                        </div>
                        <div className="text-xs text-[#62626A]">
                          {C.w} × {C.h} · {C.plat}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
        <aside
          aria-label="Inspector"
          className={cx(
            "flex shrink-0 flex-col border-[#E6E5E0] bg-white transition-[height] duration-300 lg:h-auto lg:w-80 lg:border-l",
            "border-t lg:border-t-0",
            p ? "h-[46dvh]" : "h-[53px]",
          )}
        >
          <div
            role="tablist"
            className="flex shrink-0 border-b border-[#E6E5E0]"
          >
            {JP.map(([C, D]) => {
              const _ = c === C && (r || p);
              return (
                <button
                  role="tab"
                  aria-selected={_}
                  onClick={() => gather(C)}
                  className={cx(
                    "relative flex h-[52px] flex-1 items-center justify-center gap-1.5 text-sm font-medium",
                    _
                      ? "text-[#16161A]"
                      : "text-[#62626A] hover:text-[#16161A]",
                  )}
                  key={C}
                >
                  {D}
                  {_ && (
                    <motion.span
                      layoutId="itab"
                      transition={SPRING}
                      className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#16161A]"
                    />
                  )}
                </button>
              );
            })}
            {!r && (
              <button
                onClick={() => h((C) => !C)}
                aria-label={p ? "Collapse panel" : "Expand panel"}
                className="flex h-[52px] w-11 items-center justify-center text-[#62626A]"
              >
                {p ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            )}
          </div>
          <div
            className={cx("flex min-h-0 flex-1 flex-col", !r && !p && "hidden")}
          >
            <motion.div
              initial={{
                opacity: 0,
                y: 6,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.2,
                ease: EASE,
              }}
              className="flex min-h-0 flex-1 flex-col"
              key={c}
            >
              {c === "edit" && (
                <div className="sb min-h-0 flex-1 overflow-y-auto p-4">
                  {ke ? (
                    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
                      <div className="flex items-center justify-between">
                        <div className="display text-lg font-semibold">
                          {BLOCK_LABELS[ke.type] || ke.type}
                        </div>
                        <div className="flex items-center">
                          <IconButton
                            icon={ArrowUp}
                            label="Move up"
                            onClick={() => moveBlock(pe.blocks.indexOf(ke), -1)}
                          />
                          <IconButton
                            icon={ArrowDown}
                            label="Move down"
                            onClick={() => moveBlock(pe.blocks.indexOf(ke), 1)}
                          />
                          <IconButton
                            icon={Copy}
                            label="Duplicate block"
                            onClick={() => dupBlock(pe.blocks.indexOf(ke))}
                          />
                          <IconButton
                            icon={Trash2}
                            label="Delete block"
                            onClick={() => delBlock(pe.blocks.indexOf(ke))}
                          />
                        </div>
                      </div>
                      <Fields block={ke} update={update} />
                      <Button variant="secondary" onClick={() => d(null)}>
                        Done
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
                      <Field
                        label="Screen name"
                        value={pe.title}
                        onChange={(C) =>
                          editScreen(
                            (D) => ({
                              ...D,
                              title: C,
                            }),
                            "title",
                          )
                        }
                      />
                      <div>
                        <Label>Blocks</Label>
                        <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
                          {pe.blocks.map((C, D) => (
                            <div
                              className="flex items-center gap-1 rounded-lg border border-[#E6E5E0] py-1 pl-3 pr-1"
                              key={C.id}
                            >
                              <button
                                onClick={() => select(C.id)}
                                className="flex-1 truncate py-1 text-left text-sm font-medium"
                              >
                                {BLOCK_LABELS[C.type] || C.type}
                              </button>
                              <IconButton
                                icon={ArrowUp}
                                label={`Move ${BLOCK_LABELS[C.type]} up`}
                                size={30}
                                onClick={() => moveBlock(D, -1)}
                              />
                              <IconButton
                                icon={ArrowDown}
                                label={`Move ${BLOCK_LABELS[C.type]} down`}
                                size={30}
                                onClick={() => moveBlock(D, 1)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label>Add a block</Label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {BLOCK_TYPES.map(([C, D, _]) => (
                            <button
                              onClick={() => addBlock(C)}
                              className="flex items-center gap-2 rounded-lg border border-[#E6E5E0] px-2.5 py-2 text-left text-sm font-medium hover:bg-[#F7F6F3]"
                              key={C}
                            >
                              <Icon
                                name={_}
                                size={15}
                                className="shrink-0 text-[#62626A]"
                              />
                              {D}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label>This screen</Label>
                        <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
                          <Button
                            variant="secondary"
                            icon={Shuffle}
                            onClick={() => editScreen((C) => shuffleLayout(C))}
                          >
                            Shuffle layout
                          </Button>
                          <Button
                            variant="secondary"
                            icon={RotateCcw}
                            onClick={() => {
                              editScreen((C) => ({
                                ...makeScreen(C.kind, a.cat, a.name),
                                id: C.id,
                                title: C.title,
                              }));
                              d(null);
                            }}
                          >
                            Regenerate content
                          </Button>
                          <Button
                            variant="secondary"
                            icon={Copy}
                            onClick={dupScreen}
                          >
                            Duplicate
                          </Button>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Button
                              variant="secondary"
                              icon={ChevronLeft}
                              disabled={le === 0}
                              onClick={() => moveScreen(-1)}
                            >
                              Earlier
                            </Button>
                            <Button
                              variant="secondary"
                              iconRight={ChevronRight}
                              disabled={le === dt - 1}
                              onClick={() => moveScreen(1)}
                            >
                              Later
                            </Button>
                          </div>
                          <Button
                            variant="danger"
                            icon={Trash2}
                            disabled={dt < 2}
                            onClick={delScreen}
                          >
                            {dt < 2
                              ? "Keep at least one screen"
                              : "Delete screen"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {c === "style" && (
                <div className="sb min-h-0 flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
                    <Button
                      full={true}
                      icon={WandSparkles}
                      onClick={() =>
                        api.dialog("variations", {
                          id: a.id,
                          sIdx: le,
                        })
                      }
                    >
                      Explore variations
                    </Button>
                    <div>
                      <Label>Palette</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {Object.entries(PALETTES).map(([C, D]) => (
                          <button
                            aria-label={D.name}
                            aria-pressed={a.theme.pal === C}
                            onClick={() =>
                              theme({
                                pal: C,
                                accent: null,
                                accent2: null,
                              })
                            }
                            className={cx(
                              "grid justify-items-center gap-1.5 rounded-xl border p-2",
                              a.theme.pal === C
                                ? "border-[#16161A] bg-[#FAFAF8]"
                                : "border-[#E6E5E0] hover:bg-[#F7F6F3]",
                            )}
                            key={C}
                          >
                            <span
                              className="h-7 w-7 rounded-full border border-black/10"
                              style={{
                                background: `linear-gradient(135deg, ${D.p} 50%, ${D.a} 50%)`,
                              }}
                            />
                            <span className="text-xs font-medium">
                              {D.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label
                        right={
                          (a.theme.accent || a.theme.accent2) && (
                            <button
                              onClick={() =>
                                theme({
                                  accent: null,
                                  accent2: null,
                                })
                              }
                              className="text-xs font-medium text-[#62626A] underline"
                            >
                              Reset colors
                            </button>
                          )
                        }
                      >
                        Primary color
                      </Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="swatch"
                          aria-label="Pick primary color"
                          value={Fr.p}
                          onChange={(C) =>
                            theme(
                              {
                                accent: C.target.value,
                              },
                              "accent",
                            )
                          }
                        />
                        <div className="flex-1">
                          <Field
                            label="Hex"
                            mono={true}
                            value={a.theme.accent || Fr.p}
                            onChange={(C) => {
                              if (/^#[0-9a-fA-F]{6}$/.test(C)) {
                                theme(
                                  {
                                    accent: C,
                                  },
                                  "accent",
                                );
                              }
                            }}
                          />
                        </div>
                      </div>
                      <div className="mt-3">
                        <ImagePalette
                          toast={api.toast}
                          onPrimary={(C) => {
                            theme({
                              accent: C,
                            });
                            fireBurst();
                          }}
                          onAccent={(C) =>
                            theme({
                              accent2: C,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Appearance</Label>
                      <Segmented
                        full={true}
                        id="mode2"
                        value={Fr.dark ? "dark" : "light"}
                        onChange={(C) =>
                          theme({
                            mode: C,
                          })
                        }
                        options={[
                          {
                            value: "light",
                            label: "Light",
                            icon: <Sun size={15} />,
                          },
                          {
                            value: "dark",
                            label: "Dark",
                            icon: <Moon size={15} />,
                          },
                        ]}
                      />
                    </div>
                    <div>
                      <Label>Font</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(FONTS).map(([C, D]) => (
                          <button
                            aria-pressed={a.theme.font === C}
                            onClick={() =>
                              theme({
                                font: C,
                              })
                            }
                            className={cx(
                              "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left",
                              a.theme.font === C
                                ? "border-[#16161A] bg-[#FAFAF8]"
                                : "border-[#E6E5E0] hover:bg-[#F7F6F3]",
                            )}
                            key={C}
                          >
                            <span
                              style={{
                                fontFamily: D.css,
                              }}
                              className="text-2xl font-bold leading-none"
                            >
                              Aa
                            </span>
                            <span className="text-sm font-medium">
                              {D.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="block">
                      <Label
                        right={
                          <span className="text-xs text-[#62626A]">
                            {a.theme.radius}px
                          </span>
                        }
                      >
                        Corner radius
                      </Label>
                      <input
                        className="rng"
                        type="range"
                        min="0"
                        max="32"
                        value={a.theme.radius}
                        aria-label="Corner radius"
                        onChange={(C) =>
                          theme(
                            {
                              radius: +C.target.value,
                            },
                            "radius",
                          )
                        }
                      />
                    </label>
                    <div>
                      <Label>Spacing</Label>
                      <Segmented
                        full={true}
                        id="dens"
                        value={a.theme.density}
                        onChange={(C) =>
                          theme({
                            density: C,
                          })
                        }
                        options={[
                          {
                            value: "cozy",
                            label: "Comfortable",
                          },
                          {
                            value: "compact",
                            label: "Compact",
                          },
                        ]}
                      />
                    </div>
                    <Button
                      variant="secondary"
                      icon={Shuffle}
                      onClick={() => send("surprise me")}
                    >
                      Shuffle style
                    </Button>
                  </div>
                </div>
              )}
              {c === "ask" && (
                <>
                  <div className="sb min-h-0 flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
                      {re.map((C, D) => (
                        <motion.div
                          initial={{
                            opacity: 0,
                            y: 6,
                          }}
                          animate={{
                            opacity: 1,
                            y: 0,
                          }}
                          transition={{
                            duration: 0.2,
                          }}
                          className={cx(
                            "max-w-[92%]",
                            C.from === "me"
                              ? "justify-self-end"
                              : "justify-self-start",
                          )}
                          key={D}
                        >
                          <div
                            className={cx(
                              "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                              C.from === "me"
                                ? "rounded-br-md bg-[#16161A] text-white"
                                : "rounded-bl-md bg-[#F2F1ED]",
                            )}
                          >
                            {C.typing ? (
                              <span
                                className="inline-flex gap-1"
                                aria-label="Thinking"
                              >
                                {[0, 1, 2].map((_) => (
                                  <motion.span
                                    className="h-1.5 w-1.5 rounded-full bg-[#62626A]"
                                    animate={{
                                      opacity: [0.3, 1, 0.3],
                                    }}
                                    transition={{
                                      repeat: Infinity,
                                      duration: 0.9,
                                      delay: _ * 0.15,
                                    }}
                                    key={_}
                                  />
                                ))}
                              </span>
                            ) : (
                              C.text
                            )}
                          </div>
                          {C.chips && D === re.length - 1 && !C.typing && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {C.chips.map((_) => (
                                <button
                                  onClick={() => send(_)}
                                  className="rounded-full border border-[#E6E5E0] bg-white px-3 py-1.5 text-sm hover:bg-[#F7F6F3]"
                                  key={_}
                                >
                                  {_}
                                </button>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      ))}
                      <div ref={Xe} />
                    </div>
                  </div>
                  <form
                    onSubmit={(C) => {
                      C.preventDefault();
                      send();
                    }}
                    className="shrink-0 border-t border-[#E6E5E0] p-3"
                  >
                    <div className="flex gap-2">
                      <input
                        aria-label="Ask the assistant"
                        value={oe}
                        onChange={(C) => Le(C.target.value)}
                        placeholder="Ask for a change…"
                        className="h-10 min-w-0 flex-1 rounded-lg border border-[#E6E5E0] px-3 text-sm outline-none focus:border-[#16161A]"
                      />
                      <Button type="submit" icon={Sparkles}>
                        Go
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-[#62626A]">
                      Simulated assistant that runs on your device.
                    </p>
                  </form>
                </>
              )}
              {c === "checks" && (
                <div className="sb min-h-0 flex-1 overflow-y-auto p-4">
                  <Checks
                    p={a}
                    fix={() =>
                      theme({
                        accent: ensureContrast(Fr.p, Fr.bg, 3),
                      })
                    }
                  />
                </div>
              )}
            </motion.div>
          </div>
        </aside>
      </div>
      <AnimatePresence>
        {P && (
          <CommandPalette actions={eT} onClose={() => R(false)} key="pal" />
        )}
        {E && (
          <Present
            project={a}
            startIdx={le}
            onClose={() => I(false)}
            key="present"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
