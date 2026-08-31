/**
 * Standalone Better Auth instance for Roomies (server-only).
 * Supports plain email/password authentication backed by PostgreSQL (or PGLite local fallback).
 */
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getCookie } from "@tanstack/react-start/server";
import { Pool } from "pg";

const DEFAULT_DATABASE_URL =
  "postgresql://neondb_owner:npg_BlWrJ9UuKA8P@ep-delicate-mode-az6f1c8d-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const databaseUrl = (process.env.DATABASE_URL || DEFAULT_DATABASE_URL).trim();
const database = new Pool({ connectionString: databaseUrl });

export const SESSION_TOKEN_COOKIE = "roomies.session_token";

const baseURL =
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
  (process.env.NODE_ENV === "production" ? "https://roomiesapp.vercel.app" : "http://localhost:8080");

export const trustedOrigins = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
  "http://localhost:3000",
  "https://roomiesapp.vercel.app",
  "https://roomies-beryl.vercel.app",
  ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`] : []),
  ...(process.env.VERCEL_BRANCH_URL ? [`https://${process.env.VERCEL_BRANCH_URL}`] : []),
];

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET || "roomies-standalone-dev-secret-key-32-chars-long",
  database,
  trustedOrigins: async (request) => {
    const origin = request?.headers?.get("origin");
    const list = [...trustedOrigins];
    if (origin && (origin.endsWith(".vercel.app") || origin.includes("localhost") || origin.includes("127.0.0.1"))) {
      if (!list.includes(origin)) list.push(origin);
    }
    return list;
  },
  emailAndPassword: {
    enabled: true,
  },
  session: {
    cookieCache: { enabled: true, maxAge: 300 },
  },
  advanced: {
    cookies: {
      session_token: { name: SESSION_TOKEN_COOKIE },
    },
  },
  plugins: [
    tanstackStartCookies(),
  ],
});

export const authConfigured = true;

export function readSessionToken(): string | null {
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}
