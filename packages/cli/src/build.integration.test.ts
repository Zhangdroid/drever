import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { runCli } from "./cli.ts";

const directories: string[] = [];

const staticJavaScriptGraph = async (
  assetsDirectory: string,
  entry: string,
): Promise<ReadonlySet<string>> => {
  const visited = new Set<string>();
  const pending = [entry];
  const staticImport = /(?:\bfrom\s*|\bimport\s*)["']\.\/(?<name>[^"']+\.js)["']/gu;

  while (pending.length > 0) {
    const name = pending.pop();
    if (name === undefined || visited.has(name)) {
      continue;
    }
    visited.add(name);
    const source = await readFile(join(assetsDirectory, name), "utf8");
    for (const match of source.matchAll(staticImport)) {
      const dependency = match.groups?.name;
      if (dependency !== undefined) {
        pending.push(dependency);
      }
    }
  }
  return visited;
};

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("drever build", () => {
  it("turns a configured MDX deck into a private, deployable Vite application", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-build-test-"));
    directories.push(root);
    const componentPackage = join(root, "node_modules", "fixture-component");
    const publicDirectory = join(root, "public");
    await Promise.all([
      mkdir(componentPackage, { recursive: true }),
      mkdir(publicDirectory, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(
        join(root, "talk.mdx"),
        `import { Note, Step } from "drever";

# A working Drever deck

---

# Stateful, not static

<Step>First reveal</Step>

<Step at={3}>A sparse reveal</Step>

<Badge />

<Note>The facade stays browser-safe.</Note>
`,
      ),
      writeFile(
        join(root, "drever.config.ts"),
        `export default {
  entry: "talk.mdx",
  deck: {
    title: "一份可发布的演示",
    description: "验证 Drever 的网页元数据。",
    lang: "zh-CN",
    dir: "ltr",
    url: "https://slides.test/keynote/",
    icon: "./icon.svg",
    social: {
      image: "./social-cover.png",
      imageAlt: "演示文稿封面",
    },
  },
  canvas: { width: 1440, height: 810 },
  build: { outDir: "release", sourcemap: true },
  plugins: [{
    kind: "plugin",
    apiVersion: 1,
    id: "fixture-component-plugin",
    runtime: { components: [{
      name: "Badge",
      module: { specifier: "fixture-component" },
      manifest: { description: "Proves project-root runtime module resolution." },
    }] },
    manifest: { title: "Fixture", summary: "A build integration fixture." },
  }],
};
`,
      ),
      writeFile(
        join(componentPackage, "package.json"),
        '{"name":"fixture-component","type":"module","exports":"./index.js"}\n',
      ),
      writeFile(
        join(componentPackage, "index.js"),
        'export const Badge = () => "resolved-project-component";\n',
      ),
      writeFile(join(publicDirectory, "icon.svg"), "<svg></svg>\n"),
      writeFile(join(publicDirectory, "social-cover.png"), "fixture image\n"),
    ]);
    let output = "";

    await runCli(["build"], {
      cwd: root,
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
    });

    const outDir = join(root, "release");
    const html = await readFile(join(outDir, "index.html"), "utf8");
    const documentHtml = await readFile(join(outDir, "document", "index.html"), "utf8");
    const assetsDirectory = join(outDir, "assets");
    const assets = await readdir(assetsDirectory);
    const script = html.match(/data-drever-src="\.\/assets\/(?<name>[^"]+\.js)"/u)?.groups?.name;
    const audienceChunk = assets.find((name) => /^audience-.+\.js$/u.test(name));
    const documentChunk = assets.find((name) => /^document-.+\.js$/u.test(name));
    const speakerChunk = assets.find((name) => /^speaker-.+\.js$/u.test(name));
    expect(html).toContain('id="drever-root"');
    expect(html).toContain('<html lang="zh-CN" dir="ltr"');
    expect(html).toContain("<title>一份可发布的演示</title>");
    expect(html).toContain('<meta name="description" content="验证 Drever 的网页元数据。" />');
    expect(html).toContain('<meta property="og:title" content="一份可发布的演示" />');
    expect(html).toContain('<link rel="canonical" href="https://slides.test/keynote/" />');
    expect(html).toContain('<meta property="og:url" content="https://slides.test/keynote/" />');
    expect(html).toContain(
      '<meta property="og:image" content="https://slides.test/keynote/social-cover.png" />',
    );
    expect(html).toContain('<meta property="og:image:alt" content="演示文稿封面" />');
    expect(html).toContain('data-drever-href="./icon.svg"');
    expect(documentHtml).toContain('<html lang="zh-CN" dir="ltr"');
    expect(documentHtml).toContain("<title>一份可发布的演示</title>");
    expect(documentHtml).toContain(
      '<meta property="og:image" content="https://slides.test/keynote/social-cover.png" />',
    );
    expect(await readFile(join(outDir, "icon.svg"), "utf8")).toBe("<svg></svg>\n");
    expect(await readFile(join(outDir, "social-cover.png"), "utf8")).toBe("fixture image\n");
    expect(html).toMatch(/<script[^>]+data-drever-src="\.\/assets\/.+\.js"/u);
    expect(html).not.toContain("/@vite/client");
    expect(html).not.toContain('class="drever-viewer"');
    expect(script).toBeDefined();
    expect(audienceChunk).toBeDefined();
    expect(documentChunk).toBeDefined();
    expect(speakerChunk).toBeDefined();
    expect(assets).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^audience-.+\.js$/u),
        expect.stringMatching(/^document-.+\.js$/u),
        expect.stringMatching(/^speaker-.+\.js$/u),
        expect.stringMatching(/\.css$/u),
        expect.stringMatching(/\.js\.map$/u),
      ]),
    );
    const bundle = await readFile(join(outDir, "assets", script as string), "utf8");
    const initialGraph = await staticJavaScriptGraph(assetsDirectory, script as string);
    const audienceGraph = await staticJavaScriptGraph(assetsDirectory, audienceChunk as string);
    const documentGraph = await staticJavaScriptGraph(assetsDirectory, documentChunk as string);
    const speakerGraph = await staticJavaScriptGraph(assetsDirectory, speakerChunk as string);
    expect(
      [...initialGraph].some((name) => /^(?:audience|document|speaker)-.+\.js$/u.test(name)),
    ).toBe(false);
    expect([...audienceGraph].some((name) => /^(?:document|speaker)-.+\.js$/u.test(name))).toBe(
      false,
    );
    expect([...documentGraph].some((name) => /^(?:audience|speaker)-.+\.js$/u.test(name))).toBe(
      false,
    );
    expect([...speakerGraph].some((name) => /^(?:audience|document)-.+\.js$/u.test(name))).toBe(
      false,
    );
    expect(bundle).toContain("A working Drever deck");
    expect(bundle).toContain("resolved-project-component");
    expect(bundle).not.toContain("__vite-browser-external");
    expect(bundle).not.toContain("vite-plus-core");
    expect(bundle).not.toContain("@react-refresh");
    expect(bundle).not.toContain("react-refresh");
    expect(bundle).not.toContain("dreverDeckManifestState");
    expect(bundle).not.toContain("ManifestSignature");
    expect(bundle).not.toContain("data-drever-dev-source");
    expect(bundle).not.toContain("drever:current-position");
    expect(bundle).not.toContain("__dreverExperimentalTextLayout");
    expect(bundle).not.toContain("@chenglou/pretext");
    expect(output).toBe(`Built ${join(root, "talk.mdx")} to ${outDir}\n`);
  }, 30_000);
});
