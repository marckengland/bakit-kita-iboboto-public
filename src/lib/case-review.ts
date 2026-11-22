import { createHash } from "node:crypto";
import type {
  Controversy,
  CaseEvent,
  SourceAttribution,
  ResearchRecordKind,
  ResearchSubjectRole,
  ReviewedCaseOutcome,
  CaseEventKind,
  CaseReliefType,
  CaseEvidenceBasis,
  CaseFinality,
  ControversyCategory,
  SourceType,
} from "@prisma/client";
import type { RedFlagData } from "../services/red-flag.service";

export interface CaseReviewPacket {
  record: Controversy;
  events: CaseEvent[];
  sources: SourceAttribution[];
}
export interface ReviewIssue {
  code: string;
  recordId: string;
  eventId?: string;
  sourceId?: string;
}
export interface PublicSource {
  id: string;
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string;
  documentDate: string | null;
  retrievedAt: string;
  confidence: number | null;
  isAIProcessed: boolean;
  evidenceLocator: string | null;
}
export interface PublicCaseEvent {
  id: string;
  kind: CaseEventKind;
  outcome: ReviewedCaseOutcome | null;
  relief: CaseReliefType | null;
  evidenceBasis: CaseEvidenceBasis;
  finality: CaseFinality;
  date: { value: string; precision: "year" | "month" | "day" } | null;
  jurisdiction: string | null;
  court: string | null;
  caseNumber: string | null;
  summary: string;
  sources: PublicSource[];
}
interface PublicRecordBase {
  id: string;
  politicianId: string;
  title: string;
  description: string;
  category: ControversyCategory;
  recordKind: ResearchRecordKind;
  subjectRole: ResearchSubjectRole;
  reviewedAt: string;
  sources: PublicSource[];
  events: PublicCaseEvent[];
}
export type PublicCaseRecord = PublicRecordBase & {
  section: "case";
  outcomeEventId: string;
  outcome: { value: ReviewedCaseOutcome; label: string };
  relief: { eventId: string; type: CaseReliefType; label: string }[];
};
export type PublicContextRecord = PublicRecordBase & { section: "context"; contextLabel: string };
export type PublicResearchRecord = PublicCaseRecord | PublicContextRecord;
export type PublicCaseFlag = RedFlagData & { relatedEntityType: "controversy" };
export type PublicResearchEnvelope =
  | {
      schemaVersion: 2;
      availability: "available";
      records: PublicResearchRecord[];
      totals: { cases: number; context: number };
    }
  | { schemaVersion: 2; availability: "withheld" | "unavailable"; records: []; totals: null };
export function withheldResearch(): PublicResearchEnvelope {
  return { schemaVersion: 2, availability: "withheld", records: [], totals: null };
}
export function unavailableResearch(): PublicResearchEnvelope {
  return { schemaVersion: 2, availability: "unavailable", records: [], totals: null };
}

