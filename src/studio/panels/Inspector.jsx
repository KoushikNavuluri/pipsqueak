import { useEffect, useState } from "react";
import { ArrowUpLeft, Copy, MousePointerClick, RotateCcw, Shuffle, Sparkles, Trash2, Wand } from "lucide-react";
import { Button, Segmented, cx } from "../../ui";
import { PATTERNS } from "../../design/patterns.js";
import { duplicateAt, removeAt, updateAt } from "../../design/htmlTools.js";
import { FILL_TOKENS, PADDINGS, RADII, SIZE_STEPS, TEXT_TOKENS, TRACKING, WEIGHTS, getGroup, setGroup, sizeOf } from "../classes";

function Section({ title, children }) {
  return (
    <div className="border-b border-line-soft px-4 py-4 last:border-0">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-mute">{title}</div>
      {children}
    </div>
  );
}

function Swatch({ token, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={token || "None"}
      aria-label={token || "None"}
      aria-pressed={active}
      className={cx("relative h-7 w-7 rounded-md border transition-transform hover:scale-110", active ? "border-ink ring-2 ring-ink ring-offset-1" : "border-line")}
      style={{ background: color || "repeating-linear-gradient(45deg,#fff 0 4px,#eee 4px 8px)" }}
    />
  );
}

function AskBox({ placeholder, onSubmit, busy }) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) {
          onSubmit(text.trim());
          setText("");
        }
      }}
      className="flex items-end gap-2 rounded-xl border border-line bg-white p-1.5 focus-within:border-ink"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form.requestSubmit();
          }
        }}
        rows={2}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-faint"
      />
      <button type="submit" disabled={busy || !text.trim()} aria-label="Apply" className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white disabled:opacity-30">
        <Sparkles size={15} />
      </button>
    </form>
  );
}

const colorOf = (system, token) => {
  const key = token?.replace("on-primary", "onPrimary").replace("on-accent", "onAccent").replace("surface-2", "surface2");
  return system.colors[key];
};

