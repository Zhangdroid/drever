import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  createRenderedEvidenceManifest,
  createRenderedEvidencePlan,
  hashRenderedEvidenceInput,
  invalidateRenderedEvidence,
  RENDERED_TRANSITION_SAMPLE_MILLISECONDS,
  type RenderedEvidenceState,
} from "./rendered-evidence.ts";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

const states = Object.freeze([
  { route: "/", slideId: "opening", slideIndex: 0, step: 0 },
  { route: "/1/3", slideId: "opening", slideIndex: 0, step: 3 },
  { route: "/2", slideId: "result", slideIndex: 1, step: 0 },
] satisfies readonly RenderedEvidenceState[]);

describe("rendered visual evidence", () => {
  it("plans every exact state and both directions of each adjacent edge", () => {
    const plan = createRenderedEvidencePlan(states);

    expect(plan.settled.map(({ path }) => path)).toEqual([
      "states/slide-01-step-00.png",
      "states/slide-01-step-03.png",
      "states/slide-02-step-00.png",
    ]);
    expect(plan.transitions).toEqual([
      {
        direction: "forward",
        from: states[0],
        path: "transitions/edge-01-forward.png",
        sampledAtMilliseconds: RENDERED_TRANSITION_SAMPLE_MILLISECONDS,
        to: states[1],
      },
      {
        direction: "reverse",
        from: states[1],
        path: "transitions/edge-01-reverse.png",
        sampledAtMilliseconds: RENDERED_TRANSITION_SAMPLE_MILLISECONDS,
        to: states[0],
      },
      {
        direction: "forward",
        from: states[1],
        path: "transitions/edge-02-forward.png",
        sampledAtMilliseconds: RENDERED_TRANSITION_SAMPLE_MILLISECONDS,
        to: states[2],
      },
      {
        direction: "reverse",
        from: states[2],
        path: "transitions/edge-02-reverse.png",
        sampledAtMilliseconds: RENDERED_TRANSITION_SAMPLE_MILLISECONDS,
        to: states[1],
      },
    ]);
  });

  it("creates a versioned, hashed manifest that is the complete review-image allowlist", () => {
    const plan = createRenderedEvidencePlan(states);
    const settled = plan.settled.map((state, index) => ({
      ...state,
      content: Buffer.from(index === 0 ? "slide-one" : `settled-${String(index)}`),
    }));
    const transitions = plan.transitions.map((transition) => ({
      ...transition,
      content: Buffer.from("transition"),
    }));
    const manifest = createRenderedEvidenceManifest({
      browserVersion: "140.0.7339.0",
      canvas: { height: 900, width: 1_600 },
      inputSha256: "f".repeat(64),
      settled,
      settledContactSheet: Buffer.from("settled-sheet"),
      transitions,
      transitionContactSheet: Buffer.from("transition-sheet"),
    });

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      browser: { engine: "chromium", version: "140.0.7339.0" },
      canvas: { height: 900, width: 1_600 },
      input: {
        algorithm: "sha256",
        sha256: "f".repeat(64),
        source: "inspection-build",
      },
      contactSheets: {
        settled: {
          bytes: 13,
          path: "settled-contact-sheet.png",
          sha256: "628bea94309058aa1dab00fe5694cfca51ed1ecea4feb10023b3b369ea62786d",
        },
        transitions: {
          bytes: 16,
          path: "transition-contact-sheet.png",
          sha256: "0b3c5abffa213bccc185164b55180ca72d3542bdc975605ba4f7685f10c82a29",
        },
      },
    });
    expect(manifest.states[0]).toEqual({
      route: "/",
      slide: 1,
      slideId: "opening",
      slideIndex: 0,
      step: 0,
      bytes: 9,
      path: "states/slide-01-step-00.png",
      sha256: "d60b335f1c25de40f5869a75d20bd198fc6d659fa26be11e19ea97d34bb551d8",
    });
    expect(manifest.transitions[0]).toEqual({
      direction: "forward",
      from: { route: "/", slide: 1, step: 0 },
      sampledAtMilliseconds: 80,
      to: { route: "/1/3", slide: 1, step: 3 },
      bytes: 10,
      path: "transitions/edge-01-forward.png",
      sha256: "70dd37c11434d9c571dd83fdd5450e5b0471f7f5ed52943e9409574fea364d33",
    });
    expect(manifest.reviewImages).toEqual([
      "settled-contact-sheet.png",
      "transition-contact-sheet.png",
      ...plan.settled.map(({ path }) => path),
      ...plan.transitions.map(({ path }) => path),
    ]);
  });

  it("refuses to plan an empty visual review", () => {
    expect(() => createRenderedEvidencePlan([])).toThrow(
      "Rendered visual evidence requires at least one authored state.",
    );
  });

  it("fingerprints exact build paths and bytes in stable order", async () => {
    const first = await mkdtemp(join(tmpdir(), "drever-evidence-input-"));
    const second = await mkdtemp(join(tmpdir(), "drever-evidence-input-"));
    directories.push(first, second);
    await Promise.all([mkdir(join(first, "assets")), mkdir(join(second, "assets"))]);
    await Promise.all([
      writeFile(join(first, "index.html"), "<main>Ready</main>"),
      writeFile(join(first, "assets", "deck.js"), "export default 1"),
      writeFile(join(second, "assets", "deck.js"), "export default 1"),
      writeFile(join(second, "index.html"), "<main>Ready</main>"),
    ]);

    const original = await hashRenderedEvidenceInput(first);
    expect(await hashRenderedEvidenceInput(second)).toBe(original);

    await writeFile(join(second, "assets", "deck.js"), "export default 2");
    expect(await hashRenderedEvidenceInput(second)).not.toBe(original);
  });

  it("invalidates an old manifest before replacement artifacts are trusted", async () => {
    const output = await mkdtemp(join(tmpdir(), "drever-evidence-output-"));
    directories.push(output);
    await Promise.all([
      writeFile(join(output, "manifest.json"), '{"schemaVersion":1}\n'),
      writeFile(join(output, "manifest.json.next"), "partial"),
      writeFile(join(output, "settled-contact-sheet.png"), "old image"),
    ]);

    await invalidateRenderedEvidence(output);

    await expect(readFile(join(output, "manifest.json"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(output, "manifest.json.next"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(join(output, "settled-contact-sheet.png"), "utf8")).resolves.toBe(
      "old image",
    );
  });
});
