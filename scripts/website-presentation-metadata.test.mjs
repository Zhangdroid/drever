import assert from "node:assert/strict";
import test from "node:test";
import { isPublicPresentationSlug, labPresentationMounts } from "../website/site-manifest.ts";
import { applyWebsitePresentationMetadata } from "./website-presentation-metadata.mjs";

const input = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="data:image/svg+xml,old" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Authored title" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="Authored title" />
    <meta name="description" content="Authored description" />
    <title>Authored title</title>
  </head>
  <body></body>
</html>`;

const metadata = {
  canonical: "https://drever.dev/showcase/example",
  description: 'One clear story about "change" & evidence.',
  indexable: true,
  socialImageAlt: "Drever example",
  socialImageURL: "https://drever.dev/social-card.png",
  title: "Example — Drever",
};

test("replaces generated deck metadata with one canonical website set", () => {
  const output = applyWebsitePresentationMetadata(input, metadata);

  assert.match(output, /<meta charset="UTF-8" \/>/u);
  assert.match(output, /<title>Example — Drever<\/title>/u);
  assert.match(output, /content="One clear story about &quot;change&quot; &amp; evidence\."/u);
  assert.match(output, /rel="canonical" href="https:\/\/drever\.dev\/showcase\/example"/u);
  assert.match(output, /name="twitter:card" content="summary_large_image"/u);
  assert.equal(output.match(/name="description"/gu)?.length, 1);
  assert.equal(output.match(/property="og:title"/gu)?.length, 1);
  assert.equal(output.match(/name="twitter:title"/gu)?.length, 1);
  assert.doesNotMatch(output, /data:image\/svg\+xml,old/u);
  assert.doesNotMatch(output, /name="robots"/u);
});

test("marks secondary presentation surfaces non-indexable and stays idempotent", () => {
  const once = applyWebsitePresentationMetadata(input, { ...metadata, indexable: false });
  const twice = applyWebsitePresentationMetadata(once, { ...metadata, indexable: false });

  assert.equal(twice, once);
  assert.equal(twice.match(/name="robots" content="noindex, follow"/gu)?.length, 1);
});

test("marks experimental presentation roots non-indexable", () => {
  const presentation = labPresentationMounts[0];
  const output = applyWebsitePresentationMetadata(input, {
    ...metadata,
    canonical: `https://drever.dev/showcase/${presentation.slug}/`,
    indexable: isPublicPresentationSlug(presentation.slug),
  });

  assert.equal(isPublicPresentationSlug(presentation.slug), false);
  assert.match(output, /name="robots" content="noindex, follow"/u);
});

test("rejects output without a document head", () => {
  assert.throws(
    () => applyWebsitePresentationMetadata("<main>Deck</main>", metadata),
    /does not contain a head element/u,
  );
});
