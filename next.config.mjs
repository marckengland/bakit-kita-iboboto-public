import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * CDN Configuration for Static Assets
 * Validates: Requirement 44.4 - Use CDN to serve static assets efficiently across the Philippines
 *
 * In production, set NEXT_PUBLIC_CDN_URL to your CDN endpoint (e.g., Cloudflare, AWS CloudFront)
 * Example: NEXT_PUBLIC_CDN_URL=https://cdn.bakitkitaiboboto.ph
 */
const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // CDN configuration for static assets
  assetPrefix: cdnUrl || undefined,

  // Image optimization with CDN support
  images: {
    // Allow images from CDN domain
    remotePatterns: [
      // CDN domain for optimized images
      ...(cdnUrl
        ? [
            {
              protocol: "https",
              hostname: new URL(cdnUrl).hostname,
              pathname: "/**",
            },
          ]
        : []),
      // Government sources for politician photos
      {
        protocol: "https",
        hostname: "**.gov.ph",
        pathname: "/**",
      },
      // COMELEC for candidate photos
      {
        protocol: "https",
        hostname: "comelec.gov.ph",
        pathname: "/**",
      },
      // Senate website
      {
        protocol: "https",
        hostname: "**.senate.gov.ph",
        pathname: "/**",
      },
      // House of Representatives
      {
        protocol: "https",
        hostname: "**.congress.gov.ph",
        pathname: "/**",
      },
    ],
    // Optimize images for Philippine network conditions
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400, // 24 hours cache for images
  },

  // Compression for better performance
  compress: true,

  // Generate ETags for caching
  generateEtags: true,

  // Headers for caching static assets
  async headers() {
    return [
      {
        // Cache static assets aggressively
        source: "/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache images
        source: "/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        // Cache fonts
        source: "/:all*(woff|woff2|ttf|otf|eot)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache JS and CSS with versioning
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // API responses can contain private data, including authentication errors.
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store",
          },
        ],
      },
    ];
  },

  // Experimental features for better performance
  experimental: {
    // Enable optimized package imports
    optimizePackageImports: ["@heroicons/react", "date-fns", "lodash"],
  },

  // Output configuration for deployment
  output: "standalone",

  // Power by header disabled for security
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);
