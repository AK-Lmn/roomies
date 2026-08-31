import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { getRoom, pingPresence, revealIdentity, leaveRoom } from "@/lib/server/rooms";
import { getMessages, sendMessage, toggleMessageReaction } from "@/lib/server/messages";
import { AppleEmoji, DEFAULT_REACTIONS, EmojiPickerModal } from "@/components/apple-emoji";
import {
  getWallPosts,
  createWallPost,
  toggleReaction,
  getFridgeNotes,
  addFridgeNote,
  deleteFridgeNote,
  getSongs,
  addSong,
  getDailyQuestion,
  submitDailyAnswer,
} from "@/lib/server/content";
import { searchTracks, fetchTrackMetadata, type TrackSearchResult } from "@/lib/server/music-search";
import {
  getSpotifyStatus,
  getSpotifyAuthUrl,
  getSpotifyNowPlaying,
  disconnectSpotify,
  type SpotifyTrackInfo,
  type SpotifyStatus,
} from "@/lib/server/spotify";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { remainingLabel, timeAgo, clockTime } from "@/lib/format";
import { LIMITS } from "@/lib/limits";
import { useP2PRoom } from "@/lib/multiplayer/use-p2p-room";
import { MediaEmbed } from "@/components/media-embed";
import { AnimalAvatar } from "@/components/animal-avatar";
import { ReactionButton, REACTION_TYPES } from "@/components/reaction-button";
import { sound } from "@/lib/sound";
import type { RoomView, ChatMessage, WallPost, FridgeNote, Song, DailyQuestionView } from "@/lib/types";
import { RoommateModal } from "@/components/modals/roommate-modal";
import { RevealIdentityModal } from "@/components/modals/reveal-identity-modal";
import { SpotifySetupModal, SpotifyDisconnectModal } from "@/components/modals/spotify-modals";
import { ImageLightbox } from "@/components/image-lightbox";
import { Modal } from "@/components/ui/modal";
import { compressImage } from "@/lib/image-compress";
import { sendBackgroundNotification, requestNotificationPermission } from "@/lib/notifications";
import {
  Volume2,
  VolumeX,
  KeyRound,
  BadgeCheck,
  MessageSquare,
  LayoutGrid,
  StickyNote,
  Music2,
  HelpCircle,
  Users,
  Clock,
  Search,
  Link2,
  Disc3,
  ExternalLink,
  Trash2,
  Sparkles,
  Send,
  X,
  Radio,
  Plus,
  CornerUpLeft,
  ArrowLeft,
  LogOut,
  Image as ImageIcon,
} from "lucide-react";

export const Route = createFileRoute("/room/$roomId")({ component: RoomPage });

type Tab = "chat" | "wall" | "fridge" | "music" | "daily";

const TABS: Array<{ id: Tab; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: "chat", label: "Chat", Icon: MessageSquare },
  { id: "wall", label: "Wall", Icon: LayoutGrid },
  { id: "fridge", label: "Fridge", Icon: StickyNote },
  { id: "music", label: "Music", Icon: Music2 },
  { id: "daily", label: "Daily Q", Icon: HelpCircle },
];

