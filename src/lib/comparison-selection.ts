import type { ComparisonResult, PoliticianSummary } from "@/services/comparison.service";

export function parseComparisonIds(value: string | null | undefined): string[] {
  return [
    ...new Set(
      value
        ?.split(",")
        .map((id) => id.trim())
        .filter(Boolean) ?? []
    ),
  ];
}

export async function loadComparisonSelection(
  ids: string[],
  signal: AbortSignal,
  request: typeof fetch = fetch
): Promise<{ politicians: PoliticianSummary[]; comparison: ComparisonResult | null }> {
  signal.throwIfAborted();
  if (ids.length === 0) {
    return { politicians: [], comparison: null };
  }
  const url =
    ids.length === 1
      ? `/api/politicians/${encodeURIComponent(ids[0]!)}`
      : `/api/compare?${new URLSearchParams({ ids: ids.join(",") })}`;
  const response = await request(url, { signal, cache: "no-store" });
  const data = await response.json();
  signal.throwIfAborted();
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Selected profiles are unavailable"
    );
  }
  if (ids.length === 1) {
    if (!data.politician?.id) {
      throw new Error("Selected profile is unavailable");
    }
    const profile = data.politician;
    return {
      politicians: [
        {
          id: profile.id,
          fullName: profile.fullName,
          photo: profile.photo ?? undefined,
          currentPosition: profile.currentPosition ?? undefined,
        },
      ],
      comparison: null,
    };
  }
  if (!Array.isArray(data.politicians)) {
    throw new Error("Comparison is unavailable");
  }
  return { politicians: data.politicians, comparison: data };
}
