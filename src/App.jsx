import { Component, Suspense, lazy, useEffect, useRef } from "react";
import { Navigate, Route, Routes, useMatch, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "./store";
import { AppData, GuestOnly, RequireAuth, SessionProvider, Splash } from "./session";
import { Mark } from "./brand";
import { load, prefetchApp } from "./prefetch";

export { prefetchApp };

const Landing = lazy(() => import("./pages/Landing").then((m) => ({ default: m.Landing })));
const SignIn = lazy(() => load.auth().then((m) => ({ default: m.SignIn })));
const SignUp = lazy(() => load.auth().then((m) => ({ default: m.SignUp })));
const ForgotPassword = lazy(() => load.auth().then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => load.auth().then((m) => ({ default: m.ResetPassword })));
const Dashboard = lazy(() => load.dashboard().then((m) => ({ default: m.Dashboard })));
const Settings = lazy(() => load.settings().then((m) => ({ default: m.Settings })));
const SharedView = lazy(() => import("./pages/SharedView").then((m) => ({ default: m.SharedView })));
const PollView = lazy(() => import("./pages/PollView").then((m) => ({ default: m.PollView })));
const InviteAccept = lazy(() => import("./pages/InviteAccept").then((m) => ({ default: m.InviteAccept })));
const CanvasStudio = lazy(() => load.studio().then((m) => ({ default: m.CanvasStudio })));
const CreateFlow = lazy(() => load.create().then((m) => ({ default: m.CreateFlow })));
const CarouselStudio = lazy(() => import("./carousel/CarouselStudio").then((m) => ({ default: m.CarouselStudio })));
const NotFound = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.NotFound })));

// Kinds of design that open in an editor: the screen canvas and carousels.
const OPENABLE = new Set(["canvas", "carousel"]);

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
      } else if (s.data.projects.some((p) => p.id === urlId && OPENABLE.has(p.kind))) {
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
  const active = s.view === "studio" ? s.data.projects.find((p) => p.id === s.data.activeId && OPENABLE.has(p.kind)) : null;
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
        <Suspense fallback={<Splash />}>{active ? active.kind === "carousel" ? <CarouselStudio /> : <CanvasStudio /> : <Dashboard />}</Suspense>
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

export class Boundary extends Component {
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
            <Route path="/s/:token" element={<SharedView />} />
            <Route path="/poll/:token" element={<PollView />} />
            <Route path="/invite/:token" element={<InviteAccept />} />
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
