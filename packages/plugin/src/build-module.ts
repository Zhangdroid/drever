import type { JsonObject, JsonValue, PluginBuildPhase } from "@drever/schema";
import type { Pluggable } from "unified";
import type { PluginOption } from "vite";

export const DREVER_BUILD_API_VERSION = 1 as const;

export type BuildCapability = "recma" | "rehype" | "remark" | "vite";

export type Awaitable<Value> = PromiseLike<Value> | Value;

export type BuildPluginContext<Capability extends BuildCapability> = Readonly<{
  capability: Capability;
  phase: PluginBuildPhase;
  /** Absolute root of the deck project, independent from an adapter's generated app root. */
  projectRoot: string;
  plugin: Readonly<{
    id: string;
    version?: string;
  }>;
  pluginConfig: JsonObject;
  hookOptions: JsonValue | undefined;
}>;

export type BuildModule<Capability extends BuildCapability, Output> = Readonly<{
  kind: "drever-build-plugin";
  apiVersion: typeof DREVER_BUILD_API_VERSION;
  capability: Capability;
  create(context: BuildPluginContext<Capability>): Awaitable<Output>;
}>;

export type RemarkBuildModule = BuildModule<"remark", Pluggable>;
export type RehypeBuildModule = BuildModule<"rehype", Pluggable>;
export type RecmaBuildModule = BuildModule<"recma", Pluggable>;
export type ViteBuildModule = BuildModule<"vite", PluginOption>;

const defineBuildModule = <Capability extends BuildCapability, Output>(
  capability: Capability,
  create: BuildModule<Capability, Output>["create"],
): BuildModule<Capability, Output> =>
  Object.freeze({
    kind: "drever-build-plugin",
    apiVersion: DREVER_BUILD_API_VERSION,
    capability,
    create,
  });

export const defineRemarkPlugin = (create: RemarkBuildModule["create"]): RemarkBuildModule =>
  defineBuildModule("remark", create);

export const defineRehypePlugin = (create: RehypeBuildModule["create"]): RehypeBuildModule =>
  defineBuildModule("rehype", create);

export const defineRecmaPlugin = (create: RecmaBuildModule["create"]): RecmaBuildModule =>
  defineBuildModule("recma", create);

export const defineVitePlugin = (create: ViteBuildModule["create"]): ViteBuildModule =>
  defineBuildModule("vite", create);
