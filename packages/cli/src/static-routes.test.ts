import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createStaticDeckRoutes, writeStaticDeckRoutes } from "./static-routes.ts";

const directories: string[] = [];
const manifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "slide-1", index: 0, speakerNotes: [], stepStops: [2] },
    { id: "slide-2", index: 1, speakerNotes: [], stepStops: [5] },
  ],
} as const satisfies DeckManifest;

const executeStaticRouteBootstrap = (
  html: string,
  pageHref: string,
): Readonly<{ assetURL: string; canonicalURL: string; mountURL: string }> => {
  const script = html.match(/<script data-drever-static-route>([\s\S]*?)<\/script>/u)?.[1];
  if (script === undefined) {
    throw new TypeError("The generated HTML does not contain a static route bootstrap.");
  }
  const bases: Array<{ href?: string }> = [];
  let canonicalURL = pageHref;
  const history = {
    state: null,
    replaceState(_state: unknown, _title: string, url: URL) {
      canonicalURL = url.href;
    },
  };
  const document = {
    createElement(tagName: string) {
      if (tagName !== "base") {
        throw new TypeError(`Unexpected element: ${tagName}`);
      }
      return {};
    },
    head: {
      append(base: { href?: string }) {
        bases.push(base);
      },
    },
  };
  runInNewContext(script, {
    document,
    history,
    location: { href: pageHref },
    URL,
  });
  const mountURL = bases[0]?.href;
  if (mountURL === undefined) {
    throw new TypeError("The static route bootstrap did not install a base URL.");
  }
  return Object.freeze({
    assetURL: new URL("./assets/app.js", mountURL).href,
    canonicalURL,
    mountURL,
  });
};

type FakeChild = { readonly textContent: string };
type FakeElement = {
  readonly attributes: ReadonlyArray<Readonly<{ name: string; value: string }>>;
  readonly childNodes: FakeChild[];
  readonly firstChild: FakeChild | null;
  readonly localName: string;
  replacement?: FakeElement;
  append(child: FakeChild): void;
  getAttribute(name: string): string | null;
  replaceWith(replacement: FakeElement): void;
  setAttribute(name: string, value: string): void;
};

const createFakeElementFactory = () => {
  const parents = new Map<FakeChild, FakeElement>();
  const createElement = (
    localName: string,
    initialAttributes: Readonly<Record<string, string>> = {},
    textChildren: readonly string[] = [],
  ): FakeElement => {
    const values = new Map(Object.entries(initialAttributes));
    const childNodes = textChildren.map((textContent) => ({ textContent }));
    const element: FakeElement = {
      get attributes() {
        return [...values].map(([name, value]) => ({ name, value }));
      },
      childNodes,
      get firstChild() {
        return childNodes[0] ?? null;
      },
      localName,
      append(child) {
        const parent = parents.get(child);
        if (parent !== undefined) {
          const index = parent.childNodes.indexOf(child);
          parent.childNodes.splice(index, 1);
        }
        childNodes.push(child);
        parents.set(child, element);
      },
      getAttribute(name) {
        return values.get(name) ?? null;
      },
      replaceWith(replacement) {
        element.replacement = replacement;
      },
      setAttribute(name, value) {
        values.set(name, value);
      },
    };
    for (const child of childNodes) {
      parents.set(child, element);
    }
    return element;
  };
  return createElement;
};

const executeStaticAssetActivation = (
  html: string,
  baseURI: string,
  placeholders: readonly FakeElement[],
  createElement: ReturnType<typeof createFakeElementFactory>,
): readonly FakeElement[] => {
  const script = html.match(/<script data-drever-static-assets>([\s\S]*?)<\/script>/u)?.[1];
  if (script === undefined) {
    throw new TypeError("The generated HTML does not contain static asset activation.");
  }
  const document = {
    baseURI,
    createElement,
    querySelectorAll() {
      return placeholders;
    },
  };
  runInNewContext(script, { document, URL });
  return placeholders.map((placeholder) => {
    if (placeholder.replacement === undefined) {
      throw new TypeError(`The ${placeholder.localName} placeholder was not activated.`);
    }
    return placeholder.replacement;
  });
};

