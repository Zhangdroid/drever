#!/usr/bin/env node

import { formatCliError, runCreateCli } from "drever/create";

try {
  await runCreateCli(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${formatCliError(error)}\n`);
  process.exitCode = 1;
}
