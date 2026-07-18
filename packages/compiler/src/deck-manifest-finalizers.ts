import {
  DECK_MANIFEST_VERSION,
  DREVER_INTERNAL_SLIDE_COMPONENT,
  DREVER_INTERNAL_STEP_COMPONENT,
  type DeckManifest,
  type SlideManifest,
  type SpeakerNote,
} from "@drever/schema";
import type { Root, RootContent } from "mdast";
import type { Plugin, Transformer } from "unified";
import {
  DREVER_DECK_MANIFEST_DATA_KEY,
  DREVER_REHYPE_SNAPSHOT_DATA_KEY,
  DREVER_SPEAKER_NOTES_DATA_KEY,
  type DreverRehypeSnapshot,
  type DreverSpeakerNotesSnapshot,
} from "./deck-manifest-data.ts";
import { validateDreverRecmaStructure } from "./recma-drever-deck-structure.ts";
import { DREVER_SLIDE_WRAPPERS_DATA_KEY } from "./remark-drever-slide-grammar.ts";

type MdxJsxElement = Extract<RootContent, { type: "mdxJsxFlowElement" | "mdxJsxTextElement" }>;
type MdxJsxFlowElement = Extract<RootContent, { type: "mdxJsxFlowElement" }>;
type MdxJsxAttribute = MdxJsxElement["attributes"][number];
type MdxJsxNamedAttribute = Extract<MdxJsxAttribute, { type: "mdxJsxAttribute" }>;

type EstreeNode = Readonly<{
  type: string;
  [key: string]: unknown;
}>;

type EstreeProgram = {
  type: "Program";
  body: EstreeNode[];
  sourceType: "module" | "script";
};

type TransformFile = Parameters<Transformer<Root>>[1];

const SPEAKER_NOTE_COMPONENT_NAMES: ReadonlySet<string> = new Set(["Note"]);
const STEP_COMPONENT_NAMES: ReadonlySet<string> = new Set(["Step", DREVER_INTERNAL_STEP_COMPONENT]);

export { DREVER_DECK_MANIFEST_DATA_KEY } from "./deck-manifest-data.ts";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const isElement = (node: RootContent): node is MdxJsxElement =>
  node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";

const isSlide = (node: RootContent): node is MdxJsxFlowElement =>
  node.type === "mdxJsxFlowElement" && node.name === DREVER_INTERNAL_SLIDE_COMPONENT;

const isStep = (node: RootContent): node is MdxJsxElement =>
  isElement(node) && node.name === "Step";

const isSpeakerNote = (node: RootContent): node is MdxJsxElement =>
  isElement(node) && node.name === "Note";

const descendants = (node: RootContent): readonly RootContent[] =>
  "children" in node && Array.isArray(node.children) ? (node.children as RootContent[]) : [];

const containsEstreeComponent = (root: unknown, names: ReadonlySet<string>): boolean => {
  const seen = new WeakSet<object>();
  const visit = (value: unknown): boolean => {
    if (!isRecord(value) || seen.has(value)) {
      return false;
    }
    seen.add(value);

    if (value.type === "JSXOpeningElement") {
      const name = isRecord(value.name) ? value.name : undefined;
      if (name?.type === "JSXIdentifier" && typeof name.name === "string" && names.has(name.name)) {
        return true;
      }
    }

    return Object.values(value).some((child) =>
      Array.isArray(child) ? child.some(visit) : visit(child),
    );
  };

  return visit(root);
};

const containsEmbeddedStep = (node: RootContent): boolean => {
  if (
    containsEstreeComponent(
      isRecord(node.data) ? node.data.estree : undefined,
      STEP_COMPONENT_NAMES,
    )
  ) {
    return true;
  }
  if (!isElement(node)) {
    return false;
  }

  return node.attributes.some((attribute) => {
    if (attribute.type === "mdxJsxExpressionAttribute") {
      return containsEstreeComponent(attribute.data?.estree, STEP_COMPONENT_NAMES);
    }
    if (!isRecord(attribute.value)) {
      return false;
    }
    const data = isRecord(attribute.value.data) ? attribute.value.data : undefined;
    return containsEstreeComponent(data?.estree, STEP_COMPONENT_NAMES);
  });
};

