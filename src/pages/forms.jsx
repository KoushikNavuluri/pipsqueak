import { useId, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { cx } from "../ui";

export const inputClass =
  "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] outline-none transition-[border-color,box-shadow] placeholder:text-faint hover:border-line-strong focus:border-ink/70 focus:shadow-glow disabled:bg-wash disabled:text-mute";

export function TextField({ label, hint, right, className, type = "text", ...props }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
          {label}
        </label>
        {right}
      </div>
      <div className="relative">
        <input id={id} type={isPassword && shown ? "text" : type} className={cx(inputClass, isPassword && "pr-11")} {...props} />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-mute transition-colors hover:text-ink"
          >
            {shown ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-mute">{hint}</p>}
    </div>
  );
}

export function TextArea({ label, hint, className, ...props }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      <textarea
        id={id}
        className="min-h-24 w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none transition-[border-color,box-shadow] placeholder:text-faint hover:border-line-strong focus:border-ink/70 focus:shadow-glow"
        {...props}
      />
      {hint && <p className="mt-1.5 text-xs text-mute">{hint}</p>}
    </div>
  );
}

// A success or error line under a form.
export function FormMessage({ tone = "error", children }) {
  if (!children) return null;
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cx("flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm", tone === "error" ? "bg-danger-soft text-danger" : "bg-success-soft text-success-deep")}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// Plain-English strength rating for a new password.
export function passwordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length < 6) return { score: 0, label: "Too short" };
  if (score <= 1) return { score: 1, label: "Weak" };
  if (score <= 3) return { score: 2, label: "Okay" };
  return { score: 3, label: "Strong" };
}

export function StrengthMeter({ password }) {
  if (!password) return null;
  const { score, label } = passwordStrength(password);
  const colors = ["#D2CCBF", "#C2321F", "#D48A1F", "#1F8A5B"];
  return (
    <div className="mt-2 flex items-center gap-2" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3].map((n) => (
          <span key={n} className="h-1 flex-1 rounded-full transition-colors duration-300" style={{ background: score >= n ? colors[score] : "#E4E0D6" }} />
        ))}
      </div>
      <span className="text-xs text-mute">{label}</span>
    </div>
  );
}
