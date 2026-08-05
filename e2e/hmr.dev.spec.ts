import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { waitForDreverReady } from "./support/drever-ready.ts";
import { monitorPageHealth } from "./support/page-health.ts";

const cli = fileURLToPath(new URL("../packages/cli/dist/bin.mjs", import.meta.url));
const url = "http://127.0.0.1:4327";

const themeSource = (canvas: string): string => `export default {
  kind: "theme",
  apiVersion: 1,
  id: "hmr-theme",
  canvas: { width: 1600, height: 900 },
  tokens: {
    color: {
      canvas: "${canvas}",
      ink: "#171816",
      muted: "#62665f",
      accent: "#65efb5",
      accentStrong: "#1538a8",
      accentSoft: "#dce5ff",
      surface: "#ffffff",
      border: "#d9dcd4",
      codeCanvas: "#171a22",
      codeInk: "#f5f6f8",
    },
    typography: {
      display: "ui-sans-serif, system-ui, sans-serif",
      body: "ui-sans-serif, system-ui, sans-serif",
      mono: "ui-monospace, monospace",
      titleSize: 76,
      bodySize: 28,
    },
    space: { slideX: 112, slideY: 88, rhythm: 24 },
    shape: { radius: 24, borderWidth: 2 },
    motion: { duration: 380, easing: "ease" },
  },
  styles: [{ specifier: new URL("./theme.css", import.meta.url).href, layer: "theme" }],
  manifest: { title: "HMR theme", summary: "A local config-reload fixture." },
};
`;

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

test("drever dev preserves state for content updates and reloads resolved project config", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90_000);
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

## Stable title

<p data-testid="hmr-copy">Version one</p>

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
        { message: "Drever dev did not start.", timeout: 20_000 },
      )
      .toBe(200);

    const health = monitorPageHealth(page);
    await page.goto(`${url}/2/2`);
    await waitForDreverReady(page);
    await expect(page.getByTestId("hmr-copy")).toHaveText("Version one");
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

## Stable title

<p data-testid="hmr-copy">Version two</p>

<Step at={2}>The URL and Step must survive.</Step>

<Counter />
`,
    );

    await expect(page.getByTestId("hmr-copy")).toHaveText("Version two");
    await expect(page).toHaveURL(`${url}/2/2`);
    expect(await page.evaluate(() => Reflect.get(window, "__dreverHmrToken"))).toBe(token);
    await expect(page.getByTestId("hmr-counter")).toHaveText("1");

    const reload = page.waitForEvent("load");
    await writeFile(
      slides,
      `import { Counter } from "./Counter.tsx";

# HMR fixture

---

## Stable title

<Step at={2}>The current stop remains valid.</Step>

<Step at={4}>The new navigation stop came from the updated manifest.</Step>

<Counter />
`,
    );
    await reload;

    await expect(page.getByRole("heading", { name: "Stable title" })).toBeVisible();
    await expect(page).toHaveURL(`${url}/2/2`);
    expect(await page.evaluate(() => Reflect.get(window, "__dreverHmrToken"))).toBeUndefined();
    await expect(page.getByTestId("hmr-counter")).toHaveText("0");

    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(`${url}/2/4`);
    await expect(
      page.getByText("The new navigation stop came from the updated manifest."),
    ).toBeVisible();

    const titleReload = page.waitForEvent("load");
    await writeFile(
      slides,
      `import { Counter } from "./Counter.tsx";

# Revised HMR fixture

---

## Stable title

<Step at={2}>The current stop remains valid.</Step>

<Step at={4}>The new navigation stop came from the updated manifest.</Step>

<Counter />
`,
    );
    await titleReload;

    await expect(page).toHaveTitle("Revised HMR fixture");
    await expect(page).toHaveURL(`${url}/2/4`);

    await mkdir(`${root}/design`, { recursive: true });
    await Promise.all([
      writeFile(
        `${root}/design/theme.css`,
        `.drever-viewer {
  --drever-canvas-background: #050914;
  --drever-stage-background: #050914;
}
`,
      ),
      writeFile(`${root}/design/theme.ts`, themeSource("#050914")),
      writeFile(
        `${root}/StageBackground.tsx`,
        `export default function StageBackground() {
  return <div data-testid="hmr-stage-background" style={{ background: "#050914", inset: 0, position: "absolute" }} />;
}
`,
      ),
    ]);

    await writeFile(
      `${root}/drever.config.ts`,
      `import theme from "./design/theme.ts";

export default {
  server: { host: "127.0.0.1", port: 4327, strictPort: true },
  stage: { background: "./StageBackground.tsx" },
  theme,
};
`,
    );
    await expect
      .poll(
        () =>
          page
            .locator(".drever-viewer")
            .evaluate((element) =>
              getComputedStyle(element).getPropertyValue("--drever-canvas-background").trim(),
            ),
        { timeout: 20_000 },
      )
      .toBe("#050914");
    await waitForDreverReady(page);
    await expect(page).toHaveURL(`${url}/2/4`);
    await expect(page.getByTestId("hmr-stage-background")).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator(".drever-canvas")
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue("--drever-theme-token-canvas").trim(),
          ),
      )
      .toBe("#050914");
    await expect
      .poll(() => output.join("").match(/Drever configuration reloaded\./gu)?.length)
      .toBe(1);

    await writeFile(
      `${root}/design/theme.css`,
      `.drever-viewer {
  --drever-canvas-background: #081a2f;
  --drever-stage-background: #081a2f;
}
`,
    );
    await expect
      .poll(() =>
        page
          .locator(".drever-viewer")
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue("--drever-canvas-background").trim(),
          ),
      )
      .toBe("#081a2f");

    await writeFile(`${root}/design/theme.ts`, themeSource("#081a2f"));
    await expect
      .poll(
        () =>
          page
            .locator(".drever-canvas")
            .evaluate((element) =>
              getComputedStyle(element).getPropertyValue("--drever-theme-token-canvas").trim(),
            ),
        { timeout: 20_000 },
      )
      .toBe("#081a2f");
    await expect
      .poll(() => output.join("").match(/Drever configuration reloaded\./gu)?.length)
      .toBe(2);
    await waitForDreverReady(page);

    await writeFile(
      `${root}/StageForeground.tsx`,
      `export default function StageForeground() {
  return <div data-testid="hmr-stage-foreground" style={{ inset: 0, pointerEvents: "none", position: "absolute" }} />;
}
`,
    );

    await writeFile(
      `${root}/drever.config.ts`,
      `import theme from "./design/theme.ts";
import { foreground } from "./design/recovered-config.ts";

export default {
  server: { host: "127.0.0.1", port: 4327, strictPort: true },
  stage: { background: "./StageBackground.tsx", foreground },
  theme,
};
`,
    );
    await expect
      .poll(() => output.join(""), { timeout: 10_000 })
      .toContain("Drever kept the current preview because configuration reload failed");
    await expect.poll(() => request.get(url).then((response) => response.status())).toBe(200);
    await expect(page.getByTestId("hmr-stage-background")).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator(".drever-viewer")
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue("--drever-canvas-background").trim(),
          ),
      )
      .toBe("#081a2f");

    await writeFile(
      `${root}/design/recovered-config.ts`,
      'export const foreground = "./StageForeground.tsx";\n',
    );
    await expect
      .poll(() => output.join("").match(/Drever configuration reloaded\./gu)?.length, {
        timeout: 20_000,
      })
      .toBe(3);
    await waitForDreverReady(page);
    await expect(page.getByTestId("hmr-stage-foreground")).toBeVisible();
    health.expectHealthy();
  } finally {
    await stop(server);
  }
});
