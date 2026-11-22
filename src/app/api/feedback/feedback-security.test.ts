import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { feedback } = vi.hoisted(() => ({
  feedback: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { feedback } }));

import { GET as list, POST } from "./route";
import { GET, PATCH, DELETE } from "./[id]/route";

const adminHandlers = [
  { name: "list", method: "GET", handler: list },
  { name: "read", method: "GET", handler: GET },
  { name: "update", method: "PATCH", handler: PATCH },
  { name: "delete", method: "DELETE", handler: DELETE },
];

function request(method: string, role?: string) {
  return new NextRequest("http://localhost/api/feedback/feedback-1", {
    method,
    headers: role ? { "x-admin-role": role, "content-type": "application/json" } : {},
    ...(method === "PATCH" ? { body: JSON.stringify({ status: "reviewed" }) } : {}),
  });
}

describe("feedback administrative access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    feedback.findMany.mockResolvedValue([]);
    feedback.count.mockResolvedValue(0);
    feedback.findUnique.mockResolvedValue({ id: "feedback-1", attachments: null });
    feedback.update.mockResolvedValue({ id: "feedback-1", attachments: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  for (const { name, method, handler } of adminHandlers) {
    it(`${name} rejects anonymous access without touching feedback`, async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ADMIN_ENABLED", "false");
      const response = await handler(request(method), {
        params: Promise.resolve({ id: "feedback-1" }),
      });
      expect(response.status).toBe(404);
      expect(feedback.findMany).not.toHaveBeenCalled();
      expect(feedback.findUnique).not.toHaveBeenCalled();
      expect(feedback.update).not.toHaveBeenCalled();
      expect(feedback.delete).not.toHaveBeenCalled();
    });

    it(`${name} still requires a role in the explicit local admin mode`, async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ADMIN_ENABLED", "true");
      const response = await handler(request(method), {
        params: Promise.resolve({ id: "feedback-1" }),
      });
      expect(response.status).toBe(401);
      expect(feedback.findMany).not.toHaveBeenCalled();
      expect(feedback.findUnique).not.toHaveBeenCalled();
      expect(feedback.update).not.toHaveBeenCalled();
      expect(feedback.delete).not.toHaveBeenCalled();
    });

    it(`${name} rejects a forged role with the default admin flag`, async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ADMIN_ENABLED", undefined);
      const response = await handler(request(method, "super_admin"), {
        params: Promise.resolve({ id: "feedback-1" }),
      });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Not found" });
      expect(feedback.findMany).not.toHaveBeenCalled();
      expect(feedback.findUnique).not.toHaveBeenCalled();
      expect(feedback.update).not.toHaveBeenCalled();
      expect(feedback.delete).not.toHaveBeenCalled();
    });

    it(`${name} rejects a forged role in production even with admin enabled`, async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ADMIN_ENABLED", "true");
      const response = await handler(request(method, "super_admin"), {
        params: Promise.resolve({ id: "feedback-1" }),
      });
      expect(response.status).toBe(404);
      expect(feedback.findMany).not.toHaveBeenCalled();
      expect(feedback.findUnique).not.toHaveBeenCalled();
      expect(feedback.update).not.toHaveBeenCalled();
      expect(feedback.delete).not.toHaveBeenCalled();
    });

    it(`${name} remains available in the explicit local admin mode`, async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ADMIN_ENABLED", "true");
      const response = await handler(request(method, "super_admin"), {
        params: Promise.resolve({ id: "feedback-1" }),
      });
      expect(response.status).toBe(200);
    });
  }

  it("keeps public feedback submission available in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_ENABLED", "false");
    feedback.create.mockResolvedValue({ id: "submitted-feedback" });
    const response = await POST(
      new NextRequest("http://localhost/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: "general_feedback",
          subject: "Public feedback",
          description: "This is public feedback",
          isAnonymous: true,
        }),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      feedbackId: "submitted-feedback",
    });
  });
});
