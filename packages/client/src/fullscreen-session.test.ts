import { describe, expect, it, vi } from "vite-plus/test";
import {
  createFullscreenSession,
  FULLSCREEN_CURSOR_HIDDEN_ATTRIBUTE,
  PRESENTATION_IDLE_DELAY_MS,
  type FullscreenSessionScheduler,
  type ScreenWakeLockManager,
  type ScreenWakeLockSentinel,
} from "./fullscreen-session.ts";

const flushMicrotasks = async (): Promise<void> => {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
};

const deferred = <Value>() => {
  let reject: ((reason: unknown) => void) | undefined;
  let resolve: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>((onResolve, onReject) => {
    reject = onReject;
    resolve = onResolve;
  });
  return {
    promise,
    reject: (reason: unknown): void => reject?.(reason),
    resolve: (value: Value): void => resolve?.(value),
  };
};

const createScheduler = () => {
  let scheduled: (() => void) | undefined;
  const delays: number[] = [];
  const cancellations: ReturnType<typeof vi.fn>[] = [];
  const schedule: FullscreenSessionScheduler = (task, delay) => {
    scheduled = task;
    delays.push(delay);
    const cancel = vi.fn(() => {
      if (scheduled === task) {
        scheduled = undefined;
      }
    });
    cancellations.push(cancel);
    return cancel;
  };
  return {
    cancellations,
    delays,
    fire(): void {
      const task = scheduled;
      scheduled = undefined;
      task?.();
    },
    get pending(): boolean {
      return scheduled !== undefined;
    },
    schedule,
  };
};

const createSentinel = (releaseFailure?: unknown) => {
  const listeners = new Set<() => void>();
  const release = vi.fn(async () => {
    if (releaseFailure !== undefined) {
      throw releaseFailure;
    }
  });
  const sentinel: ScreenWakeLockSentinel = {
    addEventListener: (_type, listener) => listeners.add(listener),
    release,
    removeEventListener: (_type, listener) => listeners.delete(listener),
  };
  return {
    emitRelease(): void {
      for (const listener of listeners) {
        listener();
      }
    },
    listeners,
    release,
    sentinel,
  };
};

const createDocumentHarness = (wakeLock?: ScreenWakeLockManager) => {
  const attributes = new Set<string>();
  const listeners = new Map<string, Set<() => void>>();
  let fullscreenElement: Element | null = null;
  let visibilityState: DocumentVisibilityState = "visible";
  const document = {
    addEventListener(type: string, listener: () => void) {
      const entries = listeners.get(type) ?? new Set();
      entries.add(listener);
      listeners.set(type, entries);
    },
    defaultView: { navigator: wakeLock === undefined ? {} : { wakeLock } },
    documentElement: {
      toggleAttribute(name: string, force?: boolean): boolean {
        const present = force ?? !attributes.has(name);
        if (present) {
          attributes.add(name);
        } else {
          attributes.delete(name);
        }
        return present;
      },
    },
    get fullscreenElement() {
      return fullscreenElement;
    },
    removeEventListener(type: string, listener: () => void) {
      listeners.get(type)?.delete(listener);
    },
    get visibilityState() {
      return visibilityState;
    },
  } as unknown as Document;

  return {
    dispatch(type: string): void {
      for (const listener of listeners.get(type) ?? []) {
        listener();
      }
    },
    document,
    hasAttribute: (name: string): boolean => attributes.has(name),
    listenerCount: (type: string): number => listeners.get(type)?.size ?? 0,
    setFullscreen(active: boolean): void {
      fullscreenElement = active ? ({} as Element) : null;
    },
    setVisibility(next: DocumentVisibilityState): void {
      visibilityState = next;
    },
  };
};

