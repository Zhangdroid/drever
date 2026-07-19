import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Plugin, ViteDevServer, WebSocketClient } from "vite";
import {
  CURRENT_POSITION_EVENT,
  createCurrentPositionPlugin,
  currentPositionDirectory,
  formatCurrentPositionHuman,
  readCurrentPosition,
} from "./current-position.ts";

const directories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

const startSession = async (root: string) => {
  let receive: ((value: unknown, client: WebSocketClient) => void) | undefined;
  const logger = { error: vi.fn() };
  const server = {
    config: { logger },
    ws: {
      on(event: string, callback: (value: unknown, client: WebSocketClient) => void) {
        expect(event).toBe(CURRENT_POSITION_EVENT);
        receive = callback;
      },
    },
  } as unknown as ViteDevServer;
  const plugin = createCurrentPositionPlugin({ root, sourcePath: join(root, "slides.mdx") });
  const configureServer = plugin.configureServer;
  if (typeof configureServer !== "function") {
    throw new TypeError("The current-position plugin is missing its server hook.");
  }
  await configureServer.call({} as never, server);

  return {
    logger,
    plugin,
    publish(value: unknown, client: WebSocketClient) {
      if (receive === undefined) {
        throw new TypeError("The current-position listener was not registered.");
      }
      receive(value, client);
    },
  };
};

const closeSession = async (plugin: Plugin): Promise<void> => {
  const closeBundle = plugin.closeBundle;
  if (typeof closeBundle !== "function") {
    throw new TypeError("The current-position plugin is missing its cleanup hook.");
  }
  await closeBundle.call({} as never);
};

describe("live current position", () => {
  it("tracks the latest open client and removes session state on shutdown", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-current-position-test-"));
    directories.push(root);
    const session = await startSession(root);

    let closeFirst: (() => void) | undefined;
    const firstClient = {
      socket: {
        once(event: string, callback: () => void) {
          expect(event).toBe("close");
          closeFirst = callback;
        },
      },
    } as unknown as WebSocketClient;
    session.publish({ position: { slideId: "slide-2", slideIndex: 1, step: 3 } }, firstClient);
    session.publish(
      {
        position: { slideId: "slide-2", slideIndex: 1, step: 3 },
        route: "/2/3?review=true",
        surface: "audience",
      },
      firstClient,
    );

    await vi.waitFor(async () => {
      await expect(readCurrentPosition(root)).resolves.toMatchObject({
        position: { slideId: "slide-2", slideIndex: 1, step: 3 },
        route: "/2/3?review=true",
        sourcePath: join(root, "slides.mdx"),
        surface: "audience",
        version: 1,
      });
    });
    const directory = currentPositionDirectory(root);
    const [sessionFile] = await readdir(directory);
    if (sessionFile === undefined) {
      throw new TypeError("The current-position session file was not created.");
    }
    expect(await readFile(join(directory, sessionFile), "utf8")).toMatch(/^\{\n  "version": 1,/u);
    expect(session.logger.error).not.toHaveBeenCalled();

    let closeSecond: (() => void) | undefined;
    const secondClient = {
      socket: {
        once(_event: string, callback: () => void) {
          closeSecond = callback;
        },
      },
    } as unknown as WebSocketClient;
    session.publish(
      {
        position: { slideId: "slide-4", slideIndex: 3, step: 0 },
        route: "/speaker/4",
        surface: "speaker",
      },
      secondClient,
    );
    await vi.waitFor(async () => {
      await expect(readCurrentPosition(root)).resolves.toMatchObject({ route: "/speaker/4" });
    });

    closeSecond?.();
    await vi.waitFor(async () => {
      await expect(readCurrentPosition(root)).resolves.toMatchObject({
        route: "/2/3?review=true",
      });
    });

    closeFirst?.();
    await vi.waitFor(async () => {
      await expect(readdir(directory)).resolves.toEqual([]);
    });

    const finalClient = {
      socket: { once: vi.fn() },
    } as unknown as WebSocketClient;
    session.publish(
      {
        position: { slideId: "slide-1", slideIndex: 0, step: 0 },
        route: "/",
        surface: "audience",
      },
      finalClient,
    );
    await vi.waitFor(async () => {
      await expect(readCurrentPosition(root)).resolves.toMatchObject({ route: "/" });
    });

    await closeSession(session.plugin);
    await expect(readdir(directory)).resolves.toEqual([]);
    session.publish(
      {
        position: { slideId: "slide-5", slideIndex: 4, step: 0 },
        route: "/5",
        surface: "audience",
      },
      finalClient,
    );
    await expect(readdir(directory)).resolves.toEqual([]);
  });

  it("keeps concurrent dev-server sessions independent", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-current-position-test-"));
    directories.push(root);
    const first = await startSession(root);
    const second = await startSession(root);
    const firstClient = { socket: { once: vi.fn() } } as unknown as WebSocketClient;
    const secondClient = { socket: { once: vi.fn() } } as unknown as WebSocketClient;

    first.publish(
      {
        position: { slideId: "slide-1", slideIndex: 0, step: 0 },
        route: "/",
        surface: "audience",
      },
      firstClient,
    );
    await vi.waitFor(async () => {
      await expect(readCurrentPosition(root)).resolves.toMatchObject({ route: "/" });
    });
    second.publish(
      {
        position: { slideId: "slide-3", slideIndex: 2, step: 0 },
        route: "/speaker/3",
        surface: "speaker",
      },
      secondClient,
    );
    await vi.waitFor(async () => {
      await expect(readCurrentPosition(root)).resolves.toMatchObject({ route: "/speaker/3" });
    });

    let closeLatest: (() => void) | undefined;
    const latestFirstClient = {
      socket: {
        once(_event: string, callback: () => void) {
          closeLatest = callback;
        },
      },
    } as unknown as WebSocketClient;
    first.publish(
      {
        position: { slideId: "slide-4", slideIndex: 3, step: 0 },
        route: "/4",
        surface: "audience",
      },
      latestFirstClient,
    );
    await vi.waitFor(async () => {
      await expect(readCurrentPosition(root)).resolves.toMatchObject({ route: "/4" });
    });

    closeLatest?.();
    await vi.waitFor(async () => {
      await expect(readCurrentPosition(root)).resolves.toMatchObject({ route: "/speaker/3" });
    });

    await closeSession(second.plugin);
    await expect(readCurrentPosition(root)).resolves.toMatchObject({ route: "/" });
    await closeSession(first.plugin);
    await expect(readCurrentPosition(root)).rejects.toMatchObject({
      code: "DREVER_CURRENT_POSITION_UNAVAILABLE",
    });
  });

  it("reports a missing session with an actionable structured error", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-current-position-test-"));
    directories.push(root);

    await expect(readCurrentPosition(root)).rejects.toMatchObject({
      code: "DREVER_CURRENT_POSITION_UNAVAILABLE",
      details: { path: currentPositionDirectory(root) },
      hint: expect.stringContaining("drever dev"),
    });
  });

  it("formats a compact human position without hiding the exact route", () => {
    expect(
      formatCurrentPositionHuman({
        position: { slideId: "slide-4", slideIndex: 3, step: 2 },
        route: "/4/2",
        sourcePath: "/project/slides.mdx",
        surface: "speaker",
        version: 1,
      }),
    ).toBe("Current Drever position: slide 4, Step 2 (speaker) at /4/2.\n");
  });
});
