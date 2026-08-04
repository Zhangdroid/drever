import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      "build:design-studies": {
        command: "node ./scripts/run.mjs build --all",
        input: [{ auto: true }, "!.drever/cache/**", "!dist/**"],
        output: ["dist/**"],
        untrackedEnv: ["DREVER_TASK_CONCURRENCY"],
      },
      "check:design-studies": {
        command: "node ./scripts/run.mjs check --all",
        input: [{ auto: true }, "!.drever/cache/**"],
        output: [],
        untrackedEnv: ["DREVER_TASK_CONCURRENCY"],
      },
    },
  },
});
