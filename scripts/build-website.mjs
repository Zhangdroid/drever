import { spawn } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { demoMounts, documentationRoutes, siteRoutes } from "../website/site-manifest.ts";

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

const decorateDemo = async (demo, destination) => {
  const title = `${demo.label} — Drever`;
  const canonical = `https://drever.dev/demos/${demo.slug}/`;
  const htmlFiles = await collectFiles(destination, ".html");

  await Promise.all(
    htmlFiles.map(async (path) => {
      const isRoot = path === join(destination, "index.html");
      const metadata = [
        `<meta name="description" content="${escapeAttribute(demo.description)}" />`,
        ...(isRoot ? [] : ['<meta name="robots" content="noindex, follow" />']),
        `<link rel="canonical" href="${canonical}" />`,
        `<meta property="og:title" content="${escapeAttribute(title)}" />`,
        `<meta property="og:description" content="${escapeAttribute(demo.description)}" />`,
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

const build = async () => {
  await run("vp", ["run", "build:packages"]);
  await Promise.all([
    rm(join(root, "website", "dist"), { force: true, recursive: true }),
    ...demoMounts.map((demo) =>
      rm(join(root, "examples", demo.source, "dist"), { force: true, recursive: true }),
    ),
  ]);

  await Promise.all([
    run("vp", ["run", "-F", "@drever/website", "build"]),
    ...demoMounts.map((demo) =>
      run(process.execPath, [dreverBin, "build"], join(root, "examples", demo.source)),
    ),
  ]);
};

const assembleDemos = async () => {
  const demosOutput = join(websiteOutput, "demos");
  await mkdir(demosOutput, { recursive: true });

  await Promise.all(
    demoMounts.map(async (demo) => {
      const source = join(root, "examples", demo.source, "dist");
      const destination = join(demosOutput, demo.slug);
      await rm(destination, { force: true, recursive: true });
      await cp(source, destination, { recursive: true });
      await decorateDemo(demo, destination);
    }),
  );
};

const routeOutput = (route) => (route === "/" ? "index.html" : `${route.slice(1)}/index.html`);
const siteEntryFiles = siteRoutes.map(routeOutput);

const requiredFiles = [
  "404.html",
  "favicon.svg",
  "robots.txt",
  "llms.txt",
  "prompt.md",
  "sitemap.xml",
  ...siteEntryFiles,
  ...demoMounts.map((demo) => `demos/${demo.slug}/index.html`),
  ...demoMounts.map((demo) => `demos/${demo.slug}/document/index.html`),
  ...demoMounts.map((demo) => `demos/${demo.slug}/speaker/index.html`),
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

  for (const demo of demoMounts) {
    const assets = await readdir(join(websiteOutput, "demos", demo.slug, "assets"));
    if (assets.length === 0) {
      throw new Error(`Demo has no built assets: ${demo.slug}`);
    }

    const rootHtml = await readFile(join(websiteOutput, "demos", demo.slug, "index.html"), "utf8");
    const speakerHtml = await readFile(
      join(websiteOutput, "demos", demo.slug, "speaker", "index.html"),
      "utf8",
    );
    if (
      !rootHtml.includes(`<title>${demo.label} — Drever</title>`) ||
      !rootHtml.includes(`rel="canonical" href="https://drever.dev/demos/${demo.slug}/"`) ||
      rootHtml.includes('name="robots" content="noindex')
    ) {
      throw new Error(`Demo root metadata is incomplete: ${demo.slug}`);
    }
    if (!speakerHtml.includes('name="robots" content="noindex, follow"')) {
      throw new Error(`Demo speaker route must not be indexed: ${demo.slug}`);
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
    ...demoMounts.map(({ slug }) => `https://drever.dev/demos/${slug}/`),
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
    ...demoMounts.map(({ slug }) => `https://drever.dev/demos/${slug}/`),
  ].filter((location) => !llms.includes(location));
  if (missingAgentRoutes.length > 0) {
    throw new Error(`llms.txt is missing public routes:\n${missingAgentRoutes.join("\n")}`);
  }

  process.stdout.write(`Verified ${requiredFiles.length} website entry points.\n`);
};

await build();
await assembleDemos();
await verifyOutput();
