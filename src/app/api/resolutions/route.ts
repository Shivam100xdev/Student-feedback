import { db } from "@/lib/db";
import { publicResolutions, feedback, locations, auditLogs } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest) {
  try {
    const result = await db.select().from(publicResolutions).orderBy(asc(publicResolutions.publishedAt));
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching resolutions:", error);
    return NextResponse.json({ error: "Failed to fetch resolutions" }, { status: 500 });
  }
}

/**
 * Publish a resolved complaint to the public "You Said, We Did" wall.
 *
 * Admin-only. Uses the PII-redacted text where available, requires a resolution
 * note, and is idempotent: publishing the same complaint twice updates the
 * existing wall entry instead of creating a duplicate.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!session || !role || !ADMIN_ROLES.includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const feedbackId = typeof body.feedbackId === "string" ? body.feedbackId.trim() : "";
    if (!UUID_RE.test(feedbackId)) {
      return NextResponse.json({ error: "feedbackId must be a valid id" }, { status: 400 });
    }

    const [item] = await db.select().from(feedback).where(eq(feedback.id, feedbackId)).limit(1);
    if (!item) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }
    if (item.status !== "RESOLVED") {
      return NextResponse.json(
        { error: "Only resolved feedback can be published to the public wall" },
        { status: 400 },
      );
    }

    const text = (value: unknown, fallback: string | null) =>
      typeof value === "string" && value.trim() ? value.trim() : (fallback ?? "").trim();

    const resolution = text(body.resolution, item.resolutionNote);
    if (!resolution) {
      return NextResponse.json(
        { error: "Add a resolution note to this complaint before publishing it" },
        { status: 400 },
      );
    }

    const title = text(body.title, item.title);
    const issue = text(
      body.issue,
      item.summary ?? item.englishTranslation ?? item.redactedDescription ?? item.description,
    );

    let locationName = typeof body.locationName === "string" ? body.locationName.trim() || null : null;
    if (!locationName && item.locationId) {
      const [location] = await db
        .select({ name: locations.name })
        .from(locations)
        .where(eq(locations.id, item.locationId))
        .limit(1);
      locationName = location?.name ?? null;
    }
    if (!locationName) locationName = item.locationDetail ?? null;

    const sessionUserId = (session.user as { id?: string }).id;
    const actorId = sessionUserId && UUID_RE.test(sessionUserId) ? sessionUserId : null;

    const [existing] = await db
      .select({ id: publicResolutions.id })
      .from(publicResolutions)
      .where(eq(publicResolutions.feedbackId, feedbackId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(publicResolutions)
        .set({ title, issue, resolution, category: item.category, locationName })
        .where(eq(publicResolutions.id, existing.id))
        .returning();

      await db.insert(auditLogs).values({
        feedbackId,
        actorId,
        action: "PUBLISHED_TO_WALL",
        details: { resolutionId: updated.id, updated: true },
      });

      return NextResponse.json({ id: updated.id, created: false });
    }

    const [created] = await db
      .insert(publicResolutions)
      .values({
        feedbackId,
        issueId: item.issueClusterId ?? null,
        title,
        issue,
        resolution,
        category: item.category,
        locationName,
      })
      .returning();

    await db.insert(auditLogs).values({
      feedbackId,
      actorId,
      action: "PUBLISHED_TO_WALL",
      details: { resolutionId: created.id },
    });

    return NextResponse.json({ id: created.id, created: true }, { status: 201 });
  } catch (error) {
    console.error("Publish resolution error:", error);
    return NextResponse.json({ error: "Failed to publish resolution" }, { status: 500 });
  }
}
