import { db } from "@/lib/db";
import { feedback, escalations, slaRules, notifications, auditLogs, users } from "@/lib/db/schema";
import { eq, and, lte, gte, isNull, sql, inArray, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

// This endpoint is called by Vercel Cron or QStash on a schedule (e.g., every hour)
export async function GET(req: Request) {
  // Verify cron secret - required, never run unauthenticated
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not set; refusing to run the SLA escalation job.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const results = {
      acknowledged: 0,
      escalated: 0,
      overdue: 0,
      notified: 0,
    };

    // 1. Find feedback past acknowledgment SLA that hasn't been acknowledged
    const unacknowledged = await db
      .select({
        id: feedback.id,
        ticketCode: feedback.ticketCode,
        title: feedback.title,
        category: feedback.category,
        severity: feedback.severity,
        slaDeadline: feedback.slaDeadline,
        assignedDept: feedback.assignedDept,
        anonId: feedback.anonId,
      })
      .from(feedback)
      .where(
        and(
          lte(feedback.slaDeadline, now),
          isNull(feedback.acknowledgedAt),
          inArray(feedback.status, ["PENDING", "SUBMITTED", "UNDER_REVIEW"])
        )
      );

    // Get SLA rules for each category/severity
    for (const item of unacknowledged) {
      const slaRule = await db
        .select()
        .from(slaRules)
        .where(
          and(
            eq(slaRules.category, item.category as any),
            eq(slaRules.severity, item.severity as any),
            eq(slaRules.isActive, true)
          )
        )
        .limit(1);

      if (slaRule.length > 0) {
        const rule = slaRule[0];
        const escalationPath = rule.escalationPath as string[];

        // Find current escalation level
        const existingEscalation = await db
          .select()
          .from(escalations)
          .where(eq(escalations.feedbackId, item.id))
          .orderBy(desc(escalations.createdAt))
          .limit(1);

        let currentLevel = -1;
        if (existingEscalation.length > 0) {
          currentLevel = escalationPath.indexOf(existingEscalation[0].toRole);
        }

        // Escalate to next level
        if (currentLevel + 1 < escalationPath.length) {
          const nextRole = escalationPath[currentLevel + 1];

          // Create escalation record
          await db.insert(escalations).values({
            feedbackId: item.id,
            fromRole: (currentLevel >= 0 ? escalationPath[currentLevel] : "SYSTEM") as any,
            toRole: nextRole as any,
            reason: `SLA breach: Not acknowledged within ${rule.acknowledgmentHours}h`,
            slaRuleId: rule.id,
          } as any);

          // Create notification for the escalated role
          const targetUsers = await db
            .select({ id: users.id, anonId: users.anonId })
            .from(users)
            .where(eq(users.role, nextRole as any));

          for (const targetUser of targetUsers) {
            await db.insert(notifications).values({
              userId: targetUser.id,
              anonId: targetUser.anonId,
              title: `SLA Escalation: ${item.ticketCode}`,
              message: `Feedback "${item.title}" has been escalated to ${nextRole} due to SLA breach.`,
              type: "ESCALATION",
              metadata: { feedbackId: item.id, ticketCode: item.ticketCode, fromRole: currentLevel >= 0 ? escalationPath[currentLevel] : "SYSTEM", toRole: nextRole },
            });
          }

          // Update feedback
          await db.update(feedback).set({
            status: "ESCALATED",
            escalatedToRole: nextRole as any,
            acknowledgedAt: now,
            updatedAt: now,
          }).where(eq(feedback.id, item.id));

          // Audit log
          await db.insert(auditLogs).values({
            feedbackId: item.id,
            action: "SLA_ESCALATED",
            details: {
              reason: `SLA breach: Not acknowledged within ${rule.acknowledgmentHours}h`,
              fromRole: currentLevel >= 0 ? escalationPath[currentLevel] : "SYSTEM",
              toRole: nextRole,
              slaRuleId: rule.id,
            },
          });

          results.escalated++;
        }

        // Even if no further escalation, mark as acknowledged by system
        if (currentLevel + 1 >= escalationPath.length) {
          await db.update(feedback).set({
            acknowledgedAt: now,
            updatedAt: now,
          }).where(eq(feedback.id, item.id));
          results.acknowledged++;
        }
      }
    }

    // 2. Find feedback past resolution SLA
    const overdueResolution = await db
      .select({
        id: feedback.id,
        ticketCode: feedback.ticketCode,
        title: feedback.title,
        category: feedback.category,
        severity: feedback.severity,
        slaDeadline: feedback.slaDeadline,
        assignedDept: feedback.assignedDept,
        anonId: feedback.anonId,
      })
      .from(feedback)
      .where(
        and(
          lte(feedback.slaDeadline, now),
          inArray(feedback.status, ["IN_PROGRESS", "ESCALATED", "UNDER_REVIEW"])
        )
      );

    for (const item of overdueResolution) {
      // Mark as overdue
      await db.update(feedback).set({
        updatedAt: now,
      }).where(eq(feedback.id, item.id));

      // Notify assigned department
      if (item.assignedDept) {
        const deptUsers = await db
          .select({ id: users.id, anonId: users.anonId })
          .from(users)
          .where(eq(users.department, item.assignedDept));

        for (const deptUser of deptUsers) {
          await db.insert(notifications).values({
            userId: deptUser.id,
            anonId: deptUser.anonId,
            title: `SLA Breach: ${item.ticketCode} Overdue`,
            message: `Feedback "${item.title}" has passed its resolution deadline. Immediate action required.`,
            type: "SLA_BREACH",
            metadata: { feedbackId: item.id, ticketCode: item.ticketCode },
          });
        }
      }

      results.overdue++;
    }

    // 3. Send reminders for feedback approaching SLA (2 hours before deadline)
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const approachingSla = await db
      .select({
        id: feedback.id,
        ticketCode: feedback.ticketCode,
        title: feedback.title,
        slaDeadline: feedback.slaDeadline,
        assignedDept: feedback.assignedDept,
        anonId: feedback.anonId,
      })
      .from(feedback)
      .where(
        and(
          lte(feedback.slaDeadline, twoHoursFromNow),
          gte(feedback.slaDeadline, now),
          inArray(feedback.status, ["IN_PROGRESS", "ESCALATED", "UNDER_REVIEW"])
        )
      );

    for (const item of approachingSla) {
      if (item.assignedDept) {
        const deptUsers = await db
          .select({ id: users.id, anonId: users.anonId })
          .from(users)
          .where(eq(users.department, item.assignedDept));

        for (const deptUser of deptUsers) {
          await db.insert(notifications).values({
            userId: deptUser.id,
            anonId: deptUser.anonId,
            title: `SLA Reminder: ${item.ticketCode}`,
            message: `Feedback "${item.title}" has an SLA deadline in 2 hours. Please prioritize.`,
            type: "SLA_REMINDER",
            metadata: { feedbackId: item.id, ticketCode: item.ticketCode },
          });
        }
      }
      results.notified++;
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("SLA escalation cron error:", error);
    return NextResponse.json({ error: "Failed to process SLA escalations" }, { status: 500 });
  }
}