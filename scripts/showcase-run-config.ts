export const showcaseRunConfig = {
  tasks: {
    "build:showcase": {
      command: "node ../../packages/cli/dist/bin.mjs build",
      input: [{ auto: true }, "!.drever/cache/**", "!dist/**"],
      output: ["dist/**"],
    },
    "check:showcase": {
      command: "node ../../packages/cli/dist/bin.mjs check --json",
      input: [{ auto: true }, "!.drever/cache/**"],
      output: [],
    },
  },
};
