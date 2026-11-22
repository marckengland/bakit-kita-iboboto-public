import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../i18n/messages/en.json";
import { PoliticianDirectory } from "../app/politicians/components/PoliticianDirectory";
import { searchService } from "../lib/search";
import { listPoliticians } from "../services/politician.service";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/politicians",
}));
vi.mock("../lib/search", () => ({ searchService: { search: vi.fn() } }));
vi.mock("../services/politician.service", () => ({ listPoliticians: vi.fn() }));

const page = {
  items: [{ id: "fictional-a", fullName: "Synthetic Candidate A", hasRedFlags: false }],
  totalCount: 1,
  page: 1,
  pageSize: 12,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

async function renderDirectory(searchParams: Record<string, string>) {
  const content = await PoliticianDirectory({ searchParams });
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: "en",
      messages,
      timeZone: "UTC",
      children: content,
    })
  );
}

describe("directory recovery", () => {
  beforeEach(() => {
    vi.mocked(searchService.search).mockReset();
    vi.mocked(listPoliticians).mockReset();
  });

  it("keeps name search and filters usable when full-text search fails", async () => {
    vi.mocked(searchService.search).mockRejectedValue(new Error("Search unavailable"));
    vi.mocked(listPoliticians).mockResolvedValue(page);
    const html = await renderDirectory({ q: "Synthetic", position: "Mayor", city: "Fixture City" });
    expect(html).toContain("Synthetic Candidate A");
    expect(html).toContain("name matches");
    expect(listPoliticians).toHaveBeenCalledWith(
      { name: "Synthetic", position: "Mayor", city: "Fixture City" },
      { page: 1, pageSize: 12 }
    );
  });

  it("distinguishes an unavailable database from an empty result", async () => {
    vi.mocked(searchService.search).mockRejectedValue(new Error("Search unavailable"));
    vi.mocked(listPoliticians).mockRejectedValue(new Error("Database unavailable"));
    const html = await renderDirectory({ q: "Synthetic", level: "national" });
    expect(html).toContain("temporarily unavailable");
    expect(html).not.toContain("No results found");
    expect(html).toContain("Synthetic");
    expect(html).toContain("level=national");
  });

  it("keeps a successful empty search distinct from an outage", async () => {
    vi.mocked(searchService.search).mockResolvedValue({ results: [], total: 0 });
    const html = await renderDirectory({ q: "No Such Synthetic Name" });
    expect(html).toContain("No results found");
    expect(html).not.toContain("temporarily unavailable");
    expect(listPoliticians).not.toHaveBeenCalled();
  });
});
