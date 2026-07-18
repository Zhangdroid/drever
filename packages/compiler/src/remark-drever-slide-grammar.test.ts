import { DREVER_INTERNAL_SLIDE_COMPONENT, DREVER_INTERNAL_STEP_COMPONENT } from "@drever/schema";
import type { Root, RootContent } from "mdast";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vite-plus/test";
import { remarkDreverSlideGrammar } from "./remark-drever-slide-grammar.ts";

type SlideNode = Extract<RootContent, { type: "mdxJsxFlowElement" }>;
type StepNode = Extract<RootContent, { type: "mdxJsxFlowElement" | "mdxJsxTextElement" }>;

const transform = async (source: string): Promise<Root> => {
  const processor = unified().use(remarkParse).use(remarkMdx).use(remarkDreverSlideGrammar);
  return processor.run(processor.parse(source), {
    path: "slides.mdx",
    value: source,
  }) as Promise<Root>;
};

const isSlide = (node: RootContent): node is SlideNode =>
  node.type === "mdxJsxFlowElement" && node.name === DREVER_INTERNAL_SLIDE_COMPONENT;

const getSlides = (tree: Root): SlideNode[] => tree.children.filter(isSlide);

const getSteps = (slide: SlideNode): StepNode[] => {
  const steps: StepNode[] = [];
  const visit = (node: RootContent): void => {
    if (
      (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
      node.name === "Step"
    ) {
      steps.push(node);
    }

    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children as RootContent[]) {
        visit(child);
      }
    }
  };

  for (const child of slide.children as RootContent[]) {
    visit(child);
  }

  return steps;
};

const atValue = (step: StepNode): string | null | undefined => {
  const attribute = step.attributes.find(
    (candidate) => candidate.type === "mdxJsxAttribute" && candidate.name === "at",
  );
  const value = attribute?.value;
  return typeof value === "object" && value !== null ? value.value : value;
};

describe("remarkDreverSlideGrammar", () => {
  it("wraps an unsegmented document in an identified, zero-indexed internal Slide", async () => {
    const tree = await transform("# Hello\n\nWelcome to Drever.");
    const slide = getSlides(tree)[0];

    expect(tree.children).toHaveLength(1);
    expect(slide).toMatchObject({
      type: "mdxJsxFlowElement",
      name: DREVER_INTERNAL_SLIDE_COMPONENT,
      attributes: [
        { type: "mdxJsxAttribute", name: "id", value: "slide-1" },
        {
          type: "mdxJsxAttribute",
          name: "index",
          value: {
            type: "mdxJsxAttributeValueExpression",
            value: "0",
            data: {
              estree: {
                type: "Program",
                sourceType: "module",
                body: [
                  {
                    type: "ExpressionStatement",
                    expression: { type: "Literal", value: 0, raw: "0" },
                  },
                ],
              },
            },
          },
        },
      ],
      children: [{ type: "heading", depth: 1 }, { type: "paragraph" }],
    });
  });

  it("numbers implicit flow and text Steps in depth-first document order", async () => {
    const tree = await transform(`<Step>
  First
</Step>

Inline <Step>Second</Step> and <span><Step>Third</Step></span>.`);
    const steps = getSteps(getSlides(tree)[0] as SlideNode);

    expect(steps.map((step) => step.type)).toEqual([
      "mdxJsxFlowElement",
      "mdxJsxTextElement",
      "mdxJsxTextElement",
    ]);
    expect(steps.map(atValue)).toEqual(["1", "2", "3"]);
    expect(steps.map((step) => step.attributes.at(-1))).toMatchObject([
      { name: "at", value: { data: { estree: { body: [{ expression: { value: 1 } }] } } } },
      { name: "at", value: { data: { estree: { body: [{ expression: { value: 2 } }] } } } },
      { name: "at", value: { data: { estree: { body: [{ expression: { value: 3 } }] } } } },
    ]);
  });

  it("restarts implicit Step numbering for every slide", async () => {
    const tree = await transform(`<Step>One</Step>

<Step>Two</Step>

---

<Step>One again</Step>`);

    expect(getSlides(tree).map((node) => getSteps(node).map(atValue))).toEqual([["1", "2"], ["1"]]);
  });

  it("preserves static explicit indexes and continues after their numeric value", async () => {
    const tree = await transform(`<Step at={7}>Pinned</Step>

<Step>Next</Step>`);
    const steps = getSteps(getSlides(tree)[0] as SlideNode);

    expect(steps.map(atValue)).toEqual(["7", "8"]);
    expect(steps[0]?.attributes[0]).toHaveProperty("position");
    expect(steps[1]?.attributes[0]).not.toHaveProperty("position");
  });

  it("requires explicit numbering after a dynamic at value", async () => {
    await expect(
      transform(`<Step at={state}>Dynamic</Step>

<Step>Ambiguous</Step>`),
    ).rejects.toMatchObject({ source: "drever", ruleId: "step-index-indeterminate" });
  });

  it("splits only root thematic breaks written with exactly three dashes", async () => {
    const tree = await transform(`# First

***

___

----

---

# Second`);
    const slides = getSlides(tree);

    expect(slides).toHaveLength(2);
    expect(slides[0]?.children).toMatchObject([
      { type: "heading" },
      { type: "thematicBreak" },
      { type: "thematicBreak" },
      { type: "thematicBreak" },
    ]);
    expect(slides[1]?.children).toMatchObject([{ type: "heading" }]);
  });

  it("does not treat fenced or nested dashes as deck boundaries", async () => {
    const tree = await transform(`# First

\`\`\`md
---
\`\`\`

> ---

<section>

---

</section>

---

# Second`);
    const slides = getSlides(tree);

    expect(slides).toHaveLength(2);
    expect(slides[0]?.children).toMatchObject([
      { type: "heading" },
      { type: "code", value: "---" },
      { type: "blockquote", children: [{ type: "thematicBreak" }] },
      { type: "mdxJsxFlowElement", name: "section", children: [{ type: "thematicBreak" }] },
    ]);
    expect(slides[1]?.children).toMatchObject([{ type: "heading" }]);
  });

  it("hoists root MDX ESM ahead of the pre-segmented deck tree", async () => {
    const tree = await transform(`---

import { Demo } from "./demo.js"

# Demo

---

export const topic = "Drever"

# Summary`);

    expect(tree.children.map((node) => node.type)).toEqual([
      "mdxjsEsm",
      "mdxjsEsm",
      "mdxJsxFlowElement",
      "mdxJsxFlowElement",
      "mdxJsxFlowElement",
    ]);
    expect(tree.children.slice(0, 2)).toMatchObject([
      { type: "mdxjsEsm", value: 'import { Demo } from "./demo.js"' },
      { type: "mdxjsEsm", value: 'export const topic = "Drever"' },
    ]);
    expect(getSlides(tree).map((node) => node.children.map((child) => child.type))).toEqual([
      [],
      ["heading"],
      ["heading"],
    ]);
  });

  it("cannot be shadowed by author imports named Slide or Step", async () => {
    const tree = await transform(`import Slide from "./evil.js"
import Step from "./evil.js"

# Protected

<Step>Protected reveal</Step>`);

    expect(tree.children[0]).toMatchObject({
      type: "mdxjsEsm",
      value: 'import Slide from "./evil.js"\nimport Step from "./evil.js"',
    });
    expect(getSlides(tree)[0]?.name).toBe(DREVER_INTERNAL_SLIDE_COMPONENT);
    expect(getSteps(getSlides(tree)[0] as SlideNode)[0]?.name).toBe("Step");
  });

  it("rejects authored internal components and lexical bindings", async () => {
    for (const source of [
      `<${DREVER_INTERNAL_STEP_COMPONENT}>Reserved</${DREVER_INTERNAL_STEP_COMPONENT}>`,
      `<${DREVER_INTERNAL_SLIDE_COMPONENT}>Reserved</${DREVER_INTERNAL_SLIDE_COMPONENT}>`,
    ]) {
      await expect(transform(source)).rejects.toMatchObject({
        source: "drever",
        ruleId: "internal-component-authored",
      });
    }

    for (const source of [
      `import ${DREVER_INTERNAL_STEP_COMPONENT} from "./evil.js"\n\n# Slide`,
      `export const ${DREVER_INTERNAL_SLIDE_COMPONENT} = "section"\n\n# Slide`,
      `export const { component: ${DREVER_INTERNAL_STEP_COMPONENT} } = registry\n\n# Slide`,
    ]) {
      await expect(transform(source)).rejects.toMatchObject({
        source: "drever",
        ruleId: "internal-component-binding",
      });
    }
  });

  it("rejects reserved internal identifiers in MDX content expressions", async () => {
    for (const source of [
      `{${DREVER_INTERNAL_STEP_COMPONENT}({at: 9})}`,
      `{React.createElement(${DREVER_INTERNAL_SLIDE_COMPONENT}, {})}`,
      `<Card render={() => ${DREVER_INTERNAL_STEP_COMPONENT}({at: 9})} />`,
    ]) {
      await expect(transform(source)).rejects.toMatchObject({
        source: "drever",
        ruleId: "internal-component-reference",
      });
    }
  });

  it("allows reserved spelling in non-computed property keys", async () => {
    const tree = await transform(`{({${DREVER_INTERNAL_STEP_COMPONENT}: true})}

{registry.${DREVER_INTERNAL_SLIDE_COMPONENT}}`);

    expect(getSlides(tree)).toHaveLength(1);
  });

  it("retains leading, adjacent, and trailing empty slides with stable metadata", async () => {
    const tree = await transform("---\n\n---\n\n# Third\n\n---");
    const slides = getSlides(tree);

    expect(slides).toHaveLength(4);
    expect(slides.map((node) => node.children.length)).toEqual([0, 0, 1, 0]);
    expect(slides.map((node) => node.attributes)).toMatchObject([
      [
        { name: "id", value: "slide-1" },
        { name: "index", value: { value: "0" } },
      ],
      [
        { name: "id", value: "slide-2" },
        { name: "index", value: { value: "1" } },
      ],
      [
        { name: "id", value: "slide-3" },
        { name: "index", value: { value: "2" } },
      ],
      [
        { name: "id", value: "slide-4" },
        { name: "index", value: { value: "3" } },
      ],
    ]);
  });
});
