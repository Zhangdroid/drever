import { describe, expect, it } from "vite-plus/test";

import { canonicalSiteURL } from "../site-manifest";
import { pageHead } from "./seo";

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
});
