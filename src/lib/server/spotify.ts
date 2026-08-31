import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export interface SpotifyTrackInfo {
  title: string;
  artist: string;
  album: string;
  coverUrl: string | null;
  url: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
}

export interface SpotifyStatus {
  isConfigured: boolean;
  isConnected: boolean;
}

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID?.trim() || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET?.trim() || "";
const SPOTIFY_SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-read-recently-played",
].join(" ");

const globalSpotifyRef = globalThis as typeof globalThis & {
  __spotifySchemaPromise__?: Promise<void>;
};

function ensureSpotifySchema(sql: Sql): Promise<void> {
  globalSpotifyRef.__spotifySchemaPromise__ ??= (async () => {
    await sql.query(
      `CREATE TABLE IF NOT EXISTS spotify_tokens (
         user_id TEXT PRIMARY KEY,
         access_token TEXT NOT NULL,
         refresh_token TEXT NOT NULL,
         expires_at BIGINT NOT NULL,
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
  })().catch((err) => {
    globalSpotifyRef.__spotifySchemaPromise__ = undefined;
    throw err;
  });
  return globalSpotifyRef.__spotifySchemaPromise__;
}

/** Check if Spotify integration is configured and connected for the current user */
export const getSpotifyStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SpotifyStatus> => {
    const isConfigured = Boolean(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET);
    if (!isConfigured) return { isConfigured: false, isConnected: false };

    const sql = await getSql();
    await ensureSpotifySchema(sql);

    const rows = await sql.query<{ user_id: string }>(
      `SELECT user_id FROM spotify_tokens WHERE user_id = $1`,
      [context.userId],
    );

    return {
      isConfigured: true,
      isConnected: rows.length > 0,
    };
  });

/** Generate Spotify OAuth authorization URL */
export const getSpotifyAuthUrl = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ url: string | null; error?: string }> => {
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      return { url: null, error: "SPOTIFY_NOT_CONFIGURED" };
    }

    const redirectUri = `${process.env.BETTER_AUTH_URL || "http://localhost:8080"}/api/spotify/callback`;
    const state = Buffer.from(JSON.stringify({ userId: context.userId, nonce: Math.random().toString(36) })).toString("base64url");

    const params = new URLSearchParams({
      response_type: "code",
      client_id: SPOTIFY_CLIENT_ID,
      scope: SPOTIFY_SCOPES,
      redirect_uri: redirectUri,
      state,
      show_dialog: "true",
    });

    return { url: `https://accounts.spotify.com/authorize?${params.toString()}` };
  });

/** Exchange token and refresh if expired */
async function getValidToken(sql: Sql, userId: string): Promise<string | null> {
  await ensureSpotifySchema(sql);
  const rows = await sql.query<{ access_token: string; refresh_token: string; expires_at: string | number }>(
    `SELECT access_token, refresh_token, expires_at FROM spotify_tokens WHERE user_id = $1`,
    [userId],
  );
  if (!rows[0]) return null;

  const row = rows[0];
  const expiresAt = Number(row.expires_at);

  // If valid with 60s buffer, return existing token
  if (Date.now() < expiresAt - 60_000) {
    return row.access_token;
  }

  // Refresh token
  try {
    const basicAuth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: row.refresh_token,
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
    const newExpiresAt = Date.now() + data.expires_in * 1000;
    const newRefreshToken = data.refresh_token || row.refresh_token;

    await sql.query(
      `UPDATE spotify_tokens SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = now() WHERE user_id = $4`,
      [data.access_token, newRefreshToken, newExpiresAt, userId],
    );

    return data.access_token;
  } catch {
    return null;
  }
}

/** Get what the current user is playing right now on Spotify */
export const getSpotifyNowPlaying = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SpotifyTrackInfo | null> => {
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;

    const sql = await getSql();
    const token = await getValidToken(sql, context.userId);
    if (!token) return null;

    try {
      const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 204 || res.status > 400) return null;

      const data = (await res.json()) as {
        is_playing: boolean;
        progress_ms: number;
        item?: {
          name: string;
          duration_ms: number;
          external_urls?: { spotify?: string };
          artists?: Array<{ name: string }>;
          album?: {
            name: string;
            images?: Array<{ url: string }>;
          };
        };
      };

      if (!data.item) return null;

      const track = data.item;
      const artists = (track.artists || []).map((a) => a.name).join(", ");
      const coverUrl = track.album?.images?.[0]?.url || null;
      const trackUrl = track.external_urls?.spotify || `https://open.spotify.com/search/${encodeURIComponent(track.name)}`;

      return {
        title: track.name,
        artist: artists || "Unknown Artist",
        album: track.album?.name || "",
        coverUrl,
        url: trackUrl,
        durationMs: track.duration_ms || 0,
        progressMs: data.progress_ms || 0,
        isPlaying: data.is_playing,
      };
    } catch {
      return null;
    }
  });

/** Disconnect Spotify */
export const disconnectSpotify = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    await ensureSpotifySchema(sql);
    await sql.query(`DELETE FROM spotify_tokens WHERE user_id = $1`, [context.userId]);
    return { ok: true };
  });

/** Save token from OAuth callback */
export async function saveSpotifyOAuthTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
): Promise<void> {
  const sql = await getSql();
  await ensureSpotifySchema(sql);
  const expiresAt = Date.now() + expiresIn * 1000;
  await sql.query(
    `INSERT INTO spotify_tokens (user_id, access_token, refresh_token, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id)
     DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at, updated_at = now()`,
    [userId, accessToken, refreshToken, expiresAt],
  );
}
