import { describe, expect, it } from "vite-plus/test";
import { findJsonIssue } from "./json-value.ts";

describe("findJsonIssue", () => {
  it("accepts canonical JSON data", () => {
    expect(
      findJsonIssue({
        active: true,
        count: 2,
        items: [null, "text", { nested: false }],
      }),
    ).toBeUndefined();
  });

  it("rejects non-finite and lossy numeric values", () => {
    expect(findJsonIssue({ value: Number.NaN })).toEqual({
      path: "$.value",
      reason: "numbers must be finite",
    });
    expect(findJsonIssue({ value: -0 })).toEqual({
      path: "$.value",
      reason: "negative zero is not canonical JSON",
    });
  });

  it("rejects circular and sparse structures", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    const sparse: unknown[] = [];
    sparse.length = 1;

    expect(findJsonIssue(circular)).toEqual({
      path: "$.self",
      reason: "circular references are not JSON-safe",
    });
    expect(findJsonIssue(sparse)).toEqual({
      path: "$[0]",
      reason: "sparse array entries are not JSON-safe",
    });
  });

  it("rejects accessors without executing them", () => {
    let reads = 0;
    const value = Object.defineProperty({}, "computed", {
      enumerable: true,
      get: () => {
        reads += 1;
        return "value";
      },
    });

    expect(findJsonIssue(value)).toEqual({
      path: "$.computed",
      reason: "accessor properties are not JSON-safe",
    });
    expect(reads).toBe(0);
  });

  it("rejects properties that JSON would silently omit", () => {
    const symbol = Symbol("hidden");
    const symbolKeyed = { [symbol]: true };
    const nonEnumerable = Object.defineProperty({}, "hidden", { value: true });
    const extendedArray = ["item"] as string[] & { extra?: boolean };
    extendedArray.extra = true;

    expect(findJsonIssue(symbolKeyed)?.reason).toBe("symbol keys are not JSON-safe");
    expect(findJsonIssue(nonEnumerable)?.reason).toBe(
      "non-enumerable properties are not JSON-safe",
    );
    expect(findJsonIssue(extendedArray)).toEqual({
      path: "$.extra",
      reason: "extra array properties are not JSON-safe",
    });
  });

  it("rejects objects with executable prototypes", () => {
    expect(findJsonIssue(new Date("2026-07-20T00:00:00Z"))).toEqual({
      path: "$",
      reason: "only plain objects are JSON-safe",
    });
  });
});
