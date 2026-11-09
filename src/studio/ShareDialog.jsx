import { useEffect, useRef, useState } from "react";
import {
  BarChart2,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  KeyRound,
  Link2,
  LoaderCircle,
  Lock,
  RefreshCw,
  Smartphone,
  Vote,
} from "lucide-react";
import { Button, Dialog, Segmented, Switch } from "../ui";
import {
  DEVICE_LINK_HOURS,
  createPoll,
  createShare,
  deleteShare,
  deviceShare,
  getShare,
  getShareStats,
  listProjectPolls,
  pollUrl,
  rotateShare,
  shareUrl,
  updateShare,
} from "../share";

function CopyField({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={value}
        aria-label="Link"
        onFocus={(e) => e.target.select()}
        className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-wash px-3 font-mono text-[12px] text-ink-2 outline-none focus:border-ink"
      />
      <Button size="sm" variant="secondary" icon={copied ? Check : Copy} onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function Option({ title, description, on, onChange, disabled }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-0.5 text-xs text-mute">{description}</div>
      </div>
      <span className={disabled ? "pointer-events-none opacity-50" : ""}>
        <Switch on={on} onChange={onChange} label={title} />
      </span>
    </div>
  );
}

function LinkPanel({ project, flush, toast }) {
  const [share, setShare] = useState(undefined);
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);
  const [passcodeDraft, setPasscodeDraft] = useState("");
  const [hasPasscode, setHasPasscode] = useState(false);
  const latest = useRef(0);

  const loadData = () => {
    getShare(project.id, "link")
      .then((s) => {
        setShare(s);
        setHasPasscode(!!s?.passcode);
        setPasscodeDraft(s?.passcode || "");
        if (s?.token) getShareStats(s.token).then(setStats);
      })
      .catch((err) => {
        setShare(null);
        toast(err.message, "error");
      });
  };

  useEffect(() => {
    loadData();
  }, [project.id]);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast(err.message || "That didn't work. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (share === undefined) return <LoaderCircle size={18} className="mx-auto my-8 animate-spin text-mute" />;

  if (!share) {
    return (
      <div className="py-2">
        <p className="text-sm text-mute">
          Make a link anyone can open to tap through {project.name}, no account needed. Your chat, review and version history stay private.
        </p>
        <Button
          className="mt-4"
          icon={Link2}
          disabled={busy}
          onClick={() =>
            run(async () => {
              await flush();
              setShare(await createShare(project.id, { kind: "link" }));
            })
          }
        >
          Create link
        </Button>
      </div>
    );
  }

  const url = shareUrl(share.token);

  const set = (patch) => {
    const seq = ++latest.current;
    setShare((sh) => ({ ...sh, ...patch }));
    run(async () => {
      const saved = await updateShare(share.token, patch).catch((err) => {
        if (seq === latest.current) setShare((sh) => ({ ...sh, ...Object.fromEntries(Object.keys(patch).map((k) => [k, !patch[k]])) }));
        throw err;
      });
      if (seq === latest.current) setShare(saved);
    });
  };

  const handleExpiryChange = (val) => {
    let expiresAt = null;
    if (val === "24h") expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    else if (val === "7d") expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    else if (val === "30d") expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    set({ expires_at: expiresAt });
  };

  const currentExpiryValue = () => {
    if (!share.expires_at) return "never";
    const diff = new Date(share.expires_at).getTime() - Date.now();
    if (diff <= 25 * 3600 * 1000) return "24h";
    if (diff <= 8 * 24 * 3600 * 1000) return "7d";
    return "30d";
  };

  const savePasscode = () => {
    if (hasPasscode && passcodeDraft.trim().length >= 4) {
      set({ passcode: passcodeDraft.trim() });
      toast("Passcode updated");
    } else if (!hasPasscode) {
      set({ passcode: null });
      setPasscodeDraft("");
      toast("Passcode removed");
    }
  };

  const expiryLabel = share.expires_at
    ? `Expires ${new Date(share.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
    : "Never expires";

  return (
    <div className="space-y-4">
      <p className="text-sm text-mute">Anyone with this link can tap through every screen. It shows your latest changes.</p>
      <CopyField value={url} />

      {/* Analytics Card */}
      {stats && (
        <div className="rounded-2xl border border-line bg-wash p-3.5 text-xs">
          <div className="flex items-center justify-between font-semibold text-ink">
            <span className="flex items-center gap-1.5">
              <BarChart2 size={13} /> Link Activity
            </span>
            <span className="text-mute">{stats.lastViewed ? `Last viewed ${new Date(stats.lastViewed).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "No visits yet"}</span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface p-2 shadow-xs">
              <div className="text-base font-bold text-ink">{stats.total}</div>
              <div className="text-[11px] text-mute">Total views</div>
            </div>
            <div className="rounded-xl bg-surface p-2 shadow-xs">
              <div className="text-base font-bold text-ink">{stats.mobile}</div>
              <div className="text-[11px] text-mute">📱 Mobile</div>
            </div>
            <div className="rounded-xl bg-surface p-2 shadow-xs">
              <div className="text-base font-bold text-ink">{stats.desktop}</div>
              <div className="text-[11px] text-mute">💻 Desktop</div>
            </div>
          </div>
          {stats.screens && stats.screens.length > 0 && (
            <div className="mt-3 border-t border-line/60 pt-2.5">
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-mute">
                <span>Screen Attention Heatmap</span>
                <span>Avg Dwell</span>
              </div>
              <div className="space-y-1.5">
                {stats.screens.map((sc, i) => {
                  const maxViews = Math.max(...stats.screens.map((s) => s.views || 1), 1);
                  const pct = Math.round(((sc.views || 0) / maxViews) * 100);
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-28 truncate font-medium text-ink">{sc.screen}</span>
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-line-soft">
                        <div
                          style={{ width: `${Math.max(8, pct)}%` }}
                          className="h-full rounded-full bg-accent transition-all duration-500"
                        />
                      </div>
                      <span className="w-14 text-right font-mono text-[11px] text-mute">{sc.avg_seconds || 0}s</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Permissions & Controls */}
      <div className="divide-y divide-line-soft">
        <Option
          title="Viewers can comment & reply"
          description="People with the link can pin comments and thread replies. They show up in your Comments tab."
          on={share.allow_comments}
          onChange={(v) => set({ allow_comments: v })}
        />
        <Option
          title="Signed-in viewers can remix"
          description="They get their own copy to edit, without your chat, review or history."
          on={share.allow_remix}
          onChange={(v) => set({ allow_remix: v })}
        />

        {/* Expiry Selector */}
        <div className="py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Link expiration</div>
              <div className="mt-0.5 text-xs text-mute">{expiryLabel}</div>
            </div>
            <Segmented
              id="expiry-seg"
              value={currentExpiryValue()}
              onChange={handleExpiryChange}
              options={[
                { value: "never", label: "Never" },
                { value: "24h", label: "24h" },
                { value: "7d", label: "7 days" },
                { value: "30d", label: "30 days" },
              ]}
            />
          </div>
        </div>

        {/* Passcode Protection */}
        <div className="py-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Require passcode to view</div>
              <div className="mt-0.5 text-xs text-mute">Viewers must enter this passcode before opening the design.</div>
            </div>
            <Switch
              on={hasPasscode}
              onChange={(on) => {
                setHasPasscode(on);
                if (!on) set({ passcode: null });
              }}
              label="Require passcode"
            />
          </div>
          {hasPasscode && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={passcodeDraft}
                onChange={(e) => setPasscodeDraft(e.target.value)}
                placeholder="Set 4+ character passcode"
                maxLength={32}
                className="h-9 min-w-0 flex-1 rounded-xl border border-line bg-wash px-3 font-mono text-xs outline-none focus:border-ink"
              />
              <Button size="sm" variant="secondary" onClick={savePasscode} disabled={passcodeDraft.trim().length < 4}>
                Save
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Share Preview Card Mockup */}
      <div className="rounded-2xl border border-line p-3 text-xs bg-surface shadow-xs">
        <div className="font-semibold text-mute mb-1.5 flex items-center gap-1">
          <Eye size={12} /> Link preview in Slack / Messages
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-wash p-2.5">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-ink text-white grid place-items-center font-bold text-sm">
            PQ
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate text-ink">{project.name} · Pipsqueak</div>
            <div className="text-mute truncate text-[11px]">{project.tagline || `${project.screens?.length || 1} screens · Interactive prototype`}</div>
            <div className="text-faint text-[10px] mt-0.5">{location.host}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13px] font-medium hover:border-line-strong"
        >
          <ExternalLink size={14} /> Open
        </a>
        <Button
          size="sm"
          variant="secondary"
          icon={RefreshCw}
          disabled={busy}
          onClick={() => window.confirm("Make a new link? The current one stops working.") && run(async () => setShare(await rotateShare(share)))}
        >
          New link
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={busy}
          onClick={() =>
            window.confirm("Turn this link off? Anyone who has it can no longer open the design.") &&
            run(async () => {
              await deleteShare(share.token);
              setShare(null);
            })
          }
        >
          Turn off link
        </Button>
      </div>
    </div>
  );
}

function PhonePanel({ project, flush, toast }) {
  const [share, setShare] = useState(null);
  const [svg, setSvg] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        await flush();
        const s = await deviceShare(project.id);
        const QR = await import("qrcode");
        const markup = await QR.toString(shareUrl(s.token), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#17150F", light: "#FFFFFF" } });
        if (live) {
          setShare(s);
          setSvg(markup);
        }
      } catch (err) {
        if (live) setError(err.message || "Couldn't make the preview link.");
      }
    })();
    return () => {
      live = false;
    };
  }, [project.id]);

  if (error) {
    return <p className="py-6 text-center text-sm text-danger">{error}</p>;
  }
  if (!share) return <LoaderCircle size={18} className="mx-auto my-8 animate-spin text-mute" />;
  const expires = new Date(share.expires_at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      <div
        className="shrink-0 rounded-2xl border border-line bg-white p-3 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        style={{ width: 196, height: 196 }}
        role="img"
        aria-label="QR code for the phone preview"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="min-w-0 flex-1">
        <ol className="list-decimal space-y-1.5 pl-4 text-sm text-ink-2">
          <li>Point your phone's camera at the code.</li>
          <li>Open the link. {project.name} fills the screen; tap through it like the real app.</li>
          <li>Keep it open while you design: it updates within seconds of each change.</li>
        </ol>
        <p className="mt-3 text-xs text-mute">
          Anyone with this link can view the design until {expires} ({DEVICE_LINK_HOURS} hours, renewed each time you open this).
        </p>
        <div className="mt-3">
          <CopyField value={shareUrl(share.token)} />
        </div>
      </div>
    </div>
  );
}

function PollPanel({ project, toast }) {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("Which design do you prefer?");
  const [selectedScreens, setSelectedScreens] = useState(() => project.screens.slice(0, 2).map((s) => s.id));
  const [busy, setBusy] = useState(false);

  const screens = project.screens.filter((s) => s.html);

  useEffect(() => {
    listProjectPolls(project.id)
      .then(setPolls)
      .finally(() => setLoading(false));
  }, [project.id]);

  const toggleScreen = (id) => {
    if (selectedScreens.includes(id)) {
      if (selectedScreens.length <= 2) {
        toast("A poll needs at least 2 options", "error");
        return;
      }
      setSelectedScreens(selectedScreens.filter((x) => x !== id));
    } else {
      setSelectedScreens([...selectedScreens, id]);
    }
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    if (selectedScreens.length < 2 || busy) return;
    setBusy(true);
    try {
      const options = selectedScreens.map((id, index) => {
        const sc = screens.find((s) => s.id === id);
        return {
          id: `opt_${index + 1}`,
          screen_id: id,
          name: sc?.name || `Option ${String.fromCharCode(65 + index)}`,
          html: sc?.html || "",
        };
      });
      const p = await createPoll({
        projectId: project.id,
        title: `${project.name} Variant Poll`,
        question,
        options,
      });
      setPolls([p, ...polls]);
      setCreating(false);
      toast("Design poll created!");
    } catch (err) {
      toast(err.message || "Couldn't create poll", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoaderCircle size={18} className="mx-auto my-8 animate-spin text-mute" />;

  if (creating) {
    return (
      <form onSubmit={handleCreatePoll} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-ink">Poll Question</label>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-line bg-wash px-3 text-sm outline-none focus:border-ink"
            placeholder="e.g. Which landing page direction fits our brand best?"
            maxLength={180}
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink">Select Screens to Compare (Pick 2+)</label>
          <div className="mt-2 grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {screens.map((sc) => {
              const active = selectedScreens.includes(sc.id);
              return (
                <button
                  type="button"
                  key={sc.id}
                  onClick={() => toggleScreen(sc.id)}
                  className={`flex items-center justify-between rounded-xl border p-2.5 text-left text-xs transition-colors ${
                    active ? "border-ink bg-surface shadow-xs font-semibold" : "border-line bg-wash opacity-70"
                  }`}
                >
                  <span className="truncate">{sc.name}</span>
                  {active && <Check size={14} className="text-accent" />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={selectedScreens.length < 2 || busy}>
            {busy ? "Creating…" : "Publish Poll"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-mute">Share two or more design directions and let stakeholders or users vote on their favorite.</p>
        <Button size="sm" icon={Vote} onClick={() => setCreating(true)}>
          New Poll
        </Button>
      </div>

      {polls.length === 0 ? (
        <div className="rounded-2xl border border-line bg-wash p-5 text-center text-xs text-mute">
          No polls created yet. Click New Poll to compare screens side-by-side and collect votes.
        </div>
      ) : (
        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {polls.map((p) => {
            const link = pollUrl(p.token);
            return (
              <div key={p.id} className="rounded-2xl border border-line p-3 bg-surface shadow-xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-ink">{p.question}</div>
                    <div className="text-xs text-mute">{p.options?.length || 0} variants being compared</div>
                  </div>
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    <ExternalLink size={12} /> Open
                  </a>
                </div>
                <CopyField value={link} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ShareDialog({ project, initial = "link", flush, toast, onClose }) {
  const [tab, setTab] = useState(initial);
  return (
    <Dialog title={`Share ${project.name}`} onClose={onClose} size="md">
      <Segmented
        id="share-tab"
        className="mb-5"
        value={tab}
        onChange={setTab}
        options={[
          { value: "link", label: "Share link" },
          { value: "phone", label: "Preview on phone" },
          { value: "poll", label: "Design poll" },
        ]}
      />
      {tab === "link" && <LinkPanel project={project} flush={flush} toast={toast} />}
      {tab === "phone" && <PhonePanel project={project} flush={flush} toast={toast} />}
      {tab === "poll" && <PollPanel project={project} toast={toast} />}
      {tab === "phone" && (
        <p className="mt-5 flex items-center gap-1.5 text-xs text-faint">
          <Smartphone size={12} /> Works with any phone browser. No app or sign-in needed.
        </p>
      )}
    </Dialog>
  );
}
