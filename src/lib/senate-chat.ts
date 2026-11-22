import type { ReleasedFilingContext } from "./release-data";

export type ChatRecordScope = "auto" | "cases" | "senate_filings";
export interface SenateChatResult {
  status:
    | "records"
    | "choose_profile"
    | "no_profile"
    | "no_matching_filings"
    | "outside_coverage"
    | "not_loaded"
    | "needs_review"
    | "unavailable"
    | "profile_not_found";
  query: string;
  filings: ReleasedFilingContext[];
  remainingFilings: number;
  datasetUrl: string;
}
