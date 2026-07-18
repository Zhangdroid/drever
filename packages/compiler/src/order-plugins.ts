import type { Diagnostic, DiagnosticResult, PluginRegistration } from "@drever/schema";
import { createDiagnostic } from "./diagnostics.ts";

type BuildPhase = "pre" | "normal" | "post";
type OrderRelation = "before" | "after" | "requires";

const BUILD_PHASES: readonly BuildPhase[] = ["pre", "normal", "post"];

const phaseOf = (registration: PluginRegistration): BuildPhase =>
  registration.plugin.build?.enforce ?? "normal";

const phaseRank = (phase: BuildPhase): number => BUILD_PHASES.indexOf(phase);

const ownerId = (registration: PluginRegistration): string => registration.plugin.id;

const unknownTargetDiagnostic = (
  plugin: string,
  relation: "before" | "after",
  target: string,
): Diagnostic =>
  createDiagnostic(
    "DREVER_PLUGIN_ORDER_TARGET_UNKNOWN",
    "error",
    `Plugin "${plugin}" declares ${relation} "${target}", but that plugin is not active.`,
    {
      stage: "config",
      plugin,
      hint: "Remove the ordering rule or enable the referenced plugin.",
      details: { relation, target },
    },
  );

const phaseConflictDiagnostic = (
  plugin: string,
  relation: "before" | "after",
  target: string,
): Diagnostic =>
  createDiagnostic(
    "DREVER_PLUGIN_ORDER_PHASE_CONFLICT",
    "error",
    `Plugin "${plugin}" cannot run ${relation} "${target}" because their build phases conflict.`,
    {
      stage: "config",
      plugin,
      hint: "Change build.enforce or remove the contradictory ordering rule.",
      details: { relation, target },
    },
  );

const missingRequirementDiagnostic = (plugin: string, required: string): Diagnostic =>
  createDiagnostic(
    "DREVER_PLUGIN_REQUIRED_MISSING",
    "error",
    `Plugin "${plugin}" requires "${required}", but it is not active.`,
    {
      stage: "config",
      plugin,
      hint: `Enable "${required}" or remove "${plugin}" from the configuration.`,
      details: { required },
    },
  );

const selfReferenceDiagnostic = (plugin: string, relation: OrderRelation): Diagnostic =>
  createDiagnostic(
    "DREVER_PLUGIN_ORDER_SELF_REFERENCE",
    "error",
    `Plugin "${plugin}" cannot declare itself in order.${relation}.`,
    {
      stage: "config",
      plugin,
      hint: `Remove "${plugin}" from order.${relation}.`,
      details: { relation, target: plugin },
    },
  );

const duplicateRelationDiagnostic = (
  plugin: string,
  relation: OrderRelation,
  target: string,
): Diagnostic =>
  createDiagnostic(
    "DREVER_PLUGIN_ORDER_DUPLICATE",
    "error",
    `Plugin "${plugin}" declares ${relation} "${target}" more than once.`,
    {
      stage: "config",
      plugin,
      hint: `Keep one "${target}" entry in order.${relation}.`,
      details: { relation, target },
    },
  );

const validateRelationTargets = (
  registration: PluginRegistration,
  relation: OrderRelation,
  diagnostics: Diagnostic[],
): readonly string[] => {
  const plugin = registration.plugin;
  const targets = plugin.order?.[relation] ?? [];
  const seen = new Set<string>();
  const reportedDuplicates = new Set<string>();
  const uniqueTargets: string[] = [];
  let reportedSelfReference = false;

  for (const target of targets) {
    if (seen.has(target)) {
      if (!reportedDuplicates.has(target)) {
        diagnostics.push(duplicateRelationDiagnostic(plugin.id, relation, target));
        reportedDuplicates.add(target);
      }
    } else {
      seen.add(target);
      uniqueTargets.push(target);
    }

    if (target === plugin.id && !reportedSelfReference) {
      diagnostics.push(selfReferenceDiagnostic(plugin.id, relation));
      reportedSelfReference = true;
    }
  }

  return uniqueTargets.filter((target) => target !== plugin.id);
};

const findCycle = (
  registrations: readonly PluginRegistration[],
  edges: ReadonlyMap<string, ReadonlySet<string>>,
): readonly string[] => {
  const state = new Map<string, "visiting" | "visited">();
  const stack: string[] = [];
  const order = new Map(registrations.map((registration, index) => [ownerId(registration), index]));

  const visit = (id: string): readonly string[] | undefined => {
    state.set(id, "visiting");
    stack.push(id);

    const targets = [...(edges.get(id) ?? [])].sort(
      (left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0),
    );
    for (const target of targets) {
      const targetState = state.get(target);
      if (targetState === "visiting") {
        const cycleStart = stack.indexOf(target);
        return [...stack.slice(cycleStart), target];
      }
      if (targetState !== "visited") {
        const cycle = visit(target);
        if (cycle) {
          return cycle;
        }
      }
    }

    stack.pop();
    state.set(id, "visited");
    return;
  };

  for (const registration of registrations) {
    const id = ownerId(registration);
    if (!state.has(id)) {
      const cycle = visit(id);
      if (cycle) {
        return cycle;
      }
    }
  }
  return [];
};

