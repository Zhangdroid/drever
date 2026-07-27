import type { DeckManifest } from "@drever/schema";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DreverDeckConfig } from "./config.ts";
import { DreverCliError } from "./errors.ts";
import { escapeHtml } from "./html.ts";

const BASE_MARKER = '<meta name="drever-base" content="/" />';
const ROOT_RELATIVE_DOCUMENT_ICON = /(<link rel="icon" href=")\/([^"]+)(" \/>)/u;
const TITLE_ELEMENT = /<title>[\s\S]*?<\/title>/u;
const TITLE_META = /(<meta (?:name="twitter:title"|property="og:title") content=")[^"]*("[^>]*>)/gu;

const resolveDocumentTitle = (manifest: DeckManifest, deck?: DreverDeckConfig): string =>
  deck?.title ?? manifest.slides[0]?.title ?? "Drever";

const applyDocumentTitle = (source: string, title: string): string => {
  const escaped = escapeHtml(title);
  return source
    .replace(TITLE_ELEMENT, () => `<title>${escaped}</title>`)
    .replace(
      TITLE_META,
      (_match, prefix: string, suffix: string) => `${prefix}${escaped}${suffix}`,
    );
};

export type StaticDeckRoute = Readonly<{
  segments: readonly string[];
  surface: "audience" | "document" | "speaker";
}>;

export const createStaticDeckRoutes = (manifest: DeckManifest): readonly StaticDeckRoute[] => {
  const routes: StaticDeckRoute[] = [
    { segments: ["document"], surface: "document" },
    { segments: ["speaker"], surface: "speaker" },
  ];
  for (const slide of manifest.slides) {
    const slideNumber = String(slide.index + 1);
    if (slide.index > 0) {
      routes.push({ segments: [slideNumber], surface: "audience" });
      routes.push({ segments: ["speaker", slideNumber], surface: "speaker" });
    }
    for (const step of slide.stepStops) {
      const stepNumber = String(step);
      routes.push({ segments: [slideNumber, stepNumber], surface: "audience" });
      routes.push({
        segments: ["speaker", slideNumber, stepNumber],
        surface: "speaker",
      });
    }
  }
  return Object.freeze(
    routes.map((route) =>
      Object.freeze({ ...route, segments: Object.freeze([...route.segments]) }),
    ),
  );
};

const renderStaticRouteBootstrap = (depth: number): string => `
    <script data-drever-static-route>
      (() => {
        const routeDepth = ${depth};
        const pageURL = new URL(location.href);
        const hasIndexDocument = pageURL.pathname.endsWith("/index.html");
        const routePathname = hasIndexDocument
          ? pageURL.pathname.slice(0, -"index.html".length)
          : pageURL.pathname;
        const segments = routePathname.split("/").filter((segment) => segment.length > 0);
        if (routeDepth > segments.length) {
          throw new Error("Drever could not resolve the static presentation root.");
        }
        const mountSegments = segments.slice(0, segments.length - routeDepth);
        const mountURL = new URL("/", pageURL);
        mountURL.pathname = "/" + (mountSegments.length === 0 ? "" : mountSegments.join("/") + "/");
        const base = document.createElement("base");
        base.href = mountURL.href;
        document.head.append(base);
        const canonicalPathname = routeDepth > 0 && routePathname.endsWith("/")
          ? routePathname.slice(0, -1)
          : routePathname;
        if (pageURL.pathname !== canonicalPathname) {
          pageURL.pathname = canonicalPathname;
          history.replaceState(history.state, "", pageURL);
        }
      })();
    </script>`;

const DEFERRED_RESOURCE_ATTRIBUTES = ["src", "href", "poster", "srcset", "imagesrcset"] as const;

const STATIC_ASSET_ACTIVATION = `
    <script data-drever-static-assets>
      (() => {
        const deferredAttributes = ${JSON.stringify(DEFERRED_RESOURCE_ATTRIBUTES)};
        const resolveSourceSet = (value) => value
          .split(",")
          .map((candidate) => {
            const normalized = candidate.trim();
            const descriptorOffset = normalized.search(/\\s/u);
            const reference = descriptorOffset < 0
              ? normalized
              : normalized.slice(0, descriptorOffset);
            const descriptor = descriptorOffset < 0
              ? ""
              : normalized.slice(descriptorOffset).trim();
            const resolved = new URL(reference, document.baseURI).href;
            return descriptor.length === 0 ? resolved : resolved + " " + descriptor;
          })
          .join(", ");
        const selector = deferredAttributes.map((attribute) => "[data-drever-" + attribute + "]").join(", ");
        for (const placeholder of document.querySelectorAll(selector)) {
          const resource = document.createElement(placeholder.localName);
          for (const attribute of placeholder.attributes) {
            if (!attribute.name.startsWith("data-drever-") || !deferredAttributes.includes(attribute.name.slice(12))) {
              resource.setAttribute(attribute.name, attribute.value);
            }
          }
          while (placeholder.firstChild !== null) {
            resource.append(placeholder.firstChild);
          }
          for (const attribute of deferredAttributes) {
            const reference = placeholder.getAttribute("data-drever-" + attribute);
            if (reference !== null) {
              const resolved = attribute === "srcset" || attribute === "imagesrcset"
                ? resolveSourceSet(reference)
                : new URL(reference, document.baseURI).href;
              resource.setAttribute(attribute, resolved);
            }
          }
          placeholder.replaceWith(resource);
        }
      })();
    </script>`;

const RESOURCE_ATTRIBUTES = Object.freeze({
  audio: new Set(["src"]),
  embed: new Set(["src"]),
  iframe: new Set(["src"]),
  img: new Set(["src", "srcset"]),
  input: new Set(["src"]),
  link: new Set(["href", "imagesrcset"]),
  script: new Set(["src"]),
  source: new Set(["src", "srcset"]),
  track: new Set(["src"]),
  video: new Set(["poster", "src"]),
});

const RESOURCE_ELEMENT = new RegExp(
  `<(${Object.keys(RESOURCE_ATTRIBUTES).join("|")})\\b[^>]*>`,
  "giu",
);
const RELATIVE_RESOURCE_ATTRIBUTE =
  /(\s)(srcset|imagesrcset|poster|src|href)(\s*=\s*)(['"])(\.\/[^'"]*)\4/giu;

const deferStaticAssetRequests = (source: string): string =>
  source.replace(RESOURCE_ELEMENT, (element, rawName: string) => {
    const attributes =
      RESOURCE_ATTRIBUTES[rawName.toLowerCase() as keyof typeof RESOURCE_ATTRIBUTES];
    return element.replace(
      RELATIVE_RESOURCE_ATTRIBUTE,
      (
        original: string,
        whitespace: string,
        rawAttribute: string,
        assignment: string,
        quote: string,
        reference: string,
      ) => {
        const attribute = rawAttribute.toLowerCase();
        return attributes.has(attribute)
          ? `${whitespace}data-drever-${attribute}${assignment}${quote}${reference}${quote}`
          : original;
      },
    );
  });

const renderRouteHtml = (source: string, depth: number): string => {
  if (!source.includes(BASE_MARKER)) {
    throw new DreverCliError(
      "DREVER_BUILD_BASE_MARKER_MISSING",
      "The generated application is missing its Drever base marker.",
      { hint: "Rebuild with matching versions of drever and @drever/client." },
    );
  }
  const portableSource = source.replace(
    ROOT_RELATIVE_DOCUMENT_ICON,
    (_match, prefix: string, reference: string, suffix: string) =>
      `${prefix}./${reference}${suffix}`,
  );
  const withBootstrap = deferStaticAssetRequests(portableSource).replace(
    BASE_MARKER,
    `<meta name="drever-base" content="./" />${renderStaticRouteBootstrap(depth)}`,
  );
  return withBootstrap
    .replace("</head>", `${STATIC_ASSET_ACTIVATION}\n  </head>`)
    .replace("</body>", `${STATIC_ASSET_ACTIVATION}\n  </body>`);
};

export const writeStaticDeckRoutes = async (
  outDir: string,
  manifest: DeckManifest,
  deck?: DreverDeckConfig,
): Promise<void> => {
  const indexPath = join(outDir, "index.html");
  const source = applyDocumentTitle(
    await readFile(indexPath, "utf8"),
    resolveDocumentTitle(manifest, deck),
  );
  const routes = createStaticDeckRoutes(manifest);
  await writeFile(indexPath, renderRouteHtml(source, 0), "utf8");
  await Promise.all(
    routes.map(async ({ segments }) => {
      const directory = join(outDir, ...segments);
      await mkdir(directory, { recursive: true });
      await writeFile(
        join(directory, "index.html"),
        renderRouteHtml(source, segments.length),
        "utf8",
      );
    }),
  );
};
