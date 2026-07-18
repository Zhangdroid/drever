import type {
  CompilePlan,
  JsonValue,
  ModuleReference,
  OwnedModuleReference,
  ThemeElementName,
} from "@drever/schema";
import type { Plugin } from "vite";

export const DREVER_MDX_COMPONENTS_MODULE_ID = "virtual:drever/mdx-components";
export const DREVER_RUNTIME_MODULE_ID = "virtual:drever/runtime";
export const DREVER_EXPORT_RUNTIME_MODULE_ID = "virtual:drever/export-runtime";
export const DREVER_STYLES_MODULE_ID = "virtual:drever/styles.css";

const RESOLVED_MDX_COMPONENTS_MODULE_ID = `\0${DREVER_MDX_COMPONENTS_MODULE_ID}`;
const RESOLVED_RUNTIME_MODULE_ID = `\0${DREVER_RUNTIME_MODULE_ID}`;
const RESOLVED_EXPORT_RUNTIME_MODULE_ID = `\0${DREVER_EXPORT_RUNTIME_MODULE_ID}`;
const RESOLVED_STYLES_MODULE_ID = `\0${DREVER_STYLES_MODULE_ID}`;

type HookCapability = "exportSetup" | "setup";

type ModuleBinding = Readonly<{
  exportName: string;
  local: string;
  namespace: string;
  specifier: string;
}>;

type HookBinding = Readonly<{
  binding: ModuleBinding;
  capability: HookCapability;
  pluginId: string;
}>;

const importModule = (
  reference: ModuleReference,
  index: number,
  imports: string[],
): ModuleBinding => {
  const namespace = `__drever_module_${index}`;
  const local = `__drever_value_${index}`;
  const exportName = reference.exportName ?? "default";
  imports.push(`import * as ${namespace} from ${JSON.stringify(reference.specifier)};`);
  return { exportName, local, namespace, specifier: reference.specifier };
};

const selectionSource = (
  binding: ModuleBinding,
  selector = "__dreverSelect",
  hook?: Readonly<{ capability: HookCapability; owner: string }>,
): string =>
  `const ${binding.local} = ${selector}(${binding.namespace}, ${JSON.stringify(binding.exportName)}, ${JSON.stringify(binding.specifier)}${hook === undefined ? "" : `, ${JSON.stringify(hook.capability)}, ${JSON.stringify(hook.owner)}`});`;

const objectSource = (entries: readonly (readonly [string, string])[]): string =>
  `{${entries.map(([name, local]) => `${JSON.stringify(name)}:${local}`).join(",")}}`;

const jsonSnapshotSource = (value: JsonValue): string =>
  `__dreverParseJSON(${JSON.stringify(JSON.stringify(value))})`;

const selectPrelude = [
  "const __dreverSelect = (namespace, name, specifier) => {",
  "  if (!Object.hasOwn(namespace, name)) {",
  '    throw new DreverRuntimeError("DREVER_RUNTIME_MODULE_EXPORT_MISSING", `Module "${specifier}" does not export "${name}".`, { exportName: name, specifier });',
  "  }",
  "  return namespace[name];",
  "};",
].join("\n");

const runtimePrelude = [
  selectPrelude,
  "const __dreverDeepFreeze = (value) => {",
  '  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {',
  "    return value;",
  "  }",
  "  for (const key of Reflect.ownKeys(value)) {",
  "    __dreverDeepFreeze(value[key]);",
  "  }",
  "  return Object.freeze(value);",
  "};",
  "const __dreverParseJSON = (source) => __dreverDeepFreeze(JSON.parse(source));",
  "class DreverRuntimeLifecycleError extends Error {",
  "  constructor(code, message, contribution, cause, rollbackErrors = []) {",
  "    super(message, { cause });",
  '    this.name = "DreverRuntimeLifecycleError";',
  "    this.code = code;",
  "    this.owner = contribution.owner;",
  "    this.capability = contribution.capability;",
  "    this.specifier = contribution.specifier;",
  '    this.stage = contribution.capability === "exportSetup" ? "export" : "runtime";',
  "    this.details = Object.freeze({ owner: contribution.owner, capability: contribution.capability, specifier: contribution.specifier, stage: this.stage });",
  "    this.rollbackErrors = Object.freeze([...rollbackErrors]);",
  "  }",
  "}",
  "const __dreverSelectHook = (namespace, name, specifier, capability, owner) => {",
  "  const contribution = { owner, capability, specifier };",
  "  if (!Object.hasOwn(namespace, name)) {",
  '    const cause = new TypeError(`Module "${specifier}" does not export "${name}".`);',
  '    throw new DreverRuntimeLifecycleError("DREVER_RUNTIME_HOOK_EXPORT_MISSING", cause.message, contribution, cause);',
  "  }",
  "  const hook = namespace[name];",
  '  if (typeof hook !== "function") {',
  '    const cause = new TypeError(`The ${capability} export "${name}" from "${specifier}" must be a function.`);',
  '    throw new DreverRuntimeLifecycleError("DREVER_RUNTIME_HOOK_INVALID", cause.message, contribution, cause);',
  "  }",
  "  return hook;",
  "};",
  'const __dreverAbortReason = (signal) => signal.reason ?? new DOMException("Drever runtime setup was aborted.", "AbortError");',
  'const __dreverIsSignalAbort = (cause, signal) => signal.aborted && (cause === signal.reason || (cause !== null && typeof cause === "object" && cause.name === "AbortError"));',
  "const __dreverDisposeHooks = async (disposers) => {",
  "  const errors = [];",
  "  for (let index = disposers.length - 1; index >= 0; index -= 1) {",
  "    const contribution = disposers[index];",
  "    try {",
  "      await contribution.dispose();",
  "    } catch (cause) {",
  '      errors.push(new DreverRuntimeLifecycleError("DREVER_RUNTIME_DISPOSE_FAILED", `The ${contribution.capability} disposer from "${contribution.specifier}" failed.`, contribution, cause));',
  "    }",
  "  }",
  "  return errors;",
  "};",
  "const __dreverCombineDisposalErrors = (errors) => {",
  "  if (errors.length === 0) {",
  "    return undefined;",
  "  }",
  "  const [first, ...suppressed] = errors;",
  "  if (suppressed.length > 0) {",
  '    Object.defineProperty(first, "suppressedErrors", { value: Object.freeze(suppressed), enumerable: true });',
  "  }",
  "  return first;",
  "};",
  "const __dreverThrowDisposalErrors = (errors) => {",
  "  const error = __dreverCombineDisposalErrors(errors);",
  "  if (error !== undefined) {",
  "    throw error;",
  "  }",
  "};",
  "const __dreverReport = (runtime, error) => {",
  '  const report = typeof runtime.reportError === "function" ? runtime.reportError : globalThis.reportError;',
  '  if (typeof report !== "function") {',
  "    return;",
  "  }",
  "  try {",
  "    report(error);",
  "  } catch (cause) {",
  '    if (report !== globalThis.reportError && typeof globalThis.reportError === "function") {',
  "      globalThis.reportError(cause);",
  "    }",
  "  }",
  "};",
  "const __dreverReportDisposalErrors = (runtime, errors) => {",
  "  const error = __dreverCombineDisposalErrors(errors);",
  "  if (error !== undefined) {",
  "    __dreverReport(runtime, error);",
  "  }",
  "};",
  'const __dreverHookFailure = (contribution, cause, rollbackErrors = []) => new DreverRuntimeLifecycleError("DREVER_RUNTIME_HOOK_FAILED", `The ${contribution.capability} hook from "${contribution.specifier}" failed.`, contribution, cause, rollbackErrors);',
  "const __dreverValidateDisposer = (dispose, contribution) => {",
  '  if (dispose !== undefined && typeof dispose !== "function") {',
  '    throw new TypeError(`The ${contribution.capability} hook from "${contribution.specifier}" returned an invalid disposer.`);',
  "  }",
  "  return dispose;",
  "};",
  "const __dreverRaceHook = async (acquisition, signal) => {",
  "  if (signal === undefined) {",
  '    return acquisition.then((value) => ({ kind: "value", value }), (cause) => ({ kind: "failure", cause }));',
  "  }",
  "  if (signal.aborted) {",
  '    return { kind: "aborted" };',
  "  }",
  "  let onAbort;",
  "  const aborted = new Promise((resolve) => {",
  '    onAbort = () => resolve({ kind: "aborted" });',
  '    signal.addEventListener("abort", onAbort, { once: true });',
  "    if (signal.aborted) {",
  "      onAbort();",
  "    }",
  "  });",
  "  try {",
  "    return await Promise.race([",
  '      acquisition.then((value) => ({ kind: "value", value }), (cause) => ({ kind: "failure", cause })),',
  "      aborted,",
  "    ]);",
  "  } finally {",
  '    signal.removeEventListener("abort", onAbort);',
  "  }",
  "};",
  "const __dreverReleaseLateHook = (acquisition, contribution, runtime, signal) => {",
  "  void acquisition.then(async (value) => {",
  "    let dispose;",
  "    try {",
  "      dispose = __dreverValidateDisposer(value, contribution);",
  "    } catch (cause) {",
  "      __dreverReport(runtime, __dreverHookFailure(contribution, cause));",
  "      return;",
  "    }",
  "    if (dispose === undefined) {",
  "      return;",
  "    }",
  "    try {",
  "      await dispose();",
  "    } catch (cause) {",
  '      __dreverReport(runtime, new DreverRuntimeLifecycleError("DREVER_RUNTIME_DISPOSE_FAILED", `The ${contribution.capability} disposer from "${contribution.specifier}" failed.`, contribution, cause));',
  "    }",
  "  }, (cause) => {",
  "    if (!__dreverIsSignalAbort(cause, signal)) {",
  "      __dreverReport(runtime, __dreverHookFailure(contribution, cause));",
  "    }",
  "  });",
  "};",
  "const __dreverCancelHooks = async (runtime, signal, disposers) => {",
  "  const rollbackErrors = await __dreverDisposeHooks(disposers);",
  "  __dreverReportDisposalErrors(runtime, rollbackErrors);",
  "  throw __dreverAbortReason(signal);",
  "};",
  "const __dreverRunHooks = async (runtime, hooks, signal) => {",
  "  const disposers = [];",
  "  if (signal?.aborted) {",
  "    await __dreverCancelHooks(runtime, signal, disposers);",
  "  }",
  "  for (const contribution of hooks) {",
  "    if (signal?.aborted) {",
  "      await __dreverCancelHooks(runtime, signal, disposers);",
  "    }",
  "    const acquisition = Promise.resolve().then(() => {",
  "      if (signal?.aborted) {",
  "        throw __dreverAbortReason(signal);",
  "      }",
  "      return contribution.hook(__dreverCreateContext(contribution.owner, runtime));",
  "    });",
  "    const outcome = await __dreverRaceHook(acquisition, signal);",
  '    if (outcome.kind === "aborted") {',
  "      __dreverReleaseLateHook(acquisition, contribution, runtime, signal);",
  "      await __dreverCancelHooks(runtime, signal, disposers);",
  "    }",
  '    if (outcome.kind === "failure") {',
  "      if (signal !== undefined && __dreverIsSignalAbort(outcome.cause, signal)) {",
  "        await __dreverCancelHooks(runtime, signal, disposers);",
  "      }",
  "      const rollbackErrors = await __dreverDisposeHooks(disposers);",
  "      throw __dreverHookFailure(contribution, outcome.cause, rollbackErrors);",
  "    }",
  "    let dispose;",
  "    try {",
  "      dispose = __dreverValidateDisposer(outcome.value, contribution);",
  "    } catch (cause) {",
  "      const rollbackErrors = await __dreverDisposeHooks(disposers);",
  "      throw __dreverHookFailure(contribution, cause, rollbackErrors);",
  "    }",
  "    if (dispose !== undefined) {",
  "      disposers.push(Object.freeze({ ...contribution, dispose }));",
  "    }",
  "    if (signal?.aborted) {",
  "      await __dreverCancelHooks(runtime, signal, disposers);",
  "    }",
  "  }",
  "  let disposePromise;",
  "  return async () => {",
  "    disposePromise ??= (async () => {",
  "      const errors = await __dreverDisposeHooks(disposers);",
  "      __dreverThrowDisposalErrors(errors);",
  "    })();",
  "    await disposePromise;",
  "  };",
  "};",
].join("\n");

/** Generates the MDX provider. It contains only the statically planned component registry. */
export const createMDXComponentsModuleSource = (plan: CompilePlan): string => {
  const imports = ['import { createComponentRegistry, DreverRuntimeError } from "@drever/core";'];
  const selections: string[] = [];
  let importIndex = 0;

  const elements: [ThemeElementName, string][] = plan.runtime.elements.map((entry) => {
    const binding = importModule(entry.module, importIndex, imports);
    importIndex += 1;
    selections.push(selectionSource(binding));
    return [entry.name, binding.local];
  });
  const layouts: [string, string][] = plan.runtime.layouts.map((entry) => {
    const binding = importModule(entry.module, importIndex, imports);
    importIndex += 1;
    selections.push(selectionSource(binding));
    return [entry.name, binding.local];
  });
  const components: [string, string][] = plan.runtime.components.map((entry) => {
    const binding = importModule(entry.module, importIndex, imports);
    importIndex += 1;
    selections.push(selectionSource(binding));
    return [entry.name, binding.local];
  });

  return `${imports.join("\n")}
${selectPrelude}
${selections.join("\n")}
export const components = createComponentRegistry({
  elements: ${objectSource(elements)},
  layouts: ${objectSource(layouts)},
  components: ${objectSource(components)},
});
export const useMDXComponents = () => components;
`;
};

const themeSnapshot = (plan: CompilePlan): JsonValue => ({
  id: plan.theme.id,
  ...(plan.theme.version === undefined ? {} : { version: plan.theme.version }),
  ...(plan.theme.canvas === undefined ? {} : { canvas: plan.theme.canvas }),
  tokens: plan.theme.tokens,
  ...(plan.theme.motion === undefined
    ? {}
    : {
        motion: {
          id: plan.theme.motion.id,
          intents: plan.theme.motion.intents,
          ...(plan.theme.motion.guidance === undefined
            ? {}
            : { guidance: plan.theme.motion.guidance }),
        },
      }),
  manifest: plan.theme.manifest,
});

const pluginSnapshots = (
  plan: CompilePlan,
  entries: readonly OwnedModuleReference[],
): JsonValue => {
  const hookOwners = new Set(entries.map((entry) => entry.owner.id));
  return plan.plugins
    .filter((plugin) => hookOwners.has(plugin.id))
    .map((plugin) => ({
      plugin: {
        id: plugin.id,
        ...(plugin.version === undefined ? {} : { version: plugin.version }),
        config: plugin.config ?? {},
      },
    }));
};

const motionSnapshot = (motion: NonNullable<CompilePlan["theme"]["motion"]>): JsonValue => ({
  id: motion.id,
  intents: motion.intents,
  ...(motion.guidance === undefined ? {} : { guidance: motion.guidance }),
});

const collectHooks = (
  entries: readonly OwnedModuleReference[],
  imports: string[],
  selections: string[],
  startIndex: number,
  capability: HookCapability,
): readonly [readonly HookBinding[], number] => {
  let importIndex = startIndex;
  const hooks = entries.map((entry): HookBinding => {
    const binding = importModule(entry.module, importIndex, imports);
    importIndex += 1;
    selections.push(
      selectionSource(binding, "__dreverSelectHook", {
        capability,
        owner: entry.owner.id,
      }),
    );
    return { binding, capability, pluginId: entry.owner.id };
  });
  return [hooks, importIndex];
};

const hookRunnerSource = (
  name: "runExportSetup" | "runSetup",
  hooks: readonly HookBinding[],
): string => `const __dreverHooks = Object.freeze([${hooks
  .map(
    ({ binding, capability, pluginId }) =>
      `Object.freeze({ owner: ${JSON.stringify(pluginId)}, capability: ${JSON.stringify(capability)}, specifier: ${JSON.stringify(binding.specifier)}, hook: ${binding.local} })`,
  )
  .join(",")}]);
export const ${name} = async (runtime) => __dreverRunHooks(runtime, __dreverHooks${name === "runSetup" ? ", runtime.signal" : ""});`;

