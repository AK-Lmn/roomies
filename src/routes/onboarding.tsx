import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { upsertProfile, getMyProfile } from "@/lib/server/profiles";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useState, useEffect, type FormEvent } from "react";
import { LIMITS, USERNAME_RE } from "@/lib/limits";
import { AnimalAvatar } from "@/components/animal-avatar";
import { Sparkles, Shield, User, ArrowRight, Radio } from "lucide-react";

export const Route = createFileRoute("/onboarding")({ component: OnboardingPage });

function OnboardingPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setChecking(false);
      return;
    }
    const authName = (user as { displayName?: string })?.displayName ?? "";
    setDisplayName(authName.slice(0, LIMITS.displayNameMax));
    getMyProfile()
      .then((p) => {
        if (p) void navigate({ to: "/" });
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [userId, navigate]);

  if (isPending || checking) {
    return (
      <div className="grid min-h-dvh place-items-center" style={{ background: "var(--color-bg)", color: "var(--color-muted)" }}>
        <div className="flex items-center gap-2 text-sm">
          <Radio size={16} className="animate-spin text-amber-500" />
          <span>Loading profile…</span>
        </div>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!USERNAME_RE.test(username)) {
      setError("Username: 3–20 lowercase letters, numbers, underscores only.");
      return;
    }
    if (displayName.trim().length < LIMITS.displayNameMin) {
      setError(`Display name must be at least ${LIMITS.displayNameMin} characters.`);
      return;
    }
    setSaving(true);
    try {
      await upsertProfile({
        data: {
          username,
          displayName: displayName.trim(),
          bio: bio.trim(),
          avatarUrl: null,
          websiteUrl: "",
          instagramUrl: "",
          xUrl: "",
          showBio: true,
          showSocial: false,
          showJoined: true,
        },
      });
      await navigate({ to: "/" });
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Something went wrong";
      setError(msg === "USERNAME_TAKEN" ? "That username is already taken." : msg);
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-fit">
            <AnimalAvatar
              animal="Fox"
              color="#c2905a"
              size={56}
              revealed={Boolean(displayName.trim())}
              displayName={displayName.trim() || undefined}
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--color-fg)" }}>
              Create Your Profile
            </h1>
            <p className="text-xs leading-relaxed opacity-75" style={{ color: "var(--color-muted)" }}>
              You start anonymous in every room. Your real profile is only shown when you choose to reveal yourself.
            </p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-neutral-500 font-mono">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="sleepy_fox"
                maxLength={LIMITS.usernameMax}
                required
                className="w-full rounded-xl pl-7 pr-3 py-2.5 text-sm outline-none focus:ring-1 border transition-all"
                style={{
                  background: "var(--color-surface2)",
                  color: "var(--color-fg)",
                  borderColor: "var(--color-border)",
                }}
              />
            </div>
            <p className="text-[11px] opacity-50">3–20 lowercase letters, numbers, and underscores.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Alex Rivers"
              maxLength={LIMITS.displayNameMax}
              required
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 border transition-all"
              style={{
                background: "var(--color-surface2)",
                color: "var(--color-fg)",
                borderColor: "var(--color-border)",
              }}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                Bio <span className="lowercase font-normal opacity-60">(optional)</span>
              </label>
              <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                {bio.length}/{LIMITS.bioMax}
              </span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Night owl, coffee enthusiast, and indie game developer."
              maxLength={LIMITS.bioMax}
              rows={3}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 resize-none border transition-all"
              style={{
                background: "var(--color-surface2)",
                color: "var(--color-fg)",
                borderColor: "var(--color-border)",
              }}
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl py-3 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-md"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)" }}
          >
            <span>{saving ? "Saving Profile…" : "Enter Roomies"}</span>
            <ArrowRight size={15} />
          </button>
        </form>
      </div>
    </main>
  );
}
