import { redis } from "@/lib/redis";

const categories = {
  security: "Security report",
  privacy: "Privacy request",
  correction: "Profile correction",
  general: "General message",
} as const;

const MAX_BYTES = 16 * 1024;
const SEND_LIMIT = 20;
const WINDOW_SECONDS = 3600;
const reserveBudget = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], 3600) end
return count
`;

function emailAddress(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function configuration() {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.PRIVATE_CONTACT_FROM?.trim();
  const to = process.env.PRIVATE_CONTACT_TO?.trim();
  const origin = process.env.PRIVATE_CONTACT_ORIGIN?.trim();
  if (
    process.env.PRIVATE_CONTACT_ENABLED !== "true" ||
    !key ||
    !from ||
    /[\r\n]/.test(from) ||
    !to ||
    !emailAddress(to) ||
    !origin ||
    !process.env.REDIS_URL?.trim() ||
    process.env.REDIS_DISABLED === "true" ||
    !redis
  ) {
    return null;
  }
  try {
    const url = new URL(origin);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.origin !== origin ||
      (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return { key, from, to, origin };
}

export function privateContactAvailable(): boolean {
  return configuration() !== null;
}

function response(status: number, error: string, headers: Record<string, string> = {}) {
  return Response.json({ error }, { status, headers: { "cache-control": "no-store", ...headers } });
}

class BodyError extends Error {
  constructor(readonly status: number) {
    super("Invalid report body");
  }
}

async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > MAX_BYTES) {
    throw new BodyError(413);
  }
  if (!request.body) {
    throw new BodyError(400);
  }
  const reader = request.body.getReader();
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    void reader.cancel().catch(() => undefined);
  }, 5000);
  try {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (expired) {
        throw new BodyError(408);
      }
      if (done) {
        break;
      }
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        throw new BodyError(413);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

function validate(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const fields = value as Record<string, unknown>;
  const allowed = ["category", "message", "profileUrl", "replyEmail", "requestId"];
  if (Object.keys(fields).some((key) => !allowed.includes(key))) {
    return null;
  }
  const { category, requestId, message } = fields;
  if (
    typeof category !== "string" ||
    !Object.hasOwn(categories, category) ||
    typeof requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId) ||
    typeof message !== "string" ||
    message.trim().length < 10 ||
    message.length > 4000
  ) {
    return null;
  }
  if (fields.replyEmail !== undefined && typeof fields.replyEmail !== "string") {
    return null;
  }
  const replyEmail = (fields.replyEmail as string | undefined)?.trim();
  if (replyEmail && !emailAddress(replyEmail)) {
    return null;
  }
  if (fields.profileUrl !== undefined && typeof fields.profileUrl !== "string") {
    return null;
  }
  const profileUrl = (fields.profileUrl as string | undefined)?.trim();
  if (profileUrl) {
    if (profileUrl.length > 1000) {
      return null;
    }
    try {
      if (!["https:", "http:"].includes(new URL(profileUrl).protocol)) {
        return null;
      }
    } catch {
      return null;
    }
  }
  return {
    category: category as keyof typeof categories,
    requestId,
    message: message.trim(),
    replyEmail,
    profileUrl,
  };
}

export async function handlePrivateContact(request: Request): Promise<Response> {
  const config = configuration();
  if (!config) {
    return response(503, "Private contact is not available on this installation.");
  }
  if (request.headers.get("origin") !== config.origin) {
    return response(403, "Invalid request origin.");
  }
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") {
    return response(415, "Use a JSON request.");
  }
  let data: ReturnType<typeof validate>;
  try {
    data = validate(await readBody(request));
  } catch (error) {
    const status = error instanceof BodyError ? error.status : 400;
    return response(
      status,
      status === 413
        ? "Report is too large."
        : status === 408
          ? "Report took too long to read."
          : "Invalid report."
    );
  }
  if (!data) {
    return response(400, "Check the report fields and try again.");
  }

  let budgetTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const hour = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
    const count = await Promise.race([
      redis!.eval(reserveBudget, 1, `private-contact:v1:${hour}`),
      new Promise<never>((_resolve, reject) => {
        budgetTimer = setTimeout(() => reject(new Error("Budget reservation timed out")), 3000);
      }),
    ]);
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1) {
      throw new Error("Invalid budget");
    }
    if (count > SEND_LIMIT) {
      return response(429, "Too many reports. Try again later.", {
        "retry-after": String(WINDOW_SECONDS),
      });
    }
  } catch {
    console.error("Private contact rate limit unavailable");
    return response(503, "Private contact is temporarily unavailable.");
  } finally {
    clearTimeout(budgetTimer);
  }

  try {
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `private-contact/${data.requestId}`,
      },
      body: JSON.stringify({
        from: config.from,
        to: [config.to],
        subject: `[BKIB private report] ${categories[data.category]}`,
        text: `${categories[data.category]}\n\n${data.message}${data.profileUrl ? `\n\nProfile or source: ${data.profileUrl}` : ""}`,
        ...(data.replyEmail ? { reply_to: data.replyEmail } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!result.ok) {
      console.error("Private contact delivery failed", { status: result.status });
      return response(503, "The report could not be accepted. Try again later.");
    }
    const receipt: unknown = await result.json();
    if (
      !receipt ||
      typeof receipt !== "object" ||
      !("id" in receipt) ||
      typeof receipt.id !== "string" ||
      !receipt.id
    ) {
      throw new Error("Invalid receipt");
    }
    return Response.json({ ok: true }, { status: 202, headers: { "cache-control": "no-store" } });
  } catch {
    console.error("Private contact delivery unavailable");
    return response(503, "The report could not be accepted. Try again later.");
  }
}
