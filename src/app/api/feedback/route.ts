import { db } from "@/lib/db";
import { feedback, feedbackAttachments, locations, rateLimits, auditLogs, statusHistory, escalations, issues } from "@/lib/db/schema";
import { eq, and, gte, desc, count } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { computeAnonId, generateTrackingCode, generateTicketCode, hashIdentifier, redactPii } from "@/lib/crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Rate limit configuration
const RATE_LIMITS = {
  authenticated: { windowMs: 60 * 60 * 1000, maxRequests: 20 }, // 20 per hour per user
  anonymous: { windowMs: 60 * 60 * 1000, maxRequests: 10 }, // 10 per hour per device
  strict: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 5 }, // 5 per day for extra strict
};

async function checkRateLimit(
  identifier: string,
  limitType: "authenticated" | "anonymous"
): Promise<{ allowed: boolean; remaining: number }> {
  const { windowMs, maxRequests } = RATE_LIMITS[limitType];
  const windowStart = new Date(Date.now() - windowMs);

  // Check existing rate limit record
  const existing = await db
    .select()
    .from(rateLimits)
    .where(and(eq(rateLimits.identifier, identifier), gte(rateLimits.windowStart, windowStart)))
    .limit(1);

  if (existing.length > 0) {
    const current = existing[0];
    if (current.requestCount >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }
    // Increment
    await db
      .update(rateLimits)
      .set({ requestCount: current.requestCount + 1 })
      .where(eq(rateLimits.id, current.id));
    return { allowed: true, remaining: maxRequests - current.requestCount - 1 };
  }

  // Create new rate limit record
  await db.insert(rateLimits).values({
    identifier,
    windowStart: new Date(),
    requestCount: 1,
  });
  return { allowed: true, remaining: maxRequests - 1 };
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const contentType = headersList.get("content-type") || "";
    const isFormData = contentType.includes("multipart/form-data");

    let title: string;
    let description: string;
    let category: string;
    let locationId: string | null = null;
    let locationDetail: string | null = null;
    let isAnonymous = true;
    let files: File[] = [];
    let turnstileToken: string | null = null;

    if (isFormData) {
      const formData = await req.formData();
      title = formData.get("title") as string;
      description = formData.get("description") as string;
      category = formData.get("category") as string;
      locationId = (formData.get("locationId") as string) || null;
      locationDetail = (formData.get("locationDetail") as string) || null;
      isAnonymous = formData.get("isAnonymous") !== "false";
      turnstileToken = (formData.get("turnstileToken") as string) || null;
      files = formData.getAll("attachments") as File[];
    } else {
      const body = await req.json();
      title = body.title;
      description = body.description;
      category = body.category;
      locationId = body.locationId || null;
      locationDetail = body.locationDetail || null;
      isAnonymous = body.isAnonymous !== false;
      turnstileToken = body.turnstileToken || null;
    }

    // Input validation
    if (!title || !description) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 });
    }

    if (title.length > 200 || description.length > 10000) {
      return NextResponse.json({ error: "Input too long" }, { status: 400 });
    }

    // Validate category
    const validCategories = [
      "HOSTEL", "MESS", "ACADEMICS", "INFRASTRUCTURE",
      "SPORTS", "SANITATION", "SECURITY", "FINANCIAL", "CONFIDENTIAL_SAFETY",
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    // Validate location if provided
    let location = null;
    if (locationId) {
      const loc = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
      if (loc.length === 0) {
        return NextResponse.json({ error: "Invalid location" }, { status: 400 });
      }
      location = loc[0];
    }

    // Determine user context and rate limiting
    const session = await getServerSession(authOptions);
    let anonId: string;
    let userId: string | null = null;
    let rateLimitType: "authenticated" | "anonymous" | "strict";

    if (session?.user && (session.user as any).id) {
      // Authenticated user
      userId = (session.user as any).id;
      // Tokens issued before anon_id was added to the session have no anonId;
      // derive it from the email (same HMAC as users.anon_id) instead of passing undefined.
      const anonIdentity = session.user.email ?? String(userId);
      anonId = (session.user as any).anonId || computeAnonId(anonIdentity);
      rateLimitType = "authenticated";
    } else {
      // Anonymous user: verify Turnstile only in production (optional - warn but don't block)
      if (process.env.NODE_ENV === "production" && turnstileToken) {
        const turnstileValid = await verifyTurnstile(turnstileToken);

        if (!turnstileValid) {
          // Log warning but allow submission - turnstile may fail in some environments
          console.warn("Turnstile verification failed, allowing submission with warning");
        }
      }

      // Derive a device-level identifier (anonId was never set for anonymous users before)
      const ip = (headersList.get("x-forwarded-for") || "unknown").split(",")[0].trim();
      const userAgent = headersList.get("user-agent") || "";
      anonId = hashIdentifier(`${ip}|${userAgent}`);
      rateLimitType = "anonymous";
    }

    // Check rate limit (applies to both authenticated and anonymous users)
    const rateLimit = await checkRateLimit(anonId, rateLimitType);
    if (!rateLimit.allowed) {
      // Anonymous users have a 24h cooldown; authenticated have 1h
      const retryTime = rateLimitType === "authenticated" ? "1 hour" : "24 hours";
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: retryTime,
        },
        { status: 429 }
      );
    }

    // Redact PII before any processing
    const { redacted: redactedDescription, wasRedacted } = redactPii(description);
    const { redacted: redactedTitle } = redactPii(title);

    // Generate codes
    const ticketCode = generateTicketCode();
    const trackingCode = generateTrackingCode();

    // Initial classification (fast rule-based)
    const initialAnalysis = analyzeComplaintFast(redactedDescription, category);

    // Determine SLA deadline
    const slaDeadline = calculateSlaDeadline(initialAnalysis.severity, category);

    // Save feedback as PENDING (AI will process async)
    const [newFeedback] = await db
      .insert(feedback)
      .values({
        ticketCode,
        title: redactedTitle,
        description, // Store original for now
        redactedDescription,
        category: category as any,
        severity: initialAnalysis.severity,
        sentiment: initialAnalysis.sentiment,
        sentimentScore: initialAnalysis.sentimentScore,
        language: initialAnalysis.language,
        status: "PENDING",
        isAnonymous,
        anonId,
        locationId,
        locationDetail,
        slaDeadline,
        trackingCode,
        piiRedacted: wasRedacted,
        // AI fields will be populated by background job
        aiStatus: "pending",
        priorityScore: calculateInitialPriority(initialAnalysis.severity, category, initialAnalysis.sentiment),
      })
      .returning({ id: feedback.id });

    // Handle file attachments
    if (files && files.length > 0) {
      const attachments = files.map((file) => ({
        feedbackId: newFeedback.id,
        fileName: file.name,
        fileUrl: `/uploads/${newFeedback.id}/${file.name}`,
        fileType: file.type,
        fileSize: file.size,
      }));
      await db.insert(feedbackAttachments).values(attachments);
    }

    // Create audit log
    await db.insert(auditLogs).values({
      feedbackId: newFeedback.id,
      actorId: userId,
      action: "FEEDBACK_SUBMITTED",
      details: {
        isAnonymous,
        category,
        severity: initialAnalysis.severity,
        language: initialAnalysis.language,
        piiRedacted: wasRedacted,
      },
      ipHash: hashIdentifier(headersList.get("x-forwarded-for") || "unknown"),
      userAgent: headersList.get("user-agent") || "",
    });

    // Enqueue AI processing job (in production, use QStash)
    // For now, trigger async processing
    processFeedbackAsync(newFeedback.id, redactedDescription, category);

    return NextResponse.json(
      {
        ticketCode,
        trackingCode,
        status: "PENDING",
        message: "Feedback submitted successfully. You can track it using the tracking code.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Feedback submission error:", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || process.env.NODE_ENV === "development") return true;

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const result = await response.json();
    return result.success === true;
  } catch {
    return false;
  }
}

