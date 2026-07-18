# Client runtime

`@drever/client` ships two product surfaces over one compiled deck contract:
`createViewer` for the audience and `createSpeaker` for the speaker view. The
`drever` CLI generates the route-aware bootstrap shown below. Deck authors
configure Drever and write MDX rather than assembling React, Navigation API,
`BroadcastChannel`, or Vite integrations. Overview and export remain separate
future consumers.

## Generated application entry

The canonical Vite adapter exposes the compiled deck and three private virtual
module boundaries. A generated entry combines them as follows:

The generated project's `drever-env.d.ts` contains this type-only import, so
TypeScript can resolve those private modules without hand-written shims:

```ts
import "@drever/vite/virtual-modules";
```

```tsx
import { createSpeaker, createViewer } from "@drever/client";
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
const createPresentation =
  relativePath === "speaker" || relativePath.startsWith("speaker/") ? createSpeaker : createViewer;
const reportPresentationError = (error: unknown): void => {
  if (typeof globalThis.reportError === "function") {
    globalThis.reportError(error);
    return;
  }
  console.error(error);
};
const presentation = await createPresentation({
  baseURL,
  Content,
  container,
  manifest: deckManifest,
  onError: reportPresentationError,
  registry,
  runtime: { motion, runSetup, theme },
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void presentation.destroy().catch(reportPresentationError);
  });
}
```

The inputs have distinct owners:

- `Content` and `deckManifest` are named parts of the same compiled MDX module.
  The export is passed through the `manifest` option.
- `registry` is the resolved theme-element, layout, plugin-component, and core
  component registry from `virtual:drever/mdx-components`.
- `theme`, `motion`, and `runSetup` are the browser-safe values from
  `virtual:drever/runtime`. Passing them as `runtime` keeps the client independent
  from Vite module identifiers.
- `@drever/client/styles.css` owns the viewport and transition surface;
  `virtual:drever/styles.css` imports the planned theme and plugin styles in
  deterministic cascade layers.

Both surfaces require the deck mount `baseURL`; a deep path cannot infer it
without ambiguity. They also accept an explicit `canvas`, external abort
`signal`, and `onError` reporter. `createViewer` additionally accepts
`reducedMotion`. An explicit canvas overrides the theme canvas. Normally the
generated entry should let the viewer read the user's reduced-motion preference.

The returned handle deliberately stays small:

```ts
await presentation.navigate({ type: "next" });
await presentation.navigate({ type: "goTo", slideId: "slide-3", step: 4 });
const position = presentation.getPosition();
const unsubscribe = presentation.subscribe(() => console.log(presentation.getPosition()));
unsubscribe();
await presentation.destroy();
```

Commands are `next`, `previous`, `first`, `last`, and `goTo`. A command at a deck
edge is a no-op. `destroy()` is asynchronous and idempotent.

## URL and navigation contract

The browser URL is the source of truth. Navigation API history-entry state is a
validated cache, never authority for the destination. On startup and every
same-deck navigation, the viewer decodes the URL against `deckManifest`.

The audience route uses canonical path segments relative to the deck's mount
point:

| Position                | Canonical route |
| ----------------------- | --------------- |
| First slide, Step 0     | `/`             |
| Any other slide, Step 0 | `/2`            |
| A reveal stop           | `/2/4`          |

The slide segment is a one-based manifest ordinal. Step 0 is omitted; a
positive Step segment must be one of that slide's exact sparse stops. Query
parameters and the hash are preserved as unrelated application state. Unknown
slides, extra or internal empty segments, non-canonical integers, and Step values
absent from the manifest are invalid routes. Same-deck invalid navigation is cancelled
when the browser permits cancellation and reported through `onError`.

Generated navigation omits a trailing slash. Directory-oriented static hosts
may expose the same entry with one trailing slash; the decoder accepts that
hosting alias without treating `/1` as an alias for the root slide.

Production clean URLs use small inline bootstrap scripts to compute the mount
base before the browser activates built assets. A strict Content Security Policy
must therefore allow those generated scripts. The current CLI does not emit a
nonce or CSP hash manifest; deployments must either permit inline scripts or
derive exact hashes from the final generated HTML. A future CSP mode can make
nonce/hash metadata a first-class build artifact.

