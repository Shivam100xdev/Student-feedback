import { db } from "@/lib/db";
import { publicResolutions } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  try {
    const result = await db.select().from(publicResolutions).orderBy(asc(publicResolutions.publishedAt));
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching resolutions:", error);
    return NextResponse.json({ error: "Failed to fetch resolutions" }, { status: 500 });
  }
}