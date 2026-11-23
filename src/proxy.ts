/**
 * Next.js Proxy (formerly "middleware" — renamed in Next.js 16).
 *
 * Purpose: lock down the entire admin surface by default.
 *
 * The admin area (`/admin/*` pages and `/api/admin/*` routes) is a work in
 * progress: it is NOT protected by real authentication yet (see SECURITY.md).
 * To avoid exposing it on a fresh clone/deploy, the whole surface is disabled
 * unless `ADMIN_ENABLED=true` is set in a non-production environment. When
 * disabled, both pages and API routes return 404 so the surface is not even
 * discoverable.
 *
 * Production always returns 404 until proper administrator authentication
 * (login against AdminUser + session role checks) is implemented.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isLocalAdminEnabled } from "@/lib/admin-access";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const admin =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/");
  if (!admin) {
    const unsupported = ["auth", "bookmarks", "voting-list", "notifications", "reports", "cron"];
    const sessionProbe = pathname === "/api/auth/profile" && request.method === "GET";
    const denied =
      !sessionProbe &&
      (pathname === "/api/chatbot" ||
        unsupported.some(
          (part) => pathname === `/api/${part}` || pathname.startsWith(`/api/${part}/`)
        ));
    if (process.env.NODE_ENV === "production" && denied) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.next();
  }
  if (isLocalAdminEnabled()) {
    return NextResponse.next();
  }

  // API routes: return a JSON 404.
  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Admin pages: return a plain 404 so the surface is not discoverable.
  return new NextResponse("Not found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
