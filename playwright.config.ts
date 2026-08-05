import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const coreFixtureRoot = fileURLToPath(new URL("./e2e/fixtures/core-deck", import.meta.url));
const workspaceCli = `${JSON.stringify(process.execPath)} ${JSON.stringify(
  fileURLToPath(new URL("./packages/cli/dist/bin.mjs", import.meta.url)),
)}`;
const staticServer = `${JSON.stringify(process.execPath)} ${JSON.stringify(
  fileURLToPath(new URL("./e2e/support/static-server.mjs", import.meta.url)),
)}`;
const ci = process.env.CI !== undefined;

function readProjectFilters(args: readonly string[]): string[] {
  const filters: string[] = [];
  let collectsProjectNames = false;

  for (const argument of args) {
    if (argument === "--") break;

    if (argument === "--project") {
      collectsProjectNames = true;
      continue;
    }

    if (argument.startsWith("--project=")) {
      collectsProjectNames = false;
      filters.push(argument.slice("--project=".length));
      continue;
    }

    if (argument.startsWith("-")) {
      collectsProjectNames = false;
      continue;
    }

    if (collectsProjectNames) filters.push(argument);
  }

  return filters;
}

function matchesProject(name: string, filter: string): boolean {
  const escapedParts = filter.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${escapedParts.join(".*")}$`, "i").test(name);
}

const projectDefinitions = [
  {
    name: "dev-chromium",
    testMatch: /(?:\.dev|\.motion-contracts)\.spec\.ts$/u,
    use: {
      baseURL: "http://127.0.0.1:4317",
      contextOptions: { reducedMotion: "no-preference" },
    },
    webServer: {
      command: `${workspaceCli} dev`,
      cwd: coreFixtureRoot,
      reuseExistingServer: false,
      timeout: 60_000,
      url: "http://127.0.0.1:4317",
    },
  },
  {
    name: "build-chromium",
    testMatch: "**/*.build.spec.ts",
    use: {
      baseURL: "http://127.0.0.1:4318",
      contextOptions: { reducedMotion: "reduce" },
    },
    webServer: {
      command: `${workspaceCli} build && ${staticServer} dist 4318 /talk`,
      cwd: coreFixtureRoot,
      reuseExistingServer: false,
      timeout: 60_000,
      url: "http://127.0.0.1:4318",
    },
  },
  {
    name: "export-chromium",
    testMatch: "**/*.export.spec.ts",
    use: { contextOptions: { reducedMotion: "reduce" } },
    webServer: undefined,
  },
  {
    name: "check-cli",
    testMatch: "**/*.check.spec.ts",
    use: {},
    webServer: undefined,
  },
  {
    name: "storyboard-chromium",
    testMatch: "**/*.storyboard.spec.ts",
    use: {},
    webServer: undefined,
  },
] as const;

const projectFilters = readProjectFilters(process.argv);
const selectedProjects = projectDefinitions.filter(
  ({ name }) =>
    projectFilters.length === 0 || projectFilters.some((filter) => matchesProject(name, filter)),
);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./.drever/e2e/results",
  fullyParallel: false,
  workers: 1,
  retries: ci ? 1 : 0,
  forbidOnly: ci,
  failOnFlakyTests: ci,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "./.drever/e2e/report" }]],
  use: {
    browserName: "chromium",
    channel: "chromium",
    deviceScaleFactor: 1,
    locale: "en-US",
    screenshot: "only-on-failure",
    timezoneId: "UTC",
    trace: "on-first-retry",
    viewport: { height: 900, width: 1440 },
  },
  projects: projectDefinitions.map(({ webServer: _, ...project }) => project),
  webServer: selectedProjects.flatMap(({ webServer }) =>
    webServer === undefined ? [] : [webServer],
  ),
});
