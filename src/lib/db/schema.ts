import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  uuid,
  varchar,
  jsonb,
  doublePrecision,
  index,
  foreignKey,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["STUDENT", "ADMIN", "AUTHORITY", "SUPER_ADMIN"]);
export const feedbackStatusEnum = pgEnum("feedback_status", [
  "PENDING",
  "SUBMITTED",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
  "ESCALATED",
  "QUARANTINED",
]);
export const feedbackCategoryEnum = pgEnum("feedback_category", [
  "HOSTEL",
  "MESS",
  "ACADEMICS",
  "INFRASTRUCTURE",
  "SPORTS",
  "SANITATION",
  "SECURITY",
  "FINANCIAL",
  "CONFIDENTIAL_SAFETY",
]);
export const severityEnum = pgEnum("severity", ["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
export const languageEnum = pgEnum("language", ["EN", "HI", "KN", "MAI"]);
export const sentimentEnum = pgEnum("sentiment", ["POSITIVE", "NEUTRAL", "NEGATIVE"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").default("STUDENT").notNull(),
  department: text("department"),
  collegeId: text("college_id"),
  passwordHash: text("password_hash"), // scrypt hash for college (AMS) login
  image: text("image"),
  anonId: text("anon_id").notNull().unique(), // HMAC-SHA256(user_id, SERVER_SECRET)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  anonIdIdx: uniqueIndex("users_anon_id_idx").on(table.anonId),
  emailIdx: index("users_email_idx").on(table.email),
  collegeIdIdx: uniqueIndex("users_college_id_idx").on(table.collegeId),
}));

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: varchar("code", { length: 20 }).notNull().unique(), // e.g., LIB-001, HOS-A
  category: feedbackCategoryEnum("category").notNull(),
  building: text("building"),
  floor: text("floor"),
  description: text("description"),
  qrCodeUrl: text("qr_code_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  codeIdx: uniqueIndex("locations_code_idx").on(table.code),
  categoryIdx: index("locations_category_idx").on(table.category),
}));

export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketCode: varchar("ticket_code", { length: 20 }).notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(), // Original (may contain PII before redaction)
  redactedDescription: text("redacted_description"), // PII-redacted version
  category: feedbackCategoryEnum("category").notNull(),
  subCategory: text("sub_category"),
  severity: severityEnum("severity").default("LOW").notNull(),
  sentiment: sentimentEnum("sentiment").default("NEUTRAL").notNull(),
  sentimentScore: doublePrecision("sentiment_score").default(0),
  language: languageEnum("language").default("EN").notNull(),
  status: feedbackStatusEnum("status").default("PENDING").notNull(),
  isAnonymous: boolean("is_anonymous").default(true).notNull(),
  // anon_id links to users.anonId but we NEVER store user_id directly
  anonId: text("anon_id").notNull(),
  locationId: uuid("location_id").references(() => locations.id),
  locationDetail: text("location_detail"),
  // AI fields
  aiStatus: text("ai_status").default("pending"), // pending, completed, retry, failed
  aiModel: text("ai_model"),
  englishTranslation: text("english_translation"),
  summary: text("summary"),
  containsPii: boolean("contains_pii").default(false),
  piiRedacted: boolean("pii_redacted").default(false),
  abuseFlagged: boolean("abuse_flagged").default(false),
  abuseReason: text("abuse_reason"),
  isAbusive: boolean("is_abusive").default(false),
  // Priority & clustering
  priorityScore: doublePrecision("priority_score").default(0),
  issueClusterId: uuid("issue_cluster_id"), // References issues table
  // Tracking
  trackingCode: varchar("tracking_code", { length: 30 }).notNull().unique(),
  upvotes: integer("upvotes").default(0).notNull(),
  // SLA
  slaDeadline: timestamp("sla_deadline"),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  resolutionNote: text("resolution_note"),
  assignedDept: text("assigned_dept"),
  escalatedToRole: userRoleEnum("escalated_to_role"),
  // Encrypted sensitive content (for CONFIDENTIAL_SAFETY)
  encryptedContent: text("encrypted_content"),
  encryptionIv: text("encryption_iv"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  anonIdIdx: index("feedback_anon_id_idx").on(table.anonId),
  statusIdx: index("feedback_status_idx").on(table.status),
  categoryIdx: index("feedback_category_idx").on(table.category),
  severityIdx: index("feedback_severity_idx").on(table.severity),
  createdAtIdx: index("feedback_created_at_idx").on(table.createdAt),
  locationIdIdx: index("feedback_location_id_idx").on(table.locationId),
  issueClusterIdx: index("feedback_issue_cluster_idx").on(table.issueClusterId),
  priorityIdx: index("feedback_priority_idx").on(table.priorityScore),
  trackingCodeIdx: uniqueIndex("feedback_tracking_code_idx").on(table.trackingCode),
  slaDeadlineIdx: index("feedback_sla_deadline_idx").on(table.slaDeadline),
}));

export const feedbackAttachments = pgTable("feedback_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  feedbackId: uuid("feedback_id")
    .notNull()
    .references(() => feedback.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
}, (table) => ({
  feedbackIdIdx: index("attachments_feedback_id_idx").on(table.feedbackId),
}));

export const feedbackComments = pgTable("feedback_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  feedbackId: uuid("feedback_id")
    .notNull()
    .references(() => feedback.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").references(() => users.id),
  content: text("content").notNull(),
  isInternal: boolean("is_internal").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  feedbackIdIdx: index("comments_feedback_id_idx").on(table.feedbackId),
}));

