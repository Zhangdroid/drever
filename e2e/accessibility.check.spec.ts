import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const execute = promisify(execFile);
const projectRoot = join(import.meta.dirname, "fixtures", "core-deck");
const cli = join(import.meta.dirname, "..", "packages", "cli", "dist", "bin.mjs");
const environment = { ...process.env };
delete environment.FORCE_COLOR;

type CheckDiagnostic = Readonly<{
  code: string;
  details?: Readonly<Record<string, unknown>>;
  hint?: string;
  message: string;
  severity: "error" | "info" | "warning";
  source?: Readonly<{
    end: Readonly<{ column: number; line: number; offset: number }>;
    path: string;
    start: Readonly<{ column: number; line: number; offset: number }>;
  }>;
}>;

type CheckReport = Readonly<{
  diagnostics: readonly CheckDiagnostic[];
  slideCount: number;
  sourcePath: string;
  summary: Readonly<{ errors: number; info: number; warnings: number }>;
  version: number;
}>;

type CliFailure = Error & Readonly<{ code: number | string; stderr: string; stdout: string }>;

const runCheck = (cwd: string, ...arguments_: string[]) =>
  execute(process.execPath, [cli, "check", ...arguments_], {
    cwd,
    env: environment,
    timeout: arguments_.includes("--rendered") ? 90_000 : 30_000,
  });

const runFailingCheck = async (cwd: string, ...arguments_: string[]): Promise<CliFailure> =>
  runCheck(cwd, ...arguments_).then(
    () => {
      throw new Error("Expected drever check to fail.");
    },
    (error: unknown) => error as CliFailure,
  );

const parseReport = (source: string): CheckReport => JSON.parse(source) as CheckReport;

test("the built CLI emits an empty JSON accessibility report for a clean deck", async () => {
  const { stdout } = await runCheck(projectRoot, "--json");
  const report = parseReport(stdout);

  expect(report).toEqual({
    version: 2,
    sourcePath: join(projectRoot, "slides.mdx"),
    slideCount: 7,
    summary: { errors: 0, warnings: 0, info: 0 },
    diagnostics: [],
  });
});

