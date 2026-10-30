import { Component, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StoreProvider, useStore } from "./store";
import { Studio } from "./screens/Studio";
import { Home } from "./screens/Home";
import {
  AddScreenDialog,
  ExportDialog,
  HistoryDialog,
  ShortcutsDialog,
  ShotsDialog,
  VariationsDialog,
} from "./dialogs";
import { Generating } from "./screens/Generating";
import { BurstLayer, Toasts } from "./ui";

function Shell() {
  const { s, api } = useStore();
  useEffect(() => {
    const k = (i) => {
      if (i.key === "Escape" && s.dialog) {
        api.dialog(null);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [s.dialog, api]);
  const a = s.dialog;
  const close = () => api.dialog(null);
  return (
    <div
      className={
        "h-full w-full bg-[#FAFAF8] " + (s.data.prefs.reduce ? "reduce" : "")
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.992,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          exit={{
            opacity: 0,
          }}
          transition={{
            duration: 0.22,
          }}
          className="h-full w-full"
          key={
            s.view === "studio" && s.data.activeId
              ? "studio:" + s.data.activeId
              : "home"
          }
        >
          {s.view === "studio" && s.data.activeId ? <Studio /> : <Home />}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {a?.name === "export" && (
          <ExportDialog id={a.props.id} onClose={close} key="export" />
        )}
        {a?.name === "shots" && (
          <ShotsDialog id={a.props.id} onClose={close} key="shots" />
        )}
        {a?.name === "addscreen" && (
          <AddScreenDialog id={a.props.id} onClose={close} key="add" />
        )}
        {a?.name === "variations" && (
          <VariationsDialog
            id={a.props.id}
            sIdx={a.props.sIdx}
            onClose={close}
            key="var"
          />
        )}
        {a?.name === "history" && (
          <HistoryDialog id={a.props.id} onClose={close} key="hist" />
        )}
        {a?.name === "shortcuts" && (
          <ShortcutsDialog onClose={close} key="keys" />
        )}
        {s.gen && <Generating project={s.gen} key="gen" />}
      </AnimatePresence>
      <Toasts />
      <BurstLayer />
    </div>
  );
}

class Boundary extends Component {
  constructor(t) {
    super(t);
    this.state = {
      err: null,
    };
  }
  static getDerivedStateFromError(t) {
    return {
      err: t,
    };
  }
  render() {
    if (this.state.err) {
      return (
        <div className="grid h-full place-items-center bg-[#FAFAF8] p-6 text-center">
          <div>
            <div className="display text-2xl font-semibold">
              Something slipped
            </div>
            <p className="mx-auto mt-1 max-w-xs text-sm text-[#62626A]">
              Your projects are safe in this browser. Reload to carry on.
            </p>
            <button
              onClick={() => location.reload()}
              className="mt-4 h-10 rounded-lg bg-[#16161A] px-4 text-sm font-semibold text-white"
            >
              Reload
            </button>
          </div>
        </div>
      );
    } else {
      return this.props.children;
    }
  }
}

export function App() {
  return (
    <Boundary>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </Boundary>
  );
}
