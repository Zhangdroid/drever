import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DreverFocusToolsConfig } from "./config.ts";

export type PrivateApp = Readonly<{
  dispose(): Promise<void>;
  root: string;
}>;

export type PrivateAppOptions = Readonly<{
  canvas?: Readonly<{ height: number; width: number }>;
  focusTools?: DreverFocusToolsConfig;
  rehearsal?: Readonly<{ targetDurationMs?: number }>;
  stage?: Readonly<{
    background?: string;
    foreground?: string;
  }>;
}>;

export type PrivateExportAppOptions = Readonly<{
  canvas?: Readonly<{ height: number; width: number }>;
  includeSteps: boolean;
  stage?: Readonly<{
    background?: string;
    foreground?: string;
  }>;
}>;

const browserSupportBootstrap = `<script data-drever-browser-support>
(function () {
  var missing = [];
  var root = document.documentElement;
  var navigation = window.navigation;

  if (
    typeof navigation !== "object" ||
    navigation === null ||
    typeof navigation.addEventListener !== "function" ||
    typeof navigation.navigate !== "function" ||
    typeof navigation.removeEventListener !== "function" ||
    typeof navigation.updateCurrentEntry !== "function" ||
    typeof window.NavigateEvent !== "function" ||
    !("signal" in window.NavigateEvent.prototype)
  ) {
    missing.push("navigation");
  }
  if (typeof document.startViewTransition !== "function") {
    missing.push("document-view-transition");
  }
  if (typeof window.BroadcastChannel !== "function") {
    missing.push("broadcast-channel");
  }
  if (typeof window.ResizeObserver !== "function") {
    missing.push("resize-observer");
  }

  root.setAttribute("data-drever-browser-missing", missing.join(" "));
  root.setAttribute(
    "data-drever-browser-support",
    missing.length === 0 ? "supported" : "unsupported"
  );
})();
</script>`;

const browserSupportStyles = `<style data-drever-browser-support>
html:not([data-drever-browser-support="supported"]),
html:not([data-drever-browser-support="supported"]) body {
  min-height: 100%;
  background: #111018;
}
html:not([data-drever-browser-support="supported"]) body {
  margin: 0;
}
html:not([data-drever-browser-support="supported"]) #drever-root {
  display: none;
}
html[data-drever-browser-support="supported"] .drever-browser-gate {
  display: none;
}
.drever-browser-gate {
  box-sizing: border-box;
  display: grid;
  min-height: 100svh;
  padding: clamp(1.5rem, 5vw, 4rem);
  align-content: space-between;
  gap: 5rem;
  background:
    radial-gradient(circle at 78% 72%, rgb(111 91 255 / 18%), transparent 30rem),
    #111018;
  color: #f6f3e9;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
.drever-browser-gate * {
  box-sizing: border-box;
}
.drever-browser-gate header,
.drever-browser-gate__layout {
  width: min(100%, 88rem);
  margin-inline: auto;
}
.drever-browser-gate header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}
.drever-browser-gate header strong {
  font-size: 1rem;
  letter-spacing: -0.03em;
}
.drever-browser-gate header span,
.drever-browser-gate__status > span {
  color: #9f9cae;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.drever-browser-gate__layout {
  display: grid;
  align-items: end;
  grid-template-columns: minmax(0, 1.3fr) minmax(17rem, 0.7fr);
  gap: clamp(3rem, 9vw, 9rem);
}
.drever-browser-gate__copy > span {
  color: #c7f03a;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.drever-browser-gate h1 {
  max-width: 10ch;
  margin: 1.2rem 0 0;
  font-size: clamp(3.2rem, 8vw, 7rem);
  font-weight: 580;
  letter-spacing: -0.06em;
  line-height: 0.9;
  text-wrap: balance;
}
.drever-browser-gate p {
  max-width: 38rem;
  margin: 1.8rem 0 0;
  color: #aaa7b7;
  font-size: clamp(1rem, 1.5vw, 1.16rem);
  line-height: 1.55;
}
.drever-browser-gate p:last-child {
  color: #f6f3e9;
  font-size: 0.82rem;
  font-weight: 650;
}
.drever-browser-gate__status {
  padding: 1rem;
  border: 1px solid rgb(246 243 233 / 12%);
  border-radius: 0.9rem;
  background: rgb(246 243 233 / 5%);
}
.drever-browser-gate ul {
  display: grid;
  margin: 1rem 0 0;
  padding: 0;
  gap: 0.35rem;
  list-style: none;
}
.drever-browser-gate li {
  display: none;
  min-height: 2.5rem;
  padding: 0.65rem 0.75rem;
  border-radius: 0.5rem;
  align-items: center;
  gap: 0.65rem;
  background: rgb(246 243 233 / 4%);
  font-size: 0.76rem;
}
.drever-browser-gate li::before {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  background: #c7f03a;
  box-shadow: 0 0 0 0.22rem rgb(199 240 58 / 10%);
  content: "";
}
html[data-drever-browser-missing~="navigation"] [data-drever-browser-feature="navigation"],
html[data-drever-browser-missing~="document-view-transition"]
  [data-drever-browser-feature="document-view-transition"],
html[data-drever-browser-missing~="broadcast-channel"]
  [data-drever-browser-feature="broadcast-channel"],
html[data-drever-browser-missing~="resize-observer"]
  [data-drever-browser-feature="resize-observer"] {
  display: flex;
}
@media (max-width: 48rem) {
  .drever-browser-gate header span {
    display: none;
  }
  .drever-browser-gate__layout {
    grid-template-columns: 1fr;
  }
}
</style>`;

const browserSupportGate = `<main
      class="drever-browser-gate"
      data-drever-browser-support-gate
      data-nosnippet
      aria-labelledby="drever-browser-support-title"
    >
      <header>
        <strong>Drever</strong>
        <span>Modern browser required</span>
      </header>
      <div class="drever-browser-gate__layout">
        <section class="drever-browser-gate__copy">
          <span>The browser is part of the canvas.</span>
          <h1 id="drever-browser-support-title">This browser can’t run this deck.</h1>
          <p>
            Drever uses native navigation and document-level View Transitions without a legacy
            fallback.
          </p>
          <p>Open this presentation in a current Safari or Chromium-family browser to continue.</p>
        </section>
        <aside class="drever-browser-gate__status" aria-label="Required browser capabilities">
          <span>Missing capability</span>
          <ul>
            <li data-drever-browser-feature="navigation">
              Navigation API with NavigateEvent.signal
            </li>
            <li data-drever-browser-feature="document-view-transition">
              Document View Transitions
            </li>
            <li data-drever-browser-feature="broadcast-channel">BroadcastChannel</li>
            <li data-drever-browser-feature="resize-observer">ResizeObserver</li>
          </ul>
        </aside>
      </div>
    </main>`;

const loadingStyles = `<style data-drever-loading-styles>
.drever-loading {
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  padding: 2rem;
  overflow: hidden;
  background:
    radial-gradient(circle at 54% 120%, rgb(93 72 214 / 20%), transparent 32rem),
    #111018;
  color: #f6f3e9;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  animation: drever-loading-appear 180ms ease 180ms both;
}
.drever-loading__content {
  width: min(100%, 19rem);
}
.drever-loading__brand {
  display: flex;
  align-items: center;
  gap: 0.72rem;
  font-size: 0.88rem;
  font-weight: 680;
  letter-spacing: -0.025em;
}
.drever-loading__brand svg {
  width: 1.55rem;
  height: 1.55rem;
}
.drever-loading p {
  margin: 1.35rem 0 0.7rem;
  color: #aaa7b7;
  font-size: 0.72rem;
  font-weight: 650;
  letter-spacing: 0.085em;
  text-transform: uppercase;
}
.drever-loading__track {
  position: relative;
  height: 2px;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(246 243 233 / 10%);
}
.drever-loading__track::after {
  position: absolute;
  inset: 0 auto 0 0;
  width: 42%;
  border-radius: inherit;
  background: linear-gradient(90deg, #5d48d6, #c7f03a);
  content: "";
  animation: drever-loading-progress 1.15s cubic-bezier(0.65, 0, 0.35, 1) infinite;
}
html:not([data-drever-browser-support="supported"]) .drever-loading {
  display: none;
}
@keyframes drever-loading-appear {
  from {
    opacity: 0;
  }
}
@keyframes drever-loading-progress {
  from {
    translate: -115% 0;
  }
  to {
    translate: 275% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .drever-loading {
    animation-duration: 1ms;
    animation-delay: 0ms;
  }
  .drever-loading__track::after {
    width: 100%;
    animation: none;
  }
}
</style>`;

