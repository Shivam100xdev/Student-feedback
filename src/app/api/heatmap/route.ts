import { db } from "@/lib/db";
import { feedback, locations } from "@/lib/db/schema";
import { eq, and, gte, lte, count, sql, desc, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "AUTHORITY", "SUPER_ADMIN"].includes((session.user as any).role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "30");
    const category = searchParams.get("category");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get feedback aggregated by location with severity info
    const conditions = [
      gte(feedback.createdAt, startDate),
      sql`${feedback.locationId} IS NOT NULL`,
    ];

    if (category) {
      conditions.push(eq(feedback.category, category as any));
    }

    const locationStats = await db
      .select({
        locationId: feedback.locationId,
        count: count(),
        avgSeverity: sql<string>`
          CASE
            WHEN COUNT(*) FILTER (WHERE ${feedback.severity} = 'CRITICAL') > 0 THEN 'CRITICAL'
            WHEN COUNT(*) FILTER (WHERE ${feedback.severity} = 'HIGH') > 0 THEN 'HIGH'
            WHEN COUNT(*) FILTER (WHERE ${feedback.severity} = 'MEDIUM') > 0 THEN 'MEDIUM'
            ELSE 'LOW'
          END
        `,
        maxPriorityScore: sql<number>`MAX(${feedback.priorityScore})`,
        category: sql<string>`MODE() WITHIN GROUP (ORDER BY ${feedback.category})`,
      })
      .from(feedback)
      .where(and(...conditions))
      .groupBy(feedback.locationId)
      .orderBy(desc(count()))
      .limit(100);

    // Get location details
    const locationIds = locationStats.map(s => s.locationId).filter(Boolean) as string[];
    const locationDetails = await db
      .select()
      .from(locations)
      .where(inArray(locations.id, locationIds));

    const locationMap = new Map(locationDetails.map(l => [l.id, l]));

    // Generate mock coordinates for demo (in production, locations would have lat/lng)
    const campusCenter = { lat: 12.9716, lng: 77.5946 }; // Bangalore
    const heatmapData = locationStats.map((stat, index) => {
      const location = stat.locationId ? locationMap.get(stat.locationId) : null;

      // Generate pseudo-random but consistent coordinates around campus center
      const seed = stat.locationId || index.toString();
      const hash = Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const angle = (hash * 137.508) % 360; // Golden angle
      const radius = 0.005 + (hash % 100) * 0.0001; // 0.5km to 1.5km radius

      const lat = campusCenter.lat + radius * Math.cos((angle * Math.PI) / 180);
      const lng = campusCenter.lng + radius * Math.sin((angle * Math.PI) / 180);

      return {
        locationId: stat.locationId || "",
        locationName: location?.name || `Location ${stat.locationId?.substring(0, 8)}`,
        category: stat.category || "INFRASTRUCTURE",
        lat,
        lng,
        count: Number(stat.count),
        severity: stat.avgSeverity,
        priorityScore: stat.maxPriorityScore || 0,
      };
    });

    return NextResponse.json(heatmapData);
  } catch (error) {
    console.error("Heatmap data error:", error);
    return NextResponse.json({ error: "Failed to fetch heatmap data" }, { status: 500 });
  }
}