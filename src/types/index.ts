export type UserRole = 'STUDENT' | 'ADMIN' | 'AUTHORITY' | 'SUPER_ADMIN';
export type FeedbackStatus = 'PENDING' | 'SUBMITTED' | 'UNDER_REVIEW' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED' | 'ESCALATED' | 'QUARANTINED';
export type FeedbackCategory = 'HOSTEL' | 'MESS' | 'ACADEMICS' | 'INFRASTRUCTURE' | 'SPORTS' | 'SANITATION' | 'SECURITY' | 'FINANCIAL' | 'CONFIDENTIAL_SAFETY';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type Language = 'EN' | 'HI' | 'KN' | 'MAI';
export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface User {
  id: string;
  name?: string | null;
  email: string;
  role?: UserRole;
  department?: string | null;
  collegeId?: string | null;
  image?: string | null;
  anonId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Feedback {
  id: string;
  ticketCode: string;
  trackingCode: string;
  title: string;
  description: string;
  redactedDescription?: string | null;
  category: FeedbackCategory;
  subCategory?: string | null;
  severity: Severity;
  sentiment: Sentiment;
  sentimentScore?: number | null;
  language: Language;
  status: FeedbackStatus;
  isAnonymous: boolean;
  // anon_id links to users.anonId but we NEVER store user_id directly
  anonId: string;
  locationId?: string | null;
  locationDetail?: string | null;
  // AI fields
  aiStatus?: string | null;
  aiModel?: string | null;
  englishTranslation?: string | null;
  summary?: string | null;
  containsPii?: boolean | null;
  piiRedacted?: boolean | null;
  abuseFlagged?: boolean | null;
  abuseReason?: string | null;
  isAbusive?: boolean | null;
  // Priority & clustering
  priorityScore?: number | null;
  issueClusterId?: string | null;
  // SLA
  slaDeadline?: Date | null;
  acknowledgedAt?: Date | null;
  resolvedAt?: Date | null;
  resolutionNote?: string | null;
  assignedDept?: string | null;
  escalatedToRole?: UserRole | null;
  // Encrypted sensitive content (for CONFIDENTIAL_SAFETY)
  encryptedContent?: string | null;
  encryptionIv?: string | null;
  upvotes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  feedbackId?: string | null;
  actorId?: string | null;
  action: string;
  details?: Record<string, unknown> | null;
  ipHash?: string | null;
  userAgent?: string | null;
  timestamp: Date;
}

export interface Notification {
  id: string;
  userId?: string | null;
  anonId?: string | null;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

export interface PublicResolution {
  id: string;
  feedbackId?: string | null;
  issueId?: string | null;
  title: string;
  issue: string;
  resolution: string;
  category: FeedbackCategory;
  locationName?: string | null;
  upvotes: number;
  publishedAt: Date;
}

export interface Issue {
  id: string;
  title: string;
  description?: string | null;
  category: FeedbackCategory;
  locationId?: string | null;
  feedbackCount: number;
  priorityScore: number;
  status: string;
  assignedDept?: string | null;
  representativeFeedbackId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date | null;
}

export interface SlaRule {
  id: string;
  category?: FeedbackCategory | null;
  severity?: Severity | null;
  acknowledgmentHours: number;
  resolutionHours: number;
  escalationPath: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Escalation {
  id: string;
  feedbackId: string;
  fromRole: UserRole;
  toRole: UserRole;
  reason?: string | null;
  slaRuleId?: string | null;
  acknowledged: boolean;
  acknowledgedAt?: Date | null;
  acknowledgedBy?: string | null;
  createdAt: Date;
}

export interface Location {
  id: string;
  name: string;
  code: string;
  category: FeedbackCategory;
  building?: string | null;
  floor?: string | null;
  description?: string | null;
  qrCodeUrl?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WeeklyInsights {
  id: string;
  weekStart: Date;
  weekEnd: Date;
  totalFeedback: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  byLanguage: Record<string, number>;
  topIssues: any[];
  sentimentTrend: any[];
  slaCompliance: any;
  departmentScores: any[];
  aiGeneratedSummary?: string | null;
  createdAt: Date;
}

export interface RateLimit {
  id: string;
  identifier: string;
  windowStart: Date;
  requestCount: number;
  createdAt: Date;
}