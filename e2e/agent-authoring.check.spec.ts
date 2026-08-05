import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const execute = promisify(execFile);
const workspaceRoot = join(import.meta.dirname, "..");
const projectRoot = join(workspaceRoot, "examples", "basic");
const cli = join(workspaceRoot, "packages", "cli", "dist", "bin.mjs");
const environment = { ...process.env };
delete environment.FORCE_COLOR;

const agentFiles = [
  "AGENTS.md",
  ".agents/skills/drever-author-deck/SKILL.md",
  ".agents/skills/drever-author-deck/agents/openai.yaml",
  ".agents/skills/drever-create-deck/SKILL.md",
  ".agents/skills/drever-create-deck/agents/openai.yaml",
  ".agents/skills/drever-create-design/SKILL.md",
  ".agents/skills/drever-create-design/agents/openai.yaml",
  ".agents/skills/drever-review-deck/SKILL.md",
  ".agents/skills/drever-review-deck/agents/openai.yaml",
  ".agents/skills/drever-deliver-deck/SKILL.md",
  ".agents/skills/drever-deliver-deck/agents/openai.yaml",
] as const;

type AuthoringContext = Readonly<{
  version: number;
  sourcePath: string;
  canvas: Readonly<{ height: number; width: number }>;
  deck: Readonly<{
    version: number;
    slides: readonly Readonly<{
      id: string;
      index: number;
      title?: string;
      stepStops: readonly number[];
      speakerNotes: readonly unknown[];
      source: readonly Readonly<{
        value: string;
        range: Readonly<{
          path: string;
          start: Readonly<{ offset: number }>;
          end: Readonly<{ offset: number }>;
        }>;
      }>[];
    }>[];
  }>;
  design: Readonly<{
    theme: Readonly<{
      id: string;
      version?: string;
      manifest: Readonly<{ title: string }>;
      motion?: Readonly<{
        guidance?: readonly string[];
        id: string;
        intents: readonly string[];
      }>;
    }>;
    layouts: readonly Readonly<{ name: string }>[];
  }>;
  plugins: readonly Readonly<{ id: string; origin: string; version?: string }>[];
  preflight: Readonly<{
    version: number;
    sourcePath: string;
    slideCount: number;
    summary: Readonly<{ errors: number; info: number; warnings: number }>;
    diagnostics: readonly unknown[];
  }>;
}>;

const runCli = (cwd: string, ...arguments_: string[]) =>
  execute(process.execPath, [cli, ...arguments_], {
    cwd,
    env: environment,
    timeout: 30_000,
  });

const readAgentFiles = async (root: string): Promise<readonly string[]> =>
  Promise.all(agentFiles.map((path) => readFile(join(root, path), "utf8")));

