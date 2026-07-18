# Extension authoring

Drever resolves extensions before importing their executable modules. This
makes configuration errors deterministic and lets tools inspect a deck without
running third-party code.

## Plugin

```ts
import { definePlugin } from "@drever/compiler";

export default definePlugin({
  kind: "plugin",
  apiVersion: 1,
  id: "@acme/drever-plugin-chart",
  version: "1.0.0",
  baseURL: import.meta.url,
  compilerTargets: ["canonical"],
  manifest: {
    title: "Chart",
    summary: "Adds accessible data charts to MDX decks.",
    config: {
      description: "Project-wide chart behavior.",
      properties: {
        animation: {
          type: "string",
          description: "The default chart entrance animation.",
          values: ["none", "reveal"],
          default: "reveal",
        },
      },
    },
  },
  build: {
    remark: [{ specifier: "./remark-chart.ts" }],
  },
  runtime: {
    components: [
      {
        name: "Chart",
        module: { specifier: "./chart.tsx", exportName: "Chart" },
        manifest: {
          description: "Render a chart from inline JSON data.",
          props: {
            type: {
              type: "string",
              description: "The chart composition.",
              values: ["bar", "line"],
              default: "bar",
            },
          },
        },
      },
    ],
    styles: [{ specifier: "./chart.css", layer: "component" }],
    setup: [{ specifier: "./setup.ts" }],
    exportSetup: [{ specifier: "./export.ts" }],
  },
});
```

The published descriptor is immutable and contains capabilities, defaults, and
documentation. An author makes project choices in `drever.config.ts`:

```ts
import { defineConfig } from "drever";
import chartPlugin from "@acme/drever-plugin-chart";

export default defineConfig({
  plugins: [
    {
      plugin: chartPlugin,
      config: { animation: "none" },
    },
  ],
});
```

The short form `plugins: [chartPlugin]` uses all defaults. A registration may
also set `enabled`. Authors never provide `origin`; the `drever` facade assigns
`"user"` while normalizing entries for `createCompilePlan`. At that compiler
boundary, `origin` remains explicit provenance for deterministic diagnostics
and for lower-level tooling.

Config is canonical JSON. Its manifest supplies defaults and lets Drever reject
missing, unknown, or mistyped fields before importing plugin code. The resolved
value is stored once on the matching planned plugin and is shared by its build
and runtime adapter contexts.

Build module exports are loaded only by the canonical adapter. Their
`BuildPluginReference` may contain static JSON `options`. Runtime components,
elements, layouts, and lifecycle hooks use option-free `ModuleReference`
values, so an adapter never has to guess whether a React export is a factory.
Runtime modules become static imports in generated virtual modules and may
enter the final deck bundle. Theme motion profiles are metadata: themes map the
fixed Drever intent vocabulary through CSS instead of shipping an executable
motion module.

A build module exports a capability-specific descriptor, not a bare unified or
Vite plugin function. This keeps Drever from confusing a plugin attacher with a
factory and gives every failure stable owner context:

```ts
import { defineRemarkPlugin } from "@drever/plugin";

export default defineRemarkPlugin(({ pluginConfig, hookOptions }) => {
  return [remarkChart, { pluginConfig, hookOptions }];
});
```

`pluginConfig` is the deeply frozen resolved registration config shared by all
hooks owned by this plugin. `hookOptions` belongs only to the current module
reference. Drever never merges them. Every build context also exposes the
absolute deck `projectRoot`; do not infer it from `process.cwd()` or Vite's
private generated application root. Build modules are native Node modules in
v1, so changing their code or references requires restarting the dev process.

Remark and Rehype contributions operate inside a protected deck grammar. A
Remark contribution may rewrite content within an existing Slide, but it must
preserve the exact generated Slide wrapper objects, order, `id`, and `index`.
A Rehype contribution must preserve those wrappers and the exact ordered set of
static Step occurrences. Do not add Steps from Rehype or Recma, hide Steps in
expressions, use Step attribute spreads, or defer reveal-stop discovery to a
runtime component. Higher-level reveal syntax must expand to static MDX JSX
Steps during Remark, before Drever's final validators run.

Extension Remark and Rehype hooks see the public `Step` element name. Drever's
final Rehype validator changes validated Steps to the reserved internal provider
name only after all extension Rehype hooks finish. Never declare, import, or
generate lexical bindings named `__DreverSlide` or `__DreverStep`. Author MDX
content and attribute expressions must not reference either name directly,
including through function calls or `React.createElement`.

A Recma contribution may add an independent top-level export or non-rendering
module metadata by inserting a new statement. Every original `Program.body`
statement is sealed and must retain its identity, structure, and relative order;
this includes author ESM, the complete compiled deck content function, its
default-export call, JSX runtime and component-provider imports, provider
bindings, and every protected Slide and Step call. A new statement cannot
reference Drever's protected content-helper binding or use direct `eval`. The
old generated default-function name is available after Drever anonymizes that
export. After extension validation, final emission may assign a different,
collision-safe framework name for React Fast Refresh; plugins cannot observe or
depend on it. This contract rejects seemingly harmless edits and early returns
inside the content function. Perform all content-level rewriting in Remark or
Rehype; use Recma only for module behavior independent of the deck render tree.

Runtime lifecycle modules export a function directly:

