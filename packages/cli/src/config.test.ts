import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
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

  it("requires an authored language before producing a publishable artifact", async () => {
    const root = await project();

    await expect(loadDreverConfig({ command: "build", root })).rejects.toMatchObject({
      code: "DREVER_CONFIG_INVALID",
      details: { path: "deck.lang" },
      message: "deck.lang is required for a web build or PDF export.",
    });
  });

  it("loads TypeScript through Vite and preserves only Drever's public settings", async () => {
    const root = await project();
    await writeFile(
      join(root, "drever.config.ts"),
      `const port: number = 4317;
export default {
  entry: "talk.mdx",
  canvas: { width: 1600, height: 900 },
  deck: {
    title: "A working deck",
    description: "One concise description.",
    lang: "zh-CN",
    dir: "ltr",
    icon: "https://slides.example/icon.svg",
    url: "https://slides.example/keynote/",
    social: {
      image: "https://slides.example/keynote/social.png",
      imageAlt: "Presentation cover",
    },
  },
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
      deck: {
        description: "One concise description.",
        dir: "ltr",
        icon: "https://slides.example/icon.svg",
        lang: "zh-CN",
        social: {
          image: "https://slides.example/keynote/social.png",
          imageAlt: "Presentation cover",
        },
        title: "A working deck",
        url: "https://slides.example/keynote/",
      },
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

  it.each([
    ['{ title: "   " }', "deck.title"],
    ['{ description: "" }', "deck.description"],
    ['{ icon: "" }', "deck.icon"],
    ['{ icon: "/icon.svg" }', "deck.icon"],
    ['{ lang: "not a language tag!" }', "deck.lang"],
    ['{ lang: "und" }', "deck.lang"],
    ['{ lang: "und-Latn" }', "deck.lang"],
    ['{ url: "http://slides.example/deck/" }', "deck.url"],
    ['{ url: "https://user:password@slides.example/deck/" }', "deck.url"],
    ['{ url: "https://slides.example/deck/?preview=true" }', "deck.url"],
    ['{ url: "https://slides.example/deck" }', "deck.url"],
    ['{ dir: "sideways" }', "deck.dir"],
    ['{ social: { image: "" } }', "deck.social.image"],
    ['{ social: { imageAlt: "" } }', "deck.social.imageAlt"],
    ['{ social: { image: "/cover.png" } }', "deck.social.image"],
    ['{ social: { image: "./cover.png", imageAlt: "Presentation cover" } }', "deck.url"],
    ['{ social: { imageAlt: "Presentation cover" } }', "deck.social.image"],
    ["{ social: { unexpected: true } }", "deck.social.unexpected"],
    ["{ unexpected: true }", "deck.unexpected"],
  ])("rejects invalid deck metadata %s", async (deck, path) => {
    const root = await project();
    await writeFile(join(root, "drever.config.ts"), `export default { deck: ${deck} };\n`);

    const failure = await loadDreverConfig({ command: "build", root }).catch(
      (error: unknown) => error,
    );

    expect(failure).toMatchObject({
      code: "DREVER_CONFIG_INVALID",
      details: { path },
    });
  });

  it.skipIf(process.platform === "win32")(
    "rejects a public metadata symlink that escapes the owned directory",
    async () => {
      const root = await project();
      await mkdir(join(root, "public"));
      await writeFile(join(root, "outside.svg"), "<svg />\n");
      await symlink(join(root, "outside.svg"), join(root, "public", "icon.svg"));
      await writeFile(
        join(root, "drever.config.ts"),
        'export default { deck: { icon: "./icon.svg", lang: "en" } };\n',
      );

      await expect(loadDreverConfig({ command: "build", root })).rejects.toMatchObject({
        code: "DREVER_CONFIG_INVALID",
        details: { path: "deck.icon" },
      });
    },
  );

  it("accepts local deck assets only when they exist below public", async () => {
    const root = await project();
    await mkdir(join(root, "public", "social"), { recursive: true });
    await Promise.all([
      writeFile(join(root, "public", "icon.svg"), "<svg />\n"),
      writeFile(join(root, "public", "social", "cover.png"), "fixture\n"),
      writeFile(
        join(root, "drever.config.ts"),
        `export default {
  deck: {
    icon: "./icon.svg?v=1",
    lang: "en",
    url: "https://slides.example/talk/",
    social: {
      image: "./social/cover.png",
      imageAlt: "Presentation cover",
    },
  },
};\n`,
      ),
    ]);

    await expect(loadDreverConfig({ command: "build", root })).resolves.toMatchObject({
      config: {
        deck: {
          icon: "./icon.svg?v=1",
          social: { image: "./social/cover.png" },
          url: "https://slides.example/talk/",
        },
      },
    });
  });

  it.each([
    ["a missing icon", '{ lang: "en", icon: "./missing.svg" }', "deck.icon"],
    [
      "a missing social image",
      '{ lang: "en", url: "https://slides.example/", social: { image: "./missing.png", imageAlt: "Cover" } }',
      "deck.social.image",
    ],
    ["an escaping icon path", '{ lang: "en", icon: "./../secret.svg" }', "deck.icon"],
    ["an encoded escaping icon path", '{ lang: "en", icon: "./%2e%2e/secret.svg" }', "deck.icon"],
  ])("rejects %s", async (_label, deck, path) => {
    const root = await project();
    await writeFile(join(root, "drever.config.ts"), `export default { deck: ${deck} };\n`);

    const failure = await loadDreverConfig({ command: "build", root }).catch(
      (error: unknown) => error,
    );

    expect(failure).toMatchObject({
      code: "DREVER_CONFIG_INVALID",
      details: { path },
    });
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
