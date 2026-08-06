import { createCompilePlan } from "@drever/compiler";
import basicTheme from "@drever/designs/basic";
import gfmPlugin from "@drever/plugin-gfm";
import shikiPlugin from "@drever/plugin-shiki";
import tailwindCssPlugin, { tailwindCss } from "@drever/plugin-tailwindcss";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  resolveDreverDevelopmentProject,
  resolveDreverProject,
  resolvePluginRegistrations,
} from "./project.ts";
import { neutralTheme } from "./neutral-theme.ts";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("default plugin registrations", () => {
  it("enables GFM, Shiki, and Tailwind CSS as ordered defaults", () => {
    expect(resolvePluginRegistrations()).toMatchObject([
      { origin: "default", plugin: gfmPlugin },
      { origin: "default", plugin: shikiPlugin },
      { origin: "default", plugin: tailwindCssPlugin },
    ]);
  });

  it("lets config disable or configure a default without registering it twice", () => {
    const result = createCompilePlan({
      theme: neutralTheme,
      plugins: resolvePluginRegistrations([
        { plugin: shikiPlugin, enabled: false },
        tailwindCss({ optimize: false }),
      ]),
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        plugins: [
          {
            id: "@drever/plugin-gfm",
            origin: "default",
            config: { singleTilde: true },
          },
          {
            id: "@drever/plugin-tailwindcss",
            origin: "default",
            config: { optimize: false },
          },
        ],
      },
    });
  });

  it("keeps a second override visible to the compiler's duplicate diagnostic", () => {
    const result = createCompilePlan({
      theme: neutralTheme,
      plugins: resolvePluginRegistrations([shikiPlugin, shikiPlugin]),
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "DREVER_PLUGIN_DUPLICATE",
          plugin: "@drever/plugin-shiki",
          details: { origins: ["default", "user"] },
        },
      ],
    });
  });
});

describe("development project resolution", () => {
  it("uses an undecorated internal theme when the project has not selected one", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-neutral-project-"));
    directories.push(root);

    const project = await resolveDreverDevelopmentProject({ config: {}, root });

    expect(project.plan.theme).toMatchObject({
      canvas: { height: 900, width: 1_600 },
      id: "drever:neutral",
      manifest: { title: "Drever Neutral" },
    });
    expect(project.plan.runtime.layouts).toEqual([]);
    expect(project.plan.runtime.styles.filter(({ owner }) => owner.kind === "theme")).toEqual([]);
    expect(JSON.stringify(project.plan)).not.toContain("@drever/designs");
  });

  it("still resolves Basic and its layouts after an explicit project choice", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-basic-project-"));
    directories.push(root);

    const project = await resolveDreverDevelopmentProject({
      config: { theme: basicTheme },
      root,
    });

    expect(project.plan.theme.id).toBe("@drever/designs/basic");
    expect(project.plan.runtime.layouts.map(({ name }) => name)).toEqual(["Cover", "TwoColumn"]);
    expect(
      project.plan.runtime.styles.some(({ owner }) => owner.id === "@drever/designs/basic"),
    ).toBe(true);
  });

  it("can start the plan-only surface before slides.mdx exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-storyboard-project-"));
    directories.push(root);

    await expect(resolveDreverDevelopmentProject({ config: {}, root })).resolves.toMatchObject({
      entry: join(root, "slides.mdx"),
      root,
    });
    await expect(resolveDreverProject({ config: {}, root })).rejects.toMatchObject({
      code: "DREVER_ENTRY_NOT_FOUND",
    });
  });

  it("still rejects an unsupported configured entry before it exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-storyboard-project-"));
    directories.push(root);

    await expect(
      resolveDreverDevelopmentProject({
        config: { entry: "slides.txt" },
        root,
      }),
    ).rejects.toMatchObject({ code: "DREVER_ENTRY_EXTENSION_UNSUPPORTED" });
  });
});
