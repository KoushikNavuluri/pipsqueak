import { Component, Suspense, lazy, useEffect, useRef } from "react";
import { Navigate, Route, Routes, useMatch, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "./store";
import { AppData, GuestOnly, RequireAuth, SessionProvider, Splash } from "./session";
import { Mark } from "./brand";

// Each page is its own chunk. The app ones are fetched during idle time, so
// moving from the landing page to the dashboard or into a design is instant.
const load = {
  dashboard: () => import("./pages/Dashboard"),
  studio: () => import("./studio/CanvasStudio"),
  create: () => import("./studio/CreateFlow"),
  settings: () => import("./pages/Settings"),
  auth: () => import("./pages/AuthPages"),
};
export function prefetchApp(signedIn) {
  const run = () => (signedIn ? [load.dashboard, load.studio, load.create, load.settings] : [load.auth]).forEach((l) => l().catch(() => {}));
  if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 2500 });
  else setTimeout(run, 1200);
}

const Landing = lazy(() => import("./pages/Landing").then((m) => ({ default: m.Landing })));
const SignIn = lazy(() => load.auth().then((m) => ({ default: m.SignIn })));
const SignUp = lazy(() => load.auth().then((m) => ({ default: m.SignUp })));
const ForgotPassword = lazy(() => load.auth().then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => load.auth().then((m) => ({ default: m.ResetPassword })));
const Dashboard = lazy(() => load.dashboard().then((m) => ({ default: m.Dashboard })));
const Settings = lazy(() => load.settings().then((m) => ({ default: m.Settings })));
const NotFound = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.NotFound })));
const CanvasStudio = lazy(() => load.studio().then((m) => ({ default: m.CanvasStudio })));
const CreateFlow = lazy(() => load.create().then((m) => ({ default: m.CreateFlow })));

// Keeps the open design and the address bar in step: /app is the dashboard
// and /app/p/:id a design. On first render the address bar wins; after that,
// whichever side changed wins.
function useRouteSync() {
  const { s, api } = useStore();
  const navigate = useNavigate();
  const match = useMatch("/app/p/:id");
  const urlId = match?.params.id ?? null;
  const stateId = s.view === "studio" && s.data.activeId ? s.data.activeId : null;
  const prev = useRef(null);
  useEffect(() => {
    const urlChanged = !prev.current || prev.current.urlId !== urlId;
    const stateChanged = !!prev.current && prev.current.stateId !== stateId;
    prev.current = { urlId, stateId };
    if (urlId === stateId) return;
    if (urlChanged) {
      if (!urlId) {
        api.home();
      } else if (s.data.projects.some((p) => p.id === urlId && p.kind === "canvas")) {
        api.open(urlId);
      } else {
        navigate("/app", { replace: true });
        api.toast("That design isn't in your account", { tone: "error" });
      }
    } else if (stateChanged) {
      navigate(stateId ? `/app/p/${stateId}` : "/app");
    }
  });
}

function Shell() {
  const { s } = useStore();
  useRouteSync();
  const active = s.view === "studio" ? s.data.projects.find((p) => p.id === s.data.activeId && p.kind === "canvas") : null;
  return (
    <div className="h-full w-full bg-paper">
      {/* The next view replaces the last one at once and fades in; holding a
          heavy view on screen for an exit animation only delays the next. */}
      <motion.div
        key={active ? "studio:" + active.id : "home"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="h-full w-full"
      >
        <Suspense fallback={<Splash />}>{active ? <CanvasStudio /> : <Dashboard />}</Suspense>
      </motion.div>
      <AnimatePresence>
        {s.gen && (
          <Suspense fallback={null} key="create">
            <CreateFlow request={s.gen} />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}

class Boundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err, info) {
    console.error("Pipsqueak crashed", err, info);
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="grid h-full place-items-center bg-paper p-6 text-center">
        <div>
          <Mark size={40} className="mx-auto" />
          <h1 className="display mt-6 text-3xl">Something slipped</h1>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-mute">Your designs are saved. Reload to pick up where you left off.</p>
          <button onClick={() => location.reload()} className="mt-6 h-10 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink-2">
            Reload
          </button>
        </div>
      </div>
    );
  }
}

export function App() {
  return (
    <Boundary>
      <SessionProvider>
        <Suspense fallback={<Splash />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route element={<GuestOnly />}>
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
            </Route>
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/app" element={<RequireAuth />}>
              <Route element={<AppData />}>
                <Route index element={<Shell />} />
                <Route path="p/:id" element={<Shell />} />
                <Route path="settings" element={<Settings />} />
                <Route path="profile" element={<Navigate to="/app/settings" replace />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </SessionProvider>
    </Boundary>
  );
}
