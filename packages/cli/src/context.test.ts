import { definePlugin, parseDeck } from "@drever/compiler";
import basicTheme from "@drever/designs/basic";
import {
  DECK_MANIFEST_VERSION,
  DREVER_AUTHORING_CONTEXT_VERSION,
  type DeckManifest,
} from "@drever/schema";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  createAuthoringContext,
  formatAuthoringContextHuman,
  mergeAuthoringDeck,
  writeAuthoringContext,
} from "./context.ts";
import { DreverCliError } from "./errors.ts";
import { resolveDreverPlan, type ResolvedDreverPlan } from "./project.ts";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

const temporaryRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "drever-context-test-"));
  directories.push(root);
  return root;
};

const projectFor = (entry: string): ResolvedDreverPlan => ({ entry }) as ResolvedDreverPlan;

const expectDeeplyFrozen = (value: unknown): void => {
  if (typeof value !== "object" || value === null) {
    return;
  }
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) {
    expectDeeplyFrozen(child);
  }
};

describe("authoring context", () => {
  it("emits the canonical sparse-Step manifest with exact source and curated design data", async () => {
    const root = await temporaryRoot();
    const entry = join(root, "slides.mdx");
    const source = `export const deckName = "Context contract"

# Opening

<Step at={5}>Fifth reveal</Step>

<Step at={2}>Second reveal</Step>

<Note>Say **hello**.</Note>

---

# Finish
`;
    await writeFile(entry, source);
    const fixtureModule = join(root, "fixture-plugin.mjs");
    await writeFile(
      fixtureModule,
      `const visit = (value) => {
  if (Array.isArray(value)) {
    value.forEach(visit);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  if (value.type === "text" && value.value === "Opening") value.value = "Plugin opening";
  Object.values(value).forEach(visit);
};
export default {
  kind: "drever-build-plugin",
  apiVersion: 1,
  capability: "remark",
  create() { return function fixtureRemark() { return (tree) => visit(tree); }; },
};
`,
    );
    const fixtureBaseURL = pathToFileURL(fixtureModule).href;
    const fixturePlugin = definePlugin({
      kind: "plugin",
      apiVersion: 1,
      id: "fixture:authoring",
      baseURL: fixtureBaseURL,
      build: {
        remark: [{ specifier: "./fixture-plugin.mjs" }],
        rehype: [{ specifier: "./missing-rehype.mjs" }],
        recma: [{ specifier: "./missing-recma.mjs" }],
        vite: [{ specifier: "./missing-vite.mjs" }],
      },
      runtime: {
        components: [
          {
            name: "AgentChart",
            module: { specifier: "./fixture-component.mjs" },
            manifest: {
              description: "Shows one reviewable data comparison.",
              example: '<AgentChart title="Adoption" />',
            },
          },
        ],
      },
      manifest: { title: "Fixture authoring", summary: "Exercises authoring metadata." },
    });
    const project = await resolveDreverPlan({
      config: {
        canvas: { height: 810, width: 1_440 },
        plugins: [fixturePlugin],
        theme: {
          ...basicTheme,
          id: "fixture:theme",
          baseURL: fixtureBaseURL,
          elements: { p: { specifier: "./fixture-component.mjs" } },
        },
      },
      root,
    });
    let output = "";

    const context = await writeAuthoringContext({
      project,
      json: true,
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
    });

    expect(context).toMatchObject({
      version: DREVER_AUTHORING_CONTEXT_VERSION,
      sourcePath: entry,
      canvas: { height: 810, width: 1_440 },
      deck: {
        version: DECK_MANIFEST_VERSION,
        slides: [
          {
            id: "slide-1",
            index: 0,
            title: "Plugin opening",
            stepStops: [2, 5],
            speakerNotes: [
              {
                format: "markdown",
                plainText: "Say hello.",
                value: "Say **hello**.",
              },
            ],
          },
          { id: "slide-2", index: 1, title: "Finish", stepStops: [] },
        ],
      },
      design: {
        theme: {
          id: "fixture:theme",
          manifest: { title: "Drever Basic" },
        },
        layouts: [{ name: "Cover" }, { name: "TwoColumn" }],
        components: [
          {
            name: "AgentChart",
            manifest: {
              description: "Shows one reviewable data comparison.",
              example: '<AgentChart title="Adoption" />',
            },
          },
        ],
        elements: ["p"],
      },
      plugins: [
        { id: "@drever/plugin-gfm", origin: "default" },
        { id: "@drever/plugin-shiki", origin: "default" },
        { id: "@drever/plugin-tailwindcss", origin: "default" },
        { id: "fixture:authoring", origin: "user" },
      ],
      preflight: {
        sourcePath: entry,
        slideCount: 2,
        summary: { errors: 0, warnings: 0, info: 0 },
      },
    });
    expect(context.deck.slides[0]?.source).toEqual([
      expect.objectContaining({
        value: expect.stringContaining("# Opening"),
        range: expect.objectContaining({
          path: entry,
          start: expect.objectContaining({ offset: source.indexOf("# Opening") }),
        }),
      }),
    ]);
    expect(context.deck.slides[0]?.source[0]?.value).not.toContain("export const deckName");
    expect(context.design.layouts[0]).not.toHaveProperty("module");
    expect(context.design.layouts[0]).not.toHaveProperty("owner");
    expect(context.design.theme).not.toHaveProperty("canvas");
    expect(context.plugins[0]).not.toHaveProperty("build");
    expect(JSON.parse(output)).toEqual(context);
    expect(output).toBe(`${JSON.stringify(context, null, 2)}\n`);
    expectDeeplyFrozen(context);
  });

  it("offers a concise human summary while returning the complete context", () => {
    const context = {
      sourcePath: "/talk/slides.mdx",
      deck: { slides: [{}, {}, {}] },
      design: { theme: { id: "studio" } },
      plugins: [{}, {}],
    } as unknown as Parameters<typeof formatAuthoringContextHuman>[0];

    expect(formatAuthoringContextHuman(context)).toBe(
      "Authoring context for /talk/slides.mdx: 3 slides, studio theme, 2 plugins. Use --json for the complete agent-readable contract.\n",
    );
  });

  it("reports read and MDX parse failures before loading compile extensions", async () => {
    const root = await temporaryRoot();
    const missing = join(root, "missing.mdx");
    await expect(createAuthoringContext(projectFor(missing))).rejects.toMatchObject({
      name: "DreverCliError",
      code: "DREVER_AUTHORING_CONTEXT_READ_FAILED",
      details: { path: missing },
    });

    const broken = join(root, "broken.mdx");
    await writeFile(broken, "# Broken\n\n<Component");
    await expect(createAuthoringContext(projectFor(broken))).rejects.toMatchObject({
      name: "DreverCliError",
      code: "DREVER_AUTHORING_CONTEXT_PARSE_FAILED",
      details: {
        path: broken,
        diagnostics: [expect.objectContaining({ code: "DREVER_MDX_PARSE", severity: "error" })],
      },
    });
  });

  it("rejects a compiled manifest whose protected slide identity differs from source", () => {
    const parsed = parseDeck("# One\n\n---\n\n# Two", { path: "slides.mdx" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("Expected fixture source to parse.");
    }
    const manifest: DeckManifest = {
      version: DECK_MANIFEST_VERSION,
      slides: [
        { id: "slide-1", index: 0, speakerNotes: [], stepStops: [] },
        { id: "replaced-slide", index: 1, speakerNotes: [], stepStops: [] },
      ],
    };

    expect(() => mergeAuthoringDeck(manifest, parsed.value)).toThrowError(
      expect.objectContaining<Partial<DreverCliError>>({
        code: "DREVER_AUTHORING_CONTEXT_MANIFEST_MISMATCH",
        details: expect.objectContaining({ reason: "slide-identity:1" }) as never,
      }),
    );
  });
});
