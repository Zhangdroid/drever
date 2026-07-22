import { readFileSync } from "node:fs";

const readPackageVersion = (url: URL): string => {
  const value = JSON.parse(readFileSync(url, "utf8")) as { version?: unknown };
  if (typeof value.version !== "string" || value.version.length === 0) {
    throw new TypeError("The Drever package does not declare a valid version.");
  }
  return value.version;
};

/** The version of the installed `drever` package. */
export const DREVER_VERSION = readPackageVersion(new URL("../package.json", import.meta.url));
