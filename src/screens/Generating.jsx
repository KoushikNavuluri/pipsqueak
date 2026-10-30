import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useStore } from "../store";
import { PALETTES } from "../data";
import { Button, EASE, fireBurst } from "../ui";
import { Scaled, Screen } from "../render";

export function Generating({ project }) {
  const { api, s: a } = useStore();
  const r = useMemo(
    () => [
      "Reading your idea",
      `Detected a ${project.cat === "tasks" ? "to-do" : project.cat} app`,
      `Naming it ${project.name}`,
      `Laying out ${project.screens.length} screens`,
      `Applying the ${PALETTES[project.theme.pal].name} palette`,
      "Finishing touches",
    ],
    [project],
  );
  const [o, i] = useState(0);
  const s = o >= r.length;
  useEffect(() => {
    if (s) {
      const d = setTimeout(() => {
        api.add(project);
        api.toast(
          `${project.name} is ready \xB7 ${project.screens.length} screens`,
        );
        fireBurst();
      }, 350);
      return () => clearTimeout(d);
    }
    const u = setTimeout(() => i((d) => d + 1), o === 0 ? 250 : 230);
    return () => clearTimeout(u);
  }, [o, s]);
  useEffect(() => {
    const k = (d) => {
      if (d.key === "Escape") {
        api.cancelGen();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [api]);
  const l = Math.max(0, o - 2);
  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      exit={{
        opacity: 0,
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#FAFAF8] p-4"
      role="dialog"
      aria-label="Generating"
    >
      <div className="w-full max-w-3xl">
        <div className="mb-6 text-center">
          <div className="display text-3xl font-semibold sm:text-4xl">
            {s ? "Ready." : `Generating ${project.name}`}
          </div>
          <div className="mt-1 text-sm text-[#62626A]">
            Simulated AI, running on this device
          </div>
        </div>
        <div className="mx-auto mb-6 h-1 w-full max-w-sm overflow-hidden rounded-full bg-[#E6E5E0]">
          <motion.div
            className="h-full bg-[#16161A]"
            animate={{
              width: `${Math.min(100, (o / r.length) * 100)}%`,
            }}
            transition={{
              duration: 0.3,
              ease: EASE,
            }}
          />
        </div>
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-center">
          <ol
            className="grid w-full max-w-[240px] gap-2.5 text-sm"
            aria-live="polite"
          >
            {r.map((u, d) => {
              const c = d < o ? "done" : d === o ? "now" : "wait";
              return (
                <li
                  className={`flex items-center gap-2.5 transition-opacity ${c === "wait" ? "opacity-40" : ""}`}
                  key={u}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${c === "done" ? "border-[#16161A] bg-[#16161A] text-white" : "border-[#D6D4CD] bg-white"}`}
                  >
                    {c === "done" ? (
                      <Check size={12} strokeWidth={3.4} />
                    ) : c === "now" ? (
                      <motion.span
                        className="h-1.5 w-1.5 rounded-full bg-[#FF4D1A]"
                        animate={{
                          scale: [1, 1.7, 1],
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.8,
                        }}
                      />
                    ) : null}
                  </span>
                  <span className={c === "now" ? "font-semibold" : ""}>
                    {u}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="flex items-start gap-2.5">
            {project.screens.map((u, d) => (
              <div
                className="relative overflow-hidden rounded-xl border border-[#E6E5E0] bg-white"
                style={{
                  width: 78,
                  height: 169,
                }}
                key={u.id}
              >
                {d < l ? (
                  <motion.div
                    initial={{
                      opacity: 0,
                      scale: 1.06,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    transition={{
                      duration: 0.4,
                      ease: EASE,
                    }}
                  >
                    <Scaled scale={0.2}>
                      <Screen screen={u} theme={project.theme} reveal={true} />
                    </Scaled>
                    <motion.div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-white/70 to-transparent"
                      initial={{
                        y: "-100%",
                      }}
                      animate={{
                        y: "100%",
                      }}
                      transition={{
                        duration: 0.7,
                        ease: "easeInOut",
                      }}
                    />
                  </motion.div>
                ) : (
                  <div className="skel h-full w-full" />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 text-center">
          <Button variant="ghost" onClick={api.cancelGen}>
            Cancel
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
