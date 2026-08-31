// Server functions for messages
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { LIMITS } from "@/lib/limits";
import type { ChatMessage } from "@/lib/types";

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    roomId: z.string(),
    body: z.string().min(1).max(LIMITS.messageMax),
    replyToId: z.string().optional(),
    replyToBody: z.string().optional(),
    replyToIdentity: z.string().optional(),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    // Must be a member of the room
    const membership = await sql<{ room_id: string }>`
      select room_id from room_members
      where room_id = ${data.roomId} and user_id = ${context.userId}
    `;
    if (!membership.length) throw new Error("Not a member of this room");

    const id = genId();
    try {
      await sql`
        insert into messages (id, room_id, user_id, body, reply_to_id, reply_to_body, reply_to_identity)
        values (${id}, ${data.roomId}, ${context.userId}, ${data.body}, ${data.replyToId ?? null}, ${data.replyToBody ?? null}, ${data.replyToIdentity ?? null})
      `;
    } catch {
      // Fallback if reply columns not added yet
      await sql`
        insert into messages (id, room_id, user_id, body)
        values (${id}, ${data.roomId}, ${context.userId}, ${data.body})
      `;
    }
    return { id };
  });

export const getMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ roomId: z.string(), before: z.string().optional() }))
  .handler(async ({ context, data }): Promise<ChatMessage[]> => {
    const sql = await getSql();
    const userId = context.userId;
    // Must be member
    const membership = await sql<{ room_id: string }>`
      select room_id from room_members
      where room_id = ${data.roomId} and user_id = ${userId}
    `;
    if (!membership.length) throw new Error("Not a member");

    const params: unknown[] = [data.roomId];
    let beforeClause = "";
    if (data.before) {
      params.push(data.before);
      beforeClause = `and m.created_at < $${params.length}`;
    }

    let rows: Array<{
      id: string; room_id: string; user_id: string; body: string; created_at: string;
      temp_identity: string; identity_animal: string; identity_color: string;
      revealed: boolean; username: string | null; display_name: string | null;
      reply_to_id?: string | null; reply_to_body?: string | null; reply_to_identity?: string | null;
    }> = [];

    try {
      rows = await sql.query(
        `select m.id, m.room_id, m.user_id, m.body, m.created_at,
                rm.temp_identity, rm.identity_animal, rm.identity_color, rm.revealed,
                p.username, p.display_name,
                m.reply_to_id, m.reply_to_body, m.reply_to_identity
         from messages m
         join room_members rm on rm.room_id = m.room_id and rm.user_id = m.user_id
         left join profiles p on p.user_id = m.user_id
         where m.room_id = $1 ${beforeClause}
         order by m.created_at asc
         limit 100`,
        params,
      );
    } catch {
      // Fallback without reply_to columns
      rows = await sql.query(
        `select m.id, m.room_id, m.user_id, m.body, m.created_at,
                rm.temp_identity, rm.identity_animal, rm.identity_color, rm.revealed,
                p.username, p.display_name
         from messages m
         join room_members rm on rm.room_id = m.room_id and rm.user_id = m.user_id
         left join profiles p on p.user_id = m.user_id
         where m.room_id = $1 ${beforeClause}
         order by m.created_at asc
         limit 100`,
        params,
      );
    }

    if (rows.length === 0) return [];

    const msgIds = rows.map((r) => r.id);
    const reactionsByMsg = new Map<string, Array<{ emoji: string; count: number; mine: boolean }>>();

    try {
      const reactions = await sql<{ message_id: string; emoji: string; count: number; mine: boolean }>`
        select message_id, emoji,
               count(*)::int as count,
               bool_or(user_id = ${userId}) as mine
        from message_reactions
        where message_id = any(${msgIds})
        group by message_id, emoji
      `;

      for (const r of reactions) {
        const list = reactionsByMsg.get(r.message_id) ?? [];
        list.push({ emoji: r.emoji, count: r.count, mine: r.mine });
        reactionsByMsg.set(r.message_id, list);
      }
    } catch {}

    return rows.map((r) => ({
      id: r.id,
      roomId: r.room_id,
      userId: r.user_id,
      body: r.body,
      createdAt: r.created_at,
      identity: r.temp_identity,
      animal: r.identity_animal,
      color: r.identity_color,
      revealedName: r.revealed && r.display_name ? r.display_name : null,
      isMe: r.user_id === userId,
      reactions: reactionsByMsg.get(r.id) ?? [],
      replyTo: r.reply_to_id && r.reply_to_body && r.reply_to_identity ? {
        id: r.reply_to_id,
        body: r.reply_to_body,
        identity: r.reply_to_identity,
      } : null,
    }));
  });

export const toggleMessageReaction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    messageId: z.string(),
    emoji: z.string().min(1).max(20),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const userId = context.userId;

    const msgs = await sql<{ room_id: string }>`
      select room_id from messages where id = ${data.messageId}
    `;
    if (!msgs.length) throw new Error("Message not found");

    const roomId = msgs[0].room_id;
    const membership = await sql<{ room_id: string }>`
      select room_id from room_members where room_id = ${roomId} and user_id = ${userId}
    `;
    if (!membership.length) throw new Error("Not a member");

    const existing = await sql<{ message_id: string }>`
      select message_id from message_reactions
      where message_id = ${data.messageId} and user_id = ${userId} and emoji = ${data.emoji}
    `;

    if (existing.length > 0) {
      await sql`
        delete from message_reactions
        where message_id = ${data.messageId} and user_id = ${userId} and emoji = ${data.emoji}
      `;
      return { added: false, messageId: data.messageId, emoji: data.emoji };
    } else {
      await sql`
        insert into message_reactions (message_id, user_id, emoji)
        values (${data.messageId}, ${userId}, ${data.emoji})
      `;
      return { added: true, messageId: data.messageId, emoji: data.emoji };
    }
  });
