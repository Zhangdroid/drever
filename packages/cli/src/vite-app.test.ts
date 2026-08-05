import { describe, expect, it, vi } from "vite-plus/test";
import {
  attachPrivateAppLifetime,
  createStudioCapabilities,
  openStudioWhenRequested,
  resolveDevelopmentServerHost,
  resolveDevelopmentServerUrls,
  resolveFrameworkViteConfig,
  resolvePrivateAppOptions,
  resolveServerFsAllow,
  resolveServerFsDeny,
  resolveSpeakerUrls,
  resolveStoryboardUrls,
} from "./vite-app.ts";

describe("createStudioCapabilities", () => {
  it("creates separate unguessable capabilities for actions and embedded previews", () => {
    const first = createStudioCapabilities();
    const second = createStudioCapabilities();

    expect(first.action).toMatch(/^[\w-]{43}$/u);
    expect(first.preview).toMatch(/^[\w-]{43}$/u);
    expect(first.preview).not.toBe(first.action);
    expect(second).not.toEqual(first);
  });
});

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
      "@drever/client/storyboard",
      "@drever/client/studio",
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

describe("resolveServerFsDeny", () => {
  it("extends Vite's complete default deny list with private Studio state", () => {
    expect(resolveServerFsDeny()).toEqual([
      "**/.drever/studio/**",
      ".env",
      ".env.*",
      "*.{crt,pem,key,p12,pfx,cer,der}",
      ".npmrc",
      ".yarnrc.yml",
      "**/.git/**",
    ]);
  });
});

describe("resolveDevelopmentServerUrls", () => {
  it("keeps false and omitted hosts on loopback while true opts into a network bind", () => {
    expect(resolveDevelopmentServerHost(undefined)).toBe("localhost");
    expect(resolveDevelopmentServerHost(false)).toBe("localhost");
    expect(resolveDevelopmentServerHost(true)).toBeUndefined();
    expect(resolveDevelopmentServerHost("127.0.0.1")).toBe("127.0.0.1");
  });

  it("keeps loopback and explicitly network-bound listeners in their public URL groups", () => {
    expect(resolveDevelopmentServerUrls("127.0.0.1", 4317)).toEqual({
      local: ["http://127.0.0.1:4317/"],
      network: [],
    });
    expect(resolveDevelopmentServerUrls("192.0.2.8", 4318)).toEqual({
      local: [],
      network: ["http://192.0.2.8:4318/"],
    });
  });

  it("uses localhost plus URL-safe IPv4 addresses for wildcard listeners", () => {
    const urls = resolveDevelopmentServerUrls(true, 4319);

    expect(urls.local).toEqual(["http://localhost:4319/"]);
    expect(
      urls.network.every((url) => /^http:\/\/(?:\d{1,3}\.){3}\d{1,3}:4319\/$/u.test(url)),
    ).toBe(true);
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

describe("resolveStoryboardUrls", () => {
  it("derives local and network plan-preview URLs without carrying route state", () => {
    expect(
      resolveStoryboardUrls({
        local: ["http://127.0.0.1:4317/talk/?slide=2#notes"],
        network: ["https://slides.test/decks/keynote/"],
      }),
    ).toEqual([
      "http://127.0.0.1:4317/talk/storyboard",
      "https://slides.test/decks/keynote/storyboard",
    ]);
  });

  it("returns no URLs before Vite resolves its listeners", () => {
    expect(resolveStoryboardUrls(null)).toEqual([]);
  });
});

describe("Creation room browser launch", () => {
  it("opens the exact local Studio URL only after an explicit request", async () => {
    const openUrl = vi.fn(async () => true);
    const resolvedUrls = {
      local: ["http://127.0.0.1:4317/talk/?slide=2#notes"],
      network: ["http://192.168.1.8:4317/talk/"],
    };
    const environment = { DISPLAY: ":0" };

    await expect(
      openStudioWhenRequested(resolvedUrls, "studio-capability", "http://127.0.0.1:51999/talk/", {
        environment,
        open: "studio",
        openUrl,
      }),
    ).resolves.toBe(true);
    expect(openUrl).toHaveBeenCalledOnce();
    expect(openUrl).toHaveBeenCalledWith(
      "http://127.0.0.1:4317/talk/studio#access=studio-capability&preview=http%3A%2F%2F127.0.0.1%3A51999%2Ftalk%2F",
      environment,
    );

    openUrl.mockClear();
    await expect(
      openStudioWhenRequested(resolvedUrls, "studio-capability", "http://127.0.0.1:51999/talk/", {
        openUrl,
      }),
    ).resolves.toBeUndefined();
    expect(openUrl).not.toHaveBeenCalled();
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