describe("fullscreen audience session", () => {
  it("holds a wake lock and hides an idle cursor only while visible fullscreen is active", async () => {
    const wake = createSentinel();
    const request = vi.fn(async () => wake.sentinel);
    const document = createDocumentHarness({ request });
    const scheduler = createScheduler();
    const onError = vi.fn();
    const session = createFullscreenSession({
      document: document.document,
      onError,
      schedule: scheduler.schedule,
    });

    expect(request).not.toHaveBeenCalled();
    expect(scheduler.pending).toBe(false);

    document.setFullscreen(true);
    document.dispatch("fullscreenchange");
    await flushMicrotasks();
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith("screen");
    expect(scheduler.delays).toEqual([PRESENTATION_IDLE_DELAY_MS]);

    scheduler.fire();
    expect(document.hasAttribute(FULLSCREEN_CURSOR_HIDDEN_ATTRIBUTE)).toBe(true);
    document.dispatch("pointermove");
    expect(document.hasAttribute(FULLSCREEN_CURSOR_HIDDEN_ATTRIBUTE)).toBe(false);
    scheduler.fire();
    expect(document.hasAttribute(FULLSCREEN_CURSOR_HIDDEN_ATTRIBUTE)).toBe(true);
    document.dispatch("keydown");
    expect(document.hasAttribute(FULLSCREEN_CURSOR_HIDDEN_ATTRIBUTE)).toBe(false);

    document.setFullscreen(false);
    document.dispatch("fullscreenchange");
    expect(document.hasAttribute(FULLSCREEN_CURSOR_HIDDEN_ATTRIBUTE)).toBe(false);
    expect(scheduler.pending).toBe(false);
    expect(wake.release).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();

    session.dispose();
    session.dispose();
    expect(document.listenerCount("fullscreenchange")).toBe(0);
    expect(document.listenerCount("visibilitychange")).toBe(0);
    expect(document.listenerCount("pointermove")).toBe(0);
  });

  it("releases on visibility loss and reacquires when the fullscreen document returns", async () => {
    const first = createSentinel();
    const second = createSentinel();
    const request = vi
      .fn<ScreenWakeLockManager["request"]>()
      .mockResolvedValueOnce(first.sentinel)
      .mockResolvedValueOnce(second.sentinel);
    const document = createDocumentHarness({ request });
    const scheduler = createScheduler();
    document.setFullscreen(true);
    const session = createFullscreenSession({
      document: document.document,
      onError: vi.fn(),
      schedule: scheduler.schedule,
    });
    await flushMicrotasks();

    document.setVisibility("hidden");
    document.dispatch("visibilitychange");
    expect(first.release).toHaveBeenCalledOnce();
    expect(scheduler.pending).toBe(false);

    document.setVisibility("visible");
    document.dispatch("visibilitychange");
    await flushMicrotasks();
    expect(request).toHaveBeenCalledTimes(2);

    session.dispose();
    expect(second.release).toHaveBeenCalledOnce();
  });

  it("releases an acquisition that resolves after the session is disposed", async () => {
    const acquisition = deferred<ScreenWakeLockSentinel>();
    const request = vi.fn(() => acquisition.promise);
    const document = createDocumentHarness({ request });
    const scheduler = createScheduler();
    document.setFullscreen(true);
    const session = createFullscreenSession({
      document: document.document,
      onError: vi.fn(),
      schedule: scheduler.schedule,
    });
    await Promise.resolve();
    expect(request).toHaveBeenCalledOnce();

    session.dispose();
    const late = createSentinel();
    acquisition.resolve(late.sentinel);
    await flushMicrotasks();

    expect(late.release).toHaveBeenCalledOnce();
    expect(document.hasAttribute(FULLSCREEN_CURSOR_HIDDEN_ATTRIBUTE)).toBe(false);
  });

  it("ignores an acquisition failure that arrives after the session is disposed", async () => {
    const acquisition = deferred<ScreenWakeLockSentinel>();
    const document = createDocumentHarness({ request: () => acquisition.promise });
    const onError = vi.fn();
    document.setFullscreen(true);
    const session = createFullscreenSession({
      document: document.document,
      onError,
      schedule: createScheduler().schedule,
    });
    await Promise.resolve();

    session.dispose();
    acquisition.reject(new DOMException("request ended", "AbortError"));
    await flushMicrotasks();

    expect(onError).not.toHaveBeenCalled();
  });

  it("reacquires after a browser release on the next fullscreen activity", async () => {
    const first = createSentinel();
    const second = createSentinel();
    const request = vi
      .fn<ScreenWakeLockManager["request"]>()
      .mockResolvedValueOnce(first.sentinel)
      .mockResolvedValueOnce(second.sentinel);
    const document = createDocumentHarness({ request });
    document.setFullscreen(true);
    const session = createFullscreenSession({
      document: document.document,
      onError: vi.fn(),
      schedule: createScheduler().schedule,
    });
    await flushMicrotasks();

    first.emitRelease();
    document.dispatch("pointermove");
    await flushMicrotasks();

    expect(request).toHaveBeenCalledTimes(2);
    session.dispose();
    expect(second.release).toHaveBeenCalledOnce();
  });

  it("reports request failure without breaking fullscreen cursor behavior", async () => {
    const cause = new DOMException("wake lock denied", "NotAllowedError");
    const request = vi.fn(async (): Promise<ScreenWakeLockSentinel> => {
      throw cause;
    });
    const document = createDocumentHarness({ request });
    const scheduler = createScheduler();
    const onError = vi.fn();
    document.setFullscreen(true);
    const session = createFullscreenSession({
      document: document.document,
      onError,
      schedule: scheduler.schedule,
    });
    await flushMicrotasks();

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        cause,
        code: "DREVER_CLIENT_WAKE_LOCK_REQUEST_FAILED",
      }),
    );
    scheduler.fire();
    expect(document.hasAttribute(FULLSCREEN_CURSOR_HIDDEN_ATTRIBUTE)).toBe(true);

    session.dispose();
  });

  it("reports a missing native API once without installing a fallback", () => {
    const document = createDocumentHarness();
    const onError = vi.fn();
    document.setFullscreen(true);
    const session = createFullscreenSession({
      document: document.document,
      onError,
      schedule: createScheduler().schedule,
    });

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "DREVER_CLIENT_WAKE_LOCK_UNAVAILABLE" }),
    );
    document.setFullscreen(false);
    document.dispatch("fullscreenchange");
    document.setFullscreen(true);
    document.dispatch("fullscreenchange");
    expect(onError).toHaveBeenCalledOnce();

    session.dispose();
  });

  it("reports release failures through the same error boundary", async () => {
    const cause = new Error("release failed");
    const wake = createSentinel(cause);
    const document = createDocumentHarness({ request: async () => wake.sentinel });
    const onError = vi.fn();
    document.setFullscreen(true);
    const session = createFullscreenSession({
      document: document.document,
      onError,
      schedule: createScheduler().schedule,
    });
    await flushMicrotasks();

    document.setFullscreen(false);
    document.dispatch("fullscreenchange");
    await flushMicrotasks();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        cause,
        code: "DREVER_CLIENT_WAKE_LOCK_RELEASE_FAILED",
      }),
    );

    session.dispose();
  });
});
