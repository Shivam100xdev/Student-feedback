import { db } from "@/lib/db";
import { locations } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);

    const category = searchParams.get("category");
    const activeOnly = searchParams.get("active") !== "false";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const conditions = [];
    if (category) conditions.push(eq(locations.category, category as any));
    if (activeOnly) conditions.push(eq(locations.isActive, true));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select()
      .from(locations)
      .where(whereClause)
      .orderBy(desc(locations.createdAt))
      .limit(limit);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Fetch locations error:", error);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes((session.user as any).role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { name, code, category, building, floor, description } = await req.json();

    if (!name || !code || !category) {
      return NextResponse.json({ error: "Name, code, and category are required" }, { status: 400 });
    }

    const validCategories = [
      "HOSTEL", "MESS", "ACADEMICS", "INFRASTRUCTURE",
      "SPORTS", "SANITATION", "SECURITY", "FINANCIAL", "CONFIDENTIAL_SAFETY"
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    // Generate QR code URL
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const qrCodeUrl = `${baseUrl}/f/${code}`;

    const [location] = await db.insert(locations).values({
      name,
      code: code.toUpperCase(),
      category: category as any,
      building,
      floor,
      description,
      qrCodeUrl,
    }).returning();

    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    console.error("Create location error:", error);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}