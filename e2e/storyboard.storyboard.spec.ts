import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const workspaceRoot = join(import.meta.dirname, "..");
const dreverCli = join(workspaceRoot, "packages", "cli", "dist", "bin.mjs");

const availablePort = async (): Promise<number> => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new TypeError("The storyboard test could not reserve a local port.");
  }
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
};

const plan = (title: string) => ({
  version: 2,
  status: "awaiting-approval",
  brief: {
    topic: "Why black holes are not cosmic vacuum cleaners",
    audience: "Curious high-school students",
    desiredChange: "Replace a familiar myth with a useful mental model",
    durationMinutes: 12,
    language: "en",
    density: "concise",
  },
  slides: [
    {
      id: "the-myth",
      job: "opening",
      title,
      purpose: "Name the misconception before replacing it.",
      evidence: ["Gravity depends on mass and distance."],
      focalArtifact: "A Sun-to-black-hole orbit comparison",
    },
  ],
});

const stop = async (process: ChildProcess): Promise<void> => {
  if (process.exitCode !== null) return;
  process.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 100));
};

const waitForServer = async (url: string, process: ChildProcess): Promise<void> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (process.exitCode !== null)
      throw new Error("The Drever dev server exited before listening.");
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The local listener is not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("The Drever dev server did not become ready within five seconds.");
};

test("storyboard stays live before the authored deck can compile", async ({ page }) => {
  const root = await mkdtemp(join(tmpdir(), "drever-storyboard-e2e-"));
  const planPath = join(root, "drever.plan.json");
  const port = await availablePort();
  await writeFile(
    join(root, "drever.config.ts"),
    `export default { deck: { lang: "en" }, server: { host: "127.0.0.1", port: ${String(port)}, strictPort: true } };\n`,
    "utf8",
  );

  const server = spawn(process.execPath, [dreverCli, "dev"], {
    cwd: root,
    env: { ...process.env, FORCE_COLOR: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  server.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  server.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  try {
    const storyboardUrl = `http://127.0.0.1:${String(port)}/storyboard`;
    await waitForServer(storyboardUrl, server);
    await page.goto(storyboardUrl);
    const storyboard = page.locator("[data-drever-storyboard]");
    await expect(storyboard).toHaveAttribute("data-storyboard-state", "missing");

    await writeFile(planPath, JSON.stringify(plan("A black hole is not a vacuum cleaner")), "utf8");
    await expect(storyboard).toHaveAttribute("data-storyboard-state", "ready");
    await expect(page.locator('[data-storyboard-slide="the-myth"]')).toContainText(
      "A black hole is not a vacuum cleaner",
    );
    expect(requests.some((url) => url.includes("slides.mdx"))).toBe(false);
    expect(requests.some((url) => url.includes("presentation.js"))).toBe(false);
    expect(requests.some((url) => url.includes("virtual:drever/runtime"))).toBe(false);

    await page.evaluate(() => {
      Object.assign(globalThis, { __dreverStoryboardDidNotReload: true });
    });
    await writeFile(planPath, '{"version":2,"status":', "utf8");
    await expect(storyboard).toHaveAttribute("data-storyboard-state", "invalid");
    await expect(page.locator('[data-storyboard-slide="the-myth"]')).toContainText(
      "A black hole is not a vacuum cleaner",
    );

    await writeFile(planPath, JSON.stringify(plan("Gravity without the myth")), "utf8");
    await expect(storyboard).toHaveAttribute("data-storyboard-state", "ready");
    await expect(page.locator('[data-storyboard-slide="the-myth"]')).toContainText(
      "Gravity without the myth",
    );
    await expect
      .poll(() => page.evaluate(() => Reflect.get(globalThis, "__dreverStoryboardDidNotReload")))
      .toBe(true);

    await rm(planPath);
    await expect(storyboard).toHaveAttribute("data-storyboard-state", "missing");

    await writeFile(planPath, JSON.stringify(plan("A recreated story plan")), "utf8");
    await expect(storyboard).toHaveAttribute("data-storyboard-state", "ready");
    await expect(page.locator('[data-storyboard-slide="the-myth"]')).toContainText(
      "A recreated story plan",
    );
    await expect
      .poll(() => page.evaluate(() => Reflect.get(globalThis, "__dreverStoryboardDidNotReload")))
      .toBe(true);
  } catch (error) {
    throw new Error(`Storyboard E2E failed.\n${output}`, { cause: error });
  } finally {
    await stop(server);
    await rm(root, { force: true, recursive: true });
  }
});