The speaker namespace uses `/speaker`, `/speaker/2`, and `/speaker/2/4`. It has
the same sparse position semantics, history behavior, reloadability, and static
build entries as the audience namespace.

## Speaker surface and synchronization

The speaker view shows the current state, the exact state reached by the next
navigation command, compiled speaker notes, an elapsed timer, and previous/next
controls. “Next” is manifest-driven: for sparse stops `0 -> 2 -> 5`, the preview
advances through 2 and 5 rather than guessing consecutive numbers.

Current and next previews are separate MDX render trees. Interactive components
can call `useDreverRenderMode()` from `@drever/core`; it returns `audience`,
`speaker-current`, or `speaker-next`. Components that own media, network work, or
global listeners must suppress those effects in speaker previews. The runtime
setup contract separately exposes `runtime.surface` as `audience` or `speaker`
so plugin hooks can make the same decision. `inert` prevents preview interaction
but is not an effect-suppression mechanism. Drever namespaces its generated
slide DOM ids per preview; author components should use React `useId` or local
refs instead of document-global hard-coded ids.

The **Open audience** control opens the equivalent audience path. Speaker and
audience windows share one native `BroadcastChannel` isolated by origin and deck
mount path. The speaker publishes its validated position; an audience joining
later sends a ready handshake and immediately catches up. Remote positions pass
through the same state machine and Navigation API adapter, so synchronization
also updates the audience URL, history, accessibility state, and transition.

Each successful command pushes a Navigation API history entry. Browser back and
forward traversal use the destination entry index to select backward or forward
motion. Form submissions, downloads, non-interceptable navigations, and URLs
outside the deck's origin or mount path remain browser-owned. Pure fragment
changes and page reloads also remain native, so anchors, refresh, and Vite's
full reload keep their browser semantics.

Navigation interception uses manual focus and scroll handling. After a slide
commit, the viewer focuses the active slide without scrolling it. The React
layout commit completes the intercepted navigation; code must not replace this
with an effect scheduled after navigation finishes.

## Exact and sparse Steps

Step 0 is the implicit initial state of every slide and is not stored in the
manifest. `stepStops` contains the exact sorted positive values compiled from
the slide. Navigation follows those values rather than assuming consecutive
integers:

```mdx
<Step at={2}>First group</Step>
<Step at={5}>Second group</Step>
<Step at={5}>Revealed with the second group</Step>
```

The navigation sequence is `0 -> 2 -> 5`; going backward reverses that sequence.
Repeated values form a group and gaps remain intentional.

`Step` is compiler syntax as well as a React component. It must appear as static
MDX JSX inside a slide. A literal numeric attribute such as `at={5}` is static;
an expression such as `at={nextStop}` is rejected. A `Step` inside an MDX or
JavaScript expression is also rejected. A component such as `<InteractiveDemo />`
may render React content at runtime, but any `Step` it creates is invisible to
the compiler and cannot add a navigation stop.

Plugins that provide higher-level reveal syntax must compile it to static `Step`
MDX AST nodes before Drever's final Remark validation pass. AI-generated decks
should use direct `<Step>` nodes instead of hiding navigation inside helper
components.

## Presentation command contract

| Command                | Keys                                     |
| ---------------------- | ---------------------------------------- |
| Next Step or slide     | `ArrowRight`, `PageDown`, `Space`        |
| Previous Step or slide | `ArrowLeft`, `PageUp`, `Shift+Space`     |
| Next / previous slide  | `ArrowDown` / `ArrowUp`                  |
| First / last state     | `Home` / `End`                           |
| Slide navigator        | `O` or `G`                               |
| Direct slide jump      | Slide number, then `Enter`               |
| Speaker view           | `P` from the audience                    |
| Fullscreen             | `F`                                      |
| Black / white pause    | `B` / `W`; repeat or `Escape` to dismiss |
| Keyboard help          | `?`                                      |

