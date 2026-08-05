import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const execute = promisify(execFile);
const projectRoot = join(import.meta.dirname, "fixtures", "core-deck");
const cli = join(import.meta.dirname, "..", "packages", "cli", "dist", "bin.mjs");

const hasCode = (error: unknown, code: string): boolean =>
  error instanceof Error && "code" in error && error.code === code;

const directoryDigest = async (root: string): Promise<string | undefined> => {
  const hash = createHash("sha256");
  let entries: string[];
  try {
    entries = (await readdir(root, { recursive: true })).sort();
  } catch (error) {
    if (hasCode(error, "ENOENT")) {
      return;
    }
    throw error;
  }
  for (const entry of entries) {
    const path = join(root, entry);
    const metadata = await stat(path);
    if (metadata.isFile()) {
      hash.update(entry);
      hash.update(await readFile(path));
    }
  }
  return hash.digest("hex");
};

type ExportPdfOptions = Readonly<{
  slides?: string;
  steps?: boolean;
}>;

const exportPdf = async (
  output: string,
  { slides, steps = false }: ExportPdfOptions = {},
): Promise<string> => {
  const { stdout } = await execute(
    process.execPath,
    [
      cli,
      "export",
      "pdf",
      ...(steps ? ["--steps"] : []),
      ...(slides === undefined ? [] : ["--slides", slides]),
      "--output",
      output,
    ],
    { cwd: projectRoot, timeout: 30_000 },
  );
  return stdout;
};

const pdfPageCount = (contents: Buffer): number =>
  contents.toString("latin1").match(/\/Type\s*\/Page\b/gu)?.length ?? 0;

