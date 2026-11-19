CREATE TYPE "public"."feedback_category" AS ENUM('HOSTEL', 'MESS', 'ACADEMICS', 'INFRASTRUCTURE', 'SPORTS', 'SANITATION', 'SECURITY', 'FINANCIAL', 'CONFIDENTIAL_SAFETY');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'ESCALATED', 'QUARANTINED');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('EN', 'HI', 'KN', 'MAI');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('POSITIVE', 'NEUTRAL', 'NEGATIVE');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('STUDENT', 'ADMIN', 'AUTHORITY', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid,
	"actor_id" uuid,
	"action" text NOT NULL,
	"details" jsonb,
	"ip_hash" text,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid NOT NULL,
	"from_role" "user_role" NOT NULL,
	"to_role" "user_role" NOT NULL,
	"reason" text,
	"sla_rule_id" uuid,
	"acknowledged" boolean DEFAULT false,
	"acknowledged_at" timestamp,
	"acknowledged_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_code" varchar(20) NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"redacted_description" text,
	"category" "feedback_category" NOT NULL,
	"sub_category" text,
	"severity" "severity" DEFAULT 'LOW' NOT NULL,
	"sentiment" "sentiment" DEFAULT 'NEUTRAL' NOT NULL,
	"sentiment_score" double precision DEFAULT 0,
	"language" "language" DEFAULT 'EN' NOT NULL,
	"status" "feedback_status" DEFAULT 'PENDING' NOT NULL,
	"is_anonymous" boolean DEFAULT true NOT NULL,
	"anon_id" text NOT NULL,
	"location_id" uuid,
	"location_detail" text,
	"ai_status" text DEFAULT 'pending',
	"ai_model" text,
	"english_translation" text,
	"summary" text,
	"contains_pii" boolean DEFAULT false,
	"pii_redacted" boolean DEFAULT false,
	"abuse_flagged" boolean DEFAULT false,
	"abuse_reason" text,
	"is_abusive" boolean DEFAULT false,
	"priority_score" double precision DEFAULT 0,
	"issue_cluster_id" uuid,
	"tracking_code" varchar(30) NOT NULL,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"sla_deadline" timestamp,
	"acknowledged_at" timestamp,
	"resolved_at" timestamp,
	"resolution_note" text,
	"assigned_dept" text,
	"escalated_to_role" "user_role",
	"encrypted_content" text,
	"encryption_iv" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_ticket_code_unique" UNIQUE("ticket_code"),
	CONSTRAINT "feedback_tracking_code_unique" UNIQUE("tracking_code")
);
--> statement-breakpoint
CREATE TABLE "feedback_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid NOT NULL,
	"author_id" uuid,
	"content" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" "feedback_category" NOT NULL,
	"location_id" uuid,
	"feedback_count" integer DEFAULT 1 NOT NULL,
	"priority_score" double precision DEFAULT 0,
	"status" text DEFAULT 'open',
	"assigned_dept" text,
	"representative_feedback_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" varchar(20) NOT NULL,
	"category" "feedback_category" NOT NULL,
	"building" text,
	"floor" text,
	"description" text,
	"qr_code_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "locations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "moderation_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"flagged_by" text NOT NULL,
	"ai_confidence" double precision,
	"status" text DEFAULT 'pending',
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"anon_id" text,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid,
	"issue_id" uuid,
	"title" text NOT NULL,
	"issue" text NOT NULL,
	"resolution" text NOT NULL,
	"category" "feedback_category" NOT NULL,
	"location_name" text,
	"upvotes" integer DEFAULT 0,
	"published_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"window_start" timestamp NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "feedback_category",
	"severity" "severity",
	"acknowledgment_hours" integer NOT NULL,
	"resolution_hours" integer NOT NULL,
	"escalation_path" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid NOT NULL,
	"from_status" "feedback_status",
	"to_status" "feedback_status" NOT NULL,
	"changed_by" uuid,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'STUDENT' NOT NULL,
	"department" text,
	"college_id" text,
	"image" text,
	"anon_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_anon_id_unique" UNIQUE("anon_id")
);
--> statement-breakpoint
CREATE TABLE "weekly_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start" timestamp NOT NULL,
	"week_end" timestamp NOT NULL,
	"total_feedback" integer DEFAULT 0,
	"by_category" jsonb,
	"by_severity" jsonb,
	"by_language" jsonb,
	"top_issues" jsonb,
	"sentiment_trend" jsonb,
	"sla_compliance" jsonb,
	"department_scores" jsonb,
	"ai_generated_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_sla_rule_id_sla_rules_id_fk" FOREIGN KEY ("sla_rule_id") REFERENCES "public"."sla_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_attachments" ADD CONSTRAINT "feedback_attachments_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_comments" ADD CONSTRAINT "feedback_comments_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_comments" ADD CONSTRAINT "feedback_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_representative_feedback_id_feedback_id_fk" FOREIGN KEY ("representative_feedback_id") REFERENCES "public"."feedback"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_queue" ADD CONSTRAINT "moderation_queue_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_queue" ADD CONSTRAINT "moderation_queue_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_resolutions" ADD CONSTRAINT "public_resolutions_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_resolutions" ADD CONSTRAINT "public_resolutions_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_feedback_id_idx" ON "audit_logs" USING btree ("feedback_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "escalations_feedback_id_idx" ON "escalations" USING btree ("feedback_id");--> statement-breakpoint
CREATE INDEX "feedback_anon_id_idx" ON "feedback" USING btree ("anon_id");--> statement-breakpoint
CREATE INDEX "feedback_status_idx" ON "feedback" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feedback_category_idx" ON "feedback" USING btree ("category");--> statement-breakpoint
CREATE INDEX "feedback_severity_idx" ON "feedback" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "feedback_created_at_idx" ON "feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feedback_location_id_idx" ON "feedback" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "feedback_issue_cluster_idx" ON "feedback" USING btree ("issue_cluster_id");--> statement-breakpoint
CREATE INDEX "feedback_priority_idx" ON "feedback" USING btree ("priority_score");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_tracking_code_idx" ON "feedback" USING btree ("tracking_code");--> statement-breakpoint
CREATE INDEX "feedback_sla_deadline_idx" ON "feedback" USING btree ("sla_deadline");--> statement-breakpoint
CREATE INDEX "attachments_feedback_id_idx" ON "feedback_attachments" USING btree ("feedback_id");--> statement-breakpoint
CREATE INDEX "comments_feedback_id_idx" ON "feedback_comments" USING btree ("feedback_id");--> statement-breakpoint
CREATE INDEX "issues_category_idx" ON "issues" USING btree ("category");--> statement-breakpoint
CREATE INDEX "issues_status_idx" ON "issues" USING btree ("status");--> statement-breakpoint
CREATE INDEX "issues_location_idx" ON "issues" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_code_idx" ON "locations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "locations_category_idx" ON "locations" USING btree ("category");--> statement-breakpoint
CREATE INDEX "moderation_status_idx" ON "moderation_queue" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_feedback_id_idx" ON "moderation_queue" USING btree ("feedback_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_anon_id_idx" ON "notifications" USING btree ("anon_id");--> statement-breakpoint
CREATE INDEX "notifications_is_read_idx" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "public_resolutions_published_idx" ON "public_resolutions" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "public_resolutions_category_idx" ON "public_resolutions" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limits_id_window_idx" ON "rate_limits" USING btree ("identifier","window_start");--> statement-breakpoint
CREATE UNIQUE INDEX "sla_rules_cat_sev_idx" ON "sla_rules" USING btree ("category","severity");--> statement-breakpoint
CREATE INDEX "status_history_feedback_id_idx" ON "status_history" USING btree ("feedback_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_anon_id_idx" ON "users" USING btree ("anon_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_insights_week_idx" ON "weekly_insights" USING btree ("week_start");