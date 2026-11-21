# Student Services Feedback & Analytics

A production‑ready, university‑grade SaaS for anonymous student feedback, real‑time analytics and smart priority handling.  Built with Next.js 14, TypeScript, Tailwind CSS, Drizzle ORM, Auth.js, and a rule‑based classification engine – no paid AI.

## Features
- **QR‑based anonymous feedback submission** – minimal UI, privacy‑first.
- **Google login** with any Google account (personal Gmail works) **or college login id + password**.
- Multilingual UI (English, Hindi, Kannada, Maithili).
- Automatic sentiment, language, abuse detection, severity scoring.
- Smart complaint prioritization, duplicate detection, SLA & escalation.
- Student dashboard with ticket tracking & notifications.
- Admin dashboard with live charts, heatmap, and department performance.
- Authority dashboard for sensitive cases.
- CSV/PDF report export and public “You Said, We Did” wall.
- Audits, role‑based access, PII redaction.

## Tech Stack
- Next.js 14 (App Router) – React 18
- TypeScript (strict)
- Tailwind CSS + shadcn/ui for components
- Recharts for analytics
- PostgreSQL with Drizzle ORM
- Auth.js for secure auth
- Upstash Redis & QStash for queueing & caching
- SWR for data fetching, Zod for schema validation
- Vitest for unit tests

## Getting Started

```bash
# 1. Clone
git clone <repo-url>
cd student-services-feedback

# 2. Install
npm install

# 3. Create .env.local from example
cp .env.example .env.local
# Edit .env.local with your secrets (see Authentication below)

# 3b. Start PostgreSQL and load the schema + demo accounts (one command)
npm run db:setup

# It starts the container on localhost:5434, waits for its healthcheck, then
# applies the migrations and seeds the demo accounts. It also creates `.env`
# (POSTGRES_PASSWORD taken from DATABASE_URL) and `.env.local` from
# `.env.example` if they are missing.
#
# Step by step instead:
#   echo "POSTGRES_PASSWORD=<same-password-as-in-DATABASE_URL>" > .env
#   docker compose up -d
#   npm run db:migrate
#   npm run db:seed

# 4. Run development server
npm run dev
```

> ⚡️ Starts at `http://localhost:3000`.

### Production

```bash
npm run build
npm start
```

Deploy to any platform that supports Node.js (Vercel, Fly.io, Render, etc.).

## Directory Structure
```
├── src/
│   ├── app/                 # Next.js pages and layouts
│   │   ├── api/             # API routes
│   │   ├── auth/            # Auth pages
│   │   ├── dashboard/       # Admin/Authority dashboards
│   │   ├── submit/          # Feedback form
│   │   └── ...
│   ├── lib/
│   │   ├── db/              # Drizzle schema & db helper
│   │   ├── engine/          # Rule‑based classification engine
│   │   └── auth.ts         # Auth.js options
│   ├── components/         # UI components
│   └── utils/               # Misc helpers
├── tests/                   # Vitest unit tests
├── .env.example
└── ...
```

## Authentication

The sign-in page (`/auth/signin`) offers two ways into the portal.

### 1. Google (personal Gmail is fine)

Create an OAuth client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) with **Application type: Web application**:

- Authorised JavaScript origin: `http://localhost:3000` (and your production origin)
- Authorised redirect URI: `http://localhost:3000/api/auth/callback/google`
- Production redirect URI: `https://<your-domain>/api/auth/callback/google`

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL` and `NEXTAUTH_SECRET` in `.env.local`.

The Google Cloud project may belong to a personal Gmail account — that does not restrict who can sign in. If the OAuth consent screen is still in **Testing** mode, only accounts added under **Test users** can complete sign-in: add your Gmail there, or click **Publish app** to allow every Google account.

### 2. College login id + password

Credentials are verified against the `users` table (`college_id` + `password_hash`). Create them with:

```bash
npm run db:seed                            # demo accounts + demo campus data below
npm run auth:hash-password -- "NewPass123" # hash for your own accounts
```

Seeding also fills the rest of the demo dataset (safe to re-run, rows are upserted): 8 campus locations, 36 SLA rules (every category x severity), 14 complaints across categories/severities/languages/statuses, 4 issue clusters and 5 published "You Said, We Did" resolutions. That is enough for the admin dashboard, heatmap and analytics screens to render real numbers.

Demo accounts after seeding:

| Login | Password | Role |
| --- | --- | --- |
| `20231ST0024` | `Student@2026` | STUDENT |
| `AMS-ADMIN` | `Admin@2026` | ADMIN |

If PostgreSQL is not provisioned, the same logins can come from `COLLEGE_ACCOUNTS` in `.env.local`: a JSON array of `{ login, email, name, role, passwordHash }`. Accounts in the database always take priority. Google sign-in works even with no database configured.

### 3. Microsoft (optional)

Set `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` (and `MICROSOFT_TENANT_ID` if your college is single-tenant) to enable the Microsoft button; it stays disabled otherwise.

## Extending
- **Add new categories** – update `CATEGORY_KEYWORDS` in `src/lib/engine/classifier.ts`.
- **Custom UI theme** – modify Tailwind config and the `motionsites-` class names.
- **Report export** – add a route that queries the DB, writes CSV/PDF and returns the file.
- **Notifications** – use Upstash Redis Pub/Sub and Tailwind CSS toast notifications.

## Contributing
Pull requests are welcome. Please run `npm test` before submitting.


