export { DEFAULT_CANVAS } from "./canvas.tsx";
export { DreverClientError, isAbortError } from "./client-error.ts";
export type { DreverClientErrorOptions } from "./client-error.ts";
export { createSpeaker } from "./create-speaker.tsx";
export type { CreateSpeakerOptions, SpeakerHandle } from "./create-speaker.tsx";
export { createViewer } from "./create-viewer.tsx";
export type {
  CreateViewerOptions,
  ViewerDisposer,
  ViewerHandle,
  ViewerRuntime,
  ViewerRuntimeModule,
  ViewerRuntimeMotion,
  ViewerRuntimeTheme,
  ViewerSetupRunner,
} from "./create-viewer.tsx";
export type {
  DeckCommand,
  DeckPosition,
  PresentationTransitionType,
} from "./presentation-state.ts";
export { PRESENTATION_TRANSITION_TYPES } from "./view-transition.ts";
export { Viewer } from "./viewer.tsx";
export type { ViewerProps } from "./viewer.tsx";
