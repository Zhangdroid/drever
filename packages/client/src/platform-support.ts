import { DreverClientError } from "./client-error.ts";
import type { NavigationLike } from "./navigation.ts";
import type { PresentationChannelView } from "./presentation-sync.ts";

export type DreverPlatformCapability =
  | "BroadcastChannel"
  | "Document.startViewTransition"
  | "Navigation API"
  | "ResizeObserver";

export type ClipboardWriter = Readonly<{
  writeText(text: string): Promise<void>;
}>;

export type ViewerPlatform = Readonly<{
  channelView: PresentationChannelView;
  clipboard?: ClipboardWriter;
  document: Document;
  keyboardTarget: Document;
  navigation: NavigationLike;
  view: Window;
}>;

type CandidateWindow = Window &
  Readonly<{
    BroadcastChannel?: unknown;
    NavigateEvent?: unknown;
    ResizeObserver?: unknown;
    navigation?: unknown;
  }>;

type CandidateDocument = Document &
  Readonly<{
    startViewTransition?: unknown;
  }>;

const supportsNavigation = (value: unknown): value is NavigationLike => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const navigation = value as Partial<NavigationLike>;
  return (
    typeof navigation.addEventListener === "function" &&
    typeof navigation.navigate === "function" &&
    typeof navigation.removeEventListener === "function" &&
    typeof navigation.updateCurrentEntry === "function"
  );
};

const supportsNavigationAbortSignal = (value: unknown): boolean => {
  if (typeof value !== "function") {
    return false;
  }
  const prototype = Reflect.get(value, "prototype");
  return typeof prototype === "object" && prototype !== null && Reflect.has(prototype, "signal");
};

const missingCapabilities = (
  view: CandidateWindow,
  document: CandidateDocument,
): readonly DreverPlatformCapability[] => {
  const missing: DreverPlatformCapability[] = [];
  if (typeof view.BroadcastChannel !== "function") {
    missing.push("BroadcastChannel");
  }
  if (!supportsNavigation(view.navigation) || !supportsNavigationAbortSignal(view.NavigateEvent)) {
    missing.push("Navigation API");
  }
  if (typeof document.startViewTransition !== "function") {
    missing.push("Document.startViewTransition");
  }
  if (typeof view.ResizeObserver !== "function") {
    missing.push("ResizeObserver");
  }
  return Object.freeze(missing);
};

/**
 * Resolves the modern-browser surface required by the viewer.
 *
 * Drever intentionally has no legacy router, animation, or resize fallback.
 */
export const requireViewerPlatform = (document: Document): ViewerPlatform => {
  const view = document.defaultView as CandidateWindow | null;
  if (view === null) {
    throw new DreverClientError(
      "DREVER_CLIENT_PLATFORM_UNSUPPORTED",
      "Drever requires a browser document connected to a Window.",
      { details: { capabilities: ["Window"] } },
    );
  }

  const missing = missingCapabilities(view, document);
  if (missing.length > 0) {
    throw new DreverClientError(
      "DREVER_CLIENT_PLATFORM_UNSUPPORTED",
      `Drever requires ${missing.join(", ")} in this browser.`,
      { details: { capabilities: missing } },
    );
  }

  const clipboard = view.navigator?.clipboard;

  return Object.freeze({
    channelView: view as PresentationChannelView,
    ...(clipboard === undefined || typeof clipboard.writeText !== "function" ? {} : { clipboard }),
    document,
    keyboardTarget: document,
    navigation: view.navigation as NavigationLike,
    view,
  });
};
