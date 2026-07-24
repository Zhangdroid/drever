# 0002: Extension model and compile planning

- Status: accepted
- Date: 2026-07-20

## Context

Drever extensions need to contribute remark, rehype, recma, and Vite build
plugins as well as MDX components, styles, client setup, and export readiness.
Themes also provide renderers and layouts, but changing a visual theme must not
silently change Markdown semantics or the build pipeline.

The same definitions should be inspectable by AI, produce deterministic builds,
and permit a restricted browser compiler later. Passing arbitrary functions
through every public field would defeat those goals.

## Decision

Theme and Plugin are separate public definitions:

- A Theme owns semantic tokens, Markdown element renderers, layout recipes,
  theme/layout styles, canvas defaults, and one mapping of core motion intents.
- A Plugin owns build transformations, Vite integration, feature components,
  component/utility styles, client setup, export setup, and a schema for
  project-level JSON config.
- A Theme never inherits from Plugin. Build behavior needed by a theme is
  delivered as a separately selected companion plugin.

Definition fields contain only JSON and module references. A runtime module
reference names an ESM module and optional export. A build plugin reference may
add static JSON `options`. Relative references resolve against the definition's
`baseURL`, normally `import.meta.url`; an explicitly supplied `baseURL` must
always be an absolute URL.

`CompilePlan` is a versioned, JSON-safe resolved description. The canonical Vite
adapter turns its module references into a process-local execution plan that
contains actual unified and Vite plugin functions. Executable objects never
cross into the Deck Artifact. The configuration boundary decodes unknown
JavaScript values before contract code reads them, rejects unknown fields, and
returns path-aware diagnostics. A successful plan is a deeply frozen snapshot,
and failed diagnostics receive the same treatment, so later mutation of a
descriptor cannot invalidate cache keys, builds, or error reports.

## Module execution contracts

Reference meaning is determined by the capability that owns it:

- Theme elements, layouts, and plugin components import the selected export as
  a direct runtime value. They cannot declare `options`. Theme motion profiles
  are JSON-safe metadata mapped to CSS by the theme.
- `setup` and `exportSetup` import a Drever lifecycle hook that the relevant
  adapter invokes once with its owned context. They cannot declare `options`.
- remark, rehype, recma, and Vite entries use `BuildPluginReference`. Their
  exported factory is loaded by the corresponding canonical adapter; static
  `options` are available only to that contribution.

Build modules are adapter boundaries owned by the Drever plugin, rather than an
assumption that every third-party package has the same invocation convention.
The execution adapter uses the reference owner to expose the resolved project
plugin config to that owner's hooks. This is how one registration config can
consistently affect both build and runtime behavior without embedding functions
in `drever.config.ts`.

Before extension remark plugins run, the compiler's non-configurable grammar
turns root-level exact `---` boundaries into a pre-segmented deck tree of
`Slide` nodes and hoists root MDX ESM alongside them. Extensions transform that
deck tree; they never receive independent slide documents and cannot take over
pagination.

The public `Step` name remains available through extension Remark and Rehype
execution. A final Rehype validator then seals its static sequence and lowers it
to a reserved internal provider name. Before extension Recma execution, Drever
hardens the generated content/default bindings and seals every original
`Program.body` statement. Recma may insert independent top-level exports or
module metadata only when the new statement does not reference protected wiring
or use direct `eval`; it cannot mutate, replace, remove, clone, or reorder an
original statement. Content transforms belong in Remark or Rehype.

## Registries

The authoring surface has distinct semantic registries even if the Vite adapter
later emits one MDX component module:

1. Core primitives: `Slide`, `Step`, `Note`, and `MotionGroup`; protected.
2. Theme elements: lowercase intrinsic Markdown names such as `h1`, `p`, and
   `code`.
3. Theme layouts: PascalCase composition contracts with slots and constraints.
4. Plugin components: PascalCase feature capabilities such as `Mermaid` or
   `YouTube`.

Layout and feature component names share the MDX namespace. A collision is an
error with both owners in structured diagnostic details; later registration
never silently wins.

## Activation and ordering

Plugin registrations have one origin:

- `required`: always active and cannot be disabled;
- `default`: active unless the normalized configuration disables it;
- `user`: explicitly selected by the project.

Project-specific plugin choices live on `PluginRegistration.config`, not in the
published `DreverPlugin` descriptor. A plugin that accepts config publishes an
AI-readable config manifest with descriptions, types, allowed values, defaults,
and required fields. Planning validates and resolves this config into the
matching `PlannedPlugin`; build and runtime adapters read the same value by
owner id.

Runtime contributions resolve in `required -> default -> user` order while
preserving declaration order inside each group. Theme runtime contributions
come before all plugin contributions.

Build transformations have their own ordering model. `build.enforce` creates
absolute `pre`, `normal`, and `post` phases. `before` and `after` form a stable
topological order inside a phase; cross-phase rules must agree with the phase
order. Missing targets, missing required plugins, contradictory phases, and
cycles are configuration errors.

Build ordering never changes runtime style or setup precedence.

## Compiler targets

The canonical target is the Node/Vite build. Extensions default to canonical
support only.

An extension must explicitly declare `browser-lite` support. A browser-lite
plan rejects Vite contributions instead of dropping them. A later browser
adapter will add the stronger registry check needed to prevent arbitrary module
URLs from being loaded in a Worker.

## Built-in policy

The exact built-in descriptors arrive with their implementation packages:

- `---` splitting is a compiler grammar invariant, not a plugin and never
  configurable.
- Shiki and Tailwind are default registrations that users may disable.
- Math is an optional registration enabled explicitly. Mermaid remains deferred
  until its security, accessibility, rendering, and export contracts are proven.

This keeps product grammar outside plugin ordering and prevents double slide
splitting.

## Package naming

- `drever`: public CLI and configuration facade package.
- `@drever/schema`, `@drever/compiler`, `@drever/core`, and similar scoped
  implementation packages.
- `@drever/plugin-shiki`, `@drever/plugin-tailwindcss`, and other official plugins.
- `@drever/designs/editorial` and the other studies in `@drever/designs`.

Third-party packages use their own npm scope but retain a globally stable plugin
id, normally the package name.

## Consequences

- Extension definitions are deterministic, inspectable, and cacheable.
- One immutable plugin descriptor can be registered with different project
  configs without a descriptor factory or object spreading.
- Plugin developers put executable code behind module exports instead of
  embedding functions in project configuration.
- Non-JSON values, relative references without `baseURL`, unsupported compiler
  targets, and incompatible API versions fail before any plugin is imported.
- AI manifests are part of the contract rather than an optional documentation
  afterthought.
- Plugins that truly need non-serializable options can encapsulate them inside a
  referenced module. A direct-function escape hatch is intentionally deferred.
