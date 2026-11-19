import { db } from "@/lib/db";
import { publicResolutions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Increment upvote count atomically
    await db
      .update(publicResolutions)
      .set({ upvotes: sql`${publicResolutions.upvotes} + 1` })
      .where(eq(publicResolutions.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Upvote error:", error);
    return NextResponse.json({ error: "Failed to upvote" }, { status: 500 });
  }
}