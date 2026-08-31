import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { getMyProfile, upsertProfile, checkUsernameAvailability } from "@/lib/server/profiles";
import { useEffect, useState, type FormEvent } from "react";
import { LIMITS, USERNAME_RE, normalizeUsername } from "@/lib/limits";
import { ANIMAL_AVATAR_CHOICES, getAvatarChoiceByUrl, type AnimalAvatarChoice } from "@/lib/avatar-choices";
import { generateRandomUsername } from "@/lib/username-generator";
import type { Profile } from "@/lib/types";
import { UserButton } from "@/lib/auth/gates";
import { Modal } from "@/components/ui/modal";
import { ArrowLeft, Check, X, Shield, Globe, Instagram, Twitter, User, Shuffle, Loader2, Eye, Sparkles, BadgeCheck } from "lucide-react";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null | "loading">("loading");
  const [selectedAvatar, setSelectedAvatar] = useState<AnimalAvatarChoice>(ANIMAL_AVATAR_CHOICES[0]);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [showBio, setShowBio] = useState(true);
  const [showSocial, setShowSocial] = useState(false);
  const [showJoined, setShowJoined] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"available" | "taken" | "invalid" | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const userId = user?.id;

  function handleRegenerateUsername() {
    const randomUser = generateRandomUsername();
    setUsername(randomUser);
  }

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    getMyProfile().then((p) => {
      setProfile(p);
      if (!p) { void navigate({ to: "/onboarding" }); return; }
      setUsername(p.username);
      setDisplayName(p.displayName);
      setBio(p.bio);
      setSelectedAvatar(getAvatarChoiceByUrl(p.avatarUrl));
      setFacebookUrl(p.social.facebook || p.social.website || "");
      setInstagramUrl(p.social.instagram);
      setXUrl(p.social.x);
      setShowBio(p.showBio);
      setShowSocial(p.showSocial);
      setShowJoined(p.showJoined);
    }).catch(() => setProfile(null));
  }, [userId, navigate]);

  // Live availability check debounce
  useEffect(() => {
    if (!username) {
      setUsernameStatus(null);
      return;
    }
    const norm = normalizeUsername(username);
    if (!USERNAME_RE.test(norm)) {
      setUsernameStatus("invalid");
      return;
    }
    setCheckingUsername(true);
    const timer = setTimeout(() => {
      checkUsernameAvailability({ data: { username: norm, currentUserId: userId } })
        .then((res) => {
          setUsernameStatus(res.available ? "available" : "taken");
        })
        .catch(() => {
          setUsernameStatus(null);
        })
        .finally(() => setCheckingUsername(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [username, userId]);

  if (isPending || profile === "loading") return <div className="grid min-h-dvh place-items-center"><span className="text-sm" style={{ color: "var(--color-muted)" }}>Loading…</span></div>;
  if (!user) return <RedirectToSignIn />;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const norm = normalizeUsername(username);
    if (!USERNAME_RE.test(norm)) {
      setError("Username: 3–20 lowercase letters, numbers, underscores only.");
      return;
    }
    if (usernameStatus === "taken") {
      setError("That username is already taken. Please choose another.");
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
          username: norm,
          displayName: displayName.trim(),
          bio: bio.trim(),
          avatarUrl: selectedAvatar.avatarUrl,
          facebookUrl: facebookUrl.trim(),
          websiteUrl: facebookUrl.trim(),
          instagramUrl: instagramUrl.trim(),
          xUrl: xUrl.trim(),
          showBio,
          showSocial,
          showJoined,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Something went wrong";
      setError(msg === "USERNAME_TAKEN" ? "That username is already taken." : msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh" style={{ background: "var(--color-bg)" }}>
      <header className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
        <a href="/" className="text-xs font-medium hover:underline inline-flex items-center gap-1.5 opacity-70 hover:opacity-100" style={{ color: "var(--color-fg)" }}>
          <ArrowLeft size={14} />
          <span>Home</span>
        </a>
        <UserButton profile={profile} />
      </header>

      <main className="max-w-sm mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 shadow-md shrink-0 flex items-center justify-center p-1" style={{ borderColor: selectedAvatar.color, background: "var(--color-surface2)" }}>
              <img src={selectedAvatar.avatarUrl} alt="" className="w-full h-full object-contain rounded-xl" />
            </div>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: "var(--color-fg)" }}>Your profile</h1>
              <p className="text-xs opacity-70" style={{ color: "var(--color-muted)" }}>Customize avatar & identity</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-all hover:scale-105 shadow-xs shrink-0 cursor-pointer"
            style={{
              background: "var(--color-surface2)",
              color: "var(--color-primary)",
              borderColor: "var(--color-border)",
            }}
          >
            <Eye size={14} />
            <span>Preview</span>
          </button>
        </div>

        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          {/* Avatar Choices Grid - No text names on icons */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: "var(--color-muted)" }}>
              Animal Avatar
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

          {/* Username with regenerate button and availability check */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>Username</label>
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
                <span className="absolute left-3 top-2 text-xs text-neutral-500 font-mono">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  maxLength={LIMITS.usernameMax}
                  required
                  className="w-full rounded-lg pl-7 pr-3 py-2 text-sm outline-none focus:ring-1 border"
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
                title="Generate random username"
                className="px-3 rounded-lg border flex items-center justify-center gap-1.5 text-xs font-medium hover:bg-neutral-800 cursor-pointer"
                style={{
                  background: "var(--color-surface2)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-fg)",
                }}
              >
                <Shuffle size={13} />
                <span>Shuffle</span>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={LIMITS.displayNameMax}
              required
              className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 border"
              style={{
                background: "var(--color-surface2)",
                color: "var(--color-fg)",
                borderColor: "var(--color-border)",
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={LIMITS.bioMax}
              rows={3}
              className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 border"
              style={{
                background: "var(--color-surface2)",
                color: "var(--color-fg)",
                borderColor: "var(--color-border)",
              }}
            />
            <div className="text-xs text-right" style={{ color: "var(--color-muted)" }}>{bio.length}/{LIMITS.bioMax}</div>
          </div>

          <div className="space-y-2 pt-1">
            <div className="text-xs font-medium flex items-center gap-1.5" style={{ color: "var(--color-muted)" }}>
              <Globe size={13} />
              <span>Social links (optional)</span>
            </div>
            
            <div className="space-y-2">
              {/* Facebook */}
              <div className="relative">
                <div className="absolute left-3 top-2.5 text-blue-400 pointer-events-none font-extrabold text-xs">
                  fb
                </div>
                <input
                  type="text"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="Facebook username or profile link"
                  maxLength={LIMITS.socialUrlMax}
                  className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 border"
                  style={{
                    background: "var(--color-surface2)",
                    color: "var(--color-fg)",
                    borderColor: "var(--color-border)",
                  }}
                />
              </div>

              {/* Instagram */}
              <div className="relative">
                <div className="absolute left-3 top-2.5 text-neutral-400 pointer-events-none">
                  <Instagram size={15} />
                </div>
                <input
                  type="text"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="Instagram handle"
                  maxLength={LIMITS.socialUrlMax}
                  className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 border"
                  style={{
                    background: "var(--color-surface2)",
                    color: "var(--color-fg)",
                    borderColor: "var(--color-border)",
                  }}
                />
              </div>

              {/* X / Twitter */}
              <div className="relative">
                <div className="absolute left-3 top-2.5 text-neutral-400 pointer-events-none">
                  <Twitter size={15} />
                </div>
                <input
                  type="text"
                  value={xUrl}
                  onChange={(e) => setXUrl(e.target.value)}
                  placeholder="X / Twitter handle"
                  maxLength={LIMITS.socialUrlMax}
                  className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 border"
                  style={{
                    background: "var(--color-surface2)",
                    color: "var(--color-fg)",
                    borderColor: "var(--color-border)",
                  }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <div className="text-xs font-medium flex items-center gap-1.5" style={{ color: "var(--color-muted)" }}>
              <Shield size={13} />
              <span>Privacy</span>
            </div>
            {[
              { label: "Show bio when revealed", value: showBio, set: setShowBio },
              { label: "Show social links when revealed", value: showSocial, set: setShowSocial },
              { label: "Show join date", value: showJoined, set: setShowJoined },
            ].map(({ label, value, set }) => (
              <label key={label} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--color-fg)" }}>
                <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} className="rounded accent-amber-500" />
                {label}
              </label>
            ))}
          </div>

          {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
          {saved && (
            <p className="text-sm inline-flex items-center gap-1 text-emerald-400">
              <Check size={14} /> Saved!
            </p>
          )}

          <button
            type="submit"
            disabled={saving || checkingUsername || usernameStatus === "taken"}
            className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 cursor-pointer"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)" }}
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </form>
      </main>

      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={displayName.trim() || "Your Display Name"}
        subtitle={`@${username.trim() || "username"}`}
        icon={
          <div className="w-10 h-10 rounded-xl p-1 overflow-hidden border shadow-xs flex items-center justify-center" style={{ borderColor: selectedAvatar.color, background: "var(--color-surface2)" }}>
            <img src={selectedAvatar.avatarUrl} alt="" className="w-full h-full object-contain rounded-lg" />
          </div>
        }
        iconBg={`${selectedAvatar.color}25`}
        footer={
          <div className="w-full flex justify-end">
            <button
              type="button"
              onClick={() => setShowPreviewModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium border hover:opacity-80 transition-opacity cursor-pointer"
              style={{ background: "var(--color-surface2)", color: "var(--color-fg)", borderColor: "var(--color-border)" }}
            >
              Close Preview
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl border space-y-3" style={{ background: "var(--color-surface2)", borderColor: "var(--color-border)" }}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <Sparkles size={12} /> Revealed Profile Preview
              </span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <BadgeCheck size={13} /> Verified
              </span>
            </div>

            {showBio && bio.trim() ? (
              <p className="text-xs leading-relaxed" style={{ color: "var(--color-fg)" }}>
                {bio.trim()}
              </p>
            ) : showBio ? (
              <p className="text-xs italic text-neutral-500">No bio provided</p>
            ) : (
              <p className="text-xs italic text-neutral-500">Bio hidden by privacy settings</p>
            )}

            {showSocial && (facebookUrl.trim() || instagramUrl.trim() || xUrl.trim()) ? (
              <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Social Links</span>
                <div className="flex gap-2 flex-wrap">
                  {facebookUrl.trim() && (
                    <a
                      href={facebookUrl.trim().startsWith('http') ? facebookUrl.trim() : `https://facebook.com/${facebookUrl.trim().replace(/^@/, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border text-blue-300 bg-blue-500/10 border-blue-500/30 font-medium"
                    >
                      <span className="font-extrabold text-[10px]">fb</span>
                      <span>facebook.com/{facebookUrl.trim().replace(/^https?:\/\/(www\.)?facebook\.com\//i, '').replace(/^@/, '')}</span>
                    </a>
                  )}
                  {instagramUrl.trim() && (
                    <a
                      href={`https://instagram.com/${instagramUrl.trim().replace(/^@/, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border text-pink-300 bg-pink-500/10 border-pink-500/30 font-medium"
                    >
                      <Instagram size={11} />
                      <span>@{instagramUrl.trim().replace(/^@/, '')}</span>
                    </a>
                  )}
                  {xUrl.trim() && (
                    <a
                      href={`https://x.com/${xUrl.trim().replace(/^@/, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border text-sky-300 bg-sky-500/10 border-sky-500/30 font-medium"
                    >
                      <Twitter size={11} />
                      <span>@{xUrl.trim().replace(/^@/, '')}</span>
                    </a>
                  )}
                </div>
              </div>
            ) : showSocial ? (
              <p className="text-[11px] italic text-neutral-500">No social links provided</p>
            ) : (
              <p className="text-[11px] italic text-neutral-500">Social links hidden by privacy settings</p>
            )}

            {showJoined && (
              <p className="text-[10px] text-neutral-500 border-t pt-2" style={{ borderColor: "var(--color-border)" }}>
                Member since today
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
