import { useEffect, useRef, useState, useCallback } from "react";
import { P2PRoom, type PeerInfo } from "./p2p";
import type { ChatMessage } from "@/lib/types";

export type P2PMessagePayload =
  | { type: "chat"; message: ChatMessage }
  | { type: "chat_reaction"; messageId: string; emoji: string; added: boolean; userId: string }
  | { type: "typing"; isTyping: boolean; identity: string }
  | { type: "reaction"; postId: string; kind: string }
  | { type: "note_added"; noteId: string };

export interface UseP2PRoomOptions {
  roomId: string;
  userId: string;
  name: string;
  onChatMessage?: (message: ChatMessage) => void;
  onChatMessageReaction?: (messageId: string, emoji: string, added: boolean, userId: string) => void;
  onReaction?: (postId: string, kind: string) => void;
  onNoteAdded?: (noteId: string) => void;
}

export function useP2PRoom({
  roomId,
  userId,
  name,
  onChatMessage,
  onChatMessageReaction,
  onReaction,
  onNoteAdded,
}: UseP2PRoomOptions) {
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, { identity: string; timestamp: number }>>(
    new Map(),
  );

  const roomRef = useRef<P2PRoom | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef({ onChatMessage, onChatMessageReaction, onReaction, onNoteAdded });

  useEffect(() => {
    callbacksRef.current = { onChatMessage, onChatMessageReaction, onReaction, onNoteAdded };
  });

  // Clean stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, data] of next.entries()) {
          if (now - data.timestamp > 3500) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!roomId || !userId) return;

    const p2p = new P2PRoom({
      room: roomId,
      selfId: userId,
      name,
      onPeersChanged: (updatedPeers) => {
        setPeers(updatedPeers);
      },
      onConnected: () => {
        setConnected(true);
      },
      onMessage: (from, data) => {
        try {
          const payload = data as P2PMessagePayload;
          if (payload.type === "chat" && callbacksRef.current.onChatMessage) {
            callbacksRef.current.onChatMessage(payload.message);
          } else if (payload.type === "chat_reaction" && callbacksRef.current.onChatMessageReaction) {
            callbacksRef.current.onChatMessageReaction(payload.messageId, payload.emoji, payload.added, payload.userId);
          } else if (payload.type === "typing") {
            setTypingUsers((prev) => {
              const next = new Map(prev);
              if (payload.isTyping) {
                next.set(from, { identity: payload.identity, timestamp: Date.now() });
              } else {
                next.delete(from);
              }
              return next;
            });
          } else if (payload.type === "reaction" && callbacksRef.current.onReaction) {
            callbacksRef.current.onReaction(payload.postId, payload.kind);
          } else if (payload.type === "note_added" && callbacksRef.current.onNoteAdded) {
            callbacksRef.current.onNoteAdded(payload.noteId);
          }
        } catch (err) {
          console.warn("[p2p] Failed to parse message:", err);
        }
      },
    });

    roomRef.current = p2p;
    void p2p.join().catch((err) => console.warn("[p2p] Join failed:", err));

    return () => {
      p2p.close();
      roomRef.current = null;
      setConnected(false);
    };
  }, [roomId, userId, name]);

  const broadcastChat = useCallback((message: ChatMessage) => {
    roomRef.current?.send({ type: "chat", message });
  }, []);

  const broadcastChatReaction = useCallback((messageId: string, emoji: string, added: boolean) => {
    roomRef.current?.send({ type: "chat_reaction", messageId, emoji, added, userId });
  }, [userId]);

  const sendTyping = useCallback(
    (isTyping: boolean, identity: string) => {
      roomRef.current?.broadcast({ type: "typing", isTyping, identity });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (isTyping) {
        typingTimerRef.current = setTimeout(() => {
          roomRef.current?.broadcast({ type: "typing", isTyping: false, identity });
        }, 3000);
      }
    },
    [],
  );

  const broadcastReaction = useCallback((postId: string, kind: string) => {
    roomRef.current?.send({ type: "reaction", postId, kind });
  }, []);

  const broadcastNoteAdded = useCallback((noteId: string) => {
    roomRef.current?.send({ type: "note_added", noteId });
  }, []);

  const avgRtt = peers
    .map((p) => p.rttMs)
    .filter((rtt): rtt is number => rtt !== null);
  const latency = avgRtt.length > 0 ? Math.round(avgRtt.reduce((a, b) => a + b, 0) / avgRtt.length) : null;

  return {
    peers,
    connected,
    latency,
    typingUsers: Array.from(typingUsers.values()).map((v) => v.identity),
    broadcastChat,
    broadcastChatReaction,
    sendTyping,
    broadcastReaction,
    broadcastNoteAdded,
  };
}
