import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle2, MessageSquare, Monitor, Smartphone, Sparkles, Vote } from "lucide-react";
import { Notice, Splash } from "../session";
import { Button, Segmented, cx, fireBurst } from "../ui";
import { castPollVote, getPoll, watchPollVotes } from "../share";
import { Frame } from "../studio/Frame";
import { VIEWPORTS } from "../design/engine.js";
import { Mark } from "../brand";

const VOTER_KEY = "pq.poll.voterKey";

function getOrMakeVoterKey() {
  let k = localStorage.getItem(VOTER_KEY);
  if (!k) {
    k = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(VOTER_KEY, k);
  }
  return k;
}

export function PollView() {
  const { token } = useParams();
  const voterKey = useMemo(() => getOrMakeVoterKey(), []);
  const [poll, setPoll] = useState(null);
  const [status, setStatus] = useState("loading");
  const [activeTab, setActiveTab] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState("mobile");

  const load = () =>
    getPoll(token, voterKey)
      .then((data) => {
        if (!data) setStatus("gone");
        else {
          setPoll(data);
          setStatus("ok");
        }
      })
      .catch(() => setStatus("error"));

  useEffect(() => {
    load();
  }, [token, voterKey]);

  useEffect(() => {
    if (!poll?.id) return;
    const stop = watchPollVotes(poll.id, load);
    return () => stop();
  }, [poll?.id]);

  useEffect(() => {
    if (poll?.title) document.title = `${poll.title} · Pipsqueak Poll`;
  }, [poll?.title]);

  const handleVote = async (optionId) => {
    if (busy || !poll) return;
    setBusy(true);
    try {
      const res = await castPollVote(token, optionId, voterKey, feedback.trim() || null);
      setPoll((p) => ({
        ...p,
        hasVoted: true,
        votedOption: optionId,
        totalVotes: res.totalVotes,
        voteCounts: res.voteCounts,
      }));
      fireBurst();
    } catch (err) {
      alert(err.message || "Couldn't record vote.");
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") return <Splash />;

  if (status === "gone" || status === "error" || !poll) {
    return (
      <Notice
        title={status === "error" ? "Couldn't load this poll" : "This poll isn't active"}
        action={
          <div className="mt-6 flex justify-center">
            <Link to="/" className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-white">
              Go to Pipsqueak
            </Link>
          </div>
        }
      >
        {status === "error" ? "Check your connection and try again." : "The designer turned this poll off, or it has expired."}
      </Notice>
    );
  }

  const vp = VIEWPORTS[device];
  const options = poll.options || [];
  const total = Number(poll.totalVotes || 0);
  const counts = poll.voteCounts || {};

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      {/* Header Bar */}
      <header className="border-b border-line bg-surface/80 backdrop-blur sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <Mark size={24} />
            <span className="font-semibold text-sm tracking-tight hidden sm:inline">Pipsqueak Poll</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            id="device-toggle"
            value={device}
            onChange={setDevice}
            options={[
              { value: "mobile", label: "Mobile", icon: <Smartphone size={13} /> },
              { value: "desktop", label: "Desktop", icon: <Monitor size={13} /> },
            ]}
          />
        </div>
      </header>

      {/* Main Question Header */}
      <div className="mx-auto max-w-4xl px-4 pt-8 pb-4 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent mb-3">
          <Vote size={13} /> Design Poll · {total} {total === 1 ? "vote" : "votes"}
        </span>
        <h1 className="display text-2xl sm:text-3xl font-bold tracking-tight">{poll.question}</h1>
        {poll.hasVoted && (
          <p className="mt-2 text-xs font-medium text-emerald-600 flex items-center justify-center gap-1">
            <CheckCircle2 size={13} /> You voted! Results update live.
          </p>
        )}
      </div>

      {/* Poll Options Grid / Layout */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {options.map((opt, idx) => {
            const count = Number(counts[opt.id] || 0);
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const isVoted = poll.votedOption === opt.id;

            return (
              <motion.div
                key={opt.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.1 }}
                className={cx(
                  "rounded-3xl border bg-surface overflow-hidden shadow-soft flex flex-col transition-all",
                  isVoted ? "border-accent ring-2 ring-accent/20" : "border-line",
                )}
              >
                {/* Option Header & Vote Action */}
                <div className="p-4 border-b border-line flex items-center justify-between gap-3 bg-wash/60">
                  <div>
                    <h2 className="text-base font-bold text-ink flex items-center gap-2">
                      <span>{opt.name || `Option ${String.fromCharCode(65 + idx)}`}</span>
                      {isVoted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent text-white px-2 py-0.5 text-[10px] font-bold">
                          <Check size={10} /> Your Choice
                        </span>
                      )}
                    </h2>
                    {poll.hasVoted && (
                      <div className="text-xs text-mute mt-0.5">
                        {count} {count === 1 ? "vote" : "votes"} ({pct}%)
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={isVoted ? "primary" : "secondary"}
                    disabled={busy || isVoted}
                    onClick={() => handleVote(opt.id)}
                  >
                    {isVoted ? "Voted" : `Vote for Option ${String.fromCharCode(65 + idx)}`}
                  </Button>
                </div>

                {/* Live Percentage Bar */}
                {poll.hasVoted && (
                  <div className="h-1.5 w-full bg-line-soft overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className={cx("h-full", isVoted ? "bg-accent" : "bg-ink-2")}
                    />
                  </div>
                )}

                {/* Frame Container */}
                <div className="p-4 flex justify-center bg-paper/60 overflow-x-auto min-h-[480px]">
                  <div
                    style={{ width: vp.w, height: device === "mobile" ? 640 : 500 }}
                    className="rounded-2xl overflow-hidden border border-line shadow-md bg-white scale-[0.85] sm:scale-100 origin-top"
                  >
                    <Frame
                      screenId={opt.screen_id || opt.id}
                      html={opt.html}
                      system={poll.system}
                      kit={poll.kit}
                      width={vp.w}
                      scale={1}
                      interactive={true}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Feedback Section */}
        {!poll.hasVoted && (
          <div className="mt-8 max-w-lg mx-auto rounded-2xl border border-line bg-surface p-4 text-center">
            <label className="text-xs font-semibold text-mute block mb-2">Have specific feedback on the directions? (Optional)</label>
            <input
              type="text"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. Option A feels cleaner, but B has better contrast..."
              maxLength={200}
              className="h-10 w-full rounded-xl border border-line bg-wash px-3.5 text-xs text-ink outline-none focus:border-ink"
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-line py-4 px-6 text-center text-xs text-mute mt-auto">
        Powered by{" "}
        <Link to="/" className="underline hover:text-ink">
          Pipsqueak Design Studio
        </Link>
      </footer>
    </div>
  );
}
