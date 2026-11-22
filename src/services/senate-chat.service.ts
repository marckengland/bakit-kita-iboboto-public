import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getReleasedFiling, releaseData } from "@/lib/release-data";
import type { ChatProfile, ReviewedChatAnswer } from "@/lib/reviewed-chat";
import type { SenateChatResult } from "@/lib/senate-chat";

interface Request {
  message: string;
  politicianId?: string;
}
const normalize = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const stopWords = new Set(
  "who introduced authored does do say proposes propose purpose summary become law signed date status all a an and are bill bills senate sbn no number filed file filing filings show me selected reviewed records record the of by senator what which when was is has have did does about please s mga ang ano anong ni ng panukala na in congress 20 20th".split(
    " "
  )
);
const billPattern =
  /\b(?:sbn|senate\s+bill|bill|panukala)(?:\s+(?:no\.?|number|blg\.?))?[\s#.-]*(\d{1,5})\b/gi;
export const caseQuestion = /\b(cases?|kaso|convict(?:ed|ion)?|guilty|plunder|bribery)\b/i;
const unsupported =
  /\b(vote|iboto|best|better|rank|ranking|net worth|wealth|assets|saln|dynast(?:y|ies)|family|relatives|attendance|current office|president|safest|worst)\b/i;
function queryWords(message: string) {
  return normalize(message.replace(billPattern, " "))
    .split(" ")
    .filter((word) => word && !stopWords.has(word));
}
function namedProfiles(message: string) {
  const query = queryWords(message).join(" ");
  if (!query) {
    return [];
  }
  return releaseData.profiles.filter((profile) => {
    const aliases = [
      profile.displayName,
      ...releaseData.filings
        .filter((filing) => filing.introducedBy.profileId === profile.id)
        .map((filing) => filing.introducedBy.name),
    ];
    return aliases.some((alias) => ` ${normalize(alias)} `.includes(` ${query} `));
  });
}
export function shouldSearchSenateFilings(request: Request): boolean {
  if (caseQuestion.test(request.message)) {
    return false;
  }
  return (
    /\b(sbn|bills?|filings?|panukala)\b/i.test(request.message) ||
    namedProfiles(request.message).length > 0 ||
    releaseData.profiles.some((profile) => profile.id === request.politicianId)
  );
}
const billSelect = {
  id: true,
  billNumber: true,
  title: true,
  summary: true,
  filingDate: true,
  status: true,
  session: true,
  republicActNumber: true,
  chamber: true,
  congress: true,
  BillAuthor: { select: { politicianId: true, role: true } },
} satisfies Prisma.BillSelect;
type StoredBill = Prisma.BillGetPayload<{ select: typeof billSelect }>;
function matchesApproved(row: StoredBill, approved: (typeof releaseData.filings)[number]) {
  return (
    row.billNumber === approved.reference &&
    row.title === approved.title &&
    row.summary === approved.summary &&
    (row.filingDate?.toISOString().slice(0, 10) ?? null) === approved.filingDate &&
    row.status === null &&
    row.session === null &&
    row.republicActNumber === null &&
    row.chamber === "senate" &&
    row.congress === approved.congress &&
    row.BillAuthor.length === 1 &&
    row.BillAuthor[0]?.politicianId === approved.introducedBy.profileId &&
    row.BillAuthor[0]?.role === "introduced_by"
  );
}

/** Read-only approved facts. This path never reads cases, calls a model, or stores questions. */
export async function answerFromSenateFilings(request: Request): Promise<ReviewedChatAnswer> {
  const result: ReviewedChatAnswer = {
    status: "no_reviewed_records",
    profile: null,
    candidates: [],
    moreProfiles: false,
    records: [],
    remainingRecords: 0,
    checkedAt: new Date().toISOString(),
  };
  const senate: SenateChatResult = {
    status: "no_matching_filings",
    query: request.message,
    filings: [],
    remainingFilings: 0,
    datasetUrl: "/data/senate-20/INDEX.md",
  };
  const answer = (
    status: SenateChatResult["status"],
    extra: Partial<ReviewedChatAnswer> = {}
  ): ReviewedChatAnswer => ({
    ...result,
    ...extra,
    status:
      status === "records" ||
      status === "choose_profile" ||
      status === "no_profile" ||
      status === "unavailable" ||
      status === "profile_not_found"
        ? status
        : "no_reviewed_records",
    senate: { ...senate, status },
  });
  const congresses = [
    ...request.message.matchAll(
      /\b(?:(\d{1,2})(?:st|nd|rd|th)?\s+congress|congress\s+(\d{1,2}))\b/gi
    ),
  ].map((match) => Number(match[1] ?? match[2]));
  if (
    congresses.some((congress) => congress !== 20) ||
    unsupported.test(request.message) ||
    caseQuestion.test(request.message)
  ) {
    return answer("outside_coverage");
  }
  try {
    const authorConstraint = request.message.match(
      /\b(?:by|ni)\s+(.+?)(?=\s+(?:in|sa)\s+(?:(?:the|ang)\s+)?(?:\d{1,2}(?:st|nd|rd|th)?\s+congress|congress)|[?!.]|$)/i
    );
    const names = namedProfiles(authorConstraint?.[1] ?? request.message);
    if (authorConstraint && !names.length) {
      return answer("no_profile");
    }
    const numbers = [...request.message.matchAll(billPattern)].map((match) => Number(match[1]));
    if (new Set(numbers).size > 1) {
      return answer("outside_coverage");
    }
    const words = queryWords(
      authorConstraint ? request.message.slice(0, authorConstraint.index) : request.message
    );
    if (numbers.length && !authorConstraint && !names.length && words.length) {
      return answer("outside_coverage");
    }
    let selected: ChatProfile | null = null;
    if (request.politicianId) {
      selected = await prisma.politician.findFirst({
        where: { id: request.politicianId, isActive: true },
        select: { id: true, fullName: true },
      });
      if (!selected) {
        return answer("profile_not_found");
      }
      if (!releaseData.profiles.some((profile) => profile.id === selected!.id)) {
        return answer("outside_coverage", { profile: selected });
      }
    }
    const lookupIds =
      names.length && (!selected || !names.some((profile) => profile.id === selected!.id))
        ? names.map((profile) => profile.id)
        : selected
          ? [selected.id]
          : releaseData.profiles.map((profile) => profile.id);
    const storedProfiles = await prisma.politician.findMany({
      where: { id: { in: lookupIds }, isActive: true },
      select: { id: true, fullName: true },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
    });
    const loaded = storedProfiles.filter(
      (profile) =>
        lookupIds.includes(profile.id) &&
        releaseData.profiles.some(
          (approved) => approved.id === profile.id && approved.displayName === profile.fullName
        )
    );
    if (names.length && (!selected || !names.some((profile) => profile.id === selected!.id))) {
      const candidates = [...loaded].sort((a, b) => a.fullName.localeCompare(b.fullName));
      return answer(candidates.length ? "choose_profile" : "not_loaded", {
        candidates: candidates.slice(0, 5),
        moreProfiles: candidates.length > 5,
      });
    }
    let matching = releaseData.filings.filter(
      (filing) =>
        (!selected || filing.introducedBy.profileId === selected.id) &&
        (!numbers.length || numbers.includes(filing.billNumber))
    );
    if (!numbers.length && words.length && (!names.length || authorConstraint)) {
      matching = matching.filter((filing) => {
        const text = normalize(`${filing.title} ${filing.summary}`);
        return words.every((word) => text.includes(word));
      });
    }
    if (!matching.length) {
      return answer(
        names.length || numbers.length || selected ? "no_matching_filings" : "no_profile",
        { profile: selected }
      );
    }
    const activeIds = new Set(loaded.map((profile) => profile.id));
    matching = matching.filter((filing) => activeIds.has(filing.introducedBy.profileId));
    if (!matching.length) {
      return answer("not_loaded", { profile: selected });
    }
    const rows = await prisma.bill.findMany({
      where: { id: { in: matching.map((filing) => filing.id) } },
      select: billSelect,
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const available = matching.filter((filing) => {
      const row = rowById.get(filing.id);
      return row && matchesApproved(row, filing);
    });
    if (available.length !== matching.length) {
      return answer(
        matching.some(
          (filing) => rowById.has(filing.id) && !matchesApproved(rowById.get(filing.id)!, filing)
        )
          ? "needs_review"
          : "not_loaded",
        { profile: selected }
      );
    }
    available.sort((a, b) => a.billNumber - b.billNumber);
    senate.filings = available.slice(0, 10).map((filing) => getReleasedFiling(filing.id)!);
    senate.remainingFilings = Math.max(0, available.length - 10);
    return answer("records", { profile: selected });
  } catch {
    console.error("Reviewed Senate chat: filing lookup unavailable");
    return answer("unavailable");
  }
}
