// Server functions for notifications, reports, blocks
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { LIMITS } from "@/lib/limits";
import type { NotificationItem } from "@/lib/types";

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── notifications ───────────────────────────────────────────────────────────

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<NotificationItem[]> => {
    const sql = await getSql();
    const rows = await sql<{
      id: string; kind: string; title: string; body: string;
      room_id: string | null; read_at: string | null; created_at: string;
    }>`
      select id, kind, title, body, room_id, read_at, created_at
      from notifications
      where user_id = ${context.userId}
      order by created_at desc
      limit 30
    `;
    return rows.map((r) => ({
      id: r.id, kind: r.kind, title: r.title, body: r.body,
      roomId: r.room_id, readAt: r.read_at, createdAt: r.created_at,
    }));
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ notificationId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update notifications set read_at = now()
      where id = ${data.notificationId} and user_id = ${context.userId} and read_at is null
    `;
    return { ok: true };
  });

// ─── reports ─────────────────────────────────────────────────────────────────

export const submitReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    targetUserId: z.string().optional(),
    targetType: z.string(),
    targetId: z.string().optional(),
    roomId: z.string().optional(),
    reason: z.string().min(1).max(LIMITS.reportReasonMax),
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = genId();
    await sql`
      insert into reports (id, reporter_id, target_user_id, target_type, target_id, room_id, reason)
      values (${id}, ${context.userId}, ${data.targetUserId ?? null},
              ${data.targetType}, ${data.targetId ?? null},
              ${data.roomId ?? null}, ${data.reason})
    `;
    return { ok: true };
  });

// ─── blocks ──────────────────────────────────────────────────────────────────

export const blockUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ targetUserId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (data.targetUserId === context.userId) throw new Error("Cannot block yourself");
    await sql`
      insert into blocks (blocker_id, blocked_id)
      values (${context.userId}, ${data.targetUserId})
      on conflict do nothing
    `;
    return { ok: true };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ targetUserId: z.string() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      delete from blocks where blocker_id = ${context.userId} and blocked_id = ${data.targetUserId}
    `;
    return { ok: true };
  });

export const getBlockedUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<string[]> => {
    const sql = await getSql();
    const rows = await sql<{ blocked_id: string }>`
      select blocked_id from blocks where blocker_id = ${context.userId}
    `;
    return rows.map((r) => r.blocked_id);
  });
