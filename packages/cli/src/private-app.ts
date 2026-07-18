import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type PrivateApp = Readonly<{
  dispose(): Promise<void>;
  root: string;
}>;

const html = `<!doctype html>
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
    <script type="module" src="/entry.js"></script>
  </body>
</html>
`;

const moduleSource = (
  entry: string,
  canvas: Readonly<{ height: number; width: number }> | undefined,
): string => `import { createSpeaker, createViewer } from "@drever/client";
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
const createPresentation = relativePath === "speaker" || relativePath.startsWith("speaker/")
  ? createSpeaker
  : createViewer;
const viewer = await createPresentation({
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
    void viewer.destroy().catch(reportPresentationError);
  });
}
`;

export const createPrivateApp = async (
  entry: string,
  canvas?: Readonly<{ height: number; width: number }>,
): Promise<PrivateApp> => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "drever-app-")));
  await Promise.all([
    writeFile(join(root, "index.html"), html, "utf8"),
    writeFile(join(root, "entry.js"), moduleSource(entry, canvas), "utf8"),
  ]);
  let disposal: Promise<void> | undefined;
  return Object.freeze({
    dispose() {
      disposal ??= rm(root, { force: true, recursive: true });
      return disposal;
    },
    root,
  });
};
