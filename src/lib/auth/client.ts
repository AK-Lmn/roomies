import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client for React SPA.
 * Communicates directly with same-origin `/api/auth/*` using standard session cookies.
 */
export const authClient = createAuthClient();

export const authEnabled = true;

export async function signOut(redirectTo = "/login"): Promise<void> {
  await authClient.signOut();
  if (typeof window !== "undefined") {
    window.location.href = redirectTo;
  }
}
