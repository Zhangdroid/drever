import { canonicalSiteURL, siteOrigin } from "../site-manifest";

export function pageHead(title: string, description: string, path: string) {
  const canonical = canonicalSiteURL(path);
  const fullTitle =
    title === "Drever" ? "Drever — Slides that move with your ideas" : `${title} — Drever`;
  const socialImage = new URL("/social-card.png", siteOrigin).href;
  const socialImageAlt =
    "Drever turns an AI-directed presentation into a live story, document, and PDF.";

  return {
    links: [{ rel: "canonical", href: canonical }],
    meta: [
      { title: fullTitle },
      { name: "description", content: description },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonical },
      { property: "og:image", content: socialImage },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: socialImageAlt },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: fullTitle },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: socialImage },
      { name: "twitter:image:alt", content: socialImageAlt },
    ],
  };
}
