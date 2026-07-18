import {
  DECK_MANIFEST_VERSION,
  DREVER_INTERNAL_SLIDE_COMPONENT,
  DREVER_INTERNAL_STEP_COMPONENT,
  type DeckManifest,
} from "@drever/schema";
import type { Root, RootContent } from "mdast";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified, type Plugin } from "unified";
import { describe, expect, it } from "vite-plus/test";
import {
  DREVER_DECK_MANIFEST_DATA_KEY,
  recmaDreverDeckManifest,
  remarkDreverDeckManifest,
} from "./deck-manifest-finalizers.ts";
import { DREVER_REHYPE_SNAPSHOT_DATA_KEY } from "./deck-manifest-data.ts";
import { recmaDreverDeckSeal } from "./recma-drever-deck-structure.ts";
import { remarkDreverSlideGrammar } from "./remark-drever-slide-grammar.ts";

const captureManifest = async (
  source: string,
  extensions: readonly Plugin<[], Root>[] = [],
): Promise<DeckManifest> => {
  let manifest: DeckManifest | undefined;
  const capture: Plugin<[], Root> = () => (_tree, file) => {
    manifest = file.data[DREVER_DECK_MANIFEST_DATA_KEY] as DeckManifest | undefined;
  };
  const processor = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkDreverSlideGrammar)
    .use([...extensions])
    .use(remarkDreverDeckManifest)
    .use(capture);

  await processor.run(processor.parse(source), { path: "slides.mdx", value: source });
  if (!manifest) {
    throw new Error("Expected the remark finalizer to produce a DeckManifest.");
  }
  return manifest;
};

const visit = (node: RootContent, callback: (node: RootContent) => void): void => {
  callback(node);
  if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children as RootContent[]) {
      visit(child, callback);
    }
  }
};

