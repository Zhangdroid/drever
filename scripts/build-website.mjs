import { spawn } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import {
  demoMounts,
  documentationRoutes,
  publicPresentationMounts,
  siteRoutes,
} from "../website/site-manifest.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const websiteOutput = join(root, "website", "dist", "client");
const dreverBin = join(root, "packages", "cli", "dist", "bin.mjs");

const run = (command, args, cwd = root) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", rejectRun);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(
        new Error(
          signal
            ? `${command} was terminated by ${signal}.`
            : `${command} exited with code ${String(code)}.`,
        ),
      );
    });
  });

const collectFiles = async (directory, extension) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path, extension)));
    } else if (entry.name.endsWith(extension)) {
      files.push(path);
    }
  }

  return files;
};

const escapeAttribute = (value) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

const decoratePresentation = async (presentation, destination) => {
  const title = `${presentation.label} — Drever`;
  const canonical = `https://drever.dev/demos/${presentation.slug}/`;
  const htmlFiles = await collectFiles(destination, ".html");

  await Promise.all(
    htmlFiles.map(async (path) => {
      const isRoot = path === join(destination, "index.html");
      const metadata = [
        `<meta name="description" content="${escapeAttribute(presentation.description)}" />`,
        ...(isRoot ? [] : ['<meta name="robots" content="noindex, follow" />']),
        `<link rel="canonical" href="${canonical}" />`,
        `<meta property="og:title" content="${escapeAttribute(title)}" />`,
        `<meta property="og:description" content="${escapeAttribute(presentation.description)}" />`,
        '<meta property="og:type" content="website" />',
        `<meta property="og:url" content="${canonical}" />`,
        '<meta name="twitter:card" content="summary" />',
      ].join("\n    ");
      const html = (await readFile(path, "utf8"))
        .replace(
          /<link rel="icon"[^>]*>/u,
          '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
        )
        .replace("<title>Drever</title>", `<title>${escapeAttribute(title)}</title>`)
        .replace("</head>", `    ${metadata}\n  </head>`);
      await writeFile(path, html);
    }),
  );
};

const presentationOutput = (presentation) =>
  join(root, "examples", presentation.source, presentation.output ?? "dist");

const build = async () => {
  await run("vp", ["run", "build:packages"]);
  const presentationSources = new Set(
    publicPresentationMounts.map((presentation) => presentation.source),
  );
  await Promise.all([
    rm(join(root, "website", "dist"), { force: true, recursive: true }),
    ...presentationSources
      .values()
      .map((source) =>
        rm(join(root, "examples", source, "dist"), { force: true, recursive: true }),
      ),
  ]);

  await Promise.all([
    run("vp", ["run", "-F", "@drever/website", "build"]),
    ...demoMounts.map((demo) =>
      run(process.execPath, [dreverBin, "build"], join(root, "examples", demo.source)),
    ),
    run("vp", ["run", "-F", "@drever/example-theme-showcase", "build:all"]),
  ]);
};

const assemblePresentations = async () => {
  const demosOutput = join(websiteOutput, "demos");
  await mkdir(demosOutput, { recursive: true });

  await Promise.all(
    publicPresentationMounts.map(async (presentation) => {
      const source = presentationOutput(presentation);
      const destination = join(demosOutput, presentation.slug);
      await rm(destination, { force: true, recursive: true });
      await cp(source, destination, { recursive: true });
      await decoratePresentation(presentation, destination);
    }),
  );
};

const routeOutput = (route) => (route === "/" ? "index.html" : `${route.slice(1)}/index.html`);
const siteEntryFiles = siteRoutes.map(routeOutput);

const requiredFiles = [
  "_redirects",
  "404.html",
  "favicon.svg",
  "robots.txt",
  "llms.txt",
  "prompt.md",
  "sitemap.xml",
  ...siteEntryFiles,
  ...publicPresentationMounts.map((presentation) => `demos/${presentation.slug}/index.html`),
  ...publicPresentationMounts.map(
    (presentation) => `demos/${presentation.slug}/document/index.html`,
  ),
  ...publicPresentationMounts.map(
    (presentation) => `demos/${presentation.slug}/speaker/index.html`,
  ),
];

