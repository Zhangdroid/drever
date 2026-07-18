import { DREVER_INTERNAL_SLIDE_COMPONENT, DREVER_INTERNAL_STEP_COMPONENT } from "@drever/schema";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import {
  coreComponents,
  createComponentRegistry,
  DreverRenderModeProvider,
  DreverRuntimeError,
  MDXRenderer,
  MotionGroup,
  Note,
  Slide,
  SlideStateProvider,
  Step,
  useDreverRenderMode,
  type MDXContentProps,
  type ResolvedSlideState,
  type SlideIdentity,
  type SlideStateResolver,
} from "./index.ts";

describe("core primitives", () => {
  it("renders controlled slide and step states", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Slide,
        { id: "intro", index: 0, active: true, currentStep: 2 },
        createElement(Step, { at: 1 }, "Complete"),
        createElement(Step, { at: 2 }, "Active"),
        createElement(Step, { at: 3 }, "Pending"),
        createElement(MotionGroup, { intent: "continuity" }, "Persistent"),
      ),
    );
    const sectionTag = markup.slice(0, markup.indexOf(">") + 1);

    expect(markup).toContain('data-slide-index="0"');
    expect(markup).toContain('data-slide-state="active"');
    expect(markup).toContain('data-current-step="2"');
    expect(markup).toContain('aria-current="page"');
    expect(sectionTag).toContain('tabindex="-1"');
    expect(sectionTag).not.toContain("aria-hidden");
    expect(sectionTag).not.toContain(" inert");
    expect(sectionTag).not.toContain(" hidden");
    expect(markup).toContain('data-drever-step="1" data-step-state="complete"');
    expect(markup).toContain('data-drever-step="2" data-step-state="active"');
    expect(markup).toContain('data-step-state="pending" aria-hidden="true" inert=""');
    expect(markup).toContain('style="visibility:hidden"');
    expect(markup).toContain('data-motion-intent="continuity"');
  });

  it("keeps unnumbered authoring steps visible until compilation assigns indexes", () => {
    const markup = renderToStaticMarkup(createElement(Step, { as: "span" }, "Inline"));
    expect(markup).toBe('<span data-drever-step="" data-step-state="active">Inline</span>');
  });

  it("resolves slide state from a frozen slide identity", () => {
    let observed: SlideIdentity | undefined;
    const state: ResolvedSlideState = Object.freeze({ active: true, currentStep: 2 });
    const resolver: SlideStateResolver = (slide) => {
      observed = slide;
      return state;
    };
    const markup = renderToStaticMarkup(
      createElement(
        SlideStateProvider,
        { resolver },
        createElement(Slide, { id: "details", index: 3 }, createElement(Step, { at: 2 }, "Now")),
      ),
    );

    expect(observed).toEqual({ id: "details", index: 3 });
    expect(Object.isFrozen(observed)).toBe(true);
    expect(Object.isFrozen(state)).toBe(true);
    expect(markup).toContain('data-slide-state="active"');
    expect(markup).toContain('data-current-step="2"');
    expect(markup).toContain('data-step-state="active"');
  });

  it("resolves active and currentStep independently with explicit values taking precedence", () => {
    let calls = 0;
    const explicitStepMarkup = renderToStaticMarkup(
      createElement(
        SlideStateProvider,
        {
          resolver: () => {
            calls += 1;
            return Object.freeze({ active: false, currentStep: 4 });
          },
        },
        createElement(Slide, { currentStep: 1 }, createElement(Step, { at: 1 }, "Now")),
      ),
    );
    const explicitActiveMarkup = renderToStaticMarkup(
      createElement(
        SlideStateProvider,
        {
          resolver: () => {
            calls += 1;
            return Object.freeze({ active: false, currentStep: 4 });
          },
        },
        createElement(Slide, { active: true }, createElement(Step, { at: 4 }, "Now")),
      ),
    );
    const fullyExplicitMarkup = renderToStaticMarkup(
      createElement(
        SlideStateProvider,
        {
          resolver: () => {
            calls += 1;
            return Object.freeze({ active: false, currentStep: 4 });
          },
        },
        createElement(
          Slide,
          { active: true, currentStep: 1 },
          createElement(Step, { at: 1 }, "Now"),
        ),
      ),
    );

    expect(calls).toBe(2);
    expect(explicitStepMarkup).toContain('data-slide-state="inactive"');
    expect(explicitStepMarkup).toContain('data-current-step="1"');
    expect(explicitActiveMarkup).toContain('data-slide-state="active"');
    expect(explicitActiveMarkup).toContain('data-current-step="4"');
    expect(fullyExplicitMarkup).toContain('data-slide-state="active"');
    expect(fullyExplicitMarkup).toContain('data-current-step="1"');
  });

  it("defaults to an active slide at step zero without a provider", () => {
    const markup = renderToStaticMarkup(createElement(Slide, {}, "Fresh slide"));

    expect(markup).toContain('data-slide-state="active"');
    expect(markup).toContain('data-current-step="0"');
    expect(markup).toContain('tabindex="-1"');
  });

  it("preserves an explicit slide tabIndex", () => {
    const markup = renderToStaticMarkup(
      createElement(Slide, { active: true, tabIndex: 0 }, "Focusable slide"),
    );

    expect(markup).toContain('tabindex="0"');
    expect(markup).not.toContain('tabindex="-1"');
  });

  it("marks inactive slides as hidden, inert, and outside the accessibility tree", () => {
    const markup = renderToStaticMarkup(
      createElement(
        SlideStateProvider,
        { resolver: () => Object.freeze({ active: false, currentStep: 3 }) },
        createElement(Slide, { id: "hidden-slide", index: 2 }, "Hidden content"),
      ),
    );

    expect(markup).toContain('data-slide-state="inactive"');
    expect(markup).toContain('data-current-step="3"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('inert=""');
    expect(markup).toContain('hidden=""');
    expect(markup).not.toContain("Hidden content");
  });

  it("prunes inactive slides from export renders", () => {
    const markup = renderToStaticMarkup(
      createElement(
        DreverRenderModeProvider,
        { mode: "export" },
        createElement(
          SlideStateProvider,
          {
            resolver: ({ id }) =>
              Object.freeze({ active: id === "details", currentStep: id === "details" ? 2 : 0 }),
          },
          createElement(Slide, { id: "intro", index: 0 }, "Pruned introduction"),
          createElement(Slide, { id: "details", index: 1 }, "Exported details"),
        ),
      ),
    );

    expect(markup).not.toContain("intro");
    expect(markup).not.toContain("Pruned introduction");
    expect(markup).toContain('id="details"');
    expect(markup).toContain("Exported details");
  });

  it("omits audience-only current-page and focus state from export slides", () => {
    const markup = renderToStaticMarkup(
      createElement(
        DreverRenderModeProvider,
        { mode: "export" },
        createElement(Slide, { active: true, tabIndex: 0 }, "Static page"),
      ),
    );

    expect(markup).not.toContain("aria-current");
    expect(markup).not.toContain("tabindex");
    expect(markup).toContain("Static page");
  });

  it("preserves step states in export renders", () => {
    const markup = renderToStaticMarkup(
      createElement(
        DreverRenderModeProvider,
        { mode: "export" },
        createElement(
          Slide,
          { id: "steps", active: true, currentStep: 2 },
          createElement(Step, { at: 1 }, "Complete"),
          createElement(Step, { at: 2 }, "Active"),
          createElement(Step, { at: 3 }, "Pending"),
        ),
      ),
    );

    expect(markup).toContain('data-drever-step="1" data-step-state="complete"');
    expect(markup).toContain('data-drever-step="2" data-step-state="active"');
    expect(markup).toContain('data-step-state="pending" aria-hidden="true" inert=""');
    expect(markup).toContain('style="visibility:hidden"');
  });

  it("prefixes slide IDs for repeated render instances", () => {
    const Content = () => createElement(Slide, { id: "overview" }, "Overview");
    const markup = renderToStaticMarkup(
      createElement(
        "main",
        {},
        createElement(
          DreverRenderModeProvider,
          { mode: "export", idPrefix: "page-1" },
          createElement(Content),
        ),
        createElement(
          DreverRenderModeProvider,
          { mode: "export", idPrefix: "page-2" },
          createElement(Content),
        ),
      ),
    );

    expect(markup).toContain('id="page-1-overview"');
    expect(markup).toContain('id="page-2-overview"');
    expect(markup.match(/data-slide-id="overview"/g)).toHaveLength(2);
  });

  it("rejects invalid resolver output and missing compiled Step indexes", () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(
          SlideStateProvider,
          { resolver: () => undefined as never },
          createElement(Slide, {}, "Broken"),
        ),
      ),
    ).toThrowError(expect.objectContaining({ code: "DREVER_RUNTIME_SLIDE_STATE_INVALID" }));
    expect(() =>
      renderToStaticMarkup(
        createElement(
          SlideStateProvider,
          { resolver: () => ({ active: "yes", currentStep: 0 }) as never },
          createElement(Slide, {}, "Broken"),
        ),
      ),
    ).toThrowError(expect.objectContaining({ code: "DREVER_RUNTIME_SLIDE_STATE_INVALID" }));
    expect(() =>
      renderToStaticMarkup(
        createElement(
          SlideStateProvider,
          { resolver: () => ({ active: true, currentStep: -1 }) },
          createElement(Slide, {}, "Broken"),
        ),
      ),
    ).toThrowError(expect.objectContaining({ code: "DREVER_RUNTIME_SLIDE_STATE_INVALID" }));
    expect(() =>
      renderToStaticMarkup(createElement(Slide, {}, createElement(Step, {}, "Unnumbered"))),
    ).toThrowError(expect.objectContaining({ code: "DREVER_RUNTIME_STEP_INDEX_MISSING" }));
  });

  it("rejects invalid controlled state", () => {
    expect(() => renderToStaticMarkup(createElement(Step, { at: 0 }, "Broken"))).toThrowError(
      expect.objectContaining({ code: "DREVER_RUNTIME_STEP_INDEX_INVALID" }),
    );
    expect(() =>
      renderToStaticMarkup(createElement(Slide, { currentStep: -1 }, "Broken")),
    ).toThrowError(expect.objectContaining({ code: "DREVER_RUNTIME_SLIDE_STATE_INVALID" }));
    expect(() =>
      renderToStaticMarkup(createElement(Slide, { active: "yes" as never }, "Broken")),
    ).toThrowError(expect.objectContaining({ code: "DREVER_RUNTIME_SLIDE_STATE_INVALID" }));
  });

  it("does not mount speaker notes in the audience tree", () => {
    const Child = () => {
      throw new Error("note child rendered");
    };
    expect(renderToStaticMarkup(createElement(Note, {}, createElement(Child)))).toBe("");
  });

  it("exposes an explicit render mode to side-effectful presentation components", () => {
    const Probe = () => createElement("span", {}, useDreverRenderMode());

    expect(renderToStaticMarkup(createElement(Probe))).toContain("audience");
    expect(
      renderToStaticMarkup(
        createElement(
          DreverRenderModeProvider,
          { mode: "speaker-next" },
          createElement(Probe),
          createElement(Slide, { id: "slide-2" }, "Preview"),
        ),
      ),
    ).toContain('id="speaker-next-slide-2"');
    expect(
      renderToStaticMarkup(
        createElement(DreverRenderModeProvider, { mode: "export" }, createElement(Probe)),
      ),
    ).toContain("export");
  });
});

