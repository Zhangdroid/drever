import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { checkDeck } from "./check.ts";
import { checkStyleSources } from "./style-source-check.ts";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

const createProject = async (): Promise<
  Readonly<{ entry: string; root: string; source: string }>
> => {
  const root = await mkdtemp(join(tmpdir(), "drever-style-check-test-"));
  directories.push(root);
  const entry = join(root, "slides.mdx");
  const source = 'import "./slides.css";\n\n# Opening\n';
  await writeFile(entry, source);
  return { entry, root, source };
};

describe("style source check", () => {
  it("rejects runtime-only CSS import schemes with exact source locations", async () => {
    const project = await createProject();
    const css = [
      '@import url("data:text/css,.inline%7B%7D");',
      "@import 'blob:generated-styles';",
      "@import url(javascript:styles);",
    ].join("\n");
    const path = join(project.root, "slides.css");
    await writeFile(path, css);

    const diagnostics = await checkStyleSources(project);

    expect(diagnostics.map(({ code }) => code)).toEqual([
      "DREVER_CSS_IMPORT_SCHEME_UNSUPPORTED",
      "DREVER_CSS_IMPORT_SCHEME_UNSUPPORTED",
      "DREVER_CSS_IMPORT_SCHEME_UNSUPPORTED",
    ]);
    expect(diagnostics.map(({ details }) => details?.scheme)).toEqual([
      "data",
      "blob",
      "javascript",
    ]);
    expect(diagnostics[0]).toMatchObject({
      severity: "error",
      stage: "bundle",
      source: {
        path,
        start: { line: 1, column: 14, offset: css.indexOf("data:") },
        end: { offset: css.indexOf("data:") + "data:text/css,.inline%7B%7D".length },
      },
    });
  });

  it("follows relative CSS imports while allowing web URLs and ignoring comments", async () => {
    const project = await createProject();
    await writeFile(
      join(project.root, "slides.css"),
      [
        '@import "./nested.css";',
        '@import url("https://cdn.example.com/type.css");',
        '/* @import "data:text/css,.ignored%7B%7D"; */',
        ".label::before { content: \"@import 'blob:ignored'\"; }",
      ].join("\n"),
    );
    const nested = '@import "data:text/css,.nested%7B%7D";';
    const nestedPath = join(project.root, "nested.css");
    await writeFile(nestedPath, nested);

    const diagnostics = await checkStyleSources(project);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: "DREVER_CSS_IMPORT_SCHEME_UNSUPPORTED",
      details: { scheme: "data", specifier: "data:text/css,.nested%7B%7D" },
      source: { path: nestedPath },
    });
  });

  it("follows local component and re-export modules before checking their CSS", async () => {
    const project = await createProject();
    const components = join(project.root, "components");
    await mkdir(components);
    const source = 'import { Hero } from "./components";\n\n# Opening\n\n<Hero />\n';
    await writeFile(project.entry, source);
    await writeFile(join(components, "index.ts"), 'export { Hero } from "./Hero";\n');
    await writeFile(
      join(components, "Hero.tsx"),
      [
        'import "./hero.css";',
        'const example = `import "./ignored.css"`;',
        '// import "./also-ignored.css";',
        "export const Hero = () => <section>Hero</section>;",
      ].join("\n"),
    );
    const cssPath = join(components, "hero.css");
    await writeFile(cssPath, '@import url("data:text/css,.hero%7B%7D");\n');
    let output = "";

    const exitCode = await checkDeck({
      entry: project.entry,
      json: true,
      root: project.root,
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
    });
    const report = JSON.parse(output) as {
      diagnostics: readonly {
        code: string;
        details?: { scheme?: string; specifier?: string };
        source?: { path: string };
      }[];
    };

    expect(exitCode).toBe(1);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "DREVER_CSS_IMPORT_SCHEME_UNSUPPORTED",
        details: { scheme: "data", specifier: "data:text/css,.hero%7B%7D" },
        source: expect.objectContaining({ path: cssPath }),
      }),
    ]);
  });

  it("fails drever check before the invalid stylesheet reaches Vite", async () => {
    const project = await createProject();
    await writeFile(join(project.root, "slides.css"), '@import url("data:text/css,");\n');
    let output = "";

    const exitCode = await checkDeck({
      entry: project.entry,
      json: true,
      root: project.root,
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
    });
    const report = JSON.parse(output) as {
      diagnostics: readonly { code: string; hint?: string; source?: { path: string } }[];
      summary: { errors: number };
    };

    expect(exitCode).toBe(1);
    expect(report.summary.errors).toBe(1);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DREVER_CSS_IMPORT_SCHEME_UNSUPPORTED",
        hint: "Write the CSS in a project file and import that file with a relative path.",
        source: expect.objectContaining({ path: join(project.root, "slides.css") }),
      }),
    );
  });
});
