import type { CanvasDefinition } from "@drever/schema";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Browser, Page } from "playwright-core";

export const RENDERED_EVIDENCE_VERSION = 1 as const;
export const RENDERED_TRANSITION_SAMPLE_MILLISECONDS = 80 as const;

const CHECK_TIMEOUT = 30_000;
const RESOURCE_SETTLE_TIMEOUT = 10_000;

export type RenderedEvidenceState = Readonly<{
  route: string;
  slideId: string;
  slideIndex: number;
  step: number;
}>;

export type RenderedSettledCapture = Readonly<{
  content: Buffer;
  state: RenderedEvidenceState;
}>;

type EvidenceFile = Readonly<{
  bytes: number;
  path: string;
  sha256: string;
}>;

type PlannedSettledEvidence = RenderedEvidenceState &
  Readonly<{
    path: string;
  }>;

type TransitionDirection = "forward" | "reverse";

type PlannedTransitionEvidence = Readonly<{
  direction: TransitionDirection;
  from: RenderedEvidenceState;
  path: string;
  sampledAtMilliseconds: typeof RENDERED_TRANSITION_SAMPLE_MILLISECONDS;
  to: RenderedEvidenceState;
}>;

type CapturedSettledEvidence = PlannedSettledEvidence &
  Readonly<{
    content: Buffer;
  }>;

type CapturedTransitionEvidence = PlannedTransitionEvidence &
  Readonly<{
    content: Buffer;
  }>;

export type RenderedEvidenceManifest = Readonly<{
  schemaVersion: typeof RENDERED_EVIDENCE_VERSION;
  browser: Readonly<{
    engine: "chromium";
    version: string;
  }>;
  canvas: CanvasDefinition;
  input: Readonly<{
    algorithm: "sha256";
    sha256: string;
    source: "inspection-build";
  }>;
  contactSheets: Readonly<{
    settled: EvidenceFile;
    transitions: EvidenceFile;
  }>;
  reviewImages: readonly string[];
  states: readonly (RenderedEvidenceState & EvidenceFile & Readonly<{ slide: number }>)[];
  transitions: readonly (EvidenceFile &
    Readonly<{
      direction: TransitionDirection;
      from: Readonly<{ route: string; slide: number; step: number }>;
      sampledAtMilliseconds: typeof RENDERED_TRANSITION_SAMPLE_MILLISECONDS;
      to: Readonly<{ route: string; slide: number; step: number }>;
    }>)[];
}>;

export type WriteRenderedEvidenceRequest = Readonly<{
  browser: Browser;
  browserVersion: string;
  canvas: CanvasDefinition;
  inputSha256: string;
  locale?: string;
  origin: string;
  output: string;
  settledCaptures: readonly RenderedSettledCapture[];
  states: readonly RenderedEvidenceState[];
}>;

export type RenderedEvidencePlan = Readonly<{
  settled: readonly PlannedSettledEvidence[];
  transitions: readonly PlannedTransitionEvidence[];
}>;

const pad = (value: number): string => String(value).padStart(2, "0");

const sameState = (first: RenderedEvidenceState, second: RenderedEvidenceState): boolean =>
  first.route === second.route &&
  first.slideId === second.slideId &&
  first.slideIndex === second.slideIndex &&
  first.step === second.step;

const statePath = ({ slideIndex, step }: RenderedEvidenceState): string =>
  `states/slide-${pad(slideIndex + 1)}-step-${pad(step)}.png`;

const transitionPath = (edge: number, direction: TransitionDirection): string =>
  `transitions/edge-${pad(edge + 1)}-${direction}.png`;