const loadingShell = `<div class="drever-loading" data-drever-loading role="status">
      <div class="drever-loading__content">
        <div class="drever-loading__brand">
          <svg aria-hidden="true" viewBox="0 0 64 64">
            <path fill="#c7f03a" d="M4 13h12v6H4zm16 0h12v6H20z" />
            <path fill="currentColor" d="M36 13h22v39H6V30h8v14h36V21H36z" />
          </svg>
          <span>Drever</span>
        </div>
        <p>Preparing the presentation</p>
        <div class="drever-loading__track" aria-hidden="true"></div>
      </div>
    </div>`;

const exportBootstrapReporter = `<script data-drever-export-bootstrap>
const __dreverExportRecord = (value) =>
  typeof value === "object" && value !== null ? value : undefined;
const __dreverExportField = (source, name) =>
  typeof source?.[name] === "string" ? source[name] : undefined;
const __dreverExportSnapshot = (reason) => {
  const source = __dreverExportRecord(reason);
  const details = __dreverExportRecord(source?.details);
  const context = (name) => __dreverExportField(source, name) ?? __dreverExportField(details, name);
  const name = __dreverExportField(source, "name") ?? "Error";
  const message = __dreverExportField(source, "message") ?? String(reason);
  const code = __dreverExportField(source, "code");
  const stack = __dreverExportField(source, "stack");
  const owner = context("owner");
  const capability = context("capability");
  const specifier = context("specifier");
  return {
    name,
    message,
    ...(code === undefined ? {} : { code }),
    ...(source?.details === undefined ? {} : { details: source.details }),
    ...(stack === undefined ? {} : { stack }),
    ...(owner === undefined ? {} : { owner }),
    ...(capability === undefined ? {} : { capability }),
    ...(specifier === undefined ? {} : { specifier }),
  };
};
const __dreverMarkExportBootstrapFailure = (reason) => {
  const root = document.documentElement;
  const snapshot = __dreverExportSnapshot(reason);
  root.dataset.dreverExportStatus = "failed";
  try {
    root.dataset.dreverExportError = JSON.stringify(snapshot);
  } catch {
    root.dataset.dreverExportError = JSON.stringify({
      name: snapshot.name,
      message: snapshot.message,
      ...(snapshot.code === undefined ? {} : { code: snapshot.code }),
      details: "The error details were not serializable.",
    });
  }
};
globalThis.addEventListener("error", (event) => {
  __dreverMarkExportBootstrapFailure(event.error ?? new Error(event.message));
});
globalThis.addEventListener("unhandledrejection", (event) => {
  __dreverMarkExportBootstrapFailure(event.reason);
});
</script>`;

