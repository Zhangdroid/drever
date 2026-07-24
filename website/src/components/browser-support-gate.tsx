import lockupDarkHref from "@drever/brand/assets/drever-lockup-dark.svg";

const requiredCapabilities = [
  ["navigation", "Navigation API"],
  ["document-view-transition", "Document View Transitions"],
  ["element-view-transition", "Scoped element View Transitions"],
  ["broadcast-channel", "BroadcastChannel"],
  ["resize-observer", "ResizeObserver"],
] as const;

/**
 * Runs before the application hydrates so unsupported browsers never paint the site shell.
 * Keep this capability contract aligned with packages/client/src/platform-support.ts.
 */
export const browserSupportCheckScript = `(function () {
  var missing = [];
  var root = document.documentElement;
  var navigation = window.navigation;

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
  if (typeof document.startViewTransition !== "function") {
    missing.push("document-view-transition");
  }
  if (
    typeof window.Element !== "function" ||
    typeof window.Element.prototype.startViewTransition !== "function"
  ) {
    missing.push("element-view-transition");
  }
  if (typeof window.BroadcastChannel !== "function") {
    missing.push("broadcast-channel");
  }
  if (typeof window.ResizeObserver !== "function") {
    missing.push("resize-observer");
  }

  root.setAttribute("data-browser-missing", missing.join(" "));
  root.setAttribute("data-browser-support", missing.length === 0 ? "supported" : "unsupported");
  if (missing.length > 0) {
    var themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor !== null) {
      themeColor.setAttribute("content", "#111018");
    }
  }
})();`;

export function BrowserSupportGate() {
  return (
    <div
      aria-labelledby="browser-support-title"
      className="browser-support-gate"
      data-browser-support-gate=""
      data-header-tone="dark"
      data-nosnippet=""
      role="main"
    >
      <header className="browser-support-gate__header">
        <img alt="Drever" src={lockupDarkHref} />
        <span>Modern browser required</span>
      </header>

      <div className="browser-support-gate__layout">
        <section className="browser-support-gate__copy">
          <p className="browser-support-gate__eyebrow">The browser is part of the canvas.</p>
          <h1 id="browser-support-title">This browser can’t run Drever yet.</h1>
          <p>
            Drever uses native navigation and scoped motion as product primitives. It does not
            replace them with a reduced fallback.
          </p>
          <p className="browser-support-gate__recommendation">
            Open this page in the latest desktop Chrome to continue.
          </p>
        </section>

        <aside aria-label="Required browser capabilities" className="browser-support-gate__status">
          <div aria-hidden="true" className="browser-support-gate__signal">
            <i />
            <i />
            <i />
          </div>
          <span>Missing capability</span>
          <ul>
            {requiredCapabilities.map(([id, label]) => (
              <li data-browser-feature={id} key={id}>
                <i aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
