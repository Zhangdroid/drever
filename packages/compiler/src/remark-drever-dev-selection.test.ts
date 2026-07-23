import type { Root, RootContent } from "mdast";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vite-plus/test";
import {
  DREVER_DEV_SOURCE_PATH_ATTRIBUTE,
  DREVER_DEV_SOURCE_RANGE_ATTRIBUTE,
  DREVER_DEV_SOURCE_TAG_ATTRIBUTE,
  remarkDreverDevSelection,
} from "./remark-drever-dev-selection.ts";
import { remarkDreverSlideGrammar } from "./remark-drever-slide-grammar.ts";

type MdxElement = Extract<RootContent, { type: "mdxJsxFlowElement" | "mdxJsxTextElement" }>;

const transform = async (source: string): Promise<Root> => {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkDreverSlideGrammar)
    .use(remarkDreverDevSelection);
  return processor.run(processor.parse(source), {
    path: "/project/slides.mdx",
    value: source,
  }) as Promise<Root>;
};

const descendants = (root: Root): RootContent[] => {
  const result: RootContent[] = [];
  const visit = (node: RootContent): void => {
    result.push(node);
    if ("children" in node) {
      for (const child of node.children) {
        visit(child as RootContent);
      }
    }
  };
  for (const child of root.children) {
    visit(child);
  }
  return result;
};

const mdxAttribute = (node: MdxElement, name: string): unknown =>
  node.attributes.find(
    (attribute) => attribute.type === "mdxJsxAttribute" && attribute.name === name,
  )?.value;

const hProperties = (node: RootContent | undefined): Record<string, unknown> | undefined =>
  (node?.data as { hProperties?: Record<string, unknown> } | undefined)?.hProperties;

describe("remarkDreverDevSelection", () => {
  it("marks only statically mapped DOM elements with exact authored ranges", async () => {
    const source = `# Opening

A **static** paragraph.

<div>Native</div>

<Card>Opaque</Card>`;
    const tree = await transform(source);
    const nodes = descendants(tree);
    const heading = nodes.find((node) => node.type === "heading");
    const paragraph = nodes.find((node) => node.type === "paragraph");
    const strong = nodes.find((node) => node.type === "strong");
    const intrinsic = nodes.find(
      (node): node is MdxElement =>
        (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
        node.name === "div",
    );
    const component = nodes.find(
      (node): node is MdxElement =>
        (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
        node.name === "Card",
    );
    const slide = nodes.find(
      (node): node is MdxElement =>
        node.type === "mdxJsxFlowElement" && node.name === "__DreverSlide",
    );

    expect(hProperties(heading)).toMatchObject({
      [DREVER_DEV_SOURCE_PATH_ATTRIBUTE]: "/project/slides.mdx",
      [DREVER_DEV_SOURCE_RANGE_ATTRIBUTE]: "1:1:0:1:10:9",
      [DREVER_DEV_SOURCE_TAG_ATTRIBUTE]: "h1",
    });
    expect(hProperties(paragraph)).toMatchObject({
      [DREVER_DEV_SOURCE_PATH_ATTRIBUTE]: "/project/slides.mdx",
      [DREVER_DEV_SOURCE_RANGE_ATTRIBUTE]: "3:1:11:3:24:34",
      [DREVER_DEV_SOURCE_TAG_ATTRIBUTE]: "p",
    });
    expect(hProperties(strong)).toMatchObject({
      [DREVER_DEV_SOURCE_PATH_ATTRIBUTE]: "/project/slides.mdx",
      [DREVER_DEV_SOURCE_RANGE_ATTRIBUTE]: "3:3:13:3:13:23",
      [DREVER_DEV_SOURCE_TAG_ATTRIBUTE]: "strong",
    });
    expect(intrinsic).toBeDefined();
    expect(mdxAttribute(intrinsic as MdxElement, DREVER_DEV_SOURCE_PATH_ATTRIBUTE)).toBe(
      "/project/slides.mdx",
    );
    expect(mdxAttribute(intrinsic as MdxElement, DREVER_DEV_SOURCE_RANGE_ATTRIBUTE)).toBe(
      "5:1:36:5:18:53",
    );
    expect(mdxAttribute(intrinsic as MdxElement, DREVER_DEV_SOURCE_TAG_ATTRIBUTE)).toBe("div");
    expect(
      mdxAttribute(component as MdxElement, DREVER_DEV_SOURCE_RANGE_ATTRIBUTE),
    ).toBeUndefined();
    expect(mdxAttribute(slide as MdxElement, DREVER_DEV_SOURCE_RANGE_ATTRIBUTE)).toBeUndefined();
  });
});
