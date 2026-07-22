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

  it("maps configured tool appearance to local CSS variables", () => {
    let state = createPresentationFocusState(intro);
    state = reducePresentationFocus(state, { point: { x: 0.5, y: 0.5 }, type: "begin" });

    const markup = renderToStaticMarkup(
      <PresentationFocusLayer
        active
        appearance={{
          highlighter: { color: "#ffe66d", opacity: 0.28, width: 30 },
          laser: { color: "#ff4567" },
          pen: { color: "var(--drever-theme-accent)", width: 7.5 },
        }}
        canvas={canvas}
        dispatch={vi.fn()}
        position={intro}
        state={state}
      />,
    );

    expect(markup).toContain("--drever-focus-pen-color:var(--drever-theme-accent)");
    expect(markup).toContain("--drever-focus-pen-width:7.5px");
    expect(markup).toContain("--drever-focus-highlighter-color:#ffe66d");
    expect(markup).toContain("--drever-focus-highlighter-opacity:0.28");
    expect(markup).toContain("--drever-focus-highlighter-width:30px");
    expect(markup).toContain("--drever-focus-laser-color:#ff4567");
    expect(markup).toContain('class="drever-presentation-focus__laser-halo"');
    expect(markup).toContain('class="drever-presentation-focus__laser-core"');
  });

  it("renders speaker marks beside local marks and follows their slide and Step scope", () => {
    let local = createPresentationFocusState(intro, "pen");
    local = reducePresentationFocus(local, { point: { x: 0.1, y: 0.2 }, type: "begin" });
    local = reducePresentationFocus(local, { point: { x: 0.3, y: 0.4 }, type: "end" });

    let remote = createPresentationFocusState(intro, "highlighter");
    remote = reducePresentationFocus(remote, { point: { x: 0.4, y: 0.5 }, type: "begin" });
    remote = reducePresentationFocus(remote, { point: { x: 0.7, y: 0.5 }, type: "end" });
    remote = reducePresentationFocus(remote, { tool: "laser", type: "selectTool" });
    remote = reducePresentationFocus(remote, { point: { x: 0.8, y: 0.25 }, type: "move" });

    const samePosition = renderToStaticMarkup(
      <PresentationFocusLayer
        active={false}
        canvas={canvas}
        dispatch={vi.fn()}
        position={intro}
        remoteState={remote}
        state={local}
      />,
    );
    const nextStep = renderToStaticMarkup(
      <PresentationFocusLayer
        active={false}
        canvas={canvas}
        dispatch={vi.fn()}
        position={{ ...intro, step: 1 }}
        remoteState={remote}
        state={local}
      />,
    );
    const nextSlide = renderToStaticMarkup(
      <PresentationFocusLayer
        active={false}
        canvas={canvas}
        dispatch={vi.fn()}
        position={{ slideId: "details", slideIndex: 1, step: 0 }}
        remoteState={remote}
        state={local}
      />,
    );

    expect(samePosition).toContain('data-focus-source="speaker"');
    expect(samePosition).toContain('data-focus-source="local"');
    expect(samePosition).toContain("data-drever-focus-laser");
    expect(nextStep).toContain('data-focus-source="speaker"');
    expect(nextStep).toContain('data-focus-source="local"');
    expect(nextStep).not.toContain("data-drever-focus-laser");
    expect(nextSlide).not.toContain("data-focus-source");
  });
});
