import { DreverClientError } from "./client-error.ts";

export const PRESENTATION_IDLE_DELAY_MS = 1_800;
export const FULLSCREEN_CURSOR_HIDDEN_ATTRIBUTE = "data-drever-cursor-hidden";

export type ScreenWakeLockSentinel = Readonly<{
  addEventListener(type: "release", listener: () => void): void;
  release(): Promise<void>;
  removeEventListener(type: "release", listener: () => void): void;
}>;

export type ScreenWakeLockManager = Readonly<{
  request(type: "screen"): Promise<ScreenWakeLockSentinel>;
}>;

export type FullscreenSessionScheduler = (task: () => void, delay: number) => () => void;

export type FullscreenSession = Readonly<{
  dispose(): void;
}>;

export type CreateFullscreenSessionOptions = Readonly<{
  document: Document;
  onError(error: unknown): void;
  schedule?: FullscreenSessionScheduler;
}>;

type WakeLockNavigator = Navigator & Readonly<{ wakeLock?: ScreenWakeLockManager }>;

type ActiveWakeLock = Readonly<{
  onRelease(): void;
  sentinel: ScreenWakeLockSentinel;
}>;

const scheduleTimeout: FullscreenSessionScheduler = (task, delay) => {
  const timeout = globalThis.setTimeout(task, delay);
  return () => globalThis.clearTimeout(timeout);
};

const wakeLockError = (code: string, message: string, cause?: unknown): DreverClientError =>
  new DreverClientError(code, message, cause === undefined ? {} : { cause });

/** Owns fullscreen-only wake lock and cursor-idle resources for one audience surface. */
export const createFullscreenSession = ({
  document,
  onError,
  schedule = scheduleTimeout,
}: CreateFullscreenSessionOptions): FullscreenSession => {
  let activeWakeLock: ActiveWakeLock | undefined;
  let cancelCursorIdle: (() => void) | undefined;
  let disposed = false;
  let pendingWakeLock: Promise<void> | undefined;
  let unsupportedReported = false;

  const isFullscreen = (): boolean => document.fullscreenElement !== null;
  const isActive = (): boolean =>
    !disposed && isFullscreen() && document.visibilityState === "visible";
  const setCursorHidden = (hidden: boolean): void => {
    document.documentElement.toggleAttribute(FULLSCREEN_CURSOR_HIDDEN_ATTRIBUTE, hidden);
  };
  const cancelCursorTimer = (): void => {
    cancelCursorIdle?.();
    cancelCursorIdle = undefined;
  };
  const armCursorTimer = (): void => {
    cancelCursorTimer();
    setCursorHidden(false);
    if (!isActive()) {
      return;
    }
    cancelCursorIdle = schedule(() => {
      cancelCursorIdle = undefined;
      if (isActive()) {
        setCursorHidden(true);
      }
    }, PRESENTATION_IDLE_DELAY_MS);
  };

  const reportReleaseFailure = (cause: unknown): void => {
    onError(
      wakeLockError(
        "DREVER_CLIENT_WAKE_LOCK_RELEASE_FAILED",
        "The audience display wake lock could not be released.",
        cause,
      ),
    );
  };
  const releaseSentinel = (sentinel: ScreenWakeLockSentinel): void => {
    try {
      Promise.resolve(sentinel.release()).catch(reportReleaseFailure);
    } catch (error) {
      reportReleaseFailure(error);
    }
  };
  const releaseWakeLock = (): void => {
    const active = activeWakeLock;
    if (active === undefined) {
      return;
    }
    activeWakeLock = undefined;
    active.sentinel.removeEventListener("release", active.onRelease);
    releaseSentinel(active.sentinel);
  };
  const retainWakeLock = (sentinel: ScreenWakeLockSentinel): void => {
    const onRelease = (): void => {
      if (activeWakeLock?.sentinel !== sentinel) {
        return;
      }
      sentinel.removeEventListener("release", onRelease);
      activeWakeLock = undefined;
    };
    activeWakeLock = Object.freeze({ onRelease, sentinel });
    sentinel.addEventListener("release", onRelease);
  };
  const requestWakeLock = (): void => {
    if (!isActive() || activeWakeLock !== undefined || pendingWakeLock !== undefined) {
      return;
    }
    const manager = (document.defaultView?.navigator as WakeLockNavigator | undefined)?.wakeLock;
    if (manager === undefined) {
      if (!unsupportedReported) {
        unsupportedReported = true;
        onError(
          wakeLockError(
            "DREVER_CLIENT_WAKE_LOCK_UNAVAILABLE",
            "Screen Wake Lock is not available for this audience display.",
          ),
        );
      }
      return;
    }

    const request = Promise.resolve()
      .then(() => manager.request("screen"))
      .then(
        (sentinel) => {
          if (pendingWakeLock === request) {
            pendingWakeLock = undefined;
          }
          if (isActive()) {
            retainWakeLock(sentinel);
          } else {
            releaseSentinel(sentinel);
          }
        },
        (cause: unknown) => {
          if (pendingWakeLock === request) {
            pendingWakeLock = undefined;
          }
          if (!isActive()) {
            return;
          }
          onError(
            wakeLockError(
              "DREVER_CLIENT_WAKE_LOCK_REQUEST_FAILED",
              "The audience display could not acquire a screen wake lock.",
              cause,
            ),
          );
        },
      );
    pendingWakeLock = request;
  };
  const synchronize = (): void => {
    armCursorTimer();
    if (isActive()) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  };
  const onActivity = (): void => {
    if (isFullscreen()) {
      armCursorTimer();
      requestWakeLock();
    }
  };

  document.addEventListener("fullscreenchange", synchronize);
  document.addEventListener("visibilitychange", synchronize);
  document.addEventListener("keydown", onActivity);
  document.addEventListener("pointerdown", onActivity);
  document.addEventListener("pointermove", onActivity);
  synchronize();

  return Object.freeze({
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      document.removeEventListener("fullscreenchange", synchronize);
      document.removeEventListener("visibilitychange", synchronize);
      document.removeEventListener("keydown", onActivity);
      document.removeEventListener("pointerdown", onActivity);
      document.removeEventListener("pointermove", onActivity);
      cancelCursorTimer();
      setCursorHidden(false);
      releaseWakeLock();
    },
  });
};
