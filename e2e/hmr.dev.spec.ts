import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { monitorPageHealth } from "./support/page-health.ts";

const cli = fileURLToPath(new URL("../packages/cli/dist/bin.mjs", import.meta.url));
const url = "http://127.0.0.1:4327";

const stop = async (child: ChildProcess): Promise<void> => {
  if (child.exitCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  const exited = new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      if (child.exitCode === null && child.signalCode === null) {
        return;
      }
      clearInterval(timer);
      resolve();
    }, 25);
    timer.unref();
  });
  await Promise.race([
    exited,
    new Promise<void>((resolve) => {
      setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 3_000).unref();
    }),
  ]);
};

test("drever dev preserves state for content updates and reloads for deck structure changes", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(45_000);
  const root = testInfo.outputPath("project");
  const slides = `${root}/slides.mdx`;
  await mkdir(root, { recursive: true });
  await Promise.all([
    writeFile(
      `${root}/drever.config.ts`,
      `export default { server: { host: "127.0.0.1", port: 4327, strictPort: true } };\n`,
    ),
    writeFile(
      `${root}/Counter.tsx`,
      `import { useState } from "react";

export const Counter = () => {
  const [count, setCount] = useState(0);
  return <button data-testid="hmr-counter" onClick={() => setCount((value) => value + 1)}>{count}</button>;
};
`,
    ),
    writeFile(
      slides,
      `import { Counter } from "./Counter.tsx";

# HMR fixture

---

## Version one

<Step at={2}>The URL and Step must survive.</Step>

<Counter />
`,
    ),
  ]);

  const output: string[] = [];
  const server = spawn(process.execPath, [cli, "dev"], {
    cwd: root,
    env: { ...process.env, FORCE_COLOR: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  server.stderr?.on("data", (chunk: Buffer) => output.push(chunk.toString()));

  try {
    await expect
      .poll(
        async () => {
          if (server.exitCode !== null) {
            throw new Error(`Drever dev exited early.\n${output.join("")}`);
          }
          try {
            return (await request.get(url)).status();
          } catch {
            return 0;
          }
        },
        { message: "Drever dev did not start." },
      )
      .toBe(200);

    const health = monitorPageHealth(page);
    await page.goto(`${url}/2/2`);
    await expect(page.getByRole("heading", { name: "Version one" })).toBeVisible();
    await page.getByTestId("hmr-counter").click();
    await expect(page.getByTestId("hmr-counter")).toHaveText("1");
    const token = crypto.randomUUID();
    await page.evaluate((value) => {
      Object.defineProperty(window, "__dreverHmrToken", { configurable: true, value });
    }, token);

    await writeFile(
      slides,
      `import { Counter } from "./Counter.tsx";

# HMR fixture

---

## Version two

<Step at={2}>The URL and Step must survive.</Step>

<Counter />
`,
    );

    await expect(page.getByRole("heading", { name: "Version two" })).toBeVisible();
    await expect(page).toHaveURL(`${url}/2/2`);
    expect(await page.evaluate(() => Reflect.get(window, "__dreverHmrToken"))).toBe(token);
    await expect(page.getByTestId("hmr-counter")).toHaveText("1");

    const reload = page.waitForEvent("load");
    await writeFile(
      slides,
      `import { Counter } from "./Counter.tsx";

# HMR fixture

---

## Version three

<Step at={2}>The current stop remains valid.</Step>

<Step at={4}>The new navigation stop came from the updated manifest.</Step>

<Counter />
`,
    );
    await reload;

    await expect(page.getByRole("heading", { name: "Version three" })).toBeVisible();
    await expect(page).toHaveURL(`${url}/2/2`);
    expect(await page.evaluate(() => Reflect.get(window, "__dreverHmrToken"))).toBeUndefined();
    await expect(page.getByTestId("hmr-counter")).toHaveText("0");

    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(`${url}/2/4`);
    await expect(
      page.getByText("The new navigation stop came from the updated manifest."),
    ).toBeVisible();
    health.expectHealthy();
  } finally {
    await stop(server);
  }
});
