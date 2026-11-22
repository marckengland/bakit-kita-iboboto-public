/**
 * Watchdog Organization Service Tests
 *
 * Tests for the watchdog organization integration service.
 * **Validates: Requirements 45.1, 45.2, 45.3, 45.4, 45.5, 45.6, 45.7**
 *
 * Pure functions are tested directly from the utils file.
 * Service functions that require prisma/cache would need dependency injection.
 */

import { describe, it, expect } from "vitest";
import {
  isValidOrganization,
  getOrganizationName,
  getOrganizationUrl,
  createAttribution,
  validateThirdPartyLabeling,
  labelAsThirdPartyFactCheck,
  normalizeClaim,
  areClaimsSimilar,
  generateJobId,
  WATCHDOG_ORGANIZATIONS,
  ORGANIZATION_INFO,
  THIRD_PARTY_DISCLAIMER,
  WatchdogOrganizationError,
  type FactCheckRecord,
} from "./watchdog-organization.utils";

describe("Watchdog Organization Utils", () => {
  describe("isValidOrganization", () => {
    it("should return true for valid organizations", () => {
      expect(isValidOrganization("pcij")).toBe(true);
      expect(isValidOrganization("vera_files")).toBe(true);
      expect(isValidOrganization("rappler")).toBe(true);
      expect(isValidOrganization("cmfr")).toBe(true);
    });

    it("should return false for invalid organizations", () => {
      expect(isValidOrganization("invalid")).toBe(false);
      expect(isValidOrganization("")).toBe(false);
      expect(isValidOrganization("PCIJ")).toBe(false); // case sensitive
    });
  });

  describe("getOrganizationName", () => {
    it("should return full name for each organization", () => {
      expect(getOrganizationName("pcij")).toBe("Philippine Center for Investigative Journalism");
      expect(getOrganizationName("vera_files")).toBe("VERA Files");
      expect(getOrganizationName("rappler")).toBe("Rappler");
      expect(getOrganizationName("cmfr")).toBe("Center for Media Freedom and Responsibility");
    });
  });

  describe("getOrganizationUrl", () => {
    it("should return URL for each organization", () => {
      expect(getOrganizationUrl("pcij")).toBe("https://pcij.org");
      expect(getOrganizationUrl("vera_files")).toBe("https://verafiles.org");
      expect(getOrganizationUrl("rappler")).toBe("https://www.rappler.com");
      expect(getOrganizationUrl("cmfr")).toBe("https://cmfr-phil.org");
    });
  });

  describe("createAttribution", () => {
    it("should create proper attribution object", () => {
      const publishedAt = new Date("2024-01-15");
      const attribution = createAttribution("pcij", "https://pcij.org/article/123", publishedAt);

      expect(attribution.organization).toBe("pcij");
      expect(attribution.organizationFullName).toBe(
        "Philippine Center for Investigative Journalism"
      );
      expect(attribution.organizationUrl).toBe("https://pcij.org");
      expect(attribution.articleUrl).toBe("https://pcij.org/article/123");
      expect(attribution.publishedAt).toEqual(publishedAt);
      expect(attribution.disclaimer).toBe(THIRD_PARTY_DISCLAIMER);
    });

    it("should create attribution for all organizations", () => {
      const publishedAt = new Date();
      for (const org of WATCHDOG_ORGANIZATIONS) {
        const attribution = createAttribution(org, "https://example.com", publishedAt);
        expect(attribution.organization).toBe(org);
        expect(attribution.organizationFullName).toBe(ORGANIZATION_INFO[org].fullName);
      }
    });
  });

  describe("validateThirdPartyLabeling", () => {
    it("should return true for properly labeled fact-checks", () => {
      const data: Partial<FactCheckRecord> = {
        isThirdPartyFactCheck: true,
        attribution: createAttribution("pcij", "https://pcij.org/article", new Date()),
      };
      expect(validateThirdPartyLabeling(data)).toBe(true);
    });

    it("should return false for missing isThirdPartyFactCheck", () => {
      const data: Partial<FactCheckRecord> = {
        attribution: createAttribution("pcij", "https://pcij.org/article", new Date()),
      };
      expect(validateThirdPartyLabeling(data)).toBe(false);
    });

    it("should return false for isThirdPartyFactCheck set to false", () => {
      const data = {
        isThirdPartyFactCheck: false as const,
        attribution: createAttribution("pcij", "https://pcij.org/article", new Date()),
      };
      // Type coercion needed since our type requires true
      expect(validateThirdPartyLabeling(data as unknown as Partial<FactCheckRecord>)).toBe(false);
    });

    it("should return false for missing attribution", () => {
      const data: Partial<FactCheckRecord> = {
        isThirdPartyFactCheck: true,
      };
      expect(validateThirdPartyLabeling(data)).toBe(false);
    });

    it("should return false for empty disclaimer", () => {
      const data: Partial<FactCheckRecord> = {
        isThirdPartyFactCheck: true,
        attribution: {
          organization: "pcij",
          organizationFullName: "PCIJ",
          organizationUrl: "https://pcij.org",
          articleUrl: "https://pcij.org/article",
          publishedAt: new Date(),
          disclaimer: "",
        },
      };
      expect(validateThirdPartyLabeling(data)).toBe(false);
    });
  });

  describe("labelAsThirdPartyFactCheck", () => {
    it("should add third-party labeling to data", () => {
      const originalData = { title: "Test Article", claim: "Test claim" };
      const publishedAt = new Date("2024-01-15");

      const labeled = labelAsThirdPartyFactCheck(
        originalData,
        "vera_files",
        "https://verafiles.org/article/456",
        publishedAt
      );

      expect(labeled.title).toBe("Test Article");
      expect(labeled.claim).toBe("Test claim");
      expect(labeled.isThirdPartyFactCheck).toBe(true);
      expect(labeled.attribution.organization).toBe("vera_files");
      expect(labeled.attribution.articleUrl).toBe("https://verafiles.org/article/456");
    });

    it("should not mutate original data", () => {
      const originalData = { title: "Original" };
      labelAsThirdPartyFactCheck(
        originalData,
        "rappler",
        "https://rappler.com/article",
        new Date()
      );

      expect((originalData as Record<string, unknown>).isThirdPartyFactCheck).toBeUndefined();
      expect((originalData as Record<string, unknown>).attribution).toBeUndefined();
    });
  });

  describe("normalizeClaim", () => {
    it("should normalize claims for comparison", () => {
      expect(normalizeClaim("  Hello World  ")).toBe("hello world");
      expect(normalizeClaim("Hello, World!")).toBe("hello world");
      expect(normalizeClaim("UPPERCASE TEXT")).toBe("uppercase text");
      expect(normalizeClaim("multiple   spaces")).toBe("multiple spaces");
    });

    it("should handle special characters", () => {
      expect(normalizeClaim("Test (with) [brackets]")).toBe("test with brackets");
      expect(normalizeClaim("100% accurate")).toBe("100 accurate");
    });
  });

  describe("areClaimsSimilar", () => {
    it("should return true for identical claims", () => {
      expect(areClaimsSimilar("The sky is blue", "The sky is blue")).toBe(true);
    });

    it("should return true for claims with different casing", () => {
      expect(areClaimsSimilar("The Sky Is Blue", "the sky is blue")).toBe(true);
    });

    it("should return true for claims with minor punctuation differences", () => {
      expect(areClaimsSimilar("The sky is blue!", "The sky is blue.")).toBe(true);
    });

    it("should return true for claims with high word overlap", () => {
      expect(
        areClaimsSimilar(
          "The politician promised to build roads",
          "The politician promised to build new roads"
        )
      ).toBe(true);
    });

    it("should return false for completely different claims", () => {
      expect(areClaimsSimilar("The sky is blue", "Cats are mammals")).toBe(false);
    });

    it("should return false for claims with low overlap", () => {
      expect(
        areClaimsSimilar("Infrastructure spending increased", "Healthcare budget was cut")
      ).toBe(false);
    });
  });

  describe("generateJobId", () => {
    it("should generate unique job IDs", () => {
      const id1 = generateJobId();
      const id2 = generateJobId();

      expect(id1).not.toBe(id2);
    });

    it("should start with watchdog_ prefix", () => {
      const id = generateJobId();
      expect(id.startsWith("watchdog_")).toBe(true);
    });

    it("should contain timestamp", () => {
      const before = Date.now();
      const id = generateJobId();
      const after = Date.now();

      const parts = id.split("_");
      const timestamp = parseInt(parts[1]!, 10);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("WATCHDOG_ORGANIZATIONS constant", () => {
    it("should contain all four organizations", () => {
      expect(WATCHDOG_ORGANIZATIONS).toHaveLength(4);
      expect(WATCHDOG_ORGANIZATIONS).toContain("pcij");
      expect(WATCHDOG_ORGANIZATIONS).toContain("vera_files");
      expect(WATCHDOG_ORGANIZATIONS).toContain("rappler");
      expect(WATCHDOG_ORGANIZATIONS).toContain("cmfr");
    });
  });

  describe("ORGANIZATION_INFO constant", () => {
    it("should have info for all organizations", () => {
      for (const org of WATCHDOG_ORGANIZATIONS) {
        const info = ORGANIZATION_INFO[org];
        expect(info).toBeDefined();
        expect(info.name).toBeTruthy();
        expect(info.fullName).toBeTruthy();
        expect(info.url).toBeTruthy();
        expect(info.feedUrl).toBeTruthy();
        expect(info.description).toBeTruthy();
      }
    });

    it("should have valid URLs", () => {
      for (const org of WATCHDOG_ORGANIZATIONS) {
        const info = ORGANIZATION_INFO[org];
        expect(info.url).toMatch(/^https?:\/\//);
        expect(info.feedUrl).toMatch(/^https?:\/\//);
      }
    });
  });

  describe("WatchdogOrganizationError", () => {
    it("should create error with code", () => {
      const error = new WatchdogOrganizationError("Test error", "FETCH_FAILED");

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("FETCH_FAILED");
      expect(error.name).toBe("WatchdogOrganizationError");
    });

    it("should support all error codes", () => {
      const codes = [
        "FETCH_FAILED",
        "PARSE_ERROR",
        "INVALID_ORGANIZATION",
        "RATE_LIMITED",
        "NOT_FOUND",
        "POLITICIAN_NOT_FOUND",
      ] as const;

      for (const code of codes) {
        const error = new WatchdogOrganizationError(`Error: ${code}`, code);
        expect(error.code).toBe(code);
      }
    });

    it("should be instanceof Error", () => {
      const error = new WatchdogOrganizationError("Test", "NOT_FOUND");
      expect(error instanceof Error).toBe(true);
    });
  });
});
