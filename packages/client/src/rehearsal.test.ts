import { DECK_MANIFEST_VERSION, type DeckManifest } from "@drever/schema";
import { describe, expect, it, vi } from "vite-plus/test";
import type { DeckPosition } from "./presentation-state.ts";
import {
  createRehearsalStore,
  resolveRehearsalPace,
  type RehearsalScheduler,
} from "./rehearsal.ts";

const manifest = {
  version: DECK_MANIFEST_VERSION,
  slides: [
    { id: "intro", index: 0, speakerNotes: [], stepStops: [2] },
    { id: "details", index: 1, speakerNotes: [], stepStops: [] },
    { id: "end", index: 2, speakerNotes: [], stepStops: [] },
  ],
} as const satisfies DeckManifest;

const position = (slideId: string, slideIndex: number, step = 0): DeckPosition => ({
  slideId,
  slideIndex,
  step,
});

const createClock = () => {
  let timestamp = 10_000;
  let scheduled: (() => void) | undefined;
  const cancellations: ReturnType<typeof vi.fn>[] = [];
  const schedule: RehearsalScheduler = (tick) => {
    scheduled = tick;
    const cancel = vi.fn(() => {
      if (scheduled === tick) {
        scheduled = undefined;
      }
    });
    cancellations.push(cancel);
    return cancel;
  };

  return {
    advance(milliseconds: number): void {
      timestamp += milliseconds;
    },
    cancellations,
    now: () => timestamp,
    schedule,
    tick(): void {
      scheduled?.();
    },
  };
};

