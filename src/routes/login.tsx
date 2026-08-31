import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useState, type FormEvent, useEffect } from "react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      void navigate({ to: "/" });
    }
  }, [user, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error: signUpError } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.split("@")[0],
        });
        if (signUpError) {
          setError(signUpError.message || "Sign up failed");
          setLoading(false);
          return;
        }
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (signInError) {
          setError(signInError.message || "Invalid email or password");
          setLoading(false);
          return;
        }
      }

      await navigate({ to: "/" });
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "An error occurred";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center" style={{ background: "var(--color-bg)", color: "var(--color-muted)" }}>
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center p-6" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-sm space-y-6">
        {/* Logo and title */}
        <div className="text-center space-y-2">
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)" }}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
              <path d="M10 2a5 5 0 0 0-5 5v1H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5h-4Zm6 6H8V7a4 4 0 0 1 8 0v1Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--color-fg)" }}>
            Roomies
          </h1>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            {mode === "signin" ? "Sign in to your account" : "Create an account to join rooms"}
          </p>
        </div>

        {/* Mode switch tabs */}
        <div
          className="flex rounded-lg p-1"
          style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)" }}
        >
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(""); }}
            className="flex-1 rounded-md py-1.5 text-xs font-medium transition-all"
            style={{
              background: mode === "signin" ? "var(--color-surface)" : "transparent",
              color: mode === "signin" ? "var(--color-fg)" : "var(--color-muted)",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(""); }}
            className="flex-1 rounded-md py-1.5 text-xs font-medium transition-all"
            style={{
              background: mode === "signup" ? "var(--color-surface)" : "transparent",
              color: mode === "signup" ? "var(--color-fg)" : "var(--color-muted)",
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex"
                required
                className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1"
                style={{
                  background: "var(--color-surface2)",
                  color: "var(--color-fg)",
                  border: "1px solid var(--color-border)",
                }}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              required
              className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1"
              style={{
                background: "var(--color-surface2)",
                color: "var(--color-fg)",
                border: "1px solid var(--color-border)",
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1"
              style={{
                background: "var(--color-surface2)",
                color: "var(--color-fg)",
                border: "1px solid var(--color-border)",
              }}
            />
          </div>

          {error && (
            <div
              className="rounded-lg p-2.5 text-xs"
              style={{ background: "rgba(194, 96, 96, 0.15)", color: "var(--color-danger)", border: "1px solid var(--color-danger)" }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)" }}
          >
            {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-xs" style={{ color: "var(--color-muted)" }}>
          Inside rooms you stay anonymous until you choose to reveal your profile.
        </p>
      </div>
    </main>
  );
}
