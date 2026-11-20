#!/usr/bin/env node
/**
 * Seeds the demo dataset for the AMS portal.
 * Usage: npm run db:seed   (or `npm run db:setup`, which also starts Postgres)
 *
 * Creates/updates, always in place and safe to re-run:
 *   - the demo college accounts (student + admin)
 *   - campus locations (needed by the heatmap and the feedback form)
 *   - SLA rules per category/severity (needed by the escalation cron)
 *   - demo feedback across categories, severities, languages and statuses
 *   - issue clusters and five published public resolutions
 *
 * Rows use fixed ids so re-running updates them instead of duplicating them.
 */
import { createHmac, randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

function loadEnv(file = ".env.local") {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // .env.local is optional when the variables are exported already
  }
}

const hashPassword = (password) => {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};

const anonId = (email) =>
  createHmac("sha256", process.env.SERVER_SECRET || "dev-secret-change-in-production")
    .update(email)
    .digest("hex");

loadEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env.local first.");
  process.exit(1);
}

const accounts = [
  {
    login: "20231ST0024",
    email: "20231st0024@presidencyuniversity.edu",
    name: "Aarav Sharma",
    role: "STUDENT",
    password: process.env.SEED_STUDENT_PASSWORD || "Student@2026",
  },
  {
    login: "AMS-ADMIN",
    email: "ams.admin@presidencyuniversity.edu",
    name: "AMS Administrator",
    role: "ADMIN",
    password: process.env.SEED_ADMIN_PASSWORD || "Admin@2026",
  },
];

const STUDENT_EMAIL = accounts[0].email;

// Fixed ids keep the seed idempotent (upsert instead of duplicate rows).
const LOCATION_IDS = {
  library: "a0000000-0000-4000-8000-000000000001",
  hostelA: "a0000000-0000-4000-8000-000000000002",
  mess: "a0000000-0000-4000-8000-000000000003",
  blockC: "a0000000-0000-4000-8000-000000000004",
  sports: "a0000000-0000-4000-8000-000000000005",
  gate: "a0000000-0000-4000-8000-000000000006",
  washrooms: "a0000000-0000-4000-8000-000000000007",
  fees: "a0000000-0000-4000-8000-000000000008",
};

const locations = [
  {
    id: LOCATION_IDS.library,
    code: "LIB-001",
    name: "Central Library",
    category: "ACADEMICS",
    building: "Library Block",
    floor: "2nd floor",
    description: "Reading halls, reference section and the 24x7 study zone.",
  },
  {
    id: LOCATION_IDS.hostelA,
    code: "HOS-A",
    name: "Hostel A (Boys)",
    category: "HOSTEL",
    building: "Hostel A",
    floor: "Ground to 4th floor",
    description: "Residential block A with 180 rooms and shared washrooms per floor.",
  },
  {
    id: LOCATION_IDS.mess,
    code: "MESS-01",
    name: "Main Mess Hall",
    category: "MESS",
    building: "Dining Block",
    floor: "Ground floor",
    description: "Breakfast, lunch and dinner service for resident students.",
  },
  {
    id: LOCATION_IDS.blockC,
    code: "BLK-C",
    name: "C Block Classrooms",
    category: "INFRASTRUCTURE",
    building: "C Block",
    floor: "1st to 3rd floor",
    description: "Lecture halls C-101 to C-312 and the two seminar rooms.",
  },
  {
    id: LOCATION_IDS.sports,
    code: "SPORTS-GRD",
    name: "Main Sports Ground",
    category: "SPORTS",
    building: "Sports Complex",
    floor: "Outdoor",
    description: "Cricket, football and athletics ground with the equipment store.",
  },
  {
    id: LOCATION_IDS.gate,
    code: "GATE-1",
    name: "Main Gate Security Post",
    category: "SECURITY",
    building: "Main Gate",
    floor: "Ground",
    description: "Primary campus entry, visitor desk and night patrol base.",
  },
  {
    id: LOCATION_IDS.washrooms,
    code: "SAN-B",
    name: "B Block Washrooms",
    category: "SANITATION",
    building: "B Block",
    floor: "1st floor",
    description: "Shared washrooms used by the B Block lecture halls.",
  },
  {
    id: LOCATION_IDS.fees,
    code: "FIN-OFF",
    name: "Fees & Scholarship Office",
    category: "FINANCIAL",
    building: "Admin Block",
    floor: "Ground floor",
    description: "Fee counters, refunds and scholarship disbursement desk.",
  },
];

