import type { RootContent } from "mdast";

type MdxJsxElement = Extract<RootContent, { type: "mdxJsxFlowElement" | "mdxJsxTextElement" }>;
type MdxJsxNamedAttribute = Extract<
  MdxJsxElement["attributes"][number],
  { type: "mdxJsxAttribute" }
>;

export type StaticSlideTitle = Readonly<{
  title: string;
  position?: RootContent["position"];
}>;

const descendants = (node: RootContent): readonly RootContent[] =>
  "children" in node && Array.isArray(node.children) ? (node.children as RootContent[]) : [];

const isElement = (node: RootContent): node is MdxJsxElement =>
  node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";

const isHeadlessCoreComponent = (node: RootContent): boolean =>
  isElement(node) && (node.name === "Note" || node.name === "SlideTransition");

const staticHeadingText = (node: RootContent): string | undefined => {
  const record = node as unknown as Readonly<Record<string, unknown>>;
  if (
    (node.type === "text" || node.type === "inlineCode" || record.type === "inlineMath") &&
    typeof record.value === "string"
  ) {
    return record.value;
  }
  if ((node.type === "image" || node.type === "imageReference") && typeof record.alt === "string") {
    return record.alt;
  }
  if (node.type === "break") {
    return " ";
  }
  if (
    node.type === "html" ||
    node.type === "mdxTextExpression" ||
    node.type === "mdxFlowExpression" ||
    node.type === "mdxJsxTextElement" ||
    node.type === "mdxJsxFlowElement"
  ) {
    return;
  }

  const values = descendants(node).map(staticHeadingText);
  return values.some((value) => value === undefined) ? undefined : values.join("");
};

export const normalizeStaticTitle = (value: string): string | undefined => {
  const title = value.replaceAll(/\s+/gu, " ").trim();
  return title.length === 0 ? undefined : title;
};

const findFirstHeading = (children: readonly RootContent[]): RootContent | undefined => {
  for (const child of children) {
    if (isHeadlessCoreComponent(child)) {
      continue;
    }
    if (child.type === "heading") {
      return child;
    }
    const nested = findFirstHeading(descendants(child));
    if (nested !== undefined) {
      return nested;
    }
  }
  return;
};

const SEMANTIC_TITLE_PROPS = ["aria-label", "title", "heading", "label"] as const;

const namedAttribute = (node: MdxJsxElement, name: string): MdxJsxNamedAttribute | undefined =>
  node.attributes.find(
    (attribute): attribute is MdxJsxNamedAttribute =>
      attribute.type === "mdxJsxAttribute" && attribute.name === name,
  );

/** Applies the same static title inference to manifests and design preflight. */
export const staticSlideTitle = (
  children: readonly RootContent[],
): StaticSlideTitle | undefined => {
  const heading = findFirstHeading(children);
  if (heading !== undefined) {
    const text = staticHeadingText(heading);
    const title = text === undefined ? undefined : normalizeStaticTitle(text);
    if (title !== undefined) {
      return { title, ...(heading.position === undefined ? {} : { position: heading.position }) };
    }
  }

  const layout = children.find(
    (child): child is MdxJsxElement => isElement(child) && !isHeadlessCoreComponent(child),
  );
  if (layout === undefined) {
    return;
  }
  for (const name of SEMANTIC_TITLE_PROPS) {
    const attribute = namedAttribute(layout, name);
    if (typeof attribute?.value !== "string") {
      continue;
    }
    const title = normalizeStaticTitle(attribute.value);
    if (title !== undefined) {
      return {
        title,
        ...(attribute.position === undefined ? {} : { position: attribute.position }),
      };
    }
  }
  return;
};
