import { describe, expect, it } from "vite-plus/test";
import { resolveSlideState } from "./viewer.tsx";

describe("Viewer state resolution", () => {
  it("activates only the identified current slide", () => {
    const current = { slideId: "two", slideIndex: 1, step: 3 };

    expect(resolveSlideState(current, { id: "two", index: 1 })).toEqual({
      active: true,
      currentStep: 3,
    });
    expect(resolveSlideState(current, { id: "one", index: 0 })).toEqual({
      active: false,
      currentStep: 0,
    });
    expect(resolveSlideState(current, {})).toEqual({ active: false, currentStep: 0 });
  });
});
