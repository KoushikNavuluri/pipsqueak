import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";

const PEER_COLORS = [
  "#FF4D1A", // Pip accent
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#8B5CF6", // Violet
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#6366F1", // Indigo
];

function stringToColor(str) {
  if (!str) return PEER_COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PEER_COLORS[Math.abs(hash) % PEER_COLORS.length];
}

/**
 * Realtime multiplayer presence & cursors on the canvas.
 * @param {string} projectId Current project ID
 * @param {object} user Current session user
 * @param {object} profile Current user profile (displayName, avatarUrl)
 */
export function usePresence(projectId, user, profile) {
  const [peers, setPeers] = useState({});
  const [cursors, setCursors] = useState({});
  const channelRef = useRef(null);
  const lastBroadcast = useRef(0);
  const pendingCursor = useRef(null);
  const broadcastTimer = useRef(null);

  const localUser = useMemo(() => {
    const id = user?.id || "anon-" + Math.random().toString(36).slice(2, 7);
    const name = profile?.display_name || user?.email?.split("@")[0] || "Designer";
    const avatar = profile?.avatar_url || null;
    const color = stringToColor(id);
    return { id, name, avatar, color };
  }, [user?.id, user?.email, profile?.display_name, profile?.avatar_url]);

  useEffect(() => {
    if (!projectId || !supabase) return;

    const channelName = `pipsqueak-canvas:${projectId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: localUser.id },
        broadcast: { ack: false },
      },
    });

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const activePeers = {};
        for (const [key, presences] of Object.entries(state)) {
          if (key !== localUser.id && presences?.[0]) {
            activePeers[key] = presences[0];
          }
        }
        setPeers(activePeers);
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setPeers((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setCursors((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      })
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        if (!payload || payload.userId === localUser.id) return;
        setCursors((prev) => ({
          ...prev,
          [payload.userId]: {
            ...payload,
            updatedAt: Date.now(),
          },
        }));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: localUser.id,
            name: localUser.name,
            avatar: localUser.avatar,
            color: localUser.color,
            joinedAt: new Date().toISOString(),
          });
        }
      });

    // Cleanup stale cursors every 3 seconds
    const interval = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        let changed = false;
        const next = {};
        for (const [id, c] of Object.entries(prev)) {
          if (now - c.updatedAt < 5000) {
            next[id] = c;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 3000);

    return () => {
      clearInterval(interval);
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [projectId, localUser.id, localUser.name, localUser.avatar, localUser.color]);

  // Broadcast local cursor position throttled to ~40ms
  const broadcastCursor = useCallback(
    (canvasX, canvasY, screenId = null) => {
      pendingCursor.current = { canvasX, canvasY, screenId };
      const now = Date.now();
      if (now - lastBroadcast.current > 40) {
        lastBroadcast.current = now;
        if (channelRef.current && channelRef.current.state === "joined") {
          channelRef.current.send({
            type: "broadcast",
            event: "cursor",
            payload: {
              userId: localUser.id,
              name: localUser.name,
              avatar: localUser.avatar,
              color: localUser.color,
              x: canvasX,
              y: canvasY,
              screenId,
            },
          });
        }
      } else if (!broadcastTimer.current) {
        broadcastTimer.current = setTimeout(() => {
          broadcastTimer.current = null;
          lastBroadcast.current = Date.now();
          if (channelRef.current && channelRef.current.state === "joined" && pendingCursor.current) {
            channelRef.current.send({
              type: "broadcast",
              event: "cursor",
              payload: {
                userId: localUser.id,
                name: localUser.name,
                avatar: localUser.avatar,
                color: localUser.color,
                x: pendingCursor.current.canvasX,
                y: pendingCursor.current.canvasY,
                screenId: pendingCursor.current.screenId,
              },
            });
          }
        }, 40);
      }
    },
    [localUser]
  );

  return {
    localUser,
    peers: Object.values(peers),
    cursors: Object.values(cursors),
    broadcastCursor,
  };
}