const containsEmbeddedSpeakerNote = (node: RootContent): boolean => {
  if (
    containsEstreeComponent(
      isRecord(node.data) ? node.data.estree : undefined,
      SPEAKER_NOTE_COMPONENT_NAMES,
    )
  ) {
    return true;
  }
  if (!isElement(node)) {
    return false;
  }
  return node.attributes.some((attribute) => {
    if (attribute.type === "mdxJsxExpressionAttribute") {
      return containsEstreeComponent(attribute.data?.estree, SPEAKER_NOTE_COMPONENT_NAMES);
    }
    if (!isRecord(attribute.value)) {
      return false;
    }
    const data = isRecord(attribute.value.data) ? attribute.value.data : undefined;
    return containsEstreeComponent(data?.estree, SPEAKER_NOTE_COMPONENT_NAMES);
  });
};

const rejectEmbeddedStep = (node: RootContent, file: TransformFile): void => {
  if (containsEmbeddedStep(node)) {
    file.fail(
      "Step must be authored as static MDX JSX inside a Slide; JavaScript and MDX expressions cannot declare navigation stops.",
      node,
      "drever:step-expression-unsupported",
    );
  }
};

const rejectUnexpectedSpeakerNote = (node: RootContent, file: TransformFile): void => {
  if (isSpeakerNote(node) || containsEmbeddedSpeakerNote(node)) {
    file.fail(
      "Remark extensions cannot introduce speaker notes after Drever has captured the static Note grammar.",
      node,
      "drever:speaker-note-remark-mutated",
    );
  }
};

const namedAttributes = (node: MdxJsxElement, name: string): readonly MdxJsxNamedAttribute[] =>
  node.attributes.filter(
    (attribute): attribute is MdxJsxNamedAttribute =>
      attribute.type === "mdxJsxAttribute" && attribute.name === name,
  );

const numericLiteral = (attribute: MdxJsxNamedAttribute): number | undefined => {
  const value = attribute.value;
  if (
    typeof value !== "object" ||
    value === null ||
    value.type !== "mdxJsxAttributeValueExpression"
  ) {
    return;
  }

  const body = value.data?.estree?.body;
  const statement = body?.length === 1 ? body[0] : undefined;
  const expression = statement?.type === "ExpressionStatement" ? statement.expression : undefined;
  const literal = expression?.type === "Literal" ? expression.value : undefined;
  return typeof literal === "number" ? literal : undefined;
};

const isDynamicExpression = (attribute: MdxJsxNamedAttribute): boolean => {
  const value = attribute.value;
  if (
    typeof value !== "object" ||
    value === null ||
    value.type !== "mdxJsxAttributeValueExpression"
  ) {
    return false;
  }

  return numericLiteral(attribute) === undefined;
};

const positiveStepIndex = (attribute: MdxJsxNamedAttribute): number | undefined => {
  const value = numericLiteral(attribute);
  return value !== undefined && Number.isSafeInteger(value) && value > 0 ? value : undefined;
};

const slideIdentity = (
  node: MdxJsxFlowElement,
  expectedIndex: number,
  file: TransformFile,
): Readonly<{ id: string; index: number }> => {
  const ids = namedAttributes(node, "id");
  const indexes = namedAttributes(node, "index");
  const id = ids.length === 1 ? ids[0]?.value : undefined;
  const index = indexes.length === 1 && indexes[0] ? numericLiteral(indexes[0]) : undefined;

  if (
    node.attributes.length !== 2 ||
    typeof id !== "string" ||
    id !== `slide-${expectedIndex + 1}` ||
    index !== expectedIndex
  ) {
    file.fail(
      `Compiled Slide ${expectedIndex + 1} must retain only its generated id and zero-based index.`,
      node,
      "drever:slide-identity-invalid",
    );
  }

  return { id, index };
};