export function parseCaseDate(value: string | null): PublicCaseEvent["date"] {
  if (value === null) {
    return null;
  }
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!match || Number(match[1]) === 0) {
    throw new Error("Invalid case date");
  }
  const year = +match[1]!;
  const month = match[2] ? +match[2] : 1;
  const day = match[3] ? +match[3] : 1;
  const date = new Date(
    `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00Z`
  );
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Invalid case date");
  }
  return { value, precision: match[3] ? "day" : match[2] ? "month" : "year" };
}
const recordFields = [
  "id",
  "politicianId",
  "title",
  "description",
  "category",
  "status",
  "filingDate",
  "resolutionDate",
  "court",
  "caseNumber",
  "recordKind",
  "subjectRole",
  "outcomeEventId",
  "reviewNote",
] as const;
const eventFields = [
  "id",
  "controversyId",
  "kind",
  "outcome",
  "relief",
  "evidenceBasis",
  "finality",
  "eventDate",
  "jurisdiction",
  "court",
  "caseNumber",
  "summary",
  "selectedRelief",
  "appliesToEventId",
] as const;
const sourceFields = [
  "id",
  "controversyId",
  "caseEventId",
  "politicianId",
  "fieldName",
  "sourceType",
  "sourceName",
  "sourceUrl",
  "documentDate",
  "retrievedAt",
  "isAIProcessed",
  "originalDocumentId",
  "evidenceLocator",
  "positionId",
  "partyAffiliationId",
  "billId",
  "votingRecordId",
  "sessionAttendanceId",
  "salnRecordId",
  "electionResultRecordId",
  "campaignFinanceId",
  "projectId",
  "campaignPromiseId",
  "familyRelationshipId",
  "redFlagId",
  "educationId",
] as const;
function canonical(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : (value ?? null);
}
function ordered<T extends { id: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
export function caseContentHash(packet: CaseReviewPacket): string {
  const r = packet.record;
  const tuple = [
    "case-review-v1",
    recordFields.map((key) => canonical(r[key])),
    [...(r.approvedSourceIds ?? [])].sort(),
    [...(r.independentSourceIds ?? [])].sort(),
    ordered(packet.events).map((e) => eventFields.map((key) => canonical(e[key]))),
    ordered(packet.sources).map((s) => [
      ...sourceFields.map((key) => canonical(s[key])),
      s.confidence === null ? null : Number(s.confidence).toFixed(2),
    ]),
  ];
  return createHash("sha256").update(JSON.stringify(tuple), "utf8").digest("hex");
}
const rolePairs: Record<ResearchRecordKind, readonly ResearchSubjectRole[]> = {
  criminal_case: ["accused", "claimant"],
  civil_case: ["civil_defendant", "claimant"],
  administrative_case: ["administrative_respondent", "claimant"],
  public_context: ["misinformation_target", "relative_or_associate", "commentator"],
};
const outcomes: Record<ResearchRecordKind, readonly ReviewedCaseOutcome[]> = {
  criminal_case: ["pending", "convicted", "acquitted", "dismissed"],
  civil_case: ["pending", "civil_liability", "civil_no_liability", "dismissed", "settled"],
  administrative_case: [
    "pending",
    "administrative_liability",
    "administrative_no_liability",
    "dismissed",
  ],
  public_context: [],
};
export function validateCaseReview(packet: CaseReviewPacket): ReviewIssue[] {
  const { record: r, events, sources } = packet;
  const issues: ReviewIssue[] = [];
  const fail = (code: string, eventId?: string, sourceId?: string) => {
    issues.push({
      code,
      recordId: r.id,
      ...(eventId ? { eventId } : {}),
      ...(sourceId ? { sourceId } : {}),
    });
  };
  if (!r.recordKind || !r.subjectRole || !rolePairs[r.recordKind]?.includes(r.subjectRole)) {
    fail("classification");
  }
  if (!r.title.trim() || !r.description.trim() || !r.reviewNote?.trim()) {
    fail("wording");
  }
  const ids = r.approvedSourceIds ?? [];
  const independent = r.independentSourceIds ?? [];
  if (
    ids.length < 2 ||
    new Set(ids).size !== ids.length ||
    independent.length !== 2 ||
    new Set(independent).size !== 2 ||
    !independent.every((id) => ids.includes(id))
  ) {
    fail("source_selection");
  }
  const selected = sources.filter((s) => ids.includes(s.id));
  if (selected.length !== ids.length) {
    fail("missing_source");
  }
  for (const source of sources) {
    if (source.controversyId !== r.id) {
      fail("source_owner", undefined, source.id);
    }
  }
  const urls = new Map<string, string>();
  for (const s of selected) {
    if (
      s.controversyId !== r.id ||
      (s.politicianId !== null && s.politicianId !== r.politicianId) ||
      (s.caseEventId !== null &&
        !events.some((e) => e.id === s.caseEventId && e.controversyId === r.id))
    ) {
      fail("source_owner", undefined, s.id);
    }
    if (s.caseEventId && (s.politicianId !== null || s.fieldName !== "caseEvent")) {
      fail("source_owner", undefined, s.id);
    }
    if (
      [
        s.positionId,
        s.partyAffiliationId,
        s.billId,
        s.votingRecordId,
        s.sessionAttendanceId,
        s.salnRecordId,
        s.electionResultRecordId,
        s.campaignFinanceId,
        s.projectId,
        s.campaignPromiseId,
        s.familyRelationshipId,
        s.redFlagId,
        s.educationId,
      ].some((id) => id !== null)
    ) {
      fail("source_owner", undefined, s.id);
    }
    if (!s.evidenceLocator?.trim()) {
      fail("evidence_locator", undefined, s.id);
    }
    try {
      const url = new URL(s.sourceUrl ?? "");
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        (url.pathname === "/" && !url.search)
      ) {
        throw Error();
      }
      url.hash = "";
      urls.set(s.id, url.href);
    } catch {
      fail("source_url", undefined, s.id);
    }
  }
  if (
    independent.length === 2 &&
    (!urls.has(independent[0]!) || urls.get(independent[0]!) === urls.get(independent[1]!))
  ) {
    fail("independent_sources");
  }
  for (const e of events) {
    if (e.controversyId !== r.id) {
      fail("event_owner", e.id);
    }
    if (!e.summary.trim() || !e.jurisdiction?.trim() || !e.evidenceBasis) {
      fail("event_evidence", e.id);
    }
    if (!selected.some((s) => s.caseEventId === e.id)) {
      fail("event_citation", e.id);
    }
    try {
      parseCaseDate(e.eventDate);
    } catch {
      fail("event_date", e.id);
    }
    if (
      e.relief &&
      (!e.appliesToEventId || (e.appliesToEventId === r.outcomeEventId && !e.selectedRelief))
    ) {
      fail("unrepresented_relief", e.id);
    }
    if (e.relief && e.kind !== "clemency") {
      fail("relief_kind", e.id);
    }
    if (["filing", "clemency", "enforcement"].includes(e.kind) && e.outcome !== null) {
      fail("outcome_scope", e.id);
    }
    if (e.kind === "judgment" && !e.outcome) {
      fail("judgment_outcome", e.id);
    }
    if (e.outcome && r.recordKind && !outcomes[r.recordKind]?.includes(e.outcome)) {
      fail("outcome_kind", e.id);
    }
    if (e.outcome === "pending" && (e.kind !== "status_report" || !e.eventDate)) {
      fail("pending_evidence", e.id);
    }
    if (
      e.selectedRelief &&
      (e.kind !== "clemency" ||
        !e.relief ||
        e.appliesToEventId !== r.outcomeEventId ||
        !events.some(
          (t) =>
            t.id === e.appliesToEventId &&
            t.outcome === "convicted" &&
            ["judgment", "appeal"].includes(t.kind)
        ))
    ) {
      fail("relief_scope", e.id);
    }
    if (
      e.appliesToEventId &&
      (!events.some((t) => t.id === e.appliesToEventId) || e.appliesToEventId === e.id)
    ) {
      fail("relief_owner", e.id);
    }
  }
  const context = r.recordKind === "public_context" || r.subjectRole === "claimant";
  const outcome = events.find((e) => e.id === r.outcomeEventId);
  if (
    !context &&
    (!outcome ||
      !outcome.outcome ||
      !["judgment", "appeal", "status_report"].includes(outcome.kind))
  ) {
    fail("selected_outcome");
  }
  if (r.recordKind === "public_context" && r.outcomeEventId !== null) {
    fail("context_outcome");
  }
  return issues;
}
function approved(value: {
  reviewState: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
}): boolean {
  return (
    value.reviewState === "approved" &&
    !!value.reviewedBy?.trim() &&
    value.reviewedAt instanceof Date &&
    Number.isFinite(value.reviewedAt.getTime())
  );
}
function publicSource(s: SourceAttribution): PublicSource {
  return {
    id: s.id,
    sourceType: s.sourceType,
    sourceName: s.sourceName,
    sourceUrl: s.sourceUrl!,
    documentDate: s.documentDate?.toISOString() ?? null,
    retrievedAt: s.retrievedAt.toISOString(),
    confidence: s.confidence === null ? null : Number(s.confidence),
    isAIProcessed: s.isAIProcessed,
    evidenceLocator: s.evidenceLocator,
  };
}
const labels: Record<ReviewedCaseOutcome, string> = {
  pending: "Case reported pending",
  convicted: "Criminal conviction",
  acquitted: "Acquitted",
  dismissed: "Case dismissed",
  settled: "Settlement recorded",
  civil_liability: "Civil liability judgment",
  civil_no_liability: "Civil judgment: no liability",
  administrative_liability: "Administrative liability finding",
  administrative_no_liability: "Administrative finding: no liability",
};
const reliefLabels: Record<CaseReliefType, string> = {
  absolute_pardon: "Absolute pardon recorded",
  conditional_pardon: "Conditional pardon recorded",
  commutation: "Sentence commutation recorded",
};
export function projectPublicRecord(packet: CaseReviewPacket): PublicResearchRecord | null {
  try {
    const r = packet.record;
    const selected = packet.sources.filter((s) => r.approvedSourceIds?.includes(s.id));
    if (
      !approved(r) ||
      !packet.events.every(approved) ||
      !selected.every(approved) ||
      validateCaseReview(packet).length ||
      r.approvedContentHash !== caseContentHash(packet)
    ) {
      return null;
    }
    const events: PublicCaseEvent[] = ordered(packet.events).map((e) => ({
      id: e.id,
      kind: e.kind,
      outcome: e.outcome,
      relief: e.relief,
      evidenceBasis: e.evidenceBasis!,
      finality: e.finality,
      date: parseCaseDate(e.eventDate),
      jurisdiction: e.jurisdiction,
      court: e.court,
      caseNumber: e.caseNumber,
      summary: e.summary,
      sources: ordered(selected.filter((s) => s.caseEventId === e.id)).map(publicSource),
    }));
    const base = {
      id: r.id,
      politicianId: r.politicianId,
      title: r.title,
      description: r.description,
      category: r.category,
      recordKind: r.recordKind!,
      subjectRole: r.subjectRole!,
      reviewedAt: r.reviewedAt!.toISOString(),
      sources: ordered(selected).map(publicSource),
      events,
    };
    if (r.recordKind === "public_context" || r.subjectRole === "claimant") {
      const contextLabels: Partial<Record<ResearchSubjectRole, string>> = {
        misinformation_target: "Misinformation targeting this person",
        relative_or_associate: "Context about relatives or associates",
        commentator: "Public response or commentary",
        claimant: "Case context: claimant",
      };
      return { ...base, section: "context", contextLabel: contextLabels[r.subjectRole!]! };
    }
    const e = events.find((e) => e.id === r.outcomeEventId)!;
    let label = labels[e.outcome!];
    if (e.outcome === "convicted" && e.finality !== "final") {
      label = "Conviction; finality not established";
    }
    if (e.outcome === "pending") {
      label += ` as of ${e.date!.value}`;
    }
    if (e.evidenceBasis === "attributed_reporting") {
      label += " — reported";
    }
    return {
      ...base,
      section: "case",
      outcomeEventId: e.id,
      outcome: { value: e.outcome!, label },
      relief: packet.events
        .filter((e) => e.selectedRelief)
        .map((e) => ({
          eventId: e.id,
          type: e.relief!,
          label:
            reliefLabels[e.relief!] +
            (e.evidenceBasis === "attributed_reporting" ? " — reported" : ""),
        })),
    };
  } catch {
    return null;
  }
}
export function derivePublicCaseFlag(record: PublicCaseRecord): PublicCaseFlag | null {
  const event = record.events.find((e) => e.id === record.outcomeEventId);
  if (!event) {
    return null;
  }
  const severity = record.relief.length
    ? "info"
    : event.outcome === "convicted" &&
        event.finality === "final" &&
        event.evidenceBasis === "primary_document"
      ? "critical"
      : event.outcome === "pending"
        ? "warning"
        : "info";
  return {
    id: `case:${record.id}`,
    politicianId: record.politicianId,
    type: record.category === "corruption" ? "corruption" : "legal_case",
    severity,
    title:
      record.outcome.label +
      (record.relief.length ? `; ${record.relief.map((r) => r.label).join("; ")}` : ""),
    description: record.description,
    relatedEntityId: record.id,
    relatedEntityType: "controversy",
    eventDate: event.date?.precision === "day" ? new Date(`${event.date.value}T00:00:00Z`) : null,
    createdAt: new Date(record.reviewedAt),
    sources: record.sources.map((s) => ({
      ...s,
      documentDate: s.documentDate ? new Date(s.documentDate) : null,
      retrievedAt: new Date(s.retrievedAt),
      originalDocumentId: null,
    })),
  };
}
