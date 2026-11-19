import { db } from "@/lib/db";
import { publicResolutions, feedback, issues } from "@/lib/db/schema";
import { eq, desc, and, ilike, count, sql, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const conditions = [];
    if (category) conditions.push(eq(publicResolutions.category, category as any));
    if (search) conditions.push(ilike(publicResolutions.title, `%${search}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select()
      .from(publicResolutions)
      .where(whereClause)
      .orderBy(desc(publicResolutions.publishedAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(results);
  } catch (error) {
    console.error("Fetch public resolutions error:", error);
    return NextResponse.json({ error: "Failed to fetch resolutions" }, { status: 500 });
  }
}