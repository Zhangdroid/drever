import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const wrangler = join(workspaceRoot, "website", "node_modules", ".bin", "wrangler");

const run = (arguments_, { quiet = false } = {}) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(wrangler, arguments_, {
      cwd: workspaceRoot,
      env: { ...process.env, FORCE_COLOR: "0", WRANGLER_LOG_PATH: "/tmp/wrangler.log" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (!quiet) process.stderr.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });
    child.on("error", rejectRun);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolveRun(output);
        return;
      }
      rejectRun(
        new Error(
          signal
            ? `Wrangler was terminated by ${signal}.`
            : `Wrangler exited with code ${String(code)}.`,
        ),
      );
    });
  });

export const immutableDirectUploadOrigin = (output, project) => {
  const escapedProject = project.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const matches = [
    ...output.matchAll(new RegExp(`https://([0-9a-f]{8})\\.${escapedProject}\\.pages\\.dev`, "gu")),
  ].map((match) => match[0]);
  const origins = [...new Set(matches)];
  if (origins.length !== 1) {
    throw new Error(
      `Expected one immutable ${project} deployment URL, received ${String(origins.length)}.`,
    );
  }
  return origins[0];
};

const ensureProject = async (project) => {
  const output = await run(["pages", "project", "list", "--json"], { quiet: true });
  const projects = JSON.parse(output);
  if (!Array.isArray(projects)) throw new Error("Wrangler returned an invalid Pages project list.");
  if (projects.some((entry) => entry?.["Project Name"] === project)) return;
  await run(["pages", "project", "create", project, "--production-branch", "main"]);
};

const main = async () => {
  const [directoryArgument, project, branch, commit, message] = process.argv.slice(2);
  if (
    directoryArgument === undefined ||
    project === undefined ||
    branch === undefined ||
    commit === undefined ||
    message === undefined
  ) {
    throw new Error(
      "Usage: node scripts/release-smoke/deploy-pages.mjs <directory> <project> <branch> <commit> <message>",
    );
  }
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(project)) {
    throw new Error(`Invalid Cloudflare Pages project: ${project}`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(branch)) {
    throw new Error(`Invalid Cloudflare Pages branch: ${branch}`);
  }
  if (!/^[0-9a-f]{40}$/u.test(commit)) throw new Error(`Invalid source commit: ${commit}`);
  if (process.env.CLOUDFLARE_API_TOKEN === undefined) {
    throw new Error("CLOUDFLARE_API_TOKEN is required for Pages Direct Upload.");
  }
  if (process.env.CLOUDFLARE_ACCOUNT_ID === undefined) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is required for Pages Direct Upload.");
  }

  await ensureProject(project);
  const output = await run([
    "pages",
    "deploy",
    resolve(directoryArgument),
    "--project-name",
    project,
    "--branch",
    branch,
    "--commit-hash",
    commit,
    "--commit-message",
    message,
    "--commit-dirty=true",
  ]);
  process.stdout.write(`${immutableDirectUploadOrigin(output, project)}\n`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