/** @internal Creates stable filenames and both directions for every adjacent authored state. */
export const createRenderedEvidencePlan = (
  states: readonly RenderedEvidenceState[],
): RenderedEvidencePlan => {
  if (states.length === 0) {
    throw new TypeError("Rendered visual evidence requires at least one authored state.");
  }
  const settled = states.map((state) => ({ ...state, path: statePath(state) }));
  const transitions = states.slice(0, -1).flatMap((from, edge) => {
    const to = states[edge + 1] as RenderedEvidenceState;
    return [
      {
        direction: "forward" as const,
        from,
        path: transitionPath(edge, "forward"),
        sampledAtMilliseconds: RENDERED_TRANSITION_SAMPLE_MILLISECONDS,
        to,
      },
      {
        direction: "reverse" as const,
        from: to,
        path: transitionPath(edge, "reverse"),
        sampledAtMilliseconds: RENDERED_TRANSITION_SAMPLE_MILLISECONDS,
        to: from,
      },
    ];
  });
  return Object.freeze({
    settled: Object.freeze(settled),
    transitions: Object.freeze(transitions),
  });
};

const evidenceFile = (path: string, content: Buffer): EvidenceFile =>
  Object.freeze({
    bytes: content.length,
    path,
    sha256: createHash("sha256").update(content).digest("hex"),
  });

const manifestState = ({ content, path, ...state }: CapturedSettledEvidence) =>
  Object.freeze({ ...state, slide: state.slideIndex + 1, ...evidenceFile(path, content) });

const manifestPosition = ({ route, slideIndex, step }: RenderedEvidenceState) =>
  Object.freeze({ route, slide: slideIndex + 1, step });

const manifestTransition = ({
  content,
  direction,
  from,
  path,
  sampledAtMilliseconds,
  to,
}: CapturedTransitionEvidence) =>
  Object.freeze({
    direction,
    from: manifestPosition(from),
    sampledAtMilliseconds,
    to: manifestPosition(to),
    ...evidenceFile(path, content),
  });

type CreateRenderedEvidenceManifestRequest = Readonly<{
  browserVersion: string;
  canvas: CanvasDefinition;
  inputSha256: string;
  settled: readonly CapturedSettledEvidence[];
  settledContactSheet: Buffer;
  transitions: readonly CapturedTransitionEvidence[];
  transitionContactSheet: Buffer;
}>;

/** @internal Builds the versioned allowlist consumed by visual-review agents. */
export const createRenderedEvidenceManifest = ({
  browserVersion,
  canvas,
  inputSha256,
  settled,
  settledContactSheet,
  transitions,
  transitionContactSheet,
}: CreateRenderedEvidenceManifestRequest): RenderedEvidenceManifest => {
  const settledSheet = evidenceFile("settled-contact-sheet.png", settledContactSheet);
  const transitionSheet = evidenceFile("transition-contact-sheet.png", transitionContactSheet);
  const states = settled.map(manifestState);
  const transitionRecords = transitions.map(manifestTransition);
  return Object.freeze({
    schemaVersion: RENDERED_EVIDENCE_VERSION,
    browser: Object.freeze({ engine: "chromium", version: browserVersion }),
    canvas: Object.freeze({ ...canvas }),
    input: Object.freeze({
      algorithm: "sha256",
      sha256: inputSha256,
      source: "inspection-build",
    }),
    contactSheets: Object.freeze({ settled: settledSheet, transitions: transitionSheet }),
    reviewImages: Object.freeze([
      settledSheet.path,
      transitionSheet.path,
      ...states.map(({ path }) => path),
      ...transitionRecords.map(({ path }) => path),
    ]),
    states: Object.freeze(states),
    transitions: Object.freeze(transitionRecords),
  });
};

const regularFiles = async (root: string, directory = root): Promise<readonly string[]> => {
  const paths: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new TypeError(`Rendered evidence cannot fingerprint symbolic build output: ${path}`);
    }
    if (entry.isDirectory()) {
      paths.push(...(await regularFiles(root, path)));
    } else if (entry.isFile()) {
      paths.push(relative(root, path).split("\\").join("/"));
    }
  }
  return paths.toSorted();
};

/** Hashes the exact inspection build so evidence freshness can be checked mechanically. */
export const hashRenderedEvidenceInput = async (directory: string): Promise<string> => {
  const hash = createHash("sha256");
  for (const path of await regularFiles(directory)) {
    const content = await readFile(join(directory, path));
    hash.update(`${String(Buffer.byteLength(path))}:`);
    hash.update(path);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }
  return hash.digest("hex");
};

