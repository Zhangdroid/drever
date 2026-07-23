const siteURL = "https://drever.dev";

export function pageHead(title: string, description: string, path: string) {
  const canonical = new URL(path, siteURL).href;
  const fullTitle = title === "Drever" ? title : `${title} — Drever`;

  return {
    links: [{ rel: "canonical", href: canonical }],
    meta: [
      { title: fullTitle },
      { name: "description", content: description },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonical },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: fullTitle },
      { name: "twitter:description", content: description },
    ],
  };
}
