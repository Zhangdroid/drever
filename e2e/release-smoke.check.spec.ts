import { expect, test } from "@playwright/test";

type TextElement = Readonly<{
  decorative: boolean;
  key: string;
  label: string;
  rect: Readonly<{ height: number; width: number; x: number; y: number }>;
  tag: string;
}>;

type ReleaseSmokeFrame = Readonly<{
  textElements: readonly TextElement[];
}>;

// @ts-expect-error Release automation is executed directly as ESM and has no declaration output.
const browserAudit = (await import("../scripts/release-smoke/browser-audit.mjs")) as Readonly<{
  captureReleaseSmokeFrame: () => ReleaseSmokeFrame;
  releaseSmokeTextSafeAreaIssues: (frame: ReleaseSmokeFrame) => readonly Readonly<{
    key: string;
    sides: readonly string[];
    type: string;
  }>[];
}>;

test("release smoke finds required custom-component text at the canvas edge", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1600 });
  await page.setContent(`<!doctype html>
<html>
  <head>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <main
      data-current-step="0"
      data-drever-slide
      data-slide-id="slide-1"
      data-slide-index="0"
      data-slide-state="active"
      style="position: relative; width: 1600px; height: 900px"
    >
      <div style="position: absolute; left: 8px; top: 120px">
        <span>Required custom-component label</span>
      </div>
      <div
        data-drever-visual-role="decoration"
        style="position: absolute; right: 0; top: 220px"
      >
        <span>Decorative edge label</span>
      </div>
      <p style="position: absolute; left: 24px; top: 320px; margin: 0">
        Semantic copy at the accepted threshold
      </p>
    </main>
  </body>
</html>`);

  const frame = await page.evaluate(browserAudit.captureReleaseSmokeFrame);
  expect(frame.textElements).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        decorative: false,
        label: "Required custom-component label",
        tag: "span",
      }),
      expect.objectContaining({
        decorative: true,
        label: "Decorative edge label",
        tag: "span",
      }),
    ]),
  );

  expect(browserAudit.releaseSmokeTextSafeAreaIssues(frame)).toMatchObject([
    {
      key: expect.any(String),
      sides: ["inline-start"],
      type: "text-safe-area",
    },
  ]);
});
