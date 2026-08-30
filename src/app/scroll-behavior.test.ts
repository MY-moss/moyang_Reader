import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion, resolveProgrammaticScrollBehavior, REDUCED_MOTION_MEDIA_QUERY } from "./scroll-behavior";

const originalMatchMedia = window.matchMedia;

function mockReducedMotion(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === REDUCED_MOTION_MEDIA_QUERY && matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
});

describe("programmatic scroll behavior", () => {
  it("keeps smooth scrolling when reduced motion is not requested", () => {
    mockReducedMotion(false);

    expect(prefersReducedMotion()).toBe(false);
    expect(resolveProgrammaticScrollBehavior()).toBe("smooth");
  });

  it("uses instant scrolling when reduced motion is requested", () => {
    mockReducedMotion(true);

    expect(prefersReducedMotion()).toBe(true);
    expect(resolveProgrammaticScrollBehavior()).toBe("auto");
    expect(resolveProgrammaticScrollBehavior("auto")).toBe("auto");
  });

  it("reads the current preference for every action", () => {
    let matches = false;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: query === REDUCED_MOTION_MEDIA_QUERY && matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    expect(resolveProgrammaticScrollBehavior()).toBe("smooth");
    matches = true;
    expect(resolveProgrammaticScrollBehavior()).toBe("auto");
  });
});
