import type {
  DeckCommand,
  DeckPosition,
  PresentationStateMachine,
  PresentationStore,
  PresentationTransitionType,
} from "./presentation-state.ts";
import { DreverClientError } from "./client-error.ts";
import type { PresentationNavigationIntent } from "./navigation.ts";
import { PRESENTATION_TRANSITION_TYPES } from "./view-transition.ts";

export const PRESENTATION_SYNC_PROTOCOL = "drever-presentation-sync-v1";

export type PresentationChannelMessageEvent = Readonly<{
  data: unknown;
}>;

export type PresentationChannel = Readonly<{
  addEventListener(
    type: "message",
    listener: (event: PresentationChannelMessageEvent) => void,
  ): void;
  close(): void;
  postMessage(message: unknown): void;
  removeEventListener(
    type: "message",
    listener: (event: PresentationChannelMessageEvent) => void,
  ): void;
}>;

export type PresentationChannelView = Readonly<{
  BroadcastChannel: new (name: string) => PresentationChannel;
}>;

export type PresentationSync = Readonly<{
  dispose(): void;
}>;

export type SpeakerPresentationSync = PresentationSync &
  Readonly<{
    /** Publishes a live, already-committed speaker transition. */
    publish(transitionType: PresentationTransitionType): void;
  }>;

export type CreateAudienceSyncOptions = Readonly<{
  channel: PresentationChannel;
  machine: PresentationStateMachine;
  navigate(command: DeckCommand, intent?: PresentationNavigationIntent): Promise<void>;
  onError(error: unknown): void;
}>;

export type CreateSpeakerSyncOptions = Readonly<{
  channel: PresentationChannel;
  onError(error: unknown): void;
  store: Pick<PresentationStore, "getSnapshot">;
}>;

type ReadyMessage = Readonly<{
  drever: typeof PRESENTATION_SYNC_PROTOCOL;
  type: "ready";
}>;

type PositionMessage = Readonly<{
  drever: typeof PRESENTATION_SYNC_PROTOCOL;
  position: DeckPosition;
  transitionType?: PresentationTransitionType;
  type: "position";
}>;

const TRANSITION_TYPES: ReadonlySet<PresentationTransitionType> = new Set(
  PRESENTATION_TRANSITION_TYPES,
);

const READY_MESSAGE: ReadyMessage = Object.freeze({
  drever: PRESENTATION_SYNC_PROTOCOL,
  type: "ready",
});

const normalizeBasePathname = (pathname: string): string =>
  pathname === "/" ? pathname : `${pathname.replace(/\/+$/u, "")}/`;

const channelName = (baseURL: URL): string => {
  const url = new URL(baseURL);
  return `${PRESENTATION_SYNC_PROTOCOL}:${url.origin}${normalizeBasePathname(url.pathname)}`;
};

const hasProtocol = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" &&
  value !== null &&
  "drever" in value &&
  value.drever === PRESENTATION_SYNC_PROTOCOL;

const isReadyMessage = (value: unknown): value is ReadyMessage =>
  hasProtocol(value) && value.type === "ready";

const positionMessage = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  hasProtocol(value) && value.type === "position" ? value : undefined;

const readTransitionType = (
  message: Readonly<Record<string, unknown>>,
): PresentationTransitionType | undefined => {
  if (!("transitionType" in message)) {
    return;
  }
  if (
    typeof message.transitionType !== "string" ||
    !TRANSITION_TYPES.has(message.transitionType as PresentationTransitionType)
  ) {
    throw new DreverClientError(
      "DREVER_CLIENT_SYNC_TRANSITION_INVALID",
      "The speaker sent an invalid presentation transition type.",
      { details: { transitionType: String(message.transitionType) } },
    );
  }
  return message.transitionType as PresentationTransitionType;
};

const reportFailure = (onError: (error: unknown) => void, operation: () => void): void => {
  try {
    operation();
  } catch (error) {
    onError(error);
  }
};

/** Creates the one native channel shared by a deck's audience and speaker routes. */
export const createBrowserPresentationChannel = (
  view: PresentationChannelView,
  baseURL: URL,
): PresentationChannel => new view.BroadcastChannel(channelName(baseURL));

/** Follows speaker positions while keeping remote data behind the deck state machine. */
export const createAudienceSync = ({
  channel,
  machine,
  navigate,
  onError,
}: CreateAudienceSyncOptions): PresentationSync => {
  let disposed = false;
  let pending = Promise.resolve();

  const listener = (event: PresentationChannelMessageEvent): void => {
    if (disposed) {
      return;
    }
    const message = positionMessage(event.data);
    if (message === undefined) {
      return;
    }

    let position: DeckPosition;
    let transitionType: PresentationTransitionType | undefined;
    try {
      position = machine.validatePosition(message.position as DeckPosition);
      transitionType = readTransitionType(message);
    } catch (error) {
      onError(error);
      return;
    }

    pending = pending
      .then(async () => {
        if (disposed) {
          return;
        }
        const command: DeckCommand = {
          type: "goTo",
          slideId: position.slideId,
          step: position.step,
        };
        if (transitionType === undefined) {
          await navigate(command);
        } else {
          await navigate(command, Object.freeze({ transitionType }));
        }
      })
      .catch(onError);
  };

  reportFailure(onError, () => channel.addEventListener("message", listener));
  reportFailure(onError, () => channel.postMessage(READY_MESSAGE));

  return Object.freeze({
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      reportFailure(onError, () => channel.removeEventListener("message", listener));
      reportFailure(onError, () => channel.close());
    },
  });
};

/** Publishes the speaker position initially, after changes, and to newly ready audiences. */
export const createSpeakerSync = ({
  channel,
  onError,
  store,
}: CreateSpeakerSyncOptions): SpeakerPresentationSync => {
  let disposed = false;

  const publishPosition = (transitionType?: PresentationTransitionType): void => {
    if (disposed) {
      return;
    }
    reportFailure(onError, () => {
      const position = store.getSnapshot();
      const message: PositionMessage = Object.freeze({
        drever: PRESENTATION_SYNC_PROTOCOL,
        position: Object.freeze({
          slideId: position.slideId,
          slideIndex: position.slideIndex,
          step: position.step,
        }),
        ...(transitionType === undefined ? {} : { transitionType }),
        type: "position",
      });
      channel.postMessage(message);
    });
  };

  const listener = (event: PresentationChannelMessageEvent): void => {
    if (!disposed && isReadyMessage(event.data)) {
      publishPosition();
    }
  };

  reportFailure(onError, () => channel.addEventListener("message", listener));
  publishPosition();

  return Object.freeze({
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      reportFailure(onError, () => channel.removeEventListener("message", listener));
      reportFailure(onError, () => channel.close());
    },
    publish(transitionType) {
      if (disposed) {
        return;
      }
      if (!TRANSITION_TYPES.has(transitionType)) {
        onError(
          new DreverClientError(
            "DREVER_CLIENT_SYNC_TRANSITION_INVALID",
            "The speaker attempted to publish an invalid presentation transition type.",
            { details: { transitionType: String(transitionType) } },
          ),
        );
        return;
      }
      publishPosition(transitionType);
    },
  });
};