function RoomPage() {
  const { roomId } = useParams({ from: "/room/$roomId" });
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomView | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("chat");
  const [unreadTabs, setUnreadTabs] = useState<Record<Tab, boolean>>({
    chat: false,
    wall: false,
    fridge: false,
    music: false,
    daily: false,
  });
  const [muted, setMuted] = useState(sound.isMuted());
  const [revealing, setRevealing] = useState(false);
  const [showRevealModal, setShowRevealModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<RoomView["members"][0] | null>(null);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function handleConfirmLeave() {
    setLeaving(true);
    try {
      await leaveRoom({ data: { roomId } });
      void navigate({ to: "/" });
    } catch {
      setLeaving(false);
    }
  }

  // Incoming P2P events dispatcher refs
  const onIncomingChatRef = useRef<((msg: ChatMessage) => void) | null>(null);
  const onIncomingChatReactionRef = useRef<((messageId: string, emoji: string, added: boolean, userId: string) => void) | null>(null);
  const onIncomingReactionRef = useRef<((postId: string, kind: string) => void) | null>(null);
  const onIncomingNoteRef = useRef<(() => void) | null>(null);

  const me = room?.members.find((m) => m.isMe);

  const handleSelectTab = (selectedTab: Tab) => {
    setTab(selectedTab);
    setUnreadTabs((prev) => ({ ...prev, [selectedTab]: false }));
  };

  const p2p = useP2PRoom({
    roomId,
    userId: user?.id ?? "",
    name: me?.tempIdentity ?? "Roomie",
    onChatMessage: (msg) => {
      sound.playChime();
      if (tab !== "chat") {
        setUnreadTabs((prev) => ({ ...prev, chat: true }));
      }
      sendBackgroundNotification(`Roomies · ${msg.identity}`, msg.body);
      onIncomingChatRef.current?.(msg);
    },
    onChatMessageReaction: (messageId, emoji, added, authorUserId) => {
      onIncomingChatReactionRef.current?.(messageId, emoji, added, authorUserId);
    },
    onReaction: (postId, kind) => {
      if (tab !== "wall") {
        setUnreadTabs((prev) => ({ ...prev, wall: true }));
      }
      sendBackgroundNotification("Roomies · Wall", "A roommate reacted to a post");
      onIncomingReactionRef.current?.(postId, kind);
    },
    onNoteAdded: () => {
      if (tab !== "fridge") {
        setUnreadTabs((prev) => ({ ...prev, fridge: true }));
      }
      sendBackgroundNotification("Roomies · Fridge", "A new sticky note was posted");
      onIncomingNoteRef.current?.();
    },
  });

  async function refreshRoom() {
    try {
      const r = await getRoom({ data: { roomId } });
      if (!r) {
        void navigate({ to: "/" });
        return;
      }
      setRoom(r);
    } catch {
      void navigate({ to: "/" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    void refreshRoom();
    void requestNotificationPermission();
    const presencePing = setInterval(() => void pingPresence({ data: { roomId } }).catch(() => {}), 30_000);
    const roomRefresh = setInterval(() => void refreshRoom(), 15_000);
    return () => {
      clearInterval(presencePing);
      clearInterval(roomRefresh);
    };
  }, [user, roomId]);

  if (isPending || loading) {
    return (
      <div className="grid min-h-dvh place-items-center" style={{ background: "var(--color-bg)", color: "var(--color-muted)" }}>
        <div className="flex items-center gap-2 text-sm">
          <Radio size={16} className="animate-spin text-amber-500" />
          <span>Loading room…</span>
        </div>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (!room) return null;

  const onlineCount = room.members.filter((m) => m.online).length;

  async function handleConfirmReveal() {
    setRevealing(true);
    try {
      await revealIdentity({ data: { roomId } });
      await refreshRoom();
      setShowRevealModal(false);
    } finally {
      setRevealing(false);
    }
  }

  function handleToggleSound() {
    const isMute = sound.toggleMute();
    setMuted(isMute);
  }

  return (
    <div className="flex flex-col h-dvh" style={{ background: "var(--color-bg)" }}>
      <header className="flex-none flex items-center justify-between gap-2 px-3 sm:px-4 py-2 sm:py-2.5 border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <a href="/" className="opacity-60 hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-neutral-800 shrink-0">
            <ArrowLeft size={16} />
          </a>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-sm font-semibold truncate" style={{ color: "var(--color-fg)" }}>
                {room.name}
              </span>
              <span
                className="hidden md:inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors"
                style={{
                  background: p2p.connected ? "rgba(122, 158, 135, 0.15)" : "var(--color-surface2)",
                  color: p2p.connected ? "var(--color-accent)" : "var(--color-muted)",
                  border: "1px solid var(--color-border)",
                }}
                title={p2p.connected ? `Connected to room mesh (${p2p.peers.length} active peers)` : "Connecting to room mesh..."}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${p2p.connected ? "bg-emerald-400" : "bg-neutral-500"}`} />
                <span>{p2p.connected ? "Connected" : "Connecting"}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: "var(--color-muted)" }}>
              <span className="flex items-center gap-1 shrink-0">
                <Users size={11} /> {onlineCount} online
              </span>
              <span>·</span>
              <span className="flex items-center gap-1 shrink-0">
                <Clock size={11} /> {remainingLabel(room.remainingMs)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleSound}
            className="p-1.5 sm:p-2 rounded-lg opacity-80 hover:opacity-100 transition-all border text-[var(--color-fg)]"
            title={muted ? "Unmute sound cues" : "Mute sound cues"}
            style={{ background: "var(--color-surface2)", borderColor: "var(--color-border)" }}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="p-1.5 sm:p-2 rounded-lg opacity-80 hover:opacity-100 transition-all border text-rose-400 hover:text-rose-300"
            title="Leave Room"
            style={{ background: "var(--color-surface2)", borderColor: "var(--color-border)" }}
          >
            <LogOut size={14} />
          </button>

          {me && !me.revealed && (
            <button
              type="button"
              disabled={revealing}
              onClick={() => setShowRevealModal(true)}
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs px-2 sm:px-2.5 py-1.5 rounded-lg font-medium transition-all hover:opacity-90 disabled:opacity-50 border border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-xs"
              title="Reveal your real profile"
            >
              <KeyRound size={12} />
              <span>Reveal<span className="hidden sm:inline"> Profile</span></span>
            </button>
          )}

          {me && (
            <div
              className="flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2.5 py-1 rounded-full cursor-pointer hover:bg-neutral-800 transition-all border shrink-0"
              style={{ background: "var(--color-surface2)", borderColor: "var(--color-border)" }}
              onClick={() => setSelectedMember(me)}
            >
              <AnimalAvatar
                animal={me.identityAnimal}
                color={me.identityColor}
                size={18}
                revealed={me.revealed}
                displayName={me.profile?.displayName}
                profileImageUrl={me.profile?.avatarUrl}
              />
              <span className="text-[11px] sm:text-xs font-medium max-w-[55px] sm:max-w-[110px] truncate" style={{ color: "var(--color-fg)" }}>
                {me.revealed && me.profile?.displayName ? me.profile.displayName : me.tempIdentity}
              </span>
              {me.revealed && <BadgeCheck size={12} className="text-amber-400 shrink-0" />}
            </div>
          )}
        </div>
      </header>

      <nav className="flex-none flex border-b overflow-x-auto scrollbar-none" style={{ borderColor: "var(--color-border)" }}>
        {TABS.map(({ id: t, label, Icon }) => (
          <button
            key={t}
            onClick={() => handleSelectTab(t)}
            className="flex-1 min-w-0 py-2 sm:py-2.5 px-1 sm:px-3 inline-flex items-center justify-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-medium transition-colors relative whitespace-nowrap"
            style={{
              color: tab === t ? "var(--color-primary)" : "var(--color-muted)",
              borderBottom: tab === t ? "2px solid var(--color-primary)" : "2px solid transparent",
            }}
          >
            <Icon size={13} className="shrink-0" />
            <span className="whitespace-nowrap truncate">{label}</span>
            {unreadTabs[t] && tab !== t && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" title="New activity" />
            )}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-hidden relative">
        <div className={tab === "chat" ? "h-full" : "hidden"}>
          <ChatTab
            roomId={roomId}
            members={room.members}
            p2p={p2p}
            myIdentity={me?.tempIdentity ?? "Roomie"}
            onIncomingChatRef={onIncomingChatRef}
            onIncomingChatReactionRef={onIncomingChatReactionRef}
          />
        </div>
        <div className={tab === "wall" ? "h-full" : "hidden"}>
          <WallTab
            roomId={roomId}
            p2p={p2p}
            onIncomingReactionRef={onIncomingReactionRef}
          />
        </div>
        <div className={tab === "fridge" ? "h-full" : "hidden"}>
          <FridgeTab
            roomId={roomId}
            p2p={p2p}
            onIncomingNoteRef={onIncomingNoteRef}
          />
        </div>
        <div className={tab === "music" ? "h-full" : "hidden"}>
          <MusicTab roomId={roomId} />
        </div>
        <div className={tab === "daily" ? "h-full" : "hidden"}>
          <DailyTab roomId={roomId} />
        </div>
      </div>

      <footer className="flex-none px-4 py-2 border-t flex items-center gap-2 overflow-x-auto" style={{ borderColor: "var(--color-border)" }}>
        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-40 mr-1 shrink-0 flex items-center gap-1">
          <Users size={10} /> Roommates:
        </span>
        {room.members.map((m) => (
          <button
            key={m.userId}
            type="button"
            onClick={() => setSelectedMember(m)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full shrink-0 transition-opacity hover:opacity-80 border"
            style={{
              background: m.isMe ? "rgba(194, 144, 90, 0.15)" : "var(--color-surface2)",
              borderColor: "var(--color-border)",
            }}
          >
            <AnimalAvatar
              animal={m.identityAnimal}
              color={m.identityColor}
              size={18}
              revealed={m.revealed}
              displayName={m.profile?.displayName}
              profileImageUrl={m.profile?.avatarUrl}
              online={m.online}
            />
            <span className="text-xs truncate max-w-[90px]" style={{ color: "var(--color-fg)" }}>
              {m.revealed && m.profile?.displayName ? m.profile.displayName : m.tempIdentity}
            </span>
            {m.revealed && <BadgeCheck size={11} className="text-amber-400 shrink-0" />}
          </button>
        ))}
      </footer>

      <RoommateModal
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
        onRequestReveal={() => setShowRevealModal(true)}
      />

      <RevealIdentityModal
        isOpen={showRevealModal}
        onClose={() => setShowRevealModal(false)}
        onConfirm={() => void handleConfirmReveal()}
        isSubmitting={revealing}
        currentPersona={me?.tempIdentity}
        realName={me?.profile?.displayName ?? user?.displayName ?? undefined}
      />

      <Modal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        title="Leave Room"
        subtitle={`Are you sure you want to leave ${room.name}?`}
        icon={<LogOut size={20} className="text-rose-400" />}
        iconBg="rgba(244, 63, 94, 0.15)"
      >
        <div className="space-y-4">
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
            Leaving this room will remove your member profile and note attachments from this shared space.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowLeaveModal(false)}
              className="px-3.5 py-2 rounded-xl text-xs font-medium border hover:bg-neutral-800 transition-colors"
              style={{ borderColor: "var(--color-border)", color: "var(--color-fg)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={leaving}
              onClick={() => void handleConfirmLeave()}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 transition-colors shadow-md"
            >
              {leaving ? "Leaving…" : "Leave Room"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ChatTab({
  roomId,
  members,
  p2p,
  myIdentity,
  onIncomingChatRef,
  onIncomingChatReactionRef,
}: {
  roomId: string;
  members: RoomView["members"];
  p2p: ReturnType<typeof useP2PRoom>;
  myIdentity: string;
  onIncomingChatRef: React.MutableRefObject<((msg: ChatMessage) => void) | null>;
  onIncomingChatReactionRef: React.MutableRefObject<((messageId: string, emoji: string, added: boolean, userId: string) => void) | null>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [pickerMessageId, setPickerMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadMessages() {
    const msgs = await getMessages({ data: { roomId } });
    setMessages(msgs);
  }

  useEffect(() => {
    void loadMessages();
    const interval = setInterval(() => void loadMessages(), 8000);
    return () => clearInterval(interval);
  }, [roomId]);

  useEffect(() => {
    onIncomingChatRef.current = (incomingMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === incomingMsg.id)) return prev;
        return [...prev, incomingMsg];
      });
    };
    return () => {
      onIncomingChatRef.current = null;
    };
  }, [onIncomingChatRef]);

  useEffect(() => {
    onIncomingChatReactionRef.current = (messageId, emoji, added, authorUserId) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;
          const existing = msg.reactions?.find((r) => r.emoji === emoji);
          let newReactions = [...(msg.reactions ?? [])];
          const isMine = authorUserId === "me";
          if (added) {
            if (existing) {
              newReactions = newReactions.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1, mine: r.mine || isMine } : r
              );
            } else {
              newReactions.push({ emoji, count: 1, mine: isMine });
            }
          } else {
            if (existing && existing.count > 1) {
              newReactions = newReactions.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count - 1, mine: isMine ? false : r.mine } : r
              );
            } else {
              newReactions = newReactions.filter((r) => r.emoji !== emoji);
            }
          }
          return { ...msg, reactions: newReactions };
        })
      );
    };
    return () => {
      onIncomingChatReactionRef.current = null;
    };
  }, [onIncomingChatReactionRef]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function getMember(userId: string) {
    return members.find((m) => m.userId === userId);
  }

  async function handleToggleReaction(messageId: string, emoji: string) {
    sound.playPop();
    try {
      const res = await toggleMessageReaction({ data: { messageId, emoji } });
      p2p.broadcastChatReaction(messageId, emoji, res.added);
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;
          const existing = msg.reactions?.find((r) => r.emoji === emoji);
          let newReactions = [...(msg.reactions ?? [])];
          if (res.added) {
            if (existing) {
              newReactions = newReactions.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r
              );
            } else {
              newReactions.push({ emoji, count: 1, mine: true });
            }
          } else {
            if (existing && existing.count > 1) {
              newReactions = newReactions.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r
              );
            } else {
              newReactions = newReactions.filter((r) => r.emoji !== emoji);
            }
          }
          return { ...msg, reactions: newReactions };
        })
      );
    } catch {}
  }

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setBody("");
    p2p.sendTyping(false, myIdentity);
    sound.playPop();

    try {
      const targetReply = replyingTo;
      setReplyingTo(null);

      const res = await sendMessage({
        data: {
          roomId,
          body: text,
          replyToId: targetReply?.id,
          replyToBody: targetReply?.body,
          replyToIdentity: targetReply ? (targetReply.revealedName ?? targetReply.identity) : undefined,
        },
      });
      const meMember = members.find((m) => m.isMe);
      const localMsg: ChatMessage = {
        id: res.id,
        roomId,
        userId: meMember?.userId ?? "me",
        body: text,
        createdAt: new Date().toISOString(),
        identity: meMember?.tempIdentity ?? myIdentity,
        animal: meMember?.identityAnimal ?? "Fox",
        color: meMember?.identityColor ?? "#c2905a",
        revealedName: meMember?.revealed && meMember.profile?.displayName ? meMember.profile.displayName : null,
        isMe: true,
        reactions: [],
        replyTo: targetReply ? {
          id: targetReply.id,
          body: targetReply.body,
          identity: targetReply.revealedName ?? targetReply.identity,
        } : null,
      };
      setMessages((prev) => [...prev, localMsg]);
      p2p.broadcastChat({ ...localMsg, isMe: false });
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleInputChange(val: string) {
    setBody(val);
    if (val.trim()) {
      p2p.sendTyping(true, myIdentity);
    } else {
      p2p.sendTyping(false, myIdentity);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="w-full max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-16 space-y-2" style={{ color: "var(--color-muted)" }}>
              <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center bg-neutral-800/80 text-neutral-400">
                <MessageSquare size={20} />
              </div>
              <p className="text-sm font-medium">Your room is ready</p>
              <p className="text-xs">Send a message to say hello to your new roommates.</p>
            </div>
          )}
          {messages.map((msg) => {
            const member = getMember(msg.userId);
            const authorColor = member?.identityColor ?? msg.color ?? "#888";
            const authorAnimal = member?.identityAnimal ?? msg.animal ?? "Fox";

            return (
              <div key={msg.id} className={`group relative flex gap-2.5 ${msg.isMe ? "flex-row-reverse" : "flex-row"}`}>
                <AnimalAvatar
                  animal={authorAnimal}
                  color={authorColor}
                  size={30}
                  revealed={member?.revealed ?? Boolean(msg.revealedName)}
                  displayName={msg.revealedName}
                  profileImageUrl={member?.profile?.avatarUrl}
                  className="mt-0.5"
                />
                <div className={`max-w-[85%] sm:max-w-[75%] space-y-1 ${msg.isMe ? "items-end" : "items-start"} flex flex-col`}>
                  <div className="text-[10px]" style={{ color: "var(--color-muted)" }}>
                    {msg.revealedName ? `${msg.revealedName} (${msg.identity})` : msg.identity} · {clockTime(msg.createdAt)}
                  </div>
                  <div className="relative group/bubble flex items-center gap-1.5">
                    <div
                      className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-xs space-y-1"
                      style={{
                        background: msg.isMe ? "var(--color-primary)" : "var(--color-surface2)",
                        color: msg.isMe ? "var(--color-primary-fg)" : "var(--color-fg)",
                        border: msg.isMe ? "none" : "1px solid var(--color-border)",
                      }}
                    >
                      {msg.replyTo && (
                        <div
                          className="text-[11px] rounded-lg px-2.5 py-1 border-l-2 border-amber-400 font-medium opacity-90 space-y-0.5"
                          style={{
                            background: msg.isMe ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.06)",
                          }}
                        >
                          <div className="flex items-center gap-1 opacity-75 font-semibold text-[10px]">
                            <CornerUpLeft size={10} />
                            <span>{msg.replyTo.identity}</span>
                          </div>
                          <div className="truncate max-w-[220px]">{msg.replyTo.body}</div>
                        </div>
                      )}
                      <div>{msg.body}</div>
                    </div>

                    {/* Floating Reaction Bar (Default iOS Emojis + Plus + Reply) */}
                    <div className={`absolute -top-5 ${msg.isMe ? "right-0" : "left-0"} opacity-0 group-hover/bubble:opacity-100 focus-within:opacity-100 transition-all z-20`}>
                      <div className="flex items-center gap-1.5 bg-neutral-900/95 border border-neutral-700/90 rounded-full px-2.5 py-1 shadow-xl backdrop-blur-md">
                        {DEFAULT_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => void handleToggleReaction(msg.id, emoji)}
                            className="p-1 rounded-full hover:bg-neutral-800 hover:scale-125 transition-all cursor-pointer flex items-center justify-center"
                            title={`React ${emoji}`}
                          >
                            <AppleEmoji emoji={emoji} size={18} />
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPickerMessageId(msg.id)}
                          className="p-1 rounded-full hover:bg-neutral-800 hover:scale-125 transition-all cursor-pointer text-neutral-400 hover:text-amber-400 flex items-center justify-center"
                          title="More emojis (+)"
                        >
                          <Plus size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplyingTo(msg)}
                          className="p-1 rounded-full hover:bg-neutral-800 hover:scale-110 transition-all cursor-pointer text-neutral-400 hover:text-amber-400 border-l border-neutral-700/60 pl-1.5 ml-0.5 flex items-center justify-center"
                          title="Reply to message"
                        >
                          <CornerUpLeft size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Mobile / Quick Reply & Plus Buttons */}
                    <div className="flex items-center gap-0.5 opacity-40 hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={() => setReplyingTo(msg)}
                        className="p-1 rounded-full text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer"
                        title="Reply"
                      >
                        <CornerUpLeft size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPickerMessageId(msg.id)}
                        className="p-1 rounded-full text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer"
                        title="React"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Active Reactions Pills */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex gap-1 flex-wrap pt-0.5">
                      {msg.reactions.map((r) => (
                        <button
                          key={r.emoji}
                          type="button"
                          onClick={() => void handleToggleReaction(msg.id, r.emoji)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all cursor-pointer ${
                            r.mine
                              ? "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-xs scale-105"
                              : "bg-neutral-800/80 border-neutral-700/60 text-neutral-300 hover:bg-neutral-800"
                          }`}
                        >
                          <AppleEmoji emoji={r.emoji} size={13} />
                          <span>{r.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <EmojiPickerModal
        isOpen={Boolean(pickerMessageId)}
        onClose={() => setPickerMessageId(null)}
        onSelectEmoji={(emoji) => {
          if (pickerMessageId) {
            void handleToggleReaction(pickerMessageId, emoji);
          }
        }}
      />

      {replyingTo && (
        <div className="flex-none px-4 py-2 border-t flex items-center justify-between gap-2 text-xs" style={{ background: "var(--color-surface2)", borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-2 truncate min-w-0">
            <CornerUpLeft size={13} className="text-amber-400 shrink-0" />
            <span className="font-semibold text-amber-400 shrink-0">Replying to {replyingTo.revealedName ?? replyingTo.identity}:</span>
            <span className="truncate opacity-75" style={{ color: "var(--color-fg)" }}>"{replyingTo.body}"</span>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 cursor-pointer shrink-0"
            title="Cancel reply"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {p2p.typingUsers.length > 0 && (
        <div className="w-full max-w-3xl mx-auto px-4 py-1 text-[11px] italic flex items-center gap-2" style={{ color: "var(--color-muted)" }}>
          <Radio size={12} className="animate-pulse text-amber-400" />
          <span>{p2p.typingUsers.join(", ")} is typing…</span>
        </div>
      )}

      <div className="flex-none px-4 py-2.5 border-t" style={{ borderColor: "var(--color-border)" }}>
        <form onSubmit={(e) => void handleSend(e)} className="w-full max-w-3xl mx-auto flex gap-2">
          <textarea
            value={body}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Say something to the room…"
            maxLength={LIMITS.messageMax}
            rows={1}
            className="flex-1 resize-none rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-1 transition-all"
            style={{ background: "var(--color-surface2)", color: "var(--color-fg)", border: "1px solid var(--color-border)" }}
          />
          <button
            type="submit"
            disabled={!body.trim() || sending}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:scale-[1.02] disabled:opacity-40 inline-flex items-center gap-1.5 shrink-0 shadow-xs"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)" }}
          >
            <Send size={14} />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function WallTab({
  roomId,
  p2p,
  onIncomingReactionRef,
}: {
  roomId: string;
  p2p: ReturnType<typeof useP2PRoom>;
  onIncomingReactionRef: React.MutableRefObject<((postId: string, kind: string) => void) | null>;
}) {
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [body, setBody] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const p = await getWallPosts({ data: { roomId } });
    setPosts(p);
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, [roomId]);

  useEffect(() => {
    onIncomingReactionRef.current = () => {
      sound.playHeart();
      void load();
    };
    return () => {
      onIncomingReactionRef.current = null;
    };
  }, [onIncomingReactionRef]);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressing(true);
    try {
      const dataUrl = await compressImage(file, 1200, 0.8);
      setImagePreview(dataUrl);
    } catch {
      // ignore
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleRemoveImage() {
    setImagePreview(null);
  }

  async function post(e: FormEvent) {
    e.preventDefault();
    if ((!body.trim() && !imagePreview) || posting || isCompressing) return;
    setPosting(true);
    sound.playPop();
    try {
      await createWallPost({ data: { roomId, body: body.trim(), imageUrl: imagePreview } });
      setBody("");
      setImagePreview(null);
      await load();
    } finally {
      setPosting(false);
    }
  }

  async function react(postId: string, kind: string) {
    sound.playHeart();
    p2p.broadcastReaction(postId, kind);
    await toggleReaction({ data: { postId, kind } });
    await load();
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="w-full max-w-3xl mx-auto space-y-3.5">
          {posts.length === 0 && (
            <div className="text-center py-16 space-y-2" style={{ color: "var(--color-muted)" }}>
              <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center bg-neutral-800/80 text-neutral-400">
                <LayoutGrid size={20} />
              </div>
              <p className="text-sm font-medium">The wall is blank</p>
              <p className="text-xs">Post thoughts, photos, jokes, or stories for your roommates to see.</p>
            </div>
          )}
          {posts.map((postItem) => (
            <div
              key={postItem.id}
              className="rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs border transition-all"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              <div className="flex items-center gap-2.5">
                <AnimalAvatar
                  animal={postItem.animal}
                  color={postItem.color}
                  size={26}
                  revealed={Boolean(postItem.revealedName)}
                  displayName={postItem.revealedName}
                />
                <span className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                  {postItem.revealedName ? `${postItem.revealedName} (${postItem.identity})` : postItem.identity} · {timeAgo(postItem.createdAt)}
                </span>
              </div>

              {postItem.body && (
                <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-fg)" }}>
                  {postItem.body}
                </p>
              )}

              {postItem.imageUrl && (
                <div className="pt-1">
                  <img
                    src={postItem.imageUrl}
                    alt="Wall attachment"
                    onClick={() => setLightboxSrc(postItem.imageUrl)}
                    className="max-h-80 w-auto max-w-full rounded-xl object-cover cursor-pointer hover:opacity-95 transition-opacity border"
                    style={{ borderColor: "var(--color-border)" }}
                  />
                </div>
              )}

              <div className="flex gap-1.5 flex-wrap pt-1">
                {REACTION_TYPES.map(({ kind }) => {
                  const existing = postItem.reactions.find((x) => x.kind === kind);
                  return (
                    <ReactionButton
                      key={kind}
                      kind={kind}
                      count={existing?.count || 0}
                      mine={Boolean(existing?.mine)}
                      onClick={() => void react(postItem.id, kind)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-none px-4 py-2.5 border-t space-y-2" style={{ borderColor: "var(--color-border)" }}>
        {imagePreview && (
          <div className="w-full max-w-3xl mx-auto flex items-center gap-3 p-2 rounded-xl border" style={{ background: "var(--color-surface2)", borderColor: "var(--color-border)" }}>
            <img src={imagePreview} alt="Preview" className="h-12 w-12 rounded-lg object-cover border border-neutral-700" />
            <div className="flex-1 text-xs truncate" style={{ color: "var(--color-fg)" }}>
              Photo attached
            </div>
            <button
              type="button"
              onClick={handleRemoveImage}
              className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              title="Remove image"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <form onSubmit={(e) => void post(e)} className="w-full max-w-3xl mx-auto flex items-end gap-2">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageSelect}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCompressing || posting}
            className="p-2.5 rounded-xl border text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-neutral-800 transition-all shrink-0"
            style={{ background: "var(--color-surface2)", borderColor: "var(--color-border)" }}
            title="Attach a photo"
          >
            <ImageIcon size={16} />
          </button>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Post something or attach a photo…"
            maxLength={LIMITS.wallPostMax}
            rows={1}
            className="flex-1 resize-none rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-1 transition-all"
            style={{ background: "var(--color-surface2)", color: "var(--color-fg)", border: "1px solid var(--color-border)" }}
          />

          <button
            type="submit"
            disabled={(!body.trim() && !imagePreview) || posting || isCompressing}
            className="rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-40 hover:opacity-80 inline-flex items-center gap-1.5 shrink-0 shadow-xs"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)" }}
          >
            <Plus size={15} />
            <span>{posting ? "Posting…" : "Post"}</span>
          </button>
        </form>
      </div>

      <ImageLightbox
        src={lightboxSrc}
        onClose={() => setLightboxSrc(null)}
      />
    </div>
  );
}

// ─── Fridge Tab ──────────────────────────────────────────────────────────────

const NOTE_PALETTE = [
  { label: "Warm Butter", value: "#FBE8A6" },
  { label: "Mint Sage", value: "#BCECE0" },
  { label: "Blush Rose", value: "#F4B6C2" },
  { label: "Powder Sky", value: "#BEE3F8" },
  { label: "Soft Lavender", value: "#E9D8FD" },
];

function FridgeTab({
  roomId,
  p2p,
  onIncomingNoteRef,
}: {
  roomId: string;
  p2p: ReturnType<typeof useP2PRoom>;
  onIncomingNoteRef: React.MutableRefObject<(() => void) | null>;
}) {
  const [notes, setNotes] = useState<FridgeNote[]>([]);
  const [body, setBody] = useState("");
  const [selectedColor, setSelectedColor] = useState(NOTE_PALETTE[0].value);
  const [adding, setAdding] = useState(false);

  async function load() {
    setNotes(await getFridgeNotes({ data: { roomId } }));
  }
  useEffect(() => {
    void load();
  }, [roomId]);

  useEffect(() => {
    onIncomingNoteRef.current = () => {
      sound.playPop();
      void load();
    };
    return () => {
      onIncomingNoteRef.current = null;
    };
  }, [onIncomingNoteRef]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() || adding) return;
    setAdding(true);
    sound.playPop();
    const res = await addFridgeNote({ data: { roomId, body: body.trim(), color: selectedColor } });
    p2p.broadcastNoteAdded(res.id);
    setBody("");
    await load();
    setAdding(false);
  }

  async function handleDelete(noteId: string) {
    sound.playUnstick();
    await deleteFridgeNote({ data: { noteId } });
    await load();
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {notes.length === 0 && (
          <div className="text-center py-16 space-y-2" style={{ color: "var(--color-muted)" }}>
            <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center bg-neutral-800/80 text-neutral-400">
              <StickyNote size={20} />
            </div>
            <p className="text-sm font-medium">The fridge is empty</p>
            <p className="text-xs">Stick a note: rules, grocery lists, or random reminders.</p>
          </div>
        )}
        <div className="w-full max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 sm:gap-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="relative group rounded-2xl p-4 sm:p-5 text-sm leading-snug transition-transform hover:scale-105"
              style={{
                background: note.color,
                color: "#1a1916",
                transform: `rotate(${note.tilt}deg)`,
                boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
              }}
            >
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-tr from-neutral-800 to-neutral-400 shadow-xs" />
                {note.isMe && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(note.id)}
                    className="opacity-0 group-hover:opacity-100 text-neutral-800 hover:text-red-700 p-0.5 rounded transition-all"
                    title="Remove note"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              <p className="text-[10px] font-bold mb-2 opacity-50 uppercase tracking-wider">
                {note.identity}
              </p>
              <p className="font-sans text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{note.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-none px-4 py-2.5 border-t" style={{ borderColor: "var(--color-border)" }}>
        <form onSubmit={(e) => void add(e)} className="w-full max-w-3xl mx-auto flex flex-col sm:flex-row gap-2">
          <div className="flex items-center justify-center sm:justify-start gap-1.5 py-1 sm:py-0 shrink-0">
            {NOTE_PALETTE.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setSelectedColor(c.value)}
                className={`h-6 w-6 rounded-full transition-transform ${
                  selectedColor === c.value ? "scale-110 ring-2 ring-amber-400 ring-offset-2 ring-offset-neutral-900" : "opacity-75 hover:opacity-100"
                }`}
                style={{ background: c.value }}
                title={c.label}
              />
            ))}
          </div>

          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a sticky note for the fridge…"
            maxLength={LIMITS.fridgeNoteMax}
            className="flex-1 rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-1 transition-all"
            style={{ background: "var(--color-surface2)", color: "var(--color-fg)", border: "1px solid var(--color-border)" }}
          />
          <button
            type="submit"
            disabled={!body.trim() || adding}
            className="rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-40 hover:opacity-80 inline-flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)" }}
          >
            <Plus size={15} />
            <span>Stick Note</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function MusicTab({ roomId }: { roomId: string }) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [activeTab, setActiveTab] = useState<"search" | "paste">("search");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TrackSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null);

  const [pasteUrl, setPasteUrl] = useState("");
  const [pastedTitle, setPastedTitle] = useState("");
  const [pastedArtist, setPastedArtist] = useState("");
  const [pastedCover, setPastedCover] = useState<string | null>(null);
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [isAddingPasted, setIsAddingPasted] = useState(false);

  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyStatus>({ isConfigured: false, isConnected: false });
  const [nowPlaying, setNowPlaying] = useState<SpotifyTrackInfo | null>(null);
  const [isSharingNowPlaying, setIsSharingNowPlaying] = useState(false);
  const [showSpotifySetupModal, setShowSpotifySetupModal] = useState(false);
  const [showSpotifyDisconnectModal, setShowSpotifyDisconnectModal] = useState(false);
  const [isDisconnectingSpotify, setIsDisconnectingSpotify] = useState(false);

  async function loadSongs() {
    setSongs(await getSongs({ data: { roomId } }));
  }

  async function checkSpotify() {
    try {
      const status = await getSpotifyStatus();
      setSpotifyStatus(status);
      if (status.isConnected) {
        const np = await getSpotifyNowPlaying();
        setNowPlaying(np);
      }
    } catch {}
  }

  useEffect(() => {
    void loadSongs();
    void checkSpotify();
    const interval = setInterval(() => {
      void checkSpotify();
    }, 12_000);
    return () => clearInterval(interval);
  }, [roomId]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchTracks({ data: { query: q } });
        setSearchResults(results);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function handlePasteUrlChange(urlVal: string) {
    setPasteUrl(urlVal);
    const trimmed = urlVal.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      setIsFetchingMeta(true);
      try {
        const meta = await fetchTrackMetadata({ data: { url: trimmed } });
        if (meta) {
          setPastedTitle(meta.title);
          setPastedArtist(meta.artist);
          setPastedCover(meta.coverUrl);
        }
      } finally {
        setIsFetchingMeta(false);
      }
    }
  }

  async function handleAddSearchResult(track: TrackSearchResult) {
    setAddingTrackId(track.id);
    sound.playPop();
    try {
      await addSong({
        data: {
          roomId,
          title: track.title,
          artist: track.artist,
          url: track.url,
          coverUrl: track.coverUrl,
        },
      });
      await loadSongs();
      setSearchQuery("");
      setSearchResults([]);
    } finally {
      setAddingTrackId(null);
    }
  }

  async function handleAddPastedSong(e: FormEvent) {
    e.preventDefault();
    if (!pasteUrl.trim() || isAddingPasted) return;
    setIsAddingPasted(true);
    sound.playPop();
    try {
      await addSong({
        data: {
          roomId,
          title: pastedTitle.trim() || "Shared Track",
          artist: pastedArtist.trim() || "Artist",
          url: pasteUrl.trim(),
          coverUrl: pastedCover,
        },
      });
      setPasteUrl("");
      setPastedTitle("");
      setPastedArtist("");
      setPastedCover(null);
      await loadSongs();
    } finally {
      setIsAddingPasted(false);
    }
  }

  async function handleShareNowPlaying() {
    if (!nowPlaying || isSharingNowPlaying) return;
    setIsSharingNowPlaying(true);
    sound.playPop();
    try {
      await addSong({
        data: {
          roomId,
          title: nowPlaying.title,
          artist: nowPlaying.artist,
          url: nowPlaying.url,
          coverUrl: nowPlaying.coverUrl,
        },
      });
      await loadSongs();
    } finally {
      setIsSharingNowPlaying(false);
    }
  }

  async function handleConnectSpotify() {
    try {
      const res = await getSpotifyAuthUrl();
      if (res.url) {
        window.open(res.url, "spotify_auth", "width=600,height=700,scrollbars=yes");
      } else {
        setShowSpotifySetupModal(true);
      }
    } catch {
      setShowSpotifySetupModal(true);
    }
  }

  async function handleConfirmDisconnectSpotify() {
    setIsDisconnectingSpotify(true);
    try {
      await disconnectSpotify();
      setSpotifyStatus({ ...spotifyStatus, isConnected: false });
      setNowPlaying(null);
      setShowSpotifyDisconnectModal(false);
    } finally {
      setIsDisconnectingSpotify(false);
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-none p-3.5 border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="w-full max-w-3xl mx-auto space-y-3">
          {spotifyStatus.isConnected && nowPlaying && (
            <div
              className="rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 shadow-xs"
              style={{
                background: "rgba(30, 215, 96, 0.12)",
                border: "1px solid rgba(30, 215, 96, 0.35)",
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                {nowPlaying.coverUrl ? (
                  <img src={nowPlaying.coverUrl} alt="" className="h-11 w-11 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-emerald-950 text-emerald-400 shrink-0">
                    <Disc3 size={22} />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Now Playing on your Spotify
                  </div>
                  <div className="text-sm font-semibold truncate text-white">{nowPlaying.title}</div>
                  <div className="text-xs truncate opacity-70">{nowPlaying.artist}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={isSharingNowPlaying}
                  onClick={() => void handleShareNowPlaying()}
                  className="text-xs px-3.5 py-2 rounded-xl font-semibold bg-emerald-500 text-black hover:bg-emerald-400 transition-all shadow-xs inline-flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>{isSharingNowPlaying ? "Sharing…" : "Share to Room"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSpotifyDisconnectModal(true)}
                  className="text-xs opacity-40 hover:opacity-100 p-1.5 rounded-lg hover:bg-neutral-800"
                  title="Disconnect Spotify"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          {!spotifyStatus.isConnected && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs px-3.5 py-2.5 rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
              <span className="opacity-80">Listening on Spotify? Sync your live tracks with roommates:</span>
              <button
                type="button"
                onClick={() => void handleConnectSpotify()}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-105 inline-flex items-center gap-1.5 self-end sm:self-auto shrink-0 shadow-xs"
                style={{ background: "#1db954", color: "#000" }}
              >
                <Disc3 size={13} />
                <span>Connect Spotify</span>
              </button>
            </div>
          )}

          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("search")}
              className="px-3.5 py-1.5 rounded-xl font-medium transition-colors inline-flex items-center gap-1.5"
              style={{
                background: activeTab === "search" ? "var(--color-primary)" : "var(--color-surface2)",
                color: activeTab === "search" ? "var(--color-primary-fg)" : "var(--color-muted)",
              }}
            >
              <Search size={13} />
              <span>Instant Search</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("paste")}
              className="px-3.5 py-1.5 rounded-xl font-medium transition-colors inline-flex items-center gap-1.5"
              style={{
                background: activeTab === "paste" ? "var(--color-primary)" : "var(--color-surface2)",
                color: activeTab === "paste" ? "var(--color-primary-fg)" : "var(--color-muted)",
              }}
            >
              <Link2 size={13} />
              <span>Paste Link</span>
            </button>
          </div>

          {activeTab === "search" && (
            <div className="relative">
              <div className="absolute left-3.5 top-2.5 text-[var(--color-muted)]">
                <Search size={15} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any song or artist (e.g. Midnight City, Daft Punk, Lofi)..."
                className="w-full rounded-xl pl-9 pr-9 py-2.5 text-sm outline-none focus:ring-1 transition-all"
                style={{
                  background: "var(--color-surface2)",
                  color: "var(--color-fg)",
                  border: "1px solid var(--color-border)",
                }}
              />
              {isSearching && (
                <span className="absolute right-3.5 top-2.5 text-xs animate-spin opacity-60">
                  <Disc3 size={15} />
                </span>
              )}

              {searchResults.length > 0 && (
                <div
                  className="absolute z-30 left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto rounded-2xl p-2 shadow-2xl border space-y-1 backdrop-blur-md"
                  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
                >
                  {searchResults.map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-neutral-800/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {track.coverUrl ? (
                          <img src={track.coverUrl} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-neutral-800 text-xs shrink-0">
                            <Disc3 size={16} className="text-neutral-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-semibold truncate text-white">{track.title}</div>
                          <div className="text-[11px] truncate opacity-70" style={{ color: "var(--color-muted)" }}>
                            {track.artist} {track.album && `· ${track.album}`}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={addingTrackId === track.id}
                        onClick={() => void handleAddSearchResult(track)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 shrink-0 inline-flex items-center gap-1 shadow-xs"
                        style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)" }}
                      >
                        <Plus size={13} />
                        <span>{addingTrackId === track.id ? "Adding…" : "Add"}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "paste" && (
            <form onSubmit={(e) => void handleAddPastedSong(e)} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={pasteUrl}
                  onChange={(e) => void handlePasteUrlChange(e.target.value)}
                  placeholder="Paste Spotify track or YouTube link..."
                  required
                  className="flex-1 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm outline-none focus:ring-1"
                  style={{ background: "var(--color-surface2)", color: "var(--color-fg)", border: "1px solid var(--color-border)" }}
                />
                <button
                  type="submit"
                  disabled={!pasteUrl.trim() || isAddingPasted || isFetchingMeta}
                  className="rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold disabled:opacity-40 inline-flex items-center gap-1.5 shadow-xs shrink-0"
                  style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)" }}
                >
                  <Plus size={14} />
                  <span>{isAddingPasted ? "Adding…" : "Add Song"}</span>
                </button>
              </div>

              {isFetchingMeta && <div className="text-[11px] italic text-amber-400">Fetching song details…</div>}

              {pastedTitle && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl text-xs border" style={{ background: "var(--color-surface2)", borderColor: "var(--color-border)" }}>
                  {pastedCover && <img src={pastedCover} alt="" className="h-9 w-9 rounded-lg object-cover" />}
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{pastedTitle}</div>
                    <div className="opacity-70 text-[11px]">{pastedArtist}</div>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="w-full max-w-3xl mx-auto space-y-3">
          {songs.length === 0 && (
            <div className="text-center py-16 space-y-2" style={{ color: "var(--color-muted)" }}>
              <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center bg-neutral-800/80 text-neutral-400">
                <Music2 size={20} />
              </div>
              <p className="text-sm font-medium">The room playlist is quiet</p>
              <p className="text-xs">Search a song above or sync your Spotify to start listening together.</p>
            </div>
          )}

          {songs.map((song) => (
            <div
              key={song.id}
              className="rounded-2xl p-4 space-y-2.5 shadow-xs border transition-all"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              <div className="flex items-center gap-3">
                {song.coverUrl ? (
                  <img src={song.coverUrl} alt="" className="h-12 w-12 rounded-xl object-cover shrink-0 shadow-xs" />
                ) : (
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-neutral-800 text-neutral-400 shrink-0">
                    <Disc3 size={20} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: "var(--color-fg)" }}>
                    {song.title}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                    {song.artist} · added by <span className="font-medium text-amber-500">{song.identity}</span>
                  </div>
                </div>
                <a
                  href={song.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg font-medium hover:opacity-80 shrink-0 inline-flex items-center gap-1.5 border transition-opacity"
                  style={{ background: "var(--color-surface2)", color: "var(--color-primary)", borderColor: "var(--color-border)" }}
                >
                  <span>External</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              <MediaEmbed url={song.url} title={song.title} />
            </div>
          ))}
        </div>
      </div>

      <SpotifySetupModal
        isOpen={showSpotifySetupModal}
        onClose={() => setShowSpotifySetupModal(false)}
      />

      <SpotifyDisconnectModal
        isOpen={showSpotifyDisconnectModal}
        onClose={() => setShowSpotifyDisconnectModal(false)}
        onConfirm={() => void handleConfirmDisconnectSpotify()}
        isSubmitting={isDisconnectingSpotify}
      />
    </div>
  );
}

function DailyTab({ roomId }: { roomId: string }) {
  const [question, setQuestion] = useState<DailyQuestionView | null | "loading">("loading");
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const q = await getDailyQuestion({ data: { roomId } });
    setQuestion(q);
    if (q?.myAnswer) setAnswer(q.myAnswer);
  }

  useEffect(() => {
    void load();
  }, [roomId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!answer.trim() || submitting || !question || question === "loading") return;
    setSubmitting(true);
    sound.playPop();
    try {
      await submitDailyAnswer({
        data: { roomId, dayIndex: question.dayIndex, questionId: question.questionId, body: answer.trim() },
      });
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  if (question === "loading") {
    return (
      <div className="grid h-full place-items-center">
        <span className="text-sm" style={{ color: "var(--color-muted)" }}>Loading question…</span>
      </div>
    );
  }
  if (!question) {
    return (
      <div className="grid h-full place-items-center">
        <p className="text-sm text-center px-4" style={{ color: "var(--color-muted)" }}>
          Daily questions unlock once the room starts.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto px-4 py-6">
      <div className="w-full max-w-3xl mx-auto space-y-4">
        <div className="rounded-2xl p-5 sm:p-6 space-y-2 border shadow-xs" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <div className="text-xs font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={14} />
            <span>{question.dayLabel} Prompt</span>
          </div>
          <h2 className="text-base sm:text-lg font-semibold leading-snug" style={{ color: "var(--color-fg)" }}>
            {question.prompt}
          </h2>
        </div>

        {!question.myAnswer ? (
          <form onSubmit={(e) => void submit(e)} className="space-y-2.5">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Write your answer to share with roommates…"
              maxLength={LIMITS.dailyAnswerMax}
              rows={3}
              className="w-full resize-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 transition-all"
              style={{ background: "var(--color-surface2)", color: "var(--color-fg)", border: "1px solid var(--color-border)" }}
            />
            <button
              type="submit"
              disabled={!answer.trim() || submitting}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-40 hover:opacity-80 transition-all shadow-xs"
              style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)" }}
            >
              {submitting ? "Submitting…" : "Share Answer"}
            </button>
          </form>
        ) : (
          <div className="rounded-2xl p-4 sm:p-5 space-y-1.5 text-sm border shadow-xs" style={{ background: "rgba(194, 144, 90, 0.1)", borderColor: "var(--color-primary)", color: "var(--color-fg)" }}>
            <div className="text-xs font-semibold text-amber-500 flex items-center gap-1">
              <BadgeCheck size={14} />
              <span>Your Answer:</span>
            </div>
            <p className="leading-relaxed sm:text-base">{question.myAnswer}</p>
          </div>
        )}

        {question.answers.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 opacity-60" style={{ color: "var(--color-fg)" }}>
              <Users size={13} />
              <span>Roommate Answers ({question.answers.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {question.answers.map((a, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-4 space-y-2 border shadow-xs"
                  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
                >
                  <div className="flex items-center gap-2">
                    <AnimalAvatar animal={a.animal} color={a.color} size={22} />
                    <span className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                      {a.identity} {a.isMe && "(You)"}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-fg)" }}>
                    {a.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
