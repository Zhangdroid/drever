import type { SpeakerNote } from "@drever/schema";

export const DREVER_DECK_MANIFEST_DATA_KEY = "dreverDeckManifest";
export const DREVER_REHYPE_SNAPSHOT_DATA_KEY = "dreverRehypeSnapshot";
export const DREVER_RECMA_SNAPSHOT_DATA_KEY = "dreverRecmaSnapshot";
export const DREVER_SPEAKER_NOTES_DATA_KEY = "dreverSpeakerNotes";

export type DreverSpeakerNotesSnapshot = Readonly<{
  slides: readonly (readonly SpeakerNote[])[];
}>;

export type DreverRehypeSnapshot = Readonly<{
  slides: readonly Readonly<{
    id: string;
    index: number;
    stepIndices: readonly number[];
  }>[];
}>;
