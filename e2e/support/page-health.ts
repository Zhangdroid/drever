import { expect, type Page, type Request } from "@playwright/test";

type PageFailure = Readonly<{
  kind: "console" | "pageerror" | "request" | "response";
  message: string;
}>;

export type PageHealth = Readonly<{
  expectHealthy(): void;
}>;

const isViteModuleCancellation = (request: Request): boolean => {
  if (request.resourceType() !== "script" || request.failure()?.errorText !== "net::ERR_ABORTED") {
    return false;
  }

  const pathname = new URL(request.url()).pathname;
  return (
    pathname.startsWith("/.vite/deps/") ||
    pathname.startsWith("/@fs/") ||
    pathname.startsWith("/@id/")
  );
};

const isEmbeddedFrameNavigationCancellation = (page: Page, request: Request): boolean => {
  if (request.failure()?.errorText !== "net::ERR_ABORTED") return false;

  return request.frame() !== page.mainFrame();
};

/** Captures failures that DOM assertions often miss in a client-rendered application. */
export const monitorPageHealth = (page: Page): PageHealth => {
  const failures: PageFailure[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push({ kind: "console", message: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    failures.push({ kind: "pageerror", message: error.message });
  });
  page.on("requestfailed", (request) => {
    // Navigating or removing an embedded preview cancels its in-flight Vite
    // modules. Keep that browser lifecycle separate from failures in the
    // Studio shell; target-frame assertions still verify the new preview.
    if (isEmbeddedFrameNavigationCancellation(page, request)) return;

    // Vite may replace its cold dependency graph and reload while the first
    // page is opening. Chromium reports superseded dependency and source
    // modules as aborted even though the replacement graph loads successfully.
    if (isViteModuleCancellation(request)) return;

    failures.push({
      kind: "request",
      message: `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "unknown failure"} (frame: ${request.frame().url()})`,
    });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failures.push({
        kind: "response",
        message: `${response.status()} ${response.request().method()} ${response.url()}`,
      });
    }
  });

  return Object.freeze({
    expectHealthy() {
      expect(
        failures,
        failures.map(({ kind, message }) => `[${kind}] ${message}`).join("\n"),
      ).toEqual([]);
    },
  });
};
