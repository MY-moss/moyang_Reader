import { describe, expect, it } from "vitest";
import { isCurrentWorkspaceLoad, isSelfWrittenChangePending } from "./workspace-refresh";

describe("workspace refresh guards", () => {
  it("accepts only the latest request for the active folder", () => {
    expect(isCurrentWorkspaceLoad(3, 3, "C:/Vault", "c:\\vault\\")).toBe(true);
    expect(isCurrentWorkspaceLoad(2, 3, "C:/Vault", "C:/Vault")).toBe(false);
    expect(isCurrentWorkspaceLoad(3, 3, "C:/Other", "C:/Vault")).toBe(false);
  });

  it("ignores a self-written file event only before its deadline", () => {
    expect(isSelfWrittenChangePending(1_500, 1_499)).toBe(true);
    expect(isSelfWrittenChangePending(1_500, 1_500)).toBe(false);
    expect(isSelfWrittenChangePending(undefined, 1_499)).toBe(false);
  });
});
