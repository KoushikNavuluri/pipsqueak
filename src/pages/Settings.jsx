import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Download, LogOut, MonitorSmartphone, Trash2, Upload } from "lucide-react";
import { supabase } from "../supabase";
import { displayName, useSession } from "../session";
import { useStore } from "../store";
import { Logo, PipGlyph } from "../brand";
import { Button, Dialog, EASE, Segmented, Switch, cx } from "../ui";
import { download } from "../util";
import { useCredits } from "../credits";
import { removeAllArtwork } from "../ai/images";
import { Avatar } from "./Avatar";
import { UserMenu } from "./UserMenu";
import { FormMessage, StrengthMeter, TextArea, TextField, inputClass } from "./forms";

const SECTIONS = [
  ["profile", "Profile"],
  ["account", "Account"],
  ["preferences", "Preferences"],
  ["voice", "Brand voice"],
  ["usage", "Usage"],
  ["data", "Your data"],
  ["danger", "Delete account"],
];

const ACTIONS = {
  understand: "Understood a brief",
  systems: "Built design systems",
  screen: "Designed a screen",
  edit_html: "Edited a screen",
  copilot: "Planned a change",
  critique: "Reviewed a design",
  brief: "Refined an idea",
  image: "Painted an image",
};

function Panel({ id, title, description, children, footer, tone }) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: EASE }}
      className={cx("scroll-mt-24 overflow-hidden rounded-3xl border bg-surface shadow-soft", tone === "danger" ? "border-danger-line" : "border-line")}
    >
      <div className="px-6 pb-2 pt-6 sm:px-8">
        <h2 className={cx("display text-[22px] leading-tight", tone === "danger" && "text-danger")}>{title}</h2>
        {description && <p className="mt-1 text-sm text-mute">{description}</p>}
      </div>
      <div className="px-6 pb-6 pt-4 sm:px-8">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line-soft bg-wash px-6 py-3.5 sm:px-8">{footer}</div>}
    </motion.section>
  );
}

function Row({ title, description, children }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line-soft py-4 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        {description && <div className="mt-0.5 text-[13px] text-mute">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// Crops an image to a centred square and shrinks it for use as an avatar.
async function toAvatarBlob(file, size = 256) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d").drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that image."))), "image/webp", 0.9));
}

