import { describe, expect, it, vi } from "vite-plus/test";
import { requireViewerPlatform } from "./platform-support.ts";

const candidateDocument = (
  capabilities: Readonly<{
    broadcastChannel?: unknown;
    elementStartViewTransition?: unknown;
    navigation?: unknown;
    resizeObserver?: unknown;
  }> = {},
): Document => {
  const document = {};
  Object.defineProperty(document, "defaultView", {
    value: {
      BroadcastChannel: capabilities.broadcastChannel ?? class {},
      Element: {
        prototype: {
          startViewTransition:
            capabilities.elementStartViewTransition ??
            (() => Object.freeze({ finished: Promise.resolve() })),
        },
      },
      ResizeObserver: capabilities.resizeObserver ?? class {},
      navigation: capabilities.navigation ?? {
        addEventListener: () => undefined,
        navigate: () => undefined,
        removeEventListener: () => undefined,
        updateCurrentEntry: () => undefined,
      },
    },
  });
  return document as unknown as Document;
};

describe("viewer platform support", () => {
  it("returns the exact modern browser surfaces used by the viewer", () => {
    const startViewTransition = vi.fn();
    const document = candidateDocument({ elementStartViewTransition: startViewTransition });
    const platform = requireViewerPlatform(document);

    expect(platform).toMatchObject({
      document,
      keyboardTarget: document,
    });
    expect(platform.navigation).toBe(document.defaultView?.navigation);
    expect(Object.isFrozen(platform)).toBe(true);
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it("reports every missing capability without selecting a fallback", () => {
    const document = candidateDocument({
      broadcastChannel: false,
      navigation: false,
      resizeObserver: false,
      elementStartViewTransition: false,
    });

    try {
      requireViewerPlatform(document);
      expect.unreachable("platform validation should fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "DREVER_CLIENT_PLATFORM_UNSUPPORTED",
        details: {
          capabilities: [
            "BroadcastChannel",
            "Navigation API",
            "Element.startViewTransition",
            "ResizeObserver",
          ],
        },
      });
    }
  });

  it("does not accept the document-scoped API as a canvas transition fallback", () => {
    const document = candidateDocument({ elementStartViewTransition: false }) as Document & {
      startViewTransition(): unknown;
    };
    document.startViewTransition = vi.fn();

    expect(() => requireViewerPlatform(document)).toThrowError(
      expect.objectContaining({
        details: { capabilities: ["Element.startViewTransition"] },
      }),
    );
    expect(document.startViewTransition).not.toHaveBeenCalled();
  });

  it("rejects detached documents", () => {
    const document = Object.freeze({ defaultView: null }) as unknown as Document;
    expect(() => requireViewerPlatform(document)).toThrowError(
      expect.objectContaining({ code: "DREVER_CLIENT_PLATFORM_UNSUPPORTED" }),
    );
  });
});
