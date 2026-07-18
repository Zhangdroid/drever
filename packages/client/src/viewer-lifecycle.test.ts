import { describe, expect, it, vi } from "vite-plus/test";
import { releaseLateAcquisition, scheduleStableMountNotification } from "./viewer-lifecycle.ts";

const deferred = <Value>() => {
  let resolve: ((value: Value) => void) | undefined;
  let reject: ((error: unknown) => void) | undefined;
  const promise = new Promise<Value>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return {
    promise,
    reject: (error: unknown) => reject?.(error),
    resolve: (value: Value) => resolve?.(value),
  };
};

describe("late viewer resource acquisition", () => {
  it("does not wait for acquisition and disposes a resource that arrives later", async () => {
    const acquisition = deferred<() => void>();
    const dispose = vi.fn();
    const onAcquisitionError = vi.fn();
    const onDisposalError = vi.fn();

    releaseLateAcquisition({
      acquisition: acquisition.promise,
      onAcquisitionError,
      onDisposalError,
      resolveDisposer: (value) => value,
    });
    expect(dispose).not.toHaveBeenCalled();

    acquisition.resolve(dispose);
    await acquisition.promise;
    await Promise.resolve();

    expect(dispose).toHaveBeenCalledOnce();
    expect(onAcquisitionError).not.toHaveBeenCalled();
    expect(onDisposalError).not.toHaveBeenCalled();
  });

  it("routes acquisition, validation, and disposal failures independently", async () => {
    const acquisitionFailure = new Error("acquisition failed");
    const invalidDisposer = new Error("invalid disposer");
    const disposalFailure = new Error("disposal failed");
    const onAcquisitionError = vi.fn();
    const onDisposalError = vi.fn();

    releaseLateAcquisition({
      acquisition: Promise.reject(acquisitionFailure),
      onAcquisitionError,
      onDisposalError,
      resolveDisposer: () => undefined,
    });
    releaseLateAcquisition({
      acquisition: Promise.resolve("invalid"),
      onAcquisitionError,
      onDisposalError,
      resolveDisposer: () => {
        throw invalidDisposer;
      },
    });
    releaseLateAcquisition({
      acquisition: Promise.resolve("resource"),
      onAcquisitionError,
      onDisposalError,
      resolveDisposer: () => async () => {
        throw disposalFailure;
      },
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(onAcquisitionError).toHaveBeenCalledWith(acquisitionFailure);
    expect(onAcquisitionError).toHaveBeenCalledWith(invalidDisposer);
    expect(onDisposalError).toHaveBeenCalledWith(disposalFailure);
  });
});

describe("stable ViewerHost mount notification", () => {
  it("ignores StrictMode's abandoned effect and reports the stable effect once", () => {
    const tasks: Array<() => void> = [];
    const schedule = (task: () => void): void => {
      tasks.push(task);
    };
    const onMounted = vi.fn();

    const cancelProbe = scheduleStableMountNotification(onMounted, schedule);
    cancelProbe();
    const cancelStableMount = scheduleStableMountNotification(onMounted, schedule);

    for (const task of tasks) {
      task();
    }
    expect(onMounted).toHaveBeenCalledOnce();

    cancelStableMount();
  });

  it("does not report a host that unmounts before its readiness microtask", () => {
    const tasks: Array<() => void> = [];
    const onMounted = vi.fn();
    const cancel = scheduleStableMountNotification(onMounted, (task) => tasks.push(task));

    cancel();
    tasks[0]?.();

    expect(onMounted).not.toHaveBeenCalled();
  });
});