async function removeAvatarFiles(userId, keep) {
  const { data } = await supabase.storage.from("avatars").list(userId);
  const stale = (data || []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (stale.length) await supabase.storage.from("avatars").remove(stale);
}

function ProfileSection() {
  const { user, profile, saveProfile } = useSession();
  const { api } = useStore();
  const file = useRef(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => setName(profile?.display_name ?? ""), [profile?.display_name]);
  const shown = displayName(user, profile);
  const dirty = name.trim() !== (profile?.display_name ?? "");

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveProfile({ display_name: name.trim() || null });
      api.toast("Profile saved", { tone: "success" });
    } catch (err) {
      api.toast(err.message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const upload = async (f) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return api.toast("Choose an image file", { tone: "error" });
    if (f.size > 10 * 1024 * 1024) return api.toast("That image is over 10 MB", { tone: "error" });
    setUploading(true);
    try {
      const blob = await toAvatarBlob(f);
      const path = `${user.id}/avatar-${Date.now()}.webp`;
      const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/webp", upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await saveProfile({ avatar_url: data.publicUrl });
      await removeAvatarFiles(user.id, path);
      api.toast("Photo updated", { tone: "success" });
    } catch (err) {
      api.toast(err.message || "Upload failed", { tone: "error" });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    setUploading(true);
    try {
      await removeAvatarFiles(user.id, null);
      await saveProfile({ avatar_url: null });
      api.toast("Photo removed");
    } catch (err) {
      api.toast(err.message || "Couldn't remove the photo", { tone: "error" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={save}>
      <Panel
        id="profile"
        title="Profile"
        description="How Pipsqueak greets you."
        footer={
          <Button type="submit" size="sm" disabled={!dirty || busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        }
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative w-fit">
            <Avatar name={shown} url={profile?.avatar_url} size={76} />
            <button
              type="button"
              onClick={() => file.current?.click()}
              disabled={uploading}
              aria-label="Change photo"
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-ink text-white transition-colors hover:bg-ink-2 disabled:opacity-50"
            >
              <Camera size={14} />
            </button>
            <input ref={file} type="file" accept="image/*" className="hidden" aria-label="Choose a photo" onChange={(e) => (upload(e.target.files?.[0]), (e.target.value = ""))} />
          </div>
          <div className="flex-1">
            <TextField label="Name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={user.email.split("@")[0]} autoComplete="name" />
            {profile?.avatar_url && (
              <button type="button" onClick={removePhoto} disabled={uploading} className="mt-2 text-[13px] text-mute underline-offset-2 hover:text-ink hover:underline">
                Remove photo
              </button>
            )}
          </div>
        </div>
      </Panel>
    </form>
  );
}

function AccountSection() {
  const { user } = useSession();
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState(null);
  const [pwMsg, setPwMsg] = useState(null);
  const [busy, setBusy] = useState(null);

  const changeEmail = async (e) => {
    e.preventDefault();
    setBusy("email");
    setMsg(null);
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: window.location.origin + "/app/settings" });
    setBusy(null);
    if (error) setMsg({ tone: "error", text: error.message });
    else {
      setMsg({ tone: "success", text: `Check ${email} for a confirmation link. Your email changes once you confirm it.` });
      setEmail("");
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setBusy("password");
    setPwMsg(null);
    const check = await supabase.auth.signInWithPassword({ email: user.email, password: current });
    if (check.error) {
      setBusy(null);
      return setPwMsg({ tone: "error", text: "Your current password is incorrect." });
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setBusy(null);
    if (error) setPwMsg({ tone: "error", text: error.message });
    else {
      setPwMsg({ tone: "success", text: "Password updated." });
      setCurrent("");
      setNext("");
    }
  };

  return (
    <Panel id="account" title="Account" description="How you sign in.">
      <form onSubmit={changeEmail} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-ink-2">Current email</div>
          <input value={user.email} disabled aria-label="Current email" className={inputClass} />
        </div>
        <TextField label="New email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" />
        <Button type="submit" variant="secondary" disabled={busy === "email" || !email} className="h-11">
          {busy === "email" ? "Sending…" : "Change email"}
        </Button>
      </form>
      {msg && (
        <div className="mt-3">
          <FormMessage tone={msg.tone}>{msg.text}</FormMessage>
        </div>
      )}
      <div className="my-6 h-px bg-line-soft" />
      <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
        <TextField label="Current password" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        <div>
          <TextField label="New password" type="password" autoComplete="new-password" required minLength={6} value={next} onChange={(e) => setNext(e.target.value)} />
          <StrengthMeter password={next} />
        </div>
        <Button type="submit" variant="secondary" disabled={busy === "password" || !current || next.length < 6} className="h-11 sm:mt-[26px]">
          {busy === "password" ? "Updating…" : "Update password"}
        </Button>
      </form>
      {pwMsg && (
        <div className="mt-3">
          <FormMessage tone={pwMsg.tone}>{pwMsg.text}</FormMessage>
        </div>
      )}
    </Panel>
  );
}

function PreferencesSection() {
  const { s, api } = useStore();
  const prefs = s.data.prefs;
  return (
    <Panel id="preferences" title="Preferences" description="Defaults for new designs and how the app feels.">
      <Row title="Start new designs as" description="You can still switch in the prompt box.">
        <Segmented
          id="pref-platform"
          size="sm"
          value={prefs.designPlatform}
          onChange={(designPlatform) => api.pref({ designPlatform })}
          options={[
            { value: "mobile", label: "Mobile app" },
            { value: "web", label: "Web app" },
            { value: "website", label: "Website" },
          ]}
        />
      </Row>
      <Row title="Design depth" description="Fast answers in seconds. Deep thinks longer for richer screens and sharper reviews.">
        <Segmented
          id="pref-quality"
          size="sm"
          value={prefs.aiQuality === "best" ? "best" : "fast"}
          onChange={(aiQuality) => api.pref({ aiQuality })}
          options={[
            { value: "fast", label: "Fast" },
            { value: "best", label: "Deep" },
          ]}
        />
      </Row>
      <Row title="Calm motion" description="Fewer animations throughout the app.">
        <Switch on={!!prefs.reduce} onChange={(reduce) => api.pref({ reduce })} label="Calm motion" />
      </Row>
    </Panel>
  );
}

const VOICES = ["Warm and witty", "Calm and precise", "Bold and playful", "Premium and minimal", "Friendly and plain-spoken"];
const EMPTY_VOICE = { voice: "", audience: "", locale: "", notes: "" };

function VoiceSection() {
  const { profile, saveProfile } = useSession();
  const { api } = useStore();
  const saved = { ...EMPTY_VOICE, ...(profile?.ai_taste || {}) };
  const [taste, setTaste] = useState(saved);
  const [busy, setBusy] = useState(false);
  useEffect(() => setTaste({ ...EMPTY_VOICE, ...(profile?.ai_taste || {}) }), [profile?.ai_taste]);
  const set = (key) => (e) => setTaste((t) => ({ ...t, [key]: typeof e === "string" ? e : e.target.value }));
  const dirty = Object.keys(EMPTY_VOICE).some((k) => (taste[k] || "").trim() !== (saved[k] || "").trim());

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveProfile({ ai_taste: Object.fromEntries(Object.keys(EMPTY_VOICE).map((k) => [k, (taste[k] || "").trim().slice(0, 300)])) });
      api.toast("Brand voice saved. Pip uses it from your next request.", { tone: "success" });
    } catch (err) {
      api.toast(err.message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save}>
      <Panel
        id="voice"
        title="Brand voice"
        description="Tell Pip how you like to design. It applies this to every brief, system and review."
        footer={
          <Button type="submit" size="sm" disabled={!dirty || busy}>
            {busy ? "Saving…" : "Save voice"}
          </Button>
        }
      >
        <div className="grid gap-5">
          <div>
            <TextField label="Voice" maxLength={120} value={taste.voice} onChange={set("voice")} placeholder="How the copy should sound" />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {VOICES.map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => set("voice")(v)}
                  className={cx("rounded-full border px-3 py-1 text-xs transition-colors", taste.voice === v ? "border-ink bg-ink text-white" : "border-line bg-surface hover:border-line-strong")}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Usual audience" maxLength={120} value={taste.audience} onChange={set("audience")} placeholder="Students in Pune, small café owners…" />
            <TextField label="Locale and currency" maxLength={80} value={taste.locale} onChange={set("locale")} placeholder="India, ₹, British spelling" />
          </div>
          <TextArea label="Style notes" maxLength={300} value={taste.notes} onChange={set("notes")} placeholder="Things you always want, or never want. For example: generous whitespace, no stock-photo moods." hint={`${(taste.notes || "").length}/300`} />
        </div>
      </Panel>
    </form>
  );
}

function UsageSection() {
  const { runs, used, limit } = useCredits();
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <Panel id="usage" title="Usage" description="Credits reset every day at midnight UTC. Failed requests are free.">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="display text-[44px] leading-none tabular-nums">{runs ? limit - used : "…"}</div>
          <div className="mt-1.5 text-sm text-mute">credits left today, of {limit}</div>
        </div>
        <PipGlyph size={28} />
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-sunken">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: EASE }} className={cx("h-full rounded-full", pct > 85 ? "bg-danger" : "bg-ink")} />
      </div>
      <p className="mt-3 text-xs text-faint">A new design with its image kit uses about 20. Images use 2, everything else 1.</p>
      {runs?.length > 0 && (
        <ul className="mt-5 divide-y divide-line-soft rounded-2xl border border-line">
          {runs.slice(0, 8).map((r) => (
            <li key={r.created_at + r.action} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="min-w-0 truncate">{ACTIONS[r.action] || "Design step"}</span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-mute">
                {r.status === "error" ? <span className="text-danger">Failed</span> : r.latency_ms ? `${(r.latency_ms / 1000).toFixed(1)}s` : "Running"}
                <span className="ml-3">{new Date(r.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const isDesign = (p) => p && typeof p === "object" && p.kind === "canvas" && typeof p.name === "string" && Array.isArray(p.screens) && !!p.system && p.screens.every((s) => typeof s?.html === "string");

function DataSection() {
  const { s, api } = useStore();
  const navigate = useNavigate();
  const file = useRef(null);
  const [busy, setBusy] = useState(false);
  const designs = s.data.projects.filter((p) => p.kind === "canvas");

  const exportAll = () => {
    const body = JSON.stringify({ app: "pipsqueak", version: 2, exportedAt: new Date().toISOString(), projects: designs }, null, 2);
    download(new Blob([body], { type: "application/json" }), "pipsqueak-designs.json");
    api.toast(`Exported ${designs.length} design${designs.length === 1 ? "" : "s"}`, { tone: "success" });
  };

  const importFile = async (f) => {
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text());
      const list = Array.isArray(parsed) ? parsed : parsed?.projects;
      const valid = Array.isArray(list) ? list.filter(isDesign) : [];
      if (!valid.length) throw new Error("none");
      api.importProjects(valid);
      const skipped = list.length - valid.length;
      api.toast(`Imported ${valid.length} design${valid.length === 1 ? "" : "s"}${skipped ? `, skipped ${skipped}` : ""}`, { tone: "success" });
    } catch {
      api.toast("That file doesn't contain any Pipsqueak designs", { tone: "error" });
    }
  };

  const signOut = async (scope) => {
    setBusy(true);
    await api.flush();
    navigate("/");
    await supabase.auth.signOut({ scope });
  };

  return (
    <Panel id="data" title="Your data" description="Everything is saved to your account as you work.">
      <Row title="Export designs" description={`${designs.length} design${designs.length === 1 ? "" : "s"} as a JSON file you can import again.`}>
        <Button variant="secondary" size="sm" icon={Download} onClick={exportAll} disabled={!designs.length}>
          Export
        </Button>
      </Row>
      <Row title="Import designs" description="Add designs from a Pipsqueak export file.">
        <Button variant="secondary" size="sm" icon={Upload} onClick={() => file.current?.click()}>
          Import
        </Button>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" aria-label="Choose a Pipsqueak export file" onChange={(e) => (importFile(e.target.files?.[0]), (e.target.value = ""))} />
      </Row>
      <Row title="Sign out" description="On this device, or everywhere you're signed in.">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={LogOut} disabled={busy} onClick={() => signOut("local")}>
            This device
          </Button>
          <Button variant="secondary" size="sm" icon={MonitorSmartphone} disabled={busy} onClick={() => signOut("global")}>
            Everywhere
          </Button>
        </div>
      </Row>
    </Panel>
  );
}

function DeleteAccountDialog({ onClose }) {
  const { user } = useSession();
  const { api } = useStore();
  const navigate = useNavigate();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.flush();
      const { data: files } = await supabase.storage.from("avatars").list(user.id);
      if (files?.length) await supabase.storage.from("avatars").remove(files.map((f) => `${user.id}/${f.name}`));
      await removeAllArtwork(user.id);
      const { error } = await supabase.rpc("delete_account");
      if (error) throw error;
      navigate("/", { replace: true, state: { notice: "Your account and designs have been deleted." } });
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    } catch (err) {
      setBusy(false);
      setError(err.message || "Couldn't delete your account");
    }
  };

  return (
    <Dialog
      title="Delete your account?"
      description="This can't be undone."
      onClose={busy ? () => {} : onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" icon={Trash2} disabled={typed !== "DELETE" || busy} onClick={remove}>
            {busy ? "Deleting…" : "Delete account"}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-mute">
        This permanently deletes <span className="font-medium text-ink">{user.email}</span>, every design, your images, preferences and profile photo.
      </p>
      <TextField className="mt-4" label="Type DELETE to confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      {error && (
        <div className="mt-3">
          <FormMessage>{error}</FormMessage>
        </div>
      )}
    </Dialog>
  );
}

export function Settings() {
  const location = useLocation();
  const [deleting, setDeleting] = useState(false);
  const [active, setActive] = useState("profile");

  useEffect(() => {
    const id = location.hash.slice(1);
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, [location.hash]);

  // Highlight the section in view.
  useEffect(() => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-30% 0px -60% 0px" });
    SECTIONS.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <div className="sb h-full overflow-y-auto">
      <header className="sticky top-0 z-30 bg-paper/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo to="/app" />
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-10 px-4 pb-28 pt-8 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:pt-14">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <div className="sticky top-24">
            <h1 className="display text-[34px] leading-none">Settings</h1>
            <ul className="mt-8 grid gap-0.5">
              {SECTIONS.map(([id, label]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={cx("relative block rounded-full px-3.5 py-2 text-sm transition-colors", active === id ? "font-medium text-ink" : "text-mute hover:text-ink")}
                  >
                    {active === id && <motion.span layoutId="settings-nav" className="absolute inset-0 rounded-full bg-sunken" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                    <span className="relative">{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
        <div className="grid min-w-0 gap-6">
          <h1 className="display text-[34px] leading-none lg:hidden">Settings</h1>
          <ProfileSection />
          <AccountSection />
          <PreferencesSection />
          <VoiceSection />
          <UsageSection />
          <DataSection />
          <Panel id="danger" tone="danger" title="Delete account" description="Remove your account and everything in it, for good.">
            <Button variant="danger" icon={Trash2} onClick={() => setDeleting(true)}>
              Delete account…
            </Button>
          </Panel>
        </div>
      </main>
      <AnimatePresence>{deleting && <DeleteAccountDialog key="delete" onClose={() => setDeleting(false)} />}</AnimatePresence>
    </div>
  );
}
