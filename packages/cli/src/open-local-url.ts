import { spawn, type ChildProcess } from "node:child_process";

export type LocalUrlOpenCommand = Readonly<{
  arguments: readonly string[];
  executable: string;
}>;

type LocalUrlLauncher = (
  executable: string,
  arguments_: readonly string[],
  options: Readonly<{ stdio: "ignore" }>,
) => Pick<ChildProcess, "kill" | "once">;

type LocalUrlOpenRuntime = Readonly<{
  launcher?: LocalUrlLauncher;
  platform?: NodeJS.Platform;
  timeoutMs?: number;
}>;

const localUrlOpenTimeoutMs = 5_000;

const enabledEnvironmentFlag = (value: string | undefined): boolean =>
  value !== undefined && value !== "" && value !== "0" && value.toLowerCase() !== "false";

/** @internal Resolves the platform-native browser launcher without invoking a shell. */
export const resolveLocalUrlOpenCommand = (
  url: string,
  platform: NodeJS.Platform = process.platform,
): LocalUrlOpenCommand | undefined => {
  if (platform === "darwin") return Object.freeze({ arguments: [url], executable: "open" });
  if (platform === "win32") {
    return Object.freeze({
      arguments: ["url.dll,FileProtocolHandler", url],
      executable: "rundll32.exe",
    });
  }
  if (platform === "linux") {
    return Object.freeze({ arguments: [url], executable: "xdg-open" });
  }
  return undefined;
};

/** @internal Keeps explicit browser opening inert in CI and headless Linux sessions. */
export const canOpenLocalUrl = (
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): boolean => {
  if (
    enabledEnvironmentFlag(environment.CI) ||
    enabledEnvironmentFlag(environment.DREVER_DISABLE_OPEN) ||
    environment.BROWSER === "none"
  ) {
    return false;
  }
  return (
    platform !== "linux" ||
    environment.DISPLAY !== undefined ||
    environment.WAYLAND_DISPLAY !== undefined
  );
};

/** @internal Opens a generated loopback URL in the user's default browser when the host allows it. */
export const openLocalUrl = async (
  url: string,
  environment: NodeJS.ProcessEnv = process.env,
  runtime: LocalUrlOpenRuntime = {},
): Promise<boolean> => {
  const platform = runtime.platform ?? process.platform;
  if (!canOpenLocalUrl(environment, platform)) return false;
  const command = resolveLocalUrlOpenCommand(url, platform);
  if (command === undefined) return false;

  return new Promise((resolve) => {
    let child: Pick<ChildProcess, "kill" | "once">;
    try {
      child = (runtime.launcher ?? spawn)(command.executable, command.arguments, {
        stdio: "ignore",
      });
    } catch {
      resolve(false);
      return;
    }

    let settled = false;
    let timeout: NodeJS.Timeout | undefined;
    const finish = (opened: boolean): void => {
      if (settled) return;
      settled = true;
      if (timeout !== undefined) clearTimeout(timeout);
      resolve(opened);
    };

    child.once("error", () => finish(false));
    child.once("close", (code) => finish(code === 0));
    timeout = setTimeout(() => {
      finish(false);
      child.kill();
    }, runtime.timeoutMs ?? localUrlOpenTimeoutMs);
  });
};
