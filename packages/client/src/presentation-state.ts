import {
  DECK_MANIFEST_VERSION,
  type DeckManifest,
  type JsonObject,
  type SpeakerNote,
  type SlideManifest,
} from "@drever/schema";
import { DreverClientError } from "./client-error.ts";

export type DeckPosition = Readonly<{
  slideId: string;
  slideIndex: number;
  step: number;
}>;

export type DeckCommand =
  | Readonly<{ type: "first" }>
  | Readonly<{ type: "goTo"; slideId: string; step?: number }>
  | Readonly<{ type: "last" }>
  | Readonly<{ type: "next" }>
  | Readonly<{ type: "previous" }>;

export type PresentationTransitionType =
  | "drever-jump-backward"
  | "drever-jump-forward"
  | "drever-slide-backward"
  | "drever-slide-forward"
  | "drever-step-backward"
  | "drever-step-forward";

export type PresentationChange = Readonly<{
  from: DeckPosition;
  to: DeckPosition;
  transitionType: PresentationTransitionType;
}>;

export type PresentationStateMachine = Readonly<{
  manifest: DeckManifest;
  initialPosition: DeckPosition;
  change(
    from: DeckPosition,
    to: DeckPosition,
    options?: Readonly<{ direction?: "backward" | "forward"; jump?: boolean }>,
  ): PresentationChange | undefined;
  transition(position: DeckPosition, command: DeckCommand): PresentationChange | undefined;
  validatePosition(position: DeckPosition): DeckPosition;
}>;

export type PresentationStore = Readonly<{
  commit(position: DeckPosition): void;
  getSnapshot(): DeckPosition;
  subscribe(listener: () => void): () => void;
}>;

const fail = (code: string, message: string, details?: JsonObject): never => {
  throw new DreverClientError(code, message, details === undefined ? {} : { details });
};

const snapshotManifest = (input: DeckManifest): DeckManifest => {
  if (typeof input !== "object" || input === null) {
    return fail("DREVER_CLIENT_MANIFEST_INVALID", "DeckManifest must be an object.");
  }
  if (input.version !== DECK_MANIFEST_VERSION) {
    return fail(
      "DREVER_CLIENT_MANIFEST_VERSION",
      `DeckManifest version ${String(input.version)} is not supported.`,
      { actual: String(input.version), expected: DECK_MANIFEST_VERSION },
    );
  }
  if (!Array.isArray(input.slides) || input.slides.length === 0) {
    return fail("DREVER_CLIENT_MANIFEST_INVALID", "DeckManifest must contain at least one slide.");
  }

  const ids = new Set<string>();
  const slides = input.slides.map((slide, expectedIndex): SlideManifest => {
    if (
      typeof slide !== "object" ||
      slide === null ||
      typeof slide.id !== "string" ||
      slide.id.length === 0 ||
      slide.index !== expectedIndex ||
      !Array.isArray(slide.speakerNotes) ||
      !Array.isArray(slide.stepStops)
    ) {
      return fail(
        "DREVER_CLIENT_MANIFEST_INVALID",
        `Slide ${expectedIndex + 1} has an invalid identity, speaker note list, or Step stop list.`,
        { expectedIndex },
      );
    }
    if (ids.has(slide.id)) {
      return fail(
        "DREVER_CLIENT_MANIFEST_INVALID",
        `DeckManifest contains duplicate slide id "${slide.id}".`,
        { slideId: slide.id },
      );
    }
    ids.add(slide.id);

    const speakerNotes = slide.speakerNotes.map((note: unknown, noteIndex: number): SpeakerNote => {
      if (
        typeof note !== "object" ||
        note === null ||
        !("format" in note) ||
        note.format !== "markdown" ||
        !("plainText" in note) ||
        typeof note.plainText !== "string" ||
        !("value" in note) ||
        typeof note.value !== "string"
      ) {
        return fail(
          "DREVER_CLIENT_MANIFEST_INVALID",
          `Slide "${slide.id}" speaker note ${noteIndex + 1} is invalid.`,
          { noteIndex, slideId: slide.id },
        );
      }
      return Object.freeze({
        format: "markdown",
        plainText: note.plainText,
        value: note.value,
      });
    });

    let previous = 0;
    const stepStops = slide.stepStops.map((stop: unknown) => {
      if (typeof stop !== "number" || !Number.isSafeInteger(stop) || stop <= previous) {
        return fail(
          "DREVER_CLIENT_MANIFEST_INVALID",
          `Slide "${slide.id}" Step stops must be strictly increasing positive safe integers.`,
          { slideId: slide.id, stop: String(stop) },
        );
      }
      previous = stop;
      return stop;
    });
    return Object.freeze({
      id: slide.id,
      index: slide.index,
      speakerNotes: Object.freeze(speakerNotes),
      stepStops: Object.freeze(stepStops),
    });
  });

  return Object.freeze({ version: DECK_MANIFEST_VERSION, slides: Object.freeze(slides) });
};

const snapshotPosition = (slide: SlideManifest, step: number): DeckPosition =>
  Object.freeze({ slideId: slide.id, slideIndex: slide.index, step });

const validStep = (slide: SlideManifest, step: number): boolean =>
  step === 0 || slide.stepStops.includes(step);

