import {
  DREVER_CURRENT_POSITION_VERSION,
  type DreverCurrentPosition,
  type DreverCurrentSurface,
} from "@drever/schema";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import type { Plugin, ViteDevServer, WebSocketClient } from "vite";
import { DreverCliError } from "./errors.ts";

export const CURRENT_POSITION_EVENT = "drever:current-position";

type PublishedCurrentPosition = Readonly<{
  position: DreverCurrentPosition["position"];
  route: string;
  surface: DreverCurrentSurface;
}>;

type ActiveClientPosition = Readonly<{
  current: DreverCurrentPosition;
  revision: number;
  updatedAt: number;
}>;

type StoredCurrentPosition = Readonly<{
  current: DreverCurrentPosition;
  updatedAt: number;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isSurface = (value: unknown): value is DreverCurrentSurface =>
  value === "audience" || value === "speaker";

const decodePublishedPosition = (value: unknown): PublishedCurrentPosition | undefined => {
  if (!isRecord(value) || !isRecord(value.position)) return;
  const { position } = value;
  if (
    typeof position.slideId !== "string" ||
    position.slideId.length === 0 ||
    !isNonNegativeInteger(position.slideIndex) ||
    !isNonNegativeInteger(position.step) ||
    typeof value.route !== "string" ||
    !value.route.startsWith("/") ||
    !isSurface(value.surface)
  ) {
    return;
  }
  return Object.freeze({
    position: Object.freeze({
      slideId: position.slideId,
      slideIndex: position.slideIndex,
      step: position.step,
    }),
    route: value.route,
    surface: value.surface,
  });
};

const decodeCurrentPosition = (value: unknown): DreverCurrentPosition | undefined => {
  if (!isRecord(value) || value.version !== DREVER_CURRENT_POSITION_VERSION) return;
  const published = decodePublishedPosition(value);
  if (
    published === undefined ||
    typeof value.sourcePath !== "string" ||
    value.sourcePath.length === 0
  ) {
    return;
  }
  return Object.freeze({
    version: DREVER_CURRENT_POSITION_VERSION,
    sourcePath: value.sourcePath,
    ...published,
  });
};

const decodeStoredPosition = (value: unknown): StoredCurrentPosition | undefined => {
  if (!isRecord(value) || !isNonNegativeNumber(value.updatedAt)) return;
  const current = decodeCurrentPosition(value);
  return current === undefined ? undefined : { current, updatedAt: value.updatedAt };
};

export const currentPositionDirectory = (root: string): string =>
  join(root, ".drever", "cache", "current");

const invalidCurrentPosition = (path: string, cause?: unknown): DreverCliError =>
  new DreverCliError(
    "DREVER_CURRENT_POSITION_UNAVAILABLE",
    "Drever could not read a live presentation position.",
    {
      ...(cause === undefined ? {} : { cause }),
      details: { path },
      hint: "Start drever dev and open the audience or speaker view, then run the command again.",
    },
  );

export const readCurrentPosition = async (root: string): Promise<DreverCurrentPosition> => {
  const directory = currentPositionDirectory(root);
  let candidates: readonly (StoredCurrentPosition | undefined)[];
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    candidates = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry): Promise<StoredCurrentPosition | undefined> => {
          try {
            const value: unknown = JSON.parse(await readFile(join(directory, entry.name), "utf8"));
            return decodeStoredPosition(value);
          } catch (cause) {
            if ((cause as NodeJS.ErrnoException).code === "ENOENT") return;
            throw cause;
          }
        }),
    );
  } catch (cause) {
    throw invalidCurrentPosition(directory, cause);
  }
  const latest = candidates.reduce<StoredCurrentPosition | undefined>(
    (selected, candidate) =>
      candidate !== undefined &&
      (selected === undefined || candidate.updatedAt > selected.updatedAt)
        ? candidate
        : selected,
    undefined,
  );
  if (latest === undefined) {
    throw invalidCurrentPosition(directory);
  }
  return latest.current;
};

export const formatCurrentPositionJson = (current: DreverCurrentPosition): string =>
  `${JSON.stringify(current, null, 2)}\n`;

export const formatCurrentPositionHuman = (current: DreverCurrentPosition): string =>
  `Current Drever position: slide ${current.position.slideIndex + 1}, Step ${current.position.step} (${current.surface}) at ${current.route}.\n`;

const persistCurrentPosition = async (
  path: string,
  current: DreverCurrentPosition,
  updatedAt: number,
): Promise<void> => {
  const temporaryPath = `${path}.next`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify({ ...current, updatedAt }, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
};

export type WriteCurrentPositionRequest = Readonly<{
  json: boolean;
  root: string;
  stdout: Pick<NodeJS.WriteStream, "write">;
}>;

export const writeCurrentPosition = async ({
  json,
  root,
  stdout,
}: WriteCurrentPositionRequest): Promise<DreverCurrentPosition> => {
  const current = await readCurrentPosition(root);
  stdout.write(json ? formatCurrentPositionJson(current) : formatCurrentPositionHuman(current));
  return current;
};

export type CurrentPositionPluginOptions = Readonly<{
  root: string;
  sourcePath: string;
}>;

/** Publishes the last live audience or speaker position for local agent workflows. */
export const createCurrentPositionPlugin = ({
  root,
  sourcePath,
}: CurrentPositionPluginOptions): Plugin => {
  const path = join(currentPositionDirectory(root), `${randomUUID()}.json`);
  const clients = new Map<WebSocketClient, ActiveClientPosition>();
  let writes = Promise.resolve();
  let revision = 0;
  let closing = false;

  return {
    apply: "serve",
    name: "drever:current-position",
    configureServer(server: ViteDevServer) {
      const enqueue = (operation: () => Promise<void>): void => {
        writes = writes.then(operation).catch((error: unknown) => {
          server.config.logger.error(`Drever could not update ${path}: ${String(error)}`);
        });
      };
      const publish = ({ current, updatedAt }: ActiveClientPosition): void => {
        enqueue(() => persistCurrentPosition(path, current, updatedAt));
      };
      const closeClient = (client: WebSocketClient): void => {
        if (closing || !clients.delete(client)) return;
        const latest = [...clients.values()].reduce<ActiveClientPosition | undefined>(
          (selected, candidate) =>
            selected === undefined || candidate.revision > selected.revision ? candidate : selected,
          undefined,
        );
        if (latest === undefined) {
          enqueue(() => rm(path, { force: true }));
        } else {
          publish(latest);
        }
      };

      server.ws.on(CURRENT_POSITION_EVENT, (value: unknown, client: WebSocketClient) => {
        if (closing) return;
        const published = decodePublishedPosition(value);
        if (published === undefined) return;
        const current: DreverCurrentPosition = Object.freeze({
          version: DREVER_CURRENT_POSITION_VERSION,
          sourcePath,
          ...published,
        });
        if (!clients.has(client)) {
          client.socket.once("close", () => closeClient(client));
        }
        const active = {
          current,
          revision: revision++,
          updatedAt: performance.timeOrigin + performance.now(),
        };
        clients.set(client, active);
        publish(active);
      });
    },
    async closeBundle() {
      closing = true;
      await writes;
      await rm(path, { force: true });
    },
  };
};
