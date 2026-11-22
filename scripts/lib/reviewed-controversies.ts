import { randomUUID } from "node:crypto";
import type { PrismaClient, SourceType } from "@prisma/client";

export interface ReviewedSource {
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string;
  documentDate: string;
}

interface ReviewedCase {
  title: string;
  previousTitles: string[];
  description: string;
  category: "legal_case" | "corruption";
  status: "convicted" | "acquitted";
  filingDate: string | null;
  court: string;
  caseNumber?: string;
  sources: ReviewedSource[];
}

const integritySources: ReviewedSource[] = [
  {
    sourceType: "court_document",
    sourceName: "Synthetic Court Records",
    sourceUrl: "https://records.example.test/synthetic/integrity/decision",
    documentDate: "2042-06-01",
  },
  {
    sourceType: "third_party_verified",
    sourceName: "Synthetic Report Archive",
    sourceUrl: "https://reports.example.test/synthetic/integrity/reversal",
    documentDate: "2042-04-11",
  },
  {
    sourceType: "third_party_verified",
    sourceName: "Synthetic Report Archive",
    sourceUrl: "https://reports.example.test/synthetic/integrity/reconsideration",
    documentDate: "2042-05-13",
  },
];

// Invented regression data only. No real person, proceeding, or source is described.
export const reviewedCases: Record<
  "syntheticTax" | "syntheticLibel" | "syntheticPlunder" | "syntheticBribery",
  ReviewedCase
> = {
  syntheticTax: {
    title: "Synthetic failure to file income tax returns (fixture only)",
    previousTitles: [
      "Synthetic Tax evasion conviction (fixture only; old label)",
      "Synthetic income tax returns conviction (fixture only; prior label)",
    ],
    description:
      "Synthetic case SYNTHETIC-TAX-001 for Synthetic Person A. In this fictional appeal, Synthetic Appeal Court upheld the failure-to-file conviction, acquitted him of nonpayment charges, and removed imprisonment. All people, courts, dates, and events in this fixture are invented.",
    category: "legal_case",
    status: "convicted",
    filingDate: null,
    court: "Synthetic Appeal Court",
    caseNumber: "SYNTHETIC-TAX-001",
    sources: [
      {
        sourceType: "court_document",
        sourceName: "Synthetic Court Records",
        sourceUrl: "https://records.example.test/synthetic/tax/decision",
        documentDate: "2040-03-04",
      },
      {
        sourceType: "third_party_verified",
        sourceName: "Synthetic Report Archive",
        sourceUrl: "https://reports.example.test/synthetic/tax/summary",
        documentDate: "2040-03-05",
      },
    ],
  },
  syntheticLibel: {
    title: "Synthetic Libel conviction (fixture only)",
    previousTitles: [
      "Synthetic Libel conviction (fixture only; old label)",
      "Synthetic Libel conviction (fixture only; prior label)",
    ],
    description:
      "Synthetic Person B was convicted of libel in an invented proceeding concerning Synthetic Complainant D. The fictional case originated in Synthetic Trial Court Branch 7. The reviewing court substituted a fine for imprisonment. This fixture describes no real person or event.",
    category: "legal_case",
    status: "convicted",
    filingDate: "2041-02-03",
    court: "Synthetic Review Court",
    caseNumber: "SYNTHETIC-LIBEL-001",
    sources: [
      {
        sourceType: "court_document",
        sourceName: "Synthetic Court Records",
        sourceUrl: "https://records.example.test/synthetic/libel/decision",
        documentDate: "2041-05-06",
      },
      {
        sourceType: "third_party_verified",
        sourceName: "Synthetic Report Archive",
        sourceUrl: "https://reports.example.test/synthetic/libel/summary",
        documentDate: "2041-05-07",
      },
    ],
  },
  syntheticPlunder: {
    title: "Synthetic plunder charge (fixture only)",
    previousTitles: [],
    description:
      "Synthetic Person C was acquitted of plunder in a fictional proceeding. Separate graft proceedings remain distinct from this case. This fixture describes no real person or event.",
    category: "corruption",
    status: "acquitted",
    filingDate: null,
    court: "Synthetic Integrity Court",
    sources: integritySources,
  },
  syntheticBribery: {
    title: "Synthetic bribery convictions reversed (fixture only)",
    previousTitles: [
      "Synthetic bribery conviction (fixture only; old label)",
      "Synthetic bribery case (fixture only; prior label)",
    ],
    description:
      "Synthetic Person C was initially convicted of bribery in this fictional case. The court reversed the conviction on April 10, 2042. On May 12, 2042 it denied reconsideration. The final outcome is acquittal. This fixture describes no real person or event.",
    category: "corruption",
    status: "acquitted",
    filingDate: null,
    court: "Synthetic Integrity Court",
    sources: integritySources,
  },
};

export function reviewedSourceInputs(sources: ReviewedSource[]) {
  return sources.map((source) => ({
    ...source,
    id: randomUUID(),
    documentDate: new Date(source.documentDate),
    // Required by the existing schema. Zero denotes unscored, not a guessed probability.
    confidence: 0,
    isAIProcessed: true,
    fieldName: "controversy",
    retrievedAt: new Date("2042-06-02T00:00:00Z"),
  }));
}

export async function updateReviewedCase(
  prisma: PrismaClient,
  fullName: string,
  entry: ReviewedCase
) {
  return prisma.$transaction(async (tx) => {
    const people = await tx.politician.findMany({ where: { fullName }, select: { id: true } });
    if (people.length === 0) {
      return "person not found";
    }
    if (people.length !== 1) {
      throw new Error(`Ambiguous politician: ${fullName}`);
    }
    const records = await tx.controversy.findMany({
      where: { politicianId: people[0]!.id, title: { in: [entry.title, ...entry.previousTitles] } },
      select: { id: true },
    });
    if (records.length === 0) {
      return "case not found";
    }
    if (records.length !== 1) {
      throw new Error(`Ambiguous reviewed case: ${fullName} — ${entry.title}`);
    }
    const record = records[0]!;
    const { previousTitles: _previousTitles, sources, filingDate, ...fields } = entry;
    await tx.controversy.update({
      where: { id: record.id },
      data: {
        ...fields,
        filingDate: filingDate ? new Date(filingDate) : null,
        updatedAt: new Date(),
      },
    });
    for (const source of reviewedSourceInputs(sources)) {
      const existing = await tx.sourceAttribution.findFirst({
        where: { controversyId: record.id, sourceUrl: source.sourceUrl, fieldName: "controversy" },
      });
      if (!existing) {
        await tx.sourceAttribution.create({ data: { ...source, controversyId: record.id } });
      }
    }
    return "updated";
  });
}
