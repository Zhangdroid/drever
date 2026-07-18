import type { JsonObject } from "@drever/schema";
import type { Awaitable } from "./build-module.ts";

export type RuntimePluginContext = Readonly<{
  id: string;
  version?: string;
  config: JsonObject;
}>;

export type RuntimeHookContext<Runtime = unknown> = Readonly<{
  plugin: RuntimePluginContext;
  runtime: Runtime;
}>;

/** Releases resources acquired by a runtime lifecycle hook. */
export type RuntimeDisposer = () => Awaitable<void>;

export type RuntimeSetupHook<Runtime = unknown> = (
  context: RuntimeHookContext<Runtime>,
) => Awaitable<void | RuntimeDisposer>;

export type ExportSetupHook<Runtime = unknown> = RuntimeSetupHook<Runtime>;
