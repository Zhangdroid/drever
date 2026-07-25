import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { promisify } from "node:util";
import {
  assertReleaseSmokeContext,
  collectReleaseSmokeSource,
  createCodexExecArguments,
  mergeReleaseSmokeManifest,
  parseCodexJsonl,
  relativeMountedPathname,
  releaseSmokeDeckMount,
  sanitizeTranscriptText,
} from "./contract.mjs";
import { getReleaseSmokeScenario, releaseSmokeScenarios } from "./scenarios.mjs";

const temporaryRoots = [];
const execute = promisify(execFile);
const write = async (root, path, content) => {
  const destination = join(root, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content, "utf8");
};

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

test("defines one real surprise journey and one fully guided journey", () => {
  assert.deepEqual(
    releaseSmokeScenarios.map(({ id, mode }) => ({ id, mode })),
    [
      { id: "surprise-me", mode: "surprise-me" },
      { id: "guided", mode: "guided" },
    ],
  );
  for (const scenario of releaseSmokeScenarios) {
    assert.ok(scenario.turns.length >= 3);
    assert.match(scenario.turns[0], /^Fetch and follow https:\/\/drever\.dev\/prompt\.md\./u);
    assert.match(scenario.turns.at(-1), /create the presentation now/iu);
  }
  assert.match(getReleaseSmokeScenario("surprise-me").turns.at(-1), /surprise me/iu);
  assert.throws(() => getReleaseSmokeScenario("unknown"), /Unknown release smoke scenario/u);
});

test("publishes only assistant messages from Codex JSONL and retains the thread id", () => {
  const result = parseCodexJsonl(
    [
      JSON.stringify({ type: "thread.started", thread_id: "thread-1" }),
      JSON.stringify({
        type: "item.completed",
        item: { type: "command_execution", command: "pwd" },
      }),
      JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: "First draft." },
      }),
      JSON.stringify({
        type: "item.completed",
        item: { type: "agent_message", text: "What is the audience?" },
      }),
      JSON.stringify({ type: "turn.completed", usage: { input_tokens: 42, output_tokens: 9 } }),
    ].join("\n"),
  );

  assert.deepEqual(result, {
    message: "What is the audience?",
    threadId: "thread-1",
    usage: { input_tokens: 42, output_tokens: 9 },
  });
  assert.throws(
    () => parseCodexJsonl(`${JSON.stringify({ type: "turn.completed" })}\n`),
    /thread id/u,
  );
});

test("keeps permission flags before resume and leaves model selection optional", () => {
  const initial = createCodexExecArguments({ turn: "Start" });
  const resumed = createCodexExecArguments({
    model: "model-test",
    threadId: "thread-1",
    turn: "Continue",
  });

  assert.deepEqual(initial.slice(0, 6), [
    "exec",
    "--json",
    "--skip-git-repo-check",
    "--dangerously-bypass-hook-trust",
    "--enable",
    "hooks",
  ]);
  assert.ok(initial.includes('default_permissions=":workspace"'));
  assert.equal(initial.includes("-m"), false);
  assert.ok(resumed.indexOf("--json") < resumed.indexOf("resume"));
  assert.deepEqual(resumed.slice(-3), ["resume", "thread-1", "Continue"]);
  assert.deepEqual(resumed.slice(resumed.indexOf("-m"), resumed.indexOf("-m") + 2), [
    "-m",
    "model-test",
  ]);
});

test("denies every shell tool call in the secret-bearing generation stage", async () => {
  const guard = new URL("./deny-shell.mjs", import.meta.url);
  const { stdout } = await execute(process.execPath, [guard.pathname]);
  const decision = JSON.parse(stdout);

  assert.deepEqual(decision, {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        "Shell execution is disabled while the OpenAI credential proxy is active. Author files with apply_patch; validation runs in the next job without the secret.",
    },
  });
});

test("redacts credential-shaped values, ANSI output, and the private workspace path", () => {
  const value = sanitizeTranscriptText(
    "\u001B[31mBuilt /tmp/private/deck with sk-exampleabcdefghijklmnop and npm_abcdefghijklmnop.\u001B[0m",
    "/tmp/private/deck",
  );
  assert.equal(value, "Built <project> with [redacted] and [redacted].");
});