The viewer ignores already-handled or composing events, keys with
`Alt`/`Control`/`Meta`, and events from links, buttons, form controls, editable
content, native media controls, focusable custom content, common ARIA widgets,
or an ancestor marked `data-drever-keyboard="ignore"`.

The speaker-view shortcut opens a new window at the equivalent speaker path, so
`/2/4?theme=dark#notes` becomes `/speaker/2/4?theme=dark#notes`. Key repeat is
ignored to prevent one long press from opening multiple windows.

The built-in audience command bar exposes navigation, exact slide position,
the searchable slide navigator, speaker view, fullscreen, and keyboard help to
pointer and touch users. It is a sibling of the canvas rather than slide
content, so scoped View Transitions never capture presentation chrome.

## Rendering and motion

Only the current slide is active and receives its current Step. Inactive slides
leave the accessibility tree but use React Canary `Activity` to preserve their
DOM and state while cleaning up effects. This is important for interactive
slides: returning to a slide restores component state without leaving inactive
work running.

Navigation commits use React Canary `startTransition` inside
`Element.startViewTransition({ update, types })` on the slide canvas. The stage
outside the canvas is never captured, and the default theme does not create
nested transition groups. Six semantic transition types distinguish
forward/backward Step, adjacent-slide, and jump motion. The defaults live in the
lowest `drever.client` cascade layer and expose duration/easing custom
properties, so themes can style motion while the client owns its meaning.

When reduced motion is requested, the same state and navigation path is used but
presentation animation is disabled. This is an accessibility behavior, not a
legacy animation fallback.

## Platform and lifecycle

The audience and speaker surfaces require a browser document connected to a
`Window` with:

- `BroadcastChannel`
- Navigation API
- `Element.startViewTransition`
- `ResizeObserver`

There is intentionally no fallback router, animation engine, or resize polling.
Unsupported environments fail before React mounts with a structured
`DREVER_CLIENT_PLATFORM_UNSUPPORTED` error.

Creation follows one owned sequence: validate the platform and manifest, derive
the initial position from the URL, mount React, attach Navigation and keyboard
listeners, then await `runSetup`. The promise resolves only after setup succeeds.
If any stage fails, acquired resources are released before the failure is
returned.

The external abort signal and `destroy()` both end the viewer lifetime.
Destruction aborts pending navigation, closes the React transition bridge,
removes listeners, and unmounts React immediately. An acquired setup disposer is
then awaited. The generated setup runner observes the same lifetime signal before
every hook and races the current acquisition against cancellation. It stops the
sequence, begins reverse rollback of completed hooks, and detaches only the
in-flight hook, so a broken acquisition cannot hold core teardown open. A
disposer returned later is still invoked exactly once. Rollback, late acquisition,
and late disposer failures are reported through the runtime's `reportError`,
which delegates to `onError`. Cleanup remains idempotent and a second `destroy()`
never repeats it.

Lifecycle unit tests exercise the real state machine and runtime orchestration
against resource-level adapters. They verify StrictMode readiness, external
cancellation, setup races, listener ownership, synchronization, cleanup
ordering, and idempotence without adding a simulated DOM dependency. Chromium
CI remains the authority for the browser-owned boundary: the speaker UI,
cross-window synchronization, Navigation interception, focus/inert behavior,
and native scoped View Transition timing.

## AI generation contract

An AI generating a Drever application should follow this minimal prompt:

> Write `slides.mdx` using root-level `---` slide boundaries. Use direct static
> MDX JSX `<Step>` elements for reveals; omit `at` for consecutive compiler
> numbering or use only positive numeric literals for intentional groups and
> gaps. Do not put Steps in JavaScript expressions or runtime helper components.
> Keep the generated application entry unchanged: pass the default MDX export as
> `Content`, `deckManifest` as `manifest`, the virtual component registry as
> `registry`, and `{ theme, motion, runSetup }` as `runtime` to the generated
> route-selected client surface.
> Import both client and virtual styles. Do not implement a router, inspect the
> rendered DOM for Steps, call native View Transition APIs, or add browser
> fallbacks.

This boundary lets an AI vary story, layout, components, and theme while leaving
delivery, navigation, motion semantics, and cleanup deterministic.
