/**
 * Authentication Service
 *
 * Handles user authentication, session management, and verification.
 * IMPORTANT: National ID and Passport numbers are NOT stored after verification.
 *
 * **Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 41.3**
 */

import prisma from "@/lib/prisma";
import { randomBytes, createHash } from "crypto";
import {
  writeSharedSession,
  readSharedSession,
  revokeSharedSession,
  SessionStoreUnavailableError,
} from "@/lib/session-store";

// ============================================
// Types and Interfaces
// ============================================

export type VerificationMethod = "national_id" | "passport";

export interface Session {
  id: string;
  userId: string;
  isVerified: boolean;
  verificationMethod: VerificationMethod | null;
  createdAt: Date;
  expiresAt: Date;
}

export interface SessionToken {
  token: string;
  session: Session;
}

export interface VerificationRequest {
  method: VerificationMethod;
  documentNumber: string; // Will NOT be stored
  userId: string;
}

export interface VerificationResult {
  success: boolean;
  userId: string;
  isVerified: boolean;
  verificationMethod: VerificationMethod | null;
  error?: string;
}

export interface AuthResult {
  success: boolean;
  session?: Session;
  token?: string;
  error?: string;
}

// ============================================
// Constants
// ============================================

export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
export const TOKEN_LENGTH = 64; // bytes
export const MIN_DOCUMENT_LENGTH = 8;
export const MAX_DOCUMENT_LENGTH = 20;

// ============================================
// Error Classes
// ============================================

export class AuthenticationError extends Error {
  constructor(
    message: string,
    public code:
      | "AUTH_UNAVAILABLE"
      | "INVALID_CREDENTIALS"
      | "SESSION_EXPIRED"
      | "SESSION_NOT_FOUND"
      | "VERIFICATION_FAILED"
      | "INVALID_TOKEN"
      | "USER_NOT_FOUND"
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

// ============================================
// In-memory session store for development and tests.
// Production uses the shared Redis store with no memory fallback.
// ============================================

const sessionStore = new Map<string, Session>();
const tokenToSessionId = new Map<string, string>();

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a cryptographically secure token
 */
export function generateSecureToken(): string {
  return randomBytes(TOKEN_LENGTH).toString("hex");
}

/**
 * Hash a token for storage comparison
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Validate document number format
 */
export function validateDocumentNumber(
  documentNumber: string,
  method: VerificationMethod
): boolean {
  if (!documentNumber || typeof documentNumber !== "string") {
    return false;
  }

  const trimmed = documentNumber.trim();

  if (trimmed.length < MIN_DOCUMENT_LENGTH || trimmed.length > MAX_DOCUMENT_LENGTH) {
    return false;
  }

  // Basic format validation
  if (method === "national_id") {
    // Philippine National ID format: alphanumeric
    return /^[A-Z0-9-]+$/i.test(trimmed);
  } else if (method === "passport") {
    // Philippine Passport format: alphanumeric
    return /^[A-Z0-9]+$/i.test(trimmed);
  }

  return false;
}

/**
 * Check if a session is expired
 */
export function isSessionExpired(session: Session): boolean {
  return new Date() > session.expiresAt;
}

/**
 * Create a new session object
 */
export function createSessionObject(
  userId: string,
  isVerified: boolean,
  verificationMethod: VerificationMethod | null
): Session {
  const now = new Date();
  return {
    id: randomBytes(16).toString("hex"),
    userId,
    isVerified,
    verificationMethod,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
  };
}

// ============================================
// Core Authentication Functions
// ============================================

/**
 * Create a new user and session
 */
export async function createUser(): Promise<AuthResult> {
  try {
    const user = await prisma.user.create({
      data: {
        id: randomBytes(16).toString("hex"),
        isVerified: false,
        language: "en",
        updatedAt: new Date(),
      },
    });

    const session = createSessionObject(user.id, false, null);
    const token = generateSecureToken();
    const hashedToken = hashToken(token);

    if (process.env.NODE_ENV === "production") {
      await writeSharedSession(token, session);
    } else {
      sessionStore.set(session.id, session);
      tokenToSessionId.set(hashedToken, session.id);
    }

    return {
      success: true,
      session,
      token,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof SessionStoreUnavailableError
          ? "Authentication unavailable"
          : "Failed to create user",
    };
  }
}

/**
 * Create a session for an existing user
 */
export async function createSession(userId: string): Promise<AuthResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AuthenticationError("User not found", "USER_NOT_FOUND");
    }

    const session = createSessionObject(
      user.id,
      process.env.NODE_ENV === "production" ? false : user.isVerified,
      process.env.NODE_ENV === "production"
        ? null
        : (user.verificationMethod as VerificationMethod | null)
    );
    const token = generateSecureToken();
    const hashedToken = hashToken(token);

    if (process.env.NODE_ENV === "production") {
      await writeSharedSession(token, session);
    } else {
      sessionStore.set(session.id, session);
      tokenToSessionId.set(hashedToken, session.id);
    }

    // Update last login
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });

    return {
      success: true,
      session,
      token,
    };
  } catch (error) {
    if (error instanceof SessionStoreUnavailableError) {
      return { success: false, error: "Authentication unavailable" };
    }
    if (error instanceof AuthenticationError) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: "Failed to create session",
    };
  }
}

/**
 * Validate a session token and return the session
 */
