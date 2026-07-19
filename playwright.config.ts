import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const demoRoot = fileURLToPath(new URL("./examples/basic", import.meta.url));
const architectureDemoRoot = fileURLToPath(new URL("./examples/architecture", import.meta.url));
const motionRecipesRoot = fileURLToPath(new URL("./examples/motion-recipes", import.meta.url));
const productTourRoot = fileURLToPath(new URL("./examples/product-tour", import.meta.url));
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
    testMatch: "**/*.dev.spec.ts",
    use: {
      baseURL: "http://127.0.0.1:4317",
      contextOptions: { reducedMotion: "no-preference" },
    },
    webServer: {
      command: "vp exec drever dev",
      cwd: demoRoot,
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
      command: "vp exec drever build && node ../../e2e/support/static-server.mjs dist 4318 /talk",
      cwd: demoRoot,
      reuseExistingServer: false,
      timeout: 60_000,
      url: "http://127.0.0.1:4318",
    },
  },
  {
    name: "product-tour-chromium",
    testMatch: "**/*.product-tour.spec.ts",
    use: {
      baseURL: "http://127.0.0.1:4320",
      contextOptions: { reducedMotion: "no-preference" },
    },
    webServer: {
      command: "vp exec drever dev",
      cwd: productTourRoot,
      reuseExistingServer: false,
      timeout: 60_000,
      url: "http://127.0.0.1:4320",
    },
  },
  {
    name: "architecture-chromium",
    testMatch: "**/*.architecture.spec.ts",
    use: {
      baseURL: "http://127.0.0.1:4321",
      contextOptions: { reducedMotion: "no-preference" },
    },
    webServer: {
      command: "vp exec drever build && node ../../e2e/support/static-server.mjs dist 4321",
      cwd: architectureDemoRoot,
      reuseExistingServer: false,
      timeout: 60_000,
      url: "http://127.0.0.1:4321",
    },
  },
  {
    name: "motion-recipes-chromium",
    testMatch: "**/*.motion-recipes.spec.ts",
    use: {
      baseURL: "http://127.0.0.1:4322",
      contextOptions: { reducedMotion: "no-preference" },
    },
    webServer: {
      command: "vp exec drever dev",
      cwd: motionRecipesRoot,
      reuseExistingServer: false,
      timeout: 60_000,
      url: "http://127.0.0.1:4322",
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
