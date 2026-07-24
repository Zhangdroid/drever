import { describe, expect, it } from "vite-plus/test";
import { DreverCliError, formatCliError } from "./errors.ts";

describe("formatCliError", () => {
  it("keeps exporter ownership and capability context actionable", () => {
    const error = new DreverCliError("DREVER_EXPORT_FAILED", "The export hook failed.", {
      details: {
        capability: "exportSetup",
        owner: "diagram-plugin",
        specifier: "file:///project/export.js",
        stage: "runtime",
      },
      hint: "Fix the hook and retry.",
    });

    expect(formatCliError(error)).toBe(
      [
        "[DREVER_EXPORT_FAILED] The export hook failed.",
        "Context: stage=runtime owner=diagram-plugin capability=exportSetup specifier=file:///project/export.js",
        "Hint: Fix the hook and retry.",
      ].join("\n"),
    );
  });

  it("keeps the nested cause visible at an owned CLI boundary", () => {
    const error = new DreverCliError("DREVER_AUTHORING_CONTEXT_COMPILE_FAILED", "Compile failed.", {
      cause: new Error("@drever/plugin-gfm does not support footnotes yet."),
      hint: "Fix the authored source.",
    });

    expect(formatCliError(error)).toBe(
      [
        "[DREVER_AUTHORING_CONTEXT_COMPILE_FAILED] Compile failed.",
        "Cause: @drever/plugin-gfm does not support footnotes yet.",
        "Hint: Fix the authored source.",
      ].join("\n"),
    );
  });
});
