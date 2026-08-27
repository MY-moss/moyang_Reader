import { afterEach, describe, expect, it } from "vitest";
import { hasSeenGettingStarted, markGettingStartedSeen } from "./onboarding";

afterEach(() => localStorage.clear());

describe("getting started guide state", () => {
  it("starts unseen and remembers when dismissed", () => {
    expect(hasSeenGettingStarted()).toBe(false);

    markGettingStartedSeen();

    expect(hasSeenGettingStarted()).toBe(true);
  });

  it("does not treat unrelated values as seen", () => {
    localStorage.setItem("moyang-reader-getting-started-seen", "1");

    expect(hasSeenGettingStarted()).toBe(false);
  });
});
