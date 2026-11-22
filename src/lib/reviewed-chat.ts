import type { SenateChatResult } from "./senate-chat";
import type { PublicResearchRecord } from "./case-review";
export interface ChatProfile {
  id: string;
  fullName: string;
}
export interface ReviewedChatAnswer {
  senate?: SenateChatResult;
  status:
    | "choose_profile"
    | "no_profile"
    | "records"
    | "no_reviewed_records"
    | "withheld"
    | "unavailable"
    | "profile_not_found";
  profile: ChatProfile | null;
  candidates: ChatProfile[];
  moreProfiles: boolean;
  records: PublicResearchRecord[];
  remainingRecords: number;
  checkedAt: string;
}
