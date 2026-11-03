import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Link2, LoaderCircle, RefreshCw, Smartphone } from "lucide-react";
import { Button, Dialog, Segmented, Switch } from "../ui";
import { DEVICE_LINK_HOURS, createShare, deleteShare, deviceShare, getShare, rotateShare, shareUrl, updateShare } from "../share";

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
      <input readOnly value={value} aria-label="Link" onFocus={(e) => e.target.select()} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-wash px-3 font-mono text-[12px] text-ink-2 outline-none focus:border-ink" />
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
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getShare(project.id, "link")
      .then(setShare)
      .catch((err) => {
        setShare(null);
        toast(err.message, "error");
      });
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
        <p className="text-sm text-mute">Make a link anyone can open to tap through {project.name}, no account needed. Your chat, review and version history stay private.</p>
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
  const set = (patch) => run(async () => setShare(await updateShare(share.token, patch)));
  return (
    <div>
      <p className="mb-3 text-sm text-mute">Anyone with this link can tap through every screen. It shows your latest changes.</p>
      <CopyField value={url} />
      <div className="mt-3 divide-y divide-line-soft">
        <Option
          title="Viewers can comment"
          description="People with the link can pin comments to any element. They show up in your Comments tab."
          on={share.allow_comments}
          disabled={busy}
          onChange={(v) => set({ allow_comments: v })}
        />
        <Option
          title="Signed-in viewers can remix"
          description="They get their own copy to edit, without your chat, review or history. Your design doesn't change."
          on={share.allow_remix}
          disabled={busy}
          onChange={(v) => set({ allow_remix: v })}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13px] font-medium hover:border-line-strong">
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
      <div className="shrink-0 rounded-2xl border border-line bg-white p-3 [&>svg]:block [&>svg]:h-full [&>svg]:w-full" style={{ width: 196, height: 196 }} role="img" aria-label="QR code for the phone preview" dangerouslySetInnerHTML={{ __html: svg }} />
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
        ]}
      />
      {tab === "link" ? <LinkPanel project={project} flush={flush} toast={toast} /> : <PhonePanel project={project} flush={flush} toast={toast} />}
      {tab === "phone" && (
        <p className="mt-5 flex items-center gap-1.5 text-xs text-faint">
          <Smartphone size={12} /> Works with any phone browser. No app or sign-in needed.
        </p>
      )}
    </Dialog>
  );
}
