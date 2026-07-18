import type { DeckManifest } from "@drever/schema";
import type { Root } from "mdast";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified, type Pluggable, type Plugin } from "unified";
import {
  DREVER_DECK_MANIFEST_DATA_KEY,
  remarkDreverDeckManifest,
} from "./deck-manifest-finalizers.ts";
import { remarkDreverSlideGrammar } from "./remark-drever-slide-grammar.ts";

export type CompileDeckManifestOptions = Readonly<{
  path?: string;
  remarkPlugins?: readonly Pluggable[];
}>;

/** Compiles the protected post-remark navigation and speaker-note contract for one deck. */
export const compileDeckManifest = async (
  source: string,
  options: CompileDeckManifestOptions = {},
): Promise<DeckManifest> => {
  let manifest: DeckManifest | undefined;
  const capture: Plugin<[], Root> = () => (_tree, file) => {
    manifest = file.data[DREVER_DECK_MANIFEST_DATA_KEY] as DeckManifest | undefined;
  };
  const processor = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkDreverSlideGrammar)
    .use([...(options.remarkPlugins ?? [])])
    .use(remarkDreverDeckManifest)
    .use(capture);

  await processor.run(processor.parse(source), {
    path: options.path ?? "slides.mdx",
    value: source,
  });
  if (manifest === undefined) {
    throw new Error("The Drever compiler did not produce a DeckManifest.");
  }
  return manifest;
};
