import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type PrivateApp = Readonly<{
  dispose(): Promise<void>;
  root: string;
}>;

export type PrivateExportAppOptions = Readonly<{
  canvas?: Readonly<{ height: number; width: number }>;
  includeSteps: boolean;
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

const viewerModuleSource = (
  entry: string,
  canvas: Readonly<{ height: number; width: number }> | undefined,
): string => `import { createDocument, createSpeaker, createViewer } from "@drever/client";
import "@drever/client/styles.css";
import Content, { deckManifest } from ${JSON.stringify(entry)};
import { components } from "virtual:drever/mdx-components";
import { motion, runSetup, theme } from "virtual:drever/runtime";
import "virtual:drever/styles.css";

const container = document.querySelector("#drever-root");
const base = document.querySelector('meta[name="drever-base"]');
if (!(container instanceof Element)) {
  throw new Error("Drever could not find its viewer root.");
}
if (!(base instanceof HTMLMetaElement)) {
  throw new Error("Drever could not find its route base.");
}

const reportPresentationError = (error) => globalThis.reportError(error);
const baseURL = new URL(base.content, document.baseURI);
const relativePath = new URL(document.URL).pathname.slice(baseURL.pathname.length);
const routePath = relativePath.replace(/\\/+$/u, "");
const createPresentation = routePath === "document"
  ? createDocument
  : routePath === "speaker" || routePath.startsWith("speaker/")
    ? createSpeaker
    : createViewer;
const presentation = await createPresentation({
  baseURL,
  Content,
  container,
  manifest: deckManifest,
  onError: reportPresentationError,
  registry: components,
  runtime: { motion, runSetup, theme },${canvas === undefined ? "" : `\n  canvas: ${JSON.stringify(canvas)},`}
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void presentation.destroy().catch(reportPresentationError);
  });
}
`;

const exportModuleSource = (
  entry: string,
  { canvas, includeSteps }: PrivateExportAppOptions,
): string => `import { createExport } from "@drever/client";
import "@drever/client/styles.css";
import Content, { deckManifest } from ${JSON.stringify(entry)};
import { components } from "virtual:drever/mdx-components";
import { runExportSetup } from "virtual:drever/export-runtime";
import "virtual:drever/styles.css";

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
  includeSteps: ${JSON.stringify(includeSteps)},${canvas === undefined ? "" : `\n  canvas: ${JSON.stringify(canvas)},`}
});
`;

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
  canvas?: Readonly<{ height: number; width: number }>,
): Promise<PrivateApp> =>
  createGeneratedApp("drever-app-", viewerModuleSource(entry, canvas), applicationHtml());

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
