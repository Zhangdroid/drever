import { availableParallelism } from "node:os";

const DEFAULT_CONCURRENCY_LIMIT = 4;

export const resolveTaskConcurrency = (value = process.env.DREVER_TASK_CONCURRENCY) => {
  if (value === undefined) {
    return Math.min(DEFAULT_CONCURRENCY_LIMIT, availableParallelism());
  }

  if (!/^[1-9]\d*$/u.test(value)) {
    throw new Error("DREVER_TASK_CONCURRENCY must be a positive integer.");
  }

  return Number(value);
};

export const runConcurrently = async (items, task, concurrency = resolveTaskConcurrency()) => {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new Error("Task concurrency must be a positive integer.");
  }

  let cursor = 0;
  let failed = false;
  let failure;

  const worker = async () => {
    while (!failed) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;

      try {
        await task(items[index], index);
      } catch (error) {
        failed = true;
        failure = error;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));

  if (failed) throw failure;
};
