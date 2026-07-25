import { describe, expect, it } from "vite-plus/test";

import { createAIHandoff } from "./ai-handoff";

describe("AI handoff", () => {
  it("copies an executable handoff before the user supplies a brief", () => {
    expect(createAIHandoff("")).toBe("Fetch and follow https://drever.dev/prompt.md");
  });

  it("keeps a supplied brief without adding a competing presentation instruction", () => {
    expect(createAIHandoff("  Help residents compare three park plans.  ")).toBe(
      "Fetch and follow https://drever.dev/prompt.md. Brief: “Help residents compare three park plans.”",
    );
  });
});
