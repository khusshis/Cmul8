"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
}

export interface GraphOp {
  kind: "nodes" | "edges" | "cursor";
  changes: any[];
  fromUserId: string;
}

const CURSOR_COLORS = ["#2f6fed", "#8b5cf6", "#12a150", "#d9a400", "#ff6d5a", "#0ea5a5"];

export function usePresence(projectId: string, selfId: string, selfName: string) {
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const opHandlerRef = useRef<((op: GraphOp) => void) | null>(null);

  useEffect(() => {
    if (!projectId || !selfId) return;
    const color = CURSOR_COLORS[Math.abs(hashCode(selfId)) % CURSOR_COLORS.length];
    const channel = supabase.channel(`project:${projectId}`, {
      config: { presence: { key: selfId } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, any[]>;
      const list: PresenceUser[] = Object.values(state)
        .map((entries) => entries[0])
        .filter((u) => u.id !== selfId);
      setUsers(list);
    });

    channel.on("broadcast", { event: "graph-op" }, ({ payload }) => {
      if (payload.fromUserId !== selfId) {
        if (payload.kind === "cursor") {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === payload.fromUserId ? { ...u, cursor: payload.changes[0] } : u
            )
          );
        } else if (opHandlerRef.current) {
          opHandlerRef.current(payload as GraphOp);
        }
      }
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ id: selfId, name: selfName, color });
      }
    });

    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [projectId, selfId, selfName]);

  function broadcastOp(op: Omit<GraphOp, "fromUserId">) {
    channelRef.current?.send({
      type: "broadcast",
      event: "graph-op",
      payload: { ...op, fromUserId: selfId },
    });
  }

  function onRemoteOp(handler: (op: GraphOp) => void) {
    opHandlerRef.current = handler;
  }

  return { users, broadcastOp, onRemoteOp };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
  return h;
}