const verifyOutput = async () => {
  await Promise.all(
    requiredFiles.map(async (path) => {
      const result = await stat(join(websiteOutput, path));
      if (!result.isFile()) throw new Error(`Expected website output file: ${path}`);
    }),
  );

  for (const path of siteEntryFiles) {
    const html = await readFile(join(websiteOutput, path), "utf8");
    if (html.includes("noindex")) {
      throw new Error(`Production page must be indexable: ${path}`);
    }
  }

  for (const presentation of publicPresentationMounts) {
    const assets = await readdir(join(websiteOutput, "demos", presentation.slug, "assets"));
    if (assets.length === 0) {
      throw new Error(`Presentation has no built assets: ${presentation.slug}`);
    }

    const rootHtml = await readFile(
      join(websiteOutput, "demos", presentation.slug, "index.html"),
      "utf8",
    );
    const speakerHtml = await readFile(
      join(websiteOutput, "demos", presentation.slug, "speaker", "index.html"),
      "utf8",
    );
    if (
      !rootHtml.includes(`<title>${presentation.label} — Drever</title>`) ||
      !rootHtml.includes(`rel="canonical" href="https://drever.dev/demos/${presentation.slug}/"`) ||
      rootHtml.includes('name="robots" content="noindex')
    ) {
      throw new Error(`Presentation root metadata is incomplete: ${presentation.slug}`);
    }
    if (!speakerHtml.includes('name="robots" content="noindex, follow"')) {
      throw new Error(`Presentation speaker route must not be indexed: ${presentation.slug}`);
    }
  }

  const findDuplicateArtifacts = async (directory, parent = "") => {
    const entries = await readdir(directory, { withFileTypes: true });
    const fileNames = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
    const duplicates = [];

    for (const entry of entries) {
      const relativePath = join(parent, entry.name);
      if (entry.isDirectory()) {
        duplicates.push(
          ...(await findDuplicateArtifacts(join(directory, entry.name), relativePath)),
        );
        continue;
      }

      const copyName = /^(.*) \d+(\.[^.]+)$/u.exec(entry.name);
      if (copyName === null) continue;

      const originalName = `${copyName[1]}${copyName[2]}`;
      if (!fileNames.has(originalName)) continue;

      const [copy, original] = await Promise.all([
        readFile(join(directory, entry.name)),
        readFile(join(directory, originalName)),
      ]);
      if (copy.equals(original)) {
        duplicates.push(relativePath);
      }
    }

    return duplicates;
  };

  const duplicateArtifacts = await findDuplicateArtifacts(websiteOutput);
  if (duplicateArtifacts.length > 0) {
    throw new Error(
      `Website contains duplicate local artifacts:\n${duplicateArtifacts.join("\n")}`,
    );
  }

  const sitemap = await readFile(join(websiteOutput, "sitemap.xml"), "utf8");
  const sitemapLocations = new Set(
    [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]),
  );
  const expectedLocations = new Set([
    ...siteRoutes.map((route) => new URL(route, "https://drever.dev").href),
    ...publicPresentationMounts.map(({ slug }) => `https://drever.dev/demos/${slug}/`),
  ]);
  if (
    sitemapLocations.size !== expectedLocations.size ||
    [...expectedLocations].some((location) => !sitemapLocations.has(location))
  ) {
    throw new Error("Sitemap routes do not match the public site manifest.");
  }

  const llms = await readFile(join(websiteOutput, "llms.txt"), "utf8");
  const missingAgentRoutes = [
    ...documentationRoutes.map((route) => `https://drever.dev${route}`),
    ...publicPresentationMounts.map(({ slug }) => `https://drever.dev/demos/${slug}/`),
  ].filter((location) => !llms.includes(location));
  if (missingAgentRoutes.length > 0) {
    throw new Error(`llms.txt is missing public routes:\n${missingAgentRoutes.join("\n")}`);
  }

  process.stdout.write(`Verified ${requiredFiles.length} website entry points.\n`);
};

await build();
await assemblePresentations();
await verifyOutput();
