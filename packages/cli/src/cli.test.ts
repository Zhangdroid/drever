import { describe, expect, it } from "vite-plus/test";
import { parseCommand } from "./cli.ts";

describe("parseCommand", () => {
  it("models the two public workflows and their optional entry", () => {
    expect(parseCommand([])).toBe("help");
    expect(parseCommand(["dev"])).toEqual({ name: "dev" });
    expect(parseCommand(["build", "decks/keynote.mdx"])).toEqual({
      entry: "decks/keynote.mdx",
      name: "build",
    });
  });

  it("rejects flags that would imply an unsupported Vite surface", () => {
    expect(() => parseCommand(["dev", "--config", "vite.config.ts"])).toThrowError(
      expect.objectContaining({ code: "DREVER_ARGUMENT_INVALID" }),
    );
    expect(() => parseCommand(["preview"])).toThrowError(
      expect.objectContaining({ code: "DREVER_COMMAND_UNKNOWN" }),
    );
  });
});
