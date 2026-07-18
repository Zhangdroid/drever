import type {
  DeckCommand,
  DeckPosition,
  PresentationChange,
  PresentationStateMachine,
  PresentationStore,
  PresentationTransitionType,
} from "./presentation-state.ts";
import { DreverClientError } from "./client-error.ts";
import {
  createPresentationRouteCodec,
  type PresentationRouteSurface,
} from "./presentation-route.ts";
import { PRESENTATION_TRANSITION_TYPES } from "./view-transition.ts";

export type NavigationHistoryEntryLike = Readonly<{
  index: number;
  url: string | null;
  getState(): unknown;
}>;

export type NavigationDestinationLike = Readonly<{
  index: number;
  url: string;
  getState(): unknown;
}>;

export type NavigationResultLike = Readonly<{
  committed: Promise<NavigationHistoryEntryLike>;
  finished: Promise<NavigationHistoryEntryLike>;
}>;

export type NavigateEventLike = Readonly<{
  canIntercept: boolean;
  cancelable: boolean;
  destination: NavigationDestinationLike;
  downloadRequest: string | null;
  formData: FormData | null;
  hashChange: boolean;
  info: unknown;
  navigationType: "push" | "reload" | "replace" | "traverse";
  signal: AbortSignal;
  intercept(
    options: Readonly<{
      focusReset: "manual";
      handler(): Promise<void>;
      scroll: "manual";
    }>,
  ): void;
  preventDefault(): void;
}>;

export type NavigationLike = Readonly<{
  currentEntry: NavigationHistoryEntryLike | null;
  addEventListener(type: "navigate", listener: (event: NavigateEventLike) => void): void;
  navigate(
    url: string,
    options: Readonly<{ history: "push"; info: unknown; state: unknown }>,
  ): NavigationResultLike;
  removeEventListener(type: "navigate", listener: (event: NavigateEventLike) => void): void;
  updateCurrentEntry(options: Readonly<{ state: unknown }>): void;
}>;

export type PresentationCommit = (change: PresentationChange, signal: AbortSignal) => Promise<void>;

export type PresentationNavigation = Readonly<{
  dispose(): void;
  initialPosition: DeckPosition;
  navigate(command: DeckCommand, intent?: PresentationNavigationIntent): Promise<void>;
}>;

/** A validated transition semantic supplied by an in-process navigation source. */
export type PresentationNavigationIntent = Readonly<{
  transitionType: PresentationTransitionType;
}>;

export type CreatePresentationNavigationOptions = Readonly<{
  baseURL: URL;
  commit: PresentationCommit;
  machine: PresentationStateMachine;
  navigation: NavigationLike;
  onError(error: unknown): void;
  store: PresentationStore;
  surface?: PresentationRouteSurface;
}>;

const INFO_MARKER = "drever-navigation-v1";
const STATE_MARKER = "drever-position-v1";

const TRANSITION_TYPES: ReadonlySet<PresentationTransitionType> = new Set(
  PRESENTATION_TRANSITION_TYPES,
);

type NavigationInfo = Readonly<{
  drever: typeof INFO_MARKER;
  transitionType: PresentationTransitionType;
}>;

const navigationInfo = (transitionType: PresentationTransitionType): NavigationInfo =>
  Object.freeze({ drever: INFO_MARKER, transitionType });

const cachedState = (position: DeckPosition): unknown =>
  Object.freeze({
    drever: STATE_MARKER,
    slideId: position.slideId,
    step: position.step,
  });

const readTransitionType = (value: unknown): PresentationTransitionType | undefined => {
  if (typeof value !== "object" || value === null) {
    return;
  }
  const info = value as Partial<NavigationInfo>;
  return info.drever === INFO_MARKER &&
    typeof info.transitionType === "string" &&
    TRANSITION_TYPES.has(info.transitionType as PresentationTransitionType)
    ? info.transitionType
    : undefined;
};

const directionOf = (type: PresentationTransitionType): "backward" | "forward" =>
  type.endsWith("-backward") ? "backward" : "forward";

const withTransitionType = (
  change: PresentationChange,
  transitionType: PresentationTransitionType,
): PresentationChange =>
  change.transitionType === transitionType ? change : Object.freeze({ ...change, transitionType });

