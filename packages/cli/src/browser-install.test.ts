import { describe, expect, it, vi } from "vite-plus/test";
import { installBrowser } from "./browser-install.ts";

describe("browser installation", () => {
  it("runs the CLI declared by the installed Playwright Core package", async () => {
    const runInstaller = vi.fn(async () => {});

    await installBrowser({
      nodeExecutable: "/runtime/node",
      readManifest: async () => ({ bin: { "playwright-core": "cli.js" } }),
      resolveManifest: () => "/project/node_modules/playwright-core/package.json",
      runInstaller,
      withDeps: false,
    });

    expect(runInstaller).toHaveBeenCalledWith("/runtime/node", [
      "/project/node_modules/playwright-core/cli.js",
      "install",
      "--no-shell",
      "chromium",
    ]);
  });

  it("passes operating-system dependency installation through explicitly", async () => {
    const runInstaller = vi.fn(async () => {});

    await installBrowser({
      nodeExecutable: "/runtime/node",
      readManifest: async () => ({ bin: "cli.js" }),
      resolveManifest: () => "/project/node_modules/playwright-core/package.json",
      runInstaller,
      withDeps: true,
    });

    expect(runInstaller).toHaveBeenCalledWith("/runtime/node", [
      "/project/node_modules/playwright-core/cli.js",
      "install",
      "--with-deps",
      "--no-shell",
      "chromium",
    ]);
  });

  it("turns installer failures into an actionable CLI error", async () => {
    const cause = new Error("Browser download failed.");

    await expect(
      installBrowser({
        readManifest: async () => ({ bin: "cli.js" }),
        resolveManifest: () => "/project/node_modules/playwright-core/package.json",
        runInstaller: async () => {
          throw cause;
        },
        withDeps: false,
      }),
    ).rejects.toMatchObject({
      cause,
      code: "DREVER_BROWSER_INSTALL_FAILED",
      hint: "Fix the reported installer error, then run drever browser install again.",
      message: "Drever could not install Playwright Chromium.",
    });
  });
});