const lifecycleContextSource = (
  plan: CompilePlan,
  entries: readonly OwnedModuleReference[],
): string => `const __dreverPlugins = ${jsonSnapshotSource(pluginSnapshots(plan, entries))};
const __dreverCreateContext = (pluginId, runtime) => {
  const registration = __dreverPlugins.find(({ plugin }) => plugin.id === pluginId);
  if (registration === undefined) {
    throw new DreverRuntimeError("DREVER_RUNTIME_PLUGIN_MISSING", 'Runtime contribution owner "' + pluginId + '" is not registered.', { plugin: pluginId });
  }
  return Object.freeze({
    plugin: registration.plugin,
    runtime,
  });
};`;

/** Generates theme data and executable runtime lifecycle contributions. */
export const createRuntimeModuleSource = (plan: CompilePlan): string => {
  const imports = ['import { DreverRuntimeError } from "@drever/core";'];
  const selections: string[] = [];
  let importIndex = 0;

  let motionSource = "undefined";
  if (plan.theme.motion !== undefined) {
    const binding = importModule(plan.theme.motion.module, importIndex, imports);
    importIndex += 1;
    selections.push(selectionSource(binding));
    motionSource = `Object.freeze({ ...${jsonSnapshotSource(motionSnapshot(plan.theme.motion))}, implementation: ${binding.local} })`;
  }

  const [setupHooks] = collectHooks(plan.runtime.setup, imports, selections, importIndex, "setup");

  return `${imports.join("\n")}
${runtimePrelude}
${selections.join("\n")}
export const theme = ${jsonSnapshotSource(themeSnapshot(plan))};
export const motion = ${motionSource};
${lifecycleContextSource(plan, plan.runtime.setup)}
${hookRunnerSource("runSetup", setupHooks)}
`;
};

/** Generates the exporter-only lifecycle module without viewer setup or theme motion. */
export const createExportRuntimeModuleSource = (plan: CompilePlan): string => {
  const imports = ['import { DreverRuntimeError } from "@drever/core";'];
  const selections: string[] = [];
  const [hooks] = collectHooks(plan.runtime.exportSetup, imports, selections, 0, "exportSetup");

  return `${imports.join("\n")}
${runtimePrelude}
${selections.join("\n")}
${lifecycleContextSource(plan, plan.runtime.exportSetup)}
${hookRunnerSource("runExportSetup", hooks)}
`;
};

export const createStylesModuleSource = (plan: CompilePlan): string => {
  const layerOrder =
    "@layer drever.client, drever.theme, drever.layout, drever.component, drever.utility;";
  const imports = plan.runtime.styles.map(
    ({ style }) => `@import ${JSON.stringify(style.specifier)} layer(drever.${style.layer});`,
  );
  return `${[layerOrder, ...imports].join("\n")}\n`;
};

export const createRuntimeModulePlugin = (plan: CompilePlan): Plugin => ({
  name: "drever:runtime-modules",
  enforce: "pre",
  resolveId(id) {
    if (id === DREVER_MDX_COMPONENTS_MODULE_ID) {
      return RESOLVED_MDX_COMPONENTS_MODULE_ID;
    }
    if (id === DREVER_RUNTIME_MODULE_ID) {
      return RESOLVED_RUNTIME_MODULE_ID;
    }
    if (id === DREVER_EXPORT_RUNTIME_MODULE_ID) {
      return RESOLVED_EXPORT_RUNTIME_MODULE_ID;
    }
    if (id === DREVER_STYLES_MODULE_ID) {
      return RESOLVED_STYLES_MODULE_ID;
    }
  },
  load(id) {
    if (id === RESOLVED_MDX_COMPONENTS_MODULE_ID) {
      return createMDXComponentsModuleSource(plan);
    }
    if (id === RESOLVED_RUNTIME_MODULE_ID) {
      return createRuntimeModuleSource(plan);
    }
    if (id === RESOLVED_EXPORT_RUNTIME_MODULE_ID) {
      return createExportRuntimeModuleSource(plan);
    }
    if (id === RESOLVED_STYLES_MODULE_ID) {
      return createStylesModuleSource(plan);
    }
  },
});