const collectStepStops = (
  slide: MdxJsxFlowElement,
  file: TransformFile,
): Readonly<{ stepIndices: readonly number[]; stepStops: readonly number[] }> => {
  const stops = new Set<number>();
  const stepIndices: number[] = [];

  const visit = (node: RootContent): void => {
    rejectEmbeddedStep(node, file);
    rejectUnexpectedSpeakerNote(node, file);

    if (isSlide(node)) {
      file.fail(
        "A compiled Slide wrapper must appear only at the deck root.",
        node,
        "drever:slide-nested",
      );
    }

    if (isStep(node)) {
      if (node.attributes.some((attribute) => attribute.type === "mdxJsxExpressionAttribute")) {
        file.fail(
          "Step cannot use spread attributes because they can override its static at index.",
          node,
          "drever:step-index-dynamic",
        );
      }
      const attributes = namedAttributes(node, "at");
      if (attributes.length === 0) {
        file.fail(
          "Every Step must have a static at index after remark extensions finish.",
          node,
          "drever:step-index-missing",
        );
      }
      if (attributes.length !== 1 || !attributes[0]) {
        file.fail("A Step must declare exactly one at index.", node, "drever:step-index-invalid");
      }

      const attribute = attributes[0];
      const index = positiveStepIndex(attribute);
      if (index === undefined) {
        if (isDynamicExpression(attribute)) {
          file.fail(
            "Step at must be a static positive integer; dynamic expressions cannot define navigation stops.",
            attribute,
            "drever:step-index-dynamic",
          );
        }
        file.fail(
          "Step at must be a positive safe integer expression such as at={1}.",
          attribute,
          "drever:step-index-invalid",
        );
      }
      stops.add(index);
      stepIndices.push(index);
    }

    for (const child of descendants(node)) {
      visit(child);
    }
  };

  for (const child of slide.children as RootContent[]) {
    visit(child);
  }

  return Object.freeze({
    stepIndices: Object.freeze(stepIndices),
    stepStops: Object.freeze([...stops].toSorted((left, right) => left - right)),
  });
};

const createManifest = (slides: readonly SlideManifest[]): DeckManifest =>
  Object.freeze({
    version: DECK_MANIFEST_VERSION,
    slides: Object.freeze(
      slides.map((slide) =>
        Object.freeze({
          ...slide,
          speakerNotes: Object.freeze(slide.speakerNotes.map((note) => Object.freeze({ ...note }))),
          stepStops: Object.freeze([...slide.stepStops]),
        }),
      ),
    ),
  });

const remarkDeckManifest: Plugin<[], Root> = () => (tree, file) => {
  const wrapperData = file.data[DREVER_SLIDE_WRAPPERS_DATA_KEY];
  const speakerNotesData = file.data[DREVER_SPEAKER_NOTES_DATA_KEY];
  if (!Array.isArray(wrapperData) || wrapperData.length === 0) {
    file.fail(
      "The protected Slide wrapper snapshot is missing before manifest finalization.",
      tree,
      "drever:slide-grammar-data-invalid",
    );
  }
  const expectedWrappers = wrapperData as readonly MdxJsxFlowElement[];
  if (
    !isRecord(speakerNotesData) ||
    !Array.isArray(speakerNotesData.slides) ||
    speakerNotesData.slides.length !== expectedWrappers.length
  ) {
    file.fail(
      "The protected speaker-note snapshot is missing before manifest finalization.",
      tree,
      "drever:speaker-note-data-invalid",
    );
  }
  const expectedSpeakerNotes = (speakerNotesData as DreverSpeakerNotesSnapshot).slides;

  const slides: SlideManifest[] = [];
  const snapshotSlides: DreverRehypeSnapshot["slides"][number][] = [];
  let reachedSlides = false;

  for (const child of tree.children) {
    if (child.type === "mdxjsEsm") {
      rejectEmbeddedStep(child, file);
      rejectUnexpectedSpeakerNote(child, file);
      if (reachedSlides) {
        file.fail(
          "Root MDX ESM must remain hoisted before every compiled Slide.",
          child,
          "drever:deck-root-invalid",
        );
      }
      continue;
    }

    if (!isSlide(child)) {
      file.fail(
        `The deck root may contain only hoisted MDX ESM and protected ${DREVER_INTERNAL_SLIDE_COMPONENT} wrappers.`,
        child,
        "drever:deck-root-invalid",
      );
    }

    const slide = child as MdxJsxFlowElement;
    if (slide !== expectedWrappers[slides.length]) {
      file.fail(
        "Remark extensions cannot add, remove, replace, or reorder protected Slide wrappers.",
        slide,
        "drever:deck-pagination-mutated",
      );
    }
    reachedSlides = true;
    const identity = slideIdentity(slide, slides.length, file);
    const steps = collectStepStops(slide, file);
    const speakerNotes = expectedSpeakerNotes[slides.length] as readonly SpeakerNote[];
    slides.push(
      Object.freeze({
        ...identity,
        speakerNotes,
        stepStops: steps.stepStops,
      }),
    );
    snapshotSlides.push(
      Object.freeze({
        ...identity,
        stepIndices: steps.stepIndices,
      }),
    );
  }

  if (slides.length === 0) {
    file.fail(
      "The compiled deck must contain at least one Slide.",
      tree,
      "drever:deck-root-invalid",
    );
  }
  if (slides.length !== expectedWrappers.length) {
    file.fail(
      "Remark extensions cannot add, remove, replace, or reorder protected Slide wrappers.",
      tree,
      "drever:deck-pagination-mutated",
    );
  }
  if (
    Object.hasOwn(file.data, DREVER_DECK_MANIFEST_DATA_KEY) ||
    Object.hasOwn(file.data, DREVER_REHYPE_SNAPSHOT_DATA_KEY)
  ) {
    file.fail(
      "A reserved DeckManifest file.data field is already defined.",
      tree,
      "drever:deck-manifest-data-conflict",
    );
  }

  Object.defineProperty(file.data, DREVER_DECK_MANIFEST_DATA_KEY, {
    configurable: false,
    enumerable: true,
    value: createManifest(slides),
    writable: false,
  });
  Object.defineProperty(file.data, DREVER_REHYPE_SNAPSHOT_DATA_KEY, {
    configurable: false,
    enumerable: true,
    value: Object.freeze({ slides: Object.freeze(snapshotSlides) } satisfies DreverRehypeSnapshot),
    writable: false,
  });
};

const isDeckManifest = (value: unknown): value is DeckManifest => {
  if (
    !isRecord(value) ||
    value.version !== DECK_MANIFEST_VERSION ||
    !Array.isArray(value.slides) ||
    value.slides.length === 0
  ) {
    return false;
  }

  return value.slides.every((slide, expectedIndex) => {
    if (
      !isRecord(slide) ||
      slide.id !== `slide-${expectedIndex + 1}` ||
      slide.index !== expectedIndex ||
      !Array.isArray(slide.speakerNotes) ||
      !Array.isArray(slide.stepStops)
    ) {
      return false;
    }

    if (
      !slide.speakerNotes.every(
        (note) =>
          isRecord(note) &&
          note.format === "markdown" &&
          typeof note.plainText === "string" &&
          typeof note.value === "string",
      )
    ) {
      return false;
    }

    let previous = 0;
    for (const stop of slide.stepStops) {
      if (!Number.isSafeInteger(stop) || stop <= previous) {
        return false;
      }
      previous = stop;
    }
    return true;
  });
};

const identifier = (name: string): EstreeNode => ({ type: "Identifier", name });

const literal = (value: null | number | string): EstreeNode => ({
  type: "Literal",
  value,
  raw: JSON.stringify(value),
});

const property = (name: string, value: EstreeNode): EstreeNode => ({
  type: "Property",
  key: identifier(name),
  value,
  kind: "init",
  method: false,
  shorthand: false,
  computed: false,
});

const array = (elements: readonly EstreeNode[]): EstreeNode => ({
  type: "ArrayExpression",
  elements: [...elements],
});

const object = (properties: readonly EstreeNode[]): EstreeNode => ({
  type: "ObjectExpression",
  properties: [...properties],
});

const freeze = (value: EstreeNode, freezeIdentifier: string): EstreeNode => ({
  type: "CallExpression",
  callee: identifier(freezeIdentifier),
  arguments: [value],
  optional: false,
});

const freezeHelperDeclaration = (name: string): EstreeNode => ({
  type: "VariableDeclaration",
  kind: "const",
  declarations: [
    {
      type: "VariableDeclarator",
      id: identifier(name),
      init: {
        type: "MemberExpression",
        object: {
          type: "MemberExpression",
          object: object([]),
          property: identifier("constructor"),
          computed: false,
          optional: false,
        },
        property: identifier("freeze"),
        computed: false,
        optional: false,
      },
    },
  ],
});

const member = (object: EstreeNode, name: string): EstreeNode => ({
  type: "MemberExpression",
  object,
  property: identifier(name),
  computed: false,
  optional: false,
});

const hot = (): EstreeNode =>
  member(
    {
      type: "MetaProperty",
      meta: identifier("import"),
      property: identifier("meta"),
    },
    "hot",
  );

const hotData = (name: string): EstreeNode => member(member(hot(), "data"), name);

const conjunction = (terms: readonly [EstreeNode, EstreeNode, ...EstreeNode[]]): EstreeNode =>
  terms
    .slice(1)
    .reduce<EstreeNode>(
      (left, right) => ({ type: "LogicalExpression", operator: "&&", left, right }),
      terms[0],
    );

const strictComparison = (
  operator: "===" | "!==",
  left: EstreeNode,
  right: EstreeNode,
): EstreeNode => ({ type: "BinaryExpression", operator, left, right });

const typeOf = (argument: EstreeNode): EstreeNode => ({
  type: "UnaryExpression",
  operator: "typeof",
  prefix: true,
  argument,
});

const manifestHotData = (
  manifest: DeckManifest,
  freezeIdentifier: string,
  signatureIdentifier: string,
  nextManifestIdentifier: string,
): readonly EstreeNode[] => {
  const hotState = (): EstreeNode => hotData("dreverDeckManifestState");
  const hotStateMember = (name: string): EstreeNode => member(hotState(), name);
  const cachedManifest = (): EstreeNode => hotStateMember("manifest");
  const canReuseManifest = conjunction([
    hot(),
    strictComparison("===", typeOf(hotState()), literal("object")),
    strictComparison("!==", hotState(), literal(null)),
    strictComparison("===", hotStateMember("signature"), identifier(signatureIdentifier)),
    strictComparison("===", typeOf(cachedManifest()), literal("object")),
    strictComparison("!==", cachedManifest(), literal(null)),
  ]);

  return [
    {
      type: "VariableDeclaration",
      kind: "const",
      declarations: [
        {
          type: "VariableDeclarator",
          id: identifier(signatureIdentifier),
          init: literal(JSON.stringify(manifest)),
        },
      ],
    },
    {
      type: "VariableDeclaration",
      kind: "const",
      declarations: [
        {
          type: "VariableDeclarator",
          id: identifier(nextManifestIdentifier),
          init: manifestExpression(manifest, freezeIdentifier),
        },
      ],
    },
    {
      type: "ExportNamedDeclaration",
      declaration: {
        type: "VariableDeclaration",
        kind: "const",
        declarations: [
          {
            type: "VariableDeclarator",
            id: identifier("deckManifest"),
            init: {
              type: "ConditionalExpression",
              test: canReuseManifest,
              consequent: cachedManifest(),
              alternate: identifier(nextManifestIdentifier),
            },
          },
        ],
      },
      specifiers: [],
      source: null,
    },
    {
      type: "IfStatement",
      test: hot(),
      consequent: {
        type: "BlockStatement",
        body: [
          {
            type: "ExpressionStatement",
            expression: {
              type: "AssignmentExpression",
              operator: "=",
              left: hotData("dreverDeckManifestState"),
              right: object([
                property("signature", identifier(signatureIdentifier)),
                property("manifest", identifier("deckManifest")),
              ]),
            },
          },
        ],
      },
      alternate: null,
    },
  ];
};

const collectIdentifierNames = (root: unknown): ReadonlySet<string> => {
  const names = new Set<string>();
  const seen = new WeakSet<object>();
  const visit = (value: unknown): void => {
    if (!isRecord(value) || seen.has(value)) {
      return;
    }
    seen.add(value);
    if (value.type === "Identifier" && typeof value.name === "string") {
      names.add(value.name);
    }
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) {
        child.forEach(visit);
      } else {
        visit(child);
      }
    }
  };
  visit(root);
  return names;
};

const unusedIdentifier = (tree: EstreeProgram, prefix: string): string => {
  const names = collectIdentifierNames(tree);
  let candidate = prefix;
  let suffix = 0;
  while (names.has(candidate)) {
    suffix += 1;
    candidate = `${prefix}_${suffix}`;
  }
  return candidate;
};

const manifestExpression = (manifest: DeckManifest, freezeIdentifier: string): EstreeNode =>
  freeze(
    object([
      property("version", literal(manifest.version)),
      property(
        "slides",
        freeze(
          array(
            manifest.slides.map((slide) =>
              freeze(
                object([
                  property("id", literal(slide.id)),
                  property("index", literal(slide.index)),
                  property(
                    "speakerNotes",
                    freeze(
                      array(
                        slide.speakerNotes.map((note) =>
                          freeze(
                            object([
                              property("format", literal(note.format)),
                              property("plainText", literal(note.plainText)),
                              property("value", literal(note.value)),
                            ]),
                            freezeIdentifier,
                          ),
                        ),
                      ),
                      freezeIdentifier,
                    ),
                  ),
                  property(
                    "stepStops",
                    freeze(array(slide.stepStops.map(literal)), freezeIdentifier),
                  ),
                ]),
                freezeIdentifier,
              ),
            ),
          ),
          freezeIdentifier,
        ),
      ),
    ]),
    freezeIdentifier,
  );

const record = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  isRecord(value) ? value : undefined;

