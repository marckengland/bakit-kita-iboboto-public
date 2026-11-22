import { NextRequest, NextResponse } from "next/server";

/**
 * Verify a scheduled ("cron") request against CRON_SECRET.
 *
 * The secret must be supplied via the `Authorization: Bearer <CRON_SECRET>`
 * header — NOT a query string. Query-string secrets leak into server access
 * logs, browser history, and Referer headers, so they are not accepted.
 *
 * @returns a `NextResponse` (401/503) if the request is unauthorized, or
 *          `null` if the request is authorized and may proceed.
 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
