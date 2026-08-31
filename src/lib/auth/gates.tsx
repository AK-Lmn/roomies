import { useState, type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { authEnabled, signOut } from "./client";
import { useCurrentUser, useCurrentUserState } from "./use-current-user";
import { Modal } from "@/components/ui/modal";
import { LogOut } from "lucide-react";

/**
 * Auth state components — plain wrappers around `useCurrentUserState()`.
 */

export const SIGN_IN_PATH = "/login";

export function SignedIn({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserState();
  return user ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending || user) return null;
  return <>{children}</>;
}

export function RedirectToSignIn({ to = SIGN_IN_PATH }: { to?: string }) {
  return <Navigate to={to} />;
}

export function UserButton() {
  const user = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  if (!user) return null;
  const label = user.displayName ?? user.primaryEmail ?? "Account";

  async function handleConfirmSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      window.location.href = "/login";
    } catch {
      setSigningOut(false);
      setShowConfirmModal(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {user.profileImageUrl ? (
          <img
            src={user.profileImageUrl}
            alt=""
            className="h-8 w-8 rounded-full object-cover border"
            style={{ borderColor: "var(--color-border)" }}
          />
        ) : (
          <span
            className="grid h-8 w-8 place-items-center rounded-full text-xs font-semibold text-white shadow-xs"
            style={{ background: "var(--color-primary)" }}
          >
            {label.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="text-xs font-medium" style={{ color: "var(--color-fg)" }}>
          {label}
        </span>
        {authEnabled && (
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="cursor-pointer text-xs px-2.5 py-1 rounded-lg border opacity-80 hover:opacity-100 transition-colors"
            style={{
              background: "var(--color-surface2)",
              borderColor: "var(--color-border)",
              color: "var(--color-muted)",
            }}
          >
            Sign out
          </button>
        )}
      </div>

      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Sign out of Roomies?"
        subtitle="You will be returned to the sign in page"
        icon={<LogOut size={18} className="text-rose-400" />}
        iconBg="rgba(244, 63, 94, 0.15)"
        footer={
          <>
            <button
              type="button"
              disabled={signingOut}
              onClick={() => setShowConfirmModal(false)}
              className="px-3.5 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-neutral-800 border"
              style={{
                color: "var(--color-muted)",
                borderColor: "var(--color-border)",
                background: "var(--color-surface2)",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void handleConfirmSignOut()}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5 shadow-xs bg-rose-600 hover:bg-rose-500 text-white"
            >
              <LogOut size={13} />
              <span>{signingOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </>
        }
      >
        <p className="text-xs text-[var(--color-fg)] opacity-80 leading-relaxed">
          Are you sure you want to end your active session on this device?
        </p>
      </Modal>
    </>
  );
}