const applicationHtml = ({
  bootstrap = "",
  browserSupport = true,
}: Readonly<{
  bootstrap?: string;
  browserSupport?: boolean;
}> = {}): string => `<!doctype html>
<html lang="en"${
  browserSupport
    ? `
  data-drever-browser-support="checking"
  data-drever-browser-missing="navigation document-view-transition broadcast-channel resize-observer"`
    : ""
}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <meta name="drever-base" content="/" />
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" />
    <title>Drever</title>
    ${
      browserSupport
        ? `${browserSupportStyles}\n    ${loadingStyles}\n    ${browserSupportBootstrap}`
        : ""
    }
  </head>
  <body>
    ${browserSupport ? browserSupportGate : ""}
    <main id="drever-root"></main>
    ${browserSupport ? loadingShell : ""}
${bootstrap}
    <script type="module" src="/entry.js"></script>
  </body>
</html>
`;

const stageModuleSource = (
  stage: PrivateAppOptions["stage"],
): Readonly<{ imports: string; option: string }> => {
  const imports = [
    stage?.background === undefined
      ? undefined
      : `import StageBackground from ${JSON.stringify(stage.background)};`,
    stage?.foreground === undefined
      ? undefined
      : `import StageForeground from ${JSON.stringify(stage.foreground)};`,
  ].filter((entry): entry is string => entry !== undefined);
  const components = [
    stage?.background === undefined ? undefined : "background: StageBackground",
    stage?.foreground === undefined ? undefined : "foreground: StageForeground",
  ].filter((entry): entry is string => entry !== undefined);
  return Object.freeze({
    imports: imports.length === 0 ? "" : `${imports.join("\n")}\n`,
    option: components.length === 0 ? "" : `\n  stage: { ${components.join(", ")} },`,
  });
};

