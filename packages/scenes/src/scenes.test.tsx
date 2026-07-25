import { DreverRenderModeProvider } from "@drever/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import { resolveMusicEmbed, RoomAudio, RoomCountdown, Soundtrack } from "./index.ts";
import {
  deactivateRoomAudio,
  disposeRoomAudio,
  isRoomAudioOwnerActive,
  requestPendingRoomMicrophone,
  requestRoomMicrophone,
  resolveRoomAudioFrame,
} from "./room-audio.tsx";
import { deactivateSoundtrackPlayback, pauseSoundtrackPlayback } from "./soundtrack.tsx";

describe("music links", () => {
  it("turns supported provider links into official embed URLs without preserving trackers", () => {
    expect(
      resolveMusicEmbed(
        "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=tracking-value",
      ),
    ).toEqual({
      embedUrl: "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M",
      openUrl: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      provider: "spotify",
    });
    expect(
      resolveMusicEmbed("https://music.apple.com/us/album/example/123456789?i=987654321&uo=4"),
    ).toEqual({
      embedUrl: "https://embed.music.apple.com/us/album/example/123456789?i=987654321",
      openUrl: "https://music.apple.com/us/album/example/123456789?i=987654321",
      provider: "apple-music",
    });
  });

  it("does not turn arbitrary or insecure URLs into provider embeds", () => {
    expect(resolveMusicEmbed("http://open.spotify.com/playlist/example")).toBeUndefined();
    expect(resolveMusicEmbed("https://example.com/playlist/example")).toBeUndefined();
    expect(resolveMusicEmbed("not a URL")).toBeUndefined();
  });
});

describe("scene render surfaces", () => {
  it("offers one explicit microphone action without media or source choices", () => {
    const markup = renderToStaticMarkup(createElement(RoomAudio));

    expect(markup).toContain('data-variant="panel"');
    expect(markup.match(/<button/gu)).toHaveLength(1);
    expect(markup).toContain("Enable microphone");
    expect(markup).toContain("Processed in this browser");
    expect(markup).not.toContain("Computer audio");
    expect(markup).not.toContain("Demo track");
    expect(markup).not.toContain("<audio");
    expect(markup).not.toContain('role="group"');
  });

  it("keeps ambient capture out of the visual layout while announcing its state", () => {
    const markup = renderToStaticMarkup(
      createElement(RoomAudio, { autoStart: true, variant: "ambient" }),
    );

    expect(markup).toContain('data-variant="ambient"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Microphone starts when this slide is shown.");
    expect(markup).not.toContain("drever-room-audio__meter");
    expect(markup).not.toContain("drever-room-audio__copy");
    expect(markup).not.toContain("drever-room-audio__control");
    expect(markup).not.toContain("Processed in this browser");
    expect(markup).not.toContain("<button");
  });

  it("requests an unprocessed microphone signal and rejects an empty capture", async () => {
    const stop = vi.fn();
    const validStream = {
      getAudioTracks: () => [{}],
      getTracks: () => [{ stop }],
    } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(validStream);

    await expect(
      requestRoomMicrophone({ getUserMedia } as Pick<MediaDevices, "getUserMedia">),
    ).resolves.toBe(validStream);
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false,
      },
      video: false,
    });
    expect(stop).not.toHaveBeenCalled();

    const emptyStop = vi.fn();
    const emptyStream = {
      getAudioTracks: () => [],
      getTracks: () => [{ stop: emptyStop }],
    } as unknown as MediaStream;

    await expect(
      requestRoomMicrophone({
        getUserMedia: vi.fn().mockResolvedValue(emptyStream),
      } as Pick<MediaDevices, "getUserMedia">),
    ).rejects.toThrow("No microphone audio track was available.");
    expect(emptyStop).toHaveBeenCalledOnce();
  });

  it("coalesces concurrent microphone requests and clears the cache after settlement", async () => {
    const validStream = {
      getAudioTracks: () => [{}],
      getTracks: () => [],
    } as unknown as MediaStream;
    let resolveStream: ((stream: MediaStream) => void) | undefined;
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveStream = resolve;
        }),
    );
    const cache = { current: undefined };
    const mediaDevices = { getUserMedia } as Pick<MediaDevices, "getUserMedia">;

    const first = requestPendingRoomMicrophone(cache, mediaDevices);
    const second = requestPendingRoomMicrophone(cache, mediaDevices);

    expect(second).toBe(first);
    expect(getUserMedia).toHaveBeenCalledOnce();
    resolveStream?.(validStream);
    await first;
    await Promise.resolve();

    const third = requestPendingRoomMicrophone(cache, mediaDevices);
    expect(third).not.toBe(first);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    resolveStream?.(validStream);
    await third;
  });

  it("maps silence and relative frequency energy to stable Stage signals", () => {
    expect(resolveRoomAudioFrame({ high: 0.01, low: 0.01, mid: 0.01 }).signal).toEqual({
      high: 0,
      level: 0,
      low: 0,
      mid: 0,
    });
    const signal = resolveRoomAudioFrame({ high: 0.3, low: 0.1, mid: 0.2 }).signal;
    expect(signal.high).toBeGreaterThan(signal.mid);
    expect(signal.mid).toBeGreaterThan(signal.low);
    expect(signal.low).toBeGreaterThan(0.3);
    expect(resolveRoomAudioFrame({ high: 0, low: 0.013, mid: 0 }).signal.low).toBeGreaterThan(0);
    expect(resolveRoomAudioFrame({ high: 0, low: 0, mid: 0 }).signal).toEqual({
      high: 0,
      level: 0,
      low: 0,
      mid: 0,
    });
  });

  it("keeps loud music below saturation and preserves its changing energy", () => {
    const first = resolveRoomAudioFrame({ high: 0.74, low: 0.92, mid: 0.84 });
    const quieterBeat = resolveRoomAudioFrame({ high: 0.46, low: 0.62, mid: 0.54 }, first.range);
    const nextBeat = resolveRoomAudioFrame({ high: 0.78, low: 0.96, mid: 0.88 }, quieterBeat.range);

    expect(Math.max(...Object.values(first.signal))).toBeLessThan(0.94);
    expect(new Set(Object.values(first.signal)).size).toBeGreaterThan(2);
    expect(quieterBeat.signal.level).toBeLessThan(first.signal.level);
    expect(nextBeat.signal.level).toBeGreaterThan(quieterBeat.signal.level);
    expect(nextBeat.signal.level).toBeLessThan(0.94);
    expect(nextBeat.range.ceiling).toBeGreaterThan(1);
  });

  it("recovers sensitivity after the room becomes quieter", () => {
    let frame = resolveRoomAudioFrame({ high: 0.72, low: 0.9, mid: 0.8 });
    const firstQuietFrame = resolveRoomAudioFrame(
      { high: 0.08, low: 0.16, mid: 0.12 },
      frame.range,
    );

    frame = firstQuietFrame;
    for (let index = 0; index < 120; index += 1) {
      frame = resolveRoomAudioFrame({ high: 0.08, low: 0.16, mid: 0.12 }, frame.range, 1000 / 60);
    }

    expect(frame.range.ceiling).toBeLessThan(firstQuietFrame.range.ceiling);
    expect(frame.signal.level).toBeGreaterThan(firstQuietFrame.signal.level);
  });

  it("settles constant room noise without hiding the next sound", () => {
    let frame = resolveRoomAudioFrame({ high: 0.04, low: 0.04, mid: 0.04 });
    const initialLevel = frame.signal.level;

    for (let index = 0; index < 300; index += 1) {
      frame = resolveRoomAudioFrame({ high: 0.04, low: 0.04, mid: 0.04 }, frame.range, 1000 / 60);
    }
    const nextSound = resolveRoomAudioFrame({ high: 0.12, low: 0.18, mid: 0.15 }, frame.range);

    expect(frame.range.floor).toBeGreaterThan(0.02);
    expect(frame.signal.level).toBeLessThan(initialLevel);
    expect(nextSound.signal.level).toBeGreaterThan(frame.signal.level);
  });

  it("starts automatic capture only while its owning slide is active", () => {
    const outsideSlide = { closest: () => null } as unknown as Element;
    const activeSlide = {
      closest: () => ({ getAttribute: () => "active" }),
    } as unknown as Element;
    const inactiveSlide = {
      closest: () => ({ getAttribute: () => "inactive" }),
    } as unknown as Element;

    expect(isRoomAudioOwnerActive(outsideSlide)).toBe(true);
    expect(isRoomAudioOwnerActive(activeSlide)).toBe(true);
    expect(isRoomAudioOwnerActive(inactiveSlide)).toBe(false);
  });

  it("releases every room-audio resource when the source stops", async () => {
    const calls: string[] = [];
    const session = {
      context: {
        suspend: () => {
          calls.push("suspend");
          return Promise.resolve();
        },
      },
      frame: 12,
      source: {
        disconnect: () => calls.push("disconnect"),
      },
      stream: {
        getTracks: () => [
          { stop: () => calls.push("stop first") },
          { stop: () => calls.push("stop second") },
        ],
      },
    };

    await deactivateRoomAudio(session, (frame) => calls.push(`cancel ${frame}`));

    expect(calls).toEqual(["cancel 12", "disconnect", "stop first", "stop second", "suspend"]);
    expect(session.frame).toBeUndefined();
    expect(session.source).toBeUndefined();
    expect(session.stream).toBeUndefined();
  });

  it("closes the audio context when a room-audio scene is disposed", async () => {
    const calls: string[] = [];
    const session = {
      context: {
        close: () => {
          calls.push("close");
          return Promise.resolve();
        },
      },
      frame: 17,
      source: {
        disconnect: () => calls.push("disconnect"),
      },
      stream: {
        getTracks: () => [{ stop: () => calls.push("stop") }],
      },
    };

    await disposeRoomAudio(session, (frame) => calls.push(`cancel ${frame}`));

    expect(calls).toEqual(["cancel 17", "disconnect", "stop", "close"]);
    expect(session.frame).toBeUndefined();
    expect(session.source).toBeUndefined();
    expect(session.stream).toBeUndefined();
  });

  it("renders an audience audio control without autoplay", () => {
    const markup = renderToStaticMarkup(
      createElement(Soundtrack, {
        artist: "Drever studio",
        src: "/opening-loop.wav",
        title: "Before the room speaks",
      }),
    );

    expect(markup).toContain('data-source-mode="audio-reactive"');
    expect(markup).toContain("<audio");
    expect(markup).not.toContain("autoplay");
    expect(markup).toContain("Start room");
  });

  it("pauses local media and cancels its analyzer frame when a slide becomes inactive", () => {
    let pauses = 0;
    const cancelled: number[] = [];
    const graph = { frame: 42 };

    pauseSoundtrackPlayback(
      {
        pause: () => {
          pauses += 1;
        },
      },
      graph,
      (frame) => cancelled.push(frame),
    );

    expect(pauses).toBe(1);
    expect(cancelled).toEqual([42]);
    expect(graph.frame).toBeUndefined();

    pauseSoundtrackPlayback(null, graph, (frame) => cancelled.push(frame));
    expect(cancelled).toEqual([42]);
  });

  it("preserves the media graph when an inactive slide pauses playback", () => {
    let closures = 0;
    let pauses = 0;
    let suspensions = 0;
    const graph = {
      context: {
        close: () => {
          closures += 1;
          return Promise.resolve();
        },
        suspend: () => {
          suspensions += 1;
          return Promise.resolve();
        },
      },
      frame: 21,
    };

    deactivateSoundtrackPlayback(
      {
        pause: () => {
          pauses += 1;
        },
      },
      graph,
      () => undefined,
    );

    expect(pauses).toBe(1);
    expect(suspensions).toBe(1);
    expect(closures).toBe(0);
    expect(graph.frame).toBeUndefined();
  });

  it.each(["document", "export", "speaker-current", "speaker-next"] as const)(
    "keeps %s deterministic and free of media elements",
    (mode) => {
      const markup = renderToStaticMarkup(
        createElement(
          DreverRenderModeProvider,
          { mode },
          createElement(Soundtrack, {
            playlistUrl: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
            src: "/opening-loop.wav",
            title: "Before the room speaks",
          }),
        ),
      );

      expect(markup).toContain("Playback available in audience view");
      expect(markup).toContain("Open in Spotify");
      expect(markup).not.toContain("<audio");
      expect(markup).not.toContain("<iframe");
      expect(markup).not.toContain("<button");
    },
  );

  it.each(["document", "export", "speaker-current", "speaker-next"] as const)(
    "keeps %s free of permissioned room-audio inputs",
    (mode) => {
      const markup = renderToStaticMarkup(
        createElement(DreverRenderModeProvider, { mode }, createElement(RoomAudio)),
      );

      expect(markup).toContain("Microphone available in audience view");
      expect(markup).not.toContain("<audio");
      expect(markup).not.toContain("<button");
    },
  );

  it("uses authored countdown copy on non-audience surfaces", () => {
    const markup = renderToStaticMarkup(
      createElement(
        DreverRenderModeProvider,
        { mode: "export" },
        createElement(RoomCountdown, {
          fallbackLabel: "Doors open shortly",
          target: "2027-01-01T09:00:00Z",
        }),
      ),
    );

    expect(markup).toContain("Doors open shortly");
    expect(markup).toMatch(/datetime="2027-01-01T09:00:00Z"/iu);
  });
});
