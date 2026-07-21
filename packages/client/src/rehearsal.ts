import type { DeckManifest } from "@drever/schema";
import { DreverClientError } from "./client-error.ts";
import type { DeckPosition } from "./presentation-state.ts";

const REHEARSAL_TICK_INTERVAL = 250;

export type RehearsalSlideTiming = Readonly<{
  elapsedMs: number;
  slideId: string;
  slideIndex: number;
  visits: number;
}>;

export type RehearsalPace = "ahead" | "behind" | "on-pace";

export type RehearsalSnapshot = Readonly<{
  currentSlideElapsedMs: number;
  currentSlideId: string;
  elapsedMs: number;
  overtimeMs?: number;
  remainingMs?: number;
  running: boolean;
  slides: readonly RehearsalSlideTiming[];
  targetDurationMs?: number;
}>;

export type RehearsalStore = Readonly<{
  commitPosition(position: DeckPosition): void;
  destroy(): void;
  getSnapshot(): RehearsalSnapshot;
  pause(): void;
  reset(): void;
  resume(): void;
  setTargetDuration(targetDurationMs?: number): void;
  subscribe(listener: () => void): () => void;
  toggle(): void;
}>;

export type RehearsalScheduler = (tick: () => void) => () => void;

export type CreateRehearsalStoreOptions = Readonly<{
  initialPosition: DeckPosition;
  manifest: DeckManifest;
  now?: () => number;
  schedule?: RehearsalScheduler;
  targetDurationMs?: number;
}>;

type MutableSlideTiming = {
  elapsedMs: number;
  slideId: string;
  slideIndex: number;
  visits: number;
};

const REHEARSAL_PACE_TOLERANCE = 0.02;
const MAX_REHEARSAL_PACE_TOLERANCE_MS = 30_000;

const slideStateCount = (slide: DeckManifest["slides"][number]): number =>
  slide.stepStops.length + 1;

/** Compares elapsed time with the target window allocated to the current presentation state. */
export const resolveRehearsalPace = (
  manifest: DeckManifest,
  position: DeckPosition,
  elapsedMs: number,
  targetDurationMs: number | undefined,
): RehearsalPace | undefined => {
  if (targetDurationMs === undefined) {
    return;
  }

  const slide = manifest.slides[position.slideIndex] as DeckManifest["slides"][number];
  const stateIndex =
    manifest.slides
      .slice(0, position.slideIndex)
      .reduce((count, candidate) => count + slideStateCount(candidate), 0) +
    (position.step === 0 ? 0 : slide.stepStops.indexOf(position.step) + 1);
  const stateDuration =
    targetDurationMs /
    manifest.slides.reduce((count, candidate) => count + slideStateCount(candidate), 0);
  const tolerance = Math.min(
    MAX_REHEARSAL_PACE_TOLERANCE_MS,
    targetDurationMs * REHEARSAL_PACE_TOLERANCE,
  );

  if (elapsedMs < stateIndex * stateDuration - tolerance) {
    return "ahead";
  }
  if (elapsedMs > (stateIndex + 1) * stateDuration + tolerance) {
    return "behind";
  }
  return "on-pace";
};

const defaultNow = (): number => performance.now();

const defaultScheduler: RehearsalScheduler = (tick) => {
  const interval = globalThis.setInterval(tick, REHEARSAL_TICK_INTERVAL);
  return () => globalThis.clearInterval(interval);
};

const fail = (code: string, message: string): never => {
  throw new DreverClientError(code, message);
};

const validateTargetDuration = (targetDurationMs: number | undefined): number | undefined => {
  if (
    targetDurationMs !== undefined &&
    (!Number.isFinite(targetDurationMs) || targetDurationMs <= 0)
  ) {
    return fail(
      "DREVER_CLIENT_REHEARSAL_TARGET_INVALID",
      "A rehearsal target duration must be a positive finite number of milliseconds.",
    );
  }
  return targetDurationMs;
};

const validateNow = (value: number): number => {
  if (!Number.isFinite(value)) {
    return fail(
      "DREVER_CLIENT_REHEARSAL_CLOCK_INVALID",
      "The rehearsal clock must return a finite timestamp.",
    );
  }
  return value;
};

