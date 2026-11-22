import { expect, it, vi } from "vitest";
import { loadComparisonSelection, parseComparisonIds } from "./comparison-selection";

it("normalizes URL selections without losing the single-profile state", () => {
  expect(parseComparisonIds(" a, b,,a, ")).toEqual(["a", "b"]);
  expect(parseComparisonIds("a")).toEqual(["a"]);
  expect(parseComparisonIds(null)).toEqual([]);
});

it("keeps a single profile selected without inventing comparison results", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      politician: {
        id: "synthetic-a",
        fullName: "Synthetic Candidate A",
        photo: null,
        currentPosition: null,
      },
    })
  );
  const result = await loadComparisonSelection(
    ["synthetic-a"],
    new AbortController().signal,
    request
  );
  expect(result.politicians).toEqual([
    {
      id: "synthetic-a",
      fullName: "Synthetic Candidate A",
      photo: undefined,
      currentPosition: undefined,
    },
  ]);
  expect(result.comparison).toBeNull();
});

it("clears the selection when the URL has no IDs", async () => {
  const request = vi.fn<typeof fetch>();
  expect(await loadComparisonSelection([], new AbortController().signal, request)).toEqual({
    politicians: [],
    comparison: null,
  });
  expect(request).not.toHaveBeenCalled();
});

it("rejects a stale response even when transport ignores cancellation", async () => {
  const controller = new AbortController();
  const request = vi.fn<typeof fetch>().mockImplementation(async () => {
    controller.abort();
    return Response.json({ politicians: [{ id: "stale" }], comparison: {} });
  });
  await expect(
    loadComparisonSelection(["a", "b"], controller.signal, request)
  ).rejects.toMatchObject({ name: "AbortError" });
});

it("reports a missing selected profile instead of silently dropping it", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ error: "Not found" }, { status: 404 }));
  await expect(
    loadComparisonSelection(["missing"], new AbortController().signal, request)
  ).rejects.toThrow("Not found");
});
