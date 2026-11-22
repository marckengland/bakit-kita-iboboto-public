/**
 * Social Sharing Utilities (Client-safe)
 *
 * These functions can be safely used in client components.
 * Requirements: 42.6
 */

/**
 * Social sharing platform types
 */
export type SocialPlatform = "facebook" | "twitter" | "linkedin" | "copy";

/**
 * Generate share URL for different platforms
 * Validates: Requirement 42.6
 */
export function generateShareUrl(
  platform: SocialPlatform,
  url: string,
  title: string,
  description?: string
): string {
  const encodedUrl = encodeURIComponent(url);

  switch (platform) {
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case "twitter": {
      const tweetText = description ? `${title} - ${description}` : title;
      return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodeURIComponent(tweetText)}`;
    }
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    case "copy":
      return url;
    default:
      return url;
  }
}

/**
 * Generate share text for different contexts
 */
export function generateShareText(
  type: "profile" | "comparison" | "voting-list",
  data: {
    politicianName?: string;
    politicianNames?: string[];
    electionYear?: number;
    count?: number;
  }
): { title: string; description: string } {
  switch (type) {
    case "profile":
      return {
        title: `${data.politicianName} - Politician Profile`,
        description: `View the complete profile of ${data.politicianName} on Bakit Kita Iboboto? - Philippine Political Transparency Platform`,
      };
    case "comparison":
      const names = data.politicianNames?.join(" vs ") || "Politicians";
      return {
        title: `Politician Comparison: ${names}`,
        description: `Compare ${names} side-by-side on Bakit Kita Iboboto? - Philippine Political Transparency Platform`,
      };
    case "voting-list":
      return {
        title: `My Voting List for ${data.electionYear} Elections`,
        description: `I've selected ${data.count} candidates for the ${data.electionYear} elections. Check out my voting list on Bakit Kita Iboboto?`,
      };
    default:
      return {
        title: "Bakit Kita Iboboto?",
        description: "Philippine Political Transparency Platform",
      };
  }
}
