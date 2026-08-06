import type { MDXContent } from "@drever/core";
import { DREVER_INTERNAL_SLIDE_COMPONENT, DECK_MANIFEST_VERSION } from "@drever/schema";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import { RenderErrorBoundary, renderErrorBoundaryShouldReset } from "./render-error-boundary.tsx";
import { ViewerRenderFailure, ViewerSurface } from "./viewer-surface.tsx";

describe("RenderErrorBoundary", () => {
  it("replaces only its owned children and reports the caught render error", () => {
    const error = new Error("Chart labels must be finite numbers.");
    const onError = vi.fn();
    const boundary = new RenderErrorBoundary({
      children: createElement("span", null, "Authored slide"),
      fallback: (caught) => createElement("strong", null, (caught as Error).message),
      onError,
      resetKeys: ["slide-13", 0],
    });

    expect(renderToStaticMarkup(boundary.render())).toContain("Authored slide");
    boundary.state = RenderErrorBoundary.getDerivedStateFromError(error);
    boundary.componentDidCatch(error, { componentStack: "\n    at BrokenChart" });

    expect(renderToStaticMarkup(boundary.render())).toContain(
      "Chart labels must be finite numbers.",
    );
    expect(onError).toHaveBeenCalledWith(error, {
      componentStack: "\n    at BrokenChart",
    });
  });

  it("retries only when an explicit render identity changes", () => {
    expect(renderErrorBoundaryShouldReset(["slide-13", 0], ["slide-13", 0])).toBe(false);
    expect(renderErrorBoundaryShouldReset(["slide-13", 0], ["slide-13", 1])).toBe(true);
    expect(renderErrorBoundaryShouldReset(undefined, ["slide-13"])).toBe(true);
  });
});

describe("ViewerRenderFailure", () => {
  const slide = {
    id: "evidence",
    index: 12,
    speakerNotes: [],
    stepStops: [],
    title: "Evidence that needs repair",
  } as const;

  it("keeps the live draft useful and exposes actionable detail during development", () => {
    const markup = renderToStaticMarkup(
      <ViewerRenderFailure
        error={new TypeError("Cannot read chart width")}
        showDetails
        slide={slide}
      />,
    );

    expect(markup).toContain('data-drever-render-failure=""');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Draft slide 13 could not render");
    expect(markup).toContain("The viewer is still running");
    expect(markup).toContain("TypeError: Cannot read chart width");
  });

  it("does not expose authored exception details in production fallback copy", () => {
    const markup = renderToStaticMarkup(
      <ViewerRenderFailure
        error={new Error("Private source detail")}
        showDetails={false}
        slide={slide}
      />,
    );

    expect(markup).toContain("This slide could not render");
    expect(markup).not.toContain("Private source detail");
    expect(markup).not.toContain("<pre>");
  });
});

describe("ViewerSurface render isolation", () => {
  it("keeps the protected compiled Slide while wrapping its authored children", () => {
    const Content: MDXContent = ({ components }) => {
      const CompiledSlide = components?.[DREVER_INTERNAL_SLIDE_COMPONENT];
      if (CompiledSlide === undefined) throw new Error("Missing protected slide component.");
      return createElement(
        CompiledSlide,
        { id: "intro", index: 0 },
        createElement("h1", null, "Healthy authored content"),
      );
    };
    const manifest = {
      version: DECK_MANIFEST_VERSION,
      slides: [{ id: "intro", index: 0, speakerNotes: [], stepStops: [], title: "Intro" }],
    } as const;

    const markup = renderToStaticMarkup(
      <ViewerSurface
        Content={Content}
        manifest={manifest}
        position={{ slideId: "intro", slideIndex: 0, step: 0 }}
      />,
    );

    expect(markup).toContain('data-drever-slide=""');
    expect(markup).toContain('data-slide-id="intro"');
    expect(markup).toContain("Healthy authored content");
  });
});
