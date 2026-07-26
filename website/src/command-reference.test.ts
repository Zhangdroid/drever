import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vite-plus/test";

const cliSource = await readFile(new URL("../../packages/cli/src/cli.ts", import.meta.url), "utf8");
const createProjectSource = await readFile(
  new URL("../../packages/cli/src/create-project.ts", import.meta.url),
  "utf8",
);
const commandReference = await readFile(
  new URL("../content/docs/commands.mdx", import.meta.url),
  "utf8",
);
const normalizedCommandReference = commandReference.replace(/\s+/gu, " ");

const templateBody = (source: string, exportName: string): string => {
  const body = source.match(new RegExp(`export const ${exportName} = \`([\\s\\S]*?)\`;`, "u"))?.[1];

  expect(body, `${exportName} should remain a template literal`).toBeDefined();
  return body!;
};

const publicCommandSynopses = templateBody(cliSource, "HELP")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith("drever "));

const createOptionSpecifications = templateBody(createProjectSource, "CREATE_HELP")
  .split("\n")
  .map((line) => line.trim())
  .flatMap((line) => {
    const specification = line.match(
      /^(?:(?<short>-[a-z]),\s+)?(?<long>--[a-z][a-z-]*)(?:\s+(?<value><[^>]+>))?/u,
    )?.groups;

    return specification === undefined ? [] : [specification];
  });

const createSection =
  commandReference.match(/<h3 id="create">[\s\S]*?(?=<h3 id="dev">)/u)?.[0] ?? "";

describe("command reference", () => {
  it("documents every command exposed by the top-level CLI help", () => {
    for (const synopsis of publicCommandSynopses) {
      expect(normalizedCommandReference).toContain(synopsis);
    }
  });

  it("documents every create option and its accepted values", () => {
    expect(createSection).not.toBe("");

    for (const { short, long, value } of createOptionSpecifications) {
      expect(createSection).toContain(long);
      if (short !== undefined) {
        expect(createSection).toContain(short);
      }
      if (value !== undefined) {
        expect(createSection).toContain(`${long} ${value}`);
      }
    }
  });
});
