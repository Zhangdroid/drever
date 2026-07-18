type Awaitable<Value> = Value | PromiseLike<Value>;

export type ResourceDisposer = () => Awaitable<void>;

export type MicrotaskScheduler = (task: () => void) => void;

/**
 * Reports readiness only when the effect instance is still mounted in the next
 * microtask. React StrictMode can therefore probe an initial setup/cleanup pair
 * without letting an abandoned effect resolve viewer creation.
 */
export const scheduleStableMountNotification = (
  onMounted: () => void,
  schedule: MicrotaskScheduler = queueMicrotask,
): (() => void) => {
  let mounted = true;
  schedule(() => {
    if (mounted) {
      onMounted();
    }
  });
  return () => {
    mounted = false;
  };
};

export type ReleaseLateAcquisitionOptions<Value> = Readonly<{
  acquisition: PromiseLike<Value>;
  onAcquisitionError(error: unknown): void;
  onDisposalError(error: unknown): void;
  resolveDisposer(value: Value): ResourceDisposer | undefined;
}>;

/**
 * Releases a resource that may finish acquiring after its owner has closed.
 * The continuation is intentionally detached so a broken acquisition cannot
 * block teardown of resources the owner already controls.
 */
export const releaseLateAcquisition = <Value>({
  acquisition,
  onAcquisitionError,
  onDisposalError,
  resolveDisposer,
}: ReleaseLateAcquisitionOptions<Value>): void => {
  void Promise.resolve(acquisition).then(async (value) => {
    let dispose: ResourceDisposer | undefined;
    try {
      dispose = resolveDisposer(value);
    } catch (error) {
      onAcquisitionError(error);
      return;
    }
    if (dispose === undefined) {
      return;
    }
    try {
      await dispose();
    } catch (error) {
      onDisposalError(error);
    }
  }, onAcquisitionError);
};
