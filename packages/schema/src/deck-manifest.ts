export const DECK_MANIFEST_VERSION = 2 as const;

/**
 * Author-authored speaker content captured before MDX runtime compilation.
 *
 * Keeping Markdown as source text makes the contract serializable and lets a
 * speaker surface choose its own rendering policy without shipping React nodes
 * or compiler-specific syntax trees in the manifest.
 */
export type SpeakerNote = Readonly<{
  format: "markdown";
  plainText: string;
  value: string;
}>;

export type SlideManifest = Readonly<{
  id: string;
  index: number;
  speakerNotes: readonly SpeakerNote[];
  stepStops: readonly number[];
  /** Static readable title inferred from authored Markdown or a semantic layout prop. */
  title?: string;
}>;

export type DeckManifest = Readonly<{
  version: typeof DECK_MANIFEST_VERSION;
  slides: readonly SlideManifest[];
}>;
