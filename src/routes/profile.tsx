import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { getMyProfile, upsertProfile } from "@/lib/server/profiles";
import { useEffect, useState, type FormEvent } from "react";
import { LIMITS, USERNAME_RE, normalizeUsername } from "@/lib/limits";
import type { Profile } from "@/lib/types";
import { UserButton } from "@/lib/auth/gates";
import { ArrowLeft, Check, Shield, Globe, Instagram, Twitter, User } from "lucide-react";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null | "loading">("loading");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [showBio, setShowBio] = useState(true);
  const [showSocial, setShowSocial] = useState(false);
  const [showJoined, setShowJoined] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const userId = user?.id;
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
      setWebsiteUrl(p.social.website);
      setInstagramUrl(p.social.instagram);
      setXUrl(p.social.x);
      setShowBio(p.showBio);
      setShowSocial(p.showSocial);
      setShowJoined(p.showJoined);
    }).catch(() => setProfile(null));
  }, [userId, navigate]);

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
    if (displayName.trim().length < LIMITS.displayNameMin) {
      setError(`Display name must be at least ${LIMITS.displayNameMin} characters.`);
      return;
    }
    setSaving(true);
    try {
      await upsertProfile({ data: { username: norm, displayName: displayName.trim(), bio: bio.trim(), avatarUrl: null, websiteUrl: websiteUrl.trim(), instagramUrl: instagramUrl.trim(), xUrl: xUrl.trim(), showBio, showSocial, showJoined } });
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
        <UserButton />
      </header>

      <main className="max-w-sm mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <User size={20} className="text-amber-400" />
          <h1 className="text-xl font-semibold" style={{ color: "var(--color-fg)" }}>Your profile</h1>
        </div>

        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          {[
            { label: "Username", value: username, set: setUsername, max: LIMITS.usernameMax, transform: (v: string) => v.toLowerCase() },
            { label: "Display name", value: displayName, set: setDisplayName, max: LIMITS.displayNameMax },
          ].map(({ label, value, set, max, transform }) => (
            <div key={label} className="space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>{label}</label>
              <input type="text" value={value} onChange={(e) => set(transform ? transform(e.target.value) : e.target.value)} maxLength={max} className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1" style={{ background: "var(--color-surface2)", color: "var(--color-fg)", border: "1px solid var(--color-border)" }} />
            </div>
          ))}

          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={LIMITS.bioMax} rows={3} className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none focus:ring-1" style={{ background: "var(--color-surface2)", color: "var(--color-fg)", border: "1px solid var(--color-border)" }} />
            <div className="text-xs text-right" style={{ color: "var(--color-muted)" }}>{bio.length}/{LIMITS.bioMax}</div>
          </div>

          <div className="space-y-2 pt-1">
            <div className="text-xs font-medium flex items-center gap-1.5" style={{ color: "var(--color-muted)" }}>
              <Globe size={13} />
              <span>Social links (optional)</span>
            </div>
            {[
              { label: "Website", value: websiteUrl, set: setWebsiteUrl, Icon: Globe },
              { label: "Instagram handle", value: instagramUrl, set: setInstagramUrl, Icon: Instagram },
              { label: "X / Twitter handle", value: xUrl, set: setXUrl, Icon: Twitter },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <input type="text" value={value} onChange={(e) => set(e.target.value)} placeholder={label} maxLength={LIMITS.socialUrlMax} className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1" style={{ background: "var(--color-surface2)", color: "var(--color-fg)", border: "1px solid var(--color-border)" }} />
              </div>
            ))}
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

          <button type="submit" disabled={saving} className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50" style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)" }}>
            {saving ? "Saving…" : "Save profile"}
          </button>
        </form>
      </main>
    </div>
  );
}
