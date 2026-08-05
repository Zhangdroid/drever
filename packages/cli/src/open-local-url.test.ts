import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { describe, expect, it, vi } from "vite-plus/test";
import { canOpenLocalUrl, openLocalUrl, resolveLocalUrlOpenCommand } from "./open-local-url.ts";

const url = "http://127.0.0.1:4317/talk/studio";

const createLauncherProcess = (): Readonly<{
  child: EventEmitter & { kill: ReturnType<typeof vi.fn> };
  launcherProcess: Pick<ChildProcess, "kill" | "once">;
}> => {
  const child = Object.assign(new EventEmitter(), { kill: vi.fn() });
  return {
    child,
    launcherProcess: child as unknown as Pick<ChildProcess, "kill" | "once">,
  };
};

describe("local URL browser launch", () => {
  it("uses platform launchers without a shell on macOS and Linux", () => {
    expect(resolveLocalUrlOpenCommand(url, "darwin")).toEqual({
      arguments: [url],
      executable: "open",
    });
    expect(resolveLocalUrlOpenCommand(url, "linux")).toEqual({
      arguments: [url],
      executable: "xdg-open",
    });
    expect(resolveLocalUrlOpenCommand(url, "aix")).toBeUndefined();
  });

  it("uses the Windows start command without interpolating the local URL", () => {
    expect(resolveLocalUrlOpenCommand(url, "win32")).toEqual({
      arguments: ["url.dll,FileProtocolHandler", url],
      executable: "rundll32.exe",
    });
  });

  it("keeps browser launch disabled in automation and headless Linux", () => {
    expect(canOpenLocalUrl({ CI: "true" }, "darwin")).toBe(false);
    expect(canOpenLocalUrl({ DREVER_DISABLE_OPEN: "1" }, "darwin")).toBe(false);
    expect(canOpenLocalUrl({ BROWSER: "none" }, "darwin")).toBe(false);
    expect(canOpenLocalUrl({}, "linux")).toBe(false);
    expect(canOpenLocalUrl({ DISPLAY: ":0" }, "linux")).toBe(true);
    expect(canOpenLocalUrl({}, "darwin")).toBe(true);
  });

  it("reports success only after the launcher hands off with a zero exit code", async () => {
    const { child, launcherProcess } = createLauncherProcess();
    const launcher = vi.fn(() => launcherProcess);
    const opening = openLocalUrl(url, {}, { launcher, platform: "darwin", timeoutMs: 100 });

    expect(launcher).toHaveBeenCalledWith("open", [url], { stdio: "ignore" });
    child.emit("close", 0);

    await expect(opening).resolves.toBe(true);
    expect(child.kill).not.toHaveBeenCalled();
  });

  it("reports launcher failures instead of treating process creation as a successful open", async () => {
    const { child: nonzeroChild, launcherProcess: nonzeroProcess } = createLauncherProcess();
    const nonzero = openLocalUrl(
      url,
      {},
      {
        launcher: () => nonzeroProcess,
        platform: "darwin",
        timeoutMs: 100,
      },
    );
    nonzeroChild.emit("close", 1);
    await expect(nonzero).resolves.toBe(false);

    const { child: errorChild, launcherProcess: errorProcess } = createLauncherProcess();
    const errored = openLocalUrl(
      url,
      {},
      {
        launcher: () => errorProcess,
        platform: "darwin",
        timeoutMs: 100,
      },
    );
    errorChild.emit("error", new Error("launcher missing"));
    await expect(errored).resolves.toBe(false);

    await expect(
      openLocalUrl(
        url,
        {},
        {
          launcher: () => {
            throw new Error("spawn failed");
          },
          platform: "darwin",
        },
      ),
    ).resolves.toBe(false);
  });

  it("bounds a launcher that never completes its browser hand-off", async () => {
    vi.useFakeTimers();
    const { child, launcherProcess } = createLauncherProcess();
    const opening = openLocalUrl(
      url,
      {},
      {
        launcher: () => launcherProcess,
        platform: "darwin",
        timeoutMs: 1_000,
      },
    );

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(opening).resolves.toBe(false);
    expect(child.kill).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
