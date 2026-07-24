import { describe, expect, it } from "vite-plus/test";
import { resolveSlidePreviewPosition, resolveSlideState } from "./viewer.tsx";

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

  it("uses the final authored Step for a visual slide overview", () => {
    expect(
      resolveSlidePreviewPosition({
        id: "details",
        index: 1,
        speakerNotes: [],
        stepStops: [2, 5],
      }),
    ).toEqual({ slideId: "details", slideIndex: 1, step: 5 });
    expect(
      resolveSlidePreviewPosition({
        id: "ending",
        index: 2,
        speakerNotes: [],
        stepStops: [],
      }),
    ).toEqual({ slideId: "ending", slideIndex: 2, step: 0 });
  });
});
