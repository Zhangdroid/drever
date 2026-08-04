import type { Diagnostic, DreverDeckPlan } from "@drever/schema";
import type { StoryboardState } from "@drever/client/storyboard";
import { join } from "node:path";
import { normalizePath, type Plugin, type ViteDevServer } from "vite";
import {
  DREVER_DECK_PLAN_FILE,
  loadDreverDeckPlan,
  type LoadedDreverDeckPlan,
} from "./deck-plan.ts";

export const DREVER_STORYBOARD_PLAN_MODULE_ID = "virtual:drever/storyboard-plan";
export const DREVER_STORYBOARD_PLAN_EVENT = "drever:storyboard-plan";
export const DREVER_STORYBOARD_PLAN_REQUEST_EVENT = "drever:storyboard-plan-request";
const RESOLVED_MODULE_ID = `\0${DREVER_STORYBOARD_PLAN_MODULE_ID}`;

const publicDiagnostics = (diagnostics: readonly Diagnostic[]): readonly Diagnostic[] =>
  diagnostics.map(({ source: _source, ...diagnostic }) => Object.freeze(diagnostic));

const createState = (
  loaded: LoadedDreverDeckPlan,
  previous?: DreverDeckPlan,
): Omit<StoryboardState, "revision"> => {
  const diagnostics = publicDiagnostics(loaded.diagnostics);
  if (loaded.plan !== undefined) {
    if (loaded.plan.status === "awaiting-input") {
      return Object.freeze({ diagnostics, status: "waiting" });
    }
    return Object.freeze({ diagnostics, plan: loaded.plan, status: "ready" });
  }
  if (loaded.diagnostics.length > 0) {
    return Object.freeze({
      diagnostics,
      status: "invalid",
      ...(previous === undefined || previous.status === "awaiting-input" ? {} : { plan: previous }),
    });
  }
  return Object.freeze({ diagnostics: [], status: "missing" });
};

export type StoryboardPlanReader = Readonly<{
  read(): Promise<StoryboardState>;
}>;

/** @internal Keeps the last valid plan available across transient partial writes. */
export const createStoryboardPlanReader = (root: string): StoryboardPlanReader => {
  let lastValid: DreverDeckPlan | undefined;
  let revision = 0;
  return Object.freeze({
    async read() {
      const loaded = await loadDreverDeckPlan({ root });
      if (loaded.plan !== undefined) lastValid = loaded.plan;
      return Object.freeze({
        ...createState(loaded, lastValid),
        revision: (revision += 1),
      });
    },
  });
};

/** @internal Serves a plan-only dev surface without importing the authored MDX graph. */
export const createStoryboardPlanPlugin = ({ root }: Readonly<{ root: string }>): Plugin => {
  const reader = createStoryboardPlanReader(root);
  let state: StoryboardState | undefined;
  let server: ViteDevServer | undefined;
  const planPath = join(root, DREVER_DECK_PLAN_FILE);
  const normalizedPlanPath = normalizePath(planPath);
  let updates = Promise.resolve();
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;

  const readState = async (): Promise<StoryboardState> => {
    state = await reader.read();
    return state;
  };
  const publish = async (): Promise<void> => {
    const next = await readState();
    const module = server?.moduleGraph.getModuleById(RESOLVED_MODULE_ID);
    if (module !== undefined) server?.moduleGraph.invalidateModule(module);
    server?.ws.send({
      type: "custom",
      event: DREVER_STORYBOARD_PLAN_EVENT,
      data: next,
    });
  };

  return {
    apply: "serve",
    name: "drever:storyboard-plan",
    enforce: "pre",
    configureServer(value) {
      server = value;
      value.watcher.add(planPath);
      const update = (path: string): void => {
        if (normalizePath(path) !== normalizedPlanPath) return;
        if (refreshTimer !== undefined) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          refreshTimer = undefined;
          updates = updates.then(publish).catch((error: unknown) => {
            value.config.logger.error(
              `Drever could not refresh ${DREVER_DECK_PLAN_FILE}: ${String(error)}`,
            );
          });
        }, 40);
      };
      value.watcher.on("add", update);
      value.watcher.on("change", update);
      value.watcher.on("unlink", update);
      value.ws.on(DREVER_STORYBOARD_PLAN_REQUEST_EVENT, (_data, client) => {
        updates = updates
          .then(async () => {
            client.send({
              type: "custom",
              event: DREVER_STORYBOARD_PLAN_EVENT,
              data: await readState(),
            });
          })
          .catch((error: unknown) => {
            value.config.logger.error(
              `Drever could not read ${DREVER_DECK_PLAN_FILE}: ${String(error)}`,
            );
          });
      });
      value.httpServer?.once("close", () => {
        if (refreshTimer !== undefined) clearTimeout(refreshTimer);
        value.watcher.off("add", update);
        value.watcher.off("change", update);
        value.watcher.off("unlink", update);
      });
    },
    resolveId(source) {
      if (source === DREVER_STORYBOARD_PLAN_MODULE_ID) return RESOLVED_MODULE_ID;
    },
    async load(id) {
      if (id !== RESOLVED_MODULE_ID) return;
      const initial = state ?? (await readState());
      return `export const storyboardPlan = ${JSON.stringify(initial)};\n`;
    },
  };
};
