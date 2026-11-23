import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { redis } from "@/lib/redis";

export type PublicBudget = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  isBlocked: boolean;
  maxRequests: number;
  windowMs: number;
};

type Scope = "feedback" | "records" | "assistant";
const LIMITS = {
  records: { minute: 120, hour: 1200, anonymous: 20, authenticated: 100 },
  feedback: { minute: 5, hour: 20, anonymous: 5, authenticated: 5 },
  assistant: { minute: 10, hour: 100, anonymous: 20, authenticated: 100 },
} as const;

export class PublicBudgetUnavailableError extends Error {
  constructor() {
    super("Public request budget unavailable");
    this.name = "PublicBudgetUnavailableError";
  }
}

/** Only configure this after verifying the ingress overwrites the header. */
export function trustedClientIp(request: Request): string | null {
  const header = process.env.PUBLIC_CLIENT_IP_HEADER;
  if (!header || !["x-vercel-forwarded-for", "cf-connecting-ip", "x-real-ip"].includes(header)) {
    return null;
  }
  const value = request.headers.get(header);
  return value && !value.includes(",") && isIP(value) ? value : null;
}

// Redis TIME keeps every process in the same fixed windows. All checks precede
// all increments; a rejected request consumes no counters. Every write receives
// an absolute expiry at its window boundary, including the first/last millisecond.
const BUDGET_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local reserve = tonumber(ARGV[1])
local counts = {}
local resets = {}
local windows = {}
local blocked = false
for i, key in ipairs(KEYS) do
  local window = i == 1 and 60000 or 3600000
  local reset = (math.floor(now / window) + 1) * window
  local raw = redis.call('GET', key)
  local count = 0
  if raw then count = tonumber(raw) end
  local limit = tonumber(ARGV[i + 1])
  if not count or count < 0 or count ~= math.floor(count) or count > limit
    or (raw and raw ~= tostring(count)) then
    return redis.error_reply('Invalid public budget counter')
  end
  counts[i] = count
  resets[i] = reset
  windows[i] = window
  if count >= limit then blocked = true end
end
local allowed = not blocked
if reserve == 1 and allowed then
  for i, key in ipairs(KEYS) do
    counts[i] = redis.call('INCR', key)
    redis.call('PEXPIREAT', key, resets[i])
  end
end
local chosen = 1
local remaining = tonumber(ARGV[2]) - counts[1]
for i = 2, #KEYS do
  local available = tonumber(ARGV[i + 1]) - counts[i]
  if (available == 0 and remaining ~= 0)
    or (available == 0 and remaining == 0 and resets[i] > resets[chosen])
    or (available > 0 and remaining > 0 and available < remaining) then
    chosen = i
    remaining = available
  end
end
return {allowed and 1 or 0, remaining, resets[chosen], tonumber(ARGV[chosen + 1]), windows[chosen], remaining == 0 and 1 or 0, now}
`;

async function checkBudget(
  request: Request,
  scope: Scope,
  userId: string | null | undefined,
  reserve: boolean
): Promise<PublicBudget | null> {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }
  if (!redis || !process.env.REDIS_URL?.trim() || process.env.REDIS_DISABLED === "true") {
    throw new PublicBudgetUnavailableError();
  }

  const limits = LIMITS[scope];
  const ip = trustedClientIp(request);
  // Callers may supply only an ID established by server-side authentication.
  const client = userId ? `user:${userId}` : ip ? `ip:${ip}` : null;
  const keys = [`public-budget:{${scope}}:minute`, `public-budget:{${scope}}:hour`];
  const caps: number[] = [limits.minute, limits.hour];
  if (client) {
    const hash = createHash("sha256").update(client).digest("hex");
    keys.push(`public-budget:{${scope}}:client:${hash}:hour`);
    caps.push(userId ? limits.authenticated : limits.anonymous);
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result: unknown = await Promise.race([
      redis.eval(BUDGET_SCRIPT, keys.length, ...keys, reserve ? 1 : 0, ...caps),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new PublicBudgetUnavailableError()), 3000);
      }),
    ]);
    if (!Array.isArray(result) || result.length !== 7 || !result.every(Number.isSafeInteger)) {
      throw new PublicBudgetUnavailableError();
    }
    const [allowed, remaining, resetAt, maxRequests, windowMs, blocked, now] = result as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    const validCap =
      windowMs === 60_000
        ? maxRequests === limits.minute
        : windowMs === 3_600_000 && caps.slice(1).includes(maxRequests);
    if (
      ![0, 1].includes(allowed) ||
      ![0, 1].includes(blocked) ||
      !validCap ||
      remaining < 0 ||
      remaining > maxRequests ||
      now <= 0 ||
      resetAt > 8_640_000_000_000_000 ||
      resetAt <= now ||
      resetAt > now + windowMs ||
      blocked !== (remaining === 0 ? 1 : 0) ||
      (allowed === 0 && blocked !== 1) ||
      (!reserve && allowed === blocked) ||
      (reserve && allowed === 1 && remaining >= maxRequests)
    ) {
      throw new PublicBudgetUnavailableError();
    }
    return {
      allowed: allowed === 1,
      remaining,
      resetAt: new Date(resetAt),
      isBlocked: blocked === 1,
      maxRequests,
      windowMs,
    };
  } catch {
    throw new PublicBudgetUnavailableError();
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export function reservePublicRequest(
  request: Request,
  scope: Scope,
  userId?: string | null
): Promise<PublicBudget | null> {
  return checkBudget(request, scope, userId, true);
}

export function getPublicRequestBudget(
  request: Request,
  scope: Scope,
  userId?: string | null
): Promise<PublicBudget | null> {
  return checkBudget(request, scope, userId, false);
}
