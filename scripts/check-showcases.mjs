import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { demoMounts } from "../website/site-manifest.ts";
import { resolveTaskConcurrency } from "./run-concurrently.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const themeShowcasePackage = "@drever/example-theme-showcase";

const run = (command, arguments_, cwd, env = process.env) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, arguments_, { cwd, env, stdio: "inherit" });
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

const runGroups = async (concurrency, demos, designs) => {
  if (concurrency === 1) {
    await demos(1);
    await designs(1);
    return;
  }
  await Promise.all([demos(Math.ceil(concurrency / 2)), designs(Math.floor(concurrency / 2))]);
};

export const checkShowcases = async (concurrency = resolveTaskConcurrency()) => {
  const demoFilters = demoMounts.flatMap(({ source }) => ["-F", `@drever/example-${source}`]);

  await runGroups(
    concurrency,
    (limit) =>
      run(
        "vp",
        [
          "run",
          "--parallel",
          "--concurrency-limit",
          String(limit),
          "--log",
          "labeled",
          ...demoFilters,
          "check:showcase",
        ],
        root,
      ),
    (limit) =>
      run("vp", ["run", "-F", themeShowcasePackage, "check:design-studies"], root, {
        ...process.env,
        DREVER_TASK_CONCURRENCY: String(limit),
      }),
  );
};

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await checkShowcases();
}
