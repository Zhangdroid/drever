const HEAD = /<head>(?<content>[\s\S]*?)<\/head>/u;
const CONTROLLED_HEAD_ELEMENTS = [
  /<title>[\s\S]*?<\/title>/gu,
  /<link\b(?=[^>]*\brel="(?:canonical|icon)")[^>]*>/gu,
  /<meta\b(?=[^>]*\bname="(?:description|robots|twitter:[^"]+)")[^>]*>/gu,
  /<meta\b(?=[^>]*\bproperty="og:[^"]+")[^>]*>/gu,
];

const escapeHTML = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

export const applyWebsitePresentationMetadata = (
  html,
  { canonical, description, indexable, socialImageAlt, socialImageURL, title },
) => {
  const head = HEAD.exec(html);
  if (head?.groups === undefined || head.index === undefined) {
    throw new TypeError("Presentation output does not contain a head element.");
  }

  const retained = CONTROLLED_HEAD_ELEMENTS.reduce(
    (content, pattern) => content.replace(pattern, ""),
    head.groups.content,
  ).trimEnd();
  const metadata = [
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
    `<meta name="description" content="${escapeHTML(description)}" />`,
    ...(indexable ? [] : ['<meta name="robots" content="noindex, follow" />']),
    `<link rel="canonical" href="${escapeHTML(canonical)}" />`,
    `<meta property="og:title" content="${escapeHTML(title)}" />`,
    `<meta property="og:description" content="${escapeHTML(description)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:url" content="${escapeHTML(canonical)}" />`,
    '<meta property="og:site_name" content="Drever" />',
    `<meta property="og:image" content="${escapeHTML(socialImageURL)}" />`,
    '<meta property="og:image:type" content="image/png" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${escapeHTML(socialImageAlt)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHTML(title)}" />`,
    `<meta name="twitter:description" content="${escapeHTML(description)}" />`,
    `<meta name="twitter:image" content="${escapeHTML(socialImageURL)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHTML(socialImageAlt)}" />`,
    `<title>${escapeHTML(title)}</title>`,
  ];
  const replacement = `<head>${retained}\n    ${metadata.join("\n    ")}\n  </head>`;

  return `${html.slice(0, head.index)}${replacement}${html.slice(head.index + head[0].length)}`;
};
