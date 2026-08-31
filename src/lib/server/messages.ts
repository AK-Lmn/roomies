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
    await sql`
      insert into messages (id, room_id, user_id, body)
      values (${id}, ${data.roomId}, ${context.userId}, ${data.body})
    `;
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
    const rows = await sql.query<{
      id: string; room_id: string; user_id: string; body: string; created_at: string;
      temp_identity: string; identity_animal: string; identity_color: string;
      revealed: boolean; username: string | null; display_name: string | null;
    }>(
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
    }));
  });