test("maps the final website deck mount without accepting sibling paths", () => {
  const mount = releaseSmokeDeckMount("123", "guided");
  assert.equal(mount, "/release-smoke/runs/123/guided/deck");
  assert.equal(relativeMountedPathname(`${mount}/`, mount), "/");
  assert.equal(relativeMountedPathname(`${mount}/assets/deck.js`, mount), "/assets/deck.js");
  assert.equal(relativeMountedPathname(`${mount}/document/`, `${mount}/`), "/document/");
  assert.equal(relativeMountedPathname(`${mount}-copy/assets/deck.js`, mount), undefined);
  assert.equal(relativeMountedPathname("/", mount), undefined);
  assert.throws(() => releaseSmokeDeckMount("not-a-run", "guided"), /Invalid release smoke run/u);
  assert.throws(() => releaseSmokeDeckMount("123", "../guided"), /scenario id/u);
});

test("copies only bounded authoring source and rejects remote assets", async () => {
  const root = await mkdtemp(join(tmpdir(), "drever-release-smoke-source-"));
  temporaryRoots.push(root);
  const project = join(root, "project");
  const output = join(root, "artifact", "source");
  await Promise.all([
    write(project, "slides.mdx", "# A useful deck\n"),
    write(project, "brief.md", "# Brief\n"),
    write(project, "Scene.tsx", "export const Scene = () => <svg />;\n"),
    write(project, "styles/theme.css", ".scene { color: rebeccapurple; }\n"),
    write(project, "public/grid.svg", '<svg xmlns="http://www.w3.org/2000/svg" />\n'),
    write(project, "package.json", '{"scripts":{"steal":"no"}}\n'),
    write(project, "node_modules/ignored.js", "ignored\n"),
  ]);

  const receipt = await collectReleaseSmokeSource(project, output);

  assert.deepEqual(receipt.files, [
    "Scene.tsx",
    "brief.md",
    "public/grid.svg",
    "slides.mdx",
    "styles/theme.css",
  ]);
  await assert.rejects(readFile(join(output, "package.json"), "utf8"), { code: "ENOENT" });

  await write(
    project,
    "styles/remote.css",
    ".hero { background: url(https://example.test/a.png); }",
  );
  await assert.rejects(
    collectReleaseSmokeSource(project, output),
    /references a remote asset: styles\/remote\.css/u,
  );

  await rm(join(project, "styles", "remote.css"));
  await write(project, "styles/secret.css", "/* npm_abcdefghijklmnop */\n");
  await assert.rejects(
    collectReleaseSmokeSource(project, output),
    /contains a credential-shaped value: styles\/secret\.css/u,
  );
});

test("rejects symlinks that try to cross the source allowlist boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "drever-release-smoke-symlink-"));
  temporaryRoots.push(root);
  const project = join(root, "project");
  await write(project, "slides.mdx", "# Deck\n");
  await write(root, "outside.css", ".outside {}\n");
  await mkdir(join(project, "styles"), { recursive: true });
  await symlink(join(root, "outside.css"), join(project, "styles", "outside.css"));

  await assert.rejects(
    collectReleaseSmokeSource(project, join(root, "artifact")),
    /cannot contain a symlink/u,
  );
});

test("enforces the six-slide contract from Drever authoring context", () => {
  const context = (slideCount) => ({
    version: 1,
    deck: {
      slides: Array.from({ length: slideCount }, (_, index) => ({
        index,
        speakerNotes: index === 0 ? [{ plainText: "Guide the room." }] : [],
      })),
    },
  });
  assert.deepEqual(assertReleaseSmokeContext(context(6)), {
    slideCount: 6,
    speakerNoteCount: 1,
  });
  assert.throws(() => assertReleaseSmokeContext(context(0)), /expected 1-6/u);
  assert.throws(() => assertReleaseSmokeContext(context(7)), /expected 1-6/u);
});

test("moves a repeated run to the front without growing history forever", () => {
  const manifest = {
    schemaVersion: 1,
    latestRunId: "2",
    runs: [
      { id: "2", transcript: "2.json" },
      { id: "1", transcript: "1.json" },
    ],
  };
  assert.deepEqual(mergeReleaseSmokeManifest(manifest, { id: "1", transcript: "1.json" }, 2), {
    schemaVersion: 1,
    latestRunId: "1",
    runs: [
      { id: "1", transcript: "1.json" },
      { id: "2", transcript: "2.json" },
    ],
  });
});

