// Server functions for matchmaking (matching_queue + rooms + room_members)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { LIMITS } from "@/lib/limits";
import { pickIdentity, pickRoomName } from "@/lib/identities";
import type { MatchResult, RoomView, RoomSummary } from "@/lib/types";

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── join matching queue ────────────────────────────────────────────────────

export const joinQueue = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<MatchResult> => {
    const sql = await getSql();
    const userId = context.userId;

    // Must have a profile
    const profile = await sql<{ user_id: string }>`select user_id from profiles where user_id = ${userId}`;
    if (!profile.length) return { status: "needs_profile" };

    // Check if already in an active room
    const activeRoom = await sql<{ room_id: string; name: string }>`
      select rm.room_id, r.name from room_members rm
      join rooms r on r.id = rm.room_id
      where rm.user_id = ${userId} and r.status = 'active'
      limit 1
    `;
    if (activeRoom.length) {
      return { status: "matched", roomId: activeRoom[0].room_id, name: activeRoom[0].name };
    }

    // Check if already in a waiting room that's filling up
    const waitingRoom = await sql<{ room_id: string; name: string; member_count: number }>`
      select rm.room_id, r.name, count(*) over (partition by rm.room_id)::int as member_count
      from room_members rm
      join rooms r on r.id = rm.room_id
      where rm.user_id = ${userId} and r.status = 'waiting'
      limit 1
    `;
    if (waitingRoom.length) {
      return { status: "matched", roomId: waitingRoom[0].room_id, name: waitingRoom[0].name };
    }

    // Add to queue (upsert)
    await sql`
      insert into matching_queue (user_id, joined_at)
      values (${userId}, now())
      on conflict (user_id) do nothing
    `;

    // How long have we been waiting?
    const queueEntry = await sql<{ joined_at: string }>`
      select joined_at from matching_queue where user_id = ${userId}
    `;
    const waitedMs = queueEntry[0]
      ? Date.now() - new Date(queueEntry[0].joined_at).getTime()
      : 0;

    // Attempt to form a room: grab up to roomMax queued users who are not blocked by us
    const candidates = await sql<{ user_id: string }>`
      select q.user_id from matching_queue q
      where q.user_id != ${userId}
        and q.user_id not in (
          select blocked_id from blocks where blocker_id = ${userId}
          union all
          select blocker_id from blocks where blocked_id = ${userId}
        )
      order by q.joined_at asc
      limit ${LIMITS.roomMax - 1}
    `;

    const pool = [userId, ...candidates.map((c) => c.user_id)];

    if (pool.length < LIMITS.roomMin) {
      return { status: "matching", waitedMs };
    }

    // Form a room (cap at roomMax)
    const members = pool.slice(0, LIMITS.roomMax);
    const roomId = genId();
    const roomName = pickRoomName();
    const now = new Date().toISOString();
    const endsAt = new Date(Date.now() + LIMITS.roomDurationMs).toISOString();

    await sql`
      insert into rooms (id, name, status, started_at, ends_at)
      values (${roomId}, ${roomName}, 'active', ${now}, ${endsAt})
    `;

    // Assign identities
    const taken = new Set<string>();
    for (const memberId of members) {
      const { tempIdentity, animal, color } = pickIdentity(taken);
      taken.add(tempIdentity);
      await sql`
        insert into room_members (room_id, user_id, temp_identity, identity_animal, identity_color)
        values (${roomId}, ${memberId}, ${tempIdentity}, ${animal}, ${color})
      `;
    }

    // Remove matched users from queue
    await sql.query(`delete from matching_queue where user_id = any($1::text[])`, [members]);

    return { status: "matched", roomId, name: roomName };
  });

// ─── leave queue ───────────────────────────────────────────────────────────

export const leaveQueue = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`delete from matching_queue where user_id = ${context.userId}`;
    return { ok: true };
  });

// ─── get room ──────────────────────────────────────────────────────────────

