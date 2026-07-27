import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { request as requestHttps } from "node:https";
import { RELEASE_SMOKE_CLAUDE_PROXY_TIMEOUT_MS } from "./limits.mjs";

const apiOrigin = "https://api.anthropic.com";
const maxBodyBytes = 8_000_000;
const maxRequests = 200;

export const resolveAnthropicProxyTarget = (method, path) => {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return;
  const target = new URL(path, apiOrigin);
  if (target.origin !== apiOrigin) return;
  const messageSearchAllowed = target.search === "" || target.search === "?beta=true";
  const allowed =
    (method === "POST" &&
      (target.pathname === "/v1/messages" || target.pathname === "/v1/messages/count_tokens") &&
      messageSearchAllowed) ||
    (method === "GET" &&
      (/^\/v1\/models(?:\/[^/]+)?$/u.test(target.pathname) ||
        target.pathname === "/v1/organizations/me"));
  return allowed ? target : undefined;
};

const readBoundedBody = (request) =>
  new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    let bytes = 0;
    request.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBodyBytes) {
        rejectPromise(new Error("Anthropic proxy request exceeded 8 MB."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.once("end", () => resolvePromise(Buffer.concat(chunks)));
    request.once("error", rejectPromise);
  });

const forwardRequest = async ({ apiKey, incoming, model, response, target }) => {
  const body = await readBoundedBody(incoming);
  if (target.pathname === "/v1/messages") {
    const payload = JSON.parse(body.toString("utf8"));
    if (payload?.model !== model) {
      response.writeHead(403).end();
      return;
    }
  }
  const headers = {
    accept: incoming.headers.accept ?? "application/json",
    "anthropic-version": incoming.headers["anthropic-version"] ?? "2023-06-01",
    "content-length": String(body.length),
    "content-type": incoming.headers["content-type"] ?? "application/json",
    "user-agent": incoming.headers["user-agent"] ?? "drever-release-smoke",
    "x-api-key": apiKey,
  };
  if (incoming.headers["anthropic-beta"] !== undefined) {
    headers["anthropic-beta"] = incoming.headers["anthropic-beta"];
  }
  await new Promise((resolvePromise, rejectPromise) => {
    const upstream = requestHttps(
      target,
      { headers, method: incoming.method, timeout: RELEASE_SMOKE_CLAUDE_PROXY_TIMEOUT_MS },
      (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
        upstreamResponse.once("end", resolvePromise);
      },
    );
    upstream.once("error", rejectPromise);
    upstream.once("timeout", () => upstream.destroy(new Error("Anthropic request timed out.")));
    upstream.end(body);
  });
};

export const createProtectedAnthropicProxy = async ({ apiKey, model }) => {
  const token = randomBytes(32).toString("base64url");
  let requestCount = 0;
  const server = createServer((incoming, response) => {
    requestCount += 1;
    const target = resolveAnthropicProxyTarget(incoming.method, incoming.url ?? "");
    if (
      requestCount > maxRequests ||
      incoming.headers["x-api-key"] !== token ||
      target === undefined
    ) {
      response.writeHead(403).end();
      return;
    }
    forwardRequest({ apiKey, incoming, model, response, target }).catch(() => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
  });
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Could not bind the protected Anthropic proxy.");
  }
  return {
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    close: () =>
      new Promise((resolvePromise, rejectPromise) =>
        server.close((error) => (error === undefined ? resolvePromise() : rejectPromise(error))),
      ),
    token,
  };
};
