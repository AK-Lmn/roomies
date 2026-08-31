import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export interface SpotifyTrackInfo {
  title: string;
  artist: string;
  album: string;
  coverUrl: string | null;
  previewUrl?: string | null;
  url: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
}

export interface SpotifyStatus {
  isConfigured: boolean;
  isConnected: boolean;
}

function getSpotifyClientId(): string {
  return process.env.SPOTIFY_CLIENT_ID?.trim() || "1bad4f22209e471b9c155495dd6f3f30";
}

function getSpotifyClientSecret(): string {
  return process.env.SPOTIFY_CLIENT_SECRET?.trim() || "6a00fe79e32046c28af37aa6b4229c1b";
}

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
    const isConfigured = Boolean(getSpotifyClientId());
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
  .validator(z.object({ redirectUri: z.string().optional() }))
  .handler(async ({ context, data }): Promise<{ url: string | null; error?: string }> => {
    const clientId = getSpotifyClientId();
    if (!clientId) {
      return { url: null, error: "SPOTIFY_NOT_CONFIGURED" };
    }

    const redirectUri = data.redirectUri || `${process.env.BETTER_AUTH_URL || "https://roomiesapp.vercel.app"}/api/spotify/callback`;
    const state = Buffer.from(JSON.stringify({ userId: context.userId, nonce: Math.random().toString(36) })).toString("base64url");

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
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
  const clientId = getSpotifyClientId();
  const clientSecret = getSpotifyClientSecret();
  if (!clientId) return null;

  try {
    const bodyParams = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    });
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: bodyParams,
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token || row.refresh_token;
    const newExpiresAt = Date.now() + data.expires_in * 1000;

    await sql.query(
      `UPDATE spotify_tokens SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = now() WHERE user_id = $4`,
      [newAccessToken, newRefreshToken, newExpiresAt, userId],
    );

    return newAccessToken;
  } catch {
    return null;
  }
}

/** Save OAuth tokens from callback handler */
export async function saveSpotifyOAuthTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresInSeconds: number,
): Promise<void> {
  const sql = await getSql();
  await ensureSpotifySchema(sql);
  const expiresAt = Date.now() + expiresInSeconds * 1000;

  await sql.query(
    `INSERT INTO spotify_tokens (user_id, access_token, refresh_token, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE
     SET access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         expires_at = EXCLUDED.expires_at,
         updated_at = now()`,
    [userId, accessToken, refreshToken, expiresAt],
  );
}

/** Fetch currently playing track for user */
export const getSpotifyNowPlaying = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SpotifyTrackInfo | null> => {
    const sql = await getSql();
    const accessToken = await getValidToken(sql, context.userId);
    if (!accessToken) return null;

    try {
      const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.status === 204 || !res.ok) return null;

      const data = (await res.json()) as {
        is_playing: boolean;
        progress_ms: number;
        item?: {
          name: string;
          duration_ms: number;
          artists: Array<{ name: string }>;
          album?: {
            name: string;
            images: Array<{ url: string }>;
          };
          external_urls?: {
            spotify: string;
          };
        };
      };

      if (!data.item) return null;

      const title = data.item.name;
      const artist = data.item.artists.map((a) => a.name).join(", ");
      let previewUrl: string | null = null;

      try {
        const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}&media=music&entity=song&limit=1`;
        const itunesRes = await fetch(itunesUrl, { headers: { "User-Agent": "Roomies/1.0" } });
        if (itunesRes.ok) {
          const itunesJson = (await itunesRes.json()) as { results?: Array<{ previewUrl?: string }> };
          previewUrl = itunesJson.results?.[0]?.previewUrl || null;
        }
      } catch {}

      return {
        title,
        artist,
        album: data.item.album?.name || "",
        coverUrl: data.item.album?.images[0]?.url || null,
        previewUrl,
        url: data.item.external_urls?.spotify || "",
        durationMs: data.item.duration_ms,
        progressMs: data.progress_ms,
        isPlaying: data.is_playing,
      };
    } catch {
      return null;
    }
  });

/** Disconnect Spotify account */
export const disconnectSpotify = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureSpotifySchema(sql);
    await sql.query(`DELETE FROM spotify_tokens WHERE user_id = $1`, [context.userId]);
    return { ok: true };
  });