/** Creates the session-local clock used by one speaker view. */
export const createRehearsalStore = ({
  initialPosition,
  manifest,
  now = defaultNow,
  schedule = defaultScheduler,
  targetDurationMs: initialTargetDuration,
}: CreateRehearsalStoreOptions): RehearsalStore => {
  const timings: MutableSlideTiming[] = manifest.slides.map((slide) => ({
    elapsedMs: 0,
    slideId: slide.id,
    slideIndex: slide.index,
    visits: 0,
  }));
  const timingAt = (position: DeckPosition): MutableSlideTiming => {
    const timing = timings[position.slideIndex];
    if (timing === undefined || timing.slideId !== position.slideId) {
      return fail(
        "DREVER_CLIENT_REHEARSAL_POSITION_INVALID",
        "A rehearsal position must identify a slide in this deck.",
      );
    }
    return timing;
  };

  let currentPosition = initialPosition;
  let currentTiming = timingAt(initialPosition);
  currentTiming.visits = 1;
  let currentSlideElapsedMs = 0;
  let elapsedMs = 0;
  let running = true;
  let targetDurationMs = validateTargetDuration(initialTargetDuration);
  let startedAt = validateNow(now());
  let destroyed = false;
  let cancelTick: (() => void) | undefined;
  const listeners = new Set<() => void>();

  const elapsedSince = (timestamp: number): number =>
    running ? Math.max(0, timestamp - startedAt) : 0;

  const snapshotAt = (timestamp: number): RehearsalSnapshot => {
    const pending = elapsedSince(timestamp);
    const total = elapsedMs + pending;
    const remaining =
      targetDurationMs === undefined ? undefined : Math.max(0, targetDurationMs - total);
    const overtime =
      targetDurationMs === undefined ? undefined : Math.max(0, total - targetDurationMs);
    const slides = timings.map(
      (timing): RehearsalSlideTiming =>
        Object.freeze({
          elapsedMs: timing.elapsedMs + (timing === currentTiming ? pending : 0),
          slideId: timing.slideId,
          slideIndex: timing.slideIndex,
          visits: timing.visits,
        }),
    );
    return Object.freeze({
      currentSlideElapsedMs: currentSlideElapsedMs + pending,
      currentSlideId: currentPosition.slideId,
      elapsedMs: total,
      ...(overtime === undefined ? {} : { overtimeMs: overtime }),
      ...(remaining === undefined ? {} : { remainingMs: remaining }),
      running,
      slides: Object.freeze(slides),
      ...(targetDurationMs === undefined ? {} : { targetDurationMs }),
    });
  };

  let snapshot = snapshotAt(startedAt);

  const requireOpen = (): void => {
    if (destroyed) {
      fail("DREVER_CLIENT_REHEARSAL_CLOSED", "The rehearsal session is closed.");
    }
  };
  const notify = (timestamp: number): void => {
    snapshot = snapshotAt(timestamp);
    for (const listener of listeners) {
      listener();
    }
  };
  const settle = (timestamp: number): void => {
    const pending = elapsedSince(timestamp);
    elapsedMs += pending;
    currentSlideElapsedMs += pending;
    currentTiming.elapsedMs += pending;
    startedAt = timestamp;
  };
  const startTicks = (): void => {
    if (cancelTick === undefined) {
      cancelTick = schedule(() => notify(validateNow(now())));
    }
  };
  const stopTicks = (): void => {
    cancelTick?.();
    cancelTick = undefined;
  };
  const pause = (): void => {
    requireOpen();
    if (!running) {
      return;
    }
    const timestamp = validateNow(now());
    settle(timestamp);
    running = false;
    stopTicks();
    notify(timestamp);
  };
  const resume = (): void => {
    requireOpen();
    if (running) {
      return;
    }
    startedAt = validateNow(now());
    running = true;
    startTicks();
    notify(startedAt);
  };

  startTicks();

  return Object.freeze({
    commitPosition(position) {
      requireOpen();
      const nextTiming = timingAt(position);
      if (nextTiming === currentTiming) {
        currentPosition = position;
        return;
      }
      const timestamp = validateNow(now());
      settle(timestamp);
      currentPosition = position;
      currentTiming = nextTiming;
      currentSlideElapsedMs = 0;
      currentTiming.visits += 1;
      notify(timestamp);
    },
    destroy() {
      if (destroyed) {
        return;
      }
      const timestamp = validateNow(now());
      settle(timestamp);
      snapshot = snapshotAt(timestamp);
      destroyed = true;
      stopTicks();
      listeners.clear();
    },
    getSnapshot: () => snapshot,
    pause,
    reset() {
      requireOpen();
      const timestamp = validateNow(now());
      elapsedMs = 0;
      currentSlideElapsedMs = 0;
      for (const timing of timings) {
        timing.elapsedMs = 0;
        timing.visits = 0;
      }
      currentTiming.visits = 1;
      startedAt = timestamp;
      notify(timestamp);
    },
    resume,
    setTargetDuration(nextTargetDurationMs) {
      requireOpen();
      targetDurationMs = validateTargetDuration(nextTargetDurationMs);
      notify(validateNow(now()));
    },
    subscribe(listener) {
      requireOpen();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    toggle() {
      if (running) {
        pause();
      } else {
        resume();
      }
    },
  });
};
