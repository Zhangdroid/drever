import { describe, expect, it } from "vite-plus/test";
import {
  isStudioAgentName,
  STUDIO_AGENT_NAMES,
  STUDIO_AGENT_SUPPORT,
} from "./studio-agent-registry.ts";

describe("Studio agent registry", () => {
  it("keeps the documented native and ACP adapters explicit", () => {
    expect(STUDIO_AGENT_NAMES).toEqual([
      "codex",
      "claude",
      "gemini",
      "copilot",
      "goose",
      "cursor",
      "opencode",
      "openhands",
      "cline",
    ]);
    expect(STUDIO_AGENT_SUPPORT).toMatchObject({
      codex: { transport: "native", approvals: "studio" },
      claude: { transport: "native", approvals: "provider" },
      gemini: { transport: "acp", approvals: "studio" },
      copilot: { transport: "acp", approvals: "studio" },
      goose: { transport: "acp", approvals: "studio" },
      cursor: { transport: "acp", approvals: "studio" },
      opencode: { transport: "acp", approvals: "studio" },
      openhands: { transport: "acp", approvals: "studio" },
      cline: { transport: "acp", approvals: "studio" },
    });
    expect(isStudioAgentName("gemini")).toBe(true);
    expect(isStudioAgentName("cursor")).toBe(true);
    expect(isStudioAgentName("aider")).toBe(false);
  });
});