export const issues = pgTable("issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  category: feedbackCategoryEnum("category").notNull(),
  locationId: uuid("location_id").references(() => locations.id),
  feedbackCount: integer("feedback_count").default(1).notNull(),
  priorityScore: doublePrecision("priority_score").default(0),
  status: text("status").default("open"), // open, investigating, resolved, closed
  assignedDept: text("assigned_dept"),
  representativeFeedbackId: uuid("representative_feedback_id").references(() => feedback.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => ({
  categoryIdx: index("issues_category_idx").on(table.category),
  statusIdx: index("issues_status_idx").on(table.status),
  locationIdx: index("issues_location_idx").on(table.locationId),
}));

export const statusHistory = pgTable("status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  feedbackId: uuid("feedback_id")
    .notNull()
    .references(() => feedback.id, { onDelete: "cascade" }),
  fromStatus: feedbackStatusEnum("from_status"),
  toStatus: feedbackStatusEnum("to_status").notNull(),
  changedBy: uuid("changed_by").references(() => users.id),
  reason: text("reason"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  feedbackIdIdx: index("status_history_feedback_id_idx").on(table.feedbackId),
}));

export const slaRules = pgTable("sla_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: feedbackCategoryEnum("category"),
  severity: severityEnum("severity"),
  acknowledgmentHours: integer("acknowledgment_hours").notNull(),
  resolutionHours: integer("resolution_hours").notNull(),
  escalationPath: jsonb("escalation_path").notNull(), // Array of roles
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  categorySeverityIdx: uniqueIndex("sla_rules_cat_sev_idx").on(table.category, table.severity),
}));

export const escalations = pgTable("escalations", {
  id: uuid("id").primaryKey().defaultRandom(),
  feedbackId: uuid("feedback_id")
    .notNull()
    .references(() => feedback.id, { onDelete: "cascade" }),
  fromRole: userRoleEnum("from_role").notNull(),
  toRole: userRoleEnum("to_role").notNull(),
  reason: text("reason"),
  slaRuleId: uuid("sla_rule_id").references(() => slaRules.id),
  acknowledged: boolean("acknowledged").default(false),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: uuid("acknowledged_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  feedbackIdIdx: index("escalations_feedback_id_idx").on(table.feedbackId),
}));

export const moderationQueue = pgTable("moderation_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  feedbackId: uuid("feedback_id")
    .notNull()
    .references(() => feedback.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(), // abusive, pii, spam, other
  flaggedBy: text("flagged_by").notNull(), // ai, user, admin
  aiConfidence: doublePrecision("ai_confidence"),
  status: text("status").default("pending"), // pending, approved, rejected
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  statusIdx: index("moderation_status_idx").on(table.status),
  feedbackIdIdx: uniqueIndex("moderation_feedback_id_idx").on(table.feedbackId),
}));

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  feedbackId: uuid("feedback_id").references(() => feedback.id),
  actorId: uuid("actor_id").references(() => users.id),
  action: text("action").notNull(),
  details: jsonb("details"),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  feedbackIdIdx: index("audit_logs_feedback_id_idx").on(table.feedbackId),
  actorIdIdx: index("audit_logs_actor_id_idx").on(table.actorId),
  timestampIdx: index("audit_logs_timestamp_idx").on(table.timestamp),
}));

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  anonId: text("anon_id"), // For anonymous tracking
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // STATUS_UPDATE, ASSIGNMENT, ESCALATION, RESOLUTION, SLA_BREACH
  isRead: boolean("is_read").default(false).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("notifications_user_id_idx").on(table.userId),
  anonIdIdx: index("notifications_anon_id_idx").on(table.anonId),
  isReadIdx: index("notifications_is_read_idx").on(table.isRead),
}));

export const publicResolutions = pgTable("public_resolutions", {
  id: uuid("id").primaryKey().defaultRandom(),
  feedbackId: uuid("feedback_id").references(() => feedback.id),
  issueId: uuid("issue_id").references(() => issues.id),
  title: text("title").notNull(),
  issue: text("issue").notNull(),
  resolution: text("resolution").notNull(),
  category: feedbackCategoryEnum("category").notNull(),
  locationName: text("location_name"),
  upvotes: integer("upvotes").default(0),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
}, (table) => ({
  publishedAtIdx: index("public_resolutions_published_idx").on(table.publishedAt),
  categoryIdx: index("public_resolutions_category_idx").on(table.category),
}));

export const weeklyInsights = pgTable("weekly_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  weekStart: timestamp("week_start").notNull(),
  weekEnd: timestamp("week_end").notNull(),
  totalFeedback: integer("total_feedback").default(0),
  byCategory: jsonb("by_category"),
  bySeverity: jsonb("by_severity"),
  byLanguage: jsonb("by_language"),
  topIssues: jsonb("top_issues"),
  sentimentTrend: jsonb("sentiment_trend"),
  slaCompliance: jsonb("sla_compliance"),
  departmentScores: jsonb("department_scores"),
  aiGeneratedSummary: text("ai_generated_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  weekIdx: uniqueIndex("weekly_insights_week_idx").on(table.weekStart),
}));

export const rateLimits = pgTable("rate_limits", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(), // anon_id or device fingerprint hash
  windowStart: timestamp("window_start").notNull(),
  requestCount: integer("request_count").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  identifierWindowIdx: uniqueIndex("rate_limits_id_window_idx").on(table.identifier, table.windowStart),
}));