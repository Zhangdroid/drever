import { describe, expect, it } from "vite-plus/test";
import { PRESENTATION_TRANSITION_TYPES } from "./view-transition.ts";

describe("presentation transition types", () => {
  it("exposes stable L2 transition types", () => {
    expect(PRESENTATION_TRANSITION_TYPES).toEqual([
      "drever-step-forward",
      "drever-step-backward",
      "drever-slide-forward",
      "drever-slide-backward",
      "drever-jump-forward",
      "drever-jump-backward",
    ]);
    expect(Object.isFrozen(PRESENTATION_TRANSITION_TYPES)).toBe(true);
  });
});