test("the public export command creates deterministic PDFs without touching the web build", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(join(tmpdir(), "drever-export-e2e-"));
  try {
    const defaultOutput = join(directory, "slides.pdf");
    const selectedOutput = join(directory, "slides-selected-with-steps.pdf");
    const stepsOutput = join(directory, "slides-with-steps.pdf");
    const distBefore = await directoryDigest(join(projectRoot, "dist"));

    expect(await exportPdf(defaultOutput)).toContain(`Exported ${join(projectRoot, "slides.mdx")}`);
    const defaultPdf = await readFile(defaultOutput);
    expect(defaultPdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdfPageCount(defaultPdf)).toBe(7);
    const defaultSource = defaultPdf.toString("latin1");
    expect(defaultSource).toContain("/Title (Drever core E2E fixture)");
    expect(defaultSource).toContain("/Lang (en)");

    expect(await exportPdf(stepsOutput, { steps: true })).toContain(
      `Exported ${join(projectRoot, "slides.mdx")}`,
    );
    const stepsPdf = await readFile(stepsOutput);
    const source = stepsPdf.toString("latin1");
    expect(pdfPageCount(stepsPdf)).toBe(9);
    expect(source).toContain("/StructTreeRoot");
    expect(source).toContain("/MarkInfo");
    expect(source).toContain("/Outlines");
    expect(source).toMatch(/\/MediaBox\s*\[0\s+0\s+1200\s+675\.12\]/u);

    expect(await exportPdf(selectedOutput, { slides: "2,4-5", steps: true })).toContain(
      `Exported ${join(projectRoot, "slides.mdx")}`,
    );
    expect(pdfPageCount(await readFile(selectedOutput))).toBe(5);

    expect(await directoryDigest(join(projectRoot, "dist"))).toBe(distBefore);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("a failing export hook reports plugin context and never writes a partial PDF", async () => {
  const root = await mkdtemp(join(tmpdir(), "drever-export-failure-e2e-"));
  const output = join(root, "failed.pdf");
  try {
    await Promise.all([
      writeFile(join(root, "slides.mdx"), "# Export failure\n"),
      writeFile(
        join(root, "drever.config.ts"),
        `export default {
  deck: { lang: "en" },
  plugins: [{
    kind: "plugin",
    apiVersion: 1,
    id: "e2e-rejecting-export",
    baseURL: import.meta.url,
    manifest: {
      title: "Rejecting export fixture",
      summary: "Proves export hook failures cross the browser boundary.",
    },
    runtime: { exportSetup: [{ specifier: "./reject-export.js" }] },
  }],
};
`,
      ),
      writeFile(
        join(root, "reject-export.js"),
        'export default () => { throw new Error("The diagram renderer rejected export."); };\n',
      ),
    ]);

    const failure = await execute(process.execPath, [cli, "export", "pdf", "--output", output], {
      cwd: root,
      timeout: 30_000,
    }).catch((error: unknown) => error as Error & { stderr: string });

    expect(failure).toBeInstanceOf(Error);
    expect(failure.stderr).toContain("[DREVER_EXPORT_FAILED]");
    expect(failure.stderr).toContain("stage=runtime");
    expect(failure.stderr).toContain("owner=e2e-rejecting-export");
    expect(failure.stderr).toContain("capability=exportSetup");
    expect(failure.stderr).toContain("reject-export.js");
    await expect(stat(output)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("the export command materializes animated text before PDF capture", async () => {
  const root = await mkdtemp(join(tmpdir(), "drever-export-animation-e2e-"));
  const output = join(root, "animated.pdf");
  try {
    await Promise.all([
      writeFile(
        join(root, "slides.mdx"),
        `import "./reveal.css";

# Animated export

<p className="export-reveal">The PDF keeps this animated sentence.</p>
<span className="export-loop" aria-hidden="true" />
`,
      ),
      writeFile(
        join(root, "reveal.css"),
        `.export-reveal {
  opacity: 0;
  visibility: hidden;
  animation: export-reveal 8s both;
}

.export-loop {
  width: 1rem;
  height: 1rem;
  animation: export-loop 1s infinite alternate;
}

@keyframes export-reveal {
  to {
    opacity: 1;
    visibility: visible;
  }
}

@keyframes export-loop {
  to {
    transform: translateX(2rem);
  }
}
`,
      ),
      writeFile(
        join(root, "drever.config.ts"),
        `export default {
  deck: { lang: "en" },
  plugins: [{
    kind: "plugin",
    apiVersion: 1,
    id: "e2e-export-animation-verifier",
    baseURL: import.meta.url,
    manifest: {
      title: "Export animation verifier",
      summary: "Checks the exact DOM state captured by PDF export.",
    },
    runtime: { exportSetup: [{ specifier: "./verify-export.js" }] },
  }],
};
`,
      ),
      writeFile(
        join(root, "verify-export.js"),
        `export default ({ runtime: { container } }) => {
  let state;
  let frame;
  const inspect = () => {
    const sentence = container.querySelector(".export-reveal");
    const loop = container.querySelector(".export-loop");
    const style = getComputedStyle(sentence);
    state = {
      loopPaused: loop.getAnimations().every((animation) => animation.playState === "paused"),
      opacity: style.opacity,
      visibility: style.visibility,
      width: sentence.getBoundingClientRect().width,
    };
    frame = requestAnimationFrame(inspect);
  };
  inspect();
  return () => {
    cancelAnimationFrame(frame);
    if (state.opacity !== "1" || state.visibility !== "visible") {
      throw new Error("Animated export text did not reach its visible endpoint.");
    }
    if (state.width === 0) {
      throw new Error("Animated export text has no rendered footprint.");
    }
    if (!state.loopPaused) {
      throw new Error("Infinite export animation was not frozen.");
    }
  };
};
`,
      ),
    ]);

    const { stdout } = await execute(process.execPath, [cli, "export", "pdf", "--output", output], {
      cwd: root,
      timeout: 30_000,
    });
    expect(stdout).toContain(`Exported ${await realpath(join(root, "slides.mdx"))}`);
    const contents = await readFile(output);
    expect(contents.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdfPageCount(contents)).toBe(1);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("a missing Chromium installation reports the exact recovery command", async () => {
  const root = await mkdtemp(join(tmpdir(), "drever-export-browser-missing-e2e-"));
  const output = join(root, "failed.pdf");
  try {
    await Promise.all([
      writeFile(join(root, "slides.mdx"), "# Browser installation contract\n"),
      writeFile(join(root, "drever.config.ts"), 'export default { deck: { lang: "en" } };\n'),
    ]);
    const failure = await execute(process.execPath, [cli, "export", "pdf", "--output", output], {
      cwd: root,
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: join(root, "empty-browser-cache") },
      timeout: 30_000,
    }).catch((error: unknown) => error as Error & { stderr: string });

    expect(failure).toBeInstanceOf(Error);
    expect(failure.stderr).toContain("[DREVER_EXPORT_BROWSER_MISSING]");
    expect(failure.stderr).toContain("Drever PDF export requires Playwright Chromium.");
    expect(failure.stderr).toContain("Run drever browser install, then retry the export.");
    await expect(stat(output)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("a rejecting export disposer fails before writing the captured PDF", async () => {
  const root = await mkdtemp(join(tmpdir(), "drever-export-disposer-e2e-"));
  const output = join(root, "failed.pdf");
  try {
    await Promise.all([
      writeFile(join(root, "slides.mdx"), "# Export cleanup contract\n"),
      writeFile(
        join(root, "drever.config.ts"),
        `export default {
  deck: { lang: "en" },
  plugins: [{
    kind: "plugin",
    apiVersion: 1,
    id: "e2e-rejecting-disposer",
    baseURL: import.meta.url,
    manifest: {
      title: "Rejecting disposer fixture",
      summary: "Proves cleanup completes before a PDF is written.",
    },
    runtime: { exportSetup: [{ specifier: "./reject-dispose.js" }] },
  }],
};
`,
      ),
      writeFile(
        join(root, "reject-dispose.js"),
        'export default () => () => { throw new Error("The exporter disposer rejected cleanup."); };\n',
      ),
    ]);

    const failure = await execute(process.execPath, [cli, "export", "pdf", "--output", output], {
      cwd: root,
      timeout: 30_000,
    }).catch((error: unknown) => error as Error & { stderr: string });

    expect(failure).toBeInstanceOf(Error);
    expect(failure.stderr).toContain("[DREVER_EXPORT_FAILED]");
    expect(failure.stderr).toContain("The export runtime could not release its resources.");
    expect(failure.stderr).toContain("stage=cleanup");
    expect(failure.stderr).toContain("owner=e2e-rejecting-disposer");
    expect(failure.stderr).toContain("capability=exportSetup");
    expect(failure.stderr).toContain("reject-dispose.js");
    await expect(stat(output)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
