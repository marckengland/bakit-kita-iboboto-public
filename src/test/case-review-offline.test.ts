import { expect, it } from "vitest";
import { toOfflineProfileView } from "../lib/offline-storage";
it("projects an existing saved profile without changing the stored record", () => {
  const old = {
    id: "saved",
    data: {
      fullName: "Saved person",
      photo: "/photo.png",
      currentPosition: { title: "Mayor", redFlags: ["SENTINEL"] },
      redFlags: ["SENTINEL"],
      controversies: ["SENTINEL"],
      redFlagCount: 9,
      hasRedFlags: true,
    },
    downloadedAt: "2026-11-16",
    lastSyncedAt: null,
    sizeBytes: 100,
  };
  const before = JSON.stringify(old);
  const view = toOfflineProfileView(old);
  expect(view.data.fullName).toBe("Saved person");
  expect(view.caseReviewAvailability).toBe("offline");
  expect(view.redFlagCount).toBeNull();
  expect(view.caseCount).toBeNull();
  expect(JSON.stringify(view)).not.toContain("SENTINEL");
  expect(JSON.stringify(old)).toBe(before);
});