const viewerModuleSource = (
  entry: string,
  { canvas, focusTools, rehearsal, stage }: PrivateAppOptions,
): string => {
  const stageSource = stageModuleSource(stage);
  const speakerOptions =
    rehearsal === undefined
      ? "interactiveOptions"
      : `{
      ...interactiveOptions,
      rehearsal: ${JSON.stringify(rehearsal)},
    }`;
  return `import { createDocument, createSpeaker, createViewer } from "@drever/client";
import "@drever/client/styles.css";
import Content, { deckManifest } from ${JSON.stringify(entry)};
import { components } from "virtual:drever/mdx-components";
import { runSetup, theme } from "virtual:drever/runtime";
${stageSource.imports}import "virtual:drever/styles.css";

if (document.documentElement.dataset.dreverBrowserSupport !== "supported") {
  await new Promise(() => undefined);
}

const container = document.querySelector("#drever-root");
const loading = document.querySelector("[data-drever-loading]");
const base = document.querySelector('meta[name="drever-base"]');
if (!(container instanceof Element)) {
  throw new Error("Drever could not find its viewer root.");
}
if (!(base instanceof HTMLMetaElement)) {
  throw new Error("Drever could not find its route base.");
}
container.removeAttribute("data-drever-ready");

const reportPresentationError = (error) => globalThis.reportError(error);
const baseURL = new URL(base.content, document.baseURI);
const relativePath = new URL(document.URL).pathname.slice(baseURL.pathname.length);
const routePath = relativePath.replace(/\\/+$/u, "");
const presentationOptions = {
  baseURL,
  Content,
  container,
  manifest: deckManifest,
  onError: reportPresentationError,
  registry: components,
  runtime: { runSetup, theme },${canvas === undefined ? "" : `\n  canvas: ${JSON.stringify(canvas)},`}${stageSource.option}
};
const interactiveOptions = ${
    focusTools === undefined
      ? "presentationOptions"
      : `{
  ...presentationOptions,
  focusTools: ${JSON.stringify(focusTools)},
}`
  };
let presentation;
try {
  presentation = routePath === "document"
    ? await createDocument(presentationOptions)
    : routePath === "speaker" || routePath.startsWith("speaker/")
      ? await createSpeaker(${speakerOptions})
      : await createViewer(interactiveOptions);
} finally {
  loading?.remove();
}
container.setAttribute("data-drever-ready", "");

if (import.meta.hot) {
  let stopPublishingCurrentPosition;
  if (
    typeof presentation.getPosition === "function" &&
    typeof presentation.subscribe === "function"
  ) {
    const surface = routePath === "speaker" || routePath.startsWith("speaker/")
      ? "speaker"
      : "audience";
    const selectedAttribute = "data-drever-dev-selected";
    let selectedElement;
    const selectionStyle = document.createElement("style");
    selectionStyle.textContent = \`
      [\${selectedAttribute}] {
        outline: 2px solid color-mix(in oklab, Highlight 72%, transparent);
        outline-offset: 3px;
      }
    \`;
    document.head.append(selectionStyle);
    const readSourceRange = (element) => {
      const encoded = element.getAttribute("data-drever-dev-source-range");
      const path = element.getAttribute("data-drever-dev-source-path");
      if (encoded === null || path === null || path.length === 0) return;
      const coordinates = encoded.split(":").map(Number);
      if (
        coordinates.length !== 6 ||
        !coordinates.every(Number.isSafeInteger) ||
        coordinates[0] < 1 ||
        coordinates[1] < 1 ||
        coordinates[2] < 0 ||
        coordinates[3] < 1 ||
        coordinates[4] < 1 ||
        coordinates[5] < coordinates[2] ||
        coordinates[3] < coordinates[0] ||
        (coordinates[3] === coordinates[0] && coordinates[4] < coordinates[1])
      ) {
        return;
      }
      return {
        path,
        start: { line: coordinates[0], column: coordinates[1], offset: coordinates[2] },
        end: { line: coordinates[3], column: coordinates[4], offset: coordinates[5] },
      };
    };
    const readElementSelection = (element) => {
      const sourceRange = readSourceRange(element);
      const tag = element.getAttribute("data-drever-dev-source-tag");
      if (sourceRange === undefined || tag === null || tag.length === 0) return;
      const text = (
        element.getAttribute("alt") ??
        element.getAttribute("aria-label") ??
        element.textContent ??
        ""
      ).replace(/\\s+/gu, " ").trim();
      return { sourceRange, tag, text };
    };
    const updateSelectedElement = (element) => {
      selectedElement?.removeAttribute(selectedAttribute);
      selectedElement = element;
      selectedElement?.setAttribute(selectedAttribute, "");
    };
    const currentSelection = (position) => {
      if (selectedElement === undefined) return;
      const slide = selectedElement.closest("[data-drever-slide]");
      if (
        !selectedElement.isConnected ||
        slide?.getAttribute("data-slide-index") !== String(position.slideIndex)
      ) {
        updateSelectedElement(undefined);
        return;
      }
      const selection = readElementSelection(selectedElement);
      if (selection === undefined) {
        updateSelectedElement(undefined);
      }
      return selection;
    };
    const publishCurrentPosition = () => {
      const url = new URL(document.URL);
      const position = presentation.getPosition();
      const selection = currentSelection(position);
      import.meta.hot.send("drever:current-position", {
        position,
        route: url.pathname + url.search + url.hash,
        ...(selection === undefined ? {} : { selection }),
        surface,
      });
    };
    const selectElement = (event) => {
      if (!event.altKey) return;
      const target = event.target instanceof Element ? event.target : undefined;
      const element = target?.closest("[data-drever-dev-source-range]");
      const slide = element?.closest("[data-drever-slide]");
      const position = presentation.getPosition();
      const selection =
        element !== undefined &&
        element !== null &&
        container.contains(element) &&
        slide?.getAttribute("data-slide-index") === String(position.slideIndex) &&
        readElementSelection(element) !== undefined
          ? element
          : undefined;
      if (selection === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      updateSelectedElement(selection);
      publishCurrentPosition();
    };
    const clearSelection = (event) => {
      if (event.key !== "Escape" || selectedElement === undefined) return;
      updateSelectedElement(undefined);
      publishCurrentPosition();
    };
    const selectionObserver = new MutationObserver((mutations) => {
      if (
        selectedElement !== undefined &&
        mutations.some(
          (mutation) =>
            (mutation.type !== "attributes" || mutation.attributeName !== selectedAttribute) &&
            (!selectedElement.isConnected ||
              mutation.target === selectedElement ||
              selectedElement.contains(mutation.target)),
        )
      ) {
        publishCurrentPosition();
      }
    });
    const stopPositionSubscription = presentation.subscribe(publishCurrentPosition);
    globalThis.navigation.addEventListener("currententrychange", publishCurrentPosition);
    globalThis.addEventListener("click", selectElement, true);
    globalThis.addEventListener("keydown", clearSelection, true);
    selectionObserver.observe(container, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
    stopPublishingCurrentPosition = () => {
      stopPositionSubscription();
      globalThis.navigation.removeEventListener("currententrychange", publishCurrentPosition);
      globalThis.removeEventListener("click", selectElement, true);
      globalThis.removeEventListener("keydown", clearSelection, true);
      selectionObserver.disconnect();
      selectionStyle.remove();
    };
    publishCurrentPosition();
  }
  import.meta.hot.dispose(() => {
    stopPublishingCurrentPosition?.();
    void presentation.destroy().catch(reportPresentationError);
  });
}
`;
};

