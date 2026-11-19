import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, desc, and, count, or, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const unreadOnly = searchParams.get("unread") === "true";

    const userId = (session.user as any).id;
    const anonId = (session.user as any).anonId;

    const conditions = [
      or(
        eq(notifications.userId, userId),
        eq(notifications.anonId, anonId)
      ),
    ];

    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    const whereClause = and(...conditions);

    const result = await db
      .select()
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    // Get unread count
    const unreadCount = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(whereClause, eq(notifications.isRead, false)));

    return NextResponse.json({
      notifications: result,
      unreadCount: unreadCount[0]?.count || 0,
    });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { notificationIds, action } = await req.json();

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json({ error: "No notification IDs provided" }, { status: 400 });
    }

    if (action === "mark_read") {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(inArray(notifications.id, notificationIds));

      return NextResponse.json({ success: true });
    }

    if (action === "mark_all_read") {
      const userId = (session.user as any).id;
      const anonId = (session.user as any).anonId;

      await db
        .update(notifications)
        .set({ isRead: true })
        .where(or(eq(notifications.userId, userId), eq(notifications.anonId, anonId)));

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Update notifications error:", error);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}