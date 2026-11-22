/**
 * Sentiment Analysis Service
 *
 * Aggregates social media sentiment about politicians from various platforms.
 * All data is clearly labeled as PUBLIC OPINION, not verified fact.
 *
 * **Validates: Requirements 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8**
 */

import prisma from "@/lib/prisma";
// Prisma types available if needed for JSON handling
// import { Prisma } from "@prisma/client";
import { cache, CACHE_TTL } from "@/lib/redis";

// ============================================
// Types and Interfaces
// ============================================

/**
 * Supported social media platforms for sentiment analysis
 */
export type SocialMediaPlatform = "twitter" | "facebook" | "tiktok" | "youtube" | "reddit";

/**
 * Sentiment classification
 */
export type SentimentType = "positive" | "negative" | "neutral";

/**
 * Raw social media post data
 */
export interface SocialMediaPost {
  platform: SocialMediaPlatform;
  postId: string;
  url: string;
  text: string;
  authorHandle?: string;
  sentiment: SentimentType;
  engagementCount: number;
  timestamp: Date;
}

/**
 * Sample post for display (with privacy considerations)
 */
export interface SamplePost {
  platform: SocialMediaPlatform;
  url: string;
  text: string;
  sentiment: SentimentType;
}

/**
 * Trending topic with mention count
 */
export interface TrendingTopic {
  topic: string;
  mentionCount: number;
  sentiment: SentimentType;
}

/**
 * Aggregated sentiment data for a politician
 * **IMPORTANT: This is PUBLIC OPINION data, NOT verified fact**
 * Validates: Requirements 25.1, 25.2
 */
export interface SentimentSummary {
  politicianId: string;
  politicianName?: string;

  // Sentiment breakdown (Requirement 25.3)
  positivePercentage: number;
  negativePercentage: number;
  neutralPercentage: number;

  // Volume metrics (Requirement 25.4)
  totalMentions: number;
  totalEngagement: number;

  // Trending topics (Requirement 25.5)
  trendingTopics: TrendingTopic[];

  // Sample posts with links (Requirement 25.6)
  samplePosts: SamplePost[];

  // Time range
  startDate: Date;
  endDate: Date;
  lastUpdated: Date;

  // **CRITICAL: Public opinion disclaimer (Requirements 25.2, 25.8)**
  disclaimer: string;
  isPublicOpinion: true;
}

/**
 * Sentiment trend data point for time series
 */
export interface SentimentTrendPoint {
  date: Date;
  positivePercentage: number;
  negativePercentage: number;
  neutralPercentage: number;
  totalMentions: number;
}

/**
 * Sentiment trends over time (Requirement 25.3)
 */
export interface SentimentTrends {
  politicianId: string;
  trends: SentimentTrendPoint[];
  disclaimer: string;
  isPublicOpinion: true;
}

/**
 * Configuration for social media API integration
 */
export interface SocialMediaApiConfig {
  platform: SocialMediaPlatform;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  enabled: boolean;
  rateLimit: number; // requests per hour
}

/**
 * Result from fetching social media data
 */
export interface FetchResult {
  platform: SocialMediaPlatform;
  success: boolean;
  postsFound: number;
  postsProcessed: number;
  errors: string[];
}

/**
 * Sentiment analysis job status
 */
export interface SentimentJobStatus {
  jobId: string;
  politicianId: string;
  status: "pending" | "running" | "completed" | "failed";
  platforms: SocialMediaPlatform[];
  results: FetchResult[];
  startedAt: Date;
  completedAt: Date | null;
  errors: string[];
}

// ============================================
// Constants
// ============================================

/**
 * Public opinion disclaimer - MUST be displayed with all sentiment data
 * Validates: Requirements 25.2, 25.8
 */
export const PUBLIC_OPINION_DISCLAIMER =
  "⚠️ PUBLIC OPINION DATA: This information represents aggregated social media sentiment " +
  "and is NOT verified fact. Social media posts may contain misinformation, bias, or " +
  "coordinated campaigns. This data should be considered as a reflection of online " +
  "discourse only and should not be used as the sole basis for voting decisions.";

