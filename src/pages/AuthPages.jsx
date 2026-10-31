import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, MailCheck } from "lucide-react";
import { supabase } from "../supabase";
import { Splash, safeNext, useSession } from "../session";
import { Aura, Logo } from "../brand";
import { Button, EASE } from "../ui";
import { useShowcase } from "../showcase";
import { FormMessage, StrengthMeter, TextField } from "./forms";

// The right-hand panel: real designs made with Pipsqueak, cycling slowly.
function Gallery() {
  const items = useShowcase();
  const list = (items || []).filter((i) => i.platform === "mobile");
  const [n, setN] = useState(0);
  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setN((x) => (x + 1) % list.length), 5200);
    return () => clearInterval(t);
  }, [list.length]);
  const item = list[n];
  return (
    <div className="relative hidden overflow-hidden bg-night lg:block">
      <Aura className="inset-0 opacity-70" strong />
      <div className="relative flex h-full flex-col justify-between p-12">
        <p className="eyebrow text-white/50">Made with Pipsqueak</p>
        <div className="relative mx-auto h-[460px] w-full max-w-[460px]">
          <AnimatePresence mode="popLayout">
            {item && (
              <motion.div key={item.slug} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
                {item.screens.slice(0, 3).map((s, i) => {
                  const side = i === 0 ? 0 : i === 1 ? -1 : 1;
                  return (
                    <motion.img
                      key={s.id}
                      src={`/showcase/${item.slug}/${s.id}.thumb.webp`}
                      alt=""
                      initial={{ y: 40, rotate: 0, opacity: 0 }}
                      animate={{ y: side ? 34 : 0, x: `${side * 62}%`, rotate: side * 6, opacity: 1 }}
                      transition={{ duration: 1, delay: 0.1 + i * 0.08, ease: EASE }}
                      className="absolute left-1/2 top-0 w-[44%] rounded-[22px] shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)] ring-1 ring-white/10"
                      style={{ zIndex: side ? 0 : 1, marginLeft: "-22%" }}
                    />
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={item?.slug || "none"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            <p className="display max-w-md text-[26px] leading-snug text-white">{item ? `“${item.prompt}”` : "Every design starts as a single sentence."}</p>
            {item && (
              <p className="mt-3 text-sm text-white/55">
                {item.name} · {item.skillName}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid h-full overflow-y-auto bg-paper lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="relative flex min-h-full flex-col px-6 py-6 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-12">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            <h1 className="display text-[40px] leading-[1.05]">{title}</h1>
            {subtitle && <p className="mt-3 text-[15px] leading-relaxed text-mute">{subtitle}</p>}
            <div className="mt-9">{children}</div>
            {footer && <div className="mt-8 text-sm text-mute">{footer}</div>}
          </motion.div>
        </div>
        <p className="text-xs text-faint">© {new Date().getFullYear()} Pipsqueak</p>
      </div>
      <Gallery />
    </div>
  );
}

function useNext() {
  const [params] = useSearchParams();
  const next = params.get("next");
  return { next: safeNext(next), query: next ? `?next=${encodeURIComponent(next)}` : "" };
}

const linkClass = "font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink";

export function SignIn() {
  const { query } = useNext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message === "Invalid login credentials" ? "That email and password don't match an account." : error.message);
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <>
          New to Pipsqueak?{" "}
          <Link to={`/signup${query}`} className={linkClass}>
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label="Email" type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" />
        <TextField
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          right={
            <Link to="/forgot-password" className="text-xs text-mute transition-colors hover:text-ink">
              Forgot password?
            </Link>
          }
        />
        <FormMessage>{error}</FormMessage>
        <Button type="submit" size="lg" full disabled={busy} iconRight={busy ? undefined : ArrowRight} className="mt-2">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export function SignUp() {
  const { next, query } = useNext();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sentTo, setSentTo] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin + next },
    });
    setBusy(false);
    if (error) setError(error.message);
    else if (!data.session) setSentTo(email);
  };

  if (sentTo) {
    return (
      <AuthLayout title="Check your inbox" subtitle={`We sent a confirmation link to ${sentTo}.`}>
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm text-mute">
          <MailCheck className="mt-0.5 shrink-0 text-ink" size={18} />
          Open the link to confirm your email, then sign in.
        </div>
        <Link to={`/signin${query}`} className={`mt-6 inline-flex text-sm ${linkClass}`}>
          Go to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Start designing"
      subtitle="Create your account. Your first design is a sentence away."
      footer={
        <>
          Already have an account?{" "}
          <Link to={`/signin${query}`} className={linkClass}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label="Name" required autoComplete="name" autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        <TextField label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" />
        <div>
          <TextField label="Password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
          <StrengthMeter password={password} />
        </div>
        <FormMessage>{error}</FormMessage>
        <Button type="submit" size="lg" full disabled={busy} iconRight={busy ? undefined : ArrowRight} className="mt-2">
          {busy ? "Creating your account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send you a link to choose a new one."
      footer={
        <Link to="/signin" className="inline-flex items-center gap-1.5 font-medium text-ink transition-colors hover:text-ink-2">
          <ArrowLeft size={15} /> Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm text-mute">
          <MailCheck className="mt-0.5 shrink-0 text-ink" size={18} />
          If an account exists for {email}, a reset link is on its way. It can take a minute to arrive.
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <TextField label="Email" type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" />
          <FormMessage>{error}</FormMessage>
          <Button type="submit" size="lg" full disabled={busy} className="mt-2">
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPassword() {
  const { ready, user, setRecovering } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!ready) return <Splash />;
  if (!user) {
    return (
      <AuthLayout title="This link has expired" subtitle="Reset links work once and expire after a while. Ask for a fresh one.">
        <Button size="lg" full onClick={() => navigate("/forgot-password")}>
          Send a new link
        </Button>
      </AuthLayout>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else {
      setRecovering(false);
      navigate("/app", { replace: true });
    }
  };

  return (
    <AuthLayout title="Choose a new password" subtitle={`For ${user.email}`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <TextField label="New password" type="password" required minLength={6} autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          <StrengthMeter password={password} />
        </div>
        <TextField label="Confirm new password" type="password" required minLength={6} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <FormMessage>{error}</FormMessage>
        <Button type="submit" size="lg" full disabled={busy} className="mt-2">
          {busy ? "Saving…" : "Save password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