const exportModuleSource = (
  entry: string,
  { canvas, includeSteps, stage }: PrivateExportAppOptions,
): string => {
  const stageSource = stageModuleSource(stage);
  return `import { createExport } from "@drever/client";
import "@drever/client/styles.css";
import Content, { deckManifest } from ${JSON.stringify(entry)};
import { components } from "virtual:drever/mdx-components";
import { runExportSetup } from "virtual:drever/export-runtime";
${stageSource.imports}import "virtual:drever/styles.css";

const container = document.querySelector("#drever-root");
if (!(container instanceof Element)) {
  throw new Error("Drever could not find its export root.");
}

globalThis.__dreverExportHandle = await createExport({
  Content,
  container,
  manifest: deckManifest,
  registry: components,
  runExportSetup,
  includeSteps: ${JSON.stringify(includeSteps)},${canvas === undefined ? "" : `\n  canvas: ${JSON.stringify(canvas)},`}${stageSource.option}
});
`;
};

type GeneratedFileWriter = (path: string, contents: string) => Promise<void>;

/** @internal Creates an isolated generated application with transactional initial writes. */
export const createGeneratedApp = async (
  prefix: string,
  source: string,
  documentSource: string,
  writeGeneratedFile: GeneratedFileWriter = (path, contents) => writeFile(path, contents, "utf8"),
): Promise<PrivateApp> => {
  const root = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  const writes = await Promise.allSettled([
    writeGeneratedFile(join(root, "index.html"), documentSource),
    writeGeneratedFile(join(root, "entry.js"), source),
  ]);
  const failure = writes.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") {
    await rm(root, { force: true, recursive: true });
    throw failure.reason;
  }
  let disposal: Promise<void> | undefined;
  return Object.freeze({
    dispose() {
      disposal ??= rm(root, { force: true, recursive: true });
      return disposal;
    },
    root,
  });
};

export const createPrivateApp = async (
  entry: string,
  options: PrivateAppOptions = {},
): Promise<PrivateApp> =>
  createGeneratedApp("drever-app-", viewerModuleSource(entry, options), applicationHtml());

/** @internal Generates the isolated document used only by deterministic exporters. */
export const createPrivateExportApp = async (
  entry: string,
  options: PrivateExportAppOptions,
): Promise<PrivateApp> =>
  createGeneratedApp(
    "drever-export-app-",
    exportModuleSource(entry, options),
    applicationHtml({
      bootstrap: exportBootstrapReporter,
      browserSupport: false,
    }),
  );
