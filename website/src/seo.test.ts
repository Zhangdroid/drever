import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vite-plus/test";

import { canonicalSiteURL, publicPresentationMounts, publicSiteRoutes } from "../site-manifest";
import { pageHead } from "./seo";

const sitemap = await readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8");

describe("website metadata", () => {
  it("uses the final trailing-slash URL for canonical pages", () => {
    expect(canonicalSiteURL("/docs/motion")).toBe("https://drever.dev/docs/motion/");
    expect(canonicalSiteURL("/")).toBe("https://drever.dev/");
  });

  it("publishes a complete large social card", () => {
    const head = pageHead("Motion", "Meaningful motion for presentations.", "/docs/motion");

    expect(head.links).toContainEqual({
      rel: "canonical",
      href: "https://drever.dev/docs/motion/",
    });
    expect(head.meta).toEqual(
      expect.arrayContaining([
        { property: "og:image", content: "https://drever.dev/social-card.png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: "https://drever.dev/social-card.png" },
      ]),
    );
  });

  it("keeps the public title and social description aligned with the Studio positioning", () => {
    const head = pageHead("Drever", "Local presentation studio.", "/");

    expect(head.meta).toEqual(
      expect.arrayContaining([
        { title: "Drever — Your agent drafts. You direct." },
        {
          property: "og:image:alt",
          content: "Drever is a local presentation studio where your agent drafts and you direct.",
        },
        {
          name: "twitter:image:alt",
          content: "Drever is a local presentation studio where your agent drafts and you direct.",
        },
      ]),
    );
  });

  it("keeps the sitemap aligned with every public route", () => {
    const actualLocations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
    const expectedLocations = [
      ...publicSiteRoutes.map(canonicalSiteURL),
      ...publicPresentationMounts.map(({ slug }) => canonicalSiteURL(`/showcase/${slug}`)),
    ];

    expect(new Set(actualLocations)).toEqual(new Set(expectedLocations));
  });
});
