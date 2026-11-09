import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Settings, Users } from "lucide-react";
import { listWorkspaces } from "../share";
import { cx } from "../ui";

export function WorkspaceSwitcher({ activeWorkspace, onSelect, onManage, onCreate }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = () => {
    listWorkspaces().then(setWorkspaces).catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const currentName = activeWorkspace ? activeWorkspace.name : "Personal";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-line-strong transition-colors"
      >
        <Users size={13} className="text-mute" />
        <span className="max-w-[120px] truncate">{currentName}</span>
        <ChevronDown size={12} className="text-mute" />
      </button>

      {open && (
        <div className="absolute left-0 top-9 z-50 w-56 rounded-2xl border border-line bg-surface p-1.5 text-xs text-ink shadow-2xl">
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-mute">
            Workspaces
          </div>
          <button
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            className={cx(
              "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left font-medium hover:bg-wash",
              !activeWorkspace && "bg-wash font-semibold text-ink",
            )}
          >
            <span>Personal Workspace</span>
          </button>
          {workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => {
                onSelect(w);
                setOpen(false);
              }}
              className={cx(
                "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left font-medium hover:bg-wash",
                activeWorkspace?.id === w.id && "bg-wash font-semibold text-ink",
              )}
            >
              <span className="truncate">{w.name}</span>
            </button>
          ))}
          <div className="my-1 border-t border-line-soft" />
          {activeWorkspace && (
            <button
              onClick={() => {
                onManage(activeWorkspace);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-mute hover:bg-wash hover:text-ink"
            >
              <Settings size={13} /> Manage Team
            </button>
          )}
          <button
            onClick={() => {
              onCreate();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-accent hover:bg-wash font-medium"
          >
            <Plus size={13} /> Create Workspace
          </button>
        </div>
      )}
    </div>
  );
}
