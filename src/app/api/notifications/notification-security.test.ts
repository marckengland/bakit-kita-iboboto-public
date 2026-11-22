import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const { notification, cookieGet, validateSession } = vi.hoisted(() => ({
  notification: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  cookieGet: vi.fn(),
  validateSession: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: { notification } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGet }) }));
vi.mock("@/services/auth.service", () => ({ validateSession }));

import { PATCH, DELETE } from "./[id]/route";
import { markAsReadForUser, deleteNotificationForUser } from "@/services/notification.service";

const record = () => ({
  id: "notification-1",
  userId: "owner",
  type: "new_bill",
  politicianId: null,
  politicianName: null,
  title: "Private notification",
  message: "Private message",
  link: null,
  isRead: false,
  createdAt: new Date("2026-01-01"),
});
let stored: ReturnType<typeof record> | null;

beforeEach(() => {
  vi.resetAllMocks();
  stored = record();
  cookieGet.mockReturnValue({ value: "session-token" });
  validateSession.mockResolvedValue({ userId: "owner" });
  notification.findUnique.mockImplementation(async () => stored);
  notification.update.mockImplementation(async ({ where, data }) => {
    if (
      !stored ||
      where.id !== stored.id ||
      (where.userId !== undefined && where.userId !== stored.userId)
    ) {
      throw new Prisma.PrismaClientKnownRequestError("No matching notification", {
        code: "P2025",
        clientVersion: "6",
      });
    }
    stored = { ...stored, ...data };
    return stored;
  });
  notification.delete.mockImplementation(async ({ where }) => {
    if (
      !stored ||
      where.id !== stored.id ||
      (where.userId !== undefined && where.userId !== stored.userId)
    ) {
      throw new Prisma.PrismaClientKnownRequestError("No matching notification", {
        code: "P2025",
        clientVersion: "6",
      });
    }
    const deleted = stored;
    stored = null;
    return deleted;
  });
});

for (const { method, handler } of [
  { method: "PATCH", handler: PATCH },
  { method: "DELETE", handler: DELETE },
]) {
  describe(`notification ${method}`, () => {
    const call = (id = "notification-1") =>
      handler(new NextRequest("http://localhost/api/notifications/notification-1", { method }), {
        params: Promise.resolve({ id }),
      });

    it("rejects a foreign notification without disclosing or mutating it", async () => {
      validateSession.mockResolvedValue({ userId: "other-user" });
      const response = await call();
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Notification not found" });
      expect(stored).toEqual(record());
    });

    it("returns the same response for a missing notification", async () => {
      const response = await call("missing");
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Notification not found" });
    });

    it("allows its owner to mutate it", async () => {
      const response = await call();
      expect(response.status).toBe(200);
      if (method === "PATCH") {
        expect(stored?.isRead).toBe(true);
        expect(await response.json()).toMatchObject({
          notification: { id: "notification-1", isRead: true },
        });
        expect(notification.update).toHaveBeenCalledWith({
          where: { id: "notification-1", userId: "owner" },
          data: { isRead: true },
        });
      } else {
        expect(stored).toBeNull();
        expect(await response.json()).toEqual({ success: true });
        expect(notification.delete).toHaveBeenCalledWith({
          where: { id: "notification-1", userId: "owner" },
        });
      }
      expect(notification.findUnique).not.toHaveBeenCalled();
    });

    it("rejects a missing session", async () => {
      cookieGet.mockReturnValue(undefined);
      expect((await call()).status).toBe(401);
      expect(stored).toEqual(record());
    });

    it("rejects an invalid session", async () => {
      validateSession.mockRejectedValue(new Error("Invalid session"));
      expect((await call()).status).toBe(401);
      expect(stored).toEqual(record());
    });

    it.each([undefined, ""])("fails closed when the session userId is %s", async (userId) => {
      validateSession.mockResolvedValue({ userId });
      expect((await call()).status).toBe(401);
      expect(notification.update).not.toHaveBeenCalled();
      expect(notification.delete).not.toHaveBeenCalled();
      expect(stored).toEqual(record());
    });
  });
}

it.each([undefined, ""])(
  "scoped service mutations reject missing userId %s before querying",
  async (userId) => {
    await expect(markAsReadForUser("notification-1", userId as string)).rejects.toThrow();
    await expect(deleteNotificationForUser("notification-1", userId as string)).rejects.toThrow();
    expect(notification.update).not.toHaveBeenCalled();
    expect(notification.delete).not.toHaveBeenCalled();
  }
);