/** Removes the previous trust root before a new evidence run can fail or replace it. */
export const invalidateRenderedEvidence = async (output: string): Promise<void> => {
  await Promise.all([
    rm(join(output, "manifest.json"), { force: true }),
    rm(join(output, "manifest.json.next"), { force: true }),
  ]);
};

const withTimeout = async <Value>(
  operation: Promise<Value>,
  timeout: number,
  message: string,
): Promise<Value> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TypeError(message)), timeout);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

const stateUrl = (origin: string, route: string): URL =>
  new URL(route === "/" ? "" : `${route.slice(1).replace(/\/+$/u, "")}/`, origin);

const settleResources = async (page: Page): Promise<void> => {
  await page.locator("#drever-root[data-drever-ready]").waitFor({
    state: "attached",
    timeout: CHECK_TIMEOUT,
  });
  await withTimeout(
    page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map(async (image) => {
          if (!image.complete) {
            await new Promise<void>((resolve) => {
              image.addEventListener("error", () => resolve(), { once: true });
              image.addEventListener("load", () => resolve(), { once: true });
            });
          }
          await image.decode().catch(() => undefined);
        }),
      );
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    }),
    RESOURCE_SETTLE_TIMEOUT,
    `Rendered resources did not settle within ${String(RESOURCE_SETTLE_TIMEOUT)}ms.`,
  );
};

const finishFiniteAnimations = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getTiming().iterations === Infinity) continue;
      try {
        animation.finish();
      } catch {
        // A browser-owned animation can stop between enumeration and finish.
      }
    }
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
};

