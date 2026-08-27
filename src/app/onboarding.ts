const gettingStartedSeenKey = "moyang-reader-getting-started-seen";

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
