import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Check, MessageSquare, Vote, X } from "lucide-react";
import { listNotifications, markAllNotificationsRead, markNotificationRead, watchNotifications } from "../share";
import { useSession } from "../session";
import { cx } from "../ui";

export function NotificationBell() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const bellRef = useRef(null);

  const load = () => {
    if (!user?.id) return;
    listNotifications(user.id).then(setNotifications);
  };

  useEffect(() => {
    load();
    if (!user?.id) return;
    const stop = watchNotifications(user.id, load);
    return () => stop();
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unread = notifications.filter((n) => !n.read_at);

  const handleClickItem = async (n) => {
    if (!n.read_at) {
      await markNotificationRead(n.id);
      setNotifications((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    await markAllNotificationsRead(user.id);
    setNotifications((list) => list.map((x) => ({ ...x, read_at: new Date().toISOString() })));
  };

  if (!user) return null;

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface text-ink-2 hover:border-ink hover:text-ink transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread.length > 0 && (
          <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-white shadow-xs">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-line bg-surface p-2 text-ink shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-3 py-2 text-xs font-semibold">
            <span>Notifications ({unread.length} unread)</span>
            {unread.length > 0 && (
              <button onClick={handleMarkAllRead} className="text-accent hover:underline text-[11px]">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-line-soft">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-xs text-mute">No notifications yet.</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickItem(n)}
                  className={cx(
                    "flex w-full items-start gap-2.5 p-2.5 text-left text-xs transition-colors hover:bg-wash rounded-xl",
                    !n.read_at && "bg-wash/60 font-medium",
                  )}
                >
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-sunken text-ink">
                    {n.type === "poll_vote" ? <Vote size={12} /> : <MessageSquare size={12} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink truncate">{n.title}</div>
                    <div className="text-mute line-clamp-2 text-[11px] mt-0.5">{n.body}</div>
                  </div>
                  {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent mt-1.5" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
