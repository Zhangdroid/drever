import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test } from "node:test";
import { promisify } from "node:util";
import { extractChangelogSection, parseChangelog } from "./changelog.mjs";

const execute = promisify(execFile);
const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

test("extracts one section without later releases or reference links", () => {
  const source = `# Changelog

## [Unreleased]

### Added

- A current change.

## [1.0.0] - 2026-07-20

### Added

- The first release.

[Unreleased]: https://example.test/compare
[1.0.0]: https://example.test/releases/1.0.0
`;

  assert.equal(extractChangelogSection(source, "Unreleased"), "### Added\n\n- A current change.");
  assert.equal(extractChangelogSection(source, "1.0.0"), "### Added\n\n- The first release.");
});

test("accepts prerelease SemVer headings and valid calendar dates", () => {
  const source = `# Changelog

## [2.0.0-rc.1] - 2024-02-29

- Release candidate.
`;

  assert.deepEqual(parseChangelog(source), [
    {
      section: "2.0.0-rc.1",
      date: "2024-02-29",
      body: "- Release candidate.",
      hasBullet: true,
    },
  ]);
  assert.equal(extractChangelogSection(source, "2.0.0-rc.1"), "- Release candidate.");
});

test("rejects malformed section headings", () => {
  for (const heading of [
    "## Unreleased",
    "##Unreleased",
    "## [1.0] - 2026-07-20",
    "## [1.0.0]",
    "## [1.0.0] - 2026-02-29",
    "## Notes",
  ]) {
    assert.throws(
      () => parseChangelog(`# Changelog\n\n${heading}\n\n- Change.\n`),
      /Malformed changelog heading/u,
    );
  }
});

test("rejects duplicate Unreleased and release headings", () => {
  assert.throws(
    () =>
      parseChangelog(`## [Unreleased]

- First.

## [Unreleased]

- Second.
`),
    /Duplicate changelog heading: \[Unreleased\]/u,
  );
  assert.throws(
    () =>
      parseChangelog(`## [1.0.0] - 2026-07-20

- First.

## [1.0.0] - 2026-07-21

- Second.
`),
    /Duplicate changelog heading: \[1\.0\.0\]/u,
  );
});

test("requires a real bullet in the selected section", () => {
  const source = `## [Unreleased]

No release note yet.

\`\`\`text
- A code sample is not a release note.
\`\`\`

## [1.0.0] - 2026-07-20

- A historical change.
`;

  assert.throws(
    () => extractChangelogSection(source, "Unreleased"),
    /must contain at least one bullet/u,
  );
  assert.throws(() => extractChangelogSection(source, "2.0.0"), /was not found/u);
  assert.throws(() => extractChangelogSection(source, "v1.0.0"), /Invalid changelog section/u);
});

test("CLI extracts an explicit file and defaults to CHANGELOG.md", async () => {
  const root = await mkdtemp(join(tmpdir(), "drever-changelog-"));
  temporaryRoots.push(root);
  const script = fileURLToPath(new URL("./changelog.mjs", import.meta.url));
  const changelog = `# Changelog

## [Unreleased]

- Current work.

## [1.1.0-beta.1] - 2026-07-24

- Beta work.
`;
  await writeFile(join(root, "CHANGELOG.md"), changelog, "utf8");
  await writeFile(join(root, "NOTES.md"), changelog, "utf8");

  const defaultResult = await execute(process.execPath, [script, "extract", "Unreleased"], {
    cwd: root,
  });
  assert.equal(defaultResult.stdout, "- Current work.\n");

  const explicitResult = await execute(
    process.execPath,
    [script, "extract", "1.1.0-beta.1", "NOTES.md"],
    { cwd: root },
  );
  assert.equal(explicitResult.stdout, "- Beta work.\n");
});
