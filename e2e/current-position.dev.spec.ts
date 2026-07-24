import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { DreverCurrentPosition } from "@drever/schema";
import { monitorPageHealth } from "./support/page-health.ts";

const demoRoot = fileURLToPath(new URL("../examples/basic/", import.meta.url));
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
  const health = monitorPageHealth(page);

  await page.goto("/2/2?theme=dark#notes");
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
  await expect.poll(readCurrentPosition).toMatchObject({
    position: { slideId: "slide-3", slideIndex: 2, step: 0 },
    route: "/speaker/3",
    surface: "speaker",
  });

  await page.goto("/document");
  await expect.poll(readCurrentPosition).toBeUndefined();

  health.expectHealthy();
});
