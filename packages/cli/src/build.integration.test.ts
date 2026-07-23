import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { runCli } from "./cli.ts";

const directories: string[] = [];

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
    await mkdir(componentPackage, { recursive: true });
    await Promise.all([
      writeFile(
        join(root, "talk.mdx"),
        `# A working Drever deck

---

# Stateful, not static

<Step>First reveal</Step>

<Step at={3}>A sparse reveal</Step>

<Badge />
`,
      ),
      writeFile(
        join(root, "drever.config.ts"),
        `export default {
  entry: "talk.mdx",
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
    ]);
    let output = "";

    await runCli(["build"], {
      cwd: root,
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
    });

    const outDir = join(root, "release");
    const html = await readFile(join(outDir, "index.html"), "utf8");
    const assets = await readdir(join(outDir, "assets"));
    const script = assets.find((name) => name.endsWith(".js"));
    expect(html).toContain('id="drever-root"');
    expect(html).toMatch(/<script[^>]+data-drever-src="\.\/assets\/.+\.js"/u);
    expect(html).not.toContain("/@vite/client");
    expect(html).not.toContain('class="drever-viewer"');
    expect(script).toBeDefined();
    expect(assets).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\.css$/u),
        expect.stringMatching(/\.js\.map$/u),
      ]),
    );
    const bundle = await readFile(join(outDir, "assets", script as string), "utf8");
    expect(bundle).toContain("A working Drever deck");
    expect(bundle).toContain("resolved-project-component");
    expect(bundle).not.toContain("@react-refresh");
    expect(bundle).not.toContain("react-refresh");
    expect(bundle).not.toContain("dreverDeckManifestState");
    expect(bundle).not.toContain("ManifestSignature");
    expect(output).toBe(`Built ${join(root, "talk.mdx")} to ${outDir}\n`);
  }, 30_000);
});
