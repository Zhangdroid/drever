import { describe, expect, it } from "vite-plus/test";

import { createAIHandoff } from "./ai-handoff";

describe("AI handoff", () => {
  it("copies a neutral fetch instruction before the user supplies a brief", () => {
    expect(createAIHandoff("")).toBe("Fetch https://drever.dev/prompt.md");
  });

  it("keeps a supplied brief without adding a competing presentation instruction", () => {
    expect(createAIHandoff("  Help residents compare three park plans.  ")).toBe(
      "Fetch https://drever.dev/prompt.md. Brief: “Help residents compare three park plans.”",
    );
  });
});
