import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const trackingCode = searchParams.get("code") || searchParams.get("trackingCode");
    const ticketCode = searchParams.get("ticketCode");

    if (!trackingCode && !ticketCode) {
      return NextResponse.json({ error: "Tracking code or ticket code required" }, { status: 400 });
    }

    const conditions = [];
    if (trackingCode) conditions.push(eq(feedback.trackingCode, trackingCode));
    if (ticketCode) conditions.push(eq(feedback.ticketCode, ticketCode));

    const result = await db.select().from(feedback).where(eq(feedback.trackingCode, trackingCode || "")).limit(1);

    // Try ticket code if tracking code not found
    let feedbackItem = result[0];
    if (!feedbackItem && ticketCode) {
      const ticketResult = await db.select().from(feedback).where(eq(feedback.ticketCode, ticketCode)).limit(1);
      feedbackItem = ticketResult[0];
    }

    if (!feedbackItem) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }

    // Return safe public info (no anon_id, no internal details)
    const safeResponse = {
      ticketCode: feedbackItem.ticketCode,
      trackingCode: feedbackItem.trackingCode,
      title: feedbackItem.title,
      category: feedbackItem.category,
      subCategory: feedbackItem.subCategory,
      severity: feedbackItem.severity,
      status: feedbackItem.status,
      language: feedbackItem.language,
      sentiment: feedbackItem.sentiment,
      locationDetail: feedbackItem.locationDetail,
      createdAt: feedbackItem.createdAt,
      updatedAt: feedbackItem.updatedAt,
      slaDeadline: feedbackItem.slaDeadline,
      acknowledgedAt: feedbackItem.acknowledgedAt,
      resolvedAt: feedbackItem.resolvedAt,
      resolutionNote: feedbackItem.resolutionNote,
      upvotes: feedbackItem.upvotes,
      isOverdue: feedbackItem.slaDeadline && new Date(feedbackItem.slaDeadline) < new Date() &&
        !["RESOLVED", "REJECTED", "CLOSED"].includes(feedbackItem.status),
    };

    return NextResponse.json(safeResponse);
  } catch (error) {
    console.error("Track feedback error:", error);
    return NextResponse.json({ error: "Failed to track feedback" }, { status: 500 });
  }
}