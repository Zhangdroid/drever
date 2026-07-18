import { describe, expect, it, vi } from "vite-plus/test";
import { attachPrivateAppLifetime, resolveSpeakerUrls } from "./vite-app.ts";

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
