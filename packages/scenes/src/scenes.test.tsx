import { DreverRenderModeProvider } from "@drever/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { resolveMusicEmbed, RoomAudio, RoomCountdown, Soundtrack } from "./index.ts";
import { deactivateRoomAudio } from "./room-audio.tsx";
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
  it("offers explicit room-audio sources without autoplay", () => {
    const markup = renderToStaticMarkup(
      createElement(RoomAudio, {
        track: {
          artist: "Example artist",
          sourceLabel: "Remote demo",
          src: "https://media.example/track.mp3",
          title: "Example track",
        },
      }),
    );

    expect(markup).toContain("Remote demo");
    expect(markup).toContain("Computer audio");
    expect(markup).toContain("Microphone");
    expect(markup).toContain("<audio");
    expect(markup).not.toContain("autoplay");
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
        createElement(
          DreverRenderModeProvider,
          { mode },
          createElement(RoomAudio, {
            track: {
              src: "https://media.example/track.mp3",
              title: "Example track",
            },
          }),
        ),
      );

      expect(markup).toContain("Live input is available in audience view");
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
