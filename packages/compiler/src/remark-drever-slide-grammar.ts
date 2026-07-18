import {
  DREVER_INTERNAL_SLIDE_COMPONENT,
  DREVER_INTERNAL_STEP_COMPONENT,
  type SpeakerNote,
} from "@drever/schema";
import type { Root, RootContent } from "mdast";
import type { Plugin, Transformer } from "unified";
import {
  DREVER_SPEAKER_NOTES_DATA_KEY,
  type DreverSpeakerNotesSnapshot,
} from "./deck-manifest-data.ts";
import { collectEstreeBindings } from "./estree-bindings.ts";

type OffsetRange = Readonly<{
  start: number;
  end: number;
}>;

type MdxJsxFlowElement = Extract<RootContent, { type: "mdxJsxFlowElement" }>;
type MdxJsxElement = Extract<RootContent, { type: "mdxJsxFlowElement" | "mdxJsxTextElement" }>;
type MdxJsxAttribute = MdxJsxElement["attributes"][number];
type MdxJsxNamedAttribute = Extract<MdxJsxAttribute, { type: "mdxJsxAttribute" }>;

export const DREVER_SLIDE_WRAPPERS_DATA_KEY = "dreverSlideWrappers";

const RESERVED_COMPONENT_NAMES: ReadonlySet<string> = new Set([
  DREVER_INTERNAL_SLIDE_COMPONENT,
  DREVER_INTERNAL_STEP_COMPONENT,
]);

type TransformFile = Parameters<Transformer<Root>>[1];

const offsets = (node: RootContent): OffsetRange | undefined => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? undefined : { start, end };
};

const isSlideBoundary = (node: RootContent, source: string): boolean => {
  if (node.type !== "thematicBreak") {
    return false;
  }

  const range = offsets(node);
  return range !== undefined && source.slice(range.start, range.end).trim() === "---";
};

const numericAttribute = (name: string, value: number): MdxJsxNamedAttribute => ({
  type: "mdxJsxAttribute",
  name,
  value: {
    type: "mdxJsxAttributeValueExpression",
    value: String(value),
    data: {
      estree: {
        type: "Program",
        body: [
          {
            type: "ExpressionStatement",
            expression: {
              type: "Literal",
              value,
              raw: String(value),
            },
          },
        ],
        sourceType: "module",
      },
    },
  },
});

