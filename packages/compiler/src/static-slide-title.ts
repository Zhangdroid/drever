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

type HeadingCandidate = Readonly<{
  position?: RootContent["position"];
  text: string | undefined;
}>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

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
  if (isElement(node)) {
    if (node.name === "br") {
      return " ";
    }
    if (node.name === null || node.name !== node.name.toLowerCase()) {
      return;
    }
    const values = descendants(node).map(staticHeadingText);
    return values.some((value) => value === undefined) ? undefined : values.join("");
  }
  if (
    node.type === "html" ||
    node.type === "mdxTextExpression" ||
    node.type === "mdxFlowExpression"
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

const jsxName = (node: unknown): string | undefined => {
  if (!isRecord(node) || node.type !== "JSXIdentifier" || typeof node.name !== "string") {
    return;
  }
  return node.name;
};

const staticJsxText = (node: unknown): string | undefined => {
  if (!isRecord(node) || typeof node.type !== "string") {
    return;
  }
  if (node.type === "JSXText") {
    return typeof node.value === "string" ? node.value : undefined;
  }
  if (node.type === "Literal") {
    return typeof node.value === "string" || typeof node.value === "number"
      ? String(node.value)
      : undefined;
  }
  if (node.type === "TemplateLiteral") {
    if (
      !Array.isArray(node.expressions) ||
      node.expressions.length > 0 ||
      !Array.isArray(node.quasis)
    ) {
      return;
    }
    return node.quasis
      .map((quasi) => {
        if (!isRecord(quasi) || !isRecord(quasi.value)) {
          return;
        }
        return typeof quasi.value.cooked === "string"
          ? quasi.value.cooked
          : typeof quasi.value.raw === "string"
            ? quasi.value.raw
            : undefined;
      })
      .reduce<string | undefined>(
        (text, value) => (text === undefined || value === undefined ? undefined : text + value),
        "",
      );
  }
  if (node.type === "JSXExpressionContainer") {
    return staticJsxText(node.expression);
  }
  if (node.type === "JSXFragment") {
    return staticJsxChildrenText(node.children);
  }
  if (node.type !== "JSXElement" || !isRecord(node.openingElement)) {
    return;
  }

  const name = jsxName(node.openingElement.name);
  if (name === "br") {
    return " ";
  }
  if (name === undefined || name !== name.toLowerCase()) {
    return;
  }
  return staticJsxChildrenText(node.children);
};

const staticJsxChildrenText = (children: unknown): string | undefined => {
  if (!Array.isArray(children)) {
    return;
  }
  const values = children.map(staticJsxText);
  return values.some((value) => value === undefined) ? undefined : values.join("");
};

const findFirstEstreeHeading = (node: unknown): HeadingCandidate | undefined => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const heading = findFirstEstreeHeading(child);
      if (heading !== undefined) {
        return heading;
      }
    }
    return;
  }
  if (!isRecord(node)) {
    return;
  }
  if (node.type === "Program") {
    return findFirstEstreeHeading(node.body);
  }
  if (node.type === "ExpressionStatement") {
    return findFirstEstreeHeading(node.expression);
  }
  if (node.type === "JSXFragment") {
    return findFirstEstreeHeading(node.children);
  }
  if (node.type !== "JSXElement" || !isRecord(node.openingElement)) {
    return;
  }

  const name = jsxName(node.openingElement.name);
  if (name !== undefined && /^h[1-6]$/u.test(name)) {
    return { text: staticJsxChildrenText(node.children) };
  }
  return findFirstEstreeHeading(node.children);
};

const findFirstAttributeHeading = (node: MdxJsxElement): HeadingCandidate | undefined => {
  for (const attribute of node.attributes) {
    if (
      attribute.type !== "mdxJsxAttribute" ||
      typeof attribute.value !== "object" ||
      attribute.value?.type !== "mdxJsxAttributeValueExpression"
    ) {
      continue;
    }
    const heading = findFirstEstreeHeading(attribute.value.data?.estree);
    if (heading !== undefined) {
      return {
        ...heading,
        ...(attribute.position === undefined ? {} : { position: attribute.position }),
      };
    }
  }
  return;
};

const findFirstHeading = (children: readonly RootContent[]): HeadingCandidate | undefined => {
  for (const child of children) {
    if (isHeadlessCoreComponent(child)) {
      continue;
    }
    if (child.type === "heading") {
      return {
        text: staticHeadingText(child),
        ...(child.position === undefined ? {} : { position: child.position }),
      };
    }
    if (isElement(child)) {
      if (child.name !== null && /^h[1-6]$/u.test(child.name)) {
        return {
          text: staticHeadingText(child),
          ...(child.position === undefined ? {} : { position: child.position }),
        };
      }
      const attributeHeading = findFirstAttributeHeading(child);
      if (attributeHeading !== undefined) {
        return attributeHeading;
      }
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
    const title = heading.text === undefined ? undefined : normalizeStaticTitle(heading.text);
    if (title !== undefined) {
      return {
        title,
        ...(heading.position === undefined ? {} : { position: heading.position }),
      };
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
