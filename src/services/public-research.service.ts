import prisma from "@/lib/prisma";
import {
  derivePublicCaseFlag,
  projectPublicRecord,
  withheldResearch,
  type PublicResearchEnvelope,
  type PublicResearchRecord,
} from "@/lib/case-review";
import type { RedFlagData } from "./red-flag.service";

// This selection must remain usable before the additive review migration.
export const legacySourceSelect = {
  id: true,
  sourceType: true,
  sourceName: true,
  sourceUrl: true,
  documentDate: true,
  retrievedAt: true,
  confidence: true,
  isAIProcessed: true,
  originalDocumentId: true,
  fieldName: true,
  politicianId: true,
  controversyId: true,
} as const;
export function publicCaseReadsEnabled(): boolean {
  return process.env.PUBLIC_CASE_RECORDS_ENABLED === "true";
}
export class PublicResearchUnavailableError extends Error {
  constructor() {
    super("Reviewed research is temporarily unavailable");
    this.name = "PublicResearchUnavailableError";
  }
}
export async function getPublicResearchBatch(
  ids: readonly string[]
): Promise<Map<string, PublicResearchEnvelope>> {
  const result = new Map<string, PublicResearchEnvelope>();
  const unique = [...new Set(ids)];
  for (const id of unique) {
    result.set(
      id,
      publicCaseReadsEnabled()
        ? {
            schemaVersion: 2,
            availability: "available",
            records: [],
            totals: { cases: 0, context: 0 },
          }
        : withheldResearch()
    );
  }
  if (!unique.length || !publicCaseReadsEnabled()) {
    return result;
  }
  try {
    for (let i = 0; i < unique.length; i += 500) {
      const rows = await prisma.controversy.findMany({
        where: { politicianId: { in: unique.slice(i, i + 500) } },
        include: { CaseEvent: true, SourceAttribution: true },
      });
      for (const row of rows) {
        const record = projectPublicRecord({
          record: row,
          events: row.CaseEvent,
          sources: row.SourceAttribution,
        });
        if (!record) {
          continue;
        }
        const envelope = result.get(row.politicianId);
        if (envelope?.availability === "available") {
          envelope.records.push(record);
          envelope.totals[record.section === "case" ? "cases" : "context"]++;
        }
      }
    }
    for (const e of result.values()) {
      e.records.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    }
    return result;
  } catch {
    throw new PublicResearchUnavailableError();
  }
}
export function isStoredCaseFlag(flag: {
  type: string;
  relatedEntityType?: string | null;
}): boolean {
  return (
    flag.type === "legal_case" ||
    flag.type === "corruption" ||
    flag.relatedEntityType?.toLowerCase() === "controversy"
  );
}
export function caseActivityDays(records: readonly PublicResearchRecord[]): string[] {
  return records
    .filter((r) => r.section === "case")
    .flatMap((r) => r.events.flatMap((e) => (e.date?.precision === "day" ? [e.date.value] : [])));
}
export async function getPublicRedFlagsBatch(
  ids: readonly string[]
): Promise<Map<string, RedFlagData[]>> {
  const result = new Map([...new Set(ids)].map((id) => [id, [] as RedFlagData[]]));
  if (!result.size) {
    return result;
  }
  try {
    const research = await getPublicResearchBatch([...result.keys()]);
    for (const [id, e] of research) {
      for (const r of e.records) {
        if (r.section === "case") {
          const flag = derivePublicCaseFlag(r);
          if (flag) {
            result.get(id)!.push(flag);
          }
        }
      }
    }
    const unique = [...result.keys()];
    for (let i = 0; i < unique.length; i += 500) {
      const flags = await prisma.redFlag.findMany({
        where: { politicianId: { in: unique.slice(i, i + 500) } },
        include: { SourceAttribution: { select: legacySourceSelect } },
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      });
      for (const flag of flags) {
        if (isStoredCaseFlag(flag)) {
          continue;
        }
        const target = result.get(flag.politicianId);
        if (!target) {
          continue;
        }
        target.push({
          id: flag.id,
          politicianId: flag.politicianId,
          type: flag.type,
          severity: flag.severity,
          title: flag.title,
          description: flag.description,
          relatedEntityId: flag.relatedEntityId,
          relatedEntityType: flag.relatedEntityType,
          createdAt: flag.createdAt,
          eventDate: null,
          sources: flag.SourceAttribution.filter(
            (s) => !s.controversyId && !/controversy|caseevent/i.test(s.fieldName)
          ).map((s) => ({
            ...s,
            confidence: s.confidence === null ? null : Number(s.confidence),
          })),
        });
      }
    }
    const rank = { critical: 0, warning: 1, info: 2 };
    for (const flags of result.values()) {
      flags.sort((a, b) => rank[a.severity] - rank[b.severity]);
    }
    return result;
  } catch {
    throw new PublicResearchUnavailableError();
  }
}