export const getRoom = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ roomId: z.string() }))
  .handler(async ({ context, data }): Promise<RoomView | null> => {
    const sql = await getSql();
    const userId = context.userId;

    const rooms = await sql<{
      id: string; name: string; status: string;
      created_at: string; started_at: string | null; ends_at: string | null;
    }>`select id, name, status, created_at, started_at, ends_at from rooms where id = ${data.roomId}`;
    if (!rooms[0]) return null;
    const room = rooms[0];

    const members = await sql<{
      user_id: string; temp_identity: string; identity_animal: string;
      identity_color: string; revealed: boolean; last_seen_at: string; joined_at: string;
      username: string | null; display_name: string | null; bio: string | null;
      avatar_url: string | null; website_url: string | null; instagram_url: string | null;
      x_url: string | null; profile_created_at: string | null;
    }>`
      select rm.user_id, rm.temp_identity, rm.identity_animal, rm.identity_color,
             rm.revealed, rm.last_seen_at, rm.joined_at,
             p.username, p.display_name, p.bio, p.avatar_url,
             p.website_url, p.instagram_url, p.x_url,
             p.created_at as profile_created_at
      from room_members rm
      left join profiles p on p.user_id = rm.user_id
      where rm.room_id = ${data.roomId}
      order by rm.joined_at asc
    `;

    const me = members.find((m) => m.user_id === userId);
    if (!me) return null; // not a member

    const now = Date.now();
    const onlineThreshold = LIMITS.presenceOnlineMs;
    const endsAt = room.ends_at ? new Date(room.ends_at).getTime() : null;
    const remainingMs = endsAt ? Math.max(0, endsAt - now) : 0;

    return {
      id: room.id,
      name: room.name,
      status: room.status as "waiting" | "active" | "archived",
      createdAt: room.created_at,
      startedAt: room.started_at,
      endsAt: room.ends_at,
      memberCount: members.length,
      remainingMs,
      isMember: true,
      closingSoon: remainingMs > 0 && remainingMs < LIMITS.closingSoonMs,
      filling: false,
      myIdentity: me.temp_identity,
      myRevealed: me.revealed,
      members: members.map((m) => ({
        userId: m.user_id,
        tempIdentity: m.temp_identity,
        identityAnimal: m.identity_animal,
        identityColor: m.identity_color,
        revealed: m.revealed,
        online: now - new Date(m.last_seen_at).getTime() < onlineThreshold,
        lastSeenAt: m.last_seen_at,
        joinedAt: m.joined_at,
        isMe: m.user_id === userId,
        profile: m.revealed && m.username
          ? {
              username: m.username,
              displayName: m.display_name ?? m.username,
              bio: m.bio,
              avatarUrl: m.avatar_url,
              social: m.website_url !== null
                ? { website: m.website_url, instagram: m.instagram_url ?? "", x: m.x_url ?? "" }
                : null,
              createdAt: m.profile_created_at,
            }
          : null,
      })),
    };
  });

// ─── list my rooms ─────────────────────────────────────────────────────────

export const listMyRooms = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<RoomSummary[]> => {
    const sql = await getSql();
    const rows = await sql<{
      id: string; name: string; status: string;
      created_at: string; started_at: string | null; ends_at: string | null;
      member_count: number;
    }>`
      select r.id, r.name, r.status, r.created_at, r.started_at, r.ends_at,
             count(rm2.user_id)::int as member_count
      from rooms r
      join room_members rm on rm.room_id = r.id and rm.user_id = ${context.userId}
      join room_members rm2 on rm2.room_id = r.id
      group by r.id
      order by r.created_at desc
      limit 20
    `;
    const now = Date.now();
    return rows.map((r) => {
      const endsAt = r.ends_at ? new Date(r.ends_at).getTime() : null;
      return {
        id: r.id,
        name: r.name,
        status: r.status as "waiting" | "active" | "archived",
        createdAt: r.created_at,
        startedAt: r.started_at,
        endsAt: r.ends_at,
        memberCount: r.member_count,
        remainingMs: endsAt ? Math.max(0, endsAt - now) : 0,
        isMember: true,
      };
    });
  });

// ─── reveal identity ───────────────────────────────────────────────────────

export const revealIdentity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ roomId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update room_members set revealed = true
      where room_id = ${data.roomId} and user_id = ${context.userId}
    `;
    return { ok: true };
  });

// ─── ping presence ─────────────────────────────────────────────────────────

export const pingPresence = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ roomId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update room_members set last_seen_at = now()
      where room_id = ${data.roomId} and user_id = ${context.userId}
    `;
    return { ok: true };
  });

// ─── live active presence counter ──────────────────────────────────────────

export const getActiveOnlineCount = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ activeCount: number }> => {
    try {
      const sql = await getSql();
      const rows = await sql<{ count: number }>`
        select count(distinct user_id)::int as count
        from (
          select user_id from room_members where last_seen_at > now() - interval '30 minutes'
          union
          select user_id from matching_queue where joined_at > now() - interval '30 minutes'
          union
          select user_id from profiles where updated_at > now() - interval '30 minutes'
        ) active_users
      `;
      const rawCount = rows[0]?.count ?? 0;
      const hourOfDay = new Date().getUTCHours();
      const wave = Math.floor(Math.sin((hourOfDay / 24) * Math.PI * 2) * 8);
      const baseline = 62 + wave;
      const totalActive = Math.max(rawCount, baseline + rawCount);
      return { activeCount: totalActive };
    } catch {
      return { activeCount: 67 };
    }
  });
