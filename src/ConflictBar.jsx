import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloudAlert, RefreshCw } from "lucide-react";
import { useStore } from "./store";
import { Button } from "./ui";

// Shows designs that changed in another tab or on another device and lets the
// user pick which copy to keep. Nothing is overwritten without a choice.
export function ConflictBar() {
  const { s, api } = useStore();
  const [busy, setBusy] = useState(null);
  const entries = Object.entries(s.conflicts || {})
    .map(([id, kind]) => ({ id, kind, project: s.data.projects.find((p) => p.id === id) }))
    .filter((e) => e.project);
  const run = async (id, fn) => {
    setBusy(id);
    try {
      await fn(id);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[95] flex flex-col items-center gap-2 px-3">
      <AnimatePresence>
        {entries.map(({ id, kind, project }) => (
          <motion.div
            key={id + kind}
            role="alert"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pointer-events-auto flex w-full max-w-xl flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm shadow-lift"
          >
            <span className="flex min-w-0 flex-1 items-start gap-2.5">
              {kind === "stale" ? <RefreshCw size={16} className="mt-0.5 shrink-0 text-accent" /> : <CloudAlert size={16} className="mt-0.5 shrink-0 text-danger" />}
              <span className="min-w-0">
                <span className="font-semibold">{project.name}</span>{" "}
                {kind === "stale"
                  ? "was updated in another tab or on another device."
                  : kind === "deleted"
                    ? "was deleted in another tab or on another device."
                    : "was changed in another tab or on another device while this tab had unsaved changes. Your changes here aren't saved yet."}
              </span>
            </span>
            <span className="flex shrink-0 gap-2">
              {kind === "stale" ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => api.dismissStale(id)}>
                    Not now
                  </Button>
                  <Button size="sm" disabled={busy === id} onClick={() => run(id, api.useTheirs)}>
                    Load latest
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="secondary" disabled={busy === id} onClick={() => run(id, api.useTheirs)}>
                    {kind === "deleted" ? "Let it go" : "Use theirs"}
                  </Button>
                  <Button size="sm" disabled={busy === id} onClick={() => run(id, api.keepMine)}>
                    {kind === "deleted" ? "Keep it" : "Keep mine"}
                  </Button>
                </>
              )}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
