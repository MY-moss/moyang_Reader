import { PERSISTED_STORAGE_KEYS } from "./compatibility-contract";

const gettingStartedSeenKey = PERSISTED_STORAGE_KEYS.gettingStartedSeen;

export function hasSeenGettingStarted(): boolean {
  try {
    return localStorage.getItem(gettingStartedSeenKey) === "true";
  } catch {
    return false;
  }
}

export function markGettingStartedSeen(): void {
  try {
    localStorage.setItem(gettingStartedSeenKey, "true");
  } catch {
    // The guide remains available from Settings when browser storage is unavailable.
  }
}
