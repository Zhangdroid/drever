import { cp, lstat, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

export const RELEASE_SMOKE_SCHEMA_VERSION = 1;
export const MAX_SLIDES = 6;
export const MAX_SOURCE_FILES = 80;
export const MAX_SOURCE_FILE_BYTES = 1_000_000;
export const MAX_SOURCE_BYTES = 8_000_000;

const sourceDirectories = new Set([
  "assets",
  "components",
  "design",
  "public",
  "src",
  "stage",
  "styles",
]);
const sourceExtensions = new Set([".css", ".js", ".jsx", ".md", ".mdx", ".svg", ".ts", ".tsx"]);
const sourceExactPaths = new Set([
  "brief.md",
  "drever.config.js",
  "drever.config.mjs",
  "drever.config.ts",
  "slides.mdx",
  "vite-env.d.ts",
]);
const secretPatterns = [
  /\b(?:sk|sess)-[A-Za-z0-9_-]{16,}\b/gu,
  /\bnpm_[A-Za-z0-9]{16,}\b/gu,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{16,}\b/gu,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/giu,
];
const ansiPattern = new RegExp(
  `${String.fromCodePoint(0x1b)}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`,
  "gu",
);
const remoteAssetPatterns = [
  /!\[[^\]]*\]\(\s*https?:\/\//iu,
  /<(?:audio|iframe|img|source|video)\b[^>]*\bsrc\s*=\s*["']https?:\/\//iu,
  /(?:@import|url)\s*\(\s*["']?https?:\/\//iu,
  /\bfetch\s*\(\s*["']https?:\/\//iu,
  /\bimport\s*(?:\(|[^"']*from\s*)["']https?:\/\//iu,
];

const portablePath = (path) => path.split(sep).join("/");
const isChildPath = (root, path) => path === root || path.startsWith(`${root}${sep}`);
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
export const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

export const createCodexExecArguments = ({ model, threadId, turn }) => {
  const options = [
    "--json",
    "--skip-git-repo-check",
    "--dangerously-bypass-hook-trust",
    "--enable",
    "hooks",
    "-c",
    'default_permissions=":workspace"',
    "-c",
    'approval_policy="never"',
    "-c",
    'web_search="disabled"',
    "-c",
    'model_reasoning_effort="high"',
    ...(model === undefined || model === "" ? [] : ["-m", model]),
  ];
  return threadId === undefined
    ? ["exec", ...options, turn]
    : ["exec", ...options, "resume", threadId, turn];
};

export const releaseSmokeDeckMount = (runId, scenarioId) => {
  if (!/^\d+$/u.test(runId)) throw new Error(`Invalid release smoke run id: ${runId}`);
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(scenarioId)) {
    throw new Error(`Invalid release smoke scenario id: ${scenarioId}`);
  }
  return `/release-smoke/runs/${runId}/${scenarioId}/deck`;
};

export const relativeMountedPathname = (pathname, mountPath) => {
  const mount = mountPath.endsWith("/") ? mountPath.slice(0, -1) : mountPath;
  if (!mount.startsWith("/") || mount === "") {
    throw new Error(`Invalid release smoke mount path: ${mountPath}`);
  }
  if (pathname === mount || pathname === `${mount}/`) return "/";
  return pathname.startsWith(`${mount}/`) ? pathname.slice(mount.length) : undefined;
};

export const sanitizeTranscriptText = (value, workspace = "") => {
  let sanitized = value.replaceAll(ansiPattern, "");
  for (const pattern of secretPatterns) sanitized = sanitized.replaceAll(pattern, "[redacted]");
  if (workspace !== "") sanitized = sanitized.replaceAll(resolve(workspace), "<project>");
  return sanitized.trim().slice(0, 20_000);
};

export const parseCodexJsonl = (source) => {
  const events = source
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
  const started = events.find((event) => event.type === "thread.started");
  if (typeof started?.thread_id !== "string" || started.thread_id === "") {
    throw new Error("Codex did not emit a thread id.");
  }
  const messages = events
    .filter(
      (event) =>
        event.type === "item.completed" &&
        event.item?.type === "agent_message" &&
        typeof event.item.text === "string",
    )
    .map((event) => event.item.text);
  const message = messages.at(-1);
  if (message === undefined || message.trim() === "") {
    throw new Error("Codex did not emit a final assistant message.");
  }
  const completed = events.findLast((event) => event.type === "turn.completed");
  return {
    message,
    threadId: started.thread_id,
    usage:
      typeof completed?.usage === "object" && completed.usage !== null
        ? completed.usage
        : undefined,
  };
};

const isAllowedSourcePath = (path) => {
  if (sourceExactPaths.has(path)) return true;
  const segments = path.split("/");
  if (segments.length === 1) {
    return sourceExtensions.has(extname(path)) && !path.startsWith(".");
  }
  return sourceDirectories.has(segments[0]) && sourceExtensions.has(extname(path));
};

const walkSourceCandidates = async (root, directory = root) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    const relativePath = portablePath(relative(root, path));
    if (entry.isSymbolicLink()) {
      if (isAllowedSourcePath(relativePath)) {
        throw new Error(`Release smoke source cannot contain a symlink: ${relativePath}`);
      }
      continue;
    }
    if (entry.isDirectory()) {
      if (directory === root && sourceDirectories.has(entry.name)) {
        paths.push(...(await walkSourceCandidates(root, path)));
      }
      continue;
    }
    if (entry.isFile() && isAllowedSourcePath(relativePath)) paths.push(relativePath);
  }

  return paths;
};

export const collectReleaseSmokeSource = async (projectRoot, destination) => {
  const root = resolve(projectRoot);
  const target = resolve(destination);
  if (isChildPath(root, target)) {
    throw new Error("Release smoke source output must be outside the generated project.");
  }
  const files = (await walkSourceCandidates(root)).sort();
  if (!files.includes("slides.mdx")) throw new Error("Generated source is missing slides.mdx.");
  if (files.length > MAX_SOURCE_FILES) {
    throw new Error(
      `Generated source contains ${files.length} files; limit is ${MAX_SOURCE_FILES}.`,
    );
  }

  const contents = [];
  let totalBytes = 0;
  for (const path of files) {
    const absolutePath = join(root, ...path.split("/"));
    const metadata = await lstat(absolutePath);
    if (!metadata.isFile()) throw new Error(`Generated source is not a regular file: ${path}`);
    if (metadata.size > MAX_SOURCE_FILE_BYTES) {
      throw new Error(`Generated source file exceeds the size limit: ${path}`);
    }
    totalBytes += metadata.size;
    if (totalBytes > MAX_SOURCE_BYTES) {
      throw new Error(`Generated source exceeds the ${MAX_SOURCE_BYTES} byte limit.`);
    }
    const content = await readFile(absolutePath, "utf8");
    const secretPattern = secretPatterns.find((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(content);
    });
    if (secretPattern !== undefined) {
      throw new Error(`Generated source contains a credential-shaped value: ${path}`);
    }
    const remotePattern = remoteAssetPatterns.find((pattern) => pattern.test(content));
    if (remotePattern !== undefined) {
      throw new Error(`Generated source references a remote asset: ${path}`);
    }
    contents.push({ content, path });
  }

  await rm(target, { force: true, recursive: true });
  for (const { content, path } of contents) {
    const output = join(target, ...path.split("/"));
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, content, "utf8");
  }
  return Object.freeze({
    bytes: totalBytes,
    files: Object.freeze(files),
  });
};

export const copyReleaseSmokeSource = async (source, projectRoot) => {
  const root = resolve(source);
  const project = resolve(projectRoot);
  const files = (await walkSourceCandidates(root)).sort();
  if (!files.includes("slides.mdx"))
    throw new Error("Release smoke artifact is missing slides.mdx.");
  for (const path of files) {
    const input = join(root, ...path.split("/"));
    const output = join(project, ...path.split("/"));
    const metadata = await lstat(input);
    if (!metadata.isFile()) throw new Error(`Release smoke artifact is invalid: ${path}`);
    await mkdir(dirname(output), { recursive: true });
    await cp(input, output);
  }
  return files;
};

export const assertReleaseSmokeContext = (context) => {
  if (context?.version !== 1 || !Array.isArray(context?.deck?.slides)) {
    throw new Error("Drever context returned an invalid authoring receipt.");
  }
  const slideCount = context.deck.slides.length;
  if (slideCount < 1 || slideCount > MAX_SLIDES) {
    throw new Error(`Release smoke deck has ${slideCount} slides; expected 1-${MAX_SLIDES}.`);
  }
  const speakerNoteCount = context.deck.slides.reduce(
    (count, slide) => count + (Array.isArray(slide?.speakerNotes) ? slide.speakerNotes.length : 0),
    0,
  );
  return { slideCount, speakerNoteCount };
};

export const mergeReleaseSmokeManifest = (manifest, entry, limit = 10) => {
  const existing =
    manifest?.schemaVersion === RELEASE_SMOKE_SCHEMA_VERSION && Array.isArray(manifest.runs)
      ? manifest.runs
      : [];
  const runs = [entry, ...existing.filter((candidate) => candidate?.id !== entry.id)].slice(
    0,
    limit,
  );
  return {
    schemaVersion: RELEASE_SMOKE_SCHEMA_VERSION,
    latestRunId: entry.id,
    runs,
  };
};

export const readOptionalJson = async (path, fallback) => {
  try {
    return await readJson(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return fallback;
    throw error;
  }
};