describe("component registry", () => {
  const Heading = () => createElement("h1", {}, "Heading");
  const Cover = () => createElement("div", {}, "Cover");
  const Chart = () => createElement("figure", {}, "Chart");

  it("merges capabilities into an immutable snapshot", () => {
    const elements = { h1: Heading };
    const registry = createComponentRegistry({
      elements,
      layouts: { Cover },
      components: { Chart },
    });
    elements.h1 = () => createElement("h1", {}, "Changed");

    expect(registry.h1).toBe(Heading);
    expect(registry.Cover).toBe(Cover);
    expect(registry.Chart).toBe(Chart);
    expect(registry.Step).toBe(Step);
    expect(registry[DREVER_INTERNAL_SLIDE_COMPONENT]).toBe(Slide);
    expect(registry[DREVER_INTERNAL_STEP_COMPONENT]).toBe(Step);
    expect(
      Object.prototype.propertyIsEnumerable.call(registry, DREVER_INTERNAL_SLIDE_COMPONENT),
    ).toBe(true);
    expect(Object.isFrozen(registry)).toBe(true);
  });

  it("rejects protected names and cross-registry collisions", () => {
    expect(() => createComponentRegistry({ layouts: { Step: Cover } })).toThrowError(
      expect.objectContaining({ code: "DREVER_RUNTIME_COMPONENT_PROTECTED" }),
    );
    expect(() =>
      createComponentRegistry({ components: { [DREVER_INTERNAL_SLIDE_COMPONENT]: Chart } }),
    ).toThrowError(expect.objectContaining({ code: "DREVER_RUNTIME_COMPONENT_PROTECTED" }));
    expect(() =>
      createComponentRegistry({ components: { [DREVER_INTERNAL_STEP_COMPONENT]: Chart } }),
    ).toThrowError(expect.objectContaining({ code: "DREVER_RUNTIME_COMPONENT_PROTECTED" }));
    expect(() =>
      createComponentRegistry({ layouts: { Feature: Cover }, components: { Feature: Chart } }),
    ).toThrowError(expect.objectContaining({ code: "DREVER_RUNTIME_COMPONENT_CONFLICT" }));
  });
});

describe("MDXRenderer", () => {
  it("passes the resolved registry to compiled content", () => {
    const Content: ComponentType<MDXContentProps> = ({ components = {} }) => {
      const SlideComponent = components.Slide ?? "section";
      const StepComponent = components.Step ?? "div";
      return createElement(
        SlideComponent,
        {},
        createElement(StepComponent, { at: 1 }, "Generated content"),
      );
    };

    const markup = renderToStaticMarkup(createElement(MDXRenderer, { Content }));

    expect(markup).toContain("data-drever-slide");
    expect(markup).toContain("data-drever-step");
  });

  it("publishes an immutable primitive registry", () => {
    expect(Object.isFrozen(coreComponents)).toBe(true);
    expect(Object.keys(coreComponents)).toEqual(["MotionGroup", "Note", "Slide", "Step"]);
  });
});

describe("DreverRuntimeError", () => {
  it("carries a stable code and frozen JSON details", () => {
    const error = new DreverRuntimeError("DREVER_TEST", "Test error.", { value: 1 });
    expect(error).toMatchObject({ code: "DREVER_TEST", message: "Test error." });
    expect(Object.isFrozen(error.details)).toBe(true);
  });
});