test("the built CLI installs an idempotent agent kit without loading project config", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "drever-agent-sync-e2e-")));
  const userInstructions = "# Project instructions\n\nKeep this user-owned guidance.\n";

  try {
    await Promise.all([
      writeFile(join(root, "AGENTS.md"), userInstructions),
      writeFile(join(root, "drever.config.ts"), "export default {"),
    ]);

    const first = await runCli(root, "agent", "sync");
    expect(first.stdout).toBe("Synced Drever agent kit: 10 created, 1 updated, 0 unchanged.\n");

    const firstContents = await readAgentFiles(root);
    const agents = firstContents[0];
    if (agents === undefined) {
      throw new Error("Agent sync did not create AGENTS.md.");
    }
    expect(agents.startsWith(userInstructions)).toBe(true);
    expect(agents.match(/<!-- drever-agent-kit:start -->/gu)).toHaveLength(1);
    expect(agents.match(/<!-- drever-agent-kit:end -->/gu)).toHaveLength(1);
    expect(agents).toContain("npm exec -- drever");
    expect(agents).toContain("pnpm exec drever");
    expect(agents).toContain("yarn exec drever");
    expect(agents).toContain("bunx --no-install drever");
    expect(agents).toContain("never assume a bare global `drever` executable is on `PATH`");

    const createDeck = firstContents[3];
    if (createDeck === undefined) {
      throw new Error("Agent sync did not create the deck creation skill.");
    }
    expect(createDeck).toContain("<!-- drever-authoring-scope-contract:v3 -->");
    expect(createDeck).toContain("<!-- drever-briefing-contract:v4 -->");
    expect(createDeck).toContain("Skip remaining questions — surprise me");
    expect(createDeck.match(/Skip remaining questions — surprise me/gu)).toHaveLength(1);
    expect(createDeck).toMatch(/one to\s+three decisions per round/u);
    expect(createDeck).toContain("two to four topic-specific choices");
    expect(createDeck).toContain("1A, 2C");
    expect(createDeck).toMatch(/later\s+question should depend on an earlier answer/iu);
    expect(createDeck).toMatch(/proposal[^.]*technical update[^.]*data story/isu);
    expect(createDeck).not.toContain("choose the subject too");
    expect(createDeck).toContain("Never repeat supplied information");
    expect(createDeck).toMatch(/audience, desired change, duration, and visible slide density/iu);
    expect(createDeck).toContain("<!-- drever-plan-review-contract:v3 -->");
    expect(createDeck).toContain("`drever.plan.json`");
    expect(createDeck).toContain("stable lowercase hyphenated id");
    expect(createDeck).toContain("composition recipe");
    expect(createDeck).toMatch(/motion[^.]*single owner/iu);
    expect(createDeck).toContain("invite edits or explicit approval, and stop");
    expect(createDeck).toMatch(/exact \*\*Storyboard\*\* URL reported by\s+Drever/iu);
    expect(createDeck).toMatch(/After explicit\s+approval[^.]*mark\s+both files approved/iu);
    expect(createDeck).toContain("<!-- drever-preview-contract:v5 -->");
    expect(createDeck).toMatch(/coherent Draft 1 with every\s+planned\s+slide/u);
    expect(createDeck).toMatch(/first and last slides open/iu);
    expect(createDeck).toContain("continue in the same turn");
    expect(createDeck).toMatch(/one\s+production build[^.]*requested PDF export/iu);
    expect(createDeck).toMatch(/do not inspect the Drever\s+repository/iu);
    expect(createDeck).toContain("`node_modules`");
    expect(createDeck).toMatch(/official design\s+implementations/iu);
    expect(createDeck).toMatch(/the named public declaration or\s+guide/iu);

    const createDesign = firstContents[5];
    if (createDesign === undefined) {
      throw new Error("Agent sync did not create the deck design skill.");
    }
    expect(createDesign).toMatch(
      /must not delay[^.]*coherent end-to-end content\s+Draft 1[^.]*stable development URL/iu,
    );
    expect(createDesign).toMatch(
      /Do not make a production build\s+the prerequisite for the first useful preview/iu,
    );
    expect(createDesign).toMatch(/Do not scan the official studies/iu);
    expect(createDesign).toMatch(/do not run context[^.]*in-progress deck/iu);
    expect(createDesign).not.toMatch(/Scan all eight studies/iu);
    expect(createDesign).not.toMatch(/packages\/designs\/src\/<study>/u);
    expect(createDesign).toMatch(/Use this minimal public Theme shape/iu);
    expect(createDesign).toMatch(/background layer is `aria-hidden` and `inert`/iu);
    expect(createDesign).toMatch(/approved `drever\.plan\.json`/iu);

    const authorDeck = firstContents[1];
    const reviewDeck = firstContents[7];
    expect(authorDeck).toMatch(/preserve its ordered planning labels, narrative jobs/iu);
    expect(authorDeck).toContain("`Step` as a real DOM wrapper");
    expect(authorDeck).toContain('[data-drever-slide][data-slide-state="active"]');
    expect(authorDeck).toContain("exactly one motion owner");
    expect(reviewDeck).toMatch(/text overlap, direct scroll overflow/iu);
    expect(reviewDeck).toMatch(/compare every planned narrative job/iu);
    expect(reviewDeck).toMatch(/resolved solid-color contrast failures/iu);
    expect(agents).toContain("brief.md` plus `drever.plan.json` approval gate");
    expect(agents).toMatch(/expose the coherent[^.]*Draft 1 before design refinement/iu);
    expect(agents).toContain(
      "do not run production builds or duplicate the full rendered preflight",
    );
    expect(agents).toMatch(/Do not load every skill before Draft 1/iu);

    for (const [index, contents] of firstContents.entries()) {
      if (agentFiles[index]?.endsWith("SKILL.md")) {
        expect(contents).toContain("<!-- Generated by `drever agent sync`. -->");
        expect(contents).toContain("pnpm exec drever");
        expect(contents).toContain("yarn exec drever");
        expect(contents).toContain("bunx --no-install drever");
        expect(contents.replace("<!-- Generated by `drever agent sync`. -->", "")).not.toMatch(
          /(?<!npm exec -- )(?<!pnpm exec )(?<!yarn exec )(?<!bunx --no-install )\bdrever (?:agent|build|check|context|current|dev|doctor|export|mcp)\b/mu,
        );
      }
      if (agentFiles[index]?.endsWith("openai.yaml")) {
        expect(contents).toContain("# Generated by `drever agent sync`.");
      }
    }

    const second = await runCli(root, "agent", "sync");
    expect(second.stdout).toBe("Synced Drever agent kit: 0 created, 0 updated, 11 unchanged.\n");
    expect(await readAgentFiles(root)).toEqual(firstContents);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("the built CLI exposes the canonical basic-deck authoring context", async () => {
  const sourcePath = join(projectRoot, "slides.mdx");
  const source = await readFile(sourcePath, "utf8");
  const { stdout } = await runCli(projectRoot, "context", "--json");
  const context = JSON.parse(stdout) as AuthoringContext;

  expect(context.version).toBe(2);
  expect(context.sourcePath).toBe(sourcePath);
  expect(context.canvas).toEqual({ width: 1_600, height: 900 });
  expect(context.deck.version).toBe(2);
  expect(
    context.deck.slides.map(({ id, index, speakerNotes, stepStops, title }) => ({
      id,
      index,
      speakerNoteCount: speakerNotes.length,
      stepStops,
      title,
    })),
  ).toEqual([
    {
      id: "slide-1",
      index: 0,
      speakerNoteCount: 0,
      stepStops: [],
      title: "Slides can stay useful.",
    },
    {
      id: "slide-2",
      index: 1,
      speakerNoteCount: 1,
      stepStops: [2, 5],
      title: "Motion should carry meaning.",
    },
    {
      id: "slide-3",
      index: 2,
      speakerNoteCount: 0,
      stepStops: [],
      title: "Static output and living interface",
    },
    {
      id: "slide-4",
      index: 3,
      speakerNoteCount: 1,
      stepStops: [],
      title: "Interfaces remember.",
    },
    {
      id: "slide-5",
      index: 4,
      speakerNoteCount: 0,
      stepStops: [],
      title: "Ship the story.",
    },
  ]);

  const authoredBody = source.slice(source.indexOf("<Cover"));
  const expectedSlideSources = authoredBody.split("\n\n---\n\n").map((value) => value.trim());
  expect(
    context.deck.slides.map(({ source: fragments }) => fragments.map(({ value }) => value)),
  ).toEqual(expectedSlideSources.map((value) => [value]));
  for (const slide of context.deck.slides) {
    for (const fragment of slide.source) {
      expect(fragment.range.path).toBe(sourcePath);
      expect(source.slice(fragment.range.start.offset, fragment.range.end.offset)).toBe(
        fragment.value,
      );
    }
  }

  expect(context.design.theme).toMatchObject({
    id: "@drever/designs/basic",
    version: "0.0.0",
    manifest: { title: "Drever Basic" },
    motion: {
      id: "basic",
      intents: ["focus", "replace", "compare", "stagger", "continuity"],
      guidance: expect.arrayContaining([
        "Reuse a continuity name only when the same visual object persists across adjacent slides, then end the sequence as soon as it stops carrying the argument.",
      ]),
    },
  });
  expect(context.design.layouts.map(({ name }) => name)).toEqual(["Cover", "TwoColumn"]);
  expect(context.plugins.map(({ id, origin, version }) => ({ id, origin, version }))).toEqual([
    { id: "@drever/plugin-gfm", origin: "default", version: "0.0.0" },
    { id: "@drever/plugin-shiki", origin: "default", version: "0.0.0" },
    { id: "@drever/plugin-tailwindcss", origin: "default", version: "0.0.0" },
  ]);
  expect(context.preflight).toEqual({
    version: 2,
    sourcePath,
    slideCount: 5,
    summary: { errors: 0, warnings: 0, info: 0 },
    diagnostics: [],
  });
});

test("the built stdio MCP serves fresh source through protocol-only stdout", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "drever-mcp-e2e-")));
  const slides = join(root, "slides.mdx");
  await writeFile(slides, "# Opening\n\n---\n\n## Before\n");
  const child = spawn(process.execPath, [cli, "mcp"], {
    cwd: root,
    env: environment,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines = createInterface({ input: child.stdout, crlfDelay: Number.POSITIVE_INFINITY });
  const responses = lines[Symbol.asyncIterator]();
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));

  const send = (message: object): void => {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  };
  const requestMcp = async (message: object): Promise<Record<string, unknown>> => {
    send(message);
    const response = await responses.next();
    if (response.done) {
      throw new Error(`Drever MCP exited before responding.\n${stderr}`);
    }
    return JSON.parse(response.value) as Record<string, unknown>;
  };
  const callTool = (id: number, name: string, arguments_: object = {}) =>
    requestMcp({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: arguments_ },
    });

  try {
    await expect(
      requestMcp({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "drever-e2e", version: "1.0.0" },
        },
      }),
    ).resolves.toMatchObject({
      id: 1,
      result: { protocolVersion: "2025-11-25", capabilities: { tools: {} } },
    });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });

    await expect(callTool(2, "drever_get_slide", { number: 2 })).resolves.toMatchObject({
      id: 2,
      result: {
        structuredContent: { number: 2, title: "Before", source: "## Before" },
      },
    });

    await writeFile(slides, "# Opening\n\n---\n\n## After\n\n<Step at={3}>Fresh.</Step>\n");
    await expect(callTool(3, "drever_get_slide", { number: 2 })).resolves.toMatchObject({
      id: 3,
      result: {
        structuredContent: {
          number: 2,
          title: "After",
          stepStops: [3],
          source: "## After\n\n<Step at={3}>Fresh.</Step>",
        },
      },
    });
    await expect(callTool(4, "drever_check")).resolves.toMatchObject({
      id: 4,
      result: { structuredContent: { valid: true, slideCount: 2 } },
    });
    await expect(callTool(5, "drever_get_current")).resolves.toMatchObject({
      id: 5,
      result: { structuredContent: { available: false, sourcePath: slides } },
    });
  } finally {
    child.stdin.end();
    await expect.poll(() => child.exitCode, { message: stderr }).toBe(0);
    lines.close();
    await rm(root, { force: true, recursive: true });
  }
});
