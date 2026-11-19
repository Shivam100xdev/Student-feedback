import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Role-based route protection - handle null token
    if (path.startsWith("/dashboard/admin")) {
      if (!token || token.role !== "ADMIN" && token.role !== "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    if (path.startsWith("/dashboard/authority")) {
      if (!token || token.role !== "AUTHORITY" && token.role !== "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // API route protection
    if (path.startsWith("/api/admin")) {
      if (!token || token.role !== "ADMIN" && token.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (path.startsWith("/api/authority")) {
      if (!token || token.role !== "AUTHORITY" && token.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;

        // Public routes
        if (
          path === "/" ||
          path.startsWith("/auth/") ||
          path.startsWith("/api/auth/") ||
          path.startsWith("/f/") || // QR feedback form
          path.startsWith("/submit") ||
          path.startsWith("/track") ||
          path.startsWith("/resolutions") ||
          path.startsWith("/api/feedback") || // Public feedback submission
          path.startsWith("/api/locations") || // Public location lookup
          path.startsWith("/api/track") // Ticket tracking
        ) {
          return true;
        }

        // Protected routes require authentication - but only if token exists
        if (!token) {
          return false;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/:path*",
    "/submit/:path*",
    "/track/:path*",
  ],
};