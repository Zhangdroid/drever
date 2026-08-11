import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vite-plus/test";

import {
  builtPresentationMounts,
  canonicalSiteURL,
  labPresentationMounts,
  publicPresentationMounts,
  publicSiteRoutes,
  standalonePresentationMounts,
} from "../site-manifest";
import { pageHead } from "./seo";

const sitemap = await readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8");
const llms = await readFile(new URL("../public/llms.txt", import.meta.url), "utf8");

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
    const head = pageHead("Drever", "AI-first presentation workspace.", "/");

    expect(head.meta).toEqual(
      expect.arrayContaining([
        { title: "Drever — Your agent drafts. You direct." },
        {
          property: "og:image:alt",
          content:
            "Drever is an AI-first presentation workspace where your agent drafts and you direct.",
        },
        {
          name: "twitter:image:alt",
          content:
            "Drever is an AI-first presentation workspace where your agent drafts and you direct.",
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

  it("builds experimental labs without publishing or advertising them", () => {
    const labSlugs = labPresentationMounts.map(({ slug }) => slug);
    const publicSlugs = new Set<string>(publicPresentationMounts.map(({ slug }) => slug));
    const standaloneSlugs = new Set<string>(standalonePresentationMounts.map(({ slug }) => slug));
    const builtSlugs = new Set<string>(builtPresentationMounts.map(({ slug }) => slug));

    expect(labSlugs).toEqual(["labs/seasons", "labs/bus-priority", "labs/airport-wayfinding"]);
    expect(labSlugs.every((slug) => !publicSlugs.has(slug))).toBe(true);
    expect(labSlugs.every((slug) => standaloneSlugs.has(slug))).toBe(true);
    expect(labSlugs.every((slug) => builtSlugs.has(slug))).toBe(true);

    for (const slug of labSlugs) {
      const url = canonicalSiteURL(`/showcase/${slug}`);
      expect(sitemap).not.toContain(url);
      expect(llms).not.toContain(url);
    }
  });
});