const isCompatibleTransitionType = (
  change: PresentationChange,
  transitionType: PresentationTransitionType,
): boolean =>
  directionOf(change.transitionType) === directionOf(transitionType) &&
  (change.from.slideIndex === change.to.slideIndex
    ? transitionType.startsWith("drever-step-")
    : !transitionType.startsWith("drever-step-"));

const validateIntent = (
  intent: PresentationNavigationIntent | undefined,
): PresentationTransitionType | undefined => {
  if (intent === undefined) {
    return;
  }
  if (
    typeof intent !== "object" ||
    intent === null ||
    typeof intent.transitionType !== "string" ||
    !TRANSITION_TYPES.has(intent.transitionType as PresentationTransitionType)
  ) {
    throw new DreverClientError(
      "DREVER_CLIENT_TRANSITION_INVALID",
      "Presentation navigation received an invalid transition intent.",
      {
        details: {
          transitionType:
            typeof intent === "object" && intent !== null && "transitionType" in intent
              ? String(intent.transitionType)
              : "missing",
        },
      },
    );
  }
  return intent.transitionType;
};

export const createPresentationNavigation = ({
  baseURL,
  commit,
  machine,
  navigation,
  onError,
  store,
  surface = "audience",
}: CreatePresentationNavigationOptions): PresentationNavigation => {
  const route = createPresentationRouteCodec({ baseURL, machine, surface });
  const initialURL = new URL(navigation.currentEntry?.url ?? baseURL.href);
  const initialPosition = route.decodeURL(initialURL);
  store.commit(initialPosition);
  navigation.updateCurrentEntry({ state: cachedState(initialPosition) });

  const listener = (event: NavigateEventLike): void => {
    if (
      !event.canIntercept ||
      event.downloadRequest !== null ||
      event.formData !== null ||
      event.hashChange ||
      event.navigationType === "reload"
    ) {
      return;
    }
    const destinationURL = new URL(event.destination.url);
    if (!route.ownsURL(destinationURL)) {
      return;
    }

    let target: DeckPosition;
    try {
      target = route.decodeURL(destinationURL);
    } catch (error) {
      if (event.cancelable) {
        event.preventDefault();
      }
      onError(error);
      return;
    }

    const from = store.getSnapshot();
    const infoType = readTransitionType(event.info);
    const historyDirection =
      event.navigationType === "traverse" &&
      navigation.currentEntry !== null &&
      event.destination.index >= 0 &&
      navigation.currentEntry.index >= 0 &&
      event.destination.index !== navigation.currentEntry.index
        ? event.destination.index < navigation.currentEntry.index
          ? "backward"
          : "forward"
        : undefined;
    const inferredChange = machine.change(
      from,
      target,
      historyDirection === undefined ? {} : { direction: historyDirection },
    );
    const change =
      inferredChange === undefined ||
      infoType === undefined ||
      !isCompatibleTransitionType(inferredChange, infoType)
        ? inferredChange
        : withTransitionType(inferredChange, infoType);

    event.intercept({
      focusReset: "manual",
      scroll: "manual",
      handler: async () => {
        if (change !== undefined) {
          await commit(change, event.signal);
        }
      },
    });
  };

  navigation.addEventListener("navigate", listener);

  return Object.freeze({
    initialPosition,
    async navigate(command, intent) {
      const currentURL = navigation.currentEntry?.url;
      const routeBase =
        currentURL === null || currentURL === undefined ? baseURL : new URL(currentURL);
      const position = route.ownsURL(routeBase) ? route.decodeURL(routeBase) : store.getSnapshot();
      const requestedTransitionType = validateIntent(intent);
      const change = machine.transition(position, command);
      if (change === undefined) {
        return;
      }
      const intendedTransitionType =
        requestedTransitionType !== undefined &&
        isCompatibleTransitionType(change, requestedTransitionType)
          ? requestedTransitionType
          : change.transitionType;
      const url = route.encodeURL(change.to, route.ownsURL(routeBase) ? routeBase : baseURL);
      const result = navigation.navigate(url.href, {
        history: "push",
        info: navigationInfo(intendedTransitionType),
        state: cachedState(change.to),
      });
      await result.finished;
    },
    dispose() {
      navigation.removeEventListener("navigate", listener);
    },
  });
};
