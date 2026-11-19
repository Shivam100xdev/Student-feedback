import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Paths reachable without a session. Matched per path segment: "/api/feedback"
 * covers "/api/feedback" and "/api/feedback/anything", but NOT "/api/feedback-x".
 */
const PUBLIC_PATHS = [
  "/auth", // sign-in page
  "/api/auth", // Auth.js endpoints
  "/f", // QR feedback form
  "/submit", // feedback form
  "/track", // ticket tracking
  "/resolutions", // public "You Said, We Did" page (not in the matcher, listed for clarity)
  "/api/public-resolutions", // wall list + upvote
  "/api/feedback", // public feedback submission (POST)
  "/api/locations", // public location lookup
  "/api/track", // ticket tracking API
  "/api/cron", // scheduler only - these routes require CRON_SECRET themselves
];

const isUnder = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

const isPublicPath = (path: string) => path === "/" || PUBLIC_PATHS.some((base) => isUnder(path, base));

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const role = token?.role;
    const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
    const isAuthority = role === "AUTHORITY" || role === "SUPER_ADMIN";

    // Role-based route protection
    if (isUnder(path, "/dashboard/admin") && !isAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (isUnder(path, "/dashboard/authority") && !isAuthority) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (isUnder(path, "/api/admin") && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (isUnder(path, "/api/authority") && !isAuthority) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // With no session, only the public paths above are allowed through;
      // everything else matched by `config.matcher` is redirected to sign-in.
      authorized: ({ token, req }) => Boolean(token) || isPublicPath(req.nextUrl.pathname),
    },
  },
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/:path*",
    "/submit/:path*",
    "/track/:path*",
  ],
};