const attributesOf = (element: FakeElement): Readonly<Record<string, string>> =>
  Object.fromEntries(element.attributes.map(({ name, value }) => [name, value]));

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("static presentation routes", () => {
  it("enumerates every canonical audience and speaker deep link", () => {
    expect(createStaticDeckRoutes(manifest)).toEqual([
      { segments: ["document"], surface: "document" },
      { segments: ["speaker"], surface: "speaker" },
      { segments: ["1", "2"], surface: "audience" },
      { segments: ["speaker", "1", "2"], surface: "speaker" },
      { segments: ["2"], surface: "audience" },
      { segments: ["speaker", "2"], surface: "speaker" },
      { segments: ["2", "5"], surface: "audience" },
      { segments: ["speaker", "2", "5"], surface: "speaker" },
    ]);
  });

  it("writes portable HTML whose assets and mount root survive clean URLs with either slash form", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "drever-static-routes-"));
    directories.push(outDir);
    await mkdir(join(outDir, "assets"));
    await writeFile(
      join(outDir, "index.html"),
      '<meta name="drever-base" content="/" /><script src="./assets/app.js"></script>',
      "utf8",
    );

    await writeStaticDeckRoutes(outDir, manifest);

    const root = await readFile(join(outDir, "index.html"), "utf8");
    const document = await readFile(join(outDir, "document", "index.html"), "utf8");
    const audience = await readFile(join(outDir, "2", "5", "index.html"), "utf8");
    const speaker = await readFile(join(outDir, "speaker", "2", "5", "index.html"), "utf8");

    const cases = [
      { html: root, page: "https://slides.test/", expectedBase: "https://slides.test/" },
      {
        html: root,
        page: "https://slides.test/talk/",
        expectedBase: "https://slides.test/talk/",
      },
      {
        html: root,
        page: "https://slides.test/talk",
        expectedBase: "https://slides.test/talk/",
      },
      {
        html: document,
        page: "https://slides.test/talk/document",
        expectedBase: "https://slides.test/talk/",
      },
      {
        html: audience,
        page: "https://slides.test/2/5",
        expectedBase: "https://slides.test/",
      },
      {
        html: audience,
        page: "https://slides.test/2/5/",
        expectedBase: "https://slides.test/",
      },
      {
        html: audience,
        page: "https://slides.test/talk/2/5",
        expectedBase: "https://slides.test/talk/",
      },
      {
        html: audience,
        page: "https://slides.test/talk/2/5/",
        expectedBase: "https://slides.test/talk/",
      },
      {
        html: speaker,
        page: "https://slides.test/speaker/2/5",
        expectedBase: "https://slides.test/",
      },
      {
        html: speaker,
        page: "https://slides.test/speaker/2/5/",
        expectedBase: "https://slides.test/",
      },
      {
        html: speaker,
        page: "https://slides.test/talk/speaker/2/5",
        expectedBase: "https://slides.test/talk/",
      },
      {
        html: speaker,
        page: "https://slides.test/talk/speaker/2/5/",
        expectedBase: "https://slides.test/talk/",
      },
    ] as const;

    for (const { expectedBase, html, page } of cases) {
      const resolved = executeStaticRouteBootstrap(html, page);
      expect(resolved.mountURL).toBe(expectedBase);
      expect(resolved.assetURL).toBe(new URL("assets/app.js", expectedBase).href);
      expect(resolved.canonicalURL).toBe(
        page.endsWith("/") && page !== expectedBase ? page.slice(0, -1) : page,
      );
    }

    const explicitIndexCases = [
      {
        html: root,
        page: "https://slides.test/index.html?theme=dark#notes",
        expectedBase: "https://slides.test/",
        expectedCanonical: "https://slides.test/?theme=dark#notes",
      },
      {
        html: root,
        page: "https://slides.test/talk/index.html?theme=dark#notes",
        expectedBase: "https://slides.test/talk/",
        expectedCanonical: "https://slides.test/talk/?theme=dark#notes",
      },
      {
        html: audience,
        page: "https://slides.test/2/5/index.html?theme=dark#notes",
        expectedBase: "https://slides.test/",
        expectedCanonical: "https://slides.test/2/5?theme=dark#notes",
      },
      {
        html: audience,
        page: "https://slides.test/talk/2/5/index.html?theme=dark#notes",
        expectedBase: "https://slides.test/talk/",
        expectedCanonical: "https://slides.test/talk/2/5?theme=dark#notes",
      },
    ] as const;

    for (const { expectedBase, expectedCanonical, html, page } of explicitIndexCases) {
      expect(executeStaticRouteBootstrap(html, page)).toEqual({
        assetURL: new URL("assets/app.js", expectedBase).href,
        canonicalURL: expectedCanonical,
        mountURL: expectedBase,
      });
    }

    expect(audience).toContain('<meta name="drever-base" content="./" />');
    expect(audience).toContain('<script data-drever-src="./assets/app.js"></script>');
    expect(speaker).toContain('<script data-drever-src="./assets/app.js"></script>');
    expect(audience).not.toContain('<script src="./assets/app.js"></script>');
  });

  it("activates plugin-injected relative resources while preserving attributes and content", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "drever-static-resources-"));
    directories.push(outDir);
    await writeFile(
      join(outDir, "index.html"),
      [
        "<!doctype html>",
        "<html>",
        "<head>",
        '<meta name="drever-base" content="/" />',
        '<script type="module" integrity="sha384-test" src="./plugin/entry.js">fallback()</script>',
        '<link rel="manifest" href="./deck.webmanifest">',
        '<link rel="preload" as="image" imagesrcset="./cover.avif 1x, ./cover@2x.avif 2x">',
        '<video class="intro" poster="./poster.webp"></video>',
        "</head>",
        "<body>",
        '<img alt="Cover" srcset="./cover.webp 1x, ./cover@2x.webp 2x">',
        '<a href="./speaker">Open speaker view</a>',
        "</body>",
        "</html>",
      ].join(""),
      "utf8",
    );

    await writeStaticDeckRoutes(outDir, manifest);
    const html = await readFile(join(outDir, "2", "5", "index.html"), "utf8");

    expect(html).toContain('data-drever-src="./plugin/entry.js"');
    expect(html).toContain('data-drever-href="./deck.webmanifest"');
    expect(html).toContain('data-drever-imagesrcset="./cover.avif 1x, ./cover@2x.avif 2x"');
    expect(html).toContain('data-drever-poster="./poster.webp"');
    expect(html).toContain('data-drever-srcset="./cover.webp 1x, ./cover@2x.webp 2x"');
    expect(html).toContain('<a href="./speaker">Open speaker view</a>');

    const createElement = createFakeElementFactory();
    const placeholders = [
      createElement(
        "script",
        {
          "data-drever-src": "./plugin/entry.js",
          integrity: "sha384-test",
          type: "module",
        },
        ["fallback()"],
      ),
      createElement("link", {
        "data-drever-href": "./deck.webmanifest",
        rel: "manifest",
      }),
      createElement("link", {
        as: "image",
        "data-drever-imagesrcset": "./cover.avif 1x, ./cover@2x.avif 2x",
        rel: "preload",
      }),
      createElement("video", {
        class: "intro",
        "data-drever-poster": "./poster.webp",
      }),
      createElement("img", {
        alt: "Cover",
        "data-drever-srcset": "./cover.webp 1x, ./cover@2x.webp 2x",
      }),
    ];
    const [script, manifestLink, preload, video, image] = executeStaticAssetActivation(
      html,
      "https://slides.test/talk/",
      placeholders,
      createElement,
    );

    expect(attributesOf(script!)).toEqual({
      integrity: "sha384-test",
      src: "https://slides.test/talk/plugin/entry.js",
      type: "module",
    });
    expect(script!.childNodes.map(({ textContent }) => textContent)).toEqual(["fallback()"]);
    expect(attributesOf(manifestLink!)).toEqual({
      href: "https://slides.test/talk/deck.webmanifest",
      rel: "manifest",
    });
    expect(attributesOf(preload!)).toEqual({
      as: "image",
      imagesrcset:
        "https://slides.test/talk/cover.avif 1x, https://slides.test/talk/cover@2x.avif 2x",
      rel: "preload",
    });
    expect(attributesOf(video!)).toEqual({
      class: "intro",
      poster: "https://slides.test/talk/poster.webp",
    });
    expect(attributesOf(image!)).toEqual({
      alt: "Cover",
      srcset: "https://slides.test/talk/cover.webp 1x, https://slides.test/talk/cover@2x.webp 2x",
    });
  });
});
