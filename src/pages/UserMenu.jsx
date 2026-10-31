import { useNavigate } from "react-router-dom";
import { LayoutGrid, LogOut, Settings } from "lucide-react";
import { supabase } from "../supabase";
import { displayName, useSession } from "../session";
import { useStore } from "../store";
import { Menu } from "../ui";
import { Avatar } from "./Avatar";

export function UserMenu() {
  const { user, profile } = useSession();
  const { api } = useStore();
  const navigate = useNavigate();
  const name = displayName(user, profile);

  const signOut = async () => {
    await api.flush();
    navigate("/");
    await supabase.auth.signOut();
  };

  return (
    <Menu
      width="w-64"
      trigger={(open) => (
        <button aria-label="Account menu" aria-expanded={open} className="flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 ring-offset-paper transition-shadow hover:ring-2 hover:ring-line-strong">
          <Avatar name={name} url={profile?.avatar_url} size={32} />
        </button>
      )}
      items={[
        {
          heading: (
            <div className="flex items-center gap-3 pb-1">
              <Avatar name={name} url={profile?.avatar_url} size={36} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{name}</div>
                <div className="truncate text-xs text-mute">{user.email}</div>
              </div>
            </div>
          ),
        },
        { sep: true },
        { label: "Designs", icon: LayoutGrid, onClick: () => navigate("/app") },
        { label: "Settings", icon: Settings, onClick: () => navigate("/app/settings") },
        { sep: true },
        { label: "Sign out", icon: LogOut, onClick: signOut },
      ]}
    />
  );
}
