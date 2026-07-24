import { useEffect, useState } from "react";

type BrowserCapability =
  | "broadcast-channel"
  | "document-view-transition"
  | "navigation"
  | "resize-observer";

type BrowserPlatform = Readonly<{
  broadcastChannel?: unknown;
  documentViewTransition?: unknown;
  navigationAbortSignal?: boolean;
  navigation?: Readonly<{
    addEventListener?: unknown;
    navigate?: unknown;
    removeEventListener?: unknown;
    updateCurrentEntry?: unknown;
  }> | null;
  resizeObserver?: unknown;
}>;

/** Mirrors the stricter presentation client contract for a website notice only. */
export const readMissingBrowserCapabilities = ({
  broadcastChannel,
  documentViewTransition,
  navigationAbortSignal,
  navigation,
  resizeObserver,
}: BrowserPlatform): readonly BrowserCapability[] => {
  const missing: BrowserCapability[] = [];

  if (
    typeof navigation !== "object" ||
    navigation === null ||
    typeof navigation.addEventListener !== "function" ||
    typeof navigation.navigate !== "function" ||
    typeof navigation.removeEventListener !== "function" ||
    typeof navigation.updateCurrentEntry !== "function" ||
    navigationAbortSignal !== true
  ) {
    missing.push("navigation");
  }
  if (typeof documentViewTransition !== "function") {
    missing.push("document-view-transition");
  }
  if (typeof broadcastChannel !== "function") {
    missing.push("broadcast-channel");
  }
  if (typeof resizeObserver !== "function") {
    missing.push("resize-observer");
  }

  return Object.freeze(missing);
};

export function BrowserSupportNotice() {
  const [dismissed, setDismissed] = useState(false);
  const [limited, setLimited] = useState(false);

  useEffect(() => {
    const missing = readMissingBrowserCapabilities({
      broadcastChannel: window.BroadcastChannel,
      documentViewTransition: Reflect.get(document, "startViewTransition"),
      navigationAbortSignal:
        typeof window.NavigateEvent === "function" &&
        Reflect.has(window.NavigateEvent.prototype, "signal"),
      navigation: window.navigation,
      resizeObserver: window.ResizeObserver,
    });
    setLimited(missing.length > 0);
  }, []);

  if (dismissed || !limited) return null;

  return (
    <aside
      aria-labelledby="browser-support-title"
      className="browser-support-notice"
      data-browser-support-notice=""
      data-nosnippet=""
    >
      <span aria-hidden="true" className="browser-support-notice__signal">
        <i />
      </span>
      <div aria-live="polite" role="status">
        <strong id="browser-support-title">This browser limits live presentations.</strong>
        <span>
          You can keep browsing here. Open live decks in a current Safari or Chromium-family browser
          for the full experience.
        </span>
      </div>
      <button
        aria-label="Dismiss browser compatibility notice"
        onClick={() => setDismissed(true)}
        type="button"
      >
        <span aria-hidden="true">×</span>
      </button>
    </aside>
  );
}
