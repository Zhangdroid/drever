import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Plugin, ViteDevServer, WebSocketClient } from "vite";
import {
  CURRENT_POSITION_EVENT,
  createCurrentPositionPlugin,
  currentPositionDirectory,
  formatCurrentPositionHuman,
  formatCurrentPositionJson,
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
  it("keeps generated position files outside the Vite watch graph", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-current-position-test-"));
    directories.push(root);
    const plugin = createCurrentPositionPlugin({ root, sourcePath: join(root, "slides.mdx") });
    const config = plugin.config;
    if (typeof config !== "function") {
      throw new TypeError("The current-position plugin is missing its config hook.");
    }

    expect(config.call({} as never, {} as never, {} as never)).toEqual({
      server: {
        watch: {
          ignored: [`${currentPositionDirectory(root).replaceAll("\\", "/")}/**`],
        },
      },
    });
  });

  it("tracks the latest open client and removes session state on shutdown", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-current-position-test-"));
    const outsideRoot = await mkdtemp(join(tmpdir(), "drever-current-position-outside-"));
    directories.push(root, outsideRoot);
    const detailPath = join(root, "fragments", "detail.mdx");
    const outsidePath = join(outsideRoot, "outside.mdx");
    const linkedPath = join(root, "linked.mdx");
    await mkdir(join(root, "fragments"), { recursive: true });
    await Promise.all([
      writeFile(detailPath, "Current claim.\n"),
      writeFile(outsidePath, "Outside project.\n"),
    ]);
    await symlink(outsidePath, linkedPath);
    const realDetailPath = await realpath(detailPath);
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
        selection: {
          sourceRange: {
            path: detailPath,
            start: { line: 8, column: 3, offset: 72 },
            end: { line: 8, column: 17, offset: 86 },
          },
          tag: "strong",
          text: "Current claim",
        },
        surface: "audience",
      },
      firstClient,
    );

    await vi.waitFor(async () => {
      await expect(readCurrentPosition(root)).resolves.toMatchObject({
        position: { slideId: "slide-2", slideIndex: 1, step: 3 },
        route: "/2/3?review=true",
        selection: {
          sourceRange: {
            path: realDetailPath,
            start: { line: 8, column: 3, offset: 72 },
            end: { line: 8, column: 17, offset: 86 },
          },
          tag: "strong",
          text: "Current claim",
        },
        sourcePath: join(root, "slides.mdx"),
        surface: "audience",
        version: 2,
      });
    });
    session.publish(
      {
        position: { slideId: "slide-2", slideIndex: 1, step: 3 },
        route: "/invalid-selection",
        selection: {
          sourceRange: {
            path: "/forged/path.mdx",
            start: { line: 8, column: 3, offset: 86 },
            end: { line: 8, column: 17, offset: 72 },
          },
          tag: "strong",
          text: "Backwards range",
        },
        surface: "audience",
      },
      firstClient,
    );
    await expect(readCurrentPosition(root)).resolves.toMatchObject({
      route: "/2/3?review=true",
      selection: { text: "Current claim" },
    });

    session.publish(
      {
        position: { slideId: "slide-2", slideIndex: 1, step: 3 },
        route: "/outside-selection",
        selection: {
          sourceRange: {
            path: outsidePath,
            start: { line: 8, column: 3, offset: 72 },
            end: { line: 8, column: 17, offset: 86 },
          },
          tag: "strong",
          text: "Outside project",
        },
        surface: "audience",
      },
      firstClient,
    );
    await vi.waitFor(async () => {
      const current = await readCurrentPosition(root);
      expect(current.route).toBe("/outside-selection");
      expect(current.selection).toBeUndefined();
    });

    session.publish(
      {
        position: { slideId: "slide-2", slideIndex: 1, step: 3 },
        route: "/symlink-selection",
        selection: {
          sourceRange: {
            path: linkedPath,
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 17, offset: 16 },
          },
          tag: "p",
          text: "Symlink escape",
        },
        surface: "audience",
      },
      firstClient,
    );
    await vi.waitFor(async () => {
      const current = await readCurrentPosition(root);
      expect(current.route).toBe("/symlink-selection");
      expect(current.selection).toBeUndefined();
    });

    session.publish(
      {
        position: { slideId: "slide-2", slideIndex: 1, step: 3 },
        route: "/2/3?review=true",
        surface: "audience",
      },
      firstClient,
    );
    await vi.waitFor(async () => {
      const current = await readCurrentPosition(root);
      expect(current.route).toBe("/2/3?review=true");
      expect(current.selection).toBeUndefined();
    });

    const directory = currentPositionDirectory(root);
    const [sessionFile] = await readdir(directory);
    if (sessionFile === undefined) {
      throw new TypeError("The current-position session file was not created.");
    }
    expect(await readFile(join(directory, sessionFile), "utf8")).toMatch(/^\{\n  "version": 2,/u);
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

  it("revalidates a cached selection against the real project boundary", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-current-position-test-"));
    const outsideRoot = await mkdtemp(join(tmpdir(), "drever-current-position-outside-"));
    directories.push(root, outsideRoot);
    const outsidePath = join(outsideRoot, "outside.mdx");
    const linkedPath = join(root, "linked.mdx");
    await writeFile(outsidePath, "Outside project.\n");
    await symlink(outsidePath, linkedPath);
    const directory = currentPositionDirectory(root);
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "forged.json"),
      JSON.stringify({
        version: 2,
        sourcePath: join(root, "slides.mdx"),
        surface: "audience",
        route: "/2",
        position: { slideId: "slide-2", slideIndex: 1, step: 0 },
        selection: {
          sourceRange: {
            path: linkedPath,
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 17, offset: 16 },
          },
          tag: "p",
          text: "Forged cached selection",
        },
        updatedAt: Date.now(),
      }),
    );

    await expect(readCurrentPosition(root)).resolves.toMatchObject({
      route: "/2",
      sourcePath: join(root, "slides.mdx"),
    });
    expect((await readCurrentPosition(root)).selection).toBeUndefined();
  });

  it("formats a compact human position without hiding the exact route", () => {
    expect(
      formatCurrentPositionHuman({
        position: { slideId: "slide-4", slideIndex: 3, step: 2 },
        route: "/4/2",
        sourcePath: "/project/slides.mdx",
        surface: "speaker",
        version: 2,
      }),
    ).toBe("Current Drever position: slide 4, Step 2 (speaker) at /4/2.\n");
  });

  it("formats the optional selected element in exact current-position v2 JSON", () => {
    const current = {
      position: { slideId: "slide-4", slideIndex: 3, step: 2 },
      route: "/4/2",
      selection: {
        sourceRange: {
          path: "/project/slides.mdx",
          start: { line: 18, column: 3, offset: 220 },
          end: { line: 18, column: 19, offset: 236 },
        },
        tag: "p",
        text: "Selected premise",
      },
      sourcePath: "/project/slides.mdx",
      surface: "audience",
      version: 2,
    } as const;

    expect(JSON.parse(formatCurrentPositionJson(current))).toEqual(current);
  });
});
