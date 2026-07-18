import { afterEach, describe, expect, it } from "vite-plus/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineRecmaPlugin, defineRehypePlugin } from "@drever/plugin";
import type { Plugin as UnifiedPlugin } from "unified";
import { build, type Plugin } from "vite";
import { createDreverVitePlugins } from "./create-vite-plugins.ts";
import { createTestPlan } from "./test/plan.ts";

const temporaryDirectories: string[] = [];
const MUTATOR_ID = "test-rehype-mutator";
const MUTATOR_SPECIFIER = "virtual:test-rehype-mutator";
const RECMA_MUTATOR_ID = "test-recma-mutator";
const RECMA_MUTATOR_SPECIFIER = "virtual:test-recma-mutator";

type RehypeMutation = "add-step" | "modify-slide" | "modify-step" | "remove-step";
type RecmaMutation =
  | "early-return"
  | "modify-slide"
  | "modify-step"
  | "move-content-hidden"
  | "provider-import-source"
  | "reassign-content"
  | "remove-slide"
  | "remove-step"
  | "reserved-binding"
  | "safe-default-name-metadata";
type SyntaxNode = Record<string, unknown> & { type: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const syntaxNode = (value: unknown): SyntaxNode | undefined =>
  isRecord(value) && typeof value.type === "string" ? (value as SyntaxNode) : undefined;

const findNode = (
  root: SyntaxNode,
  predicate: (node: SyntaxNode) => boolean,
): SyntaxNode | undefined => {
  if (predicate(root)) {
    return root;
  }
  if (!Array.isArray(root.children)) {
    return;
  }
  for (const child of root.children) {
    const node = syntaxNode(child);
    const found = node === undefined ? undefined : findNode(node, predicate);
    if (found !== undefined) {
      return found;
    }
  }
};

const findEstreeNode = (
  root: SyntaxNode,
  predicate: (node: SyntaxNode) => boolean,
): SyntaxNode | undefined => {
  const seen = new WeakSet<object>();
  const visit = (node: SyntaxNode): SyntaxNode | undefined => {
    if (predicate(node)) {
      return node;
    }
    if (seen.has(node)) {
      return;
    }
    seen.add(node);
    for (const value of Object.values(node)) {
      const values = Array.isArray(value) ? value : [value];
      for (const entry of values) {
        const child = syntaxNode(entry);
        const found = child === undefined ? undefined : visit(child);
        if (found !== undefined) {
          return found;
        }
      }
    }
  };
  return visit(root);
};

const identifier = (name: string): SyntaxNode => ({ type: "Identifier", name });

const componentCall = (node: SyntaxNode, name: string): boolean =>
  node.type === "CallExpression" &&
  Array.isArray(node.arguments) &&
  isRecord(node.arguments[0]) &&
  node.arguments[0].type === "Identifier" &&
  node.arguments[0].name === name;

const mutationPlugin =
  (mutation: RehypeMutation): UnifiedPlugin =>
  () =>
  (tree) => {
    const root = syntaxNode(tree);
    if (root === undefined) {
      throw new TypeError("Expected a Rehype syntax tree.");
    }
    const slide = findNode(root, (node) => node.name === "__DreverSlide");
    const step = findNode(root, (node) => node.name === "Step");
    if (slide === undefined || step === undefined || !Array.isArray(slide.children)) {
      throw new TypeError("Expected the fixture to contain one Slide and one Step.");
    }

    if (mutation === "add-step") {
      slide.children.push(structuredClone(step));
      return;
    }
    if (mutation === "remove-step") {
      slide.children = slide.children.filter((child) => child !== step);
      return;
    }
    if (mutation === "modify-slide") {
      if (!Array.isArray(slide.attributes)) {
        throw new TypeError("Expected the Slide to contain attributes.");
      }
      slide.attributes.push({ type: "mdxJsxAttribute", name: "active", value: null });
      return;
    }
    if (!Array.isArray(step.attributes)) {
      throw new TypeError("Expected the Step to contain attributes.");
    }
    const at = step.attributes.find(
      (attribute) =>
        isRecord(attribute) && attribute.type === "mdxJsxAttribute" && attribute.name === "at",
    );
    if (!isRecord(at) || !isRecord(at.value)) {
      throw new TypeError("Expected the Step to contain a static at attribute.");
    }
    at.value.value = "3";
    const data = isRecord(at.value.data) ? at.value.data : undefined;
    const estree = isRecord(data?.estree) ? data.estree : undefined;
    const statement =
      Array.isArray(estree?.body) && isRecord(estree.body[0]) ? estree.body[0] : undefined;
    const expression = isRecord(statement?.expression) ? statement.expression : undefined;
    if (expression?.type !== "Literal") {
      throw new TypeError("Expected the Step index expression to be a literal.");
    }
    expression.value = 3;
    expression.raw = "3";
  };

const createMutationAdapter = (mutation: RehypeMutation) =>
  createDreverVitePlugins(
    createTestPlan({
      plugins: [{ id: MUTATOR_ID, origin: "user" }],
      build: {
        rehype: [
          {
            owner: { kind: "plugin", id: MUTATOR_ID },
            phase: "normal",
            module: { specifier: MUTATOR_SPECIFIER },
          },
        ],
      },
    }),
    {
      importModule: async (specifier) => {
        if (specifier !== MUTATOR_SPECIFIER) {
          throw new Error(`Unexpected test module ${specifier}.`);
        }
        return { default: defineRehypePlugin(() => mutationPlugin(mutation)) };
      },
    },
  );

const recmaMutationPlugin =
  (mutation: RecmaMutation): UnifiedPlugin =>
  () =>
  (tree) => {
    const root = syntaxNode(tree);
    if (root?.type !== "Program" || !Array.isArray(root.body)) {
      throw new TypeError("Expected a Recma Program.");
    }
    const slide = findEstreeNode(root, (node) => componentCall(node, "__DreverSlide"));
    const step = findEstreeNode(root, (node) => componentCall(node, "__DreverStep"));
    if (slide === undefined || step === undefined) {
      throw new TypeError("Expected the fixture to contain one protected Slide and Step.");
    }

    if (mutation === "provider-import-source") {
      const provider = root.body
        .map(syntaxNode)
        .find(
          (statement) =>
            statement?.type === "ImportDeclaration" &&
            syntaxNode(statement.source)?.value === "virtual:drever/mdx-components",
        );
      const source = syntaxNode(provider?.source);
      if (source?.type !== "Literal") {
        throw new TypeError("Expected the generated provider import.");
      }
      source.value = "./evil.js";
      source.raw = '"./evil.js"';
      return;
    }
    if (mutation === "safe-default-name-metadata") {
      root.body.push(
        {
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
                    {
                      type: "Property",
                      key: identifier("MDXContent"),
                      value: { type: "Literal", value: true, raw: "true" },
                      kind: "init",
                      method: false,
                      shorthand: false,
                      computed: false,
                    },
                  ],
                },
              },
            ],
          },
          specifiers: [],
          source: null,
        },
        {
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
        },
      );
      return;
    }
    if (mutation === "reassign-content") {
      root.body.push({
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
      return;
    }
    if (mutation === "reserved-binding") {
      root.body.push({
        type: "VariableDeclaration",
        kind: "const",
        declarations: [
          {
            type: "VariableDeclarator",
            id: identifier("__DreverStep"),
            init: { type: "Literal", value: null, raw: "null" },
          },
        ],
      });
      return;
    }
    if (mutation === "move-content-hidden") {
      const index = root.body.findIndex(
        (statement) =>
          isRecord(statement) &&
          findEstreeNode(statement as SyntaxNode, (node) => node === slide) !== undefined,
      );
      const original = index < 0 ? undefined : syntaxNode(root.body[index]);
      if (original === undefined) {
        throw new TypeError("Expected the compiled content function.");
      }
      root.body[index] = structuredClone(original);
      root.hidden = original;
      return;
    }
    if (mutation === "early-return") {
      const contentStatement = root.body
        .map(syntaxNode)
        .find(
          (statement) =>
            statement !== undefined &&
            findEstreeNode(statement, (node) => node === slide) !== undefined,
        );
      const content =
        contentStatement === undefined
          ? undefined
          : findEstreeNode(
              contentStatement,
              (node) =>
                node.type === "FunctionExpression" &&
                findEstreeNode(node, (candidate) => candidate === slide) !== undefined,
            );
      const body = syntaxNode(content?.body);
      if (body?.type !== "BlockStatement" || !Array.isArray(body.body)) {
        throw new TypeError("Expected the compiled content function body.");
      }
      body.body.unshift({
        type: "ReturnStatement",
        argument: { type: "Literal", value: null, raw: "null" },
      });
      return;
    }

    const target = mutation.endsWith("slide") ? slide : step;
    if (mutation.startsWith("remove")) {
      (target.arguments as unknown[])[0] = identifier(
        target === slide ? "RemovedSlide" : "RemovedStep",
      );
      return;
    }
    const props = syntaxNode((target.arguments as unknown[])[1]);
    const property = Array.isArray(props?.properties)
      ? props.properties
          .map(syntaxNode)
          .find(
            (candidate) =>
              candidate?.type === "Property" &&
              isRecord(candidate.key) &&
              candidate.key.type === "Identifier" &&
              candidate.key.name === (target === slide ? "id" : "at"),
          )
      : undefined;
    const value = syntaxNode(property?.value);
    if (value?.type !== "Literal") {
      throw new TypeError("Expected a protected static component prop.");
    }
    value.value = target === slide ? "changed-slide" : 3;
    value.raw = target === slide ? '"changed-slide"' : "3";
  };

const createRecmaMutationAdapter = (mutation: RecmaMutation) =>
  createDreverVitePlugins(
    createTestPlan({
      plugins: [{ id: RECMA_MUTATOR_ID, origin: "user" }],
      build: {
        recma: [
          {
            owner: { kind: "plugin", id: RECMA_MUTATOR_ID },
            phase: "normal",
            module: { specifier: RECMA_MUTATOR_SPECIFIER },
          },
        ],
      },
    }),
    {
      importModule: async (specifier) => {
        if (specifier !== RECMA_MUTATOR_SPECIFIER) {
          throw new Error(`Unexpected test module ${specifier}.`);
        }
        return { default: defineRecmaPlugin(() => recmaMutationPlugin(mutation)) };
      },
    },
  );

const buildCode = async (
  directory: string,
  entryPath: string,
  plugins: readonly Plugin[],
  externalReact = true,
) => {
  const output = await build({
    root: directory,
    configFile: false,
    logLevel: "silent",
    plugins: [...plugins],
    resolve: {
      alias: [
        {
          find: "@drever/schema",
          replacement: fileURLToPath(new URL("../../schema/src/index.ts", import.meta.url)),
        },
        {
          find: "@drever/core",
          replacement: fileURLToPath(new URL("../../core/src/index.ts", import.meta.url)),
        },
        ...(externalReact
          ? []
          : [
              {
                find: "react/jsx-runtime",
                replacement: fileURLToPath(
                  new URL("../../core/node_modules/react/jsx-runtime.js", import.meta.url),
                ),
              },
              {
                find: "react",
                replacement: fileURLToPath(
                  new URL("../../core/node_modules/react/index.js", import.meta.url),
                ),
              },
            ]),
      ],
    },
    build: {
      write: false,
      minify: false,
      lib: { entry: entryPath, formats: ["es"], cssFileName: "drever-test" },
      rolldownOptions: externalReact ? { external: ["react", "react/jsx-runtime"] } : {},
    },
  });
  const result = Array.isArray(output) ? output[0] : output;
  if (!result || !("output" in result)) {
    throw new Error("Expected an in-memory Vite build output.");
  }
  return result.output
    .filter((item) => item.type === "chunk")
    .map((item) => item.code)
    .join("\n");
};

const failureText = (error: unknown): string => {
  if (!isRecord(error)) {
    return String(error);
  }
  return [error.name, error.message, error.source, error.ruleId, error.cause]
    .map((value) => (value === error ? "" : failureText(value)))
    .join(" ");
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("createDreverVitePlugins", () => {
  it("rejects browser-lite plans without loading build modules", async () => {
    const result = await createDreverVitePlugins(createTestPlan({ target: "browser-lite" }));
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: "DREVER_VITE_TARGET_INVALID", stage: "config" }],
    });
  });

  it("keeps framework grammar ahead of extension and React transforms", async () => {
    const result = await createDreverVitePlugins(createTestPlan());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const plugins = result.value as unknown as readonly Plugin[];
    expect(plugins[0]).toMatchObject({ name: "drever:runtime-modules", enforce: "pre" });
    expect(plugins[1]).toMatchObject({ name: "@mdx-js/rollup", enforce: "pre" });
    expect(plugins.some(({ name }) => name === "vite:react-babel")).toBe(true);
  });

  it("builds MDX against the generated Drever component provider", async () => {
    const directory = await mkdtemp(join(tmpdir(), "drever-vite-"));
    temporaryDirectories.push(directory);
    const entryPath = join(directory, "entry.js");
    await writeFile(entryPath, 'export { default as Deck, deckManifest } from "./deck.mdx";\n');
    await writeFile(join(directory, "evil.js"), "export default () => 'not a slide';\n");
    await writeFile(
      join(directory, "deck.mdx"),
      'import Slide from "./evil.js"\nimport Step from "./evil.js"\n\n# Hello\n\n<span>{123n}</span>\n\n<Step>Reveal</Step>\n\n<Step at={4}>Later</Step>\n\n<Step at={2}>Earlier</Step>\n\n<Step at={4}>Together</Step>\n\n<Note>Emphasize the **main result**.</Note>\n\n---\n\n# Second\n',
    );

    const captured: Readonly<{ manifest: unknown; path: string }>[] = [];
    const adapter = await createDreverVitePlugins(createTestPlan(), {
      onDeckManifest: (manifest, path) => captured.push({ manifest, path }),
    });
    expect(adapter.ok).toBe(true);
    if (!adapter.ok) {
      return;
    }

    const code = await buildCode(directory, entryPath, adapter.value as readonly Plugin[]);

    expect(code).toContain("data-drever-step");
    expect(code).toContain("__DreverSlide");
    expect(code).toContain("__DreverStep");
    expect(code).toContain("123n");
    expect(code).toContain("at: 1");
    expect(code).toContain('id: "slide-1"');
    expect(code).toContain('id: "slide-2"');
    expect(code).toContain("useMDXComponents");
    expect(code).toMatch(/(?:const|var) _createMdxContent = function _createMdxContent/u);
    expect(code).not.toMatch(/\bfunction MDXContent\b/u);
    expect(code).toContain("deckManifest");
    expect(code).toContain('plainText: "Emphasize the main result."');
    expect(code).toContain('value: "Emphasize the **main result**."');
    expect(code).toMatch(/(?:const|var) __dreverFreeze\w* = \{\}\.constructor\.freeze/u);
    expect(code).toMatch(/stepStops:\s*__dreverFreeze\w*\(\[\s*1,\s*2,\s*4\s*\]\)/u);
    expect(captured).toEqual([
      {
        manifest: expect.objectContaining({
          slides: [
            expect.objectContaining({ id: "slide-1", stepStops: [1, 2, 4] }),
            expect.objectContaining({ id: "slide-2", stepStops: [] }),
          ],
        }),
        path: expect.stringMatching(/\/deck\.mdx$/u),
      },
    ]);
  });

  it("surfaces dynamic speaker notes as a Drever compiler diagnostic", async () => {
    const directory = await mkdtemp(join(tmpdir(), "drever-vite-note-diagnostic-"));
    temporaryDirectories.push(directory);
    const entryPath = join(directory, "entry.js");
    await writeFile(entryPath, 'export { default } from "./deck.mdx";\n');
    await writeFile(join(directory, "deck.mdx"), "# Hello\n\n<Note>{speakerName}</Note>\n");

    const adapter = await createDreverVitePlugins(createTestPlan());
    expect(adapter.ok).toBe(true);
    if (!adapter.ok) {
      return;
    }

    let failure: unknown;
    try {
      await buildCode(directory, entryPath, adapter.value as readonly Plugin[]);
    } catch (error) {
      failure = error;
    }
    expect(failureText(failure)).toContain("must be static Markdown");
  });

  it.each<RehypeMutation>(["add-step", "remove-step", "modify-step", "modify-slide"])(
    "rejects %s mutations made by an extension Rehype plugin",
    async (mutation) => {
      const directory = await mkdtemp(join(tmpdir(), "drever-vite-rehype-"));
      temporaryDirectories.push(directory);
      const entryPath = join(directory, "entry.js");
      await writeFile(entryPath, 'export { default } from "./deck.mdx";\n');
      await writeFile(join(directory, "deck.mdx"), "# Hello\n\n<Step at={2}>Reveal</Step>\n");

      const adapter = await createMutationAdapter(mutation);
      expect(adapter.ok).toBe(true);
      if (!adapter.ok) {
        return;
      }

      let failure: unknown;
      try {
        await buildCode(directory, entryPath, adapter.value as readonly Plugin[]);
      } catch (error) {
        failure = error;
      }
      expect(failureText(failure)).toContain("deck-manifest-rehype-drift");
    },
  );

  it.each<RecmaMutation>([
    "modify-step",
    "remove-step",
    "modify-slide",
    "remove-slide",
    "early-return",
    "reserved-binding",
    "move-content-hidden",
    "reassign-content",
    "provider-import-source",
  ])("rejects %s mutations made by an extension Recma plugin", async (mutation) => {
    const directory = await mkdtemp(join(tmpdir(), "drever-vite-recma-"));
    temporaryDirectories.push(directory);
    const entryPath = join(directory, "entry.js");
    await writeFile(entryPath, 'export { default } from "./deck.mdx";\n');
    await writeFile(join(directory, "deck.mdx"), "# Hello\n\n<Step at={2}>Reveal</Step>\n");

    const adapter = await createRecmaMutationAdapter(mutation);
    expect(adapter.ok).toBe(true);
    if (!adapter.ok) {
      return;
    }

    let failure: unknown;
    try {
      await buildCode(directory, entryPath, adapter.value as readonly Plugin[]);
    } catch (error) {
      failure = error;
    }
    expect(failureText(failure)).toContain("deck-manifest-recma-drift");
  });

  it("allows independent Recma metadata to reuse the removed default-export name", async () => {
    const directory = await mkdtemp(join(tmpdir(), "drever-vite-recma-metadata-"));
    temporaryDirectories.push(directory);
    const entryPath = join(directory, "entry.js");
    await writeFile(
      entryPath,
      'export { default as Deck, inspect, recmaMetadata } from "./deck.mdx";\n',
    );
    await writeFile(join(directory, "deck.mdx"), "# Hello\n\n<Step>Reveal</Step>\n");

    const adapter = await createRecmaMutationAdapter("safe-default-name-metadata");
    expect(adapter.ok).toBe(true);
    if (!adapter.ok) {
      return;
    }

    const code = await buildCode(directory, entryPath, adapter.value as readonly Plugin[]);
    expect(code).toContain("MDXContent: true");
    expect(code).toMatch(/function inspect\(MDXContent\)/u);
  });

  it.each(['import __DreverStep from "./evil.js"', 'export const __DreverSlide = "section"'])(
    "rejects an authored reserved internal binding: %s",
    async (statement) => {
      const directory = await mkdtemp(join(tmpdir(), "drever-vite-internal-binding-"));
      temporaryDirectories.push(directory);
      const entryPath = join(directory, "entry.js");
      await writeFile(entryPath, 'export { default } from "./deck.mdx";\n');
      await writeFile(join(directory, "evil.js"), "export default () => null;\n");
      await writeFile(join(directory, "deck.mdx"), `${statement}\n\n# Hello\n`);

      const adapter = await createDreverVitePlugins(createTestPlan());
      expect(adapter.ok).toBe(true);
      if (!adapter.ok) {
        return;
      }

      let failure: unknown;
      try {
        await buildCode(directory, entryPath, adapter.value as readonly Plugin[]);
      } catch (error) {
        failure = error;
      }
      expect(failureText(failure)).toContain("internal-component-binding");
    },
  );

  it("rejects an authored internal component reference in an MDX expression", async () => {
    const directory = await mkdtemp(join(tmpdir(), "drever-vite-internal-reference-"));
    temporaryDirectories.push(directory);
    const entryPath = join(directory, "entry.js");
    await writeFile(entryPath, 'export { default } from "./deck.mdx";\n');
    await writeFile(
      join(directory, "deck.mdx"),
      "# Hello\n\n<Step>Valid reveal</Step>\n\n{__DreverStep({at: 9})}\n",
    );

    const adapter = await createDreverVitePlugins(createTestPlan());
    expect(adapter.ok).toBe(true);
    if (!adapter.ok) {
      return;
    }

    let failure: unknown;
    try {
      await buildCode(directory, entryPath, adapter.value as readonly Plugin[]);
    } catch (error) {
      failure = error;
    }
    expect(failureText(failure)).toContain("internal-component-reference");
  });

  it("deep-freezes DeckManifest when author MDX shadows the Object binding", async () => {
    const directory = await mkdtemp(join(tmpdir(), "drever-vite-shadow-"));
    temporaryDirectories.push(directory);
    const entryPath = join(directory, "entry.js");
    await writeFile(
      entryPath,
      'export { Object as authorObject, deckManifest } from "./deck.mdx";\n',
    );
    await writeFile(
      join(directory, "deck.mdx"),
      'export const Object = { marker: "author", freeze: () => "shadowed" }\n\n# Hello\n\n<Step>Reveal</Step>\n\n<Note>Keep **eye contact**.</Note>\n',
    );

    const adapter = await createDreverVitePlugins(createTestPlan());
    expect(adapter.ok).toBe(true);
    if (!adapter.ok) {
      return;
    }
    const code = await buildCode(directory, entryPath, adapter.value as readonly Plugin[], false);
    const built = (await import(
      `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`
    )) as Readonly<Record<string, unknown>>;
    const manifest = built.deckManifest as Readonly<{
      slides: readonly Readonly<{
        speakerNotes: readonly Readonly<{ plainText: string; value: string }>[];
        stepStops: readonly number[];
      }>[];
    }>;

    expect(built.authorObject).toMatchObject({ marker: "author" });
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.slides)).toBe(true);
    expect(Object.isFrozen(manifest.slides[0])).toBe(true);
    expect(Object.isFrozen(manifest.slides[0]?.speakerNotes)).toBe(true);
    expect(Object.isFrozen(manifest.slides[0]?.speakerNotes[0])).toBe(true);
    expect(Object.isFrozen(manifest.slides[0]?.stepStops)).toBe(true);
    expect(manifest.slides[0]?.speakerNotes[0]).toMatchObject({
      plainText: "Keep eye contact.",
      value: "Keep **eye contact**.",
    });
  });
});
