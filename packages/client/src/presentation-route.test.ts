import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { describe, expect, it } from "vite-plus/test";
import { createPresentationRouteCodec } from "./presentation-route.ts";
import { createPresentationStateMachine, type DeckPosition } from "./presentation-state.ts";

const manifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "intro", index: 0, speakerNotes: [], stepStops: [2, 5] },
    { id: "details", index: 1, speakerNotes: [], stepStops: [3] },
    { id: "end", index: 2, speakerNotes: [], stepStops: [] },
  ],
} as const satisfies DeckManifest;

const machine = createPresentationStateMachine(manifest);
const position = (slideId: string, slideIndex: number, step: number): DeckPosition => ({
  slideId,
  slideIndex,
  step,
});

describe("presentation route codec", () => {
  it("round-trips canonical audience paths and preserves query and hash state", () => {
    const route = createPresentationRouteCodec({
      baseURL: new URL("https://slides.test/talk?theme=dark&slide=legacy#notes"),
      machine,
    });

    const first = route.encodeURL(position("intro", 0, 0));
    const second = route.encodeURL(position("details", 1, 0));
    const sparseStep = route.encodeURL(position("intro", 0, 5));

    expect(first.href).toBe("https://slides.test/talk/?theme=dark&slide=legacy#notes");
    expect(second.href).toBe("https://slides.test/talk/2?theme=dark&slide=legacy#notes");
    expect(sparseStep.href).toBe("https://slides.test/talk/1/5?theme=dark&slide=legacy#notes");
    expect(route.decodeURL(first)).toEqual(position("intro", 0, 0));
    expect(route.decodeURL(second)).toEqual(position("details", 1, 0));
    expect(route.decodeURL(sparseStep)).toEqual(position("intro", 0, 5));

    const source = new URL("https://slides.test/talk/2?theme=light&mode=present#agenda");
    expect(route.encodeURL(position("details", 1, 3), source).href).toBe(
      "https://slides.test/talk/2/3?theme=light&mode=present#agenda",
    );
  });

  it("accepts static-host directory slashes without making them the encoded form", () => {
    const route = createPresentationRouteCodec({
      baseURL: new URL("https://slides.test/talk"),
      machine,
    });

    expect(route.basePathname).toBe("/talk/");
    expect(route.decodeURL(new URL("https://slides.test/talk"))).toEqual(position("intro", 0, 0));
    expect(route.decodeURL(new URL("https://slides.test/talk/"))).toEqual(position("intro", 0, 0));
    expect(route.decodeURL(new URL("https://slides.test/talk/2"))).toEqual(
      position("details", 1, 0),
    );
    expect(route.decodeURL(new URL("https://slides.test/talk/2/"))).toEqual(
      position("details", 1, 0),
    );
    expect(route.decodeURL(new URL("https://slides.test/talk/2/3/"))).toEqual(
      position("details", 1, 3),
    );
    expect(() => route.decodeURL(new URL("https://slides.test/talk/1"))).toThrowError(
      expect.objectContaining({ code: "DREVER_CLIENT_ROUTE_INVALID" }),
    );
  });

  it("owns invalid audience paths under its base so navigation can cancel them", () => {
    const route = createPresentationRouteCodec({
      baseURL: new URL("https://slides.test/talk/"),
      machine,
    });

    for (const pathname of [
      "/talk/0",
      "/talk/01",
      "/talk/4",
      "/talk/2/0",
      "/talk/2/2",
      "/talk/2/3/4",
      "/talk/2//",
      "/talk/%32",
      "/talk//2",
    ]) {
      const url = new URL(pathname, "https://slides.test");
      expect(route.ownsURL(url)).toBe(true);
      expect(() => route.decodeURL(url)).toThrowError(
        expect.objectContaining({ code: "DREVER_CLIENT_ROUTE_INVALID" }),
      );
    }

    expect(route.ownsURL(new URL("https://slides.test/talk-show/2"))).toBe(false);
    expect(route.ownsURL(new URL("https://other.test/talk/2"))).toBe(false);
  });

  it("reserves speaker paths and expresses their canonical equivalents", () => {
    const baseURL = new URL("https://slides.test/talk/");
    const audience = createPresentationRouteCodec({ baseURL, machine });
    const speaker = createPresentationRouteCodec({ baseURL, machine, surface: "speaker" });

    expect(audience.ownsURL(new URL("https://slides.test/talk/speaker"))).toBe(false);
    expect(speaker.ownsURL(new URL("https://slides.test/talk/2"))).toBe(false);
    expect(speaker.decodeURL(new URL("https://slides.test/talk/speaker"))).toEqual(
      position("intro", 0, 0),
    );
    expect(speaker.decodeURL(new URL("https://slides.test/talk/speaker/2"))).toEqual(
      position("details", 1, 0),
    );
    expect(speaker.decodeURL(new URL("https://slides.test/talk/speaker/2/"))).toEqual(
      position("details", 1, 0),
    );
    expect(speaker.decodeURL(new URL("https://slides.test/talk/speaker/1/5"))).toEqual(
      position("intro", 0, 5),
    );
    expect(speaker.encodeURL(position("intro", 0, 0)).pathname).toBe("/talk/speaker");
    expect(speaker.encodeURL(position("details", 1, 0)).pathname).toBe("/talk/speaker/2");
    expect(speaker.encodeURL(position("intro", 0, 5)).pathname).toBe("/talk/speaker/1/5");
    expect(() => speaker.decodeURL(new URL("https://slides.test/talk/speaker/1"))).toThrowError(
      expect.objectContaining({ code: "DREVER_CLIENT_ROUTE_INVALID" }),
    );
  });
});
