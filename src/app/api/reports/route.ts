import { db } from "@/lib/db";
import { feedback, users, issues, publicResolutions, statusHistory, auditLogs, slaRules } from "@/lib/db/schema";
import { eq, desc, asc, gte, lte, and, inArray, count, sql, or } from "drizzle-orm";
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
    const type = searchParams.get("type") || "csv";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const severity = searchParams.get("severity");
    const department = searchParams.get("department");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10000"), 50000);

    // Build query conditions
    const conditions = [];
    if (startDate) conditions.push(gte(feedback.createdAt, new Date(startDate)));
    if (endDate) conditions.push(lte(feedback.createdAt, new Date(endDate)));
    if (category) conditions.push(eq(feedback.category, category as any));
    if (status) conditions.push(eq(feedback.status, status as any));
    if (severity) conditions.push(eq(feedback.severity, severity as any));
    if (department) conditions.push(eq(feedback.assignedDept, department));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select()
      .from(feedback)
      .where(whereClause)
      .orderBy(desc(feedback.createdAt))
      .limit(limit);

    if (type === "csv") {
      const headers = [
        "Ticket Code",
        "Tracking Code",
        "Title",
        "Category",
        "Sub-Category",
        "Severity",
        "Status",
        "Created At",
        "Updated At",
        "Resolved At",
        "SLA Deadline",
        "Acknowledged At",
        "Sentiment",
        "Sentiment Score",
        "Language",
        "Is Anonymous",
        "Assigned Dept",
        "Escalated To Role",
        "Upvotes",
        "Resolution Note",
        "Location Detail",
        "Abuse Flagged",
        "PII Redacted",
        "AI Status",
        "Summary",
      ];

      const rows = results.map((f) => [
        f.ticketCode,
        f.trackingCode,
        `"${f.title.replace(/"/g, '""')}"`,
        f.category,
        f.subCategory || "",
        f.severity,
        f.status,
        f.createdAt ? new Date(f.createdAt).toISOString() : "",
        f.updatedAt ? new Date(f.updatedAt).toISOString() : "",
        f.resolvedAt ? new Date(f.resolvedAt).toISOString() : "",
        f.slaDeadline ? new Date(f.slaDeadline).toISOString() : "",
        f.acknowledgedAt ? new Date(f.acknowledgedAt).toISOString() : "",
        f.sentiment,
        f.sentimentScore?.toString() || "",
        f.language,
        f.isAnonymous ? "Yes" : "No",
        f.assignedDept || "",
        f.escalatedToRole || "",
        f.upvotes.toString(),
        f.resolutionNote ? `"${f.resolutionNote.replace(/"/g, '""')}"` : "",
        f.locationDetail || "",
        f.abuseFlagged ? "Yes" : "No",
        f.piiRedacted ? "Yes" : "No",
        f.aiStatus,
        f.summary ? `"${f.summary.replace(/"/g, '""')}"` : "",
      ].join(","));

      const csv = [headers.join(",")].concat(rows).join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=feedback-report-${new Date().toISOString().split("T")[0]}.csv`,
        },
      });
    }

    // JSON response with additional analytics
    const stats = {
      total: results.length,
      byStatus: results.reduce((acc, f) => {
        acc[f.status] = (acc[f.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byCategory: results.reduce((acc, f) => {
        acc[f.category] = (acc[f.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      bySeverity: results.reduce((acc, f) => {
        acc[f.severity] = (acc[f.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      bySentiment: results.reduce((acc, f) => {
        acc[f.sentiment] = (acc[f.sentiment] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byLanguage: results.reduce((acc, f) => {
        acc[f.language] = (acc[f.language] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      avgSentimentScore:
        results.length > 0
          ? results.reduce((sum, f) => sum + (f.sentimentScore || 0), 0) / results.length
          : 0,
      slaBreaches: results.filter(
        (f) => f.slaDeadline && new Date(f.slaDeadline) < new Date() && !["RESOLVED", "REJECTED"].includes(f.status)
      ).length,
      avgResolutionHours: results
        .filter((f) => f.resolvedAt && f.createdAt)
        .reduce((sum, f) => sum + (new Date(f.resolvedAt!).getTime() - new Date(f.createdAt).getTime()) / (1000 * 60 * 60), 0) /
        Math.max(1, results.filter((f) => f.resolvedAt).length),
    };

    return NextResponse.json({ data: results, stats });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

// Analytics endpoint for dashboard charts
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "AUTHORITY", "SUPER_ADMIN"].includes((session.user as any).role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { dateRange } = await req.json();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (dateRange || 30));

    // Daily complaints trend
    const dailyTrend = await db
      .select({
        date: sql<string>`DATE(${feedback.createdAt})`,
        count: count(),
      })
      .from(feedback)
      .where(and(gte(feedback.createdAt, startDate), lte(feedback.createdAt, endDate)))
      .groupBy(sql`DATE(${feedback.createdAt})`)
      .orderBy(sql`DATE(${feedback.createdAt})`);

    // Category distribution
    const categoryDist = await db
      .select({
        category: feedback.category,
        count: count(),
      })
      .from(feedback)
      .where(and(gte(feedback.createdAt, startDate), lte(feedback.createdAt, endDate)))
      .groupBy(feedback.category);

    // Status distribution
    const statusDist = await db
      .select({
        status: feedback.status,
        count: count(),
      })
      .from(feedback)
      .where(and(gte(feedback.createdAt, startDate), lte(feedback.createdAt, endDate)))
      .groupBy(feedback.status);

    // Severity distribution
    const severityDist = await db
      .select({
        severity: feedback.severity,
        count: count(),
      })
      .from(feedback)
      .where(and(gte(feedback.createdAt, startDate), lte(feedback.createdAt, endDate)))
      .groupBy(feedback.severity);

    // Department performance
    const deptPerformance = await db
      .select({
        dept: feedback.assignedDept,
        total: count(),
        resolved: sql<number>`COUNT(*) FILTER (WHERE ${feedback.status} = 'RESOLVED')`,
        avgResolutionTime: sql<number>`
          AVG(EXTRACT(EPOCH FROM (${feedback.resolvedAt} - ${feedback.createdAt}))/3600)
          FILTER (WHERE ${feedback.resolvedAt} IS NOT NULL)
        `,
      })
      .from(feedback)
      .where(
        and(
          gte(feedback.createdAt, startDate),
          lte(feedback.createdAt, endDate),
          sql`${feedback.assignedDept} IS NOT NULL`
        )
      )
      .groupBy(feedback.assignedDept);

    // Sentiment trend
    const sentimentTrend = await db
      .select({
        date: sql<string>`DATE(${feedback.createdAt})`,
        sentiment: feedback.sentiment,
        count: count(),
      })
      .from(feedback)
      .where(and(gte(feedback.createdAt, startDate), lte(feedback.createdAt, endDate)))
      .groupBy(sql`DATE(${feedback.createdAt})`, feedback.sentiment)
      .orderBy(sql`DATE(${feedback.createdAt})`);

    // SLA compliance
    const slaData = await db
      .select({
        total: count(),
        onTime: sql<number>`COUNT(*) FILTER (WHERE ${feedback.resolvedAt} IS NOT NULL AND ${feedback.resolvedAt} <= ${feedback.slaDeadline})`,
        overdue: sql<number>`COUNT(*) FILTER (WHERE ${feedback.slaDeadline} IS NOT NULL AND ${feedback.slaDeadline} < NOW() AND ${feedback.status} NOT IN ('RESOLVED', 'REJECTED'))`,
        avgResolutionHours: sql<number>`
          AVG(EXTRACT(EPOCH FROM (${feedback.resolvedAt} - ${feedback.createdAt}))/3600)
          FILTER (WHERE ${feedback.resolvedAt} IS NOT NULL)
        `,
      })
      .from(feedback)
      .where(and(gte(feedback.createdAt, startDate), lte(feedback.createdAt, endDate)));

    // Process sentiment trend into chart format
    const sentimentMap = new Map<string, { positive: number; neutral: number; negative: number }>();
    for (const item of sentimentTrend) {
      const date = item.date;
      if (!sentimentMap.has(date)) {
        sentimentMap.set(date, { positive: 0, neutral: 0, negative: 0 });
      }
      const entry = sentimentMap.get(date)!;
      entry[item.sentiment.toLowerCase() as keyof typeof entry] = Number(item.count);
    }

    const sentimentChartData = Array.from(sentimentMap.entries())
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // SLA compliance
    const sla = slaData[0] || { total: 0, onTime: 0, overdue: 0, avgResolutionHours: 0 };

    return NextResponse.json({
      dailyTrend: dailyTrend.map((d) => ({ date: d.date, count: Number(d.count) })),
      categoryDist: categoryDist.map((d) => ({ name: d.category, value: Number(d.count) })),
      statusDist: statusDist.map((d) => ({ name: d.status, value: Number(d.count) })),
      severityDist: severityDist.map((d) => ({ severity: d.severity, count: Number(d.count) })),
      deptPerformance: deptPerformance.map((d) => ({
        department: d.dept,
        total: Number(d.total),
        resolved: Number(d.resolved),
        resolutionRate: d.total > 0 ? (Number(d.resolved) / Number(d.total)) * 100 : 0,
        avgResolutionHours: d.avgResolutionTime ? Number(d.avgResolutionTime) : 0,
      })),
      sentimentTrend: sentimentChartData,
      slaCompliance: {
        onTime: Number(sla.onTime),
        overdue: Number(sla.overdue),
        avgResolutionHours: Number(sla.avgResolutionHours) || 0,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}