import { describe, expect, it } from "vite-plus/test";
import { readMissingBrowserCapabilities } from "./browser-support-notice";

const browserPlatform = (elementViewTransition = true) => ({
  broadcastChannel: class {},
  documentViewTransition() {},
  elementViewTransition: elementViewTransition ? () => undefined : undefined,
  navigation: {
    addEventListener: () => undefined,
    navigate: () => undefined,
    removeEventListener: () => undefined,
    updateCurrentEntry: () => undefined,
  },
  resizeObserver: class {},
});

describe("website browser support notice", () => {
  it("marks a complete browser as supported", () => {
    expect(readMissingBrowserCapabilities(browserPlatform())).toEqual([]);
  });

  it("marks missing presentation capabilities as limited rather than blocking the site", () => {
    expect(readMissingBrowserCapabilities(browserPlatform(false))).toEqual([
      "element-view-transition",
    ]);
  });
});