const transitionType = (
  from: DeckPosition,
  to: DeckPosition,
  direction: "backward" | "forward",
  jump: boolean,
): PresentationTransitionType => {
  if (from.slideIndex === to.slideIndex) {
    return `drever-step-${direction}`;
  }
  return `${jump ? "drever-jump" : "drever-slide"}-${direction}`;
};

export const createPresentationStateMachine = (input: DeckManifest): PresentationStateMachine => {
  const manifest = snapshotManifest(input);
  const byId = new Map(manifest.slides.map((slide) => [slide.id, slide] as const));
  const firstSlide = manifest.slides[0] as SlideManifest;

  const validatePosition = (position: DeckPosition): DeckPosition => {
    if (
      typeof position !== "object" ||
      position === null ||
      typeof position.slideId !== "string" ||
      typeof position.slideIndex !== "number" ||
      typeof position.step !== "number"
    ) {
      return fail(
        "DREVER_CLIENT_POSITION_INVALID",
        "Presentation position must contain a slide id, slide index, and Step.",
        { receivedType: position === null ? "null" : typeof position },
      );
    }
    const slide = byId.get(position.slideId);
    if (
      slide === undefined ||
      position.slideIndex !== slide.index ||
      !Number.isSafeInteger(position.step) ||
      !validStep(slide, position.step)
    ) {
      return fail("DREVER_CLIENT_POSITION_INVALID", "Presentation position is not in this deck.", {
        slideId: position.slideId,
        slideIndex: position.slideIndex,
        step: position.step,
      });
    }
    return snapshotPosition(slide, position.step);
  };

  const ordinal = (position: DeckPosition): number => {
    let result = 0;
    for (const slide of manifest.slides) {
      if (slide.index === position.slideIndex) {
        const stopIndex = position.step === 0 ? 0 : slide.stepStops.indexOf(position.step) + 1;
        return result + stopIndex;
      }
      result += slide.stepStops.length + 1;
    }
    return result;
  };

  const change: PresentationStateMachine["change"] = (fromInput, toInput, options = {}) => {
    const from = validatePosition(fromInput);
    const to = validatePosition(toInput);
    if (from.slideIndex === to.slideIndex && from.step === to.step && from.slideId === to.slideId) {
      return undefined;
    }
    const fromOrdinal = ordinal(from);
    const toOrdinal = ordinal(to);
    const direction = options.direction ?? (toOrdinal > fromOrdinal ? "forward" : "backward");
    const jump = options.jump ?? Math.abs(to.slideIndex - from.slideIndex) > 1;
    return Object.freeze({
      from,
      to,
      transitionType: transitionType(from, to, direction, jump),
    });
  };

  const transition = (
    positionInput: DeckPosition,
    command: DeckCommand,
  ): PresentationChange | undefined => {
    const position = validatePosition(positionInput);
    const slide = manifest.slides[position.slideIndex] as SlideManifest;
    let target = position;

    switch (command.type) {
      case "next": {
        const nextStop = slide.stepStops.find((stop) => stop > position.step);
        const nextSlide = manifest.slides[position.slideIndex + 1];
        if (nextStop !== undefined) {
          target = snapshotPosition(slide, nextStop);
        } else if (nextSlide !== undefined) {
          target = snapshotPosition(nextSlide, 0);
        }
        break;
      }
      case "previous": {
        const previousStop = slide.stepStops.findLast((stop) => stop < position.step);
        const previousSlide = manifest.slides[position.slideIndex - 1];
        if (previousStop !== undefined) {
          target = snapshotPosition(slide, previousStop);
        } else if (position.step !== 0) {
          target = snapshotPosition(slide, 0);
        } else if (previousSlide !== undefined) {
          target = snapshotPosition(previousSlide, previousSlide.stepStops.at(-1) ?? 0);
        }
        break;
      }
      case "first":
        target = snapshotPosition(firstSlide, 0);
        break;
      case "last": {
        const lastSlide = manifest.slides.at(-1) as SlideManifest;
        target = snapshotPosition(lastSlide, lastSlide.stepStops.at(-1) ?? 0);
        break;
      }
      case "goTo": {
        const targetSlide = byId.get(command.slideId);
        if (targetSlide === undefined) {
          return fail("DREVER_CLIENT_POSITION_INVALID", `Unknown slide id "${command.slideId}".`, {
            slideId: command.slideId,
          });
        }
        target = validatePosition(snapshotPosition(targetSlide, command.step ?? 0));
        break;
      }
    }

    return change(position, target, {
      jump: command.type === "first" || command.type === "last" || command.type === "goTo",
    });
  };

  return Object.freeze({
    manifest,
    initialPosition: snapshotPosition(firstSlide, 0),
    change,
    transition,
    validatePosition,
  });
};

export const createPresentationStore = (
  machine: PresentationStateMachine,
  initialPosition: DeckPosition = machine.initialPosition,
): PresentationStore => {
  let snapshot = machine.validatePosition(initialPosition);
  const listeners = new Set<() => void>();
  return Object.freeze({
    commit(position) {
      const next = machine.validatePosition(position);
      if (
        next.slideIndex === snapshot.slideIndex &&
        next.slideId === snapshot.slideId &&
        next.step === snapshot.step
      ) {
        return;
      }
      snapshot = next;
      for (const listener of listeners) {
        listener();
      }
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
};
