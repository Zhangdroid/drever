# Canonical Vite adapter

`@drever/vite` is the internal boundary used by the `drever` CLI and client
package. Ordinary deck authors configure Drever; they do not assemble
Vite, MDX, React, or unified plugins themselves. Plugin authors may use the
standard Vite type through `@drever/plugin` when a capability genuinely needs
build integration. The adapter-only compiler passes live at
`@drever/compiler/internal`; deck and extension authors use the root
`@drever/compiler` entry and never import that subpath.

## Preparation

The adapter accepts an immutable canonical `CompilePlan`. Preparation must
finish before Vite starts:

1. Validate the plan version and target.
2. Load build descriptors from the project root.
3. Validate descriptor API versions and capabilities.
4. Create unique unified attachers and normalized Vite plugins.
5. Return the complete Vite plugin list or structured diagnostics.

A failed preparation never starts a partial development server. Build modules
are loaded by a content-addressed native ESM loader under
`.drever/cache/`. This gives bare package names project-root Node ESM
resolution without making Vite's module runner a long-lived plugin runtime.
Build module and extension configuration changes require a process restart in
v1; MDX and runtime component modules remain part of Vite's ordinary graph.

The canonical order is:

```text
Drever virtual modules (pre)
  -> MDX (pre; framework slide grammar first)
  -> extension Vite plugins (planned pre / normal / post)
  -> React transform and Fast Refresh
```

An extension cannot use a raw Vite transform to reinterpret slide boundaries.
Markdown syntax belongs in a declared remark or rehype contribution.

## Authoring analysis path

`drever context [entry] --json` reuses the canonical plan without constructing
the complete Vite plugin graph. The adapter's selective Remark loader imports
only configured Remark build contributions. The compiler then runs its fixed
segmentation and Step grammar, those contributions, and the final manifest pass.
This yields the same static slide identities and exact sparse stops that full MDX
compilation protects.

The resulting manifest is joined to parser-owned source fragments and public,
JSON-safe design metadata. Rehype, Recma, Vite transforms, generated modules,
React rendering, and runtime hooks do not run on this path. A plugin that creates
authoring-visible structure must therefore express it as static MDX through its
declared Remark contribution; later transformations cannot change Drever's
protected navigation contract.

## MDX grammar

The internal grammar transformer reserves a root thematic break whose original
source is exactly `---`. It hoists root MDX ESM and wraps every segment in a
protected internal `__DreverSlide` provider component with deterministic `id`
and numeric `index` props, so an author import named `Slide` cannot shadow the
framework wrapper. It does not split `***`, nested thematic breaks, or fenced
code.

Within each slide, the transformer assigns numeric `at` props to implicit
`Step` elements in depth-first document order. Numbering restarts at one per
slide. A static explicit index advances the next inferred index. A final
framework Remark pass runs after extension Remark plugins, validates every
`Step` as a static positive integer stop, and rejects dynamic `at` values.
Repeated values form one reveal group and gaps remain gaps: stops `1, 4, 4`
produce navigation states `0 -> 1 -> 4`.

The public `Step` name remains visible to extension Remark and Rehype plugins.
Only the final framework Rehype validator renames validated occurrences to the
reserved provider component `__DreverStep`, immediately before Recma lowering.
Author MDX may bind ordinary names such as `Slide` or `Step` without shadowing
the framework. The internal `__DreverSlide` and `__DreverStep` JSX names and
lexical bindings are reserved and rejected. MDX content and attribute
expressions also cannot reference those identifiers: compiled component-provider
bindings live in the same content-function scope, so allowing a direct call or
`React.createElement` reference would bypass static Step discovery.

Only static MDX JSX `Step` nodes inside the protected Slide subtree participate
in this contract. A `Step` embedded in a JavaScript or MDX expression is
rejected. Attribute spreads are also rejected because they can override a
static `at` value at runtime. A React component that creates a `Step` at runtime
is opaque to the compiler and therefore cannot add a stop to `deckManifest`. A
plugin that adds reveal semantics must expand them to static `Step` MDX AST
nodes before the final framework Remark pass; it must not leave navigation
discovery to runtime.