describe("rehearsal store", () => {
  it("compares elapsed time with the target window for each exact presentation state", () => {
    const target = 4 * 60_000;

    expect(resolveRehearsalPace(manifest, position("intro", 0), 30_000, target)).toBe("on-pace");
    expect(resolveRehearsalPace(manifest, position("intro", 0, 2), 50_000, target)).toBe("ahead");
    expect(resolveRehearsalPace(manifest, position("intro", 0, 2), 90_000, target)).toBe("on-pace");
    expect(resolveRehearsalPace(manifest, position("intro", 0, 2), 130_000, target)).toBe("behind");
    expect(resolveRehearsalPace(manifest, position("details", 1), 150_000, target)).toBe("on-pace");
    expect(resolveRehearsalPace(manifest, position("end", 2), 220_000, target)).toBe("on-pace");
    expect(resolveRehearsalPace(manifest, position("end", 2), 250_000, target)).toBe("behind");
    expect(
      resolveRehearsalPace(manifest, position("details", 1), 150_000, undefined),
    ).toBeUndefined();
  });

  it("attributes running time to slides without splitting sparse Steps", () => {
    const clock = createClock();
    const store = createRehearsalStore({
      initialPosition: position("intro", 0),
      manifest,
      now: clock.now,
      schedule: clock.schedule,
    });

    clock.advance(10_000);
    clock.tick();
    store.commitPosition(position("intro", 0, 2));
    clock.advance(5_000);
    store.commitPosition(position("details", 1));

    expect(store.getSnapshot()).toMatchObject({
      currentSlideElapsedMs: 0,
      currentSlideId: "details",
      elapsedMs: 15_000,
      running: true,
      slides: [
        { elapsedMs: 15_000, slideId: "intro", slideIndex: 0, visits: 1 },
        { elapsedMs: 0, slideId: "details", slideIndex: 1, visits: 1 },
        { elapsedMs: 0, slideId: "end", slideIndex: 2, visits: 0 },
      ],
    });

    clock.advance(7_000);
    store.pause();
    clock.advance(30_000);
    store.commitPosition(position("intro", 0, 2));
    expect(store.getSnapshot()).toMatchObject({
      currentSlideElapsedMs: 0,
      currentSlideId: "intro",
      elapsedMs: 22_000,
      running: false,
      slides: [
        { elapsedMs: 15_000, visits: 2 },
        { elapsedMs: 7_000, visits: 1 },
        { elapsedMs: 0, visits: 0 },
      ],
    });

    store.resume();
    clock.advance(3_000);
    clock.tick();
    expect(store.getSnapshot()).toMatchObject({
      currentSlideElapsedMs: 3_000,
      elapsedMs: 25_000,
      slides: [{ elapsedMs: 18_000, visits: 2 }, { elapsedMs: 7_000 }, { elapsedMs: 0 }],
    });
    store.destroy();
  });

  it("derives remaining and overtime from an editable optional target", () => {
    const clock = createClock();
    const store = createRehearsalStore({
      initialPosition: position("intro", 0),
      manifest,
      now: clock.now,
      schedule: clock.schedule,
      targetDurationMs: 60_000,
    });

    clock.advance(20_000);
    clock.tick();
    expect(store.getSnapshot()).toMatchObject({
      elapsedMs: 20_000,
      overtimeMs: 0,
      remainingMs: 40_000,
      targetDurationMs: 60_000,
    });

    store.setTargetDuration(15_000);
    expect(store.getSnapshot()).toMatchObject({
      overtimeMs: 5_000,
      remainingMs: 0,
      targetDurationMs: 15_000,
    });

    store.setTargetDuration();
    expect(store.getSnapshot()).not.toHaveProperty("targetDurationMs");
    expect(store.getSnapshot()).not.toHaveProperty("remainingMs");
    expect(store.getSnapshot()).not.toHaveProperty("overtimeMs");
    expect(() => store.setTargetDuration(0)).toThrowError(
      expect.objectContaining({ code: "DREVER_CLIENT_REHEARSAL_TARGET_INVALID" }),
    );
    expect(() => store.setTargetDuration(Number.NaN)).toThrowError(
      expect.objectContaining({ code: "DREVER_CLIENT_REHEARSAL_TARGET_INVALID" }),
    );
    store.destroy();
  });

  it("resets totals and visits while retaining the target and run state", () => {
    const clock = createClock();
    const store = createRehearsalStore({
      initialPosition: position("intro", 0),
      manifest,
      now: clock.now,
      schedule: clock.schedule,
      targetDurationMs: 120_000,
    });

    clock.advance(8_000);
    store.commitPosition(position("details", 1));
    clock.advance(2_000);
    store.pause();
    store.reset();

    expect(store.getSnapshot()).toEqual({
      currentSlideElapsedMs: 0,
      currentSlideId: "details",
      elapsedMs: 0,
      overtimeMs: 0,
      remainingMs: 120_000,
      running: false,
      slides: [
        { elapsedMs: 0, slideId: "intro", slideIndex: 0, visits: 0 },
        { elapsedMs: 0, slideId: "details", slideIndex: 1, visits: 1 },
        { elapsedMs: 0, slideId: "end", slideIndex: 2, visits: 0 },
      ],
      targetDurationMs: 120_000,
    });

    clock.advance(5_000);
    clock.tick();
    expect(store.getSnapshot().elapsedMs).toBe(0);
    store.destroy();
  });

  it("publishes immutable ticks and closes its scheduler exactly once", () => {
    const clock = createClock();
    const store = createRehearsalStore({
      initialPosition: position("intro", 0),
      manifest,
      now: clock.now,
      schedule: clock.schedule,
    });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    clock.advance(1_250);
    clock.tick();
    expect(listener).toHaveBeenCalledOnce();
    expect(store.getSnapshot().elapsedMs).toBe(1_250);
    expect(Object.isFrozen(store.getSnapshot())).toBe(true);
    expect(Object.isFrozen(store.getSnapshot().slides)).toBe(true);
    expect(store.getSnapshot().slides.every(Object.isFrozen)).toBe(true);

    const { toggle } = store;
    toggle();
    expect(store.getSnapshot().running).toBe(false);
    toggle();
    expect(store.getSnapshot().running).toBe(true);

    unsubscribe();
    store.destroy();
    store.destroy();
    expect(clock.cancellations).toHaveLength(2);
    expect(clock.cancellations[0]).toHaveBeenCalledOnce();
    expect(clock.cancellations[1]).toHaveBeenCalledOnce();
    expect(() => store.pause()).toThrowError(
      expect.objectContaining({ code: "DREVER_CLIENT_REHEARSAL_CLOSED" }),
    );
    expect(() => store.subscribe(vi.fn())).toThrowError(
      expect.objectContaining({ code: "DREVER_CLIENT_REHEARSAL_CLOSED" }),
    );
  });

  it("rejects positions and clock values outside its contract", () => {
    const clock = createClock();
    const store = createRehearsalStore({
      initialPosition: position("intro", 0),
      manifest,
      now: clock.now,
      schedule: clock.schedule,
    });

    expect(() => store.commitPosition(position("missing", 0))).toThrowError(
      expect.objectContaining({ code: "DREVER_CLIENT_REHEARSAL_POSITION_INVALID" }),
    );
    store.destroy();

    expect(() =>
      createRehearsalStore({
        initialPosition: position("intro", 0),
        manifest,
        now: () => Number.POSITIVE_INFINITY,
        schedule: clock.schedule,
      }),
    ).toThrowError(expect.objectContaining({ code: "DREVER_CLIENT_REHEARSAL_CLOCK_INVALID" }));
  });
});