export const SHORT_DISCLAIMER = "⚠️ Public Opinion - Not Verified Fact";

/**
 * Supported platforms for sentiment analysis
 */
export const SUPPORTED_PLATFORMS: SocialMediaPlatform[] = [
  "twitter",
  "facebook",
  "tiktok",
  "youtube",
  "reddit",
];

/**
 * Platform display names
 */
export const PLATFORM_NAMES: Record<SocialMediaPlatform, string> = {
  twitter: "X (Twitter)",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  reddit: "Reddit",
};

/**
 * Platform base URLs for constructing post links
 */
export const PLATFORM_URLS: Record<SocialMediaPlatform, string> = {
  twitter: "https://twitter.com",
  facebook: "https://facebook.com",
  tiktok: "https://tiktok.com",
  youtube: "https://youtube.com",
  reddit: "https://reddit.com",
};

const CACHE_KEY_SENTIMENT = "sentiment:";
const CACHE_KEY_TRENDS = "sentiment_trends:";
const DEFAULT_TREND_DAYS = 30;
const MAX_SAMPLE_POSTS = 10;

// ============================================
// Error Classes
// ============================================

export class SentimentAnalysisError extends Error {
  constructor(
    message: string,
    public code:
      | "API_ERROR"
      | "RATE_LIMITED"
      | "INVALID_POLITICIAN"
      | "NO_DATA"
      | "ANALYSIS_FAILED"
      | "PLATFORM_UNAVAILABLE"
  ) {
    super(message);
    this.name = "SentimentAnalysisError";
  }
}

// ============================================
// In-Memory Storage (for development/testing)
// In production, use database
// ============================================

const sentimentJobs: Map<string, SentimentJobStatus> = new Map();
const apiConfigs: Map<SocialMediaPlatform, SocialMediaApiConfig> = new Map();

