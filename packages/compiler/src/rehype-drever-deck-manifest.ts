import {
  DECK_MANIFEST_VERSION,
  DREVER_INTERNAL_SLIDE_COMPONENT,
  DREVER_INTERNAL_STEP_COMPONENT,
  type DeckManifest,
} from "@drever/schema";
import type { Root } from "mdast";
import type { Plugin, Transformer } from "unified";
import {
  DREVER_DECK_MANIFEST_DATA_KEY,
  DREVER_REHYPE_SNAPSHOT_DATA_KEY,
  type DreverRehypeSnapshot,
} from "./deck-manifest-data.ts";

type TransformFile = Parameters<Transformer<Root>>[1];

type SyntaxNode = {
  type: string;
  [key: string]: unknown;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const syntaxNode = (value: unknown): SyntaxNode | undefined =>
  isRecord(value) && typeof value.type === "string" ? (value as SyntaxNode) : undefined;

const childrenOf = (node: SyntaxNode): readonly SyntaxNode[] =>
  Array.isArray(node.children)
    ? node.children.flatMap((child) => {
        const resolved = syntaxNode(child);
        return resolved === undefined ? [] : [resolved];
      })
    : [];

const attributesOf = (node: SyntaxNode): readonly SyntaxNode[] =>
  Array.isArray(node.attributes)
    ? node.attributes.flatMap((attribute) => {
        const resolved = syntaxNode(attribute);
        return resolved === undefined ? [] : [resolved];
      })
    : [];

const namedAttributes = (node: SyntaxNode, name: string): readonly SyntaxNode[] =>
  attributesOf(node).filter(
    (attribute) => attribute.type === "mdxJsxAttribute" && attribute.name === name,
  );

const expressionLiteral = (attribute: SyntaxNode): unknown => {
  const value = isRecord(attribute.value) ? attribute.value : undefined;
  const data = isRecord(value?.data) ? value.data : undefined;
  const estree = isRecord(data?.estree) ? data.estree : undefined;
  const body = Array.isArray(estree?.body) ? estree.body : [];
  const statement = body.length === 1 && isRecord(body[0]) ? body[0] : undefined;
  const expression =
    statement?.type === "ExpressionStatement" && isRecord(statement.expression)
      ? statement.expression
      : undefined;
  return expression?.type === "Literal" ? expression.value : undefined;
};

const positiveIndex = (attribute: SyntaxNode): number | undefined => {
  const value = expressionLiteral(attribute);
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
};

const containsEstreeStep = (root: unknown): boolean => {
  const seen = new WeakSet<object>();
  const visit = (value: unknown): boolean => {
    if (!isRecord(value) || seen.has(value)) {
      return false;
    }
    seen.add(value);
    if (value.type === "JSXOpeningElement") {
      const name = isRecord(value.name) ? value.name : undefined;
      if (
        name?.type === "JSXIdentifier" &&
        (name.name === "Step" || name.name === DREVER_INTERNAL_STEP_COMPONENT)
      ) {
        return true;
      }
    }
    return Object.values(value).some((child) =>
      Array.isArray(child) ? child.some(visit) : visit(child),
    );
  };
  return visit(root);
};

const attributeEstree = (attribute: SyntaxNode): unknown => {
  if (attribute.type === "mdxJsxExpressionAttribute") {
    const data = isRecord(attribute.data) ? attribute.data : undefined;
    return data?.estree;
  }
  const value = isRecord(attribute.value) ? attribute.value : undefined;
  const data = isRecord(value?.data) ? value.data : undefined;
  return data?.estree;
};

const containsEmbeddedStep = (node: SyntaxNode): boolean => {
  const data = isRecord(node.data) ? node.data : undefined;
  return (
    containsEstreeStep(data?.estree) ||
    attributesOf(node).some((attribute) => containsEstreeStep(attributeEstree(attribute)))
  );
};

const isSlide = (node: SyntaxNode): boolean =>
  node.type === "mdxJsxFlowElement" && node.name === DREVER_INTERNAL_SLIDE_COMPONENT;

const isStep = (node: SyntaxNode): boolean =>
  (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") && node.name === "Step";

const isInternalStep = (node: SyntaxNode): boolean =>
  (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
  node.name === DREVER_INTERNAL_STEP_COMPONENT;

const isWhitespace = (node: SyntaxNode): boolean =>
  node.type === "text" && typeof node.value === "string" && node.value.trim() === "";

const isManifest = (value: unknown): value is DeckManifest =>
  isRecord(value) &&
  value.version === DECK_MANIFEST_VERSION &&
  Array.isArray(value.slides) &&
  value.slides.length > 0 &&
  value.slides.every(
    (slide) =>
      isRecord(slide) &&
      (slide.title === undefined || (typeof slide.title === "string" && slide.title.length > 0)) &&
      Array.isArray(slide.speakerNotes) &&
      slide.speakerNotes.every(
        (note) =>
          isRecord(note) &&
          note.format === "markdown" &&
          typeof note.plainText === "string" &&
          typeof note.value === "string",
      ),
  );

const isSnapshot = (value: unknown): value is DreverRehypeSnapshot =>
  isRecord(value) &&
  Array.isArray(value.slides) &&
  value.slides.length > 0 &&
  value.slides.every(
    (slide, index) =>
      isRecord(slide) &&
      slide.id === `slide-${index + 1}` &&
      slide.index === index &&
      Array.isArray(slide.stepIndices) &&
      slide.stepIndices.every(
        (step) => typeof step === "number" && Number.isSafeInteger(step) && step > 0,
      ),
  );

const fail = (file: TransformFile, node: SyntaxNode, message: string): never =>
  file.fail(
    `[drever:deck-manifest-rehype-drift] ${message}`,
    node as never,
    "drever:deck-manifest-rehype-drift",
  );

const sameNumbers = (left: readonly number[], right: readonly number[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const slideIdentity = (
  slide: SyntaxNode,
  expectedId: string,
  expectedIndex: number,
  file: TransformFile,
): void => {
  const attributes = attributesOf(slide);
  const ids = namedAttributes(slide, "id");
  const indexes = namedAttributes(slide, "index");
  if (
    attributes.length !== 2 ||
    ids.length !== 1 ||
    ids[0]?.value !== expectedId ||
    indexes.length !== 1 ||
    !indexes[0] ||
    expressionLiteral(indexes[0]) !== expectedIndex
  ) {
    fail(
      file,
      slide,
      `Rehype extensions changed protected Slide ${expectedIndex + 1} identity or attributes.`,
    );
  }
};

const stepSequence = (slide: SyntaxNode, file: TransformFile): readonly number[] => {
  const indices: number[] = [];
  const visit = (node: SyntaxNode): void => {
    if (containsEmbeddedStep(node)) {
      fail(file, node, "Rehype extensions introduced a Step inside an MDX expression.");
    }
    if (isSlide(node)) {
      fail(file, node, "Rehype extensions introduced a nested protected Slide wrapper.");
    }
    if (isInternalStep(node)) {
      fail(file, node, "Rehype extensions introduced a reserved internal Step component.");
    }
    if (isStep(node)) {
      const attributes = attributesOf(node);
      const at = namedAttributes(node, "at");
      const hasSpread = attributes.some(
        (attribute) => attribute.type === "mdxJsxExpressionAttribute",
      );
      const index = at.length === 1 && at[0] ? positiveIndex(at[0]) : undefined;
      const validatedIndex =
        hasSpread || index === undefined
          ? fail(file, node, "Rehype extensions changed a Step's static positive at index.")
          : index;
      indices.push(validatedIndex);
      node.name = DREVER_INTERNAL_STEP_COMPONENT;
    }
    childrenOf(node).forEach(visit);
  };
  childrenOf(slide).forEach(visit);
  return Object.freeze(indices);
};

const rehypeDeckManifest =
  () =>
  (tree: SyntaxNode, file: TransformFile): void => {
    const manifest = file.data[DREVER_DECK_MANIFEST_DATA_KEY];
    const snapshot = file.data[DREVER_REHYPE_SNAPSHOT_DATA_KEY];
    if (!isManifest(manifest) || !isSnapshot(snapshot)) {
      file.fail(
        "The DeckManifest validation snapshot is missing before final Rehype validation.",
        tree as never,
        "drever:deck-manifest-rehype-data-invalid",
      );
    }

    const slides: SyntaxNode[] = [];
    let reachedSlides = false;
    for (const child of childrenOf(tree)) {
      if (child.type === "mdxjsEsm") {
        if (reachedSlides) {
          fail(file, child, "Rehype extensions moved MDX ESM after a protected Slide wrapper.");
        }
        continue;
      }
      if (isWhitespace(child)) {
        continue;
      }
      if (!isSlide(child)) {
        fail(file, child, "Rehype extensions added content outside protected Slide wrappers.");
      }
      reachedSlides = true;
      slides.push(child);
    }

    if (slides.length !== snapshot.slides.length || slides.length !== manifest.slides.length) {
      fail(file, tree, "Rehype extensions changed the protected Slide wrapper count.");
    }

    slides.forEach((slide, index) => {
      const expected =
        snapshot.slides[index] ??
        fail(file, slide, "Rehype extensions changed the protected Slide wrapper sequence.");
      const manifestSlide =
        manifest.slides[index] ??
        fail(file, slide, "Rehype extensions changed the protected Slide wrapper sequence.");
      slideIdentity(slide, expected.id, expected.index, file);
      const indices = stepSequence(slide, file);
      const stops = Object.freeze([...new Set(indices)].toSorted((left, right) => left - right));
      if (
        !sameNumbers(indices, expected.stepIndices) ||
        !sameNumbers(stops, manifestSlide.stepStops)
      ) {
        fail(file, slide, `Rehype extensions changed the Step structure of Slide ${index + 1}.`);
      }
    });
  };

/** @internal Final framework validation after extension Rehype plugins. */
export const rehypeDreverDeckManifest: Plugin = rehypeDeckManifest as unknown as Plugin;
