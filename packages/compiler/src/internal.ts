/** Canonical-adapter-only compiler pipeline. Not an author-facing API. */
export { recmaDreverDeckManifest, remarkDreverDeckManifest } from "./deck-manifest-finalizers.ts";
export { DREVER_DECK_MANIFEST_DATA_KEY } from "./deck-manifest-data.ts";
export { recmaDreverDeckSeal } from "./recma-drever-deck-structure.ts";
export { rehypeDreverDeckManifest } from "./rehype-drever-deck-manifest.ts";
export {
  DREVER_DEV_SOURCE_PATH_ATTRIBUTE,
  DREVER_DEV_SOURCE_RANGE_ATTRIBUTE,
  DREVER_DEV_SOURCE_TAG_ATTRIBUTE,
  remarkDreverDevSelection,
} from "./remark-drever-dev-selection.ts";
export { remarkDreverSlideGrammar } from "./remark-drever-slide-grammar.ts";
