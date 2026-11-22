import { createHash } from "crypto";
import { redis } from "@/lib/redis";
import type { Session } from "@/services/auth.service";

const SESSION_TTL_SECONDS = 24 * 60 * 60;

export class SessionStoreUnavailableError extends Error {
  constructor() {
    super("Authentication unavailable");
    this.name = "SessionStoreUnavailableError";
  }
}

function sessionKey(token: string): string {
  return `auth:session:v1:${createHash("sha256").update(token).digest("hex")}`;
}

function requireRedis() {
  if (!process.env.REDIS_URL?.trim() || process.env.REDIS_DISABLED === "true" || !redis) {
    throw new SessionStoreUnavailableError();
  }
  return redis;
}

/** Store a token digest and session for 24 hours; reads never renew the TTL. */
export async function writeSharedSession(token: string, session: Session): Promise<void> {
  try {
    const result = await requireRedis().setex(
      sessionKey(token),
      SESSION_TTL_SECONDS,
      JSON.stringify(session)
    );
    if (result !== "OK") {
      throw new SessionStoreUnavailableError();
    }
  } catch {
    throw new SessionStoreUnavailableError();
  }
}

/** Validate the serialized shape before restoring session dates. */
function parseSession(value: string): Session {
  const session: unknown = JSON.parse(value);
  if (!session || typeof session !== "object") {
    throw new SessionStoreUnavailableError();
  }
  const data = session as Record<string, unknown>;
  if (
    typeof data.id !== "string" ||
    !data.id.trim() ||
    typeof data.userId !== "string" ||
    !data.userId.trim() ||
    typeof data.isVerified !== "boolean" ||
    (data.verificationMethod !== null &&
      data.verificationMethod !== "national_id" &&
      data.verificationMethod !== "passport") ||
    typeof data.createdAt !== "string" ||
    typeof data.expiresAt !== "string"
  ) {
    throw new SessionStoreUnavailableError();
  }

  const createdAt = new Date(data.createdAt);
  const expiresAt = new Date(data.expiresAt);
  if (
    !Number.isFinite(createdAt.getTime()) ||
    !Number.isFinite(expiresAt.getTime()) ||
    createdAt.toISOString() !== data.createdAt ||
    expiresAt.toISOString() !== data.expiresAt ||
    expiresAt.getTime() <= createdAt.getTime() ||
    expiresAt.getTime() - createdAt.getTime() > SESSION_TTL_SECONDS * 1000
  ) {
    throw new SessionStoreUnavailableError();
  }

  return {
    id: data.id,
    userId: data.userId,
    isVerified: data.isVerified,
    verificationMethod: data.verificationMethod as Session["verificationMethod"],
    createdAt,
    expiresAt,
  };
}

export async function readSharedSession(token: string): Promise<Session | null> {
  try {
    const value = await requireRedis().get(sessionKey(token));
    return value === null ? null : parseSession(value);
  } catch {
    throw new SessionStoreUnavailableError();
  }
}

export async function revokeSharedSession(token: string): Promise<boolean> {
  try {
    return (await requireRedis().del(sessionKey(token))) > 0;
  } catch {
    throw new SessionStoreUnavailableError();
  }
}
