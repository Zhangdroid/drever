import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { DreverCliError } from "./errors.ts";

type PlaywrightCoreManifest = Readonly<{
  bin?: string | Readonly<Record<string, string>>;
}>;

export type BrowserInstallRequest = Readonly<{
  withDeps: boolean;
}>;

type InstallBrowserOptions = BrowserInstallRequest &
  Readonly<{
    nodeExecutable?: string;
    readManifest?: (path: string) => Promise<PlaywrightCoreManifest>;
    resolveManifest?: () => string;
    runInstaller?: (executable: string, arguments_: readonly string[]) => Promise<void>;
  }>;

const resolvePlaywrightCoreManifest = (): string =>
  createRequire(import.meta.url).resolve("playwright-core/package.json");

const readPlaywrightCoreManifest = async (path: string): Promise<PlaywrightCoreManifest> =>
  JSON.parse(await readFile(path, "utf8")) as PlaywrightCoreManifest;

const playwrightCli = (manifestPath: string, manifest: PlaywrightCoreManifest): string => {
  const bin =
    typeof manifest.bin === "string"
      ? manifest.bin
      : (manifest.bin?.["playwright-core"] ?? manifest.bin?.playwright);
  if (bin === undefined || bin.length === 0) {
    throw new TypeError("The installed playwright-core package does not declare a CLI.");
  }
  return resolve(dirname(manifestPath), bin);
};

const runPlaywrightInstaller = async (
  executable: string,
  arguments_: readonly string[],
): Promise<void> => {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(executable, arguments_, { stdio: "inherit" });
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(
        new Error(
          signal === null
            ? `The Playwright browser installer exited with code ${String(code)}.`
            : `The Playwright browser installer exited after ${signal}.`,
        ),
      );
    });
  });
};

/** Installs the Chromium revision required by Drever's exact Playwright Core dependency. */
export const installBrowser = async ({
  nodeExecutable = process.execPath,
  readManifest = readPlaywrightCoreManifest,
  resolveManifest = resolvePlaywrightCoreManifest,
  runInstaller = runPlaywrightInstaller,
  withDeps,
}: InstallBrowserOptions): Promise<void> => {
  try {
    const manifestPath = resolveManifest();
    const cli = playwrightCli(manifestPath, await readManifest(manifestPath));
    await runInstaller(nodeExecutable, [
      cli,
      "install",
      ...(withDeps ? ["--with-deps"] : []),
      "--no-shell",
      "chromium",
    ]);
  } catch (cause) {
    throw new DreverCliError(
      "DREVER_BROWSER_INSTALL_FAILED",
      "Drever could not install Playwright Chromium.",
      {
        cause,
        hint: "Fix the reported installer error, then run drever browser install again.",
      },
    );
  }
};
