import { cp, lstat, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { validateDreverDeckPlanValue } from "../../packages/schema/src/deck-plan.ts";
import { RELEASE_SMOKE_CLAUDE_BUDGET_USD, RELEASE_SMOKE_CLAUDE_MAX_TURNS } from "./limits.mjs";
import { getReleaseSmokeProvider } from "./providers.mjs";

export const RELEASE_SMOKE_SCHEMA_VERSION = 1;
export const RELEASE_SMOKE_RUN_SCHEMA_VERSION = 2;
export const MIN_SLIDES = 10;
export const MAX_SLIDES = 14;
export const MAX_SOURCE_FILES = 80;
export const MAX_SOURCE_FILE_BYTES = 1_000_000;
export const MAX_SOURCE_BYTES = 8_000_000;
export const RELEASE_SMOKE_HANDOFF_PATHS = Object.freeze([
  ".agents/skills/drever-author-deck/SKILL.md",
  ".agents/skills/drever-create-deck/SKILL.md",
  ".agents/skills/drever-create-design/SKILL.md",
  ".agents/skills/drever-review-deck/SKILL.md",
  "AGENTS.md",
  "brief.md",
  "drever.plan.json",
  "package.json",
]);
const claudeHandoffPaths = Object.freeze([
  ".claude/skills/drever-author-deck/SKILL.md",
  ".claude/skills/drever-create-deck/SKILL.md",
  ".claude/skills/drever-create-design/SKILL.md",
  ".claude/skills/drever-review-deck/SKILL.md",
  "CLAUDE.md",
  "brief.md",
  "drever.plan.json",
  "package.json",
]);
export const releaseSmokeHandoffPaths = (providerId) =>
  getReleaseSmokeProvider(providerId).id === "claude"
    ? claudeHandoffPaths
    : RELEASE_SMOKE_HANDOFF_PATHS;
export const RELEASE_SMOKE_PRIVATE_PATHS = Object.freeze([
  ".release-smoke/constraints.md",
  ".release-smoke/prompt.md",
]);
export const RELEASE_SMOKE_MUTABLE_HANDOFF_PATHS = Object.freeze([
  "brief.md",
  "drever.plan.json",
  "drever.config.js",
  "drever.config.mjs",
  "drever.config.ts",
]);
export const RELEASE_SMOKE_ARTIFACT_SEED_PATHS = Object.freeze([
  "prompt.json",
  "receipts/handoff.json",
  "receipts/scaffold.json",
]);

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
  "drever.plan.json",
  "drever.config.js",
  "drever.config.mjs",
  "drever.config.ts",
  "slides.mdx",
  "vite-env.d.ts",
]);
const sourceIgnoredPaths = new Set([
  "AGENTS.md",
  "AGENTS.override.md",
  "CLAUDE.md",
  "CLAUDE.local.md",
  "README.md",
]);
const handoffConfigurationPaths = ["drever.config.ts", "drever.config.mjs", "drever.config.js"];
const maxHandoffFileBytes = 1_000_000;
const maxHandoffBytes = 4_000_000;
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
    'model_reasoning_effort="medium"',
    "-c",
    "project_doc_fallback_filenames=[]",
    ...(model === undefined || model === "" ? [] : ["-m", model]),
  ];
  return threadId === undefined
    ? ["exec", ...options, turn]
    : ["exec", ...options, "resume", threadId, turn];
};

