export const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;

  try {
    return window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches;
  } catch {
    return false;
  }
}

export function resolveProgrammaticScrollBehavior(preferred: ScrollBehavior = "smooth"): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : preferred;
}
