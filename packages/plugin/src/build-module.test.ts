import { describe, expect, it } from "vite-plus/test";
import {
  defineRecmaPlugin,
  defineRehypePlugin,
  defineRemarkPlugin,
  defineVitePlugin,
  DREVER_BUILD_API_VERSION,
} from "./index.ts";

describe("build module definitions", () => {
  it("creates frozen, capability-specific descriptors", () => {
    const create = () => () => undefined;
    const descriptors = [
      defineRemarkPlugin(create),
      defineRehypePlugin(create),
      defineRecmaPlugin(create),
      defineVitePlugin(() => ({ name: "test" })),
    ];

    expect(descriptors.map(({ capability }) => capability)).toEqual([
      "remark",
      "rehype",
      "recma",
      "vite",
    ]);
    for (const descriptor of descriptors) {
      expect(descriptor).toMatchObject({
        kind: "drever-build-plugin",
        apiVersion: DREVER_BUILD_API_VERSION,
      });
      expect(Object.isFrozen(descriptor)).toBe(true);
    }
  });
});
