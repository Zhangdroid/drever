import type { JsonObject, SlideManifest } from "@drever/schema";
import { DreverClientError } from "./client-error.ts";
import type { DeckPosition, PresentationStateMachine } from "./presentation-state.ts";

export type PresentationRouteSurface = "audience" | "speaker";

export type PresentationRouteCodec = Readonly<{
  basePathname: string;
  decodeURL(url: URL): DeckPosition;
  encodeURL(position: DeckPosition, sourceURL?: URL): URL;
  ownsURL(url: URL): boolean;
  surface: PresentationRouteSurface;
}>;

export type CreatePresentationRouteCodecOptions = Readonly<{
  baseURL: URL;
  machine: PresentationStateMachine;
  surface?: PresentationRouteSurface;
}>;

const fail = (message: string, details?: JsonObject): never => {
  throw new DreverClientError(
    "DREVER_CLIENT_ROUTE_INVALID",
    message,
    details === undefined ? {} : { details },
  );
};

const normalizeBasePathname = (pathname: string): string =>
  pathname === "/" ? pathname : `${pathname.replace(/\/+$/u, "")}/`;

const relativePathname = (pathname: string, basePathname: string): string | undefined => {
  if (pathname === basePathname) {
    return "";
  }
  if (basePathname !== "/" && pathname === basePathname.slice(0, -1)) {
    return "";
  }
  return pathname.startsWith(basePathname) ? pathname.slice(basePathname.length) : undefined;
};

const splitPath = (relative: string): readonly string[] => {
  const withoutDirectorySlash = relative.endsWith("/") ? relative.slice(0, -1) : relative;
  return withoutDirectorySlash === ""
    ? Object.freeze([])
    : Object.freeze(withoutDirectorySlash.split("/"));
};

const parseCanonicalInteger = (source: string, label: "slide" | "step"): number => {
  if (!/^[1-9]\d*$/u.test(source)) {
    return fail(`The ${label} path segment "${source}" is not a canonical positive integer.`, {
      [label]: source,
    });
  }
  const value = Number(source);
  if (!Number.isSafeInteger(value)) {
    return fail(`The ${label} path segment "${source}" exceeds the safe integer range.`, {
      [label]: source,
    });
  }
  return value;
};

const slideAt = (source: string, machine: PresentationStateMachine): SlideManifest => {
  const ordinal = parseCanonicalInteger(source, "slide");
  const slide = machine.manifest.slides[ordinal - 1];
  if (slide === undefined) {
    return fail(`Slide ${source} does not exist in this deck.`, { slide: source });
  }
  return slide;
};

const positionAt = (slide: SlideManifest, step: number): DeckPosition =>
  Object.freeze({ slideId: slide.id, slideIndex: slide.index, step });

const stepAt = (source: string, slide: SlideManifest): number => {
  const step = parseCanonicalInteger(source, "step");
  if (!slide.stepStops.includes(step)) {
    return fail(`Step ${source} is not a navigation stop for slide ${slide.index + 1}.`, {
      slide: String(slide.index + 1),
      step: source,
    });
  }
  return step;
};

/**
 * Encodes the stable URL contract independently from the audience or speaker UI.
 * The base URL is a mount directory; `/talk` and `/talk/` both canonicalize to `/talk/`.
 */
export const createPresentationRouteCodec = ({
  baseURL: inputBaseURL,
  machine,
  surface = "audience",
}: CreatePresentationRouteCodecOptions): PresentationRouteCodec => {
  const baseURL = new URL(inputBaseURL);
  const basePathname = normalizeBasePathname(baseURL.pathname);
  baseURL.pathname = basePathname;
  const firstSlide = machine.manifest.slides[0] as SlideManifest;

  const segmentsFor = (url: URL): readonly string[] | undefined => {
    if (url.origin !== baseURL.origin) {
      return;
    }
    const relative = relativePathname(url.pathname, basePathname);
    if (relative === undefined) {
      return;
    }
    const segments = splitPath(relative);
    if (surface === "speaker") {
      return segments[0] === "speaker" ? segments.slice(1) : undefined;
    }
    return segments[0] === "speaker" ? undefined : segments;
  };

  const ownsURL = (url: URL): boolean => segmentsFor(url) !== undefined;

  const decodeURL = (url: URL): DeckPosition => {
    const segments = segmentsFor(url);
    if (segments === undefined) {
      return fail(`The URL is outside the ${surface} presentation route.`, {
        pathname: url.pathname,
        surface,
      });
    }
    if (segments.length === 0) {
      return positionAt(firstSlide, 0);
    }
    if (segments.length > 2 || segments.some((segment) => segment.length === 0)) {
      return fail(`The pathname "${url.pathname}" is not a canonical Drever route.`, {
        pathname: url.pathname,
        surface,
      });
    }
    const slide = slideAt(segments[0] as string, machine);
    if (segments.length === 1 && slide.index === 0) {
      return fail(`The pathname "${url.pathname}" is not a canonical Drever route.`, {
        canonicalPathname: `${basePathname}${surface === "speaker" ? "speaker" : ""}`,
        pathname: url.pathname,
        surface,
      });
    }
    return positionAt(slide, segments.length === 1 ? 0 : stepAt(segments[1] as string, slide));
  };

  const encodeURL = (positionInput: DeckPosition, sourceURL: URL = baseURL): URL => {
    const position = machine.validatePosition(positionInput);
    const routeSegments: string[] = surface === "speaker" ? ["speaker"] : [];
    if (position.step !== 0) {
      routeSegments.push(String(position.slideIndex + 1), String(position.step));
    } else if (position.slideIndex !== 0) {
      routeSegments.push(String(position.slideIndex + 1));
    }

    const url = new URL(baseURL);
    url.pathname = `${basePathname}${routeSegments.join("/")}`;
    url.search = sourceURL.search;
    url.hash = sourceURL.hash;
    return url;
  };

  return Object.freeze({ basePathname, decodeURL, encodeURL, ownsURL, surface });
};
