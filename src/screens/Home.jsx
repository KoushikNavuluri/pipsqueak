import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Command,
  Copy,
  Ellipsis,
  FolderOpen,
  Keyboard,
  Layers as LayersIcon,
  RotateCcw,
  Shuffle,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { CATEGORIES, PALETTES, PROMPT_IDEAS, TEMPLATES, VIBES } from "../data";
import {
  detectCategory,
  extractName,
  generateProject,
  makeScreen,
} from "../gen";
import {
  Button,
  EASE,
  IconButton,
  Magnetic,
  Menu,
  Segmented,
  Tilt,
  cx,
} from "../ui";
import { Scaled, Screen, resolveTheme } from "../render";
import { useStore } from "../store";
import { CommandPalette } from "../palette";

export function Logo({ onClick, compact }) {
  return (
    <button
      onClick={onClick}
      aria-label="pipsqueak home"
      className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-[#F2F1ED]"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#16161A]">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF4D1A]" />
      </span>
      <span
        className={
          "display text-[17px] font-semibold" +
          (compact ? " hidden sm:inline" : "")
        }
      >
        pipsqueak
      </span>
    </button>
  );
}

function useTypewriter(e, t) {
  const [a, r] = useState("");
  useEffect(() => {
    if (t || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      r("");
      return;
    }
    let o = 0;
    let i = 0;
    let s = false;
    let l;
    const tick = () => {
      const d = e[o];
      if (s) {
        i -= 2;
        if (i <= 0) {
          i = 0;
          r("");
          s = false;
          o = (o + 1) % e.length;
          l = setTimeout(tick, 320);
          return;
        }
        r(d.slice(0, i));
        l = setTimeout(tick, 18);
      } else {
        i++;
        r(d.slice(0, i));
        if (i >= d.length) {
          s = true;
          l = setTimeout(tick, 1400);
          return;
        }
        l = setTimeout(tick, 48);
      }
    };
    l = setTimeout(tick, 700);
    return () => clearTimeout(l);
  }, [t, e]);
  return a;
}

function TemplateCard({ t: e, onPick, i: a }) {
  const r = VIBES.find((s) => s.key === e.vibe) || VIBES[0];
  const o = {
    pal: r.pal,
    font: r.font,
    radius: r.radius,
    density: "cozy",
    mode: "auto",
    accent: null,
  };
  const i = useMemo(
    () => makeScreen("home", e.cat, CATEGORIES[e.cat].names[0]),
    [e.cat],
  );
  return (
    <motion.button
      initial={{
        opacity: 0,
        y: 18,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{
        once: true,
        margin: "-30px",
      }}
      transition={{
        duration: 0.45,
        ease: EASE,
        delay: (a % 6) * 0.05,
      }}
      onClick={() => onPick(e)}
      aria-label={`Start from ${e.label} template`}
      className="group w-[132px] shrink-0 text-left sm:w-auto"
    >
      <Tilt>
        <div className="overflow-hidden rounded-xl border border-[#E6E5E0] bg-[#F7F6F3] p-2.5 transition-shadow group-hover:shadow-[0_16px_32px_-12px_rgba(20,20,26,.3)]">
          <div className="mx-auto w-fit overflow-hidden rounded-lg">
            <Scaled scale={0.27}>
              <Screen screen={i} theme={o} />
            </Scaled>
          </div>
        </div>
      </Tilt>
      <div className="mt-2 flex items-center justify-between px-0.5 text-sm font-semibold">
        {e.label}
        <ArrowRight
          size={15}
          className="text-[#62626A] opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
        />
      </div>
    </motion.button>
  );
}

const ProjectCard = forwardRef(function ({ p, onOpen }, r) {
  const { api } = useStore();
  return (
    <motion.div
      ref={r}
      layout={true}
      initial={{
        opacity: 0,
        y: 12,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        scale: 0.96,
      }}
      transition={{
        duration: 0.25,
        ease: EASE,
      }}
      className="group relative overflow-hidden rounded-xl border border-[#E6E5E0] bg-white transition-shadow hover:shadow-[0_10px_24px_-10px_rgba(20,20,26,.22)]"
    >
      <button
        onClick={() => onOpen(p.id)}
        aria-label={`Open ${p.name}`}
        className="block w-full text-left"
      >
        <div className="flex gap-2 overflow-hidden bg-[#F7F6F3] px-3 pt-3">
          {p.screens.slice(0, 4).map((i) => (
            <div
              className="shrink-0 overflow-hidden rounded-t-lg border border-b-0 border-[#E6E5E0]"
              key={i.id}
            >
              <Scaled scale={0.2}>
                <Screen screen={i} theme={p.theme} />
              </Scaled>
            </div>
          ))}
        </div>
        <div className="px-4 py-3">
          <div className="display truncate text-[17px] font-semibold">
            {p.name}
          </div>
          <div className="truncate text-sm text-[#62626A]">
            {p.screens.length} screens · {PALETTES[p.theme.pal].name} ·{" "}
            {new Date(p.created).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}
          </div>
        </div>
      </button>
      <div className="absolute right-2 top-2 flex gap-1">
        <button
          aria-label={p.fav ? "Remove from favorites" : "Add to favorites"}
          onClick={() => api.fav(p.id)}
          className={cx(
            "flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 backdrop-blur hover:bg-white",
            p.fav ? "text-[#FF4D1A]" : "text-[#62626A]",
          )}
        >
          <Star size={16} fill={p.fav ? "currentColor" : "none"} />
        </button>
        <Menu
          trigger={() => (
            <span
              role="button"
              tabIndex={0}
              aria-label="More"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-white/90 text-[#62626A] backdrop-blur hover:bg-white"
            >
              <Ellipsis size={16} />
            </span>
          )}
          items={[
            {
              label: "Duplicate",
              icon: Copy,
              onClick: () => api.dup(p.id),
            },
            {
              sep: true,
            },
            {
              label: "Delete",
              icon: Trash2,
              danger: true,
              onClick: () => api.del(p.id),
            },
          ]}
        />
      </div>
    </motion.div>
  );
});

export function Home() {
  const { s: e, api } = useStore();
  const { projects } = e.data;
  const [r, o] = useState("");
  const [i, s] = useState("candy");
  const [l, u] = useState(5);
  const [d, c] = useState("iOS");
  const [f, p] = useState("");
  const [h, x] = useState(false);
  const S = useRef(null);
  const v = useRef(0);
  const [g, m] = useState(false);
  const [y, L] = useState(false);
  const A = useTypewriter(PROMPT_IDEAS, g || r.length > 0);
  const E = useMemo(() => {
    const b = r.trim();
    if (b.length < 4) {
      return null;
    }
    const M = detectCategory(b);
    const N = TEMPLATES.find((U) => U.cat === M);
    return {
      cat: M,
      label: N?.label || "To-do",
      name: extractName(b, M),
      vibe: N?.vibe || "candy",
    };
  }, [r]);
  useEffect(() => {
    const k = (M) => {
      if ((M.metaKey || M.ctrlKey) && M.key.toLowerCase() === "k") {
        M.preventDefault();
        L((N) => !N);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const go = (b, M = i, N = l) => {
    const U = (b ?? r).trim();
    if (!U) {
      S.current?.focus();
      api.toast("Type an idea first, even a short one");
      return;
    }
    api.startGen(
      generateProject({
        prompt: U,
        vibe: M,
        count: N,
        platform: d,
      }),
    );
  };
  const surprise = () => {
    const b = v.current++ % PROMPT_IDEAS.length;
    o(
      PROMPT_IDEAS[
        (b + Math.floor(Math.random() * PROMPT_IDEAS.length)) %
          PROMPT_IDEAS.length
      ],
    );
    S.current?.focus();
  };
  const R = useMemo(
    () =>
      projects.filter(
        (b) =>
          (!h || b.fav) &&
          (!f ||
            (b.name + " " + b.prompt).toLowerCase().includes(f.toLowerCase())),
      ),
    [projects, f, h],
  );
  return (
    <div className="sb h-full overflow-y-auto">
      <header className="sticky top-0 z-20 border-b border-[#E6E5E0] bg-[#FAFAF8]/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo onClick={() => {}} />
          <div className="flex items-center gap-1">
            <button
              onClick={() => L(true)}
              aria-label="Command palette"
              className="hidden h-9 items-center gap-2 rounded-lg border border-[#E6E5E0] bg-white px-3 text-sm text-[#62626A] hover:bg-[#F7F6F3] sm:inline-flex"
            >
              <Command size={14} />
              Search
              <kbd className="rounded border border-[#E6E5E0] px-1.5 font-mono text-xs">
                ⌘K
              </kbd>
            </button>
            <IconButton
              icon={Keyboard}
              label="Keyboard shortcuts"
              onClick={() => api.dialog("shortcuts")}
            />
            <Menu
              trigger={() => (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Settings"
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg hover:bg-[#F2F1ED]"
                >
                  <Ellipsis size={18} />
                </span>
              )}
              items={[
                {
                  label: "Calm motion: " + (e.data.prefs.reduce ? "on" : "off"),
                  icon: Sparkles,
                  onClick: () =>
                    api.pref({
                      reduce: !e.data.prefs.reduce,
                    }),
                },
                {
                  label: "Reset demo data",
                  icon: RotateCcw,
                  danger: true,
                  onClick: () => {
                    api.reset();
                  },
                },
              ]}
            />
          </div>
        </div>
      </header>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[640px] overflow-hidden"
      >
        <div
          className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#FF4D1A]/15 blur-3xl"
          style={{
            animation: "blob 16s ease-in-out infinite",
          }}
        />
        <div
          className="absolute right-0 top-24 h-80 w-80 rounded-full bg-[#7C9CFF]/20 blur-3xl"
          style={{
            animation: "blob 20s ease-in-out infinite reverse",
          }}
        />
        <div
          className="absolute left-1/3 top-56 h-64 w-64 rounded-full bg-[#FFD166]/20 blur-3xl"
          style={{
            animation: "blob 24s ease-in-out infinite",
          }}
        />
      </div>
      <main className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <section className="mx-auto max-w-3xl pb-10 pt-12 text-center sm:pt-20">
          <h1
            className="display text-[40px] font-semibold leading-[1.02] sm:text-6xl"
            aria-label="Describe an app. Get the screens."
          >
            {["Describe", "an", "app."].map((b, M) => (
              <motion.span
                aria-hidden="true"
                initial={{
                  opacity: 0,
                  y: 24,
                  filter: "blur(6px)",
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                }}
                transition={{
                  duration: 0.6,
                  ease: EASE,
                  delay: M * 0.08,
                }}
                className="mr-[0.25em] inline-block"
                key={b}
              >
                {b}
              </motion.span>
            ))}
            <br />
            {["Get", "the", "screens."].map((b, M) => (
              <motion.span
                aria-hidden="true"
                initial={{
                  opacity: 0,
                  y: 24,
                  filter: "blur(6px)",
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                }}
                transition={{
                  duration: 0.6,
                  ease: EASE,
                  delay: 0.28 + M * 0.08,
                }}
                className="mr-[0.25em] inline-block text-[#62626A]"
                key={b}
              >
                {b}
              </motion.span>
            ))}
          </h1>
          <motion.p
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            transition={{
              delay: 0.15,
            }}
            className="mx-auto mt-4 max-w-md text-base text-[#62626A]"
          >
            One sentence in, editable mobile screens out. Tweak them, preview on
            devices, then export.
          </motion.p>
          <motion.div
            initial={{
              opacity: 0,
              y: 16,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.1,
              duration: 0.5,
              ease: EASE,
            }}
            className="mt-8 rounded-2xl border border-[#E6E5E0] bg-white p-3 text-left shadow-[0_12px_40px_-16px_rgba(20,20,26,.18)] focus-within:border-[#16161A]"
          >
            <textarea
              ref={S}
              aria-label="Describe your app idea"
              value={r}
              onChange={(b) => o(b.target.value)}
              rows={2}
              maxLength={160}
              onKeyDown={(b) => {
                if (
                  b.key === "Enter" &&
                  (b.metaKey || b.ctrlKey || !b.shiftKey)
                ) {
                  b.preventDefault();
                  go();
                }
              }}
              onFocus={() => m(true)}
              onBlur={() => m(false)}
              placeholder={A ? A + " |" : "Describe your app…"}
              className="w-full resize-none bg-transparent px-2 py-1.5 text-lg outline-none placeholder:text-[#8A8A92]"
            />
            <AnimatePresence initial={false}>
              {E && (
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
                  transition={{
                    duration: 0.25,
                    ease: EASE,
                  }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap items-center gap-1.5 px-1.5 pb-3 pt-1 text-sm">
                    <span className="text-[#62626A]">Looks like</span>
                    <motion.span
                      initial={{
                        scale: 0.8,
                        opacity: 0,
                      }}
                      animate={{
                        scale: 1,
                        opacity: 1,
                      }}
                      className="rounded-full bg-[#F2F1ED] px-2.5 py-1 font-semibold"
                      key={E.label}
                    >
                      {E.label} app
                    </motion.span>
                    <span className="text-[#62626A]">called</span>
                    <motion.span
                      initial={{
                        scale: 0.8,
                        opacity: 0,
                      }}
                      animate={{
                        scale: 1,
                        opacity: 1,
                      }}
                      className="rounded-full bg-[#F2F1ED] px-2.5 py-1 font-semibold"
                      key={E.name}
                    >
                      {E.name}
                    </motion.span>
                    {E.vibe !== i && (
                      <button
                        onClick={() => s(E.vibe)}
                        className="rounded-full border border-dashed border-[#B9B7AE] px-2.5 py-1 font-medium text-[#16161A] hover:bg-[#F7F6F3]"
                      >
                        Try the{" "}
                        {
                          VIBES.find((b) => b.key === E.vibe)?.label.split(
                            " ",
                          )[0]
                        }{" "}
                        style
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EFEEE9] px-1 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  id="plat"
                  value={d}
                  onChange={c}
                  options={[
                    {
                      value: "iOS",
                      label: "iOS",
                    },
                    {
                      value: "Android",
                      label: "Android",
                    },
                  ]}
                />
                <Segmented
                  id="cnt"
                  value={l}
                  onChange={u}
                  options={[3, 4, 5, 6].map((b) => ({
                    value: b,
                    label: String(b),
                    aria: `${b} screens`,
                  }))}
                />
                <div
                  className="flex items-center gap-1.5 pl-1"
                  role="radiogroup"
                  aria-label="Style"
                >
                  {VIBES.map((b) => {
                    const M = resolveTheme({
                      pal: b.pal,
                    });
                    const N = i === b.key;
                    return (
                      <button
                        role="radio"
                        aria-checked={N}
                        aria-label={b.label}
                        title={b.label}
                        onClick={() => s(b.key)}
                        className={cx(
                          "h-7 w-7 rounded-full border transition-shadow",
                          N
                            ? "border-[#16161A] shadow-[0_0_0_2px_#fff,0_0_0_4px_#16161A]"
                            : "border-[#E6E5E0]",
                        )}
                        style={{
                          background: `linear-gradient(135deg, ${M.p} 50%, ${M.a} 50%)`,
                        }}
                        key={b.key}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  icon={Shuffle}
                  onClick={surprise}
                  className="hidden sm:inline-flex"
                >
                  Surprise me
                </Button>
                <Magnetic>
                  <Button icon={Sparkles} onClick={() => go()}>
                    Generate
                  </Button>
                </Magnetic>
              </div>
            </div>
          </motion.div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {PROMPT_IDEAS.slice(0, 5).map((b, M) => (
              <motion.button
                initial={{
                  opacity: 0,
                  y: 6,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.25 + M * 0.04,
                }}
                onClick={() => {
                  o(b);
                  S.current?.focus();
                }}
                className="rounded-full border border-[#E6E5E0] bg-white px-3 py-1.5 text-sm text-[#16161A] hover:bg-[#F7F6F3]"
                key={b}
              >
                {b}
              </motion.button>
            ))}
          </div>
          <p className="mt-5 text-sm text-[#62626A]">
            The AI here is simulated and runs on your device. Nothing is sent
            anywhere.
          </p>
        </section>
        <section aria-labelledby="tpl" className="pt-4">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="tpl" className="display text-xl font-semibold">
              Start from a template
            </h2>
            <span className="hidden text-sm text-[#62626A] sm:block">
              One click, fully editable
            </span>
          </div>
          <div className="nosb -mx-4 flex gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">
            {TEMPLATES.map((b, M) => (
              <TemplateCard
                i={M}
                t={b}
                onPick={(N) => go(N.prompt, N.vibe, 4)}
                key={b.cat}
              />
            ))}
          </div>
        </section>
        <section aria-labelledby="proj" className="pt-14">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="proj" className="display text-xl font-semibold">
              Your projects{" "}
              <span className="ml-1 text-base font-normal text-[#62626A]">
                {projects.length}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <input
                aria-label="Search projects"
                value={f}
                onChange={(b) => p(b.target.value)}
                placeholder="Search"
                className="h-9 w-36 rounded-lg border border-[#E6E5E0] bg-white px-3 text-sm outline-none focus:border-[#16161A] sm:w-52"
              />
              <Segmented
                id="pf"
                value={h ? "fav" : "all"}
                onChange={(b) => x(b === "fav")}
                options={[
                  {
                    value: "all",
                    label: "All",
                  },
                  {
                    value: "fav",
                    label: "Starred",
                  },
                ]}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {R.map((b) => (
                <ProjectCard p={b} onOpen={api.open} key={b.id} />
              ))}
            </AnimatePresence>
          </div>
          {R.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#D6D4CD] px-6 py-14 text-center">
              <FolderOpen
                className="mx-auto mb-3 text-[#62626A]"
                size={28}
                strokeWidth={1.6}
              />
              <div className="display text-lg font-semibold">
                {projects.length === 0 ? "No projects yet" : "Nothing matches"}
              </div>
              <p className="mx-auto mt-1 max-w-xs text-sm text-[#62626A]">
                {projects.length === 0
                  ? "Describe an app above or pick a template to start."
                  : h && !f
                    ? "Star a project to pin it here."
                    : "Try a different search."}
              </p>
              {projects.length === 0 && (
                <Button
                  className="mt-4"
                  icon={Sparkles}
                  onClick={() => S.current?.focus()}
                >
                  Start one
                </Button>
              )}
            </div>
          )}
        </section>
      </main>
      <AnimatePresence>
        {y && (
          <CommandPalette
            placeholder="Search templates, projects, actions…"
            onClose={() => L(false)}
            actions={[
              {
                id: "focus",
                label: "Describe a new app",
                group: "Create",
                icon: Sparkles,
                run: () => {
                  window.scrollTo?.(0, 0);
                  S.current?.focus();
                },
              },
              ...TEMPLATES.map((b) => ({
                id: "t" + b.cat,
                label: `New ${b.label} app from template`,
                group: "Create",
                icon: LayersIcon,
                run: () => go(b.prompt, b.vibe, 4),
              })),
              ...projects.map((b) => ({
                id: "p" + b.id,
                label: `Open ${b.name}`,
                group: "Projects",
                icon: FolderOpen,
                hint: `${b.screens.length} screens`,
                run: () => api.open(b.id),
              })),
              {
                id: "keys",
                label: "Keyboard shortcuts",
                group: "Help",
                icon: Keyboard,
                run: () => api.dialog("shortcuts"),
              },
              {
                id: "calm",
                label: "Toggle calm motion",
                group: "Help",
                icon: Sparkles,
                run: () =>
                  api.pref({
                    reduce: !e.data.prefs.reduce,
                  }),
              },
            ]}
            key="pal"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
