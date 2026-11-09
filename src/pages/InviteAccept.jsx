import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, LoaderCircle, Users } from "lucide-react";
import { useSession, Notice, Splash } from "../session";
import { Button } from "../ui";
import { acceptWorkspaceInvite } from "../share";
import { Mark } from "../brand";

export function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleJoin = async () => {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await acceptWorkspaceInvite(token);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err.message || "Couldn't accept invite.");
      setBusy(false);
    }
  };

  if (!user) {
    const nextUrl = encodeURIComponent(`/invite/${token}`);
    return (
      <div className="grid min-h-screen place-items-center bg-paper p-6 text-ink">
        <div className="w-full max-w-sm rounded-3xl border border-line bg-surface p-7 text-center shadow-soft">
          <Mark size={40} className="mx-auto" />
          <h1 className="display mt-4 text-2xl font-bold">Workspace Invitation</h1>
          <p className="mt-1.5 text-sm text-mute">Sign in or create an account to accept your team workspace invitation.</p>
          <div className="mt-6 flex flex-col gap-2">
            <Link to={`/signin?next=${nextUrl}`} className="inline-flex h-10 items-center justify-center rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink-2">
              Sign In to Accept
            </Link>
            <Link to={`/signup?next=${nextUrl}`} className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-wash px-5 text-sm font-medium text-ink hover:border-ink">
              Create an Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-paper p-6 text-ink">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-surface p-7 text-center shadow-soft">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Users size={24} />
        </div>
        <h1 className="display mt-4 text-2xl font-bold">Team Invitation</h1>
        <p className="mt-1.5 text-sm text-mute">You've been invited to join a collaborative workspace on Pipsqueak.</p>
        {error && <p className="mt-3 text-xs text-danger">{error}</p>}
        <div className="mt-6">
          <Button className="w-full" size="lg" disabled={busy} onClick={handleJoin}>
            {busy ? "Joining…" : "Accept & Join Workspace"}
          </Button>
        </div>
      </div>
    </div>
  );
}
