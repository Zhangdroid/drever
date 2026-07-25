import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { demoMounts } from "../website/site-manifest.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dreverBin = join(root, "packages", "cli", "dist", "bin.mjs");

const run = (command, arguments_, cwd) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, arguments_, { cwd, stdio: "inherit" });
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

export const checkShowcases = async () => {
  for (const demo of demoMounts) {
    await run(
      process.execPath,
      [dreverBin, "check", "--json"],
      join(root, "examples", demo.source),
    );
  }
  await run(
    process.execPath,
    [join(root, "examples", "theme-showcase", "scripts", "run.mjs"), "check", "--all"],
    join(root, "examples", "theme-showcase"),
  );
};

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await checkShowcases();
}
