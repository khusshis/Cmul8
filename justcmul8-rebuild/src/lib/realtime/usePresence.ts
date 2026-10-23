"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface PresenceUser {
  id: string; // per-tab client id, so one account open in two tabs still syncs
  userId?: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number } | null;
  selectedNodeId?: string | null;
  editingNodeId?: string | null;
}

export interface GraphOp {
  // snapshot = full graph (after non-granular edits / answering a sync-request);
  // sync-request = a new joiner asking editors for the live graph;
  // access = the owner changed sharing, everyone re-checks their role.
  kind: "nodes" | "edges" | "cursor" | "nodeData" | "snapshot" | "sync-request" | "access";
  changes: any[];
  fromUserId: string;
  fromClientId?: string;
}

// Two channels so the database can tell them apart (see supabase/security.sql §6):
// project:<id> carries graph edits and only editors may send on it; project-presence:<id>
// carries presence, cursors and sync requests, which every member (viewers too) may send.
// The sender id inside a payload is self-reported, so it is never an authorization signal.
const PRESENCE_KINDS: GraphOp["kind"][] = ["cursor", "sync-request"];

const CURSOR_COLORS = ["#2f6fed", "#8b5cf6", "#12a150", "#d9a400", "#ff6d5a", "#0ea5a5"];

export function usePresence(projectId: string, selfId: string, selfName: string) {
  const supabase = createClient();
  const [clientId] = useState(() => crypto.randomUUID());
  const channelRef = useRef<RealtimeChannel | null>(null); // presence channel
  const graphChannelRef = useRef<RealtimeChannel | null>(null);
  const trackedPayloadRef = useRef<{ id: string; userId: string; name: string; color: string; selectedNodeId?: string | null; editingNodeId?: string | null }>({
    id: clientId,
    userId: selfId,
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
      id: clientId,
      userId: selfId,
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

      const graphChannel = supabase.channel(`project:${projectId}`, { config: { private: true } });
      const channel = supabase.channel(`project-presence:${projectId}`, {
        config: { private: true, presence: { key: clientId } },
      });

      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, any[]>;
        const list: PresenceUser[] = Object.values(state)
          .map((entries) => entries[0])
          .filter((u) => u.id !== clientId);
        // Presence payloads don't carry cursors; keep the last broadcast position per user.
        setUsers((prev) => list.map((u) => ({ ...u, cursor: prev.find((p) => p.id === u.id)?.cursor ?? null })));
      });

      const onGraphOp = ({ payload }: { payload: any }) => {
        if (payload.fromClientId !== clientId) {
          if (payload.kind === "cursor") {
            const newCursor = payload.changes?.[0];
            setUsers((prev) =>
              prev.map((u) =>
                u.id === payload.fromClientId
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
      };
      channel.on("broadcast", { event: "graph-op" }, onGraphOp);
      graphChannel.on("broadcast", { event: "graph-op" }, onGraphOp);
      graphChannel.subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("[usePresence] graph channel", status, "- check the realtime.messages policies in supabase/security.sql");
        }
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED" && !cancelled) {
          await channel.track(trackedPayloadRef.current);
          channel.send({ type: "broadcast", event: "graph-op", payload: { kind: "sync-request", changes: [], fromUserId: selfId, fromClientId: clientId } });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("[usePresence] realtime channel", status, "- check the realtime.messages policies in supabase/collaboration.sql");
        }
      });

      if (!cancelled) {
        channelRef.current = channel;
        graphChannelRef.current = graphChannel;
      } else {
        supabase.removeChannel(channel);
        supabase.removeChannel(graphChannel);
      }
    }

    initChannel();

    return () => {
      cancelled = true;
      for (const ref of [channelRef, graphChannelRef]) {
        if (ref.current) supabase.removeChannel(ref.current);
        ref.current = null;
      }
    };
  }, [projectId, selfId, selfName, supabase, clientId]);

  const updatePresence = useCallback((partial: Partial<PresenceUser>) => {
    trackedPayloadRef.current = {
      ...trackedPayloadRef.current,
      ...partial,
    };
    channelRef.current?.track(trackedPayloadRef.current);
  }, []);

  const broadcastOp = useCallback((op: Omit<GraphOp, "fromUserId">) => {
    const target = PRESENCE_KINDS.includes(op.kind) ? channelRef.current : graphChannelRef.current;
    target?.send({
      type: "broadcast",
      event: "graph-op",
      payload: { ...op, fromUserId: selfId, fromClientId: clientId },
    });
  }, [selfId, clientId]);

  const onRemoteOp = useCallback((handler: (op: GraphOp) => void) => {
    opHandlerRef.current = handler;
  }, []);

  return { users, broadcastOp, onRemoteOp, updatePresence };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
  return h;
}