const SLA_MATRIX = {
  CRITICAL: { ack: 1, resolution: 4, path: ["ADMIN", "AUTHORITY", "SUPER_ADMIN"] },
  HIGH: { ack: 2, resolution: 8, path: ["AUTHORITY", "ADMIN", "SUPER_ADMIN"] },
  MEDIUM: { ack: 4, resolution: 24, path: ["ADMIN", "AUTHORITY"] },
  LOW: { ack: 8, resolution: 72, path: ["ADMIN"] },
};

const CATEGORIES = [
  "HOSTEL",
  "MESS",
  "ACADEMICS",
  "INFRASTRUCTURE",
  "SPORTS",
  "SANITATION",
  "SECURITY",
  "FINANCIAL",
  "CONFIDENTIAL_SAFETY",
];

const ISSUE_IDS = {
  wifi: "c0000000-0000-4000-8000-000000000001",
  mess: "c0000000-0000-4000-8000-000000000002",
  water: "c0000000-0000-4000-8000-000000000003",
  sanitation: "c0000000-0000-4000-8000-000000000004",
};

/** daysAgo: created_at; hoursToResolve: used for sla_deadline and resolved_at. */
const feedbackSeed = [
  {
    n: 1,
    ticket: "AMS-1001",
    title: "No water supply in Hostel A since Tuesday",
    description:
      "Hostel A has had no water on the second and third floors since Tuesday morning. Students are carrying buckets from the ground floor.",
    summary: "Water supply outage on Hostel A upper floors for three days.",
    category: "HOSTEL",
    subCategory: "FACILITIES",
    severity: "HIGH",
    status: "RESOLVED",
    sentiment: "NEGATIVE",
    language: "EN",
    locationId: LOCATION_IDS.hostelA,
    daysAgo: 9,
    issueClusterId: ISSUE_IDS.water,
    assignedDept: "Hostel Maintenance",
    resolutionNote:
      "The booster pump for the upper floors was replaced and the overhead tank was cleaned. Water supply was restored the same evening.",
    upvotes: 14,
    publish: {
      title: "Hostel A water supply restored",
      issue: "Second and third floor taps in Hostel A ran dry for three days after the booster pump failed.",
      resolution:
        "Facilities replaced the booster pump and cleaned the overhead tank. Supply was restored the same evening and checked again the next morning.",
    },
  },
  {
    n: 2,
    ticket: "AMS-1002",
    title: "Mess dinner is cold and repetitive",
    description:
      "Dinner is served cold almost every day and the menu repeats the same two sabzis. Students staying back for evening labs have no hot option.",
    summary: "Cold dinners and a repeating menu at the main mess.",
    category: "MESS",
    subCategory: "FOOD_QUALITY",
    severity: "MEDIUM",
    status: "IN_PROGRESS",
    sentiment: "NEGATIVE",
    language: "EN",
    locationId: LOCATION_IDS.mess,
    daysAgo: 2,
    issueClusterId: ISSUE_IDS.mess,
    assignedDept: "Mess Committee",
  },
  {
    n: 3,
    ticket: "AMS-1003",
    title: "Library WiFi disconnects every evening",
    description:
      "The WiFi in the central library drops every evening between 7 and 9 pm, right when most of us are preparing for exams.",
    summary: "Evening WiFi outages in the central library study halls.",
    category: "INFRASTRUCTURE",
    subCategory: "WIFI",
    severity: "HIGH",
    status: "RESOLVED",
    sentiment: "NEGATIVE",
    language: "EN",
    locationId: LOCATION_IDS.library,
    daysAgo: 6,
    issueClusterId: ISSUE_IDS.wifi,
    assignedDept: "IT Services",
    resolutionNote:
      "Two faulty access points on the second floor were replaced and the library SSID now has a dedicated 200 Mbps link. No drops reported since.",
    upvotes: 23,
    publish: {
      title: "Library WiFi stable after access point replacement",
      issue: "Students lost connectivity in the library every evening between 7 and 9 pm.",
      resolution:
        "IT Services replaced two failing access points and moved the library to a dedicated 200 Mbps link. Evening drops have stopped.",
    },
  },
  {
    n: 4,
    ticket: "AMS-1004",
    title: "Lift in C Block stuck between floors",
    description:
      "The C Block lift stopped between the first and second floor yesterday with four students inside. It was opened after 20 minutes.",
    summary: "Lift entrapment in C Block; needs an immediate safety inspection.",
    category: "INFRASTRUCTURE",
    subCategory: "LIFT",
    severity: "CRITICAL",
    status: "UNDER_REVIEW",
    sentiment: "NEGATIVE",
    language: "EN",
    locationId: LOCATION_IDS.blockC,
    daysAgo: 1,
    assignedDept: "Facilities",
  },
  {
    n: 5,
    ticket: "AMS-1005",
    title: "Pathway behind the sports ground is unsafe at night",
    description:
      "The stretch between the sports ground and Hostel A has no working lights. It is completely dark after 8 pm and unsafe for students walking back.",
    summary: "Unlit pathway between the sports ground and Hostel A.",
    category: "SECURITY",
    subCategory: "UNSAFE_AREA",
    severity: "HIGH",
    status: "ESCALATED",
    sentiment: "NEGATIVE",
    language: "EN",
    locationId: LOCATION_IDS.sports,
    daysAgo: 4,
    assignedDept: "Security",
  },
  {
    n: 6,
    ticket: "AMS-1006",
    title: "B Block washrooms are not cleaned on weekends",
    description:
      "The first floor washrooms in B Block are not cleaned on Saturdays and Sundays. By Monday morning they are unusable.",
    summary: "Weekend cleaning gap in the B Block washrooms.",
    category: "SANITATION",
    subCategory: "TOILETS",
    severity: "MEDIUM",
    status: "RESOLVED",
    sentiment: "NEGATIVE",
    language: "EN",
    locationId: LOCATION_IDS.washrooms,
    daysAgo: 13,
    issueClusterId: ISSUE_IDS.sanitation,
    assignedDept: "Housekeeping",
    resolutionNote:
      "Housekeeping now runs two weekend shifts for B Block and a daily inspection sheet is signed by the supervisor.",
    upvotes: 9,
    publish: {
      title: "Weekend cleaning added for B Block washrooms",
      issue: "B Block washrooms went uncleaned from Saturday to Monday every week.",
      resolution:
        "Two weekend housekeeping shifts were added and a daily inspection sheet is now signed by the supervisor.",
    },
  },
  {
    n: 7,
    ticket: "AMS-1007",
    title: "Exam timetable clashes with the coding club workshop",
    description:
      "The end-semester timetable released yesterday overlaps with the workshop scheduled by the coding club on the 24th.",
    summary: "End-semester exam schedule clashes with a scheduled workshop.",
    category: "ACADEMICS",
    subCategory: "EXAMS",
    severity: "LOW",
    status: "PENDING",
    sentiment: "NEUTRAL",
    language: "EN",
    locationId: LOCATION_IDS.library,
    daysAgo: 0,
    assignedDept: "Examination Cell",
  },
  {
    n: 8,
    ticket: "AMS-1008",
    title: "Cricket kits missing from the sports store",
    description:
      "Only four bats are left in the sports store and the pads are torn. Inter-department matches start next week.",
    summary: "Insufficient and damaged cricket equipment before the tournament.",
    category: "SPORTS",
    subCategory: "EQUIPMENT",
    severity: "MEDIUM",
    status: "UNDER_REVIEW",
    sentiment: "NEGATIVE",
    language: "EN",
    locationId: LOCATION_IDS.sports,
    daysAgo: 2,
    assignedDept: "Sports Committee",
  },
  {
    n: 9,
    ticket: "AMS-1009",
    title: "Scholarship amount not credited this semester",
    description:
      "The merit scholarship for this semester has not reached my account even though the office confirmed the file was cleared last month.",
    summary: "Merit scholarship disbursement delayed by more than a month.",
    category: "FINANCIAL",
    subCategory: "SCHOLARSHIP",
    severity: "HIGH",
    status: "IN_PROGRESS",
    sentiment: "NEGATIVE",
    language: "EN",
    locationId: LOCATION_IDS.fees,
    daysAgo: 7,
    assignedDept: "Accounts",
  },
  {
    n: 10,
    ticket: "AMS-1010",
    title: "Stale paneer served at lunch",
    description:
      "The paneer at lunch yesterday had a sour smell and two students fell sick in the afternoon. The kitchen needs an inspection.",
    summary: "Suspect food quality at the main mess; two students fell ill.",
    category: "MESS",
    subCategory: "HYGIENE",
    severity: "HIGH",
    status: "RESOLVED",
    sentiment: "NEGATIVE",
    language: "EN",
    locationId: LOCATION_IDS.mess,
    daysAgo: 16,
    issueClusterId: ISSUE_IDS.mess,
    assignedDept: "Mess Committee",
    resolutionNote:
      "The kitchen was inspected, the supplier was changed and daily temperature logs are now recorded for dairy items.",
    upvotes: 31,
    publish: {
      title: "Mess dairy supplier changed after inspection",
      issue: "Stale paneer was served at lunch; two students reported feeling unwell.",
      resolution:
        "A joint inspection was carried out, the dairy supplier was replaced and daily temperature logs are now maintained.",
    },
  },
  {
    n: 11,
    ticket: "AMS-1011",
    title: "Warden not responding to room change requests",
    description:
      "I submitted a room change request three weeks ago and the hostel office has not replied even after two follow-ups.",
    summary: "Unanswered room change request at Hostel A.",
    category: "HOSTEL",
    subCategory: "WARDEN",
    severity: "MEDIUM",
    status: "SUBMITTED",
    sentiment: "NEGATIVE",
    language: "EN",
    locationId: LOCATION_IDS.hostelA,
    daysAgo: 1,
    issueClusterId: ISSUE_IDS.water,
    assignedDept: "Hostel Maintenance",
  },
  {
    n: 12,
    ticket: "AMS-1012",
    title: "Library me chai aur snacks ki suvidha chahiye",
    description:
      "Library me padhai ke dauran chai aur snacks nahi milte. Ek chhota canteen counter khola jaye to students ko madad milegi.",
    summary: "Request for a small snack counter inside the library.",
    category: "ACADEMICS",
    subCategory: "LIBRARY",
    severity: "LOW",
    status: "SUBMITTED",
    sentiment: "POSITIVE",
    language: "HI",
    englishTranslation:
      "A small tea and snack counter should be opened inside the library for students studying there.",
    locationId: LOCATION_IDS.library,
    daysAgo: 3,
    assignedDept: "Library Committee",
  },
  {
    n: 13,
    ticket: "AMS-1013",
    title: "Projector in C-204 has been broken for two weeks",
    description:
      "The projector in C-204 has not worked for two weeks. Lectures are being taken on the whiteboard without slides.",
    summary: "Projector failure in lecture hall C-204 for two weeks.",
    category: "INFRASTRUCTURE",
    subCategory: "BUILDING",
    severity: "MEDIUM",
    status: "IN_PROGRESS",
    sentiment: "NEGATIVE",
    language: "EN",
    locationId: LOCATION_IDS.blockC,
    daysAgo: 5,
    assignedDept: "IT Services",
  },
  {
    n: 14,
    ticket: "AMS-1014",
    title: "Overflowing dustbins near the mess entrance",
    description:
      "The dustbins outside the mess overflow every evening and stray dogs scatter the waste. It needs a second collection round.",
    summary: "Overflowing waste bins outside the mess each evening.",
    category: "SANITATION",
    subCategory: "WASTE",
    severity: "MEDIUM",
    status: "RESOLVED",
    sentiment: "NEGATIVE",
    language: "EN",
    locationId: LOCATION_IDS.mess,
    daysAgo: 19,
    issueClusterId: ISSUE_IDS.sanitation,
    assignedDept: "Housekeeping",
    resolutionNote:
      "A second evening collection round was added and two covered bins were installed near the mess entrance.",
    upvotes: 6,
    publish: {
      title: "Second waste collection round added near the mess",
      issue: "Bins outside the mess overflowed every evening and waste was scattered by stray animals.",
      resolution:
        "Housekeeping added an evening collection round and installed two covered bins at the entrance.",
    },
  },
];