describe("remarkDreverDeckManifest", () => {
  it("captures exact sorted unique positive Step stops for every slide", async () => {
    const manifest = await captureManifest(`<Step at={4}>Later</Step>

<Step at={2}>Earlier</Step>

<Step at={4}>Together</Step>

---

# No steps`);

    expect(manifest).toEqual({
      version: DECK_MANIFEST_VERSION,
      slides: [
        { id: "slide-1", index: 0, speakerNotes: [], stepStops: [2, 4] },
        { id: "slide-2", index: 1, speakerNotes: [], stepStops: [], title: "No steps" },
      ],
    });
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.slides)).toBe(true);
    expect(Object.isFrozen(manifest.slides[0])).toBe(true);
    expect(Object.isFrozen(manifest.slides[0]?.stepStops)).toBe(true);
  });

  it("infers normalized static titles without making titles mandatory", async () => {
    const manifest =
      await captureManifest(`# Build **one** [clear story](https://example.com) with \`MDX\`

# Ignore this later heading

---

# Hello {audience}

## Static fallback is not the first heading

---

<Masthead title="  Layout   title  " />

---

<Feature aria-label="Accessible feature" heading="Visible feature" />

---

<TwoColumn primary="A" secondary="B" />`);

    expect(manifest.slides.map((slide) => slide.title)).toEqual([
      "Build one clear story with MDX",
      undefined,
      "Layout title",
      "Accessible feature",
      undefined,
    ]);
    expect(Object.hasOwn(manifest.slides[1] as object, "title")).toBe(false);
    expect(Object.hasOwn(manifest.slides[4] as object, "title")).toBe(false);
  });

  it("uses the first top-level JSX element and only static semantic props", async () => {
    const manifest = await captureManifest(`<Badge />

<Masthead title="Later layout" />

---

<Statement title={dynamicTitle} label="Static fallback" />

---

<Workbench aria-label="" label="Architecture workbench" />`);

    expect(manifest.slides.map((slide) => slide.title)).toEqual([
      undefined,
      "Static fallback",
      "Architecture workbench",
    ]);
  });

  it("extracts exact Markdown plus readable text and removes notes from audience MDX", async () => {
    let audienceContainsNote = false;
    const inspectAudienceTree: Plugin<[], Root> = () => (tree) => {
      for (const child of tree.children) {
        visit(child, (node) => {
          if (
            (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
            node.name === "Note"
          ) {
            audienceContainsNote = true;
          }
        });
      }
    };
    const manifest = await captureManifest(
      `# Opening

<Note>Remember **the result** and [source](https://example.com).</Note>

<Note>
## Timing

- Pause after chart
- Ask the room

\`30 seconds\`
</Note>

---

# Closing

<Note>
Thank everyone.
</Note>`,
      [inspectAudienceTree],
    );

    expect(audienceContainsNote).toBe(false);
    expect(manifest.slides.map(({ speakerNotes }) => speakerNotes)).toEqual([
      [
        {
          format: "markdown",
          plainText: "Remember the result and source.",
          value: "Remember **the result** and [source](https://example.com).",
        },
        {
          format: "markdown",
          plainText: "Timing\n\n- Pause after chart\n- Ask the room\n\n30 seconds",
          value: "## Timing\n\n- Pause after chart\n- Ask the room\n\n`30 seconds`",
        },
      ],
      [{ format: "markdown", plainText: "Thank everyone.", value: "Thank everyone." }],
    ]);
    expect(Object.isFrozen(manifest.slides[0]?.speakerNotes)).toBe(true);
    expect(Object.isFrozen(manifest.slides[0]?.speakerNotes[0])).toBe(true);
  });

  it("rejects every dynamic speaker-note form instead of omitting it", async () => {
    for (const source of [
      "<Note>{speakerName}</Note>",
      "{showNotes ? <Note>Conditional</Note> : null}",
      "export const DynamicNote = () => <Note>Hoisted</Note>\n\n# Slide",
    ]) {
      await expect(captureManifest(source)).rejects.toMatchObject({
        source: "drever",
        ruleId: "speaker-note-dynamic-content",
      });
    }
  });

  it("rejects attributes, nested JSX, and notes introduced after grammar capture", async () => {
    await expect(captureManifest('<Note tone="quiet">Text</Note>')).rejects.toMatchObject({
      source: "drever",
      ruleId: "speaker-note-attributes-unsupported",
    });
    await expect(captureManifest("<Note>Use <Badge>this</Badge></Note>")).rejects.toMatchObject({
      source: "drever",
      ruleId: "speaker-note-markdown-only",
    });

    const introduceNote: Plugin<[], Root> = () => (tree) => {
      const slide = tree.children.find(
        (node) =>
          node.type === "mdxJsxFlowElement" && node.name === DREVER_INTERNAL_SLIDE_COMPONENT,
      );
      if (slide?.type === "mdxJsxFlowElement") {
        slide.children.push({
          type: "mdxJsxFlowElement",
          name: "Note",
          attributes: [],
          children: [{ type: "paragraph", children: [{ type: "text", value: "Late" }] }],
        });
      }
    };
    await expect(captureManifest("# Slide", [introduceNote])).rejects.toMatchObject({
      source: "drever",
      ruleId: "speaker-note-remark-mutated",
    });
  });

  it("runs after extensions and rejects a Step whose at index was removed", async () => {
    const removeStepIndex: Plugin<[], Root> = () => (tree) => {
      for (const child of tree.children) {
        visit(child, (node) => {
          if (
            (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
            node.name === "Step"
          ) {
            node.attributes = node.attributes.filter(
              (attribute) => attribute.type !== "mdxJsxAttribute" || attribute.name !== "at",
            );
          }
        });
      }
    };

    await expect(
      captureManifest("<Step>Changed by an extension</Step>", [removeStepIndex]),
    ).rejects.toMatchObject({ source: "drever", ruleId: "step-index-missing" });
  });

  it("rejects dynamic and non-positive Step stops even when no implicit Step follows", async () => {
    await expect(captureManifest("<Step at={state}>Dynamic</Step>")).rejects.toMatchObject({
      source: "drever",
      ruleId: "step-index-dynamic",
    });
    await expect(captureManifest("<Step at={0}>Zero</Step>")).rejects.toMatchObject({
      source: "drever",
      ruleId: "step-index-invalid",
    });
  });

  it("rejects Steps hidden inside JavaScript or MDX expressions", async () => {
    for (const source of [
      "{true && <Step at={2}>Conditional</Step>}",
      "<Card reveal={<Step at={3}>Attribute</Step>} />",
      "<Card {...{reveal: <Step at={3}>Spread</Step>}} />",
      "export const Reveal = () => <Step at={1}>Hoisted</Step>\n\n# Slide",
    ]) {
      await expect(captureManifest(source)).rejects.toMatchObject({
        source: "drever",
        ruleId: "step-expression-unsupported",
      });
    }
  });

  it("rejects Step spreads that can override a static navigation index", async () => {
    await expect(captureManifest("<Step at={2} {...props}>Unsafe</Step>")).rejects.toMatchObject({
      source: "drever",
      ruleId: "step-index-dynamic",
    });
  });

  it("rejects removal or replacement of protected Slide wrappers", async () => {
    const removeTail: Plugin<[], Root> = () => (tree) => {
      tree.children.pop();
    };
    const replaceFirst: Plugin<[], Root> = () => (tree) => {
      const first = tree.children[0];
      if (first !== undefined) {
        tree.children[0] = structuredClone(first);
      }
    };

    await expect(captureManifest("# One\n\n---\n\n# Two", [removeTail])).rejects.toMatchObject({
      source: "drever",
      ruleId: "deck-pagination-mutated",
    });
    await expect(captureManifest("# One", [replaceFirst])).rejects.toMatchObject({
      source: "drever",
      ruleId: "deck-pagination-mutated",
    });
  });

  it("rejects extra props on protected Slide wrappers", async () => {
    const addControlledState: Plugin<[], Root> = () => (tree) => {
      const first = tree.children.find(
        (node) =>
          node.type === "mdxJsxFlowElement" && node.name === DREVER_INTERNAL_SLIDE_COMPONENT,
      );
      if (first?.type === "mdxJsxFlowElement") {
        first.attributes.push({ type: "mdxJsxAttribute", name: "active", value: null });
      }
    };

    await expect(captureManifest("# One", [addControlledState])).rejects.toMatchObject({
      source: "drever",
      ruleId: "slide-identity-invalid",
    });
  });

  it("rejects root nodes introduced outside protected Slide wrappers", async () => {
    const appendRootContent: Plugin<[], Root> = () => (tree) => {
      tree.children.push({ type: "paragraph", children: [{ type: "text", value: "escaped" }] });
    };

    await expect(captureManifest("# Valid", [appendRootContent])).rejects.toMatchObject({
      source: "drever",
      ruleId: "deck-root-invalid",
    });
  });
});

