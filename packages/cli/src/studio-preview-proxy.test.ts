import { createServer, request } from "node:http";
import { connect, type AddressInfo } from "node:net";
import type { Duplex } from "node:stream";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { startStudioPreviewProxy, type StudioPreviewProxy } from "./studio-preview-proxy.ts";

const closeServer = (server: ReturnType<typeof createServer>): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });

const requestAbsolutePath = (url: URL, path: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const pending = request(
      {
        hostname: url.hostname,
        port: url.port,
        path,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          body += chunk;
        });
        response.once("end", () => resolve(body));
      },
    );
    pending.once("error", reject);
    pending.end();
  });

const resetUpgradedConnection = (url: URL): Promise<void> =>
  new Promise((resolve, reject) => {
    const socket = connect(Number(url.port), url.hostname);
    socket.once("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ECONNRESET") {
        resolve();
        return;
      }
      reject(error);
    });
    socket.once("connect", () => {
      socket.write(
        `GET /socket HTTP/1.1\r\nHost: ${url.host}\r\nConnection: Upgrade\r\nUpgrade: drever-test\r\n\r\n`,
      );
    });
    socket.once("data", () => {
      socket.resetAndDestroy();
      resolve();
    });
  });

describe("isolated Studio preview proxy", () => {
  const close: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(close.splice(0).map((dispose) => dispose()));
  });

  it("serves the audience on another origin, strips parent frame protection, and denies Studio", async () => {
    let studioRequests = 0;
    const upstream = createServer((request, response) => {
      if (request.url?.includes("/studio") === true) studioRequests += 1;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader("X-Frame-Options", "DENY");
      response.end("<main>Rendered deck</main>");
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    close.push(() => closeServer(upstream));
    const targetPort = (upstream.address() as AddressInfo).port;
    const targetUrl = `http://127.0.0.1:${String(targetPort)}/talk/`;

    let preview: StudioPreviewProxy | undefined;
    try {
      preview = await startStudioPreviewProxy(targetUrl);
      expect(new URL(preview.audienceUrl).origin).not.toBe(new URL(targetUrl).origin);
      expect(new URL(preview.audienceUrl).pathname).toBe("/talk/");

      const audience = await fetch(preview.audienceUrl);
      expect(await audience.text()).toContain("Rendered deck");
      expect(audience.headers.get("x-frame-options")).toBeNull();

      const studio = await fetch(new URL("studio", preview.audienceUrl));
      expect(studio.status).toBe(404);
      expect(studioRequests).toBe(0);
    } finally {
      await preview?.close();
    }
  });

  it("pins every request to the validated loopback target", async () => {
    const upstream = createServer((_request, response) => response.end("expected upstream"));
    const other = createServer((_request, response) => response.end("unexpected upstream"));
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    await new Promise<void>((resolve) => other.listen(0, "127.0.0.1", resolve));
    close.push(
      () => closeServer(upstream),
      () => closeServer(other),
    );
    const targetPort = (upstream.address() as AddressInfo).port;
    const otherPort = (other.address() as AddressInfo).port;
    const preview = await startStudioPreviewProxy(`http://127.0.0.1:${String(targetPort)}/talk/`);
    close.push(() => preview.close());

    await expect(
      requestAbsolutePath(
        new URL(preview.audienceUrl),
        `http://127.0.0.1:${String(otherPort)}/attempted-override`,
      ),
    ).resolves.toBe("expected upstream");
    await expect(startStudioPreviewProxy("https://example.com/deck/")).rejects.toThrow(
      "loopback hostname",
    );
  });

  it("survives an upgraded preview connection being reset", async () => {
    const upstream = createServer((_request, response) => response.end("still available"));
    const upgradedSockets = new Set<Duplex>();
    upstream.on("upgrade", (_request, socket) => {
      upgradedSockets.add(socket);
      socket.once("close", () => upgradedSockets.delete(socket));
      socket.on("error", () => socket.destroy());
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: drever-test\r\n\r\n",
      );
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    close.push(async () => {
      for (const socket of upgradedSockets) socket.destroy();
      await closeServer(upstream);
    });
    const targetPort = (upstream.address() as AddressInfo).port;
    const preview = await startStudioPreviewProxy(`http://127.0.0.1:${String(targetPort)}/`);
    close.push(() => preview.close());

    await resetUpgradedConnection(new URL(preview.audienceUrl));
    await new Promise((resolve) => setTimeout(resolve, 25));

    await expect(fetch(preview.audienceUrl).then((response) => response.text())).resolves.toBe(
      "still available",
    );
  });
});