const issueClusters = [
  {
    id: ISSUE_IDS.water,
    title: "Hostel A water supply interruptions",
    description: "Repeated water outages and delayed maintenance response in Hostel A.",
    category: "HOSTEL",
    locationId: LOCATION_IDS.hostelA,
    feedbackCount: 2,
    priorityScore: 82,
    status: "investigating",
    assignedDept: "Hostel Maintenance",
    representative: 1,
  },
  {
    id: ISSUE_IDS.mess,
    title: "Mess food quality and hygiene",
    description: "Cold food, a repeating menu and one spoiled-dairy incident at the main mess.",
    category: "MESS",
    locationId: LOCATION_IDS.mess,
    feedbackCount: 2,
    priorityScore: 74,
    status: "investigating",
    assignedDept: "Mess Committee",
    representative: 10,
  },
  {
    id: ISSUE_IDS.wifi,
    title: "Library WiFi connectivity",
    description: "Evening outages in the library study halls during exam preparation.",
    category: "INFRASTRUCTURE",
    locationId: LOCATION_IDS.library,
    feedbackCount: 1,
    priorityScore: 68,
    status: "resolved",
    assignedDept: "IT Services",
    representative: 3,
  },
  {
    id: ISSUE_IDS.sanitation,
    title: "Washroom and waste sanitation lapses",
    description: "Missed weekend cleaning and overflowing bins at high-traffic locations.",
    category: "SANITATION",
    locationId: LOCATION_IDS.washrooms,
    feedbackCount: 2,
    priorityScore: 55,
    status: "resolved",
    assignedDept: "Housekeeping",
    representative: 6,
  },
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const feedbackId = (n) => `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const resolutionId = (n) => `d0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const daysAgoDate = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const hoursLater = (date, hours) => new Date(date.getTime() + hours * 60 * 60 * 1000);

try {
  await client.connect();
  await client.query("begin");

  for (const account of accounts) {
    await client.query(
      `insert into users (email, name, role, college_id, anon_id, password_hash)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (email) do update
         set name = excluded.name,
             role = excluded.role,
             college_id = excluded.college_id,
             password_hash = excluded.password_hash,
             updated_at = now()`,
      [account.email, account.name, account.role, account.login, anonId(account.email), hashPassword(account.password)],
    );
    console.log(`✓ ${account.login} (${account.role}) ready`);
  }

  const studentAnonId = anonId(STUDENT_EMAIL);

  for (const location of locations) {
    await client.query(
      `insert into locations (id, code, name, category, building, floor, description, qr_code_url, is_active)
       values ($1, $2, $3, $4, $5, $6, $7, $8, true)
       on conflict (id) do update
         set code = excluded.code,
             name = excluded.name,
             category = excluded.category,
             building = excluded.building,
             floor = excluded.floor,
             description = excluded.description,
             qr_code_url = excluded.qr_code_url,
             updated_at = now()`,
      [
        location.id,
        location.code,
        location.name,
        location.category,
        location.building,
        location.floor,
        location.description,
        `/f/${location.code}`,
      ],
    );
  }
  console.log(`✓ ${locations.length} campus locations ready`);

  let slaCount = 0;
  for (const category of CATEGORIES) {
    for (const [severity, rule] of Object.entries(SLA_MATRIX)) {
      await client.query(
        `insert into sla_rules (category, severity, acknowledgment_hours, resolution_hours, escalation_path, is_active)
         values ($1, $2, $3, $4, $5::jsonb, true)
         on conflict (category, severity) do update
           set acknowledgment_hours = excluded.acknowledgment_hours,
               resolution_hours = excluded.resolution_hours,
               escalation_path = excluded.escalation_path,
               is_active = true,
               updated_at = now()`,
        [category, severity, rule.ack, rule.resolution, JSON.stringify(rule.path)],
      );
      slaCount++;
    }
  }
  console.log(`✓ ${slaCount} SLA rules ready`);

  for (const item of feedbackSeed) {
    const createdAt = daysAgoDate(item.daysAgo);
    const rule = SLA_MATRIX[item.severity];
    const slaDeadline = hoursLater(createdAt, rule.resolution);
    const resolvedAt = item.status === "RESOLVED" ? hoursLater(createdAt, Math.min(rule.resolution, 20)) : null;

    await client.query(
      `insert into feedback (
         id, ticket_code, tracking_code, title, description, redacted_description,
         category, sub_category, severity, sentiment, sentiment_score, language, status,
         is_anonymous, anon_id, location_id, ai_status, summary, english_translation,
         priority_score, issue_cluster_id, sla_deadline, resolved_at, resolution_note,
         assigned_dept, created_at, updated_at
       ) values (
         $1, $2, $3, $4, $5, $5,
         $6, $7, $8, $9, $10, $11, $12,
         true, $13, $14, 'completed', $15, $16,
         $17, $18, $19, $20, $21,
         $22, $23, $23
       )
       on conflict (id) do update
         set title = excluded.title,
             description = excluded.description,
             redacted_description = excluded.redacted_description,
             category = excluded.category,
             sub_category = excluded.sub_category,
             severity = excluded.severity,
             sentiment = excluded.sentiment,
             sentiment_score = excluded.sentiment_score,
             language = excluded.language,
             status = excluded.status,
             location_id = excluded.location_id,
             summary = excluded.summary,
             english_translation = excluded.english_translation,
             priority_score = excluded.priority_score,
             issue_cluster_id = excluded.issue_cluster_id,
             sla_deadline = excluded.sla_deadline,
             resolved_at = excluded.resolved_at,
             resolution_note = excluded.resolution_note,
             assigned_dept = excluded.assigned_dept,
             updated_at = now()`,
      [
        feedbackId(item.n),
        item.ticket,
        `TRK-${item.ticket.replace("AMS-", "")}-DEMO`,
        item.title,
        item.description,
        item.category,
        item.subCategory ?? null,
        item.severity,
        item.sentiment,
        item.sentiment === "NEGATIVE" ? -0.45 : item.sentiment === "POSITIVE" ? 0.4 : 0,
        item.language,
        item.status,
        studentAnonId,
        item.locationId ?? null,
        item.summary,
        item.englishTranslation ?? null,
        item.severity === "CRITICAL" ? 100 : item.severity === "HIGH" ? 70 : item.severity === "MEDIUM" ? 40 : 20,
        item.issueClusterId ?? null,
        slaDeadline,
        resolvedAt,
        item.resolutionNote ?? null,
        item.assignedDept ?? null,
        createdAt,
      ],
    );
  }
  console.log(`✓ ${feedbackSeed.length} demo feedback items ready`);

  for (const issue of issueClusters) {
    await client.query(
      `insert into issues (id, title, description, category, location_id, feedback_count, priority_score,
                           status, assigned_dept, representative_feedback_id, resolved_at, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now() - interval '10 days', now())
       on conflict (id) do update
         set title = excluded.title,
             description = excluded.description,
             category = excluded.category,
             location_id = excluded.location_id,
             feedback_count = excluded.feedback_count,
             priority_score = excluded.priority_score,
             status = excluded.status,
             assigned_dept = excluded.assigned_dept,
             representative_feedback_id = excluded.representative_feedback_id,
             resolved_at = excluded.resolved_at,
             updated_at = now()`,
      [
        issue.id,
        issue.title,
        issue.description,
        issue.category,
        issue.locationId,
        issue.feedbackCount,
        issue.priorityScore,
        issue.status,
        issue.assignedDept,
        feedbackId(issue.representative),
        issue.status === "resolved" ? daysAgoDate(4) : null,
      ],
    );
  }
  console.log(`✓ ${issueClusters.length} issue clusters ready`);

  let published = 0;
  for (const item of feedbackSeed) {
    if (!item.publish) continue;

    const publishedAt = hoursLater(daysAgoDate(item.daysAgo), 26);
    const locationName = locations.find((l) => l.id === item.locationId)?.name ?? null;

    await client.query(
      `insert into public_resolutions (
         id, feedback_id, issue_id, title, issue, resolution, category, location_name, upvotes, published_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (id) do update
         set feedback_id = excluded.feedback_id,
             issue_id = excluded.issue_id,
             title = excluded.title,
             issue = excluded.issue,
             resolution = excluded.resolution,
             category = excluded.category,
             location_name = excluded.location_name`,
      [
        resolutionId(item.n),
        feedbackId(item.n),
        item.issueClusterId ?? null,
        item.publish.title,
        item.publish.issue,
        item.publish.resolution,
        item.category,
        locationName,
        item.upvotes ?? 0,
        publishedAt,
      ],
    );
    published++;
  }
  console.log(`✓ ${published} public resolutions ready`);

  await client.query("commit");
  console.log("\n✅ Demo data seeded. Run `npm run dev` and sign in as 20231ST0024 or AMS-ADMIN.");
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error("Seeding failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
