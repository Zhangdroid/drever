import type { Root, RootContent } from "mdast";
import type { Plugin, Transformer } from "unified";

export const DREVER_DEV_SOURCE_RANGE_ATTRIBUTE = "data-drever-dev-source-range";
export const DREVER_DEV_SOURCE_PATH_ATTRIBUTE = "data-drever-dev-source-path";
export const DREVER_DEV_SOURCE_TAG_ATTRIBUTE = "data-drever-dev-source-tag";

type MdxJsxElement = Extract<RootContent, { type: "mdxJsxFlowElement" | "mdxJsxTextElement" }>;

type NodeWithHProperties = RootContent & {
  data?: RootContent["data"] & {
    hProperties?: Record<string, unknown>;
  };
};

const markdownTag = (node: RootContent): string | undefined => {
  switch (node.type) {
    case "blockquote":
      return "blockquote";
    case "break":
      return "br";
    case "code":
    case "inlineCode":
      return "code";
    case "emphasis":
      return "em";
    case "heading":
      return `h${node.depth}`;
    case "image":
    case "imageReference":
      return "img";
    case "link":
    case "linkReference":
      return "a";
    case "list":
      return node.ordered === true ? "ol" : "ul";
    case "listItem":
      return "li";
    case "paragraph":
      return "p";
    case "strong":
      return "strong";
    case "thematicBreak":
      return "hr";
    default: {
      const extensionTags: Readonly<Record<string, string>> = {
        delete: "del",
        table: "table",
        tableRow: "tr",
      };
      return extensionTags[node.type];
    }
  }
};

const intrinsicMdxTag = (node: RootContent): string | undefined => {
  if (
    (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") ||
    node.name === null ||
    !/^[a-z][a-z0-9-]*$/u.test(node.name)
  ) {
    return;
  }
  return node.name;
};

const encodedRange = (node: RootContent): string | undefined => {
  const { position } = node;
  if (
    position === undefined ||
    position.start.offset === undefined ||
    position.end.offset === undefined
  ) {
    return;
  }
  return [
    position.start.line,
    position.start.column,
    position.start.offset,
    position.end.line,
    position.end.column,
    position.end.offset,
  ].join(":");
};

const markMarkdownNode = (node: RootContent, path: string, range: string, tag: string): void => {
  const marked = node as NodeWithHProperties;
  marked.data ??= {};
  marked.data.hProperties = {
    ...marked.data.hProperties,
    [DREVER_DEV_SOURCE_PATH_ATTRIBUTE]: path,
    [DREVER_DEV_SOURCE_RANGE_ATTRIBUTE]: range,
    [DREVER_DEV_SOURCE_TAG_ATTRIBUTE]: tag,
  };
};

const markMdxElement = (node: MdxJsxElement, path: string, range: string, tag: string): void => {
  node.attributes = [
    ...node.attributes.filter(
      (attribute) =>
        attribute.type !== "mdxJsxAttribute" ||
        (attribute.name !== DREVER_DEV_SOURCE_PATH_ATTRIBUTE &&
          attribute.name !== DREVER_DEV_SOURCE_RANGE_ATTRIBUTE &&
          attribute.name !== DREVER_DEV_SOURCE_TAG_ATTRIBUTE),
    ),
    {
      type: "mdxJsxAttribute",
      name: DREVER_DEV_SOURCE_PATH_ATTRIBUTE,
      value: path,
    },
    {
      type: "mdxJsxAttribute",
      name: DREVER_DEV_SOURCE_RANGE_ATTRIBUTE,
      value: range,
    },
    {
      type: "mdxJsxAttribute",
      name: DREVER_DEV_SOURCE_TAG_ATTRIBUTE,
      value: tag,
    },
  ];
};

const markSelectableElements = (root: Root, path: string): void => {
  const visit = (node: Root | RootContent): void => {
    if (node.type !== "root") {
      const range = encodedRange(node);
      const tag = intrinsicMdxTag(node) ?? markdownTag(node);
      if (range !== undefined && tag !== undefined) {
        if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
          markMdxElement(node, path, range, tag);
        } else {
          markMarkdownNode(node, path, range, tag);
        }
      }
    }

    if ("children" in node) {
      for (const child of node.children) {
        visit(child as RootContent);
      }
    }
  };

  visit(root);
};

/**
 * Adds exact source coordinates to statically mapped DOM elements in the
 * development-only MDX pipeline. Component invocations are deliberately
 * excluded because their rendered DOM roots cannot be inferred statically.
 *
 * @internal
 */
const devSelectionTransformer: Transformer<Root> = (tree, file) => {
  if (typeof file.path === "string" && file.path.length > 0) {
    markSelectableElements(tree, file.path);
  }
};

export const remarkDreverDevSelection: Plugin = (() =>
  devSelectionTransformer) as unknown as Plugin;