function analyzeComplaintFast(
  text: string,
  category: string
): {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  sentimentScore: number;
  language: "EN" | "HI" | "KN" | "MAI";
} {
  const normalizedText = text.toLowerCase();

  // Language detection
  let language: "EN" | "HI" | "KN" | "MAI" = "EN";
  if (/[ऀ-ॿ]/.test(text)) {
    if (normalizedText.includes("छै") || normalizedText.includes("अहाँ")) language = "MAI";
    else language = "HI";
  } else if (/[ಀ-೿]/.test(text)) {
    language = "KN";
  }

  // Quick abuse check
  const abuseKeywords = [
    "fuck", "shit", "bastard", "idiot", "asshole", "bitch",
    "गाली", "बदतमीजी", "हरामी", "गेत्त", "ಬೋಳಿ",
  ];
  const isAbusive = abuseKeywords.some((w) => normalizedText.includes(w));

  // Category keywords for severity
  const criticalKeywords = ["harassment", "ragging", "assault", "abuse", "bullying", "rape", "fire", "suicide", "self-harm", "unsafe", "threat"];
  const highKeywords = ["broken", "urgent", "emergency", "dangerous", "security", "theft", "violence"];

  let severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";

  if (isAbusive || criticalKeywords.some((k) => normalizedText.includes(k))) {
    severity = "CRITICAL";
  } else if (highKeywords.some((k) => normalizedText.includes(k))) {
    severity = "HIGH";
  } else {
    // Check category for default severity
    const criticalCategories = ["CONFIDENTIAL_SAFETY", "SECURITY"];
    if (criticalCategories.includes(category)) severity = "HIGH";
    else severity = "MEDIUM";
  }

  // Sentiment
  const positiveWords = ["good", "great", "excellent", "solved", "happy", "thanks", "अच्छा", "धन्यवाद"];
  const negativeWords = ["bad", "worst", "broken", "dirty", "slow", "fail", "poor", "खराब", "गंदा"];

  let sentimentScore = 0;
  positiveWords.forEach((w) => {
    if (normalizedText.includes(w)) sentimentScore += 0.2;
  });
  negativeWords.forEach((w) => {
    if (normalizedText.includes(w)) sentimentScore -= 0.3;
  });

  let sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" = "NEUTRAL";
  if (sentimentScore > 0.1) sentiment = "POSITIVE";
  if (sentimentScore < -0.1) sentiment = "NEGATIVE";

  return { severity, sentiment, sentimentScore, language };
}

