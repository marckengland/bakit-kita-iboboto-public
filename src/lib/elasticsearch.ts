import { Client, estypes } from "@elastic/elasticsearch";
import { logger } from "./logger";

type IndicesIndexSettings = estypes.IndicesIndexSettings;
type MappingTypeMapping = estypes.MappingTypeMapping;

// Global Elasticsearch instance for singleton pattern in development
const globalForElasticsearch = globalThis as unknown as {
  elasticsearch: Client | undefined;
};

/**
 * Elasticsearch client configuration for full-text search
 * Uses singleton pattern to prevent multiple connections in development
 */
function createElasticsearchClient(): Client {
  const elasticsearchUrl = process.env.ELASTICSEARCH_URL || "http://localhost:59202";

  const client = new Client({
    node: elasticsearchUrl,
    maxRetries: 3,
    requestTimeout: 30000,
    sniffOnStart: false,
  });

  return client;
}

export const elasticsearch = globalForElasticsearch.elasticsearch ?? createElasticsearchClient();

if (process.env.NODE_ENV !== "production") {
  globalForElasticsearch.elasticsearch = elasticsearch;
}

// Index names
export const INDICES = {
  POLITICIANS: "politicians",
  BILLS: "bills",
} as const;

/**
 * Politician index settings for full-text search and autocomplete
 */
export const POLITICIAN_INDEX_SETTINGS: IndicesIndexSettings = {
  number_of_shards: 1,
  number_of_replicas: 0,
  analysis: {
    analyzer: {
      filipino_analyzer: {
        type: "custom",
        tokenizer: "standard",
        filter: ["lowercase", "asciifolding", "filipino_stemmer"],
      },
      autocomplete_analyzer: {
        type: "custom",
        tokenizer: "autocomplete_tokenizer",
        filter: ["lowercase", "asciifolding"],
      },
      autocomplete_search_analyzer: {
        type: "custom",
        tokenizer: "standard",
        filter: ["lowercase", "asciifolding"],
      },
    },
    tokenizer: {
      autocomplete_tokenizer: {
        type: "edge_ngram",
        min_gram: 1,
        max_gram: 20,
        token_chars: ["letter", "digit"],
      },
    },
    filter: {
      filipino_stemmer: {
        type: "stemmer",
        language: "english",
      },
    },
  },
};

/**
 * Politician index mappings for search across names, positions, locations, and parties
 */
export const POLITICIAN_INDEX_MAPPINGS: MappingTypeMapping = {
  properties: {
    id: { type: "keyword" },
    fullName: {
      type: "text",
      analyzer: "filipino_analyzer",
      fields: {
        autocomplete: {
          type: "text",
          analyzer: "autocomplete_analyzer",
          search_analyzer: "autocomplete_search_analyzer",
        },
        keyword: { type: "keyword" },
      },
    },
    firstName: {
      type: "text",
      analyzer: "filipino_analyzer",
      fields: {
        autocomplete: {
          type: "text",
          analyzer: "autocomplete_analyzer",
          search_analyzer: "autocomplete_search_analyzer",
        },
      },
    },
    middleName: { type: "text", analyzer: "filipino_analyzer" },
    lastName: {
      type: "text",
      analyzer: "filipino_analyzer",
      fields: {
        autocomplete: {
          type: "text",
          analyzer: "autocomplete_analyzer",
          search_analyzer: "autocomplete_search_analyzer",
        },
      },
    },
    suffix: { type: "keyword" },
    nickname: {
      type: "text",
      analyzer: "filipino_analyzer",
      fields: {
        autocomplete: {
          type: "text",
          analyzer: "autocomplete_analyzer",
          search_analyzer: "autocomplete_search_analyzer",
        },
        keyword: { type: "keyword" },
      },
    },
    currentPosition: {
      type: "object",
      properties: {
        title: {
          type: "text",
          analyzer: "filipino_analyzer",
          fields: {
            keyword: { type: "keyword" },
            autocomplete: {
              type: "text",
              analyzer: "autocomplete_analyzer",
              search_analyzer: "autocomplete_search_analyzer",
            },
          },
        },
        level: { type: "keyword" },
        jurisdiction: {
          type: "text",
          analyzer: "filipino_analyzer",
          fields: {
            keyword: { type: "keyword" },
            autocomplete: {
              type: "text",
              analyzer: "autocomplete_analyzer",
              search_analyzer: "autocomplete_search_analyzer",
            },
          },
        },
      },
    },
    currentParty: {
      type: "object",
      properties: {
        name: {
          type: "text",
          analyzer: "filipino_analyzer",
          fields: {
            keyword: { type: "keyword" },
            autocomplete: {
              type: "text",
              analyzer: "autocomplete_analyzer",
              search_analyzer: "autocomplete_search_analyzer",
            },
          },
        },
        abbreviation: { type: "keyword" },
      },
    },
    region: {
      type: "text",
      analyzer: "filipino_analyzer",
      fields: { keyword: { type: "keyword" } },
    },
    province: {
      type: "text",
      analyzer: "filipino_analyzer",
      fields: { keyword: { type: "keyword" } },
    },
    city: {
      type: "text",
      analyzer: "filipino_analyzer",
      fields: { keyword: { type: "keyword" } },
    },
    isActive: { type: "boolean" },
    hasRedFlags: { type: "boolean" },
    photo: { type: "keyword", index: false },
    popularityScore: { type: "float" },
    createdAt: { type: "date" },
    updatedAt: { type: "date" },
  },
};

/**
 * Bill index settings for legislative search
 */
export const BILL_INDEX_SETTINGS: IndicesIndexSettings = {
  number_of_shards: 1,
  number_of_replicas: 0,
  analysis: {
    analyzer: {
      filipino_analyzer: {
        type: "custom",
        tokenizer: "standard",
        filter: ["lowercase", "asciifolding"],
      },
    },
  },
};

/**
 * Bill index mappings for legislative search
 */
export const BILL_INDEX_MAPPINGS: MappingTypeMapping = {
  properties: {
    id: { type: "keyword" },
    billNumber: { type: "keyword" },
    title: {
      type: "text",
      analyzer: "filipino_analyzer",
      fields: { keyword: { type: "keyword" } },
    },
    summary: { type: "text", analyzer: "filipino_analyzer" },
    fullText: { type: "text", analyzer: "filipino_analyzer" },
    status: { type: "keyword" },
    chamber: { type: "keyword" },
    republicActNumber: { type: "keyword" },
    filingDate: { type: "date" },
    authorIds: { type: "keyword" },
    authorNames: { type: "text", analyzer: "filipino_analyzer" },
  },
};

/**
 * Initialize Elasticsearch indices
 * Creates indices if they don't exist
 */
export async function initializeIndices(): Promise<void> {
  try {
    // Check and create politicians index
    const politiciansExists = await elasticsearch.indices.exists({
      index: INDICES.POLITICIANS,
    });

    if (!politiciansExists) {
      await elasticsearch.indices.create({
        index: INDICES.POLITICIANS,
        settings: POLITICIAN_INDEX_SETTINGS,
        mappings: POLITICIAN_INDEX_MAPPINGS,
      });
      logger.info(`Created index: ${INDICES.POLITICIANS}`);
    }

    // Check and create bills index
    const billsExists = await elasticsearch.indices.exists({
      index: INDICES.BILLS,
    });

    if (!billsExists) {
      await elasticsearch.indices.create({
        index: INDICES.BILLS,
        settings: BILL_INDEX_SETTINGS,
        mappings: BILL_INDEX_MAPPINGS,
      });
      logger.info(`Created index: ${INDICES.BILLS}`);
    }
  } catch (error) {
    console.error("Error initializing Elasticsearch indices:", error);
    throw error;
  }
}

/**
 * Check Elasticsearch connection health
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const health = await elasticsearch.cluster.health();
    return health.status !== "red";
  } catch (error) {
    console.error("Elasticsearch health check failed:", error);
    return false;
  }
}

export default elasticsearch;
