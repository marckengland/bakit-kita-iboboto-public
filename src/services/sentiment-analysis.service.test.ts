/**
 * Sentiment Analysis Service Tests
 *
 * Unit tests for the sentiment analysis pipeline.
 * Validates: Requirements 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before importing the service
vi.mock("@/lib/prisma", () => ({
  default: {
    politician: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    sentimentData: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// Mock Redis cache
vi.mock("@/lib/redis", () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  },
  CACHE_TTL: {
    SHORT: 3600,
    MEDIUM: 86400,
    LONG: 604800,
  },
}));

import {
  calculateSentimentPercentages,
  classifySentiment,
  extractTrendingTopics,
  aggregateSentiment,
  selectSamplePosts,
  validatePublicOpinionLabeling,
  labelAsPublicOpinion,
  isValidPlatform,
  PUBLIC_OPINION_DISCLAIMER,
  SHORT_DISCLAIMER,
  SUPPORTED_PLATFORMS,
  SocialMediaPost,
} from "./sentiment-analysis.service";

describe("Sentiment Analysis Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Platform Validation Tests
  // ============================================

  describe("isValidPlatform", () => {
    it("should return true for valid platforms", () => {
      expect(isValidPlatform("twitter")).toBe(true);
      expect(isValidPlatform("facebook")).toBe(true);
      expect(isValidPlatform("tiktok")).toBe(true);
      expect(isValidPlatform("youtube")).toBe(true);
      expect(isValidPlatform("reddit")).toBe(true);
    });

    it("should return false for invalid platforms", () => {
      expect(isValidPlatform("instagram")).toBe(false);
      expect(isValidPlatform("linkedin")).toBe(false);
      expect(isValidPlatform("")).toBe(false);
      expect(isValidPlatform("TWITTER")).toBe(false);
    });
  });

  // ============================================
  // Sentiment Percentage Calculation Tests
  // Validates: Requirement 25.3
  // ============================================

  describe("calculateSentimentPercentages", () => {
    it("should calculate correct percentages for balanced sentiment", () => {
      const result = calculateSentimentPercentages(33, 33, 34);
      expect(result.positive).toBeCloseTo(33, 0);
      expect(result.negative).toBeCloseTo(33, 0);
      expect(result.neutral).toBeCloseTo(34, 0);
    });

    it("should handle all positive sentiment", () => {
      const result = calculateSentimentPercentages(100, 0, 0);
      expect(result.positive).toBe(100);
      expect(result.negative).toBe(0);
      expect(result.neutral).toBe(0);
    });

    it("should handle all negative sentiment", () => {
      const result = calculateSentimentPercentages(0, 100, 0);
      expect(result.positive).toBe(0);
      expect(result.negative).toBe(100);
      expect(result.neutral).toBe(0);
    });

    it("should handle all neutral sentiment", () => {
      const result = calculateSentimentPercentages(0, 0, 100);
      expect(result.positive).toBe(0);
      expect(result.negative).toBe(0);
      expect(result.neutral).toBe(100);
    });

    it("should return zeros for empty data", () => {
      const result = calculateSentimentPercentages(0, 0, 0);
      expect(result.positive).toBe(0);
      expect(result.negative).toBe(0);
      expect(result.neutral).toBe(0);
    });

    it("should round to one decimal place", () => {
      const result = calculateSentimentPercentages(1, 1, 1);
      expect(result.positive).toBe(33.3);
      expect(result.negative).toBe(33.3);
      expect(result.neutral).toBe(33.3);
    });
  });

  // ============================================
  // Sentiment Classification Tests
  // ============================================

  describe("classifySentiment", () => {
    it("should classify positive English text", () => {
      expect(classifySentiment("This politician is great and amazing!")).toBe("positive");
      expect(classifySentiment("I love this candidate, excellent work")).toBe("positive");
      expect(classifySentiment("Best senator we have, very effective")).toBe("positive");
    });

    it("should classify negative English text", () => {
      expect(classifySentiment("This politician is terrible and corrupt")).toBe("negative");
      expect(classifySentiment("I hate this incompetent official")).toBe("negative");
      expect(classifySentiment("Worst mayor ever, total fail")).toBe("negative");
    });

    it("should classify positive Filipino text", () => {
      expect(classifySentiment("Magaling ang senador na ito!")).toBe("positive");
      expect(classifySentiment("Mahusay at tapat na lider")).toBe("positive");
      expect(classifySentiment("Mabuti ang ginagawa niya")).toBe("positive");
    });

    it("should classify negative Filipino text", () => {
      expect(classifySentiment("Korap at magnanakaw ang politiko")).toBe("negative");
      expect(classifySentiment("Trapo at sinungaling siya")).toBe("negative");
      expect(classifySentiment("Palpak at walang kwenta")).toBe("negative");
    });

    it("should classify neutral text", () => {
      expect(classifySentiment("The politician attended the meeting")).toBe("neutral");
      expect(classifySentiment("News update about the senator")).toBe("neutral");
      expect(classifySentiment("")).toBe("neutral");
    });

    it("should handle mixed sentiment by counting keywords", () => {
      // More positive than negative
      expect(classifySentiment("Great and amazing but has some bad points")).toBe("positive");
      // More negative than positive
      expect(classifySentiment("Good but terrible, corrupt, and incompetent")).toBe("negative");
    });
  });

  // ============================================
  // Trending Topics Extraction Tests
  // Validates: Requirement 25.5
  // ============================================

  describe("extractTrendingTopics", () => {
    const createPost = (
      text: string,
      sentiment: "positive" | "negative" | "neutral"
    ): SocialMediaPost => ({
      platform: "twitter",
      postId: `post_${Math.random()}`,
      url: "https://twitter.com/test/status/123",
      text,
      sentiment,
      engagementCount: 100,
      timestamp: new Date(),
    });

    it("should extract hashtags as trending topics", () => {
      const posts: SocialMediaPost[] = [
        createPost("#Election2025 is coming #VoteWisely", "neutral"),
        createPost("#Election2025 updates #Politics", "neutral"),
        createPost("#Election2025 news", "positive"),
      ];

      const topics = extractTrendingTopics(posts);

      expect(topics.length).toBeGreaterThan(0);
      expect(topics[0]?.topic).toBe("#election2025");
      expect(topics[0]?.mentionCount).toBe(3);
    });

    it("should sort topics by mention count", () => {
      const posts: SocialMediaPost[] = [
        createPost("#TopicA #TopicB", "neutral"),
        createPost("#TopicA #TopicB", "neutral"),
        createPost("#TopicA", "neutral"),
        createPost("#TopicC", "neutral"),
      ];

      const topics = extractTrendingTopics(posts);

      expect(topics[0]?.topic).toBe("#topica");
      expect(topics[0]?.mentionCount).toBe(3);
      expect(topics[1]?.topic).toBe("#topicb");
      expect(topics[1]?.mentionCount).toBe(2);
    });

    it("should limit results to specified count", () => {
      const posts: SocialMediaPost[] = Array.from({ length: 20 }, (_, i) =>
        createPost(`#Topic${i}`, "neutral")
      );

      const topics = extractTrendingTopics(posts, 5);
      expect(topics.length).toBe(5);
    });

    it("should determine dominant sentiment for each topic", () => {
      const posts: SocialMediaPost[] = [
        createPost("#TestTopic positive", "positive"),
        createPost("#TestTopic positive", "positive"),
        createPost("#TestTopic negative", "negative"),
      ];

      const topics = extractTrendingTopics(posts);
      const testTopic = topics.find((t) => t.topic === "#testtopic");

      expect(testTopic?.sentiment).toBe("positive");
    });

    it("should return empty array for posts without hashtags", () => {
      const posts: SocialMediaPost[] = [
        createPost("No hashtags here", "neutral"),
        createPost("Just plain text", "neutral"),
      ];

      const topics = extractTrendingTopics(posts);
      expect(topics).toEqual([]);
    });
  });

  // ============================================
  // Sentiment Aggregation Tests
  // Validates: Requirements 25.3, 25.4
  // ============================================

  describe("aggregateSentiment", () => {
    const createPost = (
      sentiment: "positive" | "negative" | "neutral",
      engagement: number
    ): SocialMediaPost => ({
      platform: "twitter",
      postId: `post_${Math.random()}`,
      url: "https://twitter.com/test/status/123",
      text: "Test post",
      sentiment,
      engagementCount: engagement,
      timestamp: new Date(),
    });

    it("should count sentiments correctly", () => {
      const posts: SocialMediaPost[] = [
        createPost("positive", 100),
        createPost("positive", 50),
        createPost("negative", 75),
        createPost("neutral", 25),
      ];

      const result = aggregateSentiment(posts);

      expect(result.positiveCount).toBe(2);
      expect(result.negativeCount).toBe(1);
      expect(result.neutralCount).toBe(1);
      expect(result.totalMentions).toBe(4);
    });

    it("should calculate total engagement", () => {
      const posts: SocialMediaPost[] = [
        createPost("positive", 100),
        createPost("negative", 200),
        createPost("neutral", 300),
      ];

      const result = aggregateSentiment(posts);
      expect(result.totalEngagement).toBe(600);
    });

    it("should handle empty posts array", () => {
      const result = aggregateSentiment([]);

      expect(result.positiveCount).toBe(0);
      expect(result.negativeCount).toBe(0);
      expect(result.neutralCount).toBe(0);
      expect(result.totalMentions).toBe(0);
      expect(result.totalEngagement).toBe(0);
    });
  });

  // ============================================
  // Sample Posts Selection Tests
  // Validates: Requirement 25.6
  // ============================================

  describe("selectSamplePosts", () => {
    const createPost = (
      sentiment: "positive" | "negative" | "neutral",
      engagement: number,
      text: string
    ): SocialMediaPost => ({
      platform: "twitter",
      postId: `post_${Math.random()}`,
      url: `https://twitter.com/test/status/${Math.random()}`,
      text,
      sentiment,
      engagementCount: engagement,
      timestamp: new Date(),
    });

    it("should select a balanced mix of sentiments", () => {
      const posts: SocialMediaPost[] = [
        createPost("positive", 100, "Positive 1"),
        createPost("positive", 90, "Positive 2"),
        createPost("positive", 80, "Positive 3"),
        createPost("negative", 100, "Negative 1"),
        createPost("negative", 90, "Negative 2"),
        createPost("negative", 80, "Negative 3"),
        createPost("neutral", 100, "Neutral 1"),
        createPost("neutral", 90, "Neutral 2"),
        createPost("neutral", 80, "Neutral 3"),
      ];

      const selected = selectSamplePosts(posts, 9);

      const positivePosts = selected.filter((p) => p.sentiment === "positive");
      const negativePosts = selected.filter((p) => p.sentiment === "negative");
      const neutralPosts = selected.filter((p) => p.sentiment === "neutral");

      expect(positivePosts.length).toBeGreaterThan(0);
      expect(negativePosts.length).toBeGreaterThan(0);
      expect(neutralPosts.length).toBeGreaterThan(0);
    });

    it("should prioritize high engagement posts", () => {
      const posts: SocialMediaPost[] = [
        createPost("positive", 1000, "High engagement"),
        createPost("positive", 10, "Low engagement"),
        createPost("positive", 500, "Medium engagement"),
      ];

      const selected = selectSamplePosts(posts, 2);

      expect(selected[0]?.text).toBe("High engagement");
    });

    it("should limit results to specified count", () => {
      // Create posts with all three sentiments to ensure we have enough
      const posts: SocialMediaPost[] = [
        ...Array.from({ length: 10 }, (_, i) => createPost("positive", i * 10, `Positive ${i}`)),
        ...Array.from({ length: 10 }, (_, i) => createPost("negative", i * 10, `Negative ${i}`)),
        ...Array.from({ length: 10 }, (_, i) => createPost("neutral", i * 10, `Neutral ${i}`)),
      ];

      const selected = selectSamplePosts(posts, 5);
      expect(selected.length).toBeLessThanOrEqual(5);
    });

    it("should truncate long text", () => {
      const longText = "A".repeat(500);
      const posts: SocialMediaPost[] = [createPost("neutral", 100, longText)];

      const selected = selectSamplePosts(posts);

      expect(selected[0]?.text.length).toBeLessThanOrEqual(280);
    });

    it("should include platform and URL in sample posts", () => {
      const posts: SocialMediaPost[] = [createPost("positive", 100, "Test post")];

      const selected = selectSamplePosts(posts);

      expect(selected[0]?.platform).toBe("twitter");
      expect(selected[0]?.url).toContain("twitter.com");
    });
  });

  // ============================================
  // Public Opinion Labeling Tests
  // Validates: Requirements 25.2, 25.8
  // ============================================

  describe("Public Opinion Labeling", () => {
    describe("validatePublicOpinionLabeling", () => {
      it("should return true for properly labeled data", () => {
        const data = {
          isPublicOpinion: true as const,
          disclaimer: PUBLIC_OPINION_DISCLAIMER,
        };

        expect(validatePublicOpinionLabeling(data)).toBe(true);
      });

      it("should return false for missing isPublicOpinion flag", () => {
        const data = {
          disclaimer: PUBLIC_OPINION_DISCLAIMER,
        };

        expect(validatePublicOpinionLabeling(data)).toBe(false);
      });

      it("should return false for false isPublicOpinion flag", () => {
        const data = {
          isPublicOpinion: false,
          disclaimer: PUBLIC_OPINION_DISCLAIMER,
        };

        expect(validatePublicOpinionLabeling(data)).toBe(false);
      });

      it("should return false for missing disclaimer", () => {
        const data = {
          isPublicOpinion: true as const,
        };

        expect(validatePublicOpinionLabeling(data)).toBe(false);
      });

      it("should return false for empty disclaimer", () => {
        const data = {
          isPublicOpinion: true as const,
          disclaimer: "",
        };

        expect(validatePublicOpinionLabeling(data)).toBe(false);
      });
    });

    describe("labelAsPublicOpinion", () => {
      it("should add disclaimer and isPublicOpinion flag to data", () => {
        const data = { someField: "value" };
        const labeled = labelAsPublicOpinion(data);

        expect(labeled.isPublicOpinion).toBe(true);
        expect(labeled.disclaimer).toBe(PUBLIC_OPINION_DISCLAIMER);
        expect(labeled.someField).toBe("value");
      });

      it("should preserve existing data", () => {
        const data = {
          politicianId: "123",
          totalMentions: 100,
          trends: [{ date: new Date(), value: 50 }],
        };

        const labeled = labelAsPublicOpinion(data);

        expect(labeled.politicianId).toBe("123");
        expect(labeled.totalMentions).toBe(100);
        expect(labeled.trends).toHaveLength(1);
      });
    });
  });

  // ============================================
  // Disclaimer Constants Tests
  // Validates: Requirements 25.2, 25.8
  // ============================================

  describe("Disclaimer Constants", () => {
    it("should have a comprehensive public opinion disclaimer", () => {
      expect(PUBLIC_OPINION_DISCLAIMER).toContain("PUBLIC OPINION");
      expect(PUBLIC_OPINION_DISCLAIMER).toContain("NOT verified fact");
      expect(PUBLIC_OPINION_DISCLAIMER).toContain("social media");
      expect(PUBLIC_OPINION_DISCLAIMER).toContain("misinformation");
    });

    it("should have a short disclaimer for compact displays", () => {
      expect(SHORT_DISCLAIMER).toContain("Public Opinion");
      expect(SHORT_DISCLAIMER).toContain("Not Verified");
      expect(SHORT_DISCLAIMER.length).toBeLessThan(50);
    });

    it("should include warning emoji in disclaimers", () => {
      expect(PUBLIC_OPINION_DISCLAIMER).toContain("⚠️");
      expect(SHORT_DISCLAIMER).toContain("⚠️");
    });
  });

  // ============================================
  // Supported Platforms Tests
  // ============================================

  describe("Supported Platforms", () => {
    it("should include major social media platforms", () => {
      expect(SUPPORTED_PLATFORMS).toContain("twitter");
      expect(SUPPORTED_PLATFORMS).toContain("facebook");
      expect(SUPPORTED_PLATFORMS).toContain("tiktok");
      expect(SUPPORTED_PLATFORMS).toContain("youtube");
      expect(SUPPORTED_PLATFORMS).toContain("reddit");
    });

    it("should have exactly 5 supported platforms", () => {
      expect(SUPPORTED_PLATFORMS.length).toBe(5);
    });
  });
});