function calculateSlaDeadline(severity: string, category: string): Date {
  const now = new Date();
  const hoursMap: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 12,
    MEDIUM: 24,
    LOW: 72,
  };
  const hours = hoursMap[severity] || 24;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

function calculateInitialPriority(severity: string, category: string, sentiment: string): number {
  const severityScore: Record<string, number> = { CRITICAL: 100, HIGH: 70, MEDIUM: 40, LOW: 10 };
  const categoryWeight: Record<string, number> = {
    CONFIDENTIAL_SAFETY: 30, SECURITY: 25, SANITATION: 15, INFRASTRUCTURE: 10,
    HOSTEL: 15, MESS: 15, ACADEMICS: 10, SPORTS: 5, FINANCIAL: 10,
  };
  const sentimentBonus = sentiment === "NEGATIVE" ? 5 : 0;

  return (severityScore[severity] || 10) + (categoryWeight[category] || 0) + sentimentBonus;
}

// Background AI processing (triggered after response)
async function processFeedbackAsync(feedbackId: string, redactedText: string, category: string) {
  // In production, this would be enqueued via QStash
  // For now, run immediately but don't block the response
  setImmediate(async () => {
    try {
      // Import AI classifier dynamically to avoid blocking
      const { classifyWithAI } = await import("@/lib/ai");
      const result = await classifyWithAI(redactedText, category);

      // Update feedback with AI results (cast category to enum)
      await db
        .update(feedback)
        .set({
          category: result.category as any,
          subCategory: result.subCategory,
          sentiment: result.sentiment as any,
          sentimentScore: result.sentimentScore,
          severity: result.severity as any,
          isAbusive: result.isAbusive,
          abuseReason: result.abuseReason,
          language: result.language as any,
          englishTranslation: result.englishTranslation,
          summary: result.summary,
          containsPii: result.containsPii,
          aiStatus: "completed",
          aiModel: "claude-3-haiku",
          updatedAt: new Date(),
        })
        .where(eq(feedback.id, feedbackId));

      // Create status history entry
      await db.insert(statusHistory).values({
        feedbackId,
        fromStatus: "PENDING",
        toStatus: "SUBMITTED",
        reason: "AI classification completed",
      });

      // Check for critical issues that need immediate escalation
      if (result.severity === "CRITICAL" || result.isAbusive) {
        await escalateCriticalFeedback(feedbackId, result);
      }

      // Update issue clustering
      await updateIssueClustering(feedbackId, result.category, result.severity);
    } catch (error) {
      console.error("AI processing failed:", error);
      // Mark for retry
      await db
        .update(feedback)
        .set({
          aiStatus: "retry",
          updatedAt: new Date(),
        })
        .where(eq(feedback.id, feedbackId));
    }
  });
}

