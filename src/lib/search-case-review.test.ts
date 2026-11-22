import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ politician: { findMany: vi.fn() } }));
const es = vi.hoisted(() => ({ search: vi.fn() }));
const cached = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
const reader = vi.hoisted(() => ({ getPublicRedFlagsBatch: vi.fn() }));
vi.mock("./prisma", () => ({ default: db }));
vi.mock("./elasticsearch", () => ({ default: es, INDICES: { POLITICIANS: "people" } }));
vi.mock("./redis", () => ({
  cache: cached,
  CACHE_KEYS: { SEARCH: "search" },
  CACHE_TTL: { SHORT: 10 },
}));
vi.mock("@/services/public-research.service", () => reader);
import { searchService } from "./search";
beforeEach(() => {
  vi.resetAllMocks();
  cached.get.mockResolvedValue({
    results: [{ politician: { id: "stale", hasRedFlags: true } }],
    total: 1,
  });
  db.politician.findMany.mockResolvedValue([{ id: "held" }, { id: "public" }]);
  reader.getPublicRedFlagsBatch.mockImplementation(
    async (ids: readonly string[]) =>
      new Map(ids.map((id) => [id, id === "public" ? [{ id: "reviewed" }] : []]))
  );
  es.search.mockResolvedValue({
    hits: {
      hits: [
        { _source: { id: "held", fullName: "A", hasRedFlags: true }, _score: 1 },
        { _source: { id: "public", fullName: "B", hasRedFlags: false }, _score: 1 },
      ],
      total: { value: 2 },
    },
  });
});
it("recomputes indexed flags and ignores stale cached case signals", async () => {
  const result = await searchService.search("name");
  expect(result.results.map((r) => r.politician.hasRedFlags)).toEqual([false, true]);
  expect(cached.get).not.toHaveBeenCalled();
  expect(cached.set).not.toHaveBeenCalled();
});
it("constrains eligibility in the search engine before its pagination and totals", async () => {
  es.search.mockResolvedValue({
    hits: { hits: [{ _source: { id: "public", hasRedFlags: false } }], total: { value: 1 } },
  });
  const result = await searchService.search("name", { hasRedFlags: true }, 1, 1);
  expect(es.search.mock.calls[0]?.[0].query.bool.filter).toContainEqual({
    terms: { id: ["public"] },
  });
  expect(result.total).toBe(1);
  expect(result.results[0]?.politician.hasRedFlags).toBe(true);
});
