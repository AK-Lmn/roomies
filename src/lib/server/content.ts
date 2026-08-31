// Server functions for wall_posts, post_reactions, fridge_notes, songs, daily_questions/answers
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { LIMITS } from "@/lib/limits";
import type { WallPost, FridgeNote, Song, DailyQuestionView } from "@/lib/types";

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function assertMember(sql: Awaited<ReturnType<typeof getSql>>, roomId: string, userId: string) {
  const rows = await sql<{ room_id: string }>`
    select room_id from room_members where room_id = ${roomId} and user_id = ${userId}
  `;
  if (!rows.length) throw new Error("Not a member of this room");
}

// ─── wall posts ─────────────────────────────────────────────────────────────

export const getWallPosts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ roomId: z.string() }))
  .handler(async ({ context, data }): Promise<WallPost[]> => {
    const sql = await getSql();
    await assertMember(sql, data.roomId, context.userId);

    const posts = await sql<{
      id: string; room_id: string; user_id: string; body: string;
      image_url: string | null; created_at: string;
      temp_identity: string; identity_animal: string; identity_color: string;
      revealed: boolean; display_name: string | null;
    }>`
      select wp.id, wp.room_id, wp.user_id, wp.body, wp.image_url, wp.created_at,
             rm.temp_identity, rm.identity_animal, rm.identity_color, rm.revealed,
             p.display_name
      from wall_posts wp
      join room_members rm on rm.room_id = wp.room_id and rm.user_id = wp.user_id
      left join profiles p on p.user_id = wp.user_id
      where wp.room_id = ${data.roomId}
      order by wp.created_at asc
    `;

    if (posts.length === 0) return [];

    // Fetch reactions separately
    const postIds = posts.map((p) => p.id);
    const reactions = await sql.query<{ post_id: string; kind: string; count: number; mine: boolean }>(
      `select pr.post_id, pr.kind,
              count(*)::int as count,
              bool_or(pr.user_id = $1) as mine
       from post_reactions pr
       where pr.post_id = any($2::text[])
       group by pr.post_id, pr.kind`,
      [context.userId, postIds],
    );

    const reactionsByPost = new Map<string, Array<{ kind: string; count: number; mine: boolean }>>();
    for (const r of reactions) {
      if (!reactionsByPost.has(r.post_id)) reactionsByPost.set(r.post_id, []);
      reactionsByPost.get(r.post_id)!.push({ kind: r.kind, count: r.count, mine: r.mine });
    }

    return posts.map((p) => ({
      id: p.id, roomId: p.room_id, userId: p.user_id, body: p.body,
      imageUrl: p.image_url, createdAt: p.created_at,
      identity: p.temp_identity, animal: p.identity_animal, color: p.identity_color,
      revealedName: p.revealed && p.display_name ? p.display_name : null,
      isMe: p.user_id === context.userId,
      reactions: reactionsByPost.get(p.id) ?? [],
    }));
  });

export const createWallPost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    roomId: z.string(),
    body: z.string().min(1).max(LIMITS.wallPostMax),
    imageUrl: z.string().url().nullable().default(null),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await assertMember(sql, data.roomId, context.userId);
    const id = genId();
    await sql`
      insert into wall_posts (id, room_id, user_id, body, image_url)
      values (${id}, ${data.roomId}, ${context.userId}, ${data.body}, ${data.imageUrl})
    `;
    return { id };
  });

export const toggleReaction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ postId: z.string(), kind: z.string().max(10) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    // verify membership via the post
    const post = await sql<{ room_id: string }>`select room_id from wall_posts where id = ${data.postId}`;
    if (!post.length) throw new Error("Post not found");
    await assertMember(sql, post[0].room_id, context.userId);

    const existing = await sql<{ kind: string }>`
      select kind from post_reactions where post_id = ${data.postId} and user_id = ${context.userId} and kind = ${data.kind}
    `;
    if (existing.length) {
      await sql`delete from post_reactions where post_id = ${data.postId} and user_id = ${context.userId} and kind = ${data.kind}`;
    } else {
      await sql`insert into post_reactions (post_id, user_id, kind) values (${data.postId}, ${context.userId}, ${data.kind}) on conflict do nothing`;
    }
    return { ok: true };
  });

// ─── fridge notes ───────────────────────────────────────────────────────────

const NOTE_COLORS = ["#f5e6c8", "#c8e6c9", "#c8d8f5", "#f5c8e6", "#e6f5c8"];

export const getFridgeNotes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ roomId: z.string() }))
  .handler(async ({ context, data }): Promise<FridgeNote[]> => {
    const sql = await getSql();
    await assertMember(sql, data.roomId, context.userId);
    const rows = await sql<{
      id: string; room_id: string; user_id: string; body: string;
      color: string; tilt: number; created_at: string; temp_identity: string;
    }>`
      select fn.id, fn.room_id, fn.user_id, fn.body, fn.color, fn.tilt, fn.created_at,
             rm.temp_identity
      from fridge_notes fn
      join room_members rm on rm.room_id = fn.room_id and rm.user_id = fn.user_id
      where fn.room_id = ${data.roomId}
      order by fn.created_at asc
    `;
    return rows.map((r) => ({
      id: r.id, roomId: r.room_id, userId: r.user_id, body: r.body,
      color: r.color, tilt: r.tilt, createdAt: r.created_at,
      identity: r.temp_identity, isMe: r.user_id === context.userId,
    }));
  });

