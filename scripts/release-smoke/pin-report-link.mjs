import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [bodyArgument, deckOriginArgument, reportOriginArgument] = process.argv.slice(2);
if (
  bodyArgument === undefined ||
  deckOriginArgument === undefined ||
  reportOriginArgument === undefined
) {
  throw new Error(
    "Usage: node scripts/release-smoke/pin-report-link.mjs <summary> <deck-origin> <report-origin>",
  );
}

const immutablePagesOrigin = (value) => {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !/^[0-9a-f]{8}\.drever-release-smoke\.pages\.dev$/u.test(url.hostname) ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error(`Invalid immutable Cloudflare Pages origin: ${value}`);
  }
  return url.origin;
};

const bodyPath = resolve(bodyArgument);
const deckOrigin = immutablePagesOrigin(deckOriginArgument);
const reportOrigin = immutablePagesOrigin(reportOriginArgument);
const previousLink = `[Conversation and verification report](${deckOrigin}/release-smoke/)`;
const pinnedLink = `[Conversation and verification report](${reportOrigin}/release-smoke/)`;
const source = await readFile(bodyPath, "utf8");
if (!source.includes(previousLink)) {
  throw new Error("Summary does not contain the expected release smoke report link.");
}
await writeFile(bodyPath, source.replace(previousLink, pinnedLink), "utf8");