const identifierName = (value: unknown): string | undefined => {
  const node = record(value);
  return node?.type === "Identifier" && typeof node.name === "string" ? node.name : undefined;
};

const patternBinds = (value: unknown, name: string): boolean => {
  const node = record(value);
  if (!node) {
    return false;
  }
  if (node.type === "Identifier") {
    return node.name === name;
  }
  if (node.type === "RestElement") {
    return patternBinds(node.argument, name);
  }
  if (node.type === "AssignmentPattern") {
    return patternBinds(node.left, name);
  }
  if (node.type === "ArrayPattern" && Array.isArray(node.elements)) {
    return node.elements.some((element) => patternBinds(element, name));
  }
  if (node.type === "ObjectPattern" && Array.isArray(node.properties)) {
    return node.properties.some((entry) => {
      const item = record(entry);
      return item?.type === "RestElement"
        ? patternBinds(item.argument, name)
        : item?.type === "Property" && patternBinds(item.value, name);
    });
  }
  return false;
};

const declarationBinds = (value: unknown, name: string): boolean => {
  const node = record(value);
  if (!node) {
    return false;
  }
  if (node.type === "VariableDeclaration" && Array.isArray(node.declarations)) {
    return node.declarations.some((entry) => patternBinds(record(entry)?.id, name));
  }
  if (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") {
    return identifierName(node.id) === name;
  }
  return false;
};

const statementClaimsExport = (statement: EstreeNode, name: string): boolean => {
  if (statement.type === "ImportDeclaration" && Array.isArray(statement.specifiers)) {
    return statement.specifiers.some((entry) => identifierName(record(entry)?.local) === name);
  }
  if (declarationBinds(statement, name)) {
    return true;
  }
  if (statement.type === "ExportNamedDeclaration") {
    if (declarationBinds(statement.declaration, name)) {
      return true;
    }
    return (
      Array.isArray(statement.specifiers) &&
      statement.specifiers.some((entry) => {
        const exported = record(entry)?.exported;
        return identifierName(exported) === name || record(exported)?.value === name;
      })
    );
  }
  if (statement.type === "ExportDefaultDeclaration") {
    return declarationBinds(statement.declaration, name);
  }
  if (statement.type === "ExportAllDeclaration") {
    const exported = statement.exported;
    return identifierName(exported) === name || record(exported)?.value === name;
  }
  return false;
};

const nameDefaultExport = (tree: EstreeProgram, file: TransformFile): void => {
  const statement = tree.body.find((entry) => entry.type === "ExportDefaultDeclaration");
  const declaration = record(statement?.declaration);
  if (declaration?.type !== "FunctionDeclaration" || declaration.id !== null) {
    file.fail(
      "The validated MDX default export must be an anonymous function declaration.",
      statement ?? tree,
      "drever:deck-manifest-recma-shape-invalid",
    );
  }
  (declaration as { id: unknown }).id = identifier(unusedIdentifier(tree, "DreverContent"));
};

const recmaDeckManifest: Plugin<[], EstreeProgram> = () => (tree, file) => {
  validateDreverRecmaStructure(tree, file);
  const value = file.data[DREVER_DECK_MANIFEST_DATA_KEY];
  if (!isDeckManifest(value)) {
    file.fail(
      "The internal DeckManifest is missing or invalid before JavaScript emission.",
      tree,
      "drever:deck-manifest-data-invalid",
    );
  }
  const manifest = value as DeckManifest;
  if (tree.body.some((statement) => statementClaimsExport(statement, "deckManifest"))) {
    file.fail(
      'The named export "deckManifest" is reserved for Drever compiler metadata.',
      tree,
      "drever:deck-manifest-export-conflict",
    );
  }
  nameDefaultExport(tree, file);
  const freezeIdentifier = unusedIdentifier(tree, "__dreverFreeze");
  tree.body.unshift(freezeHelperDeclaration(freezeIdentifier));
  const signatureIdentifier = unusedIdentifier(tree, "__dreverManifestSignature");
  const nextManifestIdentifier = unusedIdentifier(tree, "__dreverNextManifest");
  tree.body.push(
    ...manifestHotData(manifest, freezeIdentifier, signatureIdentifier, nextManifestIdentifier),
  );
};

/** @internal Final framework validation after extension remark plugins. */
export const remarkDreverDeckManifest: Plugin = remarkDeckManifest as Plugin;

/** @internal Final framework emission after extension recma plugins. */
export const recmaDreverDeckManifest: Plugin = recmaDeckManifest as Plugin;
