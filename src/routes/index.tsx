import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { listMyRooms, getActiveOnlineCount, leaveRoom } from "@/lib/server/rooms";
import { getMyProfile } from "@/lib/server/profiles";
import { useEffect, useState } from "react";
import { shortRemaining } from "@/lib/format";
import type { RoomSummary, Profile } from "@/lib/types";
import { Users, Clock, Compass, Sparkles, ChevronRight, DoorOpen, Radio, User, LogOut } from "lucide-react";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null | "loading">("loading");
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [activeUsers, setActiveUsers] = useState<number>(1);

  async function handleLeaveRoom(roomId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to leave this room?")) return;
    try {
      await leaveRoom({ data: { roomId } });
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
    } catch {}
  }

  const userId = user?.id;
  useEffect(() => {
    const updateCount = () => {
      getActiveOnlineCount().then((res) => setActiveUsers(res.activeCount)).catch(() => {});
    };
    updateCount();
    const interval = setInterval(updateCount, 10_000);
    window.addEventListener("focus", updateCount);
    document.addEventListener("visibilitychange", updateCount);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", updateCount);
      document.removeEventListener("visibilitychange", updateCount);
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    setProfile("loading");
    getMyProfile()
      .then((p) => {
        setProfile(p);
        if (!p) void navigate({ to: "/onboarding" });
      })
      .catch(() => setProfile(null));

    listMyRooms()
      .then(setRooms)
      .catch(() => {});
  }, [userId, navigate]);

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center" style={{ background: "var(--color-bg)", color: "var(--color-muted)" }}>
        <div className="flex items-center gap-2 text-sm">
          <Radio size={16} className="animate-spin text-amber-500" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  if (user && profile === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center" style={{ background: "var(--color-bg)", color: "var(--color-muted)" }}>
        <div className="flex items-center gap-2 text-sm">
          <Radio size={16} className="animate-spin text-amber-500" />
          <span>Loading profile…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col justify-between" style={{ background: "var(--color-bg)" }}>
      <header className="px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="w-full max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-xs">
              <Compass size={16} />
            </div>
            <span className="font-bold tracking-tight text-sm" style={{ color: "var(--color-fg)" }}>
              Roomies
            </span>
          </div>
          <div className="flex items-center gap-3">
            <SignedIn>
              <a
                href="/profile"
                className="text-xs font-medium inline-flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity"
                style={{ color: "var(--color-fg)" }}
              >
                <User size={13} />
                <span>Profile</span>
              </a>
              <UserButton />
            </SignedIn>
            <SignedOut>
              <a
                href="/login"
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-opacity hover:opacity-90 shadow-xs"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)", borderColor: "var(--color-border)" }}
              >
                Sign In
              </a>
            </SignedOut>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10 md:py-14 space-y-8 my-auto">
        <SignedOut>
          <div className="text-center space-y-6 py-8">
            <div className="mx-auto h-20 w-20 rounded-3xl flex items-center justify-center border shadow-2xl" style={{ background: "rgba(194, 144, 90, 0.12)", borderColor: "var(--color-border)", color: "var(--color-primary)" }}>
              <DoorOpen size={36} />
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight" style={{ color: "var(--color-fg)" }}>
                A room.<br />
                <span className="text-amber-400">Anonymous strangers.</span><br />
                7 days.
              </h1>
              <p className="text-sm sm:text-base max-w-md mx-auto leading-relaxed" style={{ color: "var(--color-muted)" }}>
                Share a cozy room with strangers for 7 days. Chat, play music, and leave notes.
              </p>
            </div>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border shadow-xs" style={{ background: "rgba(16, 185, 129, 0.08)", borderColor: "rgba(16, 185, 129, 0.25)", color: "#34d399" }}>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{activeUsers === 1 ? "1 user active right now" : `${activeUsers} users active right now`}</span>
              </div>

              <div>
                <a
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold transition-all hover:scale-105 shadow-xl"
                  style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)" }}
                >
                  <Sparkles size={16} />
                  <span>Get a Room</span>
                </a>
              </div>
            </div>
          </div>
        </SignedOut>

        <SignedIn>
          {rooms.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xs uppercase tracking-widest font-semibold opacity-50 flex items-center gap-1.5" style={{ color: "var(--color-fg)" }}>
                    <DoorOpen size={13} />
                    <span>Your Active Rooms</span>
                  </h2>
                  <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border" style={{ background: "rgba(16, 185, 129, 0.08)", borderColor: "rgba(16, 185, 129, 0.25)", color: "#34d399" }}>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{activeUsers === 1 ? "1 online" : `${activeUsers} online`}</span>
                  </div>
                </div>
                <a
                  href="/match"
                  className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1 font-medium"
                >
                  <Compass size={12} />
                  <span>+ Join Another</span>
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rooms.map((room) => (
                  <a
                    key={room.id}
                    href={`/room/${room.id}`}
                    className="flex items-center justify-between rounded-2xl p-4 transition-all hover:scale-[1.01] border shadow-xs group"
                    style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-semibold group-hover:text-amber-400 transition-colors" style={{ color: "var(--color-fg)" }}>
                        {room.name}
                      </div>
                      <div className="text-xs flex items-center gap-2" style={{ color: "var(--color-muted)" }}>
                        <span className="flex items-center gap-1">
                          <Users size={11} /> {room.memberCount} roommate{room.memberCount !== 1 ? "s" : ""}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Clock size={11} /> {room.status === "active" ? shortRemaining(room.remainingMs) : room.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => void handleLeaveRoom(room.id, e)}
                        className="h-8 w-8 rounded-xl flex items-center justify-center border transition-colors hover:bg-rose-500/10 hover:border-rose-500/30 text-neutral-400 hover:text-rose-400"
                        style={{ background: "var(--color-surface2)", borderColor: "var(--color-border)" }}
                        title="Leave Room"
                      >
                        <LogOut size={14} />
                      </button>
                      <div className="h-8 w-8 rounded-xl flex items-center justify-center border transition-colors group-hover:bg-neutral-800" style={{ background: "var(--color-surface2)", borderColor: "var(--color-border)", color: "var(--color-muted)" }}>
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ) : (
            <div className="text-center py-10 space-y-6">
              <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center border" style={{ background: "rgba(194, 144, 90, 0.1)", borderColor: "var(--color-border)", color: "var(--color-primary)" }}>
                <Compass size={28} />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold" style={{ color: "var(--color-fg)" }}>
                  No active rooms yet
                </h2>
                <p className="text-xs max-w-xs mx-auto" style={{ color: "var(--color-muted)" }}>
                  Join the queue to be matched with roommates for the next 7 days.
                </p>
              </div>

              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border shadow-xs" style={{ background: "rgba(16, 185, 129, 0.08)", borderColor: "rgba(16, 185, 129, 0.25)", color: "#34d399" }}>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{activeUsers === 1 ? "1 user active right now" : `${activeUsers} users active right now`}</span>
                </div>

                <div>
                  <a
                    href="/match"
                    className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all hover:scale-105 shadow-lg"
                    style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)" }}
                  >
                    <Sparkles size={15} />
                    <span>Find a Room</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </SignedIn>
      </main>

      <footer className="px-4 py-3 border-t text-center" style={{ borderColor: "var(--color-border)" }}>
        <p className="text-[11px] opacity-40">Roomies</p>
      </footer>
    </div>
  );
}