export function Inspector({ project, studio, selection, onSelectPath, onAction, onTab }) {
  const screen = project.screens.find((s) => s.id === selection?.screenId);
  const info = selection?.info;
  const [text, setText] = useState(info?.text || "");
  useEffect(() => setText(info?.text || ""), [info?.path?.join("."), info?.text]);

  if (!screen) {
    const spec = project.spec || {};
    const sys = project.system;
    return (
      <div className="sb h-full overflow-y-auto">
        <Section title="Product">
          <div className="text-base font-semibold">{project.name}</div>
          {project.tagline && <p className="mt-0.5 text-sm text-ink-2">{project.tagline}</p>}
          {spec.audience && <p className="mt-2 text-xs leading-relaxed text-mute">For {spec.audience.replace(/^\w/, (c) => c.toLowerCase())}</p>}
        </Section>
        <Section title="Direction">
          <button onClick={() => onTab("system")} className="w-full rounded-xl border border-line p-3 text-left hover:border-ink">
            <div className="flex items-center gap-2">
              <span className="flex -space-x-1">
                {["bg", "primary", "accent", "ink"].map((k) => (
                  <span key={k} className="h-5 w-5 rounded-full border-2 border-white shadow-sm" style={{ background: sys.colors[k] }} />
                ))}
              </span>
              <span className="truncate text-sm font-semibold" style={{ fontFamily: `"${sys.fonts.display}"` }}>
                {sys.name}
              </span>
            </div>
            {sys.pitch && <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-mute">{sys.pitch}</p>}
          </button>
        </Section>
        <Section title="Next steps">
          <div className="grid gap-2">
            <Button variant="secondary" size="sm" full={true} onClick={() => onAction("play", project.screens[0]?.id)}>
              Play the prototype
            </Button>
            <Button variant="secondary" size="sm" full={true} onClick={() => onTab("review")}>
              Review the design
            </Button>
          </div>
        </Section>
        <div className="flex gap-2.5 px-4 py-4 text-xs leading-relaxed text-mute">
          <MousePointerClick size={15} className="mt-0.5 shrink-0 text-faint" />
          <span>Click a screen or any element on it to edit. Double-click text to type straight onto the design.</span>
        </div>
      </div>
    );
  }

  const busy = !!studio.busy[screen.id];
  const frame = studio.frames.current.get(screen.id);

  // Applies a class or text change live in the frame, then saves it.
  const patch = (fn, live) => {
    const next = updateAt(screen.html, info.path, fn);
    if (next === screen.html) {
      return;
    }
    frame?.expect(next);
    frame?.post({ type: "patch", path: info.path, ...live });
    studio.commitScreen(screen.id, next, "Edited properties");
  };
  const setClass = (group, value) => {
    const className = setGroup(info.className, group, value);
    patch((el) => el.setAttribute("class", className), { className });
  };

  if (!info || !info.path) {
    const pattern = PATTERNS[screen.pattern];
    return (
      <div className="sb h-full overflow-y-auto">
        <Section title="Screen">
          <div className="text-base font-semibold">{screen.name}</div>
          <p className="mt-1 text-sm text-mute">{screen.purpose}</p>
          {pattern && (
            <div className="mt-3 rounded-lg bg-wash px-3 py-2 text-xs text-ink-2">
              <span className="font-semibold">Composition:</span> {pattern.name}
            </div>
          )}
        </Section>
        <Section title="Ask Pip">
          <AskBox placeholder={`Change ${screen.name}…`} busy={busy} onSubmit={(t) => onAction("ask-screen", screen.id, t)} />
        </Section>
        <Section title="Actions">
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" icon={RotateCcw} disabled={busy} onClick={() => onAction("regenerate", screen.id)}>
              Regenerate
            </Button>
            <Button size="sm" variant="secondary" icon={Shuffle} disabled={busy} onClick={() => onAction("variations", screen.id)}>
              Variations
            </Button>
          </div>
        </Section>
      </div>
    );
  }

  const size = sizeOf(info.className, parseFloat(info.style?.fontSize) || 16);
  const textColor = getGroup(info.className, "textColor")?.replace(/^text-/, "").replace(/\/\d+$/, "");
  const fill = getGroup(info.className, "fill")?.replace(/^bg-/, "").replace(/\/\d+$/, "") || "";
  const family = getGroup(info.className, "family")?.replace("font-", "") || "body";
  const weight = getGroup(info.className, "weight") || "";
  const tracking = getGroup(info.className, "tracking") || "";
  const align = getGroup(info.className, "align") || "";
  const radius = getGroup(info.className, "radius") || "";
  const padding = getGroup(info.className, "padding") || "";
  const textual = /^(h[1-6]|p|span|a|button|label|li|strong|em|small|div|td|th)$/.test(info.tag) && !!info.text;

  return (
    <div className="sb h-full overflow-y-auto">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <div className="min-w-0">
          <div className="font-mono text-xs text-accent">&lt;{info.tag}&gt;</div>
          <div className="truncate text-xs text-mute">on {screen.name}</div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onSelectPath(info.path.slice(0, -1))} disabled={info.path.length <= 1} title="Select parent" aria-label="Select parent" className="flex h-8 w-8 items-center justify-center rounded-lg text-mute hover:bg-sunken disabled:opacity-30">
            <ArrowUpLeft size={15} />
          </button>
          <button
            onClick={() => studio.commitScreen(screen.id, duplicateAt(screen.html, info.path), "Duplicated element")}
            title="Duplicate"
            aria-label="Duplicate element"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-mute hover:bg-sunken"
          >
            <Copy size={15} />
          </button>
          <button
            onClick={() => {
              studio.commitScreen(screen.id, removeAt(screen.html, info.path), "Deleted element");
              onSelectPath(null);
            }}
            title="Delete"
            aria-label="Delete element"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <Section title="Ask Pip about this">
        <AskBox placeholder="Make it bolder, add a badge, rewrite…" busy={busy} onSubmit={(t) => onAction("ask-element", screen.id, t, info.path)} />
        <button
          disabled={busy}
          onClick={() => onAction("ask-element", screen.id, "Reimagine this section: keep its job and content, give it a stronger, more distinctive composition in this design system.", info.path)}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-ink disabled:opacity-40"
        >
          <Wand size={13} /> Reimagine this section
        </button>
      </Section>

      {info.editable && (
        <Section title="Text">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => text !== info.text && patch((el) => (el.textContent = text), { text })}
            rows={Math.min(5, Math.max(2, Math.ceil(text.length / 34)))}
            aria-label="Text"
            className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink"
          />
        </Section>
      )}

      {textual && (
        <Section title="Typography">
          <Segmented
            id={"fam-" + screen.id}
            full={true}
            value={family === "sans" ? "body" : family}
            onChange={(v) => setClass("family", `font-${v}`)}
            options={[
              { value: "display", label: "Display" },
              { value: "body", label: "Body" },
              { value: "mono", label: "Mono" },
            ]}
          />
          <label className="mt-3 block">
            <span className="mb-1 flex justify-between text-xs text-mute">
              <span>Size</span>
              <span className="tabular-nums">{size}px</span>
            </span>
            <input
              type="range"
              className="rng"
              min={0}
              max={SIZE_STEPS.length - 1}
              value={SIZE_STEPS.reduce((best, v, i) => (Math.abs(v - size) < Math.abs(SIZE_STEPS[best] - size) ? i : best), 0)}
              onChange={(e) => setClass("size", `text-[${SIZE_STEPS[+e.target.value]}px]`)}
              aria-label="Font size"
            />
          </label>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {WEIGHTS.map(([cls, label]) => (
              <button key={cls} onClick={() => setClass("weight", cls)} className={cx("rounded-md border px-2 py-1.5 text-xs", weight === cls ? "border-ink bg-ink text-white" : "border-line hover:border-ink")}>
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <select value={tracking} onChange={(e) => setClass("tracking", e.target.value)} aria-label="Letter spacing" className="h-8 flex-1 rounded-md border border-line bg-white px-2 text-xs">
              {TRACKING.map(([cls, label]) => (
                <option key={label} value={cls}>
                  {label}
                </option>
              ))}
            </select>
            <Segmented
              id={"al-" + screen.id}
              value={align || "text-left"}
              onChange={(v) => setClass("align", v)}
              options={[
                { value: "text-left", label: "L", aria: "Align left" },
                { value: "text-center", label: "C", aria: "Center" },
                { value: "text-right", label: "R", aria: "Align right" },
              ]}
            />
            <button onClick={() => setClass("case", getGroup(info.className, "case") === "uppercase" ? "" : "uppercase")} className="h-8 rounded-md border border-line px-2 text-xs font-semibold hover:border-ink" aria-label="Toggle uppercase">
              Aa
            </button>
          </div>
          <div className="mt-3 text-xs text-mute">Color</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {TEXT_TOKENS.map((t) => (
              <Swatch key={t} token={t} color={colorOf(project.system, t)} active={textColor === t} onClick={() => setClass("textColor", `text-${t}`)} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Box">
        <div className="text-xs text-mute">Fill</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {FILL_TOKENS.map((t) => (
            <Swatch key={t || "none"} token={t} color={t ? colorOf(project.system, t) : null} active={fill === t} onClick={() => setClass("fill", t ? `bg-${t}` : "")} />
          ))}
        </div>
        <div className="mt-3 text-xs text-mute">Corners</div>
        <div className="mt-1.5 grid grid-cols-6 gap-1">
          {RADII.map(([cls, label]) => (
            <button key={cls} onClick={() => setClass("radius", cls)} className={cx("rounded-md border py-1 text-xs", radius === cls ? "border-ink bg-ink text-white" : "border-line hover:border-ink")}>
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 text-xs text-mute">Padding</div>
        <div className="mt-1.5 grid grid-cols-7 gap-1">
          {PADDINGS.map(([cls, label]) => (
            <button key={label} onClick={() => setClass("padding", cls)} className={cx("rounded-md border py-1 text-xs", padding === cls ? "border-ink bg-ink text-white" : "border-line hover:border-ink")}>
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Classes">
        <textarea
          key={info.className}
          defaultValue={info.className}
          onBlur={(e) => e.target.value !== info.className && patch((el) => el.setAttribute("class", e.target.value), { className: e.target.value })}
          rows={4}
          spellCheck={false}
          aria-label="Tailwind classes"
          className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[11px] leading-relaxed outline-none focus:border-ink"
        />
      </Section>
    </div>
  );
}