export const createClaudePrintArguments = ({
  maxBudgetUsd = RELEASE_SMOKE_CLAUDE_BUDGET_USD,
  model,
  sessionId,
  turn,
}) => {
  if (!Number.isFinite(maxBudgetUsd) || maxBudgetUsd <= 0) {
    throw new Error("Claude release smoke requires a positive remaining budget.");
  }
  return [
    "--bare",
    "--print",
    turn,
    "--output-format",
    "json",
    "--effort",
    "medium",
    "--max-budget-usd",
    maxBudgetUsd.toFixed(4),
    "--max-turns",
    String(RELEASE_SMOKE_CLAUDE_MAX_TURNS),
    "--tools",
    "Edit,Glob,Grep,Read,Write",
    "--permission-mode",
    "dontAsk",
    "--allowedTools",
    "Edit,Glob,Grep,Read,Write",
    "--disallowedTools",
    "Agent,Bash,Task,WebFetch,WebSearch,mcp__*",
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--no-chrome",
    "--disable-slash-commands",
    ...(model === undefined || model === "" ? [] : ["--model", model]),
    ...(sessionId === undefined ? [] : ["--resume", sessionId]),
  ];
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

const findHandoffConfiguration = async (root) => {
  for (const path of handoffConfigurationPaths) {
    try {
      const metadata = await lstat(join(root, path));
      if (!metadata.isFile()) {
        throw new Error(`Release smoke handoff file is not a regular file: ${path}`);
      }
      return path;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  return undefined;
};

const findOptionalHandoffFile = async (root, path) => {
  try {
    const metadata = await lstat(join(root, path));
    if (!metadata.isFile()) {
      throw new Error(`Release smoke handoff file is not a regular file: ${path}`);
    }
    return path;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    return undefined;
  }
};

const copyBoundedRegularFiles = async (sourceRoot, destinationRoot, paths) => {
  const source = resolve(sourceRoot);
  const destination = resolve(destinationRoot);
  if (isChildPath(source, destination) || isChildPath(destination, source)) {
    throw new Error("Release smoke source and destination roots must be separate.");
  }

  const contents = [];
  let totalBytes = 0;
  for (const path of paths) {
    const input = join(source, ...path.split("/"));
    const metadata = await lstat(input);
    if (!metadata.isFile()) {
      throw new Error(`Release smoke handoff file is not a regular file: ${path}`);
    }
    if (metadata.size > maxHandoffFileBytes) {
      throw new Error(`Release smoke handoff file exceeds the size limit: ${path}`);
    }
    totalBytes += metadata.size;
    if (totalBytes > maxHandoffBytes) {
      throw new Error(`Release smoke handoff exceeds the ${maxHandoffBytes} byte limit.`);
    }
    contents.push({ content: await readFile(input), path });
  }

  await rm(destination, { force: true, recursive: true });
  for (const { content, path } of contents) {
    const output = join(destination, ...path.split("/"));
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, content);
  }
  return Object.freeze({
    bytes: totalBytes,
    files: Object.freeze([...paths].sort((left, right) => left.localeCompare(right))),
  });
};

export const copyReleaseSmokeHandoff = async (
  sourceRoot,
  projectRoot,
  { includePrivate = false, providerId = "codex" } = {},
) => {
  const source = resolve(sourceRoot);
  const [configuration, deckPlan] = await Promise.all([
    findHandoffConfiguration(source),
    findOptionalHandoffFile(source, "drever.plan.json"),
  ]);
  const files = [
    ...releaseSmokeHandoffPaths(providerId).filter(
      (path) => path !== "drever.plan.json" || deckPlan !== undefined,
    ),
    ...(includePrivate ? RELEASE_SMOKE_PRIVATE_PATHS : []),
    ...(configuration === undefined ? [] : [configuration]),
  ];
  return copyBoundedRegularFiles(source, projectRoot, files);
};

export const copyReleaseSmokeArtifactSeed = (sourceRoot, artifactRoot) =>
  copyBoundedRegularFiles(sourceRoot, artifactRoot, RELEASE_SMOKE_ARTIFACT_SEED_PATHS);

export const snapshotReleaseSmokeGenerationTree = async (projectRoot, immutablePaths) => {
  const root = resolve(projectRoot);
  const snapshot = new Map();
  for (const path of immutablePaths) {
    const absolutePath = join(root, ...path.split("/"));
    const metadata = await lstat(absolutePath);
    if (!metadata.isFile()) {
      throw new Error(`Release smoke immutable file is not a regular file: ${path}`);
    }
    snapshot.set(path, await readFile(absolutePath));
  }
  return snapshot;
};

export const assertReleaseSmokeGenerationTree = async (
  projectRoot,
  immutableSnapshot,
  requiredMutablePaths = [],
) => {
  const root = resolve(projectRoot);
  let fileCount = 0;
  let sourceBytes = 0;

  const visit = async (directory = root) => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      const path = portablePath(relative(root, absolutePath));
      if (entry.isSymbolicLink()) {
        throw new Error(`Release smoke generation tree cannot contain a symlink: ${path}`);
      }
      if (entry.isDirectory()) {
        const firstSegment = path.split("/")[0];
        const isImmutableParent = [...immutableSnapshot.keys()].some((immutablePath) =>
          immutablePath.startsWith(`${path}/`),
        );
        if (!isImmutableParent && !sourceDirectories.has(firstSegment)) {
          throw new Error(`Release smoke generation tree contains an unexpected path: ${path}`);
        }
        await visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`Release smoke generation tree contains a non-file path: ${path}`);
      }

      const immutable = immutableSnapshot.get(path);
      if (immutable !== undefined) {
        const current = await readFile(absolutePath);
        if (!current.equals(immutable)) {
          throw new Error(`Release smoke immutable file changed during generation: ${path}`);
        }
        continue;
      }
      if (!isAllowedSourcePath(path)) {
        throw new Error(`Release smoke generation tree contains an unexpected file: ${path}`);
      }
      const metadata = await lstat(absolutePath);
      if (metadata.size > MAX_SOURCE_FILE_BYTES) {
        throw new Error(`Release smoke source file exceeds the size limit: ${path}`);
      }
      fileCount += 1;
      sourceBytes += metadata.size;
      if (fileCount > MAX_SOURCE_FILES || sourceBytes > MAX_SOURCE_BYTES) {
        throw new Error("Release smoke generation tree exceeds the source limits.");
      }
    }
  };

  await visit();
  for (const path of immutableSnapshot.keys()) {
    try {
      await lstat(join(root, ...path.split("/")));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new Error(`Release smoke immutable file was removed during generation: ${path}`);
      }
      throw error;
    }
  }
  for (const path of requiredMutablePaths) {
    try {
      const metadata = await lstat(join(root, ...path.split("/")));
      if (!metadata.isFile()) {
        throw new Error(`Release smoke required authoring file is not a regular file: ${path}`);
      }
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new Error(`Release smoke required authoring file was removed: ${path}`);
      }
      throw error;
    }
  }
  return Object.freeze({ files: fileCount, bytes: sourceBytes });
};

