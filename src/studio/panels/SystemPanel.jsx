import { useMemo } from "react";
import { Check, Palette, Wand } from "lucide-react";
import { Segmented, cx } from "../../ui";
import { FONTS } from "../../design/fonts.js";
import { contrast, normalizeSystem, repairColors } from "../../design/system.js";
import { skillById } from "../../design/skills.js";
import { fontsUrl } from "../../design/fonts.js";

const COLOR_LABELS = [
  ["bg", "Background"],
  ["surface", "Surface"],
  ["surface2", "Surface 2"],
  ["ink", "Ink"],
  ["muted", "Muted"],
  ["line", "Line"],
  ["primary", "Primary"],
  ["onPrimary", "On primary"],
  ["accent", "Accent"],
  ["onAccent", "On accent"],
];

function Section({ title, right, children }) {
  return (
    <div className="border-b border-line-soft px-4 py-4 last:border-0">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-mute">{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function Ratio({ a, b, need = 4.5 }) {
  const r = contrast(a, b);
  const ok = r >= need;
  return <span className={cx("rounded px-1 font-mono text-[10px]", ok ? "bg-success-soft text-success-deep" : "bg-danger-soft text-danger")}>{r.toFixed(1)}</span>;
}

export function SystemPanel({ project, onChange, onAsk }) {
  const sys = project.system;
  const skill = skillById(sys.skill);
  const names = Object.keys(FONTS);
  const byKind = (kind) => names.filter((n) => FONTS[n].kind === kind);
  const previewFonts = useMemo(() => fontsUrl(names), []);

  const set = (patch, key) => onChange(normalizeSystem({ ...sys, ...patch }, sys.skill), key);
  const setColor = (k, v) => /^#[0-9a-f]{6}$/i.test(v) && onChange({ ...sys, colors: { ...sys.colors, [k]: v.toUpperCase() } }, "sys-color-" + k);

  const others = (project.directions || []).filter((d) => d.skill !== sys.skill || d.name !== sys.name);

  return (
    <div className="sb h-full overflow-y-auto">
      <link rel="stylesheet" href={previewFonts} />
      <div className="px-4 pt-4">
        <div className="rounded-xl border border-line p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-mute">{skill.name}</div>
          <div className="mt-0.5 text-base font-semibold">{sys.name}</div>
          <p className="mt-1 text-xs leading-relaxed text-mute">{sys.pitch}</p>
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = e.currentTarget.elements.restyle.value.trim();
            if (v) {
              onAsk(v);
              e.currentTarget.reset();
            }
          }}
        >
          <input name="restyle" placeholder="Warmer, more contrast, bolder type…" aria-label="Restyle with Pip" className="h-9 min-w-0 flex-1 rounded-lg border border-line px-3 text-sm outline-none focus:border-ink" />
          <button type="submit" aria-label="Restyle with Pip" className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-white">
            <Wand size={15} />
          </button>
        </form>
      </div>

      <Section
        title="Color"
        right={
          <button onClick={() => onChange({ ...sys, colors: repairColors(sys.colors) }, "sys-repair")} className="text-xs font-semibold text-ink-2 hover:text-ink">
            Fix contrast
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {COLOR_LABELS.map(([k, label]) => (
            <label key={k} className="flex items-center gap-2">
              <input type="color" className="swatch !h-8 !w-8 shrink-0" value={sys.colors[k]} onChange={(e) => setColor(k, e.target.value)} aria-label={label} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">{label}</span>
                <span className="flex items-center gap-1 font-mono text-[10px] text-mute">
                  {sys.colors[k]}
                  {k === "ink" && <Ratio a={sys.colors.ink} b={sys.colors.bg} />}
                  {k === "muted" && <Ratio a={sys.colors.muted} b={sys.colors.bg} />}
                  {k === "onPrimary" && <Ratio a={sys.colors.onPrimary} b={sys.colors.primary} />}
                  {k === "onAccent" && <Ratio a={sys.colors.onAccent} b={sys.colors.accent} />}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        {[
          ["display", "Display", [...byKind("serif"), ...byKind("sans"), ...byKind("mono")]],
          ["body", "Body", [...byKind("sans"), ...byKind("serif")]],
          ["mono", "Mono", byKind("mono")],
        ].map(([role, label, list]) => (
          <label key={role} className="mb-2 flex items-center gap-2">
            <span className="w-14 text-xs text-mute">{label}</span>
            <select value={sys.fonts[role]} onChange={(e) => set({ fonts: { ...sys.fonts, [role]: e.target.value } }, "sys-font-" + role)} className="h-9 flex-1 rounded-lg border border-line bg-white px-2 text-sm" style={{ fontFamily: `"${sys.fonts[role]}"` }} aria-label={`${label} font`}>
              {list.map((n) => (
                <option key={n} value={n} style={{ fontFamily: `"${n}"` }}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ))}
        <div className="mt-3 rounded-lg bg-wash px-3 py-3" style={{ color: sys.colors.ink, background: sys.colors.bg }}>
          <div style={{ fontFamily: `"${sys.fonts.display}"`, fontWeight: sys.type.displayWeight, letterSpacing: sys.type.displayTracking, textTransform: sys.type.displayCase, fontSize: 30, lineHeight: 1 }}>{project.name}</div>
          <div className="mt-1.5 text-sm" style={{ fontFamily: `"${sys.fonts.body}"`, color: sys.colors.muted }}>
            {project.tagline}
          </div>
        </div>
        <label className="mt-3 block">
          <span className="mb-1 flex justify-between text-xs text-mute">
            <span>Display weight</span>
            <span className="tabular-nums">{sys.type.displayWeight}</span>
          </span>
          <input type="range" className="rng" min={100} max={900} step={100} value={sys.type.displayWeight} onChange={(e) => set({ type: { ...sys.type, displayWeight: +e.target.value } }, "sys-weight")} aria-label="Display weight" />
        </label>
        <div className="mt-2 flex gap-2">
          <select value={sys.type.displayTracking} onChange={(e) => set({ type: { ...sys.type, displayTracking: e.target.value } }, "sys-tracking")} aria-label="Display tracking" className="h-8 flex-1 rounded-md border border-line bg-white px-2 text-xs">
            {["-0.05em", "-0.04em", "-0.03em", "-0.02em", "-0.01em", "0em", "0.02em", "0.06em"].map((t) => (
              <option key={t} value={t}>
                Tracking {t}
              </option>
            ))}
          </select>
          <Segmented
            id="sys-case"
            value={sys.type.displayCase}
            onChange={(v) => set({ type: { ...sys.type, displayCase: v } }, "sys-case")}
            options={[
              { value: "none", label: "Aa", aria: "Sentence case" },
              { value: "uppercase", label: "AA", aria: "Uppercase" },
            ]}
          />
        </div>
      </Section>

      <Section title="Shape">
        {["sm", "md", "lg", "xl"].map((k) => (
          <label key={k} className="mb-1 flex items-center gap-3">
            <span className="w-6 text-xs uppercase text-mute">{k}</span>
            <input type="range" className="rng" min={0} max={48} value={sys.radius[k]} onChange={(e) => set({ radius: { ...sys.radius, [k]: +e.target.value } }, "sys-radius-" + k)} aria-label={`Radius ${k}`} />
            <span className="w-8 text-right font-mono text-xs tabular-nums">{sys.radius[k]}</span>
          </label>
        ))}
        <div className="mt-2 text-xs text-mute">Shadow</div>
        <div className="mt-1.5 grid grid-cols-5 gap-1">
          {["none", "soft", "crisp", "hard", "glow"].map((v) => (
            <button key={v} onClick={() => set({ shadow: v }, "sys-shadow")} className={cx("rounded-md border py-1 text-xs capitalize", sys.shadow === v ? "border-ink bg-ink text-white" : "border-line hover:border-ink")}>
              {v}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Icons">
        <Segmented
          id="sys-icons"
          full={true}
          value={sys.icons.set}
          onChange={(v) => set({ icons: { ...sys.icons, set: v } }, "sys-icon-set")}
          options={[
            { value: "outlined", label: "Outlined" },
            { value: "rounded", label: "Rounded" },
            { value: "sharp", label: "Sharp" },
          ]}
        />
        <label className="mt-3 block">
          <span className="mb-1 flex justify-between text-xs text-mute">
            <span>Weight</span>
            <span className="tabular-nums">{sys.icons.weight}</span>
          </span>
          <input type="range" className="rng" min={100} max={700} step={100} value={sys.icons.weight} onChange={(e) => set({ icons: { ...sys.icons, weight: +e.target.value } }, "sys-icon-weight")} aria-label="Icon weight" />
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!sys.icons.fill} onChange={(e) => set({ icons: { ...sys.icons, fill: e.target.checked ? 1 : 0 } }, "sys-icon-fill")} />
          Filled icons
        </label>
      </Section>

      {others.length > 0 && (
        <Section title="Other directions">
          <p className="mb-3 text-xs text-mute">Apply another direction's colors, type and shape to every screen. Layouts stay as they are.</p>
          {others.map((d) => (
            <button
              key={d.name}
              onClick={() => onChange({ ...d, components: sys.components }, "sys-switch")}
              className="mb-2 flex w-full items-center gap-3 rounded-xl border border-line p-2.5 text-left hover:border-ink"
            >
              <span className="flex shrink-0 -space-x-1.5">
                {["bg", "primary", "accent", "ink"].map((k) => (
                  <span key={k} className="h-6 w-6 rounded-full border-2 border-white" style={{ background: d.colors[k] }} />
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold" style={{ fontFamily: `"${d.fonts.display}"` }}>
                  {d.name}
                </span>
                <span className="block truncate text-xs text-mute">
                  {d.fonts.display} · {skillById(d.skill).name}
                </span>
              </span>
              <Palette size={14} className="text-mute" />
            </button>
          ))}
        </Section>
      )}
      <div className="flex items-center gap-1.5 px-4 pb-6 text-xs text-faint">
        <Check size={12} /> Changes restyle every screen instantly.
      </div>
    </div>
  );
}
