import { expect, type Page, type Request } from "@playwright/test";

type PageFailure = Readonly<{
  kind: "console" | "pageerror" | "request" | "response";
  message: string;
}>;

export type PageHealth = Readonly<{
  expectHealthy(): void;
}>;

const isViteOptimizerCancellation = (request: Request): boolean => {
  if (request.resourceType() !== "script" || request.failure()?.errorText !== "net::ERR_ABORTED") {
    return false;
  }

  return new URL(request.url()).pathname.startsWith("/.vite/deps/");
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
    // Vite may replace its cold dependency graph and reload while the first
    // page is opening. Chromium reports the superseded script as aborted even
    // though the replacement graph loads successfully.
    if (isViteOptimizerCancellation(request)) return;

    failures.push({
      kind: "request",
      message: `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "unknown failure"}`,
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
