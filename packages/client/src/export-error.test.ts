import { describe, expect, it } from "vite-plus/test";
import { serializeExportError, snapshotExportError } from "./export-error.ts";

describe("export error snapshots", () => {
  it("preserves lifecycle context across the browser automation boundary", () => {
    const error = Object.assign(new Error("Chart setup failed"), {
      capability: "exportSetup",
      code: "DREVER_RUNTIME_HOOK_FAILED",
      details: {
        capability: "exportSetup",
        owner: "charts",
        specifier: "@acme/charts/export",
        stage: "export",
      },
      owner: "charts",
      specifier: "@acme/charts/export",
    });
    const snapshot = snapshotExportError(error);

    expect(snapshot).toMatchObject({
      name: "Error",
      message: "Chart setup failed",
      code: "DREVER_RUNTIME_HOOK_FAILED",
      owner: "charts",
      capability: "exportSetup",
      specifier: "@acme/charts/export",
    });
    expect(JSON.parse(serializeExportError(error))).toEqual(snapshot);
  });

  it("keeps the primary diagnostic when arbitrary details are not JSON-safe", () => {
    const details: { self?: unknown } = {};
    details.self = details;
    const error = Object.assign(new Error("Invalid renderer state"), {
      code: "DREVER_EXPORT_INVALID",
      details,
    });

    expect(JSON.parse(serializeExportError(error))).toMatchObject({
      message: "Invalid renderer state",
      code: "DREVER_EXPORT_INVALID",
      details: "The error details were not serializable.",
    });
  });
});
