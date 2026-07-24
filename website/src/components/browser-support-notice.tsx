import { useEffect, useState } from "react";

type BrowserCapability =
  | "broadcast-channel"
  | "document-view-transition"
  | "element-view-transition"
  | "navigation"
  | "resize-observer";

type BrowserPlatform = Readonly<{
  broadcastChannel?: unknown;
  documentViewTransition?: unknown;
  elementViewTransition?: unknown;
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
  elementViewTransition,
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
    typeof navigation.updateCurrentEntry !== "function"
  ) {
    missing.push("navigation");
  }
  if (typeof documentViewTransition !== "function") {
    missing.push("document-view-transition");
  }
  if (typeof elementViewTransition !== "function") {
    missing.push("element-view-transition");
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
      elementViewTransition: Reflect.get(window.Element.prototype, "startViewTransition"),
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
      <div>
        <strong id="browser-support-title">Full presentation motion uses Chrome.</strong>
        <span>
          You can keep browsing here. Open live decks in the latest desktop Chrome for scoped
          transitions.
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
