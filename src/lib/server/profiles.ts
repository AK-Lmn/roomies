// Server functions for profiles table
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { LIMITS, USERNAME_RE, normalizeUsername } from "@/lib/limits";
import type { Profile } from "@/lib/types";

// ─── read ──────────────────────────────────────────────────────────────────

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Profile | null> => {
    const sql = await getSql();
    const rows = await sql<{
      user_id: string;
      username: string;
      display_name: string;
      bio: string;
      avatar_url: string | null;
      website_url: string;
      instagram_url: string;
      x_url: string;
      show_bio: boolean;
      show_social: boolean;
      show_joined: boolean;
      created_at: string;
    }>`
      select user_id, username, display_name, bio, avatar_url,
             website_url, instagram_url, x_url,
             show_bio, show_social, show_joined, created_at
      from profiles where user_id = ${context.userId}
    `;
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name,
      bio: r.bio,
      avatarUrl: r.avatar_url,
      social: { facebook: r.website_url, instagram: r.instagram_url, x: r.x_url, website: r.website_url },
      showBio: r.show_bio,
      showSocial: r.show_social,
      showJoined: r.show_joined,
      createdAt: r.created_at,
    };
  });

export const getProfileByUsername = createServerFn({ method: "GET" })
  .validator(z.object({ username: z.string() }))
  .handler(async ({ data }): Promise<Profile | null> => {
    const sql = await getSql();
    const rows = await sql<{
      user_id: string;
      username: string;
      display_name: string;
      bio: string;
      avatar_url: string | null;
      website_url: string;
      instagram_url: string;
      x_url: string;
      show_bio: boolean;
      show_social: boolean;
      show_joined: boolean;
      created_at: string;
    }>`
      select user_id, username, display_name, bio, avatar_url,
             website_url, instagram_url, x_url,
             show_bio, show_social, show_joined, created_at
      from profiles where lower(username) = ${data.username.toLowerCase()}
    `;
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name,
      bio: r.bio,
      avatarUrl: r.avatar_url,
      social: { facebook: r.website_url, instagram: r.instagram_url, x: r.x_url, website: r.website_url },
      showBio: r.show_bio,
      showSocial: r.show_social,
      showJoined: r.show_joined,
      createdAt: r.created_at,
    };
  });

// ─── create / upsert ───────────────────────────────────────────────────────

const profileSchema = z.object({
  username: z.string().min(LIMITS.usernameMin).max(LIMITS.usernameMax).regex(USERNAME_RE),
  displayName: z.string().min(LIMITS.displayNameMin).max(LIMITS.displayNameMax),
  bio: z.string().max(LIMITS.bioMax).default(""),
  avatarUrl: z.string().url().nullable().default(null),
  facebookUrl: z.string().max(LIMITS.socialUrlMax).optional().default(""),
  websiteUrl: z.string().max(LIMITS.socialUrlMax).optional().default(""),
  instagramUrl: z.string().max(LIMITS.socialUrlMax).default(""),
  xUrl: z.string().max(LIMITS.socialUrlMax).default(""),
  showBio: z.boolean().default(true),
  showSocial: z.boolean().default(false),
  showJoined: z.boolean().default(true),
});

export const upsertProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(profileSchema)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const username = normalizeUsername(data.username);
    const fbUrl = data.facebookUrl || data.websiteUrl || "";

    // Check uniqueness excluding self
    const conflict = await sql<{ user_id: string }>`
      select user_id from profiles where lower(username) = ${username} and user_id != ${context.userId}
    `;
    if (conflict.length > 0) throw new Error("USERNAME_TAKEN");

    await sql`
      insert into profiles (user_id, username, display_name, bio, avatar_url,
                            website_url, instagram_url, x_url,
                            show_bio, show_social, show_joined, updated_at)
      values (${context.userId}, ${username}, ${data.displayName}, ${data.bio}, ${data.avatarUrl},
              ${fbUrl}, ${data.instagramUrl}, ${data.xUrl},
              ${data.showBio}, ${data.showSocial}, ${data.showJoined}, now())
      on conflict (user_id) do update set
        username      = excluded.username,
        display_name  = excluded.display_name,
        bio           = excluded.bio,
        avatar_url    = excluded.avatar_url,
        website_url   = excluded.website_url,
        instagram_url = excluded.instagram_url,
        x_url         = excluded.x_url,
        show_bio      = excluded.show_bio,
        show_social   = excluded.show_social,
        show_joined   = excluded.show_joined,
        updated_at    = now()
    `;
    return { ok: true };
  });

// ─── check availability ───────────────────────────────────────────────────

export const checkUsernameAvailability = createServerFn({ method: "POST" })
  .validator(z.object({ username: z.string(), currentUserId: z.string().optional() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const norm = normalizeUsername(data.username);
    if (!USERNAME_RE.test(norm)) {
      return { available: false, reason: "invalid_format", username: norm };
    }
    const rows = await sql<{ user_id: string }>`
      select user_id from profiles where lower(username) = ${norm}
    `;
    if (rows.length === 0) {
      return { available: true, username: norm };
    }
    if (data.currentUserId && rows[0].user_id === data.currentUserId) {
      return { available: true, username: norm };
    }
    return { available: false, reason: "taken", username: norm };
  });