```ts
import type { ViewerRuntime } from "@drever/client";
import type { RuntimeSetupHook } from "@drever/plugin";

const setup: RuntimeSetupHook<ViewerRuntime> = ({ plugin, runtime }) => {
  // Skip this audience-only worker in the speaker view.
  if (runtime.surface === "speaker") return;

  // plugin is { id, version?, config }; runtime is the actual client contract.
  const worker = new Worker(new URL("./chart-worker.ts", import.meta.url), {
    type: "module",
  });
  worker.postMessage({ type: "configure", config: plugin.config });

  const publishPosition = () => {
    worker.postMessage({ type: "position", position: runtime.getPosition() });
  };
  const unsubscribe = runtime.subscribe(publishPosition);
  publishPosition();

  return () => {
    unsubscribe();
    worker.terminate();
  };
};

export default setup;
```

The client runtime exposes its `audience` or `speaker` surface, container,
immutable position snapshots, navigation, subscriptions, lifetime
`AbortSignal`, resolved theme metadata (including its motion profile), and
`reportError` for failures from detached work. Hooks should pass
`runtime.signal` to abortable work and
must not install their own presentation router. Runtime components that render
inside slides can use `useDreverRenderMode()` from `@drever/core` to distinguish
`audience`, `document`, `speaker-current`, `speaker-next`, and `export` trees.
Document mode mounts every slide at its final Step without running viewer setup
hooks, so components should suppress autoplay, global listeners, and
audience-only work there. Export mode mounts only the selected slide and
disables presentation motion; components that draw to canvas or perform
asynchronous rendering must complete that work from an `exportSetup` hook before
it resolves. The same rule applies to CSS background images, video posters, and
dynamically created media because the exporter can only observe authored `<img>`
elements directly. Repeated page components must use React `useId` rather than
hard-coded DOM IDs.

The client awaits `setup` hooks in CompilePlan order once per app instance. The
exporter invokes and awaits `exportSetup` independently. Both hook types may
return an async disposer. The returned runner disposer is idempotent, releases
resources in reverse order, and also provides rollback when a later hook fails.
Viewer setup checks `runtime.signal` before every hook and races each current
acquisition against cancellation. Cancellation starts reverse rollback, never
starts another hook, and detaches only the in-flight acquisition; if that hook
later returns a disposer, the runner invokes it exactly once. Rollback and late
cleanup failures are aggregated and routed through `runtime.reportError`, which
uses the viewer's `onError` reporter. The viewer and exporter are separate
virtual-module boundaries, so each embeds registration config only for its own
hook owners. Embedded config must never contain passwords, API keys, tokens, or
other secrets.

Plugin styles may use only the `component` or `utility` layer and should scope
selectors and custom properties to the plugin component root.

## Theme

```ts
import { defineTheme } from "@drever/compiler";

export default defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: "@acme/drever-theme-editorial",
  baseURL: import.meta.url,
  tokens: {
    color: { canvas: "#f7f4ed", text: "#151515", accent: "#e4472e" },
  },
  styles: [{ specifier: "./theme.css", layer: "theme" }],
  elements: {
    h1: { specifier: "./elements.tsx", exportName: "Heading1" },
    p: { specifier: "./elements.tsx", exportName: "Paragraph" },
  },
  layouts: [
    {
      name: "Cover",
      module: { specifier: "./layouts.tsx", exportName: "Cover" },
      description: "Open a narrative with one strong idea.",
      slots: [
        {
          name: "title",
          purpose: "The central statement.",
          accepts: ["text"],
          required: true,
          maxItems: 1,
        },
      ],
      variants: ["quiet", "accent"],
    },
  ],
  motion: {
    id: "editorial",
    intents: ["focus", "replace", "compare", "stagger", "continuity"],
    guidance: ["Use continuity only for one shared subject across adjacent slides."],
  },
  manifest: {
    title: "Editorial",
    summary: "Typography-led layouts with restrained motion.",
    artDirection: {
      keywords: ["editorial", "precise", "warm"],
      principles: ["One dominant idea per slide", "Use space as structure"],
      avoid: ["Decorative gradients", "Competing animations"],
    },
  },
});
```

Themes cannot add remark, rehype, recma, Vite, client setup, or feature
components. Publish those capabilities as a companion plugin so changing a
theme cannot change content semantics.

## Ordering

Use `build.enforce` for broad build phases and `order.before` / `order.after`
only when a real AST dependency exists:

```ts
definePlugin({
  // ...identity and manifest
  order: {
    requires: ["@acme/drever-plugin-data"],
    after: ["@acme/drever-plugin-data"],
  },
  build: {
    enforce: "normal",
    remark: [{ specifier: "./remark-chart.ts" }],
  },
});
```

Ordering targets must be active. Cycles and rules that contradict `pre`,
`normal`, or `post` are errors.

## AI generation checklist

When generating a Drever extension, an AI should verify:

1. `kind`, `apiVersion`, stable `id`, and non-empty manifest are present.
2. Every executable value is behind a module reference.
3. Relative references have `baseURL: import.meta.url`.
4. Build-reference options and registration config contain canonical JSON only.
5. Theme layouts document slots, accepted content, variants, and constraints.
6. Plugin components use unique PascalCase names and document their props.
7. Core names `Slide`, `Step`, `Note`, and `MotionGroup` are never replaced.
8. Browser-lite support is declared only when the complete plugin can run there.
9. Remark hooks preserve protected Slide wrapper identity, order, and generated props.
10. Rehype hooks preserve the exact static Step sequence and navigation semantics.
11. Recma hooks add only independent module exports or metadata and never edit compiled deck content.
12. Internal names `__DreverSlide` and `__DreverStep` are never authored, bound, or referenced.