export const addFridgeNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    roomId: z.string(),
    body: z.string().min(1).max(LIMITS.fridgeNoteMax),
    color: z.string().optional(),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await assertMember(sql, data.roomId, context.userId);
    const id = genId();
    const color = data.color || NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)]!;
    const tilt = Math.floor(Math.random() * 7) - 3; // -3..3 degrees
    await sql`
      insert into fridge_notes (id, room_id, user_id, body, color, tilt)
      values (${id}, ${data.roomId}, ${context.userId}, ${data.body}, ${color}, ${tilt})
    `;
    return { id };
  });

export const deleteFridgeNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ noteId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from fridge_notes where id = ${data.noteId} and user_id = ${context.userId}`;
    return { ok: true };
  });

// ─── songs ──────────────────────────────────────────────────────────────────

export const getSongs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ roomId: z.string() }))
  .handler(async ({ context, data }): Promise<Song[]> => {
    const sql = await getSql();
    await assertMember(sql, data.roomId, context.userId);
    const rows = await sql<{
      id: string; room_id: string; user_id: string;
      title: string; artist: string; url: string; cover_url: string | null;
      created_at: string; temp_identity: string;
    }>`
      select s.id, s.room_id, s.user_id, s.title, s.artist, s.url, s.cover_url, s.created_at,
             rm.temp_identity
      from songs s
      join room_members rm on rm.room_id = s.room_id and rm.user_id = s.user_id
      where s.room_id = ${data.roomId}
      order by s.created_at asc
    `;
    return rows.map((r) => ({
      id: r.id, roomId: r.room_id, userId: r.user_id,
      title: r.title, artist: r.artist, url: r.url, coverUrl: r.cover_url,
      createdAt: r.created_at, identity: r.temp_identity, isMe: r.user_id === context.userId,
    }));
  });

export const addSong = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    roomId: z.string(),
    title: z.string().min(1).max(LIMITS.songTitleMax),
    artist: z.string().min(1).max(LIMITS.songArtistMax),
    url: z.string().url().max(LIMITS.songUrlMax),
    coverUrl: z.string().url().nullable().default(null),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await assertMember(sql, data.roomId, context.userId);
    const id = genId();
    await sql`
      insert into songs (id, room_id, user_id, title, artist, url, cover_url)
      values (${id}, ${data.roomId}, ${context.userId}, ${data.title}, ${data.artist}, ${data.url}, ${data.coverUrl})
    `;
    return { id };
  });

// ─── daily questions ─────────────────────────────────────────────────────────

export const getDailyQuestion = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ roomId: z.string() }))
  .handler(async ({ context, data }): Promise<DailyQuestionView | null> => {
    const sql = await getSql();
    await assertMember(sql, data.roomId, context.userId);

    const roomRows = await sql<{ started_at: string | null }>`select started_at from rooms where id = ${data.roomId}`;
    if (!roomRows[0]?.started_at) return null;

    const startedAt = new Date(roomRows[0].started_at).getTime();
    const dayIndex = Math.floor((Date.now() - startedAt) / (24 * 60 * 60 * 1000));

    // Pick question deterministically for this room+day
    const questions = await sql<{ id: number; prompt: string }>`select id, prompt from daily_questions order by id`;
    if (!questions.length) return null;
    const question = questions[dayIndex % questions.length]!;

    const answers = await sql<{
      user_id: string; body: string; created_at: string;
      temp_identity: string; identity_animal: string; identity_color: string;
    }>`
      select da.user_id, da.body, da.created_at,
             rm.temp_identity, rm.identity_animal, rm.identity_color
      from daily_answers da
      join room_members rm on rm.room_id = da.room_id and rm.user_id = da.user_id
      where da.room_id = ${data.roomId} and da.day_index = ${dayIndex}
      order by da.created_at asc
    `;

    const myAnswer = answers.find((a) => a.user_id === context.userId);
    const dayLabel = dayIndex === 0 ? "Day 1" : `Day ${dayIndex + 1}`;

    return {
      dayIndex,
      dayLabel,
      questionId: question.id,
      prompt: question.prompt,
      myAnswer: myAnswer?.body ?? null,
      answers: answers.map((a) => ({
        userId: a.user_id,
        identity: a.temp_identity,
        animal: a.identity_animal,
        color: a.identity_color,
        body: a.body,
        createdAt: a.created_at,
        isMe: a.user_id === context.userId,
      })),
    };
  });

export const submitDailyAnswer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    roomId: z.string(),
    dayIndex: z.number().int().min(0),
    questionId: z.number().int(),
    body: z.string().min(1).max(LIMITS.dailyAnswerMax),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await assertMember(sql, data.roomId, context.userId);
    await sql`
      insert into daily_answers (room_id, day_index, question_id, user_id, body)
      values (${data.roomId}, ${data.dayIndex}, ${data.questionId}, ${context.userId}, ${data.body})
      on conflict (room_id, day_index, user_id) do update set body = excluded.body
    `;
    return { ok: true };
  });
