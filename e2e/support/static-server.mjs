import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const [rootArgument, portArgument, mountArgument] = process.argv.slice(2);
if (rootArgument === undefined || portArgument === undefined) {
  throw new Error("Usage: node static-server.mjs <root> <port> [mount-path]");
}

const root = await realpath(rootArgument);
const port = Number(portArgument);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid port: ${portArgument}`);
}
const mountPath = mountArgument?.replace(/\/+$/u, "");
if (mountPath !== undefined && (!mountPath.startsWith("/") || mountPath.length === 0)) {
  throw new Error(`Invalid mount path: ${mountArgument}`);
}

const contentTypes = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
});

const existsAsFile = async (path) => {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

const resolveRequest = async (pathname) => {
  const decoded = decodeURIComponent(pathname);
  const relative =
    mountPath === decoded
      ? "/"
      : mountPath !== undefined && decoded.startsWith(`${mountPath}/`)
        ? decoded.slice(mountPath.length)
        : decoded;
  const candidate = resolve(root, `.${relative}`);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    return;
  }
  if (await existsAsFile(candidate)) {
    return candidate;
  }
  const index = resolve(candidate, "index.html");
  return (await existsAsFile(index)) ? index : undefined;
};

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    const path = await resolveRequest(pathname);
    if (path === undefined) {
      response.writeHead(404).end("Not found");
      return;
    }
    const body = await readFile(path);
    const contentType = contentTypes[extname(path)] ?? "application/octet-stream";
    response.writeHead(200, { "content-length": body.length, "content-type": contentType });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    const status = error instanceof URIError ? 400 : 500;
    response.writeHead(status).end(status === 400 ? "Bad request" : "Internal server error");
  }
});

server.listen(port, "127.0.0.1");
process.once("SIGTERM", () => server.close());