Extension remark plugins receive one already segmented deck tree containing
the protected Slide subtrees. The grammar records the exact wrapper objects and
their order. Extensions may transform slide contents, but they cannot add,
remove, clone, replace, reorder, or add props to protected wrappers; pagination
is no longer configurable at that point.

A final framework Rehype pass runs after every extension Rehype contribution.
Because the MDX bridge creates new syntax nodes, it compares the final protected
Slide identities and exact depth-first sequence of Step indices against a
private Remark snapshot and the public manifest. This includes duplicate Step
occurrences, so adding another `at={2}` Step cannot hide behind the same unique
manifest stop. Added, removed, or modified Steps and changed Slide wrappers fail
with the stable `drever:deck-manifest-rehype-drift` diagnostic.

Before extension Recma plugins run, a framework pass seals the complete compiled
deck content function, its return tree, the default-export wiring, the automatic
JSX runtime imports, the MDX component-provider import, and the generated
provider binding. It also converts the content helper to a `const` binding and
removes the mutable name from the default-export function. Every original
`Program.body` statement is then sealed by identity, structure, and relative
order, including author ESM; an extension cannot modify, replace, remove, clone,
or reorder one.

A Recma extension may insert an independent top-level export or module-metadata
statement. An inserted statement cannot reference the protected content-helper
binding and cannot use direct `eval`. The former generated default-export name
is free after anonymization. The final pass also requires the exact ordered
Slide and Step occurrences to remain unchanged. Recma cannot modify any part of
the compiled deck content function; content-level transforms belong in Remark
or Rehype.

After all extension Recma hooks pass validation, the framework assigns the
anonymous default export a collision-safe `DreverContent`-style name. Extensions
never observe or target this late binding; it exists so React Fast Refresh can
register the MDX module as a component boundary. During development, an
unchanged `deckManifest` is reused through private `import.meta.hot.data`, keeping
that non-component export referentially stable. Content-only edits therefore
preserve the page, canonical URL, Step and React component state. A structural
slide or Step change produces a different manifest and intentionally requests a
full reload so the navigation state machine is rebuilt.

The provider merge also writes the protected internal Slide and Step mappings
after `props.components`, so an embedder cannot replace framework navigation
primitives through MDX component overrides. After validation, the final Recma
pass emits the reserved named export `deckManifest`. The object, slide array,
slide records, and stop arrays are all frozen. The generated freeze binding is
collision-safe and does not resolve through an author lexical binding named
`Object`. Extensions cannot claim the manifest export name or introduce a
reserved internal component binding.

## Generated modules

The adapter owns four private virtual modules:

- `virtual:drever/mdx-components` statically imports theme elements, layouts,
  and plugin components, then exports the MDX component provider.
- `virtual:drever/runtime` is the viewer boundary. It statically imports the
  theme motion implementation and `setup` hooks, then exports `theme`,
  `motion`, and `runSetup`.
- `virtual:drever/export-runtime` is the exporter boundary. It statically
  imports only `exportSetup` hooks and exports `runExportSetup`.
- `virtual:drever/styles.css` declares Drever's cascade layer order and imports
  planned styles without moving them between layers.

The client imports runtime and styles explicitly. Compiling an MDX module does
not execute setup hooks or pull CSS into every slide chunk.

Generated TypeScript projects import `@drever/vite/virtual-modules` from their
`drever-env.d.ts`; that type-only subpath declares all four private module ids.
The CLI owns this one-line environment file, so authors and plugins do not
maintain ambient module declarations.

The generated route-aware entry combines those boundaries without exposing Vite
configuration to an author:

```tsx
import { createDocument, createSpeaker, createViewer } from "@drever/client";
import "@drever/client/styles.css";
import { components as registry } from "virtual:drever/mdx-components";
import { motion, runSetup, theme } from "virtual:drever/runtime";
import "virtual:drever/styles.css";
import Content, { deckManifest } from "./slides.mdx";

const container = document.querySelector("#app");
const base = document.querySelector('meta[name="drever-base"]');
if (!(container instanceof HTMLElement)) {
  throw new Error('Drever requires an HTMLElement matching "#app".');
}
if (!(base instanceof HTMLMetaElement)) {
  throw new Error("Drever requires its generated route base.");
}

const baseURL = new URL(base.content, document.baseURI);
const relativePath = new URL(document.URL).pathname.slice(baseURL.pathname.length);
const routePath = relativePath.replace(/\/+$/u, "");
const createPresentation =
  routePath === "document"
    ? createDocument
    : routePath === "speaker" || routePath.startsWith("speaker/")
      ? createSpeaker
      : createViewer;
const presentation = await createPresentation({
  baseURL,
  Content,
  container,
  manifest: deckManifest,
  registry,
  runtime: { motion, runSetup, theme },
});
```

