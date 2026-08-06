import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { DreverCurrentPosition } from "@drever/schema";
import { waitForDreverReady } from "./support/drever-ready.ts";
import { monitorPageHealth } from "./support/page-health.ts";

const demoRoot = fileURLToPath(new URL("./fixtures/core-deck/", import.meta.url));
const cli = fileURLToPath(new URL("../packages/cli/dist/bin.mjs", import.meta.url));
const execute = promisify(execFile);

const readCurrentPosition = async (): Promise<DreverCurrentPosition | undefined> => {
  try {
    const { stdout } = await execute(process.execPath, [cli, "current", "--json"], {
      cwd: demoRoot,
    });
    return JSON.parse(stdout) as DreverCurrentPosition;
  } catch {
    return;
  }
};

test("drever dev exposes the live audience and speaker position to local agents", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const health = monitorPageHealth(page);

  await page.goto("/2/2?theme=dark#notes");
  await waitForDreverReady(page);
  await expect.poll(readCurrentPosition).toMatchObject({
    position: { slideId: "slide-2", slideIndex: 1, step: 2 },
    route: "/2/2?theme=dark#notes",
    sourcePath: `${demoRoot}slides.mdx`,
    surface: "audience",
    version: 2,
  } satisfies DreverCurrentPosition);

  await page.evaluate(() => history.replaceState(null, "", "/2/2?review=true#current"));
  await expect(page).toHaveURL(/\/2\/2\?review=true#current$/u);
  await expect.poll(readCurrentPosition).toMatchObject({
    position: { slideId: "slide-2", slideIndex: 1, step: 2 },
    route: "/2/2?review=true#current",
    surface: "audience",
  });

  await page.goto("/speaker/3");
  await waitForDreverReady(page);
  await expect.poll(readCurrentPosition).toMatchObject({
    position: { slideId: "slide-3", slideIndex: 2, step: 0 },
    route: "/speaker/3",
    surface: "speaker",
  });

  await page.goto("/document");
  await waitForDreverReady(page);
  await expect
    .poll(async () => {
      const current = await readCurrentPosition();
      return (
        current?.position.slideId === "slide-3" &&
        current.position.slideIndex === 2 &&
        current.position.step === 0 &&
        current.route === "/speaker/3" &&
        current.surface === "speaker"
      );
    })
    .toBe(false);

  health.expectHealthy();
});
