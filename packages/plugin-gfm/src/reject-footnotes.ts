import { defineRemarkPlugin } from "@drever/plugin";
import type { Root, RootContent } from "mdast";
import type { Transformer } from "unified";

type MarkdownNode = Root | RootContent;
type TransformFile = Parameters<Transformer<Root>>[1];

const findFootnote = (node: MarkdownNode): RootContent | undefined => {
  if (node.type === "footnoteDefinition" || node.type === "footnoteReference") {
    return node;
  }
  if ("children" in node) {
    for (const child of node.children) {
      const footnote = findFootnote(child);
      if (footnote !== undefined) return footnote;
    }
  }
  return undefined;
};

const rejectFootnotes =
  () =>
  (tree: Root, file: TransformFile): void => {
    const footnote = findFootnote(tree);
    if (footnote !== undefined) {
      file.fail(
        "@drever/plugin-gfm does not support footnotes yet because document-level footnote output cannot cross Slide boundaries.",
        footnote,
        "drever:gfm-footnotes-unsupported",
      );
    }
  };

export default defineRemarkPlugin(() => rejectFootnotes);
