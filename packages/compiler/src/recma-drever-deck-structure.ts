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
  DREVER_RECMA_SNAPSHOT_DATA_KEY,
  DREVER_REHYPE_SNAPSHOT_DATA_KEY,
  type DreverRehypeSnapshot,
} from "./deck-manifest-data.ts";
import {
  collectEstreeBindings,
  type EstreeBinding,
  type EstreeSyntaxNode,
} from "./estree-bindings.ts";

type TransformFile = Parameters<Transformer<Root>>[1];

type EstreeProgram = EstreeSyntaxNode & {
  type: "Program";
  body: EstreeSyntaxNode[];
};

type StepStructure = Readonly<{
  at: number;
  node: EstreeSyntaxNode;
}>;

type SlideStructure = Readonly<{
  id: string;
  index: number;
  node: EstreeSyntaxNode;
  steps: readonly StepStructure[];
}>;

type DeckStructure = Readonly<{
  contentFunction: EstreeSyntaxNode;
  contentReturn: EstreeSyntaxNode;
  defaultExport: EstreeSyntaxNode;
  slides: readonly SlideStructure[];
}>;

type SealedNode = Readonly<{
  node: EstreeSyntaxNode;
  signature: string;
}>;

type TopLevelSeal = Readonly<{
  category: "content-binding" | "default-export" | "jsx-runtime-import" | "provider-import";
  node: EstreeSyntaxNode;
}>;

type RecmaSnapshot = Readonly<{
  bindings: readonly Readonly<{
    container: EstreeSyntaxNode;
    identifier: EstreeSyntaxNode;
    name: string;
  }>[];
  originalStatements: readonly SealedNode[];
  protectedNames: readonly string[];
  seals: readonly SealedNode[];
  structure: DeckStructure;
  topLevel: readonly TopLevelSeal[];
}>;

type HardenedWiring = Readonly<{
  contentStatement: EstreeSyntaxNode;
  protectedNames: readonly string[];
}>;

const RESERVED_COMPONENT_NAMES: ReadonlySet<string> = new Set([
  DREVER_INTERNAL_SLIDE_COMPONENT,
  DREVER_INTERNAL_STEP_COMPONENT,
]);
const JSX_RUNTIME_MODULES: ReadonlySet<string> = new Set([
  "react/jsx-dev-runtime",
  "react/jsx-runtime",
]);
const JSX_FACTORY_EXPORTS: ReadonlySet<string> = new Set(["jsx", "jsxDEV", "jsxs"]);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const syntaxNode = (value: unknown): EstreeSyntaxNode | undefined =>
  isRecord(value) && typeof value.type === "string" ? (value as EstreeSyntaxNode) : undefined;

const identifierName = (value: unknown): string | undefined => {
  const node = syntaxNode(value);
  return node?.type === "Identifier" && typeof node.name === "string" ? node.name : undefined;
};

const literalValue = (value: unknown): unknown => {
  const node = syntaxNode(value);
  return node?.type === "Literal" ? node.value : undefined;
};

const fail = (
  file: TransformFile,
  node: EstreeSyntaxNode,
  code: "drever:deck-manifest-recma-drift" | "drever:deck-manifest-recma-shape-invalid",
  message: string,
): never => file.fail(`[${code}] ${message}`, node as never, code);

const structuralSignature = (node: EstreeSyntaxNode): string => {
  const seen = new Map<object, number>();
  const encode = (value: unknown): string => {
    if (value === null) {
      return "null";
    }
    if (typeof value === "object") {
      const known = seen.get(value);
      if (known !== undefined) {
        return `reference:${known}`;
      }
      const identity = seen.size;
      seen.set(value, identity);
      if (Array.isArray(value)) {
        return `array:${identity}[${value.map(encode).join(",")}]`;
      }
      const entries = Object.entries(value)
        .map(([key, entry]) => `${JSON.stringify(key)}:${encode(entry)}`)
        .join(",");
      return `object:${identity}{${entries}}`;
    }
    if (typeof value === "number") {
      return `number:${Object.is(value, -0) ? "-0" : String(value)}`;
    }
    if (typeof value === "bigint") {
      return `bigint:${value.toString()}`;
    }
    return `${typeof value}:${JSON.stringify(value)}`;
  };
  return encode(node);
};

const propertyName = (property: EstreeSyntaxNode): string | undefined => {
  if (property.type !== "Property" || property.computed === true) {
    return;
  }
  return (
    identifierName(property.key) ??
    (typeof literalValue(property.key) === "string"
      ? (literalValue(property.key) as string)
      : undefined)
  );
};

const objectProperties = (
  value: unknown,
  file: TransformFile,
  owner: EstreeSyntaxNode,
  kind: "Slide" | "Step",
  code: "drever:deck-manifest-recma-drift" | "drever:deck-manifest-recma-shape-invalid",
): readonly EstreeSyntaxNode[] => {
  const object = syntaxNode(value);
  const rawProperties =
    object?.type === "ObjectExpression" && Array.isArray(object.properties)
      ? object.properties
      : fail(file, owner, code, `Protected ${kind} JSX must retain a static props object.`);
  const properties = rawProperties.map(syntaxNode);
  if (properties.some((property) => property === undefined)) {
    fail(file, owner, code, `Protected ${kind} JSX contains an invalid props entry.`);
  }
  return properties as readonly EstreeSyntaxNode[];
};

const jsxRuntimeImports = (tree: EstreeProgram): readonly EstreeSyntaxNode[] =>
  tree.body.filter(
    (statement) =>
      statement.type === "ImportDeclaration" &&
      JSX_RUNTIME_MODULES.has(String(literalValue(statement.source))) &&
      Array.isArray(statement.specifiers) &&
      statement.specifiers.some((value) => {
        const specifier = syntaxNode(value);
        const imported = identifierName(specifier?.imported) ?? literalValue(specifier?.imported);
        return typeof imported === "string" && JSX_FACTORY_EXPORTS.has(imported);
      }),
  );

const jsxFactoryNames = (tree: EstreeProgram): ReadonlySet<string> => {
  const names = new Set<string>();
  for (const statement of jsxRuntimeImports(tree)) {
    const specifiers = Array.isArray(statement.specifiers) ? statement.specifiers : [];
    for (const value of specifiers) {
      const specifier = syntaxNode(value);
      const imported = identifierName(specifier?.imported) ?? literalValue(specifier?.imported);
      const local = identifierName(specifier?.local);
      if (
        typeof imported === "string" &&
        JSX_FACTORY_EXPORTS.has(imported) &&
        local !== undefined
      ) {
        names.add(local);
      }
    }
  }
  return names;
};

const childNodes = (node: EstreeSyntaxNode): readonly EstreeSyntaxNode[] => {
  // Custom Program properties are metadata and are not emitted as module statements.
  const values = node.type === "Program" ? [node.body] : Object.values(node);
  return values.flatMap((value) => {
    if (Array.isArray(value)) {
      return value.flatMap((entry) => {
        const child = syntaxNode(entry);
        return child === undefined ? [] : [child];
      });
    }
    const child = syntaxNode(value);
    return child === undefined ? [] : [child];
  });
};

const containsIdentity = (root: EstreeSyntaxNode, target: EstreeSyntaxNode): boolean => {
  const seen = new WeakSet<object>();
  const visit = (node: EstreeSyntaxNode): boolean => {
    if (node === target) {
      return true;
    }
    if (seen.has(node)) {
      return false;
    }
    seen.add(node);
    return childNodes(node).some(visit);
  };
  return visit(root);
};

const componentCallName = (node: EstreeSyntaxNode): string | undefined => {
  if (node.type !== "CallExpression" || !Array.isArray(node.arguments)) {
    return;
  }
  return identifierName(node.arguments[0]);
};

const assertJsxFactory = (
  call: EstreeSyntaxNode,
  factories: ReadonlySet<string>,
  file: TransformFile,
  code: "drever:deck-manifest-recma-drift" | "drever:deck-manifest-recma-shape-invalid",
): void => {
  const callee = identifierName(call.callee);
  if (callee === undefined || !factories.has(callee)) {
    fail(file, call, code, "Protected deck components must use React's automatic JSX runtime.");
  }
};

const slideIdentity = (
  call: EstreeSyntaxNode,
  file: TransformFile,
  code: "drever:deck-manifest-recma-drift" | "drever:deck-manifest-recma-shape-invalid",
): Readonly<{ id: string; index: number }> => {
  const properties = objectProperties(
    Array.isArray(call.arguments) ? call.arguments[1] : undefined,
    file,
    call,
    "Slide",
    code,
  );
  const names = properties.map(propertyName);
  if (
    names.some((name) => name === undefined) ||
    names.some((name) => name !== "children" && name !== "id" && name !== "index") ||
    new Set(names).size !== names.length
  ) {
    fail(file, call, code, "Protected Slide JSX retained unexpected, duplicate, or dynamic props.");
  }
  const idProperty = properties.find((property) => propertyName(property) === "id");
  const indexProperty = properties.find((property) => propertyName(property) === "index");
  const idValue = literalValue(idProperty?.value);
  const indexValue = literalValue(indexProperty?.value);
  const id =
    typeof idValue === "string"
      ? idValue
      : fail(file, call, code, "Protected Slide JSX lost its static id or index.");
  const index =
    typeof indexValue === "number" && Number.isSafeInteger(indexValue)
      ? indexValue
      : fail(file, call, code, "Protected Slide JSX lost its static id or index.");
  return { id, index };
};

const stepIndex = (
  call: EstreeSyntaxNode,
  file: TransformFile,
  code: "drever:deck-manifest-recma-drift" | "drever:deck-manifest-recma-shape-invalid",
): number => {
  const properties = objectProperties(
    Array.isArray(call.arguments) ? call.arguments[1] : undefined,
    file,
    call,
    "Step",
    code,
  );
  if (properties.some((property) => property.type !== "Property" || property.computed === true)) {
    fail(file, call, code, "Protected Step JSX cannot contain spread or computed props.");
  }
  const at = properties.filter((property) => propertyName(property) === "at");
  const value = at.length === 1 ? literalValue(at[0]?.value) : undefined;
  const index =
    typeof value === "number" && Number.isSafeInteger(value) && value > 0
      ? value
      : fail(
          file,
          call,
          code,
          "Protected Step JSX must retain exactly one static positive at prop.",
        );
  return index;
};

const collectDeckStructure = (
  tree: EstreeProgram,
  file: TransformFile,
  code: "drever:deck-manifest-recma-drift" | "drever:deck-manifest-recma-shape-invalid",
): DeckStructure => {
  const factories = jsxFactoryNames(tree);
  if (factories.size === 0) {
    fail(file, tree, code, "The React automatic JSX runtime import is missing.");
  }

  const slides: SlideStructure[] = [];
  let contentFunction: EstreeSyntaxNode | undefined;
  let contentReturn: EstreeSyntaxNode | undefined;

  const visit = (
    node: EstreeSyntaxNode,
    ancestors: readonly EstreeSyntaxNode[],
    activeSlide?: { steps: StepStructure[] },
  ): void => {
    const name = componentCallName(node);
    const isFactoryCall =
      node.type === "CallExpression" && factories.has(identifierName(node.callee) ?? "");
    if (isFactoryCall && name === "Step") {
      fail(file, node, code, "Recma output introduced an unprotected public Step JSX call.");
    }
    if (name === DREVER_INTERNAL_SLIDE_COMPONENT) {
      assertJsxFactory(node, factories, file, code);
      if (activeSlide !== undefined) {
        fail(file, node, code, "Protected Slide JSX cannot be nested inside another Slide.");
      }
      const identity = slideIdentity(node, file, code);
      const steps: StepStructure[] = [];
      const slide = Object.freeze({ ...identity, node, steps });
      slides.push(slide);

      const nearestReturn = ancestors.findLast((ancestor) => ancestor.type === "ReturnStatement");
      const nearestFunction = ancestors.findLast((ancestor) =>
        ["ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression"].includes(
          ancestor.type,
        ),
      );
      if (nearestReturn === undefined || nearestFunction === undefined) {
        fail(file, node, code, "Protected Slides must remain in the compiled content return tree.");
      }
      contentReturn ??= nearestReturn;
      contentFunction ??= nearestFunction;
      if (contentReturn !== nearestReturn || contentFunction !== nearestFunction) {
        fail(
          file,
          node,
          code,
          "Every protected Slide must remain in one compiled content return tree.",
        );
      }

      const props = syntaxNode(Array.isArray(node.arguments) ? node.arguments[1] : undefined);
      if (props !== undefined) {
        visit(props, [...ancestors, node], { steps });
      }
      return;
    }
    if (name === DREVER_INTERNAL_STEP_COMPONENT) {
      assertJsxFactory(node, factories, file, code);
      const owner =
        activeSlide ??
        fail(file, node, code, "Protected Step JSX must remain inside a protected Slide.");
      owner.steps.push(Object.freeze({ at: stepIndex(node, file, code), node }));
      const props = syntaxNode(Array.isArray(node.arguments) ? node.arguments[1] : undefined);
      if (props !== undefined) {
        visit(props, [...ancestors, node], owner);
      }
      return;
    }

    childNodes(node).forEach((child) => visit(child, [...ancestors, node], activeSlide));
  };

  visit(tree, []);
  if (slides.length === 0 || contentFunction === undefined || contentReturn === undefined) {
    fail(file, tree, code, "The compiled content return tree contains no protected Slides.");
  }
  const resolvedContentFunction =
    contentFunction ?? fail(file, tree, code, "The compiled content function is missing.");
  const resolvedContentReturn =
    contentReturn ?? fail(file, tree, code, "The compiled content return is missing.");
  const defaultExports = tree.body.filter(
    (statement) => statement.type === "ExportDefaultDeclaration",
  );
  const defaultExport =
    defaultExports.length === 1 && defaultExports[0]
      ? defaultExports[0]
      : fail(file, tree, code, "The compiled deck must retain one default export.");
  const contentName = identifierName(resolvedContentFunction.id);
  if (
    contentName === undefined ||
    !childNodes(defaultExport).some(function containsContentCall(node): boolean {
      return (
        (node.type === "CallExpression" && identifierName(node.callee) === contentName) ||
        childNodes(node).some(containsContentCall)
      );
    })
  ) {
    fail(
      file,
      tree,
      code,
      "The default MDX export no longer renders the protected content function.",
    );
  }

  return Object.freeze({
    contentFunction: resolvedContentFunction,
    contentReturn: resolvedContentReturn,
    defaultExport,
    slides: Object.freeze(
      slides.map((slide) => Object.freeze({ ...slide, steps: Object.freeze([...slide.steps]) })),
    ),
  });
};

const isManifest = (value: unknown): value is DeckManifest =>
  isRecord(value) &&
  value.version === DECK_MANIFEST_VERSION &&
  Array.isArray(value.slides) &&
  value.slides.length > 0 &&
  value.slides.every(
    (slide) =>
      isRecord(slide) &&
      Array.isArray(slide.speakerNotes) &&
      slide.speakerNotes.every(
        (note) =>
          isRecord(note) &&
          note.format === "markdown" &&
          typeof note.plainText === "string" &&
          typeof note.value === "string",
      ),
  );

const isRehypeSnapshot = (value: unknown): value is DreverRehypeSnapshot =>
  isRecord(value) && Array.isArray(value.slides) && value.slides.length > 0;

const sameNumbers = (left: readonly number[], right: readonly number[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const validateDataProjection = (
  structure: DeckStructure,
  manifest: DeckManifest,
  snapshot: DreverRehypeSnapshot,
  file: TransformFile,
  code: "drever:deck-manifest-recma-drift" | "drever:deck-manifest-recma-shape-invalid",
): void => {
  if (
    structure.slides.length !== manifest.slides.length ||
    structure.slides.length !== snapshot.slides.length
  ) {
    fail(file, structure.contentReturn, code, "Protected Slide count drifted from DeckManifest.");
  }
  structure.slides.forEach((slide, index) => {
    const manifestSlide =
      manifest.slides[index] ??
      fail(file, slide.node, code, `DeckManifest is missing Slide ${index + 1}.`);
    const expected =
      snapshot.slides[index] ??
      fail(file, slide.node, code, `The Remark snapshot is missing Slide ${index + 1}.`);
    if (
      slide.id !== manifestSlide.id ||
      slide.id !== expected.id ||
      slide.index !== manifestSlide.index ||
      slide.index !== expected.index
    ) {
      fail(
        file,
        slide.node,
        code,
        `Protected Slide ${index + 1} identity drifted from DeckManifest.`,
      );
    }
    const indices = slide.steps.map((step) => step.at);
    const stops = [...new Set(indices)].toSorted((left, right) => left - right);
    if (
      !sameNumbers(indices, expected.stepIndices) ||
      !sameNumbers(stops, manifestSlide.stepStops)
    ) {
      fail(file, slide.node, code, `Protected Slide ${index + 1} Step sequence drifted.`);
    }
  });
};

const bindingsByName = (
  tree: EstreeProgram,
  structure: DeckStructure,
  file: TransformFile,
  code: "drever:deck-manifest-recma-drift" | "drever:deck-manifest-recma-shape-invalid",
): readonly EstreeBinding[] => {
  const expectedNames = [
    DREVER_INTERNAL_SLIDE_COMPONENT,
    ...(structure.slides.some((slide) => slide.steps.length > 0)
      ? [DREVER_INTERNAL_STEP_COMPONENT]
      : []),
  ];
  const bindings = collectEstreeBindings(tree, RESERVED_COMPONENT_NAMES);
  if (
    bindings.length !== expectedNames.length ||
    expectedNames.some((name) => bindings.filter((binding) => binding.name === name).length !== 1)
  ) {
    fail(file, tree, code, "Reserved internal component lexical bindings were added or removed.");
  }
  return Object.freeze(
    [...bindings].toSorted((left, right) => left.name.localeCompare(right.name)),
  );
};

const providerImport = (tree: EstreeProgram, localName: string): EstreeSyntaxNode | undefined =>
  tree.body.find(
    (statement) =>
      statement.type === "ImportDeclaration" &&
      Array.isArray(statement.specifiers) &&
      statement.specifiers.some((value) => {
        const specifier = syntaxNode(value);
        return (
          (identifierName(specifier?.imported) ?? literalValue(specifier?.imported)) ===
            "useMDXComponents" && identifierName(specifier?.local) === localName
        );
      }),
  );

const containsReference = (root: unknown, target: EstreeSyntaxNode): boolean => {
  if (root === target) {
    return true;
  }
  if (!isRecord(root)) {
    return false;
  }
  return Object.values(root).some((value) =>
    Array.isArray(value)
      ? value.some((entry) => containsReference(entry, target))
      : containsReference(value, target),
  );
};

const protectProviderBindings = (
  tree: EstreeProgram,
  bindings: readonly EstreeBinding[],
  file: TransformFile,
): readonly [EstreeSyntaxNode, EstreeSyntaxNode] => {
  const declarations = [...new Set(bindings.map((binding) => binding.container))];
  const candidate = declarations.length === 1 ? declarations[0] : undefined;
  const declaration =
    candidate?.type === "VariableDeclaration" && Array.isArray(candidate.declarations)
      ? candidate
      : fail(
          file,
          tree,
          "drever:deck-manifest-recma-shape-invalid",
          "Internal component bindings do not use the expected generated provider declaration.",
        );
  const rawDeclarations = declaration.declarations as readonly unknown[];
  const bindingDeclarator = rawDeclarations
    .map(syntaxNode)
    .find(
      (candidate) =>
        candidate?.type === "VariableDeclarator" &&
        bindings.every((binding) => containsReference(candidate.id, binding.identifier)),
    );
  const componentsName = identifierName(bindingDeclarator?.init);
  const componentsDeclarator = rawDeclarations
    .map(syntaxNode)
    .find(
      (candidate) =>
        candidate?.type === "VariableDeclarator" &&
        identifierName(candidate.id) === componentsName &&
        syntaxNode(candidate.init)?.type === "ObjectExpression",
    );
  const componentsObject = syntaxNode(componentsDeclarator?.init);
  const properties =
    Array.isArray(componentsObject?.properties) && componentsObject.properties
      ? (componentsObject.properties as EstreeSyntaxNode[])
      : fail(
          file,
          declaration,
          "drever:deck-manifest-recma-shape-invalid",
          "The generated component provider object is missing.",
        );
  const providerCalls = properties.flatMap((property) => {
    if (property.type !== "SpreadElement") {
      return [];
    }
    const argument = syntaxNode(property.argument);
    const local = argument?.type === "CallExpression" ? identifierName(argument.callee) : undefined;
    const imported = local === undefined ? undefined : providerImport(tree, local);
    return imported === undefined || local === undefined ? [] : [{ imported, local }];
  });
  const provider =
    providerCalls.length === 1 && providerCalls[0]
      ? providerCalls[0]
      : fail(
          file,
          declaration,
          "drever:deck-manifest-recma-shape-invalid",
          "The generated component provider resolution has an unexpected shape.",
        );

  for (const binding of bindings) {
    if (properties.some((property) => propertyName(property) === binding.name)) {
      fail(
        file,
        declaration,
        "drever:deck-manifest-recma-shape-invalid",
        `The generated provider already defines the reserved ${binding.name} override.`,
      );
    }
    properties.push({
      type: "Property",
      key: { type: "Identifier", name: binding.name },
      value: {
        type: "MemberExpression",
        object: {
          type: "CallExpression",
          callee: { type: "Identifier", name: provider.local },
          arguments: [],
          optional: false,
        },
        property: { type: "Identifier", name: binding.name },
        computed: false,
        optional: false,
      },
      kind: "init",
      method: false,
      shorthand: false,
      computed: false,
    });
  }
  return Object.freeze([declaration, provider.imported] as const);
};

const hardenMutableWiring = (
  tree: EstreeProgram,
  structure: DeckStructure,
  file: TransformFile,
): HardenedWiring => {
  const contentIndex = tree.body.indexOf(structure.contentFunction);
  if (contentIndex < 0 || structure.contentFunction.type !== "FunctionDeclaration") {
    fail(
      file,
      structure.contentFunction,
      "drever:deck-manifest-recma-shape-invalid",
      "The generated content function does not use the expected top-level declaration.",
    );
  }
  const contentName =
    identifierName(structure.contentFunction.id) ??
    fail(
      file,
      structure.contentFunction,
      "drever:deck-manifest-recma-shape-invalid",
      "The generated content function has no stable identifier.",
    );

  const mutableContent = structure.contentFunction as { type: string };
  mutableContent.type = "FunctionExpression";
  const contentStatement: EstreeSyntaxNode = {
    type: "VariableDeclaration",
    kind: "const",
    declarations: [
      {
        type: "VariableDeclarator",
        id: { type: "Identifier", name: contentName },
        init: structure.contentFunction,
      },
    ],
  };
  tree.body[contentIndex] = contentStatement;

  const defaultFunction =
    syntaxNode(structure.defaultExport.declaration) ??
    fail(
      file,
      structure.defaultExport,
      "drever:deck-manifest-recma-shape-invalid",
      "The generated default export does not use the expected function declaration.",
    );
  if (!["FunctionDeclaration", "FunctionExpression"].includes(defaultFunction.type)) {
    fail(
      file,
      structure.defaultExport,
      "drever:deck-manifest-recma-shape-invalid",
      "The generated default export does not use the expected function declaration.",
    );
  }
  (defaultFunction as unknown as { id: unknown }).id = null;

  return Object.freeze({
    contentStatement,
    protectedNames: Object.freeze([contentName]),
  });
};

const isRecmaSnapshot = (value: unknown): value is RecmaSnapshot =>
  isRecord(value) &&
  isRecord(value.structure) &&
  Array.isArray(value.structure.slides) &&
  Array.isArray(value.bindings) &&
  Array.isArray(value.originalStatements) &&
  Array.isArray(value.protectedNames) &&
  Array.isArray(value.seals) &&
  Array.isArray(value.topLevel);

const createTopLevelSeals = (
  tree: EstreeProgram,
  structure: DeckStructure,
  contentStatement: EstreeSyntaxNode,
  runtimeImports: readonly EstreeSyntaxNode[],
  providerImportNode: EstreeSyntaxNode,
  file: TransformFile,
): readonly TopLevelSeal[] => {
  const categories = new Map<EstreeSyntaxNode, TopLevelSeal["category"]>([
    [contentStatement, "content-binding"],
    [structure.defaultExport, "default-export"],
    [providerImportNode, "provider-import"],
    ...runtimeImports.map((node) => [node, "jsx-runtime-import"] as const),
  ]);
  const result = tree.body.flatMap((node) => {
    const category = categories.get(node);
    return category === undefined ? [] : [Object.freeze({ category, node })];
  });
  if (result.length !== categories.size) {
    fail(
      file,
      tree,
      "drever:deck-manifest-recma-shape-invalid",
      "Protected Recma wiring must start as direct Program.body members.",
    );
  }
  return Object.freeze(result);
};

const validateTopLevelSeals = (
  tree: EstreeProgram,
  entries: readonly TopLevelSeal[],
  file: TransformFile,
): void => {
  let previousIndex = -1;
  for (const entry of entries) {
    const index = tree.body.indexOf(entry.node);
    const hasExpectedType =
      entry.category === "content-binding"
        ? entry.node.type === "VariableDeclaration"
        : entry.category === "default-export"
          ? entry.node.type === "ExportDefaultDeclaration"
          : entry.node.type === "ImportDeclaration";
    if (index <= previousIndex || !hasExpectedType) {
      fail(
        file,
        tree,
        "drever:deck-manifest-recma-drift",
        `Protected ${entry.category} left or changed its Program.body slot.`,
      );
    }
    previousIndex = index;
  }
};

const validateOriginalStatements = (
  tree: EstreeProgram,
  entries: readonly SealedNode[],
  protectedNames: readonly string[],
  file: TransformFile,
): void => {
  let previousIndex = -1;
  const original = new Set(entries.map((entry) => entry.node));
  for (const entry of entries) {
    const indices = tree.body.flatMap((node, index) => (node === entry.node ? [index] : []));
    const index = indices[0] ?? -1;
    if (
      indices.length !== 1 ||
      index <= previousIndex ||
      structuralSignature(entry.node) !== entry.signature
    ) {
      fail(
        file,
        tree,
        "drever:deck-manifest-recma-drift",
        "An original compiled module statement was changed, replaced, removed, or reordered.",
      );
    }
    previousIndex = index;
  }

  const reserved = new Set(protectedNames);
  for (const statement of tree.body) {
    if (original.has(statement)) {
      continue;
    }
    let violation: string | undefined;
    const seen = new WeakSet<object>();
    const visit = (node: EstreeSyntaxNode): void => {
      if (violation !== undefined || seen.has(node)) {
        return;
      }
      seen.add(node);
      const name = identifierName(node);
      if (name !== undefined && reserved.has(name)) {
        violation = `reference to protected binding ${name}`;
        return;
      }
      if (node.type === "CallExpression" && identifierName(node.callee) === "eval") {
        violation = "direct eval";
        return;
      }
      for (const [key, value] of Object.entries(node)) {
        const isStaticKey =
          node.computed !== true &&
          key === "key" &&
          ["MethodDefinition", "Property", "PropertyDefinition"].includes(node.type);
        const isStaticMember =
          node.computed !== true &&
          key === "property" &&
          (node.type === "MemberExpression" || node.type === "OptionalMemberExpression");
        if (isStaticKey || isStaticMember) {
          continue;
        }
        const values = Array.isArray(value) ? value : [value];
        for (const entry of values) {
          const child = syntaxNode(entry);
          if (child !== undefined) {
            visit(child);
          }
        }
      }
    };
    visit(statement);
    if (violation !== undefined) {
      fail(
        file,
        statement,
        "drever:deck-manifest-recma-drift",
        `An extension Recma statement contains a forbidden ${violation}.`,
      );
    }
  }
};

const recmaDeckSeal: Plugin<[], EstreeProgram> = () => (tree, file) => {
  const manifest = file.data[DREVER_DECK_MANIFEST_DATA_KEY];
  const rehypeSnapshot = file.data[DREVER_REHYPE_SNAPSHOT_DATA_KEY];
  if (!isManifest(manifest) || !isRehypeSnapshot(rehypeSnapshot)) {
    file.fail(
      "The DeckManifest validation data is missing before Recma sealing.",
      tree,
      "drever:deck-manifest-recma-data-invalid",
    );
  }
  const resolvedManifest = manifest as DeckManifest;
  const resolvedRehypeSnapshot = rehypeSnapshot as DreverRehypeSnapshot;
  if (Object.hasOwn(file.data, DREVER_RECMA_SNAPSHOT_DATA_KEY)) {
    file.fail(
      "The reserved Recma deck snapshot is already defined.",
      tree,
      "drever:deck-manifest-recma-data-conflict",
    );
  }

  const initialStructure = collectDeckStructure(
    tree,
    file,
    "drever:deck-manifest-recma-shape-invalid",
  );
  validateDataProjection(
    initialStructure,
    resolvedManifest,
    resolvedRehypeSnapshot,
    file,
    "drever:deck-manifest-recma-shape-invalid",
  );
  const initialBindings = bindingsByName(
    tree,
    initialStructure,
    file,
    "drever:deck-manifest-recma-shape-invalid",
  );
  const providerSeals = protectProviderBindings(tree, initialBindings, file);
  const hardened = hardenMutableWiring(tree, initialStructure, file);
  const structure = collectDeckStructure(tree, file, "drever:deck-manifest-recma-shape-invalid");
  validateDataProjection(
    structure,
    resolvedManifest,
    resolvedRehypeSnapshot,
    file,
    "drever:deck-manifest-recma-shape-invalid",
  );
  const bindings = bindingsByName(
    tree,
    structure,
    file,
    "drever:deck-manifest-recma-shape-invalid",
  );
  const runtimeImports = jsxRuntimeImports(tree);
  const seals = Object.freeze(
    [
      structure.contentFunction,
      structure.contentReturn,
      structure.defaultExport,
      ...runtimeImports,
      ...providerSeals,
    ].map((node) => Object.freeze({ node, signature: structuralSignature(node) })),
  );
  const originalStatements = Object.freeze(
    tree.body.map((node) => Object.freeze({ node, signature: structuralSignature(node) })),
  );
  const snapshot: RecmaSnapshot = Object.freeze({
    bindings: Object.freeze(bindings.map((binding) => Object.freeze({ ...binding }))),
    originalStatements,
    protectedNames: hardened.protectedNames,
    seals,
    structure,
    topLevel: createTopLevelSeals(
      tree,
      structure,
      hardened.contentStatement,
      runtimeImports,
      providerSeals[1],
      file,
    ),
  });
  Object.defineProperty(file.data, DREVER_RECMA_SNAPSHOT_DATA_KEY, {
    configurable: false,
    enumerable: true,
    value: snapshot,
    writable: false,
  });
};

export const validateDreverRecmaStructure = (tree: EstreeProgram, file: TransformFile): void => {
  const manifest = file.data[DREVER_DECK_MANIFEST_DATA_KEY];
  const rehypeSnapshot = file.data[DREVER_REHYPE_SNAPSHOT_DATA_KEY];
  const sealed = file.data[DREVER_RECMA_SNAPSHOT_DATA_KEY];
  if (!isManifest(manifest) || !isRehypeSnapshot(rehypeSnapshot) || !isRecmaSnapshot(sealed)) {
    file.fail(
      "The protected Recma deck snapshot is missing before final emission.",
      tree,
      "drever:deck-manifest-recma-data-invalid",
    );
  }
  const resolvedManifest = manifest as DeckManifest;
  const resolvedRehypeSnapshot = rehypeSnapshot as DreverRehypeSnapshot;
  const resolvedSeal = sealed as RecmaSnapshot;

  validateOriginalStatements(
    tree,
    resolvedSeal.originalStatements,
    resolvedSeal.protectedNames,
    file,
  );
  validateTopLevelSeals(tree, resolvedSeal.topLevel, file);
  const structure = collectDeckStructure(tree, file, "drever:deck-manifest-recma-drift");
  validateDataProjection(
    structure,
    resolvedManifest,
    resolvedRehypeSnapshot,
    file,
    "drever:deck-manifest-recma-drift",
  );
  if (
    structure.contentFunction !== resolvedSeal.structure.contentFunction ||
    structure.contentReturn !== resolvedSeal.structure.contentReturn ||
    structure.defaultExport !== resolvedSeal.structure.defaultExport ||
    structure.slides.length !== resolvedSeal.structure.slides.length
  ) {
    fail(
      file,
      tree,
      "drever:deck-manifest-recma-drift",
      "The protected deck render wiring changed.",
    );
  }
  structure.slides.forEach((slide, index) => {
    const expected = resolvedSeal.structure.slides[index];
    if (
      expected === undefined ||
      slide.node !== expected.node ||
      slide.steps.length !== expected.steps.length ||
      slide.steps.some((step, stepIndex) => step.node !== expected.steps[stepIndex]?.node)
    ) {
      fail(
        file,
        slide.node,
        "drever:deck-manifest-recma-drift",
        `Protected Slide ${index + 1} or its Step occurrences were replaced or moved.`,
      );
    }
  });

  const bindings = bindingsByName(tree, structure, file, "drever:deck-manifest-recma-drift");
  if (
    bindings.length !== resolvedSeal.bindings.length ||
    bindings.some(
      (binding, index) =>
        binding.identifier !== resolvedSeal.bindings[index]?.identifier ||
        binding.container !== resolvedSeal.bindings[index]?.container,
    )
  ) {
    fail(file, tree, "drever:deck-manifest-recma-drift", "Protected component bindings changed.");
  }
  for (const entry of resolvedSeal.seals) {
    if (
      !containsIdentity(tree, entry.node) ||
      structuralSignature(entry.node) !== entry.signature
    ) {
      fail(
        file,
        tree,
        "drever:deck-manifest-recma-drift",
        "Protected provider resolution or deck render wiring changed.",
      );
    }
  }
};

/** @internal Framework seal before extension Recma plugins. */
export const recmaDreverDeckSeal: Plugin = recmaDeckSeal as unknown as Plugin;