const isStep = (node: RootContent): node is MdxJsxElement =>
  (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") && node.name === "Step";

const isSpeakerNote = (node: RootContent): node is MdxJsxElement =>
  (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") && node.name === "Note";

const rejectAuthoredInternalComponents = (node: RootContent, file: TransformFile): void => {
  if (
    (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
    node.name !== null &&
    RESERVED_COMPONENT_NAMES.has(node.name)
  ) {
    file.fail(
      `[drever:internal-component-authored] The component name ${node.name} is reserved for Drever's compiled deck grammar.`,
      node,
      "drever:internal-component-authored",
    );
  }
  for (const child of descendants(node)) {
    rejectAuthoredInternalComponents(child, file);
  }
};

const rejectReservedEsmBindings = (node: RootContent, file: TransformFile): void => {
  if (node.type !== "mdxjsEsm") {
    return;
  }
  const binding = collectEstreeBindings(node.data?.estree, RESERVED_COMPONENT_NAMES)[0];
  if (binding !== undefined) {
    file.fail(
      `[drever:internal-component-binding] MDX ESM cannot bind the reserved Drever component name ${binding.name}.`,
      node,
      "drever:internal-component-binding",
    );
  }
};

const reservedExpressionIdentifier = (root: RootContent): string | undefined => {
  const seen = new WeakSet<object>();
  const visit = (value: unknown): string | undefined => {
    if (typeof value !== "object" || value === null || seen.has(value)) {
      return;
    }
    seen.add(value);
    const record = value as Readonly<Record<string, unknown>>;
    if (
      record.type === "Identifier" &&
      typeof record.name === "string" &&
      RESERVED_COMPONENT_NAMES.has(record.name)
    ) {
      return record.name;
    }
    for (const [key, child] of Object.entries(record)) {
      const nonComputedName = record.computed !== true && key === "key";
      const nonComputedMember =
        record.computed !== true &&
        key === "property" &&
        (record.type === "MemberExpression" || record.type === "OptionalMemberExpression");
      if (
        nonComputedMember ||
        (nonComputedName &&
          ["MethodDefinition", "Property", "PropertyDefinition"].includes(String(record.type))) ||
        (key === "label" &&
          ["BreakStatement", "ContinueStatement", "LabeledStatement"].includes(String(record.type)))
      ) {
        continue;
      }
      const values = Array.isArray(child) ? child : [child];
      for (const entry of values) {
        const name = visit(entry);
        if (name !== undefined) {
          return name;
        }
      }
    }
  };
  return visit(root);
};

const rejectReservedExpressionIdentifiers = (node: RootContent, file: TransformFile): void => {
  const name = reservedExpressionIdentifier(node);
  if (name !== undefined) {
    file.fail(
      `[drever:internal-component-reference] MDX content expressions cannot reference the reserved Drever component name ${name}.`,
      node,
      "drever:internal-component-reference",
    );
  }
};

const containsExpressionSpeakerNote = (root: unknown): boolean => {
  const seen = new WeakSet<object>();
  const visit = (value: unknown): boolean => {
    if (typeof value !== "object" || value === null || seen.has(value)) {
      return false;
    }
    seen.add(value);
    const record = value as Readonly<Record<string, unknown>>;
    if (record.type === "JSXOpeningElement") {
      const name =
        typeof record.name === "object" && record.name !== null
          ? (record.name as Readonly<Record<string, unknown>>)
          : undefined;
      if (name?.type === "JSXIdentifier" && name.name === "Note") {
        return true;
      }
    }
    return Object.values(record).some((child) =>
      Array.isArray(child) ? child.some(visit) : visit(child),
    );
  };
  return visit(root);
};

const rejectExpressionSpeakerNotes = (node: RootContent, file: TransformFile): void => {
  if (!containsExpressionSpeakerNote(node)) {
    return;
  }
  file.fail(
    "Speaker notes must be authored as static <Note> Markdown; JavaScript and MDX expressions cannot declare notes.",
    node,
    "drever:speaker-note-dynamic-content",
  );
};

const namedAtAttribute = (node: MdxJsxElement): MdxJsxNamedAttribute | undefined =>
  node.attributes.find(
    (attribute): attribute is MdxJsxNamedAttribute =>
      attribute.type === "mdxJsxAttribute" && attribute.name === "at",
  );

const staticStepIndex = (attribute: MdxJsxNamedAttribute): number | undefined => {
  const value = attribute.value;
  if (
    typeof value !== "object" ||
    value === null ||
    value.type !== "mdxJsxAttributeValueExpression"
  ) {
    return undefined;
  }

  const statement = value.data?.estree?.body[0];
  const literal = statement?.type === "ExpressionStatement" ? statement.expression : undefined;
  const index = literal?.type === "Literal" ? literal.value : undefined;
  return typeof index === "number" && Number.isSafeInteger(index) && index > 0 ? index : undefined;
};

const descendants = (node: RootContent): readonly RootContent[] => {
  if (!("children" in node) || !Array.isArray(node.children)) {
    return [];
  }

  return node.children as RootContent[];
};

const readableText = (node: RootContent): string => {
  const record = node as RootContent & Readonly<Record<string, unknown>>;
  if (
    ["text", "inlineCode", "inlineMath"].includes(node.type) &&
    typeof record.value === "string"
  ) {
    return record.value;
  }
  if (["code", "math"].includes(node.type) && typeof record.value === "string") {
    return `${record.value}\n\n`;
  }
  if ((node.type === "image" || node.type === "imageReference") && typeof record.alt === "string") {
    return record.alt;
  }
  if (node.type === "break") {
    return "\n";
  }
  if (node.type === "thematicBreak") {
    return "—";
  }
  if (node.type === "definition" || node.type === "footnoteDefinition") {
    return "";
  }

  const children = descendants(node);
  if (node.type === "list") {
    const ordered = record.ordered === true;
    const start = typeof record.start === "number" ? record.start : 1;
    return `${children
      .map((child, index) => {
        const value = readableText(child).trim().replaceAll("\n", "\n  ");
        return `${ordered ? `${start + index}.` : "-"} ${value}`;
      })
      .join("\n")}\n\n`;
  }
  if (node.type === "table") {
    return `${children.map(readableText).join("\n")}\n\n`;
  }
  if (node.type === "tableRow") {
    return children.map((child) => readableText(child).trim()).join(" | ");
  }

  const value = children.map(readableText).join("");
  return ["blockquote", "code", "heading", "listItem", "paragraph"].includes(node.type)
    ? `${value}\n\n`
    : value;
};

const normalizePlainText = (value: string): string =>
  value
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replaceAll(/\n{3,}/gu, "\n\n")
    .trim();

const speakerNote = (node: MdxJsxElement, source: string, file: TransformFile): SpeakerNote => {
  if (node.attributes.length > 0) {
    file.fail(
      "Speaker Note does not accept attributes; put only static Markdown between its tags.",
      node,
      "drever:speaker-note-attributes-unsupported",
    );
  }

  const visit = (child: RootContent): void => {
    if (child.type === "mdxFlowExpression" || child.type === "mdxTextExpression") {
      file.fail(
        "Speaker Note content must be static Markdown; JavaScript and MDX expressions are not supported.",
        child,
        "drever:speaker-note-dynamic-content",
      );
    }
    if (child.type === "mdxJsxFlowElement" || child.type === "mdxJsxTextElement") {
      file.fail(
        "Speaker Note content supports Markdown, not nested JSX components.",
        child,
        "drever:speaker-note-markdown-only",
      );
    }
    descendants(child).forEach(visit);
  };
  (node.children as RootContent[]).forEach(visit);

  const first = (node.children as RootContent[])[0];
  const last = (node.children as RootContent[]).at(-1);
  const start = first?.position?.start.offset;
  const end = last?.position?.end.offset;
  if ((first !== undefined || last !== undefined) && (start === undefined || end === undefined)) {
    file.fail(
      "Speaker Note Markdown must retain source positions through parsing.",
      node,
      "drever:speaker-note-source-unavailable",
    );
  }

  return Object.freeze({
    format: "markdown",
    plainText: normalizePlainText((node.children as RootContent[]).map(readableText).join("")),
    value: start === undefined || end === undefined ? "" : source.slice(start, end),
  });
};

const extractSpeakerNotes = (
  children: readonly RootContent[],
  source: string,
  file: TransformFile,
): Readonly<{ children: RootContent[]; notes: readonly SpeakerNote[] }> => {
  const notes: SpeakerNote[] = [];
  const visit = (entries: readonly RootContent[]): RootContent[] =>
    entries.flatMap((node) => {
      if (isSpeakerNote(node)) {
        notes.push(speakerNote(node, source, file));
        return [];
      }
      const children = descendants(node);
      if (children.length > 0) {
        const next = visit(children);
        (node as RootContent & { children: RootContent[] }).children = next;
        if (node.type === "paragraph" && next.length === 0) {
          return [];
        }
      }
      return [node];
    });

  return Object.freeze({ children: visit(children), notes: Object.freeze(notes) });
};

const numberSteps = (children: readonly RootContent[]): RootContent | undefined => {
  let next: number | undefined = 1;

  const visit = (node: RootContent): RootContent | undefined => {
    if (isStep(node)) {
      const explicitAt = namedAtAttribute(node);
      if (explicitAt === undefined) {
        if (next === undefined) {
          return node;
        }

        node.attributes.push(numericAttribute("at", next));
        next = next === Number.MAX_SAFE_INTEGER ? undefined : next + 1;
      } else {
        const explicitIndex = staticStepIndex(explicitAt);
        if (explicitIndex === undefined) {
          next = undefined;
        } else if (next !== undefined && explicitIndex >= next) {
          next = explicitIndex === Number.MAX_SAFE_INTEGER ? undefined : explicitIndex + 1;
        }
      }
    }

    for (const child of descendants(node)) {
      const failure = visit(child);
      if (failure !== undefined) {
        return failure;
      }
    }

    return undefined;
  };

  for (const child of children) {
    const failure = visit(child);
    if (failure !== undefined) {
      return failure;
    }
  }

  return undefined;
};

const slide = (children: RootContent[], index: number): MdxJsxFlowElement => ({
  type: "mdxJsxFlowElement",
  name: DREVER_INTERNAL_SLIDE_COMPONENT,
  attributes: [
    { type: "mdxJsxAttribute", name: "id", value: `slide-${index + 1}` },
    numericAttribute("index", index),
  ],
  children: children as MdxJsxFlowElement["children"],
});

const slideGrammar: Plugin<[], Root> = () => (tree, file) => {
  const source = file.toString();
  const preamble: RootContent[] = [];
  const segments: RootContent[][] = [[]];

  for (const child of tree.children) {
    rejectExpressionSpeakerNotes(child, file);
    if (child.type === "mdxjsEsm") {
      rejectReservedEsmBindings(child, file);
      preamble.push(child);
      continue;
    }

    rejectAuthoredInternalComponents(child, file);
    rejectReservedExpressionIdentifiers(child, file);

    if (isSlideBoundary(child, source)) {
      segments.push([]);
      continue;
    }

    segments.at(-1)?.push(child);
  }

  const extracted = segments.map((children) => extractSpeakerNotes(children, source, file));
  const wrappers = extracted.map(({ children }, index) => {
    const unnumberedStep = numberSteps(children);
    if (unnumberedStep !== undefined) {
      file.fail(
        "An implicit Step cannot follow a dynamic or non-numeric at value; add an explicit numeric at prop.",
        unnumberedStep,
        "drever:step-index-indeterminate",
      );
    }

    return slide(children, index);
  });

  if (
    Object.hasOwn(file.data, DREVER_SLIDE_WRAPPERS_DATA_KEY) ||
    Object.hasOwn(file.data, DREVER_SPEAKER_NOTES_DATA_KEY)
  ) {
    file.fail(
      "A reserved Drever grammar file.data field is already defined.",
      tree,
      "drever:slide-grammar-data-conflict",
    );
  }
  Object.defineProperty(file.data, DREVER_SLIDE_WRAPPERS_DATA_KEY, {
    configurable: false,
    enumerable: true,
    value: Object.freeze([...wrappers]),
    writable: false,
  });
  Object.defineProperty(file.data, DREVER_SPEAKER_NOTES_DATA_KEY, {
    configurable: false,
    enumerable: true,
    value: Object.freeze({
      slides: Object.freeze(extracted.map(({ notes }) => notes)),
    } satisfies DreverSpeakerNotesSnapshot),
    writable: false,
  });

  tree.children = [...preamble, ...wrappers];
};

/**
 * Drever's internal, non-configurable deck grammar.
 *
 * This must run before extension remark plugins so every extension observes the
 * same pre-segmented deck tree. It is exported only for canonical adapters.
 *
 * @internal
 */
export const remarkDreverSlideGrammar: Plugin = slideGrammar as Plugin;
