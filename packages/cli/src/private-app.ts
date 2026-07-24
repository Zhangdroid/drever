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

const applicationHtml = (bootstrap = ""): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <meta name="drever-base" content="/" />
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" />
    <title>Drever</title>
  </head>
  <body>
    <main id="drever-root"></main>
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

const container = document.querySelector("#drever-root");
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
const presentation = routePath === "document"
  ? await createDocument(presentationOptions)
  : routePath === "speaker" || routePath.startsWith("speaker/")
    ? await createSpeaker(${speakerOptions})
    : await createViewer(interactiveOptions);
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
    applicationHtml(exportBootstrapReporter),
  );
