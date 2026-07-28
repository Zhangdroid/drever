import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const projectRoot = "/project";
const executable = join(projectRoot, "node_modules", "drever", "dist", "bin.mjs");
const receiptPrefix = "drever-release-smoke-receipt:";
const failurePrefix = "drever-release-smoke-authoring-failure:";
const environment = Object.freeze({
  CI: "true",
  FORCE_COLOR: "0",
  HOME: "/tmp/home",
  PATH: `/project/node_modules/.bin:${process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin"}`,
  TMPDIR: "/tmp",
  npm_config_audit: "false",
  npm_config_cache: "/tmp/npm-cache",
  npm_config_fund: "false",
  npm_config_offline: "true",
});

const parseJsonOutput = (output, command) => {
  const start = output.search(/^\{/mu);
  if (start === -1) throw new Error(`${command} did not return a JSON receipt.`);
  return JSON.parse(output.slice(start));
};

const run = async (command) => {
  const { stdout } = await execute(process.execPath, [executable, command, "--json"], {
    cwd: projectRoot,
    env: environment,
    maxBuffer: 20 * 1024 * 1024,
    timeout: 300_000,
  });
  return parseJsonOutput(stdout, `drever ${command}`);
};

try {
  const context = await run("context");
  const check = await run("check");
  const build = await run("build");
  process.stdout.write(`${receiptPrefix}${JSON.stringify({ build, check, context })}\n`);
} catch (error) {
  const evidence =
    error instanceof Error
      ? {
          message: error.message,
          stderr: "stderr" in error && typeof error.stderr === "string" ? error.stderr : "",
          stdout: "stdout" in error && typeof error.stdout === "string" ? error.stdout : "",
        }
      : { message: String(error), stderr: "", stdout: "" };
  process.stdout.write(`${failurePrefix}${JSON.stringify(evidence)}\n`);
  process.exitCode = 2;
}
