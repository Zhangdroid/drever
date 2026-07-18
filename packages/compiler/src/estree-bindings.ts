export type EstreeSyntaxNode = Readonly<{
  type: string;
  [key: string]: unknown;
}>;

export type EstreeBinding = Readonly<{
  container: EstreeSyntaxNode;
  identifier: EstreeSyntaxNode;
  name: string;
}>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const syntaxNode = (value: unknown): EstreeSyntaxNode | undefined =>
  isRecord(value) && typeof value.type === "string" ? (value as EstreeSyntaxNode) : undefined;

const patternIdentifiers = (value: unknown): readonly EstreeSyntaxNode[] => {
  const node = syntaxNode(value);
  if (node === undefined) {
    return [];
  }
  if (node.type === "Identifier") {
    return [node];
  }
  if (node.type === "RestElement") {
    return patternIdentifiers(node.argument);
  }
  if (node.type === "AssignmentPattern") {
    return patternIdentifiers(node.left);
  }
  if (node.type === "ArrayPattern" && Array.isArray(node.elements)) {
    return node.elements.flatMap(patternIdentifiers);
  }
  if (node.type === "ObjectPattern" && Array.isArray(node.properties)) {
    return node.properties.flatMap((entry) => {
      const property = syntaxNode(entry);
      if (property?.type === "RestElement") {
        return patternIdentifiers(property.argument);
      }
      return property?.type === "Property" ? patternIdentifiers(property.value) : [];
    });
  }
  return [];
};

const localImportBindings = (node: EstreeSyntaxNode): readonly EstreeSyntaxNode[] =>
  Array.isArray(node.specifiers)
    ? node.specifiers.flatMap((specifier) => {
        const local = syntaxNode(syntaxNode(specifier)?.local);
        return local?.type === "Identifier" ? [local] : [];
      })
    : [];

/** Collect lexical bindings, including nested scopes, without treating property keys as names. */
export const collectEstreeBindings = (
  root: unknown,
  reservedNames: ReadonlySet<string>,
): readonly EstreeBinding[] => {
  const bindings: EstreeBinding[] = [];
  const seen = new WeakSet<object>();

  const add = (identifiers: readonly EstreeSyntaxNode[], container: EstreeSyntaxNode): void => {
    for (const identifier of identifiers) {
      const name = identifier.name;
      if (typeof name === "string" && reservedNames.has(name)) {
        bindings.push(Object.freeze({ container, identifier, name }));
      }
    }
  };

  const visit = (value: unknown, parent?: EstreeSyntaxNode): void => {
    const node = syntaxNode(value);
    if (node === undefined || seen.has(node)) {
      return;
    }
    seen.add(node);

    if (node.type === "ImportDeclaration") {
      add(localImportBindings(node), node);
    } else if (node.type === "VariableDeclarator") {
      add(patternIdentifiers(node.id), parent?.type === "VariableDeclaration" ? parent : node);
    } else if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
      add(patternIdentifiers(node.id), node);
      if (Array.isArray(node.params)) {
        add(node.params.flatMap(patternIdentifiers), node);
      }
    } else if (node.type === "ArrowFunctionExpression") {
      if (Array.isArray(node.params)) {
        add(node.params.flatMap(patternIdentifiers), node);
      }
    } else if (node.type === "ClassDeclaration" || node.type === "ClassExpression") {
      add(patternIdentifiers(node.id), node);
    } else if (node.type === "CatchClause") {
      add(patternIdentifiers(node.param), node);
    }

    const children = node.type === "Program" ? [node.body] : Object.values(node);
    for (const child of children) {
      if (Array.isArray(child)) {
        child.forEach((entry) => visit(entry, node));
      } else {
        visit(child, node);
      }
    }
  };

  visit(root);
  return Object.freeze(bindings);
};
