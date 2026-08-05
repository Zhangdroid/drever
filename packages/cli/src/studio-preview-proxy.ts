import {
  createServer,
  request as requestHttp,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { request as requestHttps } from "node:https";
import type { AddressInfo, Socket } from "node:net";

export type StudioPreviewProxy = Readonly<{
  audienceUrl: string;
  close(): Promise<void>;
}>;

const isStudioPath = (url: string | undefined): boolean => {
  if (url === undefined) return false;
  return /(?:^|\/)studio\/?$/u.test(new URL(url, "http://localhost").pathname);
};

const upstreamHeaders = (headers: IncomingHttpHeaders, target: URL): IncomingHttpHeaders => ({
  ...headers,
  host: target.host,
});

const loopbackHostname = (hostname: string): "127.0.0.1" | "::1" | "localhost" => {
  if (hostname === "localhost") return "localhost";
  if (hostname === "[::1]" || hostname === "::1") return "::1";
  if (/^127(?:\.\d{1,3}){3}$/u.test(hostname)) return "127.0.0.1";
  throw new TypeError("The Studio preview target must use a loopback hostname.");
};

const upstreamPath = (url: string | undefined): string => {
  const parsed = new URL(url ?? "/", "http://drever.invalid");
  return `${parsed.pathname}${parsed.search}`;
};

const writeProxyFailure = (response: ServerResponse): void => {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.statusCode = 502;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.end("The isolated Drever preview is temporarily unavailable.\n");
};

/** @internal Serves the live deck on a distinct loopback origin without exposing Studio routes. */
export const startStudioPreviewProxy = async (
  targetAudienceUrl: string,
): Promise<StudioPreviewProxy> => {
  const target = new URL(targetAudienceUrl);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new TypeError(`Unsupported Studio preview target protocol: ${target.protocol}`);
  }
  if (target.username !== "" || target.password !== "") {
    throw new TypeError("The Studio preview target cannot include credentials.");
  }
  const hostname = loopbackHostname(target.hostname);
  const requestUpstream = target.protocol === "https:" ? requestHttps : requestHttp;
  const sockets = new Set<Socket>();
  const server = createServer((request, response) => {
    if (isStudioPath(request.url)) {
      response.statusCode = 404;
      response.end();
      return;
    }
    const upstream = requestUpstream({
      hostname,
      port: target.port,
      protocol: target.protocol,
      path: upstreamPath(request.url),
      headers: upstreamHeaders(request.headers, target),
      method: request.method,
    });
    upstream.once("response", (upstreamResponse: IncomingMessage) => {
      const headers = { ...upstreamResponse.headers };
      delete headers["x-frame-options"];
      response.writeHead(upstreamResponse.statusCode ?? 502, headers);
      upstreamResponse.pipe(response);
    });
    upstream.once("error", () => writeProxyFailure(response));
    request.pipe(upstream);
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  server.on("upgrade", (request, clientSocket, head) => {
    if (isStudioPath(request.url)) {
      clientSocket.destroy();
      return;
    }
    const upstream = requestUpstream({
      hostname,
      port: target.port,
      protocol: target.protocol,
      path: upstreamPath(request.url),
      headers: upstreamHeaders(request.headers, target),
      method: request.method,
    });
    upstream.once("upgrade", (response, upstreamSocket, upstreamHead) => {
      const responseHeaders = response.rawHeaders
        .map((value, index) => (index % 2 === 0 ? `${value}: ` : `${value}\r\n`))
        .join("");
      clientSocket.write(
        `HTTP/${response.httpVersion} ${String(response.statusCode)} ${response.statusMessage ?? "Switching Protocols"}\r\n${responseHeaders}\r\n`,
      );
      if (upstreamHead.length > 0) clientSocket.write(upstreamHead);
      if (head.length > 0) upstreamSocket.write(head);
      upstreamSocket.pipe(clientSocket);
      clientSocket.pipe(upstreamSocket);
    });
    upstream.once("response", (response) => {
      clientSocket.end(`HTTP/1.1 ${String(response.statusCode ?? 502)} Upgrade Failed\r\n\r\n`);
    });
    upstream.once("error", () => clientSocket.destroy());
    upstream.end();
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  const audienceUrl = new URL(target.pathname, `http://127.0.0.1:${String(address.port)}`);
  audienceUrl.search = target.search;

  let closing: Promise<void> | undefined;
  return Object.freeze({
    audienceUrl: audienceUrl.href,
    close() {
      closing ??= new Promise<void>((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
        for (const socket of sockets) socket.destroy();
      });
      return closing;
    },
  });
};