async function escalateCriticalFeedback(feedbackId: string, result: any) {
  // Log escalation
  await db.insert(auditLogs).values({
    feedbackId,
    action: "AUTO_ESCALATED",
    details: { reason: "Critical severity or abuse detected", ...result },
  });

  // Create escalation record
  await db.insert(escalations).values({
    feedbackId,
    fromRole: "SYSTEM" as any,
    toRole: "AUTHORITY" as any,
    reason: result.isAbusive ? "Abusive content detected" : "Critical severity classification",
  } as any);
}

async function updateIssueClustering(feedbackId: string, category: string, severity: string) {
  // Simple clustering: find existing issue with same category and similar location
  // In production, use embeddings for semantic similarity
  const existingIssues = await db
    .select()
    .from(issues)
    .where(eq(issues.category, category as any))
    .orderBy(desc(issues.priorityScore))
    .limit(5);

  // For now, just increment count on first matching issue or create new
  if (existingIssues.length > 0) {
    const issue = existingIssues[0];
    const currentPriority = issue.priorityScore || 0;
    await db
      .update(issues)
      .set({
        feedbackCount: issue.feedbackCount + 1,
        priorityScore: currentPriority + (severity === "CRITICAL" ? 20 : severity === "HIGH" ? 10 : 5),
        updatedAt: new Date(),
      })
      .where(eq(issues.id, issue.id));

    await db.update(feedback).set({ issueClusterId: issue.id }).where(eq(feedback.id, feedbackId));
  } else {
    // Create new issue cluster
    const [newIssue] = await db
      .insert(issues)
      .values({
        title: `${category} Issue Cluster`,
        category: category as any,
        feedbackCount: 1,
        priorityScore: severity === "CRITICAL" ? 100 : severity === "HIGH" ? 70 : 40,
        status: "open",
      })
      .returning({ id: issues.id });

    await db.update(feedback).set({ issueClusterId: newIssue.id }).where(eq(feedback.id, feedbackId));
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const severity = searchParams.get("severity");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query conditions
    const conditions = [];
    if (status) conditions.push(eq(feedback.status, status as any));
    if (category) conditions.push(eq(feedback.category, category as any));
    if (severity) conditions.push(eq(feedback.severity, severity as any));

    // For students, only show their own feedback via anon_id
    if (session?.user && (session.user as any).role === "STUDENT") {
      conditions.push(eq(feedback.anonId, (session.user as any).anonId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select()
      .from(feedback)
      .where(whereClause)
      .orderBy(desc(feedback.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalResult = await db.select({ count: count() }).from(feedback).where(whereClause);
    const total = totalResult[0]?.count || 0;

    return NextResponse.json({ data: result, total, limit, offset });
  } catch (error) {
    console.error("Fetch feedback error:", error);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}