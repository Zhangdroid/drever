import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { loadDreverConfig } from "./config.ts";
import { DreverCliError } from "./errors.ts";

const directories: string[] = [];

const project = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "drever-config-test-"));
  directories.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("loadDreverConfig", () => {
  it("uses an empty config when the project has no config file", async () => {
    const root = await project();

    await expect(loadDreverConfig({ command: "serve", root })).resolves.toEqual({ config: {} });
  });

  it("loads TypeScript through Vite and preserves only Drever's public settings", async () => {
    const root = await project();
    await writeFile(
      join(root, "drever.config.ts"),
      `const port: number = 4317;
export default {
  entry: "talk.mdx",
  canvas: { width: 1600, height: 900 },
  focusTools: {
    pen: { color: "var(--drever-theme-accent)", width: 7.5 },
    highlighter: { color: "#ffe66d", opacity: 0.28, width: 30 },
    laser: { color: "#ff4567" },
  },
  rehearsal: { targetDurationMinutes: 18.5 },
  stage: { background: "./Background.tsx", foreground: "./Chrome.tsx" },
  server: { port, strictPort: true },
  build: { outDir: "release", sourcemap: "hidden" },
};
`,
    );

    const loaded = await loadDreverConfig({ command: "build", root });

    expect(loaded.path).toBe(join(root, "drever.config.ts"));
    expect(loaded.config).toEqual({
      build: { outDir: "release", sourcemap: "hidden" },
      canvas: { height: 900, width: 1600 },
      entry: "talk.mdx",
      focusTools: {
        highlighter: { color: "#ffe66d", opacity: 0.28, width: 30 },
        laser: { color: "#ff4567" },
        pen: { color: "var(--drever-theme-accent)", width: 7.5 },
      },
      rehearsal: { targetDurationMinutes: 18.5 },
      server: { port: 4317, strictPort: true },
      stage: { background: "./Background.tsx", foreground: "./Chrome.tsx" },
    });
  });

  it("loads check config without a temporary bundle and uses production semantics", async () => {
    const root = await project();
    const modules = join(root, "node_modules");
    await mkdir(modules);
    await writeFile(
      join(root, "drever.config.ts"),
      `type Environment = { command: string; mode: string };
export default ({ command, mode }: Environment) => ({
  entry: command + "-" + mode + ".mdx",
});
`,
    );

    const loaded = await loadDreverConfig({ command: "check", root });

    expect(loaded.config).toEqual({ entry: "build-production.mdx" });
    expect(await readdir(modules)).toEqual([]);
  });

  it("rejects Vite options instead of accidentally exposing Vite as user config", async () => {
    const root = await project();
    await writeFile(
      join(root, "drever.config.ts"),
      'export default { resolve: { alias: { react: "something-else" } } };\n',
    );

    const failure = await loadDreverConfig({ command: "serve", root }).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(DreverCliError);
    expect(failure).toMatchObject({ code: "DREVER_CONFIG_INVALID", details: { path: "resolve" } });
  });

  it.each(["0", "-1", "Number.NaN", "Number.POSITIVE_INFINITY"])(
    "rejects a non-positive or non-finite rehearsal target: %s",
    async (targetDurationMinutes) => {
      const root = await project();
      await writeFile(
        join(root, "drever.config.ts"),
        `export default { rehearsal: { targetDurationMinutes: ${targetDurationMinutes} } };\n`,
      );

      const failure = await loadDreverConfig({ command: "serve", root }).catch(
        (error: unknown) => error,
      );

      expect(failure).toMatchObject({
        code: "DREVER_CONFIG_INVALID",
        details: { path: "rehearsal.targetDurationMinutes" },
        message: "rehearsal.targetDurationMinutes must be a finite number greater than zero.",
      });
    },
  );

  it("rejects unknown rehearsal options so misspelled targets do not silently disappear", async () => {
    const root = await project();
    await writeFile(
      join(root, "drever.config.ts"),
      "export default { rehearsal: { targetMinutes: 20 } };\n",
    );

    const failure = await loadDreverConfig({ command: "serve", root }).catch(
      (error: unknown) => error,
    );

    expect(failure).toMatchObject({
      code: "DREVER_CONFIG_INVALID",
      details: { path: "rehearsal.targetMinutes" },
    });
  });

  it.each([
    ["a non-object value", "false", "focusTools"],
    ["an unknown tool", "{ eraser: {} }", "focusTools.eraser"],
    ["a non-object pen", '{ pen: "#fff" }', "focusTools.pen"],
    ["an unknown pen option", "{ pen: { opacity: 0.5 } }", "focusTools.pen.opacity"],
    ["a blank pen color", '{ pen: { color: "   " } }', "focusTools.pen.color"],
    ["a zero pen width", "{ pen: { width: 0 } }", "focusTools.pen.width"],
    [
      "a non-finite highlighter width",
      "{ highlighter: { width: Number.POSITIVE_INFINITY } }",
      "focusTools.highlighter.width",
    ],
    [
      "an out-of-range highlighter opacity",
      "{ highlighter: { opacity: 1.1 } }",
      "focusTools.highlighter.opacity",
    ],
    ["an unknown laser option", "{ laser: { width: 4 } }", "focusTools.laser.width"],
    ["a blank laser color", '{ laser: { color: "" } }', "focusTools.laser.color"],
  ])("rejects focusTools with %s", async (_label, focusTools, path) => {
    const root = await project();
    await writeFile(
      join(root, "drever.config.ts"),
      `export default { focusTools: ${focusTools} };\n`,
    );

    const failure = await loadDreverConfig({ command: "serve", root }).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(DreverCliError);
    expect(failure).toMatchObject({ code: "DREVER_CONFIG_INVALID", details: { path } });
  });

  it.each([
    ["empty stage", "{}", "stage"],
    ["empty module path", '{ background: "" }', "stage.background"],
    ["unknown layer", '{ overlay: "./Overlay.tsx" }', "stage.overlay"],
  ])("rejects an invalid %s", async (_label, stage, path) => {
    const root = await project();
    await writeFile(join(root, "drever.config.ts"), `export default { stage: ${stage} };\n`);

    const failure = await loadDreverConfig({ command: "serve", root }).catch(
      (error: unknown) => error,
    );

    expect(failure).toMatchObject({
      code: "DREVER_CONFIG_INVALID",
      details: { path },
    });
  });
});
