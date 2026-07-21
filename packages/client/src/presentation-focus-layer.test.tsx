import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  createPresentationFocusPath,
  PresentationFocusLayer,
} from "./presentation-focus-layer.tsx";
import { createPresentationFocusState, reducePresentationFocus } from "./presentation-focus.ts";

const canvas = { height: 1_080, width: 1_920 } as const;
const intro = { slideId: "intro", slideIndex: 0, step: 0 } as const;

describe("presentation focus layer", () => {
  it("projects authored points and keeps a one-point tap visible", () => {
    expect(
      createPresentationFocusPath(
        {
          id: "focus-0",
          points: [
            { x: 0.125, y: 0.25 },
            { x: 0.5, y: 0.75 },
          ],
          tool: "pen",
        },
        canvas,
      ),
    ).toBe("M 240 270 L 960 810");
    expect(
      createPresentationFocusPath(
        { id: "focus-1", points: [{ x: 0.5, y: 0.5 }], tool: "highlighter" },
        canvas,
      ),
    ).toBe("M 960 540 L 960 540");
  });

  it("keeps completed marks across Steps and gates them from another slide", () => {
    let state = createPresentationFocusState(intro, "pen");
    state = reducePresentationFocus(state, { point: { x: 0.1, y: 0.2 }, type: "begin" });
    state = reducePresentationFocus(state, { point: { x: 0.3, y: 0.4 }, type: "end" });

    const sameSlide = renderToStaticMarkup(
      <PresentationFocusLayer
        active={false}
        canvas={canvas}
        dispatch={vi.fn()}
        position={{ ...intro, step: 3 }}
        state={state}
      />,
    );
    const nextSlide = renderToStaticMarkup(
      <PresentationFocusLayer
        active={false}
        canvas={canvas}
        dispatch={vi.fn()}
        position={{ slideId: "details", slideIndex: 1, step: 0 }}
        state={state}
      />,
    );

    expect(sameSlide).toContain('data-drever-focus-stroke="focus-0"');
    expect(nextSlide).not.toContain("data-drever-focus-stroke");
  });
});
