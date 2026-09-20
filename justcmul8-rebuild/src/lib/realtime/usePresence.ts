"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number } | null;
  selectedNodeId?: string | null;
  editingNodeId?: string | null;
}

export interface GraphOp {
  kind: "nodes" | "edges" | "cursor" | "nodeData";
  changes: any[];
  fromUserId: string;
}

const CURSOR_COLORS = ["#2f6fed", "#8b5cf6", "#12a150", "#d9a400", "#ff6d5a", "#0ea5a5"];

export function usePresence(projectId: string, selfId: string, selfName: string) {
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const trackedPayloadRef = useRef<{ id: string; name: string; color: string; selectedNodeId?: string | null; editingNodeId?: string | null }>({
    id: selfId,
    name: selfName,
    color: "#2f6fed",
  });
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const opHandlerRef = useRef<((op: GraphOp) => void) | null>(null);

  useEffect(() => {
    if (!projectId || !selfId) return;
    let cancelled = false;

    const color = CURSOR_COLORS[Math.abs(hashCode(selfId)) % CURSOR_COLORS.length];
    trackedPayloadRef.current = {
      ...trackedPayloadRef.current,
      id: selfId,
      name: selfName,
      color,
    };

    async function initChannel() {
      // App-level authorization check respecting projects RLS
      const { data: project, error } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .single();

      if (error || !project || cancelled) {
        console.warn("[usePresence] Access denied or project not found for realtime channel:", projectId);
        return;
      }

      const channel = supabase.channel(`project:${projectId}`, {
        config: { private: true, presence: { key: selfId } },
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
            const newCursor = payload.changes?.[0];
            setUsers((prev) =>
              prev.map((u) =>
                u.id === payload.fromUserId
                  ? {
                      ...u,
                      cursor: newCursor && newCursor.x !== null && newCursor.y !== null ? newCursor : null,
                    }
                  : u
              )
            );
          } else if (opHandlerRef.current) {
            opHandlerRef.current(payload as GraphOp);
          }
        }
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED" && !cancelled) {
          await channel.track(trackedPayloadRef.current);
        }
      });

      if (!cancelled) {
        channelRef.current = channel;
      } else {
        supabase.removeChannel(channel);
      }
    }

    initChannel();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [projectId, selfId, selfName, supabase]);

  function updatePresence(partial: Partial<PresenceUser>) {
    if (!channelRef.current) return;
    trackedPayloadRef.current = {
      ...trackedPayloadRef.current,
      ...partial,
    };
    channelRef.current.track(trackedPayloadRef.current);
  }

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

  return { users, broadcastOp, onRemoteOp, updatePresence };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
  return h;
}
