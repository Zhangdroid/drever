import { expect, type Page } from "@playwright/test";

type PageFailure = Readonly<{
  kind: "console" | "pageerror" | "request" | "response";
  message: string;
}>;

export type PageHealth = Readonly<{
  expectHealthy(): void;
}>;

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