test("keeps the OpenAI key inside the generation job and pins the Codex action", async () => {
  const workflow = await readFile(
    new URL("../../.github/workflows/release-smoke.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /openai\/codex-action@52fe01ec70a42f454c9d2ebd47598f9fd6893d56/u);
  assert.match(workflow, /allow-bots: true/u);
  assert.match(workflow, /permission-profile: ":workspace"/u);
  assert.equal(workflow.match(/secrets\.OPENAI_API_KEY/gu)?.length, 1);
  assert.equal(workflow.match(/overwrite: true/gu)?.length, 2);
  assert.doesNotMatch(workflow, /run_attempt/u);
  assert.match(
    workflow,
    /name: release-smoke-generated-\$\{\{ matrix\.case \}\}-\$\{\{ github\.run_id \}\}/u,
  );
  assert.match(
    workflow,
    /name: release-smoke-built-\$\{\{ matrix\.case \}\}-\$\{\{ github\.run_id \}\}/u,
  );
  const buildJob = workflow.slice(workflow.indexOf("\n  build:"));
  assert.doesNotMatch(buildJob, /OPENAI_API_KEY/u);
  assert.doesNotMatch(workflow, /screenshot|export pdf/iu);
});

test("browser smoke uses the final deep deck mount for every live surface", async () => {
  const source = await readFile(new URL("./build-case.mjs", import.meta.url), "utf8");
  assert.match(source, /releaseSmokeDeckMount\(runId, scenarioId\)/u);
  assert.match(source, /runBrowserSmoke\(website\.path, slideCount, deckMount\)/u);
  assert.match(source, /const documentPath = `\$\{mountPath\}\/document\/`/u);
  assert.match(source, /const speakerPath = `\$\{mountPath\}\/speaker\/`/u);
  assert.match(source, /window\.location\.pathname\.startsWith\(`\$\{mount\}\/`\)/u);
});

test("publisher assembles route data and directly previewable deck directories", async () => {
  const root = await mkdtemp(join(tmpdir(), "drever-release-smoke-publisher-"));
  temporaryRoots.push(root);
  const results = join(root, "results");
  const repository = join(root, "repository");
  const body = join(root, "pr.md");
  const sourceCommit = "a".repeat(40);
  const baseCase = {
    schemaVersion: 1,
    status: "passed",
    durationSeconds: 12,
    checks: ["Drever check passed"],
    messages: [
      { role: "user", content: "Create a deck." },
      { role: "assistant", content: "Created it." },
    ],
    generatedAt: "2026-07-25T19:00:00.000Z",
    runner: {
      codexVersion: "codex-cli test",
      model: "Codex default",
      nodeVersion: "v24.18.0",
    },
    sourceCommit,
    version: "0.1.1",
  };
  for (const scenario of releaseSmokeScenarios) {
    const caseRoot = join(results, scenario.id);
    await Promise.all([
      write(caseRoot, "deck/index.html", `<h1>${scenario.label}</h1>\n`),
      write(caseRoot, "source/slides.mdx", `# ${scenario.label}\n`),
      write(
        caseRoot,
        "case.json",
        JSON.stringify({
          ...baseCase,
          id: scenario.id,
          mode: scenario.mode,
          title: scenario.label,
          brief: scenario.brief,
          deck: {
            audience: `/release-smoke/runs/123/${scenario.id}/deck/`,
            document: `/release-smoke/runs/123/${scenario.id}/deck/document/`,
            source: `/release-smoke/runs/123/${scenario.id}/source/slides.mdx`,
          },
        }),
      ),
    ]);
  }
  await write(
    repository,
    "website/content/release-smoke/manifest.json",
    JSON.stringify({
      schemaVersion: 1,
      latestRunId: "preview-fixture",
      runs: [{ id: "preview-fixture", transcript: "preview-fixture.json" }],
    }),
  );

  const script = new URL("./publish-results.mjs", import.meta.url);
  await execute(process.execPath, [
    script.pathname,
    "0.1.1",
    "123",
    sourceCommit,
    "Zhangdroid/drever",
    results,
    repository,
    body,
  ]);

  const [manifest, run, publicManifest, deck, prBody] = await Promise.all([
    readFile(join(repository, "website/content/release-smoke/manifest.json"), "utf8").then(
      JSON.parse,
    ),
    readFile(join(repository, "website/content/release-smoke/runs/123.json"), "utf8").then(
      JSON.parse,
    ),
    readFile(join(repository, "website/public/release-smoke/manifest.json"), "utf8").then(
      JSON.parse,
    ),
    readFile(
      join(repository, "website/public/release-smoke/runs/123/guided/deck/index.html"),
      "utf8",
    ),
    readFile(body, "utf8"),
  ]);
  assert.equal(manifest.latestRunId, "123");
  assert.equal(run.cases.length, 2);
  assert.equal(publicManifest.runs[0].transcript, "/release-smoke/runs/123/run.json");
  assert.match(deck, /Guided answers/u);
  assert.match(prBody, /surprise-me\/deck\//u);
  assert.match(prBody, /guided\/deck\//u);
  assert.equal(prBody.includes(String.fromCodePoint(0x1b)), false);
});
