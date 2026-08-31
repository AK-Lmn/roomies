import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { upsertProfile, getMyProfile, checkUsernameAvailability } from "@/lib/server/profiles";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useState, useEffect, type FormEvent } from "react";
import { LIMITS, USERNAME_RE } from "@/lib/limits";
import { ANIMAL_AVATAR_CHOICES, type AnimalAvatarChoice } from "@/lib/avatar-choices";
import { generateRandomUsername } from "@/lib/username-generator";
import { Sparkles, Shield, User, ArrowRight, Radio, Shuffle, Check, X, Loader2 } from "lucide-react";

export const Route = createFileRoute("/onboarding")({ component: OnboardingPage });

function OnboardingPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [selectedAvatar, setSelectedAvatar] = useState<AnimalAvatarChoice>(ANIMAL_AVATAR_CHOICES[0]);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"available" | "taken" | "invalid" | null>(null);

  const userId = user?.id;

  function handleRegenerateUsername() {
    const randomUser = generateRandomUsername();
    setUsername(randomUser);
  }

  useEffect(() => {
    if (!userId) {
      setChecking(false);
      return;
    }
    const authName = (user as { displayName?: string })?.displayName ?? "";
    setDisplayName(authName.slice(0, LIMITS.displayNameMax) || "Zio");
    handleRegenerateUsername();

    getMyProfile()
      .then((p) => {
        if (p) void navigate({ to: "/" });
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [userId, navigate]);

  // Live availability check debounce
  useEffect(() => {
    if (!username) {
      setUsernameStatus(null);
      return;
    }
    if (!USERNAME_RE.test(username)) {
      setUsernameStatus("invalid");
      return;
    }
    setCheckingUsername(true);
    const timer = setTimeout(() => {
      checkUsernameAvailability({ data: { username } })
        .then((res) => {
          setUsernameStatus(res.available ? "available" : "taken");
        })
        .catch(() => {
          setUsernameStatus(null);
        })
        .finally(() => setCheckingUsername(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [username]);

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
    if (usernameStatus === "taken") {
      setError("That username is already taken. Please pick another one.");
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
          avatarUrl: selectedAvatar.avatarUrl,
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
    <main className="min-h-dvh flex items-center justify-center p-4 sm:p-6" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="relative mx-auto w-16 h-16 rounded-2xl overflow-hidden border-2 shadow-2xl p-1" style={{ borderColor: selectedAvatar.color, background: "var(--color-surface2)" }}>
            <img
              src={selectedAvatar.avatarUrl}
              alt=""
              className="w-full h-full object-contain rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--color-fg)" }}>
              Create Your Profile
            </h1>
            <p className="text-xs leading-relaxed opacity-75" style={{ color: "var(--color-muted)" }}>
              Choose your animal persona and customize your room identity.
            </p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {/* Avatar Choice Grid - No text names */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: "var(--color-muted)" }}>
              Choose Animal Avatar
            </label>
            <div className="grid grid-cols-6 gap-2">
              {ANIMAL_AVATAR_CHOICES.map((choice) => {
                const isSelected = selectedAvatar.id === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => setSelectedAvatar(choice)}
                    title={choice.name}
                    className="aspect-square rounded-2xl border flex items-center justify-center p-1 transition-all hover:scale-110 cursor-pointer relative"
                    style={{
                      background: isSelected ? "var(--color-surface2)" : "var(--color-surface)",
                      borderColor: isSelected ? choice.color : "var(--color-border)",
                      boxShadow: isSelected ? `0 0 0 2px ${choice.color}` : "none",
                    }}
                  >
                    <img src={choice.avatarUrl} alt="" className="w-full h-full object-contain rounded-xl" />
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-white shadow-xs" style={{ background: choice.color }}>
                        <Check size={9} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Username with Regenerate button & Live status */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                Username
              </label>
              {checkingUsername ? (
                <span className="text-[11px] flex items-center gap-1 opacity-70" style={{ color: "var(--color-muted)" }}>
                  <Loader2 size={11} className="animate-spin" /> Checking…
                </span>
              ) : usernameStatus === "available" ? (
                <span className="text-[11px] flex items-center gap-1 text-emerald-400 font-medium">
                  <Check size={12} strokeWidth={2.5} /> Available
                </span>
              ) : usernameStatus === "taken" ? (
                <span className="text-[11px] flex items-center gap-1 text-rose-400 font-medium">
                  <X size={12} strokeWidth={2.5} /> Already taken
                </span>
              ) : null}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-xs text-neutral-500 font-mono">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="cozy_bear_42"
                  maxLength={LIMITS.usernameMax}
                  required
                  className="w-full rounded-xl pl-7 pr-3 py-2.5 text-sm outline-none focus:ring-1 border transition-all"
                  style={{
                    background: "var(--color-surface2)",
                    color: "var(--color-fg)",
                    borderColor: usernameStatus === "taken" ? "rgba(244, 63, 94, 0.4)" : "var(--color-border)",
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleRegenerateUsername}
                title="Generate another username"
                className="px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-medium transition-all hover:bg-neutral-800 cursor-pointer shrink-0"
                style={{
                  background: "var(--color-surface2)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-fg)",
                }}
              >
                <Shuffle size={14} />
                <span className="hidden sm:inline">Shuffle</span>
              </button>
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
              placeholder="Zio"
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
              placeholder="Night owl, coffee enthusiast, and cozy music listener."
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
            disabled={saving || checkingUsername || usernameStatus === "taken"}
            className="w-full rounded-xl py-3 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-md cursor-pointer"
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