// Initialize default API configs (disabled by default)
for (const platform of SUPPORTED_PLATFORMS) {
  apiConfigs.set(platform, {
    platform,
    enabled: false,
    rateLimit: 100,
  });
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a unique job ID
 */
export function generateJobId(): string {
  return `sentiment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if a platform is valid
 */
export function isValidPlatform(platform: string): platform is SocialMediaPlatform {
  return SUPPORTED_PLATFORMS.includes(platform as SocialMediaPlatform);
}

/**
 * Calculate sentiment percentages from counts
 */
export function calculateSentimentPercentages(
  positiveCount: number,
  negativeCount: number,
  neutralCount: number
): { positive: number; negative: number; neutral: number } {
  const total = positiveCount + negativeCount + neutralCount;

  if (total === 0) {
    return { positive: 0, negative: 0, neutral: 0 };
  }

  return {
    positive: Math.round((positiveCount / total) * 100 * 10) / 10,
    negative: Math.round((negativeCount / total) * 100 * 10) / 10,
    neutral: Math.round((neutralCount / total) * 100 * 10) / 10,
  };
}

/**
 * Classify sentiment from text using simple keyword analysis
 * In production, this would use a proper NLP model or API
 */
export function classifySentiment(text: string): SentimentType {
  const lowerText = text.toLowerCase();

  // Filipino and English positive keywords
  const positiveKeywords = [
    "good",
    "great",
    "excellent",
    "amazing",
    "support",
    "love",
    "best",
    "magaling",
    "galing",
    "mabuti",
    "mahusay",
    "suporta",
    "mahal",
    "honest",
    "tapat",
    "matino",
    "capable",
    "competent",
    "effective",
  ];

  // Filipino and English negative keywords
  const negativeKeywords = [
    "bad",
    "terrible",
    "corrupt",
    "worst",
    "hate",
    "fail",
    "incompetent",
    "masama",
    "pangit",
    "korap",
    "kurakot",
    "magnanakaw",
    "sinungaling",
    "trapo",
    "epal",
    "bobo",
    "tanga",
    "walang kwenta",
    "palpak",
  ];

  let positiveScore = 0;
  let negativeScore = 0;

  for (const keyword of positiveKeywords) {
    if (lowerText.includes(keyword)) {
      positiveScore++;
    }
  }

  for (const keyword of negativeKeywords) {
    if (lowerText.includes(keyword)) {
      negativeScore++;
    }
  }

  if (positiveScore > negativeScore) {
    return "positive";
  } else if (negativeScore > positiveScore) {
    return "negative";
  }
  return "neutral";
}

/**
 * Extract trending topics from posts
 */
export function extractTrendingTopics(
  posts: SocialMediaPost[],
  limit: number = 10
): TrendingTopic[] {
  const topicCounts: Map<string, { count: number; sentiments: SentimentType[] }> = new Map();

  // Extract hashtags and common phrases
  for (const post of posts) {
    // Extract hashtags
    const hashtags = post.text.match(/#\w+/g) || [];
    for (const tag of hashtags) {
      const normalizedTag = tag.toLowerCase();
      const existing = topicCounts.get(normalizedTag) || { count: 0, sentiments: [] };
      existing.count++;
      existing.sentiments.push(post.sentiment);
      topicCounts.set(normalizedTag, existing);
    }
  }

  // Sort by count and take top N
  const sorted = Array.from(topicCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit);

  return sorted.map(([topic, data]) => {
    // Determine dominant sentiment
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
    for (const s of data.sentiments) {
      sentimentCounts[s]++;
    }

    let dominantSentiment: SentimentType = "neutral";
    if (
      sentimentCounts.positive > sentimentCounts.negative &&
      sentimentCounts.positive > sentimentCounts.neutral
    ) {
      dominantSentiment = "positive";
    } else if (
      sentimentCounts.negative > sentimentCounts.positive &&
      sentimentCounts.negative > sentimentCounts.neutral
    ) {
      dominantSentiment = "negative";
    }

    return {
      topic,
      mentionCount: data.count,
      sentiment: dominantSentiment,
    };
  });
}

// ============================================
// Social Media API Integrations
// ============================================

/**
 * Base interface for social media API clients
 */
export interface SocialMediaClient {
  platform: SocialMediaPlatform;
  fetchPosts(query: string, limit: number): Promise<SocialMediaPost[]>;
  isConfigured(): boolean;
}

/**
 * Twitter/X API Client
 * In production, this would use the Twitter API v2
 */
export class TwitterClient implements SocialMediaClient {
  platform: SocialMediaPlatform = "twitter";
  private config: SocialMediaApiConfig;

  constructor(config: SocialMediaApiConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return this.config.enabled && !!this.config.apiKey && !!this.config.accessToken;
  }

  async fetchPosts(_query: string, _limit: number): Promise<SocialMediaPost[]> {
    if (!this.isConfigured()) {
      return [];
    }

    // In production: Make actual API call to Twitter API v2
    // GET https://api.twitter.com/2/tweets/search/recent?query={query}
    // Headers: Authorization: Bearer {accessToken}

    // Mock implementation for development
    return [];
  }
}

/**
 * Facebook API Client
 * In production, this would use the Facebook Graph API
 */
export class FacebookClient implements SocialMediaClient {
  platform: SocialMediaPlatform = "facebook";
  private config: SocialMediaApiConfig;

  constructor(config: SocialMediaApiConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return this.config.enabled && !!this.config.accessToken;
  }

  async fetchPosts(_query: string, _limit: number): Promise<SocialMediaPost[]> {
    if (!this.isConfigured()) {
      return [];
    }

    // In production: Make actual API call to Facebook Graph API
    // Note: Facebook has strict limitations on searching public posts

    return [];
  }
}

/**
 * TikTok API Client
 * In production, this would use the TikTok Research API
 */
export class TikTokClient implements SocialMediaClient {
  platform: SocialMediaPlatform = "tiktok";
  private config: SocialMediaApiConfig;

  constructor(config: SocialMediaApiConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return this.config.enabled && !!this.config.apiKey;
  }

  async fetchPosts(_query: string, _limit: number): Promise<SocialMediaPost[]> {
    if (!this.isConfigured()) {
      return [];
    }

    // In production: Make actual API call to TikTok Research API
    return [];
  }
}

/**
 * YouTube API Client
 * In production, this would use the YouTube Data API v3
 */
export class YouTubeClient implements SocialMediaClient {
  platform: SocialMediaPlatform = "youtube";
  private config: SocialMediaApiConfig;

  constructor(config: SocialMediaApiConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return this.config.enabled && !!this.config.apiKey;
  }

  async fetchPosts(_query: string, _limit: number): Promise<SocialMediaPost[]> {
    if (!this.isConfigured()) {
      return [];
    }

    // In production: Make actual API call to YouTube Data API
    // GET https://www.googleapis.com/youtube/v3/search?q={query}&type=video
    return [];
  }
}

/**
 * Reddit API Client
 * In production, this would use the Reddit API
 */
export class RedditClient implements SocialMediaClient {
  platform: SocialMediaPlatform = "reddit";
  private config: SocialMediaApiConfig;

  constructor(config: SocialMediaApiConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return this.config.enabled && !!this.config.apiKey && !!this.config.apiSecret;
  }

  async fetchPosts(_query: string, _limit: number): Promise<SocialMediaPost[]> {
    if (!this.isConfigured()) {
      return [];
    }

    // In production: Make actual API call to Reddit API
    // GET https://oauth.reddit.com/search?q={query}
    return [];
  }
}

// ============================================
// Client Factory
// ============================================

/**
 * Create a social media client for a platform
 */
export function createClient(platform: SocialMediaPlatform): SocialMediaClient {
  const config = apiConfigs.get(platform) || {
    platform,
    enabled: false,
    rateLimit: 100,
  };

  switch (platform) {
    case "twitter":
      return new TwitterClient(config);
    case "facebook":
      return new FacebookClient(config);
    case "tiktok":
      return new TikTokClient(config);
    case "youtube":
      return new YouTubeClient(config);
    case "reddit":
      return new RedditClient(config);
    default:
      throw new SentimentAnalysisError(`Unsupported platform: ${platform}`, "PLATFORM_UNAVAILABLE");
  }
}

/**
 * Get all configured clients
 */
export function getConfiguredClients(): SocialMediaClient[] {
  return SUPPORTED_PLATFORMS.map(createClient).filter((client) => client.isConfigured());
}

// ============================================
// API Configuration Management
// ============================================

/**
 * Configure a social media API
 */
export function configureApi(config: SocialMediaApiConfig): void {
  if (!isValidPlatform(config.platform)) {
    throw new SentimentAnalysisError(
      `Invalid platform: ${config.platform}`,
      "PLATFORM_UNAVAILABLE"
    );
  }
  apiConfigs.set(config.platform, config);
}

/**
 * Get API configuration for a platform
 */
export function getApiConfig(platform: SocialMediaPlatform): SocialMediaApiConfig | null {
  return apiConfigs.get(platform) || null;
}

/**
 * Check if any APIs are configured
 */
export function hasConfiguredApis(): boolean {
  return getConfiguredClients().length > 0;
}

// ============================================
// Sentiment Aggregation
// ============================================

/**
 * Aggregate sentiment from multiple posts
 * Validates: Requirements 25.3, 25.4
 */
export function aggregateSentiment(posts: SocialMediaPost[]): {
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  totalMentions: number;
  totalEngagement: number;
} {
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;
  let totalEngagement = 0;

  for (const post of posts) {
    switch (post.sentiment) {
      case "positive":
        positiveCount++;
        break;
      case "negative":
        negativeCount++;
        break;
      case "neutral":
        neutralCount++;
        break;
    }
    totalEngagement += post.engagementCount;
  }

  return {
    positiveCount,
    negativeCount,
    neutralCount,
    totalMentions: posts.length,
    totalEngagement,
  };
}

/**
 * Select sample posts for display
 * Validates: Requirement 25.6
 */
export function selectSamplePosts(
  posts: SocialMediaPost[],
  limit: number = MAX_SAMPLE_POSTS
): SamplePost[] {
  // Select a balanced mix of sentiments
  const positive = posts.filter((p) => p.sentiment === "positive");
  const negative = posts.filter((p) => p.sentiment === "negative");
  const neutral = posts.filter((p) => p.sentiment === "neutral");

  // Sort each by engagement
  positive.sort((a, b) => b.engagementCount - a.engagementCount);
  negative.sort((a, b) => b.engagementCount - a.engagementCount);
  neutral.sort((a, b) => b.engagementCount - a.engagementCount);

  // Take proportionally from each
  const perCategory = Math.ceil(limit / 3);
  const selected: SocialMediaPost[] = [
    ...positive.slice(0, perCategory),
    ...negative.slice(0, perCategory),
    ...neutral.slice(0, perCategory),
  ].slice(0, limit);

  return selected.map((post) => ({
    platform: post.platform,
    url: post.url,
    text: post.text.substring(0, 280), // Truncate for display
    sentiment: post.sentiment,
  }));
}

// ============================================
// Core Service Functions
// ============================================

/**
 * Get sentiment summary for a politician
 * Validates: Requirements 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.8
 *
 * @param politicianId - The politician's ID
 * @param days - Number of days to aggregate (default 30)
 * @returns Sentiment summary with PUBLIC OPINION disclaimer
 */
export async function getSentimentSummary(
  politicianId: string,
  days: number = DEFAULT_TREND_DAYS
): Promise<SentimentSummary | null> {
  // Check cache first
  const cacheKey = `${CACHE_KEY_SENTIMENT}${politicianId}:${days}`;
  const cached = await cache.get(cacheKey);
  if (cached && typeof cached === "string") {
    return JSON.parse(cached) as SentimentSummary;
  }

  // Verify politician exists
  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
    select: { id: true, fullName: true },
  });

  if (!politician) {
    return null;
  }

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Fetch sentiment data from database
  const sentimentData = await prisma.sentimentData.findMany({
    where: {
      politicianId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: "desc" },
  });

  if (sentimentData.length === 0) {
    // Return empty summary with disclaimer
    const emptySummary: SentimentSummary = {
      politicianId,
      politicianName: politician.fullName,
      positivePercentage: 0,
      negativePercentage: 0,
      neutralPercentage: 0,
      totalMentions: 0,
      totalEngagement: 0,
      trendingTopics: [],
      samplePosts: [],
      startDate,
      endDate,
      lastUpdated: new Date(),
      disclaimer: PUBLIC_OPINION_DISCLAIMER,
      isPublicOpinion: true,
    };
    return emptySummary;
  }

  // Aggregate data
  let totalPositive = 0;
  let totalNegative = 0;
  let totalNeutral = 0;
  let totalMentions = 0;
  const allTopics: TrendingTopic[] = [];
  const allSamplePosts: SamplePost[] = [];

  for (const data of sentimentData) {
    totalPositive += data.positiveCount;
    totalNegative += data.negativeCount;
    totalNeutral += data.neutralCount;
    totalMentions += data.totalMentions;

    // Parse trending topics
    if (data.trendingTopics) {
      const topics = data.trendingTopics as unknown as TrendingTopic[];
      allTopics.push(...topics);
    }

    // Parse sample posts
    if (data.samplePosts) {
      const posts = data.samplePosts as unknown as SamplePost[];
      allSamplePosts.push(...posts);
    }
  }

  const percentages = calculateSentimentPercentages(totalPositive, totalNegative, totalNeutral);

  // Deduplicate and sort trending topics
  const topicMap = new Map<string, TrendingTopic>();
  for (const topic of allTopics) {
    const existing = topicMap.get(topic.topic);
    if (existing) {
      existing.mentionCount += topic.mentionCount;
    } else {
      topicMap.set(topic.topic, { ...topic });
    }
  }
  const trendingTopics = Array.from(topicMap.values())
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, 10);

  // Select diverse sample posts
  const samplePosts = allSamplePosts.slice(0, MAX_SAMPLE_POSTS);

  const latestData = sentimentData[0];

  const summary: SentimentSummary = {
    politicianId,
    politicianName: politician.fullName,
    positivePercentage: percentages.positive,
    negativePercentage: percentages.negative,
    neutralPercentage: percentages.neutral,
    totalMentions,
    totalEngagement: 0, // Would be calculated from actual engagement data
    trendingTopics,
    samplePosts,
    startDate,
    endDate,
    lastUpdated: latestData?.createdAt || new Date(),
    disclaimer: PUBLIC_OPINION_DISCLAIMER,
    isPublicOpinion: true,
  };

  // Cache for 1 hour
  await cache.set(cacheKey, JSON.stringify(summary), CACHE_TTL.SHORT);

  return summary;
}

/**
 * Get sentiment trends over time for a politician
 * Validates: Requirement 25.3
 *
 * @param politicianId - The politician's ID
 * @param days - Number of days to include (default 30)
 * @returns Sentiment trends with PUBLIC OPINION disclaimer
 */
export async function getSentimentTrends(
  politicianId: string,
  days: number = DEFAULT_TREND_DAYS
): Promise<SentimentTrends | null> {
  // Check cache first
  const cacheKey = `${CACHE_KEY_TRENDS}${politicianId}:${days}`;
  const cached = await cache.get(cacheKey);
  if (cached && typeof cached === "string") {
    return JSON.parse(cached) as SentimentTrends;
  }

  // Verify politician exists
  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
    select: { id: true },
  });

  if (!politician) {
    return null;
  }

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Fetch sentiment data
  const sentimentData = await prisma.sentimentData.findMany({
    where: {
      politicianId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: "asc" },
  });

  const trends: SentimentTrendPoint[] = sentimentData.map((data) => {
    const percentages = calculateSentimentPercentages(
      data.positiveCount,
      data.negativeCount,
      data.neutralCount
    );

    return {
      date: data.date,
      positivePercentage: percentages.positive,
      negativePercentage: percentages.negative,
      neutralPercentage: percentages.neutral,
      totalMentions: data.totalMentions,
    };
  });

  const result: SentimentTrends = {
    politicianId,
    trends,
    disclaimer: PUBLIC_OPINION_DISCLAIMER,
    isPublicOpinion: true,
  };

  // Cache for 1 hour
  await cache.set(cacheKey, JSON.stringify(result), CACHE_TTL.SHORT);

  return result;
}

/**
 * Get trending topics across all politicians
 * Validates: Requirement 25.5
 */
export async function getGlobalTrendingTopics(
  limit: number = 20
): Promise<{ topics: TrendingTopic[]; disclaimer: string; isPublicOpinion: true }> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7); // Last 7 days

  const sentimentData = await prisma.sentimentData.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      trendingTopics: true,
    },
  });

  // Aggregate all topics
  const topicMap = new Map<string, TrendingTopic>();

  for (const data of sentimentData) {
    if (data.trendingTopics) {
      const topics = data.trendingTopics as unknown as TrendingTopic[];
      for (const topic of topics) {
        const existing = topicMap.get(topic.topic);
        if (existing) {
          existing.mentionCount += topic.mentionCount;
        } else {
          topicMap.set(topic.topic, { ...topic });
        }
      }
    }
  }

  const topics = Array.from(topicMap.values())
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, limit);

  return {
    topics,
    disclaimer: SHORT_DISCLAIMER,
    isPublicOpinion: true,
  };
}

// ============================================
// Data Pipeline Integration
// ============================================

/**
 * Fetch and analyze sentiment for a politician from all configured platforms
 * Validates: Requirement 25.7
 *
 * @param politicianId - The politician's ID
 * @param politicianName - The politician's name for search queries
 * @returns Job status
 */
export async function fetchSentimentData(
  politicianId: string,
  politicianName: string
): Promise<SentimentJobStatus> {
  const jobId = generateJobId();
  const platforms = SUPPORTED_PLATFORMS.filter((p) => {
    const config = apiConfigs.get(p);
    return config?.enabled;
  });

  const job: SentimentJobStatus = {
    jobId,
    politicianId,
    status: "pending",
    platforms,
    results: [],
    startedAt: new Date(),
    completedAt: null,
    errors: [],
  };

  sentimentJobs.set(jobId, job);

  // Update status to running
  job.status = "running";

  const allPosts: SocialMediaPost[] = [];

  // Fetch from each configured platform
  for (const platform of platforms) {
    try {
      const client = createClient(platform);
      const posts = await client.fetchPosts(politicianName, 100);

      // Classify sentiment for each post
      const classifiedPosts = posts.map((post) => ({
        ...post,
        sentiment: classifySentiment(post.text),
      }));

      allPosts.push(...classifiedPosts);

      job.results.push({
        platform,
        success: true,
        postsFound: posts.length,
        postsProcessed: classifiedPosts.length,
        errors: [],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      job.results.push({
        platform,
        success: false,
        postsFound: 0,
        postsProcessed: 0,
        errors: [errorMessage],
      });
      job.errors.push(`${platform}: ${errorMessage}`);
    }
  }

  // Aggregate and store results
  if (allPosts.length > 0) {
    const aggregated = aggregateSentiment(allPosts);
    const trendingTopics = extractTrendingTopics(allPosts);
    const samplePosts = selectSamplePosts(allPosts);

    // Store in database
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.sentimentData.upsert({
      where: {
        politicianId_date: {
          politicianId,
          date: today,
        },
      },
      update: {
        positiveCount: aggregated.positiveCount,
        negativeCount: aggregated.negativeCount,
        neutralCount: aggregated.neutralCount,
        totalMentions: aggregated.totalMentions,
        trendingTopics: JSON.parse(JSON.stringify(trendingTopics)),
        samplePosts: JSON.parse(JSON.stringify(samplePosts)),
      },
      create: {
        id: crypto.randomUUID(),
        politicianId,
        date: today,
        positiveCount: aggregated.positiveCount,
        negativeCount: aggregated.negativeCount,
        neutralCount: aggregated.neutralCount,
        totalMentions: aggregated.totalMentions,
        trendingTopics: JSON.parse(JSON.stringify(trendingTopics)),
        samplePosts: JSON.parse(JSON.stringify(samplePosts)),
      },
    });

    // Invalidate cache
    await cache.del(`${CACHE_KEY_SENTIMENT}${politicianId}:*`);
    await cache.del(`${CACHE_KEY_TRENDS}${politicianId}:*`);
  }

  job.status = job.errors.length === 0 ? "completed" : "failed";
  job.completedAt = new Date();

  return job;
}

/**
 * Fetch sentiment data for all active politicians
 * Validates: Requirement 25.7
 */
export async function fetchAllSentimentData(): Promise<SentimentJobStatus[]> {
  const politicians = await prisma.politician.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true },
  });

  const jobs: SentimentJobStatus[] = [];

  for (const politician of politicians) {
    try {
      const job = await fetchSentimentData(politician.id, politician.fullName);
      jobs.push(job);
    } catch (err) {
      console.error(`Failed to fetch sentiment for ${politician.fullName}:`, err);
    }
  }

  return jobs;
}

/**
 * Get job status
 */
export function getJobStatus(jobId: string): SentimentJobStatus | null {
  return sentimentJobs.get(jobId) || null;
}

// ============================================
// Comparison Support
// ============================================

/**
 * Compare sentiment between multiple politicians
 * Validates: Requirements 25.1, 25.2
 */
export async function compareSentiment(
  politicianIds: string[],
  days: number = DEFAULT_TREND_DAYS
): Promise<{
  comparisons: SentimentSummary[];
  disclaimer: string;
  isPublicOpinion: true;
}> {
  const comparisons: SentimentSummary[] = [];

  for (const id of politicianIds) {
    const summary = await getSentimentSummary(id, days);
    if (summary) {
      comparisons.push(summary);
    }
  }

  return {
    comparisons,
    disclaimer: PUBLIC_OPINION_DISCLAIMER,
    isPublicOpinion: true,
  };
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate that sentiment data is properly labeled as public opinion
 * This is a runtime check to ensure compliance with Requirements 25.2, 25.8
 */
export function validatePublicOpinionLabeling<
  T extends { isPublicOpinion?: boolean; disclaimer?: string },
>(data: T): boolean {
  return (
    data.isPublicOpinion === true &&
    typeof data.disclaimer === "string" &&
    data.disclaimer.length > 0
  );
}

/**
 * Add public opinion labeling to any sentiment data
 */
export function labelAsPublicOpinion<T>(
  data: T
): T & { disclaimer: string; isPublicOpinion: true } {
  return {
    ...data,
    disclaimer: PUBLIC_OPINION_DISCLAIMER,
    isPublicOpinion: true as const,
  };
}