const captureTransition = async (
  page: Page,
  origin: string,
  transition: PlannedTransitionEvidence,
): Promise<CapturedTransitionEvidence> => {
  const source = stateUrl(origin, transition.from.route);
  const response = await page.goto(source.href, { timeout: CHECK_TIMEOUT, waitUntil: "load" });
  if (response === null || !response.ok()) {
    throw new TypeError(
      `Rendered route ${transition.from.route} did not return a successful response.`,
    );
  }
  await settleResources(page);
  await finishFiniteAnimations(page);
  const navigated = page.waitForFunction(
    (route) => {
      const path = window.location.pathname.replace(/\/+$/u, "") || "/";
      return path === route;
    },
    transition.to.route,
    { timeout: CHECK_TIMEOUT },
  );
  await page.keyboard.press(transition.direction === "forward" ? "ArrowRight" : "ArrowLeft");
  try {
    await navigated;
  } catch (cause) {
    throw new TypeError(
      `Rendered ${transition.direction} transition ${transition.from.route} → ${transition.to.route} did not navigate within ${String(CHECK_TIMEOUT)}ms.`,
      { cause },
    );
  }
  await page.waitForTimeout(transition.sampledAtMilliseconds);
  const content = await page.screenshot({ caret: "hide", type: "png" });
  return Object.freeze({ ...transition, content });
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

type ContactSheetCapture = Readonly<{
  content: Buffer;
  label: string;
}>;

const renderContactSheet = async (
  browser: Browser,
  canvas: CanvasDefinition,
  captures: readonly ContactSheetCapture[],
  columns: number,
): Promise<Buffer> => {
  const page = await browser.newPage({ viewport: { height: 900, width: 1_600 } });
  try {
    const figures = captures
      .map(
        ({ content, label }) => `<figure>
  <img alt="${escapeHtml(label)}" src="data:image/png;base64,${content.toString("base64")}" />
  <figcaption>${escapeHtml(label)}</figcaption>
</figure>`,
      )
      .join("\n");
    await page.setContent(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; background: #101014; color: #f4f2ed; }
      body { font: 600 18px/1.3 ui-sans-serif, system-ui, sans-serif; padding: 32px; }
      main { display: grid; grid-template-columns: repeat(${String(columns)}, minmax(0, 1fr)); gap: 28px 24px; }
      figure { margin: 0; min-width: 0; }
      img { display: block; width: 100%; aspect-ratio: ${String(canvas.width)} / ${String(canvas.height)}; object-fit: contain; background: #050507; border: 1px solid #393941; }
      figcaption { padding-top: 10px; color: #cbc8d2; letter-spacing: 0.01em; }
    </style>
  </head>
  <body><main>${figures}</main></body>
</html>`);
    await page.waitForFunction(() => [...document.images].every((image) => image.complete));
    return await page.screenshot({ caret: "hide", fullPage: true, type: "png" });
  } finally {
    await page.close();
  }
};

const settledLabel = ({ route, slideIndex, step }: RenderedEvidenceState): string =>
  `Slide ${String(slideIndex + 1)} · Step ${String(step)} · ${route}`;

const transitionLabel = ({
  direction,
  from,
  sampledAtMilliseconds,
  to,
}: PlannedTransitionEvidence): string =>
  `${direction} · ${from.route} → ${to.route} · ${String(sampledAtMilliseconds)} ms`;

/** Writes a deterministic, manifest-owned visual review set from the rendered inspection app. */
export const writeRenderedEvidence = async ({
  browser,
  browserVersion,
  canvas,
  inputSha256,
  locale,
  origin,
  output,
  settledCaptures,
  states,
}: WriteRenderedEvidenceRequest): Promise<RenderedEvidenceManifest> => {
  await invalidateRenderedEvidence(output);
  const plan = createRenderedEvidencePlan(states);
  if (
    settledCaptures.length !== plan.settled.length ||
    settledCaptures.some(
      (capture, index) => !sameState(capture.state, plan.settled[index] as RenderedEvidenceState),
    )
  ) {
    throw new TypeError("Settled visual captures do not match the authored rendered states.");
  }
  const settled = plan.settled.map((state, index) => ({
    ...state,
    content: (settledCaptures[index] as RenderedSettledCapture).content,
  }));
  await Promise.all([
    mkdir(join(output, "states"), { recursive: true }),
    mkdir(join(output, "transitions"), { recursive: true }),
  ]);
  await Promise.all(settled.map(({ content, path }) => writeFile(join(output, path), content)));

  const transitions = await (async (): Promise<readonly CapturedTransitionEvidence[]> => {
    const context = await browser.newContext({
      deviceScaleFactor: 1,
      ...(locale === undefined ? {} : { locale }),
      reducedMotion: "no-preference",
      serviceWorkers: "block",
      timezoneId: "UTC",
      viewport: { height: canvas.height, width: canvas.width },
    });
    try {
      const page = await context.newPage();
      const captures: CapturedTransitionEvidence[] = [];
      for (const transition of plan.transitions) {
        captures.push(await captureTransition(page, origin, transition));
      }
      return Object.freeze(captures);
    } finally {
      await context.close();
    }
  })();
  await Promise.all(transitions.map(({ content, path }) => writeFile(join(output, path), content)));

  const [settledContactSheet, transitionContactSheet] = await Promise.all([
    renderContactSheet(
      browser,
      canvas,
      settled.map(({ content, ...state }) => ({ content, label: settledLabel(state) })),
      2,
    ),
    renderContactSheet(
      browser,
      canvas,
      transitions.map(({ content, ...transition }) => ({
        content,
        label: transitionLabel(transition),
      })),
      3,
    ),
  ]);
  await Promise.all([
    writeFile(join(output, "settled-contact-sheet.png"), settledContactSheet),
    writeFile(join(output, "transition-contact-sheet.png"), transitionContactSheet),
  ]);
  const manifest = createRenderedEvidenceManifest({
    browserVersion,
    canvas,
    inputSha256,
    settled,
    settledContactSheet,
    transitions,
    transitionContactSheet,
  });
  const manifestPath = join(output, "manifest.json");
  const nextManifestPath = join(output, "manifest.json.next");
  try {
    await writeFile(nextManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await rename(nextManifestPath, manifestPath);
  } finally {
    await rm(nextManifestPath, { force: true });
  }
  return manifest;
};
