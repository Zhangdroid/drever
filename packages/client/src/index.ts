export { DEFAULT_CANVAS } from "./canvas.tsx";
export { DreverClientError, isAbortError } from "./client-error.ts";
export type { DreverClientErrorOptions } from "./client-error.ts";
export { createDocument } from "./create-document.tsx";
export type { CreateDocumentOptions, DocumentHandle } from "./create-document.tsx";
export { createExport } from "./create-export.tsx";
export type {
  CreateExportOptions,
  ExportHandle,
  ExportRuntime,
  ExportSetupRunner,
} from "./create-export.tsx";
export { createSpeaker } from "./create-speaker.tsx";
export type {
  CreateSpeakerOptions,
  SpeakerHandle,
  SpeakerRehearsalOptions,
} from "./create-speaker.tsx";
export { createViewer } from "./create-viewer.tsx";
export type {
  CreateViewerOptions,
  ViewerDisposer,
  ViewerHandle,
  ViewerRuntime,
  ViewerRuntimeModule,
  ViewerRuntimeTheme,
  ViewerSetupRunner,
} from "./create-viewer.tsx";
export { ExportDocument } from "./export-document.tsx";
export type { ExportDocumentProps } from "./export-document.tsx";
export { planExportPages } from "./export-pages.ts";
export type { ExportPage, ExportPagePlanOptions } from "./export-pages.ts";
export { DeckDocument } from "./document-view.tsx";
export type { DeckDocumentProps } from "./document-view.tsx";
export type {
  DeckCommand,
  DeckPosition,
  PresentationTransitionType,
} from "./presentation-state.ts";
export { PRESENTATION_TRANSITION_TYPES } from "./view-transition.ts";
export { Viewer } from "./viewer.tsx";
export type { ViewerProps } from "./viewer.tsx";
