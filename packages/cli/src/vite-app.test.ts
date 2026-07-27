import { describe, expect, it, vi } from "vite-plus/test";
import {
  attachPrivateAppLifetime,
  resolveFrameworkViteConfig,
  resolvePrivateAppOptions,
  resolveServerFsAllow,
  resolveSpeakerUrls,
} from "./vite-app.ts";

describe("resolveFrameworkViteConfig", () => {
  it("eagerly optimizes Drever and keeps every React import on one module identity", () => {
    const config = resolveFrameworkViteConfig();

    expect(config.dedupe).toEqual(["react", "react-dom"]);
    expect(config.exclude).toEqual(["@chenglou/pretext"]);
    expect(config.warmup).toEqual(["./entry.js"]);
    expect(config.optimize).toEqual([
      "drever",
      "@drever/client",
      "@drever/client/audience",
      "@drever/client/document",
      "@drever/client/speaker",
      "@drever/core",
      "@drever/designs/basic/layouts",
      "react",
      "react/jsx-dev-runtime",
      "react/jsx-runtime",
      "react-dom",
      "react-dom/client",
    ]);
    expect(
      config.aliases.find(({ find }) => find instanceof RegExp && find.test("drever"))?.replacement,
    ).toMatch(/packages\/cli\/(?:dist\/runtime\.mjs|src\/runtime\.ts)$/u);
    expect(
      config.aliases.find(
        ({ find }) =>
          find instanceof RegExp && find.test("virtual:drever/experimental-text-layout"),
      )?.replacement,
    ).toMatch(/packages\/cli\/(?:dist|src)\/experimental-text-layout\.(?:mjs|ts)$/u);
    expect(
      config.aliases
        .filter(({ find }) => find instanceof RegExp && find.test("react"))
        .map(({ replacement }) => replacement),
    ).toHaveLength(1);
  });
});

describe("resolveServerFsAllow", () => {
  it("allows assets from the authored workspace and resolved framework packages", () => {
    expect(
      resolveServerFsAllow(
        "/workspace/examples/deck",
        "/private/generated-app",
        ["/workspace/packages/client/index.ts", "/opt/drever/core/index.js"],
        "/workspace",
      ),
    ).toEqual([
      "/private/generated-app",
      "/workspace/examples/deck",
      "/workspace",
      "/workspace/packages/client",
      "/opt/drever/core",
    ]);
  });
});

describe("resolvePrivateAppOptions", () => {
  it("converts configured rehearsal minutes to the speaker runtime contract", () => {
    const canvas = { height: 900, width: 1_600 } as const;

    expect(
      resolvePrivateAppOptions(
        {
          canvas,
          deck: { lang: "zh-CN", title: "发布状态" },
          focusTools: {
            highlighter: { color: "#ffe66d", opacity: 0.28, width: 30 },
            laser: { color: "#ff4567" },
            pen: { color: "var(--drever-theme-accent)", width: 7.5 },
          },
          rehearsal: { targetDurationMinutes: 18.5 },
          stage: { background: "./Background.tsx", foreground: "./Chrome.tsx" },
        },
        "/project",
      ),
    ).toEqual({
      canvas,
      deck: { lang: "zh-CN", title: "发布状态" },
      focusTools: {
        highlighter: { color: "#ffe66d", opacity: 0.28, width: 30 },
        laser: { color: "#ff4567" },
        pen: { color: "var(--drever-theme-accent)", width: 7.5 },
      },
      rehearsal: { targetDurationMs: 1_110_000 },
      stage: {
        background: "/project/Background.tsx",
        foreground: "/project/Chrome.tsx",
      },
    });
  });

  it("does not create runtime rehearsal settings without an explicit target", () => {
    expect(resolvePrivateAppOptions({})).toEqual({});
    expect(resolvePrivateAppOptions({ rehearsal: {} })).toEqual({});
  });
});

describe("resolveSpeakerUrls", () => {
  it("derives every local and network speaker URL without guessing server details", () => {
    expect(
      resolveSpeakerUrls({
        local: ["http://localhost:4173/", "http://127.0.0.1:4173/talk/"],
        network: ["http://192.168.1.8:4173/", "https://slides.test/decks/keynote/"],
      }),
    ).toEqual([
      "http://localhost:4173/speaker",
      "http://127.0.0.1:4173/talk/speaker",
      "http://192.168.1.8:4173/speaker",
      "https://slides.test/decks/keynote/speaker",
    ]);
  });

  it("normalizes trailing slashes and removes audience query and hash state", () => {
    expect(
      resolveSpeakerUrls({
        local: ["http://localhost:5173/talk///?slide=2#notes"],
        network: [],
      }),
    ).toEqual(["http://localhost:5173/talk/speaker"]);
  });

  it("handles unavailable URL sets and deduplicates valid URLs", () => {
    expect(resolveSpeakerUrls(null)).toEqual([]);
    expect(resolveSpeakerUrls({ local: [], network: [] })).toEqual([]);
    expect(
      resolveSpeakerUrls({
        local: ["http://localhost:5173/"],
        network: ["http://localhost:5173/"],
      }),
    ).toEqual(["http://localhost:5173/speaker"]);
  });

  it("fails immediately when Vite violates its absolute URL contract", () => {
    expect(() => resolveSpeakerUrls({ local: ["not a URL"], network: [] })).toThrow(TypeError);
  });
});

describe("attachPrivateAppLifetime", () => {
  it("keeps the generated app until server shutdown and releases both resources once", async () => {
    const lifecycle: string[] = [];
    const closeServer = vi.fn(async () => {
      lifecycle.push("server");
    });
    const dispose = vi.fn(async () => {
      lifecycle.push("app");
    });
    const server = { close: closeServer };
    attachPrivateAppLifetime(server, dispose);

    await Promise.all([server.close(), server.close()]);

    expect(closeServer).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledOnce();
    expect(lifecycle).toEqual(["server", "app"]);
  });

  it("still removes the generated app when closing Vite fails", async () => {
    const failure = new Error("close failed");
    const dispose = vi.fn(async () => undefined);
    const server = { close: vi.fn(async () => Promise.reject(failure)) };
    attachPrivateAppLifetime(server, dispose);

    await expect(server.close()).rejects.toBe(failure);
    expect(dispose).toHaveBeenCalledOnce();
  });
});