test("the built CLI returns actionable source diagnostics and a failing exit status", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "drever-check-errors-e2e-")));
  const sourcePath = join(root, "slides.mdx");
  try {
    await writeFile(
      sourcePath,
      `# Repeated title

---

# Repeated title

---

This slide has no title.

<img src="diagram.png" />
`,
    );

    const failure = await runFailingCheck(root, "slides.mdx", "--json");
    expect(failure).toBeInstanceOf(Error);
    expect(failure.code).not.toBe(0);

    const report = parseReport(failure.stdout);
    expect(report).toMatchObject({
      version: 2,
      sourcePath,
      slideCount: 3,
      summary: { errors: 3, warnings: 0, info: 0 },
    });

    const expectedLines = new Map([
      ["DREVER_A11Y_SLIDE_TITLE_MISSING", 9],
      ["DREVER_A11Y_SLIDE_TITLE_DUPLICATE", 5],
      ["DREVER_A11Y_IMAGE_ALT_MISSING", 11],
    ]);
    for (const [code, line] of expectedLines) {
      const diagnostic = report.diagnostics.find((candidate) => candidate.code === code);
      expect(diagnostic, `missing ${code}`).toMatchObject({
        code,
        severity: "error",
        message: expect.any(String),
        hint: expect.any(String),
        source: {
          path: sourcePath,
          start: { line, column: expect.any(Number), offset: expect.any(Number) },
          end: {
            line: expect.any(Number),
            column: expect.any(Number),
            offset: expect.any(Number),
          },
        },
      });
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("warnings remain machine-readable without failing the command", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "drever-check-warning-e2e-")));
  try {
    await writeFile(join(root, "slides.mdx"), "# Accessible title\n\n### Skipped level\n");

    const { stdout } = await runCheck(root, "--json");
    const report = parseReport(stdout);
    expect(report.summary).toEqual({ errors: 0, warnings: 1, info: 0 });
    expect(report.diagnostics).toMatchObject([
      {
        code: "DREVER_A11Y_HEADING_LEVEL_SKIPPED",
        severity: "warning",
        source: { path: join(root, "slides.mdx"), start: { line: 3 } },
      },
    ]);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("rendered check catches high-confidence visual failures without writing a production build", async () => {
  test.setTimeout(120_000);
  const root = await realpath(await mkdtemp(join(tmpdir(), "drever-render-check-e2e-")));
  try {
    await writeFile(
      join(root, "slides.mdx"),
      `import { Step } from "drever";

<style>{\`
  [data-step-state="pending"].reflow-evidence { display: none; }
  pre.shiki { background: #08141d !important; }
\`}</style>

# Rendered evidence

<div style={{ width: 280, height: 40, overflow: "hidden" }}>
  <p style={{ margin: 0, lineHeight: "30px", whiteSpace: "pre-line" }}>{"The first line remains visible.\\nThe required second line is clipped."}</p>
</div>

<p style={{ width: 180, overflowX: "auto", whiteSpace: "nowrap" }}>This required sentence exceeds its direct scroll surface.</p>

<Step at={1} className="reflow-evidence">
  <p>New evidence takes real layout space.</p>
</Step>

## Persistent decision

---

# Independent content must not collide

<div style={{ position: "relative", height: 320 }}>
  <p style={{ position: "absolute", inset: "30px auto auto 40px", width: 360, margin: 0, padding: 8, background: "#fff", color: "#111", fontSize: 16, lineHeight: "20px" }}>The decision needs a readable line.</p>
  <p style={{ position: "absolute", inset: "40px auto auto 80px", width: 360, margin: 0, padding: 8, background: "#fff", color: "#111", fontSize: 16, lineHeight: "20px" }}>This independent evidence collides with it.</p>

  <p style={{ position: "absolute", inset: "150px auto auto 40px", width: 280, margin: 0, padding: 8, background: "#fff", color: "#111", fontSize: 16, lineHeight: "20px" }}>Intentional decoration overlap.</p>
  <div
    aria-label="Decorative disk"
    data-drever-visual-role="decoration"
    role="img"
    style={{ position: "absolute", inset: "145px auto auto 90px", zIndex: 2, width: 120, height: 45, background: "#111" }}
  />

  <p style={{ position: "absolute", inset: "260px auto auto 40px", width: 220, margin: 0, background: "#fff", color: "#111", fontSize: 16, lineHeight: "20px" }}>Allowed authored overlap.</p>
  <p data-drever-overlap="allow" style={{ position: "absolute", inset: "260px auto auto 80px", width: 220, margin: 0, background: "#fff", color: "#111", fontSize: 16, lineHeight: "20px" }}>This pair is explicitly allowed.</p>
</div>

---

# Contrast needs deterministic evidence

<p style={{ padding: 12, backgroundColor: "#ffffff", color: "#aaaaaa", fontSize: 16 }}>This supporting copy is below the WCAG contrast threshold.</p>

<div style={{ padding: 12, backgroundColor: "#ffffff" }}>
  <span style={{ color: "#aaaaaa", fontSize: 16 }}>A custom component label must be checked too.</span>
</div>

<p style={{ padding: 12, backgroundColor: "#ffffff", color: "#333333", fontSize: 16 }}>This solid-color control remains readable.</p>

<p style={{ padding: 12, backgroundImage: "linear-gradient(90deg, #ffffff, #777777)", color: "#222222" }}>Gradient contrast requires rendered inspection rather than a false pass.</p>

<div style={{ position: "relative", width: 420, padding: 12, backgroundColor: "#ffffff", color: "#222222", fontSize: 16, lineHeight: "32px" }}>
  <span style={{ position: "relative", zIndex: 2 }}>The first line has a solid background.<br />The second line crosses painted content.</span>
  <div aria-hidden="true" style={{ position: "absolute", zIndex: 1, inset: "44px 0 auto 0", height: 32, backgroundColor: "#111111" }} />
</div>

~~~jsx
const selectedTheme = "light syntax on a dark code surface";
~~~

---

# Required copy needs breathing room

<p style={{ position: "absolute", inset: "300px auto auto 0", margin: 0 }}>This readable line hugs the canvas edge.</p>

<p data-drever-visual-role="decoration" style={{ position: "absolute", inset: "520px 0 auto auto", margin: 0 }}>Decorative edge label</p>
`,
    );

    const failure = await runFailingCheck(root, "--rendered", "--json");
    expect(failure.stdout, failure.stderr).not.toBe("");
    const report = parseReport(failure.stdout) as CheckReport &
      Readonly<{
        rendered: Readonly<{
          browserVersion?: string;
          engine: string;
          rulesetVersion: number;
          stateCount: number;
          status: string;
          version: number;
        }>;
      }>;

    expect(report.rendered, JSON.stringify(report, null, 2)).toEqual(
      expect.objectContaining({
        browserVersion: expect.any(String),
        engine: "chromium",
        rulesetVersion: 6,
        stateCount: 5,
        status: "failed",
        version: 1,
      }),
    );
    const diagnosticsByCode = Map.groupBy(report.diagnostics, ({ code }) => code);
    expect(diagnosticsByCode.get("DREVER_RENDER_CONTENT_CLIPPED")).toHaveLength(2);
    expect(
      diagnosticsByCode
        .get("DREVER_RENDER_CONTENT_CLIPPED")
        ?.map(({ details }) => details?.evidence),
      JSON.stringify(report.diagnostics, null, 2),
    ).toEqual(expect.arrayContaining(["line-fragment", "scroll-overflow"]));
    expect(diagnosticsByCode.get("DREVER_RENDER_CONTENT_OVERLAP")).toHaveLength(1);
    expect(diagnosticsByCode.get("DREVER_RENDER_TEXT_CONTRAST_LOW")).toHaveLength(3);
    expect(diagnosticsByCode.get("DREVER_RENDER_TEXT_CONTRAST_LOW")).toContainEqual(
      expect.objectContaining({
        details: expect.objectContaining({
          background: "rgb(8 20 29)",
          context: "syntax-token",
          element: expect.objectContaining({ tag: "span" }),
          foreground: "rgb(36 41 46)",
        }),
      }),
    );
    expect(diagnosticsByCode.get("DREVER_RENDER_TEXT_CONTRAST_INDETERMINATE")).toBeDefined();
    expect(diagnosticsByCode.get("DREVER_RENDER_TEXT_SAFE_AREA")).toHaveLength(1);
    expect(
      diagnosticsByCode
        .get("DREVER_RENDER_TEXT_CONTRAST_INDETERMINATE")
        ?.map(({ details }) => details?.reason),
    ).toContain("painted-content-behind-text");
    expect(diagnosticsByCode.get("DREVER_RENDER_GEOMETRY_UNSTABLE")).toBeDefined();
    expect(await readdir(root)).not.toContain("dist");
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("rendered check writes a complete Playwright visual-evidence set on explicit request", async () => {
  test.setTimeout(120_000);
  const root = await realpath(await mkdtemp(join(tmpdir(), "drever-render-evidence-e2e-")));
  const output = join(root, ".drever", "review");
  try {
    await writeFile(
      join(root, "drever.config.ts"),
      "export default { canvas: { width: 1600, height: 900 } };\n",
    );
    await writeFile(
      join(root, "slides.mdx"),
      `import { Step } from "drever";

# First decision

<Step at={3}>The evidence arrives.</Step>

---

# Final decision
`,
    );

    const { stdout } = await runCheck(root, "--rendered", "--evidence", ".drever/review", "--json");
    const report = parseReport(stdout) as CheckReport &
      Readonly<{
        rendered: Readonly<{
          evidence: Readonly<{ inputSha256: string; manifest: string; schemaVersion: number }>;
          stateCount: number;
          status: string;
        }>;
      }>;
    expect(report.rendered).toMatchObject({ stateCount: 3, status: "passed" });

    const manifest = JSON.parse(await readFile(join(output, "manifest.json"), "utf8")) as {
      canvas: Readonly<{ height: number; width: number }>;
      input: Readonly<{ algorithm: string; sha256: string; source: string }>;
      reviewImages: readonly string[];
      schemaVersion: number;
      states: readonly Readonly<{ path: string; route: string; slide: number; step: number }>[];
      transitions: readonly Readonly<{
        direction: string;
        from: Readonly<{ route: string; slide: number; step: number }>;
        path: string;
        to: Readonly<{ route: string; slide: number; step: number }>;
      }>[];
    };
    expect(manifest).toMatchObject({
      canvas: { height: 900, width: 1600 },
      input: {
        algorithm: "sha256",
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
        source: "inspection-build",
      },
      schemaVersion: 1,
      states: [
        { route: "/", slide: 1, step: 0 },
        { route: "/1/3", slide: 1, step: 3 },
        { route: "/2", slide: 2, step: 0 },
      ],
    });
    expect(manifest.transitions).toHaveLength(4);
    expect(
      manifest.transitions.map(({ direction, from, to }) => ({ direction, from, to })),
    ).toEqual([
      {
        direction: "forward",
        from: { route: "/", slide: 1, step: 0 },
        to: { route: "/1/3", slide: 1, step: 3 },
      },
      {
        direction: "reverse",
        from: { route: "/1/3", slide: 1, step: 3 },
        to: { route: "/", slide: 1, step: 0 },
      },
      {
        direction: "forward",
        from: { route: "/1/3", slide: 1, step: 3 },
        to: { route: "/2", slide: 2, step: 0 },
      },
      {
        direction: "reverse",
        from: { route: "/2", slide: 2, step: 0 },
        to: { route: "/1/3", slide: 1, step: 3 },
      },
    ]);
    expect(manifest.reviewImages).toHaveLength(9);
    expect(report.rendered.evidence).toEqual({
      inputSha256: manifest.input.sha256,
      manifest: "manifest.json",
      schemaVersion: manifest.schemaVersion,
    });
    await Promise.all(manifest.reviewImages.map((path) => readFile(join(output, path))));

    const firstPng = await readFile(join(output, manifest.states[0]?.path ?? ""));
    expect(firstPng.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(firstPng.readUInt32BE(16)).toBe(1600);
    expect(firstPng.readUInt32BE(20)).toBe(900);
    expect(await readdir(root)).not.toContain("dist");

    await writeFile(join(root, "slides.mdx"), "# Broken\n\n<Component");
    await runFailingCheck(root, "--rendered", "--evidence", ".drever/review", "--json");
    await expect(readFile(join(output, "manifest.json"))).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("rendered check blocks repeated full-canvas direct and pseudo background paint", async () => {
  test.setTimeout(120_000);
  const root = await realpath(await mkdtemp(join(tmpdir(), "drever-background-check-e2e-")));
  try {
    await writeFile(
      join(root, "slides.mdx"),
      `<style>{\`
  :root { --drever-motion-slide-offset: 2.5%; }
  .drever-canvas { --drever-canvas-background: #08111f; }
  :where([data-drever-slide]) { background: #08111f; color: #f4f7ff; }
  .moving-background {
    position: absolute;
    inset: 0;
    padding: 96px;
    background: radial-gradient(circle at 80% 18%, #315880 0, transparent 32%), #08111f;
  }
  .moving-pseudo {
    position: absolute;
    isolation: isolate;
    inset: 0;
    padding: 96px;
    background: #08111f;
  }
  .moving-pseudo::before {
    position: absolute;
    z-index: -1;
    inset: 0;
    background: radial-gradient(circle at 18% 80%, #275743 0, transparent 34%);
    content: "";
  }
\`}</style>

<section className="moving-background">
  # Direct background one
</section>

---

<section className="moving-background">
  # Direct background two
</section>

---

<section className="moving-pseudo">
  # Pseudo background one
</section>

---

<section className="moving-pseudo">
  # Pseudo background two
</section>
`,
    );

    const failure = await runFailingCheck(root, "--rendered", "--json");
    const report = parseReport(failure.stdout) as CheckReport &
      Readonly<{ rendered: Readonly<{ rulesetVersion: number; stateCount: number }> }>;
    const backgroundDiagnostics = report.diagnostics.filter(
      ({ code }) => code === "DREVER_RENDER_BACKGROUND_TRANSITIONED",
    );

    expect(report.rendered).toMatchObject({ rulesetVersion: 6, stateCount: 4 });
    expect(backgroundDiagnostics).toHaveLength(2);
    expect(backgroundDiagnostics.map(({ details }) => details?.background)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tag: "section" }),
        expect.objectContaining({ tag: "section::before" }),
      ]),
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("rendered check blocks a visible payload that re-enters after document navigation", async () => {
  test.setTimeout(120_000);
  const root = await realpath(await mkdtemp(join(tmpdir(), "drever-motion-owner-check-e2e-")));
  try {
    await writeFile(
      join(root, "slides.mdx"),
      `<style>{\`
  :root {
    --drever-motion-duration: 120ms;
    --drever-motion-slide-offset: 0%;
  }
  [data-drever-slide][data-slide-state="active"] .post-transition-entrance {
    animation: post-transition-entrance 180ms ease 280ms forwards;
  }
  [data-drever-slide][data-slide-state="active"] .sequenced-entrance {
    animation: post-transition-entrance 180ms ease 280ms both;
  }
  @keyframes post-transition-entrance {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: none; }
  }
\`}</style>

# Source state

The document transition owns this handoff.

---

<section className="post-transition-entrance">

# Destination payload

This payload is visible in the native snapshot, then starts another entrance.

</section>

<p className="sequenced-entrance">This payload stays hidden until its deliberate entrance.</p>
`,
    );

    const failure = await runFailingCheck(root, "--rendered", "--json");
    const report = parseReport(failure.stdout) as CheckReport &
      Readonly<{ rendered: Readonly<{ rulesetVersion: number; stateCount: number }> }>;
    const diagnostics = report.diagnostics.filter(
      ({ code }) => code === "DREVER_RENDER_POST_TRANSITION_ENTRANCE",
    );

    expect(report.rendered, JSON.stringify(report, null, 2)).toMatchObject({
      rulesetVersion: 6,
      stateCount: 2,
    });
    expect(diagnostics, JSON.stringify(report, null, 2)).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      severity: "error",
      details: {
        animation: {
          entranceProperties: expect.arrayContaining(["opacity", "transform"]),
          name: "post-transition-entrance",
        },
        edge: {
          direction: "forward",
          from: { route: "/", slideIndex: 0, step: 0 },
          to: { route: "/2", slideIndex: 1, step: 0 },
        },
        route: "/2",
        sampledAtMilliseconds: 80,
      },
    });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
