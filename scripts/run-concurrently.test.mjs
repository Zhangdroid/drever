import assert from "node:assert/strict";
import test from "node:test";
import { runConcurrently } from "./run-concurrently.mjs";

const deferred = () => {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

test("runConcurrently respects its concurrency limit", async () => {
  let active = 0;
  let maximumActive = 0;
  const releases = Array.from({ length: 5 }, deferred);

  const running = runConcurrently(
    releases,
    async ({ promise }) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await promise;
      active -= 1;
    },
    2,
  );

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(maximumActive, 2);

  for (const release of releases) {
    release.resolve();
    await new Promise((resolve) => setImmediate(resolve));
  }

  await running;
  assert.equal(maximumActive, 2);
});

test("runConcurrently stops scheduling work after a failure", async () => {
  const started = [];
  const releaseSecond = deferred();

  const result = assert.rejects(
    runConcurrently(
      [0, 1, 2, 3],
      async (item) => {
        started.push(item);
        if (item === 0) throw new Error("build failed");
        if (item === 1) await releaseSecond.promise;
      },
      2,
    ),
    /build failed/u,
  );

  await new Promise((resolve) => setImmediate(resolve));
  releaseSecond.resolve();
  await result;
  assert.deepEqual(started, [0, 1]);
});
