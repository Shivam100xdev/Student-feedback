import { db } from "@/lib/db";
import { feedback, weeklyInsights, issues, users } from "@/lib/db/schema";
import { eq, and, gte, lte, count, sql, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { generateWeeklyInsights } from "@/lib/ai";

// This endpoint is called by Vercel Cron or QStash on a schedule
export async function GET(req: Request) {
  // Verify cron secret - required, never run unauthenticated
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not set; refusing to run the weekly insights job.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days

    // Get all feedback from the past week
    const weeklyFeedback = await db
      .select()
      .from(feedback)
      .where(and(gte(feedback.createdAt, startDate), lte(feedback.createdAt, endDate)))
      .orderBy(desc(feedback.createdAt));

    // Aggregate by category
    const byCategory = weeklyFeedback.reduce((acc, f) => {
      acc[f.category] = (acc[f.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Aggregate by severity
    const bySeverity = weeklyFeedback.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Aggregate by language
    const byLanguage = weeklyFeedback.reduce((acc, f) => {
      acc[f.language] = (acc[f.language] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Top issues (by cluster)
    const topIssuesData = await db
      .select({
        id: issues.id,
        title: issues.title,
        category: issues.category,
        feedbackCount: issues.feedbackCount,
        priorityScore: issues.priorityScore,
        status: issues.status,
      })
      .from(issues)
      .orderBy(desc(issues.priorityScore))
      .limit(10);

    const topIssues = topIssuesData.map(i => ({
      id: i.id,
      title: i.title,
      category: i.category,
      feedbackCount: i.feedbackCount,
      priorityScore: i.priorityScore,
      status: i.status,
    }));

    // Sentiment trend (daily)
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

    // Process sentiment trend
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

    const sla = slaData[0] || { total: 0, onTime: 0, overdue: 0, avgResolutionHours: 0 };
    const slaCompliance = {
      total: Number(sla.total),
      onTime: Number(sla.onTime),
      overdue: Number(sla.overdue),
      complianceRate: sla.total > 0 ? (Number(sla.onTime) / Number(sla.total)) * 100 : 100,
      avgResolutionHours: Number(sla.avgResolutionHours) || 0,
    };

    // Department scores
    const deptScores = await db
      .select({
        dept: feedback.assignedDept,
        total: count(),
        resolved: sql<number>`COUNT(*) FILTER (WHERE ${feedback.status} = 'RESOLVED')`,
        critical: sql<number>`COUNT(*) FILTER (WHERE ${feedback.severity} = 'CRITICAL')`,
        avgResolutionHours: sql<number>`
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

    const departmentScores = deptScores.map(d => ({
      department: d.dept,
      total: Number(d.total),
      resolved: Number(d.resolved),
      resolutionRate: d.total > 0 ? (Number(d.resolved) / Number(d.total)) * 100 : 0,
      criticalCount: Number(d.critical),
      avgResolutionHours: d.avgResolutionHours ? Number(d.avgResolutionHours) : 0,
    }));

    // Generate AI insights
    const aiSummary = await generateWeeklyInsights(
      weeklyFeedback.slice(0, 50).map(f => ({
        category: f.category,
        severity: f.severity,
        sentiment: f.sentiment,
        summary: f.summary,
        title: f.title,
      }))
    );

    // Store weekly insights
    const [insight] = await db.insert(weeklyInsights).values({
      weekStart: startDate,
      weekEnd: endDate,
      totalFeedback: weeklyFeedback.length,
      byCategory,
      bySeverity,
      byLanguage,
      topIssues,
      sentimentTrend: sentimentChartData,
      slaCompliance,
      departmentScores,
      aiGeneratedSummary: aiSummary,
    }).returning();

    return NextResponse.json({
      success: true,
      insightId: insight.id,
      summary: {
        totalFeedback: weeklyFeedback.length,
        byCategory,
        bySeverity,
        byLanguage,
        slaCompliance,
        topIssuesCount: topIssues.length,
      },
    });
  } catch (error) {
    console.error("Weekly insights generation error:", error);
    return NextResponse.json({ error: "Failed to generate weekly insights" }, { status: 500 });
  }
}