import { describe, expect, it } from "vite-plus/test";
import { DreverClientError, isAbortError } from "./client-error.ts";

describe("DreverClientError", () => {
  it("carries stable structured diagnostics", () => {
    const cause = new Error("source");
    const error = new DreverClientError("DREVER_CLIENT_TEST", "Test failure.", {
      cause,
      details: { slideId: "intro" },
    });

    expect(error).toMatchObject({
      cause,
      code: "DREVER_CLIENT_TEST",
      details: { slideId: "intro" },
      message: "Test failure.",
      name: "DreverClientError",
    });
    expect(Object.isFrozen(error.details)).toBe(true);
  });

  it("recognizes AbortError values across JavaScript realms", () => {
    expect(isAbortError(new DOMException("aborted", "AbortError"))).toBe(true);
    expect(isAbortError(Object.freeze({ name: "AbortError" }))).toBe(true);
    expect(isAbortError(new DOMException("failed", "InvalidStateError"))).toBe(false);
    expect(isAbortError(new Error("AbortError"))).toBe(false);
  });
});
