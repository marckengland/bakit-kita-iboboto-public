"use client";
import { useState, useSyncExternalStore } from "react";
/** A disconnect invalidates the current page's review check until it is reloaded. */
export function createReviewConnectionStore() {
  let valid = true;
  return {
    getSnapshot: () => valid && navigator.onLine,
    subscribe: (notify: () => void) => {
      const disconnect = () => {
        valid = false;
        notify();
      };
      window.addEventListener("offline", disconnect);
      return () => window.removeEventListener("offline", disconnect);
    },
  };
}
export function useOnlineReview() {
  const [store] = useState(createReviewConnectionStore);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => true);
}
