import { describe, expect, it, vi } from "vite-plus/test";
import { requireViewerPlatform } from "./platform-support.ts";

const candidateDocument = (
  capabilities: Readonly<{
    broadcastChannel?: unknown;
    clipboard?: unknown;
    documentStartViewTransition?: unknown;
    navigateEventSignal?: boolean;
    navigation?: unknown;
    resizeObserver?: unknown;
  }> = {},
): Document => {
  const document = {
    startViewTransition:
      capabilities.documentStartViewTransition ??
      (() => Object.freeze({ finished: Promise.resolve() })),
  };
  Object.defineProperty(document, "defaultView", {
    value: {
      BroadcastChannel: capabilities.broadcastChannel ?? class {},
      NavigateEvent:
        capabilities.navigateEventSignal === false
          ? class {}
          : class {
              get signal(): AbortSignal {
                return new AbortController().signal;
              }
            },
      ResizeObserver: capabilities.resizeObserver ?? class {},
      navigator: {
        clipboard: capabilities.clipboard ?? { writeText: () => Promise.resolve() },
      },
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
  it("accepts document transitions without requiring an element transition API", () => {
    const startViewTransition = vi.fn();
    const document = candidateDocument({ documentStartViewTransition: startViewTransition });
    const platform = requireViewerPlatform(document);

    expect(platform).toMatchObject({
      document,
      keyboardTarget: document,
    });
    expect(platform.navigation).toBe(document.defaultView?.navigation);
    expect(platform.clipboard).toBe(document.defaultView?.navigator.clipboard);
    expect(Object.isFrozen(platform)).toBe(true);
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it("keeps Clipboard API support optional because sharing must not block presentation", () => {
    const document = candidateDocument({ clipboard: false });

    const platform = requireViewerPlatform(document);

    expect(platform.clipboard).toBeUndefined();
  });

  it("reports every missing capability without selecting a fallback", () => {
    const document = candidateDocument({
      broadcastChannel: false,
      documentStartViewTransition: false,
      navigateEventSignal: false,
      navigation: false,
      resizeObserver: false,
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
            "Document.startViewTransition",
            "ResizeObserver",
          ],
        },
      });
    }
  });

  it("requires the document API", () => {
    const document = candidateDocument({
      documentStartViewTransition: false,
    });

    expect(() => requireViewerPlatform(document)).toThrowError(
      expect.objectContaining({
        details: { capabilities: ["Document.startViewTransition"] },
      }),
    );
  });

  it("requires Navigation API abort signals", () => {
    const document = candidateDocument({ navigateEventSignal: false });

    expect(() => requireViewerPlatform(document)).toThrowError(
      expect.objectContaining({
        details: { capabilities: ["Navigation API"] },
      }),
    );
  });

  it("rejects detached documents", () => {
    const document = Object.freeze({ defaultView: null }) as unknown as Document;
    expect(() => requireViewerPlatform(document)).toThrowError(
      expect.objectContaining({ code: "DREVER_CLIENT_PLATFORM_UNSUPPORTED" }),
    );
  });
});
