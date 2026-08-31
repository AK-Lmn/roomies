import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { joinQueue, leaveQueue, getActiveOnlineCount } from "@/lib/server/rooms";
import { useEffect, useRef, useState } from "react";
import type { MatchResult } from "@/lib/types";
import { ArrowLeft, Users, Sparkles, Clock, Compass, Radio } from "lucide-react";

export const Route = createFileRoute("/match")({ component: MatchPage });

function MatchPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "matching" | "matched" | "error">("idle");
  const [waitMs, setWaitMs] = useState(0);
  const [error, setError] = useState("");
  const [activeUsers, setActiveUsers] = useState<number>(1);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    const updateCount = () => {
      getActiveOnlineCount().then((res) => setActiveUsers(res.activeCount)).catch(() => {});
    };
    updateCount();
    const interval = setInterval(updateCount, 8_000);
    window.addEventListener("focus", updateCount);
    document.addEventListener("visibilitychange", updateCount);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", updateCount);
      document.removeEventListener("visibilitychange", updateCount);
    };
  }, []);

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }

  async function poll() {
    try {
      const result: MatchResult = await joinQueue();
      setWaitMs(Date.now() - startedAt.current);
      if (result.status === "matched") {
        stopPolling();
        setStatus("matched");
        await navigate({ to: `/room/${result.roomId}` });
      } else if (result.status === "needs_profile") {
        stopPolling();
        await navigate({ to: "/onboarding" });
      } else {
        setStatus("matching");
      }
    } catch {
      setStatus("error");
      setError("Something went wrong with matchmaking. Please try again.");
      stopPolling();
    }
  }

  async function start() {
    setStatus("matching");
    setError("");
    startedAt.current = Date.now();
    await poll();
    pollRef.current = setInterval(() => void poll(), 2000);
  }

  async function cancel() {
    stopPolling();
    await leaveQueue().catch(() => {});
    setStatus("idle");
  }

  useEffect(() => () => { stopPolling(); }, []);

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
  if (!user) return <RedirectToSignIn />;

  const waitSecs = Math.floor(waitMs / 1000);

  return (
    <div className="min-h-dvh flex flex-col justify-between p-6" style={{ background: "var(--color-bg)" }}>
      <header className="w-full max-w-sm mx-auto">
        <a
          href="/"
          className="text-xs font-medium inline-flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity"
          style={{ color: "var(--color-fg)" }}
        >
          <ArrowLeft size={14} />
          <span>Back to Home</span>
        </a>
      </header>

      <main className="w-full max-w-sm mx-auto my-auto text-center space-y-6">
        {status === "idle" && (
          <div className="space-y-6">
            <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center border shadow-xl" style={{ background: "rgba(194, 144, 90, 0.12)", borderColor: "var(--color-border)", color: "var(--color-primary)" }}>
              <Compass size={32} />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-fg)" }}>
                Find Roommates
              </h1>
              <p className="text-xs leading-relaxed opacity-75" style={{ color: "var(--color-muted)" }}>
                You will be assigned an anonymous animal persona and grouped into a shared room for 7 days.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-left text-xs pt-1">
              <div className="p-3 rounded-xl border space-y-1" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                  <Users size={12} />
                  <span>Small Groups</span>
                </div>
                <p className="opacity-70 text-[11px] leading-tight">2 to 8 people per cozy room</p>
              </div>
              <div className="p-3 rounded-xl border space-y-1" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                  <Clock size={12} />
                  <span>7-Day Cycle</span>
                </div>
                <p className="opacity-70 text-[11px] leading-tight">Shared music, daily prompts</p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border shadow-xs" style={{ background: "rgba(16, 185, 129, 0.08)", borderColor: "rgba(16, 185, 129, 0.25)", color: "#34d399" }}>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{activeUsers === 1 ? "1 user active right now" : `${activeUsers} users active right now`}</span>
              </div>

              <button
                type="button"
                onClick={() => void start()}
                className="w-full rounded-xl py-3 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg inline-flex items-center justify-center gap-2"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)" }}
              >
                <Sparkles size={16} />
                <span>Look for roommates</span>
              </button>
            </div>
          </div>
        )}

        {status === "matching" && (
          <div className="space-y-6 py-4">
            <div className="relative mx-auto h-24 w-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-ping" style={{ animationDuration: "2.5s" }} />
              <div className="absolute inset-2 rounded-full bg-amber-500/15 animate-pulse" />
              <div className="h-14 w-14 rounded-full flex items-center justify-center shadow-xl border relative z-10" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-primary)" }}>
                <Compass size={24} className="animate-spin" style={{ animationDuration: "8s" }} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border shadow-xs" style={{ background: "rgba(16, 185, 129, 0.08)", borderColor: "rgba(16, 185, 129, 0.25)", color: "#34d399" }}>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{activeUsers === 1 ? "1 user in matching pool" : `${activeUsers} users in matching pool`}</span>
              </div>

              <h2 className="text-base font-semibold" style={{ color: "var(--color-fg)" }}>
                Finding your room…
              </h2>
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                {waitSecs < 4
                  ? "Connecting to the matching pool…"
                  : waitSecs < 10
                  ? "Looking for compatible roommates…"
                  : `${waitSecs}s elapsed · Finalizing your group`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void cancel()}
              className="text-xs px-4 py-2 rounded-lg border hover:bg-neutral-800 transition-colors"
              style={{ color: "var(--color-muted)", borderColor: "var(--color-border)" }}
            >
              Cancel Matchmaking
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <p className="text-sm text-rose-400">{error}</p>
            <button
              type="button"
              onClick={() => void start()}
              className="rounded-xl px-5 py-2.5 text-xs font-semibold hover:opacity-80"
              style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)" }}
            >
              Try Again
            </button>
          </div>
        )}
      </main>

      <footer className="w-full max-w-sm mx-auto text-center">
        <p className="text-[11px] opacity-40">Roomies</p>
      </footer>
    </div>
  );
}
