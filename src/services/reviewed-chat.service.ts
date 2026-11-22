import prisma from "@/lib/prisma";
import type { ReviewedChatAnswer } from "@/lib/reviewed-chat";
import { getPublicResearchBatch, publicCaseReadsEnabled } from "./public-research.service";

/** A separate, stateless reader. It never calls the general AI or conversation services. */
export async function answerFromReviewedRecords(request: {
  message: string;
  politicianId?: string;
}): Promise<ReviewedChatAnswer> {
  const result: ReviewedChatAnswer = {
    status: "withheld",
    profile: null,
    candidates: [],
    moreProfiles: false,
    records: [],
    remainingRecords: 0,
    checkedAt: new Date().toISOString(),
  };
  if (!publicCaseReadsEnabled()) {
    return result;
  }
  try {
    if (!request.politicianId) {
      const match = {
        contains: request.message.trim().replace(/[\\%_]/g, "\\$&"),
        mode: "insensitive" as const,
      };
      const profiles = await prisma.politician.findMany({
        where: {
          isActive: true,
          OR: [{ fullName: match }, { legalName: match }, { nickname: match }],
        },
        select: { id: true, fullName: true },
        orderBy: [{ fullName: "asc" }, { id: "asc" }],
        take: 6,
      });
      return {
        ...result,
        status: profiles.length ? "choose_profile" : "no_profile",
        candidates: profiles.slice(0, 5),
        moreProfiles: profiles.length > 5,
      };
    }
    const profile = await prisma.politician.findFirst({
      where: { id: request.politicianId, isActive: true },
      select: { id: true, fullName: true },
    });
    if (!profile) {
      return { ...result, status: "profile_not_found" };
    }
    const research = (await getPublicResearchBatch([profile.id])).get(profile.id);
    if (!research || research.availability === "unavailable") {
      return { ...result, status: "unavailable" };
    }
    if (research.availability === "withheld") {
      return result;
    }
    const records = [...research.records].sort((a, b) => a.id.localeCompare(b.id));
    return {
      ...result,
      status: records.length ? "records" : "no_reviewed_records",
      profile,
      records: records.slice(0, 10),
      remainingRecords: Math.max(0, records.length - 10),
    };
  } catch {
    // No query text, source payload, or database diagnostics enter the public response.
    console.error("Reviewed chat: public record lookup unavailable");
    return { ...result, status: "unavailable" };
  }
}
