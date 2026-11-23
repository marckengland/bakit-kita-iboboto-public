import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/services/auth.service";
import { readBoundedJson, RequestBodyError } from "@/lib/request-body";
import { reservePublicRequest } from "@/lib/public-request-budget";
import { checkRateLimit, getRateLimitStatus, recordRequest } from "@/services/rate-limit.service";
import { answerFromReviewedRecords } from "@/services/reviewed-chat.service";
import {
  answerFromSenateFilings,
  shouldSearchSenateFilings,
  caseQuestion,
} from "@/services/senate-chat.service";

export async function POST(request: NextRequest) {
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  let body: Record<string, unknown>;
  try {
    const value = await readBoundedJson(request, 16 * 1024);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new RequestBodyError(400);
    }
    body = value as Record<string, unknown>;
  } catch (error) {
    return json({ error: "Invalid JSON" }, error instanceof RequestBodyError ? error.status : 400);
  }
  if (
    !body ||
    Array.isArray(body) ||
    typeof body.message !== "string" ||
    !body.message.trim() ||
    body.message.length > 2000 ||
    (body.selectionScope !== undefined &&
      (typeof body.selectionScope !== "string" ||
        !["cases", "senate_filings"].includes(body.selectionScope))) ||
    (body.scope !== undefined &&
      (typeof body.scope !== "string" ||
        !["auto", "cases", "senate_filings"].includes(body.scope))) ||
    (body.politicianId !== undefined &&
      (typeof body.politicianId !== "string" ||
        !body.politicianId.trim() ||
        body.politicianId.length > 200))
  ) {
    return json(
      { error: "Provide a message of 1–2000 characters and an optional valid profile ID." },
      400
    );
  }
  try {
    const token = (await cookies()).get("auth_token")?.value;
    let userId: string | null = null;
    if (token) {
      try {
        userId = (await validateSession(token)).userId;
      } catch {
        /* Anonymous limits apply. */
      }
    }
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const authenticated = userId !== null;
    const sharedBudget = await reservePublicRequest(request, "records", userId);
    const limit = sharedBudget ?? checkRateLimit(userId, ip, authenticated);
    const serializeLimit = (value: ReturnType<typeof getRateLimitStatus>) => ({
      remaining: value.remaining,
      resetAt: value.resetAt.toISOString(),
      isBlocked: value.isBlocked,
    });
    if (!limit.allowed) {
      return json({ error: "Rate limit exceeded", rateLimitStatus: serializeLimit(limit) }, 429);
    }
    // Count requests without retaining query text or creating conversation messages.
    if (!sharedBudget) {
      recordRequest(userId, ip, authenticated);
    }
    const query = { message: body.message.trim(), politicianId: body.politicianId?.trim() };
    const automatic = body.scope !== "cases" && body.scope !== "senate_filings";
    const senateScope =
      body.scope === "senate_filings" ||
      (automatic &&
        !caseQuestion.test(query.message) &&
        (shouldSearchSenateFilings({ message: query.message }) ||
          body.selectionScope === "senate_filings" ||
          (!body.selectionScope && shouldSearchSenateFilings(query))));
    if (
      automatic &&
      body.selectionScope &&
      body.selectionScope !== (senateScope ? "senate_filings" : "cases")
    ) {
      query.politicianId = undefined;
    }
    const answer = await (senateScope
      ? answerFromSenateFilings(query)
      : answerFromReviewedRecords(query));
    return json({
      answer,
      rateLimitStatus: serializeLimit(
        sharedBudget ?? getRateLimitStatus(userId, ip, authenticated)
      ),
    });
  } catch {
    console.error("Reviewed chat: request unavailable");
    return json({ error: "Reviewed research is temporarily unavailable" }, 503);
  }
}