describe("recmaDreverDeckManifest", () => {
  type TestProgram = Record<string, unknown> & {
    type: "Program";
    sourceType: "module";
    body: Record<string, unknown>[];
  };

  const manifest: DeckManifest = Object.freeze({
    version: DECK_MANIFEST_VERSION,
    slides: Object.freeze([
      Object.freeze({
        id: "slide-1",
        index: 0,
        title: "Pause with intent",
        speakerNotes: Object.freeze([
          Object.freeze({
            format: "markdown" as const,
            plainText: "Pause here.",
            value: "Pause **here**.",
          }),
        ]),
        stepStops: Object.freeze([1, 3]),
      }),
    ]),
  });

  const identifier = (name: string): Record<string, unknown> => ({ type: "Identifier", name });
  const literal = (value: boolean | number | string): Record<string, unknown> => ({
    type: "Literal",
    value,
    raw: JSON.stringify(value),
  });
  const node = (value: unknown): Record<string, unknown> | undefined =>
    typeof value === "object" && value !== null && "type" in value
      ? (value as Record<string, unknown>)
      : undefined;
  const property = (name: string, value: Record<string, unknown>): Record<string, unknown> => ({
    type: "Property",
    key: identifier(name),
    value,
    kind: "init",
    method: false,
    shorthand: false,
    computed: false,
  });
  const jsx = (
    factory: "_jsx" | "_jsxs",
    component: string,
    properties: Record<string, unknown>[],
  ): Record<string, unknown> => ({
    type: "CallExpression",
    callee: identifier(factory),
    arguments: [identifier(component), { type: "ObjectExpression", properties }],
    optional: false,
  });
  const createProgram = (extraStatements: Record<string, unknown>[] = []): TestProgram => {
    const steps = [
      jsx("_jsx", DREVER_INTERNAL_STEP_COMPONENT, [property("at", literal(1))]),
      jsx("_jsx", DREVER_INTERNAL_STEP_COMPONENT, [property("at", literal(3))]),
    ];
    const slide = jsx("_jsxs", DREVER_INTERNAL_SLIDE_COMPONENT, [
      property("id", literal("slide-1")),
      property("index", literal(0)),
      property("children", { type: "ArrayExpression", elements: steps }),
    ]);
    return {
      type: "Program",
      sourceType: "module",
      body: [
        {
          type: "ImportDeclaration",
          specifiers: [
            {
              type: "ImportSpecifier",
              imported: identifier("jsx"),
              local: identifier("_jsx"),
            },
            {
              type: "ImportSpecifier",
              imported: identifier("jsxs"),
              local: identifier("_jsxs"),
            },
          ],
          source: literal("react/jsx-runtime"),
        },
        {
          type: "ImportDeclaration",
          specifiers: [
            {
              type: "ImportSpecifier",
              imported: identifier("useMDXComponents"),
              local: identifier("_provideComponents"),
            },
          ],
          source: literal("virtual:drever/mdx-components"),
        },
        ...extraStatements,
        {
          type: "FunctionDeclaration",
          id: identifier("_createMdxContent"),
          params: [identifier("props")],
          body: {
            type: "BlockStatement",
            body: [
              {
                type: "VariableDeclaration",
                kind: "const",
                declarations: [
                  {
                    type: "VariableDeclarator",
                    id: identifier("_components"),
                    init: {
                      type: "ObjectExpression",
                      properties: [
                        {
                          type: "SpreadElement",
                          argument: {
                            type: "CallExpression",
                            callee: identifier("_provideComponents"),
                            arguments: [],
                            optional: false,
                          },
                        },
                        {
                          type: "SpreadElement",
                          argument: {
                            type: "MemberExpression",
                            object: identifier("props"),
                            property: identifier("components"),
                            computed: false,
                            optional: false,
                          },
                        },
                      ],
                    },
                  },
                  {
                    type: "VariableDeclarator",
                    id: {
                      type: "ObjectPattern",
                      properties: [
                        property(
                          DREVER_INTERNAL_STEP_COMPONENT,
                          identifier(DREVER_INTERNAL_STEP_COMPONENT),
                        ),
                        property(
                          DREVER_INTERNAL_SLIDE_COMPONENT,
                          identifier(DREVER_INTERNAL_SLIDE_COMPONENT),
                        ),
                      ],
                    },
                    init: identifier("_components"),
                  },
                ],
              },
              { type: "ReturnStatement", argument: slide },
            ],
          },
        },
        {
          type: "ExportDefaultDeclaration",
          declaration: {
            type: "FunctionDeclaration",
            id: identifier("MDXContent"),
            params: [identifier("props")],
            body: {
              type: "BlockStatement",
              body: [
                {
                  type: "ReturnStatement",
                  argument: {
                    type: "CallExpression",
                    callee: identifier("_createMdxContent"),
                    arguments: [identifier("props")],
                    optional: false,
                  },
                },
              ],
            },
          },
        },
      ],
    };
  };

  const run = async (
    extraStatements: Record<string, unknown>[] = [],
    mutate?: (tree: TestProgram) => void,
    manifestData: unknown = manifest,
  ): Promise<Record<string, unknown>[]> => {
    const seed: Plugin = () => (_tree, file) => {
      file.data[DREVER_DECK_MANIFEST_DATA_KEY] = manifestData;
      file.data[DREVER_REHYPE_SNAPSHOT_DATA_KEY] = Object.freeze({
        slides: Object.freeze([
          Object.freeze({ id: "slide-1", index: 0, stepIndices: Object.freeze([1, 3]) }),
        ]),
      });
    };
    const extension: Plugin = () => (tree) => {
      mutate?.(tree as unknown as TestProgram);
    };
    const program = createProgram(extraStatements);
    await unified()
      .use(seed)
      .use(recmaDreverDeckSeal)
      .use(extension)
      .use(recmaDreverDeckManifest)
      .run(program);
    return program.body;
  };

  it("appends a named export whose object, slides, slide, and stops are frozen", async () => {
    const body = await run();

    expect(body[0]).toMatchObject({
      type: "VariableDeclaration",
      declarations: [
        {
          id: { type: "Identifier", name: "__dreverFreeze" },
          init: {
            type: "MemberExpression",
            object: { object: { type: "ObjectExpression" }, property: { name: "constructor" } },
            property: { name: "freeze" },
          },
        },
      ],
    });
    const nextManifest = body.find(
      (statement) =>
        statement.type === "VariableDeclaration" &&
        Array.isArray(statement.declarations) &&
        statement.declarations.some(
          (declaration) => node(node(declaration)?.id)?.name === "__dreverNextManifest",
        ),
    );
    expect(nextManifest).toMatchObject({
      type: "VariableDeclaration",
      kind: "const",
      declarations: [
        {
          id: { type: "Identifier", name: "__dreverNextManifest" },
          init: {
            type: "CallExpression",
            callee: { type: "Identifier", name: "__dreverFreeze" },
            arguments: [
              {
                properties: [
                  { key: { name: "version" }, value: { value: DECK_MANIFEST_VERSION } },
                  {
                    key: { name: "slides" },
                    value: {
                      type: "CallExpression",
                      arguments: [
                        {
                          elements: [
                            {
                              type: "CallExpression",
                              arguments: [
                                {
                                  properties: [
                                    { key: { name: "id" }, value: { value: "slide-1" } },
                                    { key: { name: "index" }, value: { value: 0 } },
                                    {
                                      key: { name: "title" },
                                      value: { value: "Pause with intent" },
                                    },
                                    {
                                      key: { name: "speakerNotes" },
                                      value: {
                                        type: "CallExpression",
                                        arguments: [
                                          {
                                            elements: [
                                              {
                                                type: "CallExpression",
                                                arguments: [
                                                  {
                                                    properties: [
                                                      {
                                                        key: { name: "format" },
                                                        value: { value: "markdown" },
                                                      },
                                                      {
                                                        key: { name: "plainText" },
                                                        value: { value: "Pause here." },
                                                      },
                                                      {
                                                        key: { name: "value" },
                                                        value: { value: "Pause **here**." },
                                                      },
                                                    ],
                                                  },
                                                ],
                                              },
                                            ],
                                          },
                                        ],
                                      },
                                    },
                                    {
                                      key: { name: "stepStops" },
                                      value: {
                                        type: "CallExpression",
                                        arguments: [{ elements: [{ value: 1 }, { value: 3 }] }],
                                      },
                                    },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    });
    expect(
      body.find(
        (statement) =>
          statement.type === "VariableDeclaration" &&
          Array.isArray(statement.declarations) &&
          statement.declarations.some(
            (declaration) => node(node(declaration)?.id)?.name === "__dreverManifestSignature",
          ),
      ),
    ).toMatchObject({
      declarations: [
        {
          init: {
            value: JSON.stringify({
              version: manifest.version,
              slides: manifest.slides.map(({ id, index, speakerNotes, stepStops }) => ({
                id,
                index,
                speakerNotes,
                stepStops,
              })),
            }),
          },
        },
      ],
    });
    expect(
      body.find((statement) => {
        const declaration = node(statement.declaration);
        return (
          statement.type === "ExportNamedDeclaration" &&
          Array.isArray(declaration?.declarations) &&
          declaration.declarations.some((entry) => node(node(entry)?.id)?.name === "deckManifest")
        );
      }),
    ).toMatchObject({
      declaration: {
        declarations: [
          {
            init: {
              type: "ConditionalExpression",
              consequent: {
                object: { property: { name: "dreverDeckManifestState" } },
                property: { name: "manifest" },
              },
              alternate: { name: "__dreverNextManifest" },
            },
          },
        ],
      },
    });
    expect(body.at(-1)).toMatchObject({
      type: "IfStatement",
      test: { property: { name: "hot" } },
      consequent: {
        body: [
          {
            expression: {
              type: "AssignmentExpression",
              left: { property: { name: "dreverDeckManifestState" } },
              right: {
                type: "ObjectExpression",
                properties: [
                  { key: { name: "signature" }, value: { name: "__dreverManifestSignature" } },
                  { key: { name: "manifest" }, value: { name: "deckManifest" } },
                ],
              },
            },
          },
        ],
      },
    });
    expect(JSON.stringify(body.at(-1))).not.toContain("dispose");

    const contentStatement = body.find(
      (statement) =>
        statement.type === "VariableDeclaration" &&
        Array.isArray(statement.declarations) &&
        statement.declarations.some(
          (declaration) => node(node(declaration)?.id)?.name === "_createMdxContent",
        ),
    );
    const contentDeclarator = Array.isArray(contentStatement?.declarations)
      ? node(contentStatement.declarations[0])
      : undefined;
    const content = node(contentDeclarator?.init);
    const block = node(content?.body);
    const declaration = Array.isArray(block?.body) ? node(block.body[0]) : undefined;
    const declarator = Array.isArray(declaration?.declarations)
      ? node(declaration.declarations[0])
      : undefined;
    const components = node(declarator?.init);
    const properties = Array.isArray(components?.properties) ? components.properties.map(node) : [];
    expect(properties.slice(-2).map((entry) => node(entry?.key)?.name)).toEqual([
      DREVER_INTERNAL_SLIDE_COMPONENT,
      DREVER_INTERNAL_STEP_COMPONENT,
    ]);
    expect(properties.slice(-2)).toMatchObject([
      { value: { object: { callee: { name: "_provideComponents" } } } },
      { value: { object: { callee: { name: "_provideComponents" } } } },
    ]);
    expect(contentStatement).toMatchObject({ type: "VariableDeclaration", kind: "const" });
    expect(content).toMatchObject({
      type: "FunctionExpression",
      id: { name: "_createMdxContent" },
    });
    expect(body.find((statement) => statement.type === "ExportDefaultDeclaration")).toMatchObject({
      declaration: { type: "FunctionDeclaration", id: { name: "DreverContent" } },
    });
  });

  it.each(["", 42])("rejects an invalid optional slide title (%j)", async (title) => {
    const invalidManifest = {
      ...manifest,
      slides: [{ ...manifest.slides[0], title }],
    };

    await expect(run([], undefined, invalidManifest)).rejects.toMatchObject({
      source: "drever",
      ruleId: "deck-manifest-data-invalid",
    });
  });

  it("chooses a freeze helper identifier that cannot collide with extension output", async () => {
    const body = await run([
      {
        type: "VariableDeclaration",
        kind: "const",
        declarations: [
          {
            type: "VariableDeclarator",
            id: { type: "Identifier", name: "__dreverFreeze" },
            init: { type: "Identifier", name: "Object" },
          },
        ],
      },
    ]);

    expect(body[0]).toMatchObject({
      declarations: [{ id: { name: "__dreverFreeze_1" } }],
    });
    expect(
      body.find(
        (statement) =>
          statement.type === "VariableDeclaration" &&
          Array.isArray(statement.declarations) &&
          statement.declarations.some(
            (declaration) => node(node(declaration)?.id)?.name === "__dreverNextManifest",
          ),
      ),
    ).toMatchObject({
      declarations: [{ init: { callee: { name: "__dreverFreeze_1" } } }],
    });
  });

  it("chooses a refresh component name that cannot collide with extension output", async () => {
    const body = await run([
      {
        type: "VariableDeclaration",
        kind: "const",
        declarations: [
          {
            type: "VariableDeclarator",
            id: identifier("DreverContent"),
            init: literal("extension-owned"),
          },
        ],
      },
    ]);

    expect(body.find((statement) => statement.type === "ExportDefaultDeclaration")).toMatchObject({
      declaration: { type: "FunctionDeclaration", id: { name: "DreverContent_1" } },
    });
  });

  it("rejects an extension binding that collides with the reserved named export", async () => {
    await expect(
      run([
        {
          type: "ExportNamedDeclaration",
          declaration: {
            type: "VariableDeclaration",
            kind: "const",
            declarations: [
              {
                type: "VariableDeclarator",
                id: { type: "Identifier", name: "deckManifest" },
                init: { type: "Literal", value: null, raw: "null" },
              },
            ],
          },
          specifiers: [],
          source: null,
        },
      ]),
    ).rejects.toMatchObject({ source: "drever", ruleId: "deck-manifest-export-conflict" });
  });

  it("rejects mutation of the sealed JSX runtime import binding", async () => {
    await expect(
      run([], (tree) => {
        const runtimeImport = tree.body[0];
        const specifier = Array.isArray(runtimeImport?.specifiers)
          ? runtimeImport.specifiers[0]
          : undefined;
        if (typeof specifier === "object" && specifier !== null) {
          specifier.imported = identifier("jsxs");
        }
      }),
    ).rejects.toMatchObject({ source: "drever", ruleId: "deck-manifest-recma-drift" });
  });

  it("rejects an extension that reassigns the protected content binding", async () => {
    await expect(
      run([], (tree) => {
        tree.body.push({
          type: "ExpressionStatement",
          expression: {
            type: "AssignmentExpression",
            operator: "=",
            left: identifier("_createMdxContent"),
            right: {
              type: "ArrowFunctionExpression",
              params: [],
              body: { type: "Literal", value: null, raw: "null" },
              expression: true,
              async: false,
            },
          },
        });
      }),
    ).rejects.toMatchObject({ source: "drever", ruleId: "deck-manifest-recma-drift" });
  });

  it("rejects direct eval in an inserted Recma statement", async () => {
    await expect(
      run([], (tree) => {
        tree.body.push({
          type: "ExpressionStatement",
          expression: {
            type: "CallExpression",
            callee: identifier("eval"),
            arguments: [literal("_createMdxContent = () => null")],
            optional: false,
          },
        });
      }),
    ).rejects.toMatchObject({ source: "drever", ruleId: "deck-manifest-recma-drift" });
  });

  it("rejects mutation of the sealed component-provider import source", async () => {
    await expect(
      run([], (tree) => {
        const provider = tree.body.find(
          (statement) =>
            statement.type === "ImportDeclaration" &&
            node(statement.source)?.value === "virtual:drever/mdx-components",
        );
        if (provider === undefined) {
          throw new TypeError("Expected the generated provider import.");
        }
        provider.source = literal("./evil.js");
      }),
    ).rejects.toMatchObject({ source: "drever", ruleId: "deck-manifest-recma-drift" });
  });

  it("allows independent metadata to use the removed default-export name", async () => {
    const body = await run([], (tree) => {
      tree.body.push({
        type: "ExportNamedDeclaration",
        declaration: {
          type: "VariableDeclaration",
          kind: "const",
          declarations: [
            {
              type: "VariableDeclarator",
              id: identifier("recmaMetadata"),
              init: {
                type: "ObjectExpression",
                properties: [
                  property("MDXContent", literal(true)),
                  property("_createMdxContent", literal(true)),
                ],
              },
            },
          ],
        },
        specifiers: [],
        source: null,
      });
      tree.body.push({
        type: "ExportNamedDeclaration",
        declaration: {
          type: "FunctionDeclaration",
          id: identifier("inspect"),
          params: [identifier("MDXContent")],
          body: {
            type: "BlockStatement",
            body: [{ type: "ReturnStatement", argument: identifier("MDXContent") }],
          },
          generator: false,
          async: false,
        },
        specifiers: [],
        source: null,
      });
    });

    const metadata = body.find((statement) => {
      const declaration = node(statement.declaration);
      return (
        statement.type === "ExportNamedDeclaration" &&
        Array.isArray(declaration?.declarations) &&
        declaration.declarations.some(
          (declarator) => node(node(declarator)?.id)?.name === "recmaMetadata",
        )
      );
    });
    expect(metadata).toMatchObject({
      type: "ExportNamedDeclaration",
      declaration: {
        declarations: [
          {
            id: { name: "recmaMetadata" },
            init: {
              properties: [
                { key: { name: "MDXContent" }, value: { value: true } },
                { key: { name: "_createMdxContent" }, value: { value: true } },
              ],
            },
          },
        ],
      },
    });
    const inspect = body.find(
      (statement) =>
        statement.type === "ExportNamedDeclaration" &&
        node(statement.declaration)?.type === "FunctionDeclaration" &&
        node(node(statement.declaration)?.id)?.name === "inspect",
    );
    expect(inspect).toMatchObject({
      type: "ExportNamedDeclaration",
      declaration: {
        type: "FunctionDeclaration",
        id: { name: "inspect" },
        params: [{ name: "MDXContent" }],
      },
    });
  });

  it.each([
    [
      "content function",
      (statement: Record<string, unknown>) =>
        statement.type === "VariableDeclaration" &&
        Array.isArray(statement.declarations) &&
        statement.declarations.some(
          (declaration) => node(node(declaration)?.id)?.name === "_createMdxContent",
        ),
    ],
    [
      "provider import",
      (statement: Record<string, unknown>) =>
        statement.type === "ImportDeclaration" &&
        node(statement.source)?.value === "virtual:drever/mdx-components",
    ],
  ] as const)(
    "rejects moving the sealed %s to a hidden Program property",
    async (_name, matches) => {
      await expect(
        run([], (tree) => {
          const index = tree.body.findIndex(matches);
          const original = tree.body[index];
          if (index < 0 || original === undefined) {
            throw new TypeError("Expected protected top-level wiring.");
          }
          tree.body[index] = structuredClone(original);
          tree.hidden = original;
        }),
      ).rejects.toMatchObject({ source: "drever", ruleId: "deck-manifest-recma-drift" });
    },
  );

  it("rejects inserting the same original module statement object twice", async () => {
    const authorStatement = {
      type: "ExpressionStatement",
      expression: {
        type: "CallExpression",
        callee: identifier("authorSideEffect"),
        arguments: [],
        optional: false,
      },
    };

    await expect(
      run([authorStatement], (tree) => {
        tree.body.push(authorStatement);
      }),
    ).rejects.toMatchObject({ source: "drever", ruleId: "deck-manifest-recma-drift" });
  });

  it("rejects recma emission without validated remark data", async () => {
    const program = { type: "Program", sourceType: "module", body: [] };

    await expect(unified().use(recmaDreverDeckManifest).run(program)).rejects.toMatchObject({
      source: "drever",
      ruleId: "deck-manifest-recma-data-invalid",
    });
  });
});