export const redactStructuredPaths = (value, replacements) => {
  const ordered = [...replacements]
    .map(([path, label]) => [resolve(path), label])
    .sort(([left], [right]) => right.length - left.length);
  const visit = (candidate) => {
    if (typeof candidate === "string") {
      return ordered.reduce((result, [path, label]) => result.replaceAll(path, label), candidate);
    }
    if (Array.isArray(candidate)) return candidate.map(visit);
    if (typeof candidate === "object" && candidate !== null) {
      return Object.fromEntries(
        Object.entries(candidate).map(([key, nested]) => [key, visit(nested)]),
      );
    }
    return candidate;
  };
  return visit(value);
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

export const parseClaudeJson = (source) => {
  const result = JSON.parse(source);
  if (result?.type === "result" && result.is_error === true) {
    if (result.subtype === "error_max_budget_usd") {
      throw new Error(
        `Claude reached the $${String(RELEASE_SMOKE_CLAUDE_BUDGET_USD)} release smoke scenario cost budget.`,
      );
    }
    if (result.subtype === "error_max_turns") {
      throw new Error(
        `Claude reached the ${String(RELEASE_SMOKE_CLAUDE_MAX_TURNS)}-turn release smoke limit.`,
      );
    }
  }
  if (
    result?.type !== "result" ||
    result.is_error === true ||
    typeof result.session_id !== "string" ||
    result.session_id === ""
  ) {
    throw new Error("Claude did not complete a valid session turn.");
  }
  if (typeof result.result !== "string" || result.result.trim() === "") {
    throw new Error("Claude did not emit a final assistant message.");
  }
  return {
    message: result.result,
    sessionId: result.session_id,
    usage: {
      ...(typeof result.usage === "object" && result.usage !== null ? result.usage : {}),
      ...(typeof result.total_cost_usd === "number"
        ? { total_cost_usd: result.total_cost_usd }
        : {}),
    },
  };
};

const isAllowedSourcePath = (path) => {
  if (sourceIgnoredPaths.has(path)) return false;
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

const assertReleaseSmokeBriefShape = (source, status) => {
  if (typeof source !== "string") {
    throw new Error("Generated brief.md is missing.");
  }
  const normalized = source.replaceAll("**", "");
  const statusPattern = new RegExp(
    `^[ \\t]*(?:[-*][ \\t]+)?Status[ \\t]*:[ \\t]*${status}[ \\t]*$`,
    "imu",
  );
  if (!statusPattern.test(normalized)) {
    throw new Error(`Generated brief.md must record Status: ${status}.`);
  }
  if (
    !/^[ \t]*(?:[-*][ \t]+)?Visible slide density[ \t]*:[ \t]*\S(?:[^\r\n]*\S)?[ \t]*$/imu.test(
      normalized,
    )
  ) {
    throw new Error("Generated brief.md must record a nonempty visible slide density.");
  }
  const outlineHeading = /^#{1,6}[ \t]+Slide outline[ \t]*$/imu.exec(normalized);
  const outline =
    outlineHeading === null
      ? undefined
      : normalized
          .slice(outlineHeading.index + outlineHeading[0].length)
          .split(/^#{1,6}[ \t]/mu, 1)[0];
  if (outline === undefined || !/^[ \t]*1\.[ \t]+\S/mu.test(outline)) {
    throw new Error("Generated brief.md must contain a numbered slide outline.");
  }
};

export const assertReleaseSmokeBrief = (source) => assertReleaseSmokeBriefShape(source, "Approved");

const assertReleaseSmokePlan = (source, status) => {
  let plan;
  try {
    plan = JSON.parse(source);
  } catch {
    throw new Error("Generated drever.plan.json must contain valid JSON.");
  }
  const validation = validateDreverDeckPlanValue(plan);
  if (!validation.ok) {
    const details = validation.issues
      .map(({ code, field, message }) => `${code} at ${field}: ${message}`)
      .join(" ");
    throw new Error(`Generated drever.plan.json does not satisfy the V1 contract. ${details}`);
  }
  if (validation.value.status !== status) {
    throw new Error(`Generated drever.plan.json must be a version-1 ${status} plan.`);
  }
};

export const assertReleaseSmokePlanReview = async (
  projectRoot,
  retainedSourcePaths = [],
  { requireDeckPlan = true } = {},
) => {
  const root = resolve(projectRoot);
  const files = (await walkSourceCandidates(root)).sort();
  const allowed = new Set(["brief.md", "drever.plan.json", ...retainedSourcePaths]);
  const prematureSource = files.filter((path) => !allowed.has(path));
  if (prematureSource.length > 0) {
    throw new Error(
      `Release smoke created presentation source before plan approval: ${prematureSource.join(", ")}.`,
    );
  }
  if (!files.includes("brief.md")) {
    throw new Error("Generated plan review is missing brief.md.");
  }
  const hasDeckPlan = files.includes("drever.plan.json");
  if (requireDeckPlan && !hasDeckPlan) {
    throw new Error("Generated plan review is missing drever.plan.json.");
  }
  assertReleaseSmokeBriefShape(await readFile(join(root, "brief.md"), "utf8"), "Awaiting approval");
  if (hasDeckPlan) {
    assertReleaseSmokePlan(
      await readFile(join(root, "drever.plan.json"), "utf8"),
      "awaiting-approval",
    );
  }
};

export const collectReleaseSmokeSource = async (
  projectRoot,
  destination,
  { requireDeckPlan = false } = {},
) => {
  const root = resolve(projectRoot);
  const target = resolve(destination);
  if (isChildPath(root, target)) {
    throw new Error("Release smoke source output must be outside the generated project.");
  }
  const files = (await walkSourceCandidates(root)).sort();
  if (!files.includes("slides.mdx")) throw new Error("Generated source is missing slides.mdx.");
  if (!files.includes("brief.md")) throw new Error("Generated source is missing brief.md.");
  const hasDeckPlan = files.includes("drever.plan.json");
  if (requireDeckPlan && !hasDeckPlan) {
    throw new Error("Generated source is missing drever.plan.json.");
  }
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
  assertReleaseSmokeBrief(contents.find(({ path }) => path === "brief.md")?.content);
  const deckPlan = contents.find(({ path }) => path === "drever.plan.json")?.content;
  if (deckPlan !== undefined) assertReleaseSmokePlan(deckPlan, "approved");

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

const isSupportedReleaseSmokeReceiptVersion = (version) => version === 1 || version === 2;

export const assertReleaseSmokeContext = (context) => {
  if (
    !isSupportedReleaseSmokeReceiptVersion(context?.version) ||
    !Array.isArray(context?.deck?.slides)
  ) {
    throw new Error("Drever context returned an invalid authoring receipt.");
  }
  const slideCount = context.deck.slides.length;
  if (slideCount < MIN_SLIDES || slideCount > MAX_SLIDES) {
    throw new Error(
      `Release smoke deck has ${slideCount} slides; expected ${MIN_SLIDES}-${MAX_SLIDES}.`,
    );
  }
  const speakerNoteCount = context.deck.slides.reduce(
    (count, slide) => count + (Array.isArray(slide?.speakerNotes) ? slide.speakerNotes.length : 0),
    0,
  );
  return { slideCount, speakerNoteCount };
};

export const assertReleaseSmokeCheck = (check, slideCount) => {
  if (
    !isSupportedReleaseSmokeReceiptVersion(check?.version) ||
    check?.summary?.errors !== 0 ||
    check.slideCount !== slideCount
  ) {
    throw new Error("Drever check did not return a clean release smoke receipt.");
  }
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

export const readFirstExistingFile = async (root, candidates) => {
  for (const path of candidates) {
    try {
      return { content: await readFile(join(root, path), "utf8"), path };
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  return undefined;
};
