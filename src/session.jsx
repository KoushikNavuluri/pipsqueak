import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  Navigate,
  Outlet,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { supabase } from "./supabase";
import { prefetchCloud, takeCloud } from "./cloud";
import { StoreProvider, cleanData, emptyData, useStore } from "./store";
import { BurstLayer, Button, Toasts } from "./ui";
import { Mark, PipLoader } from "./brand";

const SessionContext = createContext(null);

export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [recovering, setRecovering] = useState(false);
  const userId = session?.user?.id;

  useEffect(() => {
    if (!supabase) {
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") {
        setRecovering(true);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Fetch app code and the user's designs ahead of time, whatever page they're on.
  useEffect(() => {
    if (session === undefined) return;
    import("./App").then((m) => m.prefetchApp(!!userId));
    if (userId) prefetchCloud(userId);
  }, [userId, session === undefined]);

  useEffect(() => {
    setProfile(null);
    if (!userId) {
      return;
    }
    let live = true;
    supabase
      .from("profiles")
      .select("id, display_name, bio, avatar_url, ai_taste, created_at")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("Loading profile failed", error);
        }
        if (live) {
          setProfile(
            data ?? {
              id: userId,
              display_name: null,
              bio: null,
              avatar_url: null,
            },
          );
        }
      });
    return () => {
      live = false;
    };
  }, [userId]);

  const saveProfile = useCallback(
    async (patch) => {
      const { data, error } = await supabase
        .from("profiles")
        .upsert({ id: userId, ...patch })
        .select("id, display_name, bio, avatar_url, ai_taste, created_at")
        .single();
      if (error) {
        throw error;
      }
      setProfile(data);
      return data;
    },
    [userId],
  );

  const value = {
    configured: !!supabase,
    ready: session !== undefined || !supabase,
    session,
    user: session?.user ?? null,
    profile,
    saveProfile,
    recovering,
    setRecovering,
  };
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

// The name to show for someone: their display name, else their email's
// local part.
export function displayName(user, profile) {
  return profile?.display_name || user?.email?.split("@")[0] || "You";
}

export function Splash() {
  return (
    <div className="grid h-full place-items-center bg-paper">
      <PipLoader size={44} />
    </div>
  );
}

export function Notice({ title, children, action }) {
  return (
    <div className="grid h-full place-items-center bg-paper p-6 text-center">
      <div className="animate-rise">
        <Mark size={40} className="mx-auto" />
        <h1 className="display mt-6 text-3xl">{title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-mute">{children}</p>
        {action}
      </div>
    </div>
  );
}

function NotConfigured() {
  return (
    <Notice title="Supabase isn't configured">
      Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart the dev server.
    </Notice>
  );
}

// Only lets a post-sign-in redirect go to a page inside the app.
export function safeNext(next) {
  return next && next.startsWith("/app") ? next : "/app";
}

export function RequireAuth() {
  const { configured, ready, user } = useSession();
  const location = useLocation();
  if (!configured) {
    return <NotConfigured />;
  }
  if (!ready) {
    return <Splash />;
  }
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/signin?next=${next}`} replace={true} />;
  }
  return <Outlet />;
}

// Sends people who are already signed in straight into the app.
export function GuestOnly() {
  const { configured, ready, user, recovering } = useSession();
  const [params] = useSearchParams();
  if (!configured) {
    return <NotConfigured />;
  }
  if (!ready) {
    return <Splash />;
  }
  if (user && !recovering) {
    return <Navigate to={safeNext(params.get("next"))} replace={true} />;
  }
  return <Outlet />;
}

// Applies the "Calm motion" preference to every page under /app.
function CalmMotion({ children }) {
  const { s } = useStore();
  return (
    <div className={"h-full w-full" + (s.data.prefs.reduce ? " reduce" : "")}>
      {children}
    </div>
  );
}

// Loads the signed-in user's projects, then provides the store to every page
// under /app.
export function AppData() {
  const { user } = useSession();
  const [cloud, setCloud] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    takeCloud(user.id)
      .then(({ projects, settings }) => {
        if (!live) {
          return;
        }
        if (projects.length === 0 && !settings) {
          // First sign-in: an empty workspace, saved on the first change.
          setCloud({ data: emptyData(), saved: null });
        } else {
          const saved = { projects, activeId: settings?.active_project_id ?? null, prefs: settings?.prefs ?? {} };
          // Anything cleaned up on load (old sample projects) is removed from
          // the cloud by the first save.
          setCloud({ data: cleanData(saved), saved });
        }
      })
      .catch((err) => {
        console.error("Loading from Supabase failed", err);
        if (live) {
          setError(err.message || String(err));
        }
      });
    return () => {
      live = false;
    };
  }, [user.id, attempt]);

  if (error) {
    return (
      <Notice
        title="Couldn't load your designs"
        action={
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
            <Button variant="secondary" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        }
      >
        {error}
      </Notice>
    );
  }
  if (!cloud) {
    return <Splash />;
  }
  return (
    <StoreProvider userId={user.id} cloud={cloud} key={user.id}>
      <CalmMotion>
        <Outlet />
      </CalmMotion>
      <Toasts />
      <BurstLayer />
    </StoreProvider>
  );
}