const sortPhase = (
  registrations: readonly PluginRegistration[],
  edges: ReadonlyMap<string, ReadonlySet<string>>,
): DiagnosticResult<readonly PluginRegistration[]> => {
  const byId = new Map(registrations.map((registration) => [ownerId(registration), registration]));
  const inputOrder = new Map(
    registrations.map((registration, index) => [ownerId(registration), index]),
  );
  const indegree = new Map(registrations.map((registration) => [ownerId(registration), 0]));

  for (const targets of edges.values()) {
    for (const target of targets) {
      indegree.set(target, (indegree.get(target) ?? 0) + 1);
    }
  }

  const ready = registrations
    .filter((registration) => indegree.get(ownerId(registration)) === 0)
    .map(ownerId);
  const sorted: PluginRegistration[] = [];

  while (ready.length > 0) {
    ready.sort((left, right) => (inputOrder.get(left) ?? 0) - (inputOrder.get(right) ?? 0));
    const id = ready.shift();
    if (!id) {
      break;
    }

    const registration = byId.get(id);
    if (registration) {
      sorted.push(registration);
    }

    for (const target of edges.get(id) ?? []) {
      const nextIndegree = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, nextIndegree);
      if (nextIndegree === 0) {
        ready.push(target);
      }
    }
  }

  if (sorted.length !== registrations.length) {
    const cycle = findCycle(registrations, edges);
    const plugin = cycle[0] ?? ownerId(registrations[0] as PluginRegistration);
    return {
      ok: false,
      diagnostics: [
        createDiagnostic(
          "DREVER_PLUGIN_ORDER_CYCLE",
          "error",
          `Plugin ordering contains a cycle: ${cycle.join(" -> ")}.`,
          {
            stage: "config",
            plugin,
            hint: "Remove one before/after rule from the cycle.",
            details: { cycle },
          },
        ),
      ],
    };
  }

  return { ok: true, value: sorted, diagnostics: [] };
};

export const orderBuildPlugins = (
  registrations: readonly PluginRegistration[],
): DiagnosticResult<readonly PluginRegistration[]> => {
  const byId = new Map(registrations.map((registration) => [ownerId(registration), registration]));
  const diagnostics: Diagnostic[] = [];
  const edgesByPhase = new Map<BuildPhase, Map<string, Set<string>>>(
    BUILD_PHASES.map((phase) => [phase, new Map()]),
  );

  for (const registration of registrations) {
    const plugin = registration.plugin;
    const requiredPlugins = validateRelationTargets(registration, "requires", diagnostics);
    const beforePlugins = validateRelationTargets(registration, "before", diagnostics);
    const afterPlugins = validateRelationTargets(registration, "after", diagnostics);

    for (const required of requiredPlugins) {
      if (!byId.has(required)) {
        diagnostics.push(missingRequirementDiagnostic(plugin.id, required));
      }
    }

    const addRelation = (relation: "before" | "after", targetId: string): void => {
      const target = byId.get(targetId);
      if (!target) {
        diagnostics.push(unknownTargetDiagnostic(plugin.id, relation, targetId));
        return;
      }

      const pluginRank = phaseRank(phaseOf(registration));
      const targetRank = phaseRank(phaseOf(target));
      const isConsistent =
        relation === "before" ? pluginRank < targetRank : pluginRank > targetRank;
      if (pluginRank !== targetRank) {
        if (!isConsistent) {
          diagnostics.push(phaseConflictDiagnostic(plugin.id, relation, targetId));
        }
        return;
      }

      const phaseEdges = edgesByPhase.get(phaseOf(registration));
      if (!phaseEdges) {
        return;
      }
      const from = relation === "before" ? plugin.id : targetId;
      const to = relation === "before" ? targetId : plugin.id;
      const targets = phaseEdges.get(from) ?? new Set<string>();
      targets.add(to);
      phaseEdges.set(from, targets);
    };

    for (const target of beforePlugins) {
      addRelation("before", target);
    }
    for (const target of afterPlugins) {
      addRelation("after", target);
    }
  }

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }

  const ordered: PluginRegistration[] = [];
  for (const phase of BUILD_PHASES) {
    const phaseRegistrations = registrations.filter(
      (registration) => phaseOf(registration) === phase,
    );
    const phaseEdges = edgesByPhase.get(phase) ?? new Map();
    const result = sortPhase(phaseRegistrations, phaseEdges);
    if (!result.ok) {
      diagnostics.push(...result.diagnostics);
      continue;
    }
    ordered.push(...result.value);
  }

  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : { ok: true, value: ordered, diagnostics: [] };
};
