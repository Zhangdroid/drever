import assert from "node:assert/strict";
import { test } from "node:test";
import {
  configureTrustedPublishing,
  isExpectedTrust,
  parseTrustList,
  trustedPublisher,
} from "./configure-trusted-publishing.mjs";

const json = (value) => `${JSON.stringify(value)}\n`;
const createRunner = (initial = new Map()) => {
  const configurations = new Map(initial);
  const calls = [];
  return {
    calls,
    run: async (arguments_) => {
      calls.push(arguments_);
      const packageName = arguments_[2];
      if (arguments_[1] === "list") {
        const value = configurations.get(packageName);
        return { stdout: value === undefined ? "" : json(value) };
      }
      assert.equal(arguments_[1], "github");
      configurations.set(packageName, { id: `${packageName}-id`, ...trustedPublisher });
      return { stdout: "" };
    },
  };
};

test("parses empty and single trust responses", () => {
  assert.deepEqual(parseTrustList("", "drever"), []);
  assert.deepEqual(parseTrustList(json(trustedPublisher), "drever"), [trustedPublisher]);
  assert.equal(isExpectedTrust({ ...trustedPublisher, permissions: ["createPackage"] }), true);
  assert.equal(
    isExpectedTrust({ ...trustedPublisher, permissions: ["createStagedPackage"] }),
    false,
  );
});

test("creates missing policies and verifies the complete result", async () => {
  const runner = createRunner(new Map([["drever", trustedPublisher]]));
  const writes = [];
  const result = await configureTrustedPublishing({
    packageNames: ["drever", "create-drever"],
    run: runner.run,
    sleep: async () => {},
    delay: 0,
    output: { write: (value) => writes.push(value) },
  });

  assert.deepEqual(result, { created: ["create-drever"], unchanged: ["drever"] });
  assert.equal(runner.calls.filter((arguments_) => arguments_[1] === "github").length, 1);
  assert.match(writes.join(""), /create-drever/u);
});

test("is idempotent when every policy already matches", async () => {
  const runner = createRunner(
    new Map([
      ["drever", trustedPublisher],
      ["create-drever", trustedPublisher],
    ]),
  );
  const result = await configureTrustedPublishing({
    packageNames: ["drever", "create-drever"],
    run: runner.run,
    sleep: async () => {},
    delay: 0,
  });

  assert.deepEqual(result.created, []);
  assert.equal(
    runner.calls.some((arguments_) => arguments_[1] === "github"),
    false,
  );
});

test("stops before mutation when an existing policy conflicts", async () => {
  const runner = createRunner(new Map([["drever", { ...trustedPublisher, file: "release.yml" }]]));
  await assert.rejects(
    configureTrustedPublishing({
      packageNames: ["drever", "create-drever"],
      run: runner.run,
      sleep: async () => {},
      delay: 0,
    }),
    /will not revoke or replace/u,
  );
  assert.equal(
    runner.calls.some((arguments_) => arguments_[1] === "github"),
    false,
  );
});

test("verify-only reports missing policies without mutation", async () => {
  const runner = createRunner();
  await assert.rejects(
    configureTrustedPublishing({
      packageNames: ["drever"],
      run: runner.run,
      sleep: async () => {},
      delay: 0,
      verifyOnly: true,
    }),
    /Missing trusted publishers/u,
  );
  assert.equal(
    runner.calls.some((arguments_) => arguments_[1] === "github"),
    false,
  );
});