The `manifest` option receives the MDX module's `deckManifest` export. Keeping
the option name independent from the generated binding makes embedding explicit
without coupling the client package to one bundler module shape. The CLI owns
this entry template; ordinary authors should not assemble low-level
Navigation or React transition bridges.

The audience, speaker preview, and document surfaces supply state through core's
`SlideStateProvider`. Its resolver receives a frozen `{id?, index?}` identity
and returns `{active, currentStep}` plus an optional landmark label. Explicit
`active` and `currentStep` props independently win over resolved values.
Inactive audience slides use React Activity and leave the accessibility tree
while preserving their interactive state; document slides are all active at
their final Step. A `Step` inside a compiled `Slide` must have an `at` index,
preventing post-grammar transforms from introducing a silently always-visible
step.

Lifecycle runners await hooks in CompilePlan order and do not memoize globally.
A hook may return a disposer. After successful setup, the runner returns one
idempotent async disposer that releases acquired resources in reverse order. If
a later hook fails, the runner first rolls back every disposer already acquired
and then throws a contextual error whose `cause` is the hook failure. Disposal
continues after individual failures; the first reverse-order failure is thrown
and later failures are available as `suppressedErrors`.

Client setup is lifetime-aware at every hook boundary. Before starting a hook it
checks `runtime.signal`, then races that hook's acquisition against abort. Abort
stops the sequence and starts reverse rollback immediately. The one in-flight
acquisition is detached; if it later returns a disposer, that disposer still runs
exactly once. Rollback and detached-cleanup failures retain their lifecycle
metadata, aggregate through `suppressedErrors` where applicable, and are routed
through `runtime.reportError` to the viewer's `onError` reporter.

A client owns the “once per app instance” rule; an exporter invokes export
setup independently. The selected setup export must be a function. Motion is a
direct theme value and is never called by the adapter.

`createViewer` and `createSpeaker` each own one client lifetime. They resolve only
after React has mounted and `runSetup` has completed. Their async `destroy()` is
idempotent, closes the presentation channel, removes keyboard and Navigation
listeners, unmounts React, and invokes an acquired setup disposer. Core teardown
never waits for a setup acquisition that ignored its abort signal; a late
disposer is run by a detached continuation and failures are reported through the
client reporter. Failed creation rolls back the resources already acquired.
`createDocument` owns a smaller React lifetime: it mounts one fully revealed
tree, does not run viewer setup hooks, and exposes only idempotent destruction.
The export client owns a separate lifetime: it mounts raw canvas-sized pages,
awaits `runExportSetup`, fonts, images, and final layout frames, then exposes a
ready marker for Chromium capture. Its destroy handle unmounts React and runs
the export-hook disposer before the CLI writes output. A richer thumbnail
overview remains future work.

Each lifecycle module embeds resolved config only for the owners of hooks it
imports: viewer setup config never pulls in export-only plugin config, and the
export boundary never pulls in viewer-only config. Plugin manifests must
describe only public browser-safe settings; secrets are invalid project
configuration regardless of whether a particular build happens to tree-shake
the hook.

## Failure boundaries

Expected failures remain structured until the outer CLI or browser overlay:

| Boundary                                    | Diagnostic stage |
| ------------------------------------------- | ---------------- |
| CompilePlan version or target               | `config`         |
| Build module import, descriptor, or factory | `bundle`         |
| remark, rehype, or recma execution          | `transform`      |
| Viewer generated module, hook, or disposer  | `runtime`        |
| Export lifecycle hook                       | `export`         |

Unexpected errors preserve their original cause. No domain package prints or
terminates the process.
