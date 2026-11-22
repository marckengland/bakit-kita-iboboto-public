/**
 * Vitest setup file - runs before any tests
 * Mocks Prisma and Redis to prevent initialization errors
 */
import { vi, beforeAll, afterAll, afterEach } from "vitest";

// Create mock Prisma client instance
const createMockPrismaClient = () => ({
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
  $transaction: vi.fn().mockImplementation((fn) => {
    if (typeof fn === "function") {
      return fn(createMockPrismaClient());
    }
    return Promise.all(fn);
  }),
  politician: {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  user: {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  bill: {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  sALNRecord: {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  electionResult: {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  redFlag: { findMany: vi.fn().mockResolvedValue([]) },
  controversy: {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  bookmark: {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
  },
  votingList: {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
  },
  notification: {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  auditLog: {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  watchdogReport: {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    upsert: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  factCheck: {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    upsert: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
});

// Create mock Redis instance
const createMockRedis = () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue("OK"),
  setex: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
  keys: vi.fn().mockResolvedValue([]),
  exists: vi.fn().mockResolvedValue(0),
  ttl: vi.fn().mockResolvedValue(-1),
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  on: vi.fn().mockReturnThis(),
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn().mockResolvedValue("OK"),
});

// Create mock cache
const createMockCache = () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(true),
  del: vi.fn().mockResolvedValue(true),
  delByPattern: vi.fn().mockResolvedValue(0),
  exists: vi.fn().mockResolvedValue(false),
  ttl: vi.fn().mockResolvedValue(-1),
  incr: vi.fn().mockResolvedValue(1),
  getOrSet: vi
    .fn()
    .mockImplementation(async (_key: string, fetcher: () => Promise<unknown>) => fetcher()),
  invalidatePolitician: vi.fn().mockResolvedValue(undefined),
  invalidateSearch: vi.fn().mockResolvedValue(undefined),
});

// Shared mock instances
const mockPrisma = createMockPrismaClient();
const mockRedis = createMockRedis();
const mockCache = createMockCache();

// Mock @prisma/client with all enums and types
vi.mock("@prisma/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prisma/client")>();
  return {
    ...actual,
    PrismaClient: vi.fn().mockImplementation(() => mockPrisma),
  };
});

// Mock @/lib/prisma
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
  default: mockPrisma,
}));

// Mock ioredis
vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => mockRedis),
  Redis: vi.fn().mockImplementation(() => mockRedis),
}));

// Mock @/lib/redis
vi.mock("@/lib/redis", () => ({
  redis: mockRedis,
  cache: mockCache,
  CACHE_KEYS: {
    POLITICIAN: "politician:",
    POLITICIAN_LIST: "politician_list:",
    BILL: "bill:",
    SALN: "saln:",
    ELECTION: "election:",
    SEARCH: "search:",
    AUTOCOMPLETE: "autocomplete:",
    SESSION: "session:",
    RATE_LIMIT: "rate_limit:",
    USER: "user:",
  },
  CACHE_TTL: {
    SHORT: 60,
    MEDIUM: 300,
    LONG: 3600,
    DAY: 86400,
    SESSION: 604800,
  },
  default: mockRedis,
}));

// Mock @/lib/elasticsearch
vi.mock("@/lib/elasticsearch", () => ({
  elasticsearch: {
    search: vi.fn().mockResolvedValue({ hits: { hits: [], total: { value: 0 } } }),
    index: vi.fn().mockResolvedValue({ result: "created" }),
    delete: vi.fn().mockResolvedValue({ result: "deleted" }),
    bulk: vi.fn().mockResolvedValue({ errors: false }),
    indices: {
      exists: vi.fn().mockResolvedValue(true),
      create: vi.fn().mockResolvedValue({ acknowledged: true }),
      delete: vi.fn().mockResolvedValue({ acknowledged: true }),
    },
  },
  default: {
    search: vi.fn().mockResolvedValue({ hits: { hits: [], total: { value: 0 } } }),
    index: vi.fn().mockResolvedValue({ result: "created" }),
    delete: vi.fn().mockResolvedValue({ result: "deleted" }),
    bulk: vi.fn().mockResolvedValue({ errors: false }),
    indices: {
      exists: vi.fn().mockResolvedValue(true),
      create: vi.fn().mockResolvedValue({ acknowledged: true }),
      delete: vi.fn().mockResolvedValue({ acknowledged: true }),
    },
  },
}));

// Global test lifecycle hooks
beforeAll(() => {
  // Set test environment. vi.stubEnv is the Vitest-native way to set env vars
  // and is restored automatically; a plain defineProperty on process.env throws
  // ("only accepts a configurable, writable, and enumerable data descriptor")
  // on current Node/Vitest.
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  // Clear all mocks between tests
  vi.clearAllMocks();
});

afterAll(() => {
  // Reset all mocks after all tests
  vi.resetAllMocks();
});

// Export mocks for tests that need to configure them
export { mockPrisma, mockRedis, mockCache };