export async function validateSession(token: string): Promise<Session> {
  if (!token || typeof token !== "string") {
    throw new AuthenticationError("Invalid token", "INVALID_TOKEN");
  }

  if (process.env.NODE_ENV === "production") {
    try {
      const session = await readSharedSession(token);
      if (!session) {
        throw new AuthenticationError("Session not found", "SESSION_NOT_FOUND");
      }
      if (isSessionExpired(session)) {
        await revokeSharedSession(token);
        throw new AuthenticationError("Session expired", "SESSION_EXPIRED");
      }
      // No production verifier exists yet; historical mock flags are untrusted.
      return { ...session, isVerified: false, verificationMethod: null };
    } catch (error) {
      if (error instanceof SessionStoreUnavailableError) {
        throw new AuthenticationError("Authentication unavailable", "AUTH_UNAVAILABLE");
      }
      throw error;
    }
  }

  const hashedToken = hashToken(token);
  const sessionId = tokenToSessionId.get(hashedToken);

  if (!sessionId) {
    throw new AuthenticationError("Session not found", "SESSION_NOT_FOUND");
  }

  const session = sessionStore.get(sessionId);

  if (!session) {
    throw new AuthenticationError("Session not found", "SESSION_NOT_FOUND");
  }

  if (isSessionExpired(session)) {
    // Clean up expired session
    sessionStore.delete(sessionId);
    tokenToSessionId.delete(hashedToken);
    throw new AuthenticationError("Session expired", "SESSION_EXPIRED");
  }

  return session;
}

/**
 * Invalidate a session (logout)
 */
export async function invalidateSession(token: string): Promise<boolean> {
  if (!token || typeof token !== "string") {
    return false;
  }

  if (process.env.NODE_ENV === "production") {
    try {
      return await revokeSharedSession(token);
    } catch {
      throw new AuthenticationError("Authentication unavailable", "AUTH_UNAVAILABLE");
    }
  }

  const hashedToken = hashToken(token);
  const sessionId = tokenToSessionId.get(hashedToken);

  if (!sessionId) {
    return false;
  }

  sessionStore.delete(sessionId);
  tokenToSessionId.delete(hashedToken);

  return true;
}

/**
 * Verify user identity using National ID or Passport
 * IMPORTANT: Document numbers are NOT stored after verification
 */
export async function verifyUser(request: VerificationRequest): Promise<VerificationResult> {
  const { method, documentNumber, userId } = request;

  if (process.env.NODE_ENV === "production") {
    return {
      success: false,
      userId,
      isVerified: false,
      verificationMethod: null,
      error: "Identity verification is unavailable",
    };
  }

  // Validate document number format
  if (!validateDocumentNumber(documentNumber, method)) {
    return {
      success: false,
      userId,
      isVerified: false,
      verificationMethod: null,
      error: "Invalid document number format",
    };
  }

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return {
        success: false,
        userId,
        isVerified: false,
        verificationMethod: null,
        error: "User not found",
      };
    }

    // Mock verification - in production, this would call external verification APIs
    // The document number is used for verification but NOT stored
    const verificationSuccess = await mockVerifyDocument(method, documentNumber);

    if (!verificationSuccess) {
      return {
        success: false,
        userId,
        isVerified: false,
        verificationMethod: null,
        error: "Verification failed",
      };
    }

    // Update user verification status (WITHOUT storing document number)
    await prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: true,
        verificationMethod: method,
        verifiedAt: new Date(),
      },
    });

    return {
      success: true,
      userId,
      isVerified: true,
      verificationMethod: method,
    };
  } catch {
    return {
      success: false,
      userId,
      isVerified: false,
      verificationMethod: null,
      error: "Verification process failed",
    };
  }
}

/**
 * Mock document verification
 * In production, this would integrate with government verification APIs
 */
async function mockVerifyDocument(
  method: VerificationMethod,
  documentNumber: string
): Promise<boolean> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // For development, accept any valid format
  // In production, this would verify against actual government databases
  return validateDocumentNumber(documentNumber, method);
}

/**
 * Get user by ID
 */
export async function getUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isVerified: true,
      verificationMethod: true,
      verifiedAt: true,
      language: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });
  if (user && process.env.NODE_ENV === "production") {
    return { ...user, isVerified: false, verificationMethod: null, verifiedAt: null };
  }
  return user;
}

/**
 * Check if session contains sensitive data (should always be false)
 */
export function sessionContainsSensitiveData(session: Session): boolean {
  // Session should never contain National ID or Passport numbers
  // We check for actual document number patterns, not the verification method name
  const sessionStr = JSON.stringify(session);

  // Check for patterns that indicate actual document numbers (not method names)
  const sensitivePatterns = [
    /nationalIdNumber/i, // Field that would store actual ID
    /passportNumber/i, // Field that would store actual passport
    /documentNumber/i, // Field that would store document
    /\d{4}-\d{4}-\d{4}/, // National ID number pattern
    /[A-Z]{2}\d{7}[A-Z]?/, // Passport number pattern
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(sessionStr)) {
      return true;
    }
  }

  return false;
}

// ============================================
// Session Store Management (for testing)
// ============================================

export function clearAllSessions(): void {
  sessionStore.clear();
  tokenToSessionId.clear();
}

export function getSessionCount(): number {
  return sessionStore.size;
}
