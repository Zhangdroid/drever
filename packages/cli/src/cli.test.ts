import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { parseCommand, runCli } from "./cli.ts";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("parseCommand", () => {
  it("models the two public workflows and their optional entry", () => {
    expect(parseCommand([])).toBe("help");
    expect(parseCommand(["dev"])).toEqual({ name: "dev" });
    expect(parseCommand(["build", "decks/keynote.mdx"])).toEqual({
      entry: "decks/keynote.mdx",
      name: "build",
    });
  });

  it("models PDF export flags independently of their position", () => {
    expect(parseCommand(["export", "pdf"])).toEqual({
      format: "pdf",
      name: "export",
      steps: false,
    });
    expect(
      parseCommand([
        "export",
        "pdf",
        "--output",
        "release/talk.pdf",
        "--steps",
        "decks/keynote.mdx",
      ]),
    ).toEqual({
      entry: "decks/keynote.mdx",
      format: "pdf",
      name: "export",
      output: "release/talk.pdf",
      steps: true,
    });
    expect(parseCommand(["export", "pdf", "-o", "talk.pdf", "slides.mdx"])).toEqual({
      entry: "slides.mdx",
      format: "pdf",
      name: "export",
      output: "talk.pdf",
      steps: false,
    });
  });

  it.each([
    [["export"], "Export format is required."],
    [["export", "pptx"], "Unknown export format: pptx"],
    [["export", "pdf", "--paper"], "Unknown export flag: --paper"],
    [["export", "pdf", "--steps", "--steps"], "--steps can be specified only once."],
    [["export", "pdf", "-o"], "-o requires a PDF path."],
    [["export", "pdf", "--output", "--steps"], "--output requires a PDF path."],
    [
      ["export", "pdf", "-o", "first.pdf", "--output", "second.pdf"],
      "The PDF output can be specified only once.",
    ],
    [["export", "pdf", "-o", "talk.html"], "The export output path must end with .pdf."],
    [["export", "pdf", "one.mdx", "two.mdx"], "PDF export accepts at most one deck entry path."],
  ])("rejects invalid PDF export arguments: %j", (arguments_, message) => {
    expect(() => parseCommand(arguments_)).toThrowError(
      expect.objectContaining({ code: "DREVER_ARGUMENT_INVALID", message }),
    );
  });

  it("rejects flags that would imply an unsupported Vite surface", () => {
    expect(() => parseCommand(["dev", "--config", "vite.config.ts"])).toThrowError(
      expect.objectContaining({ code: "DREVER_ARGUMENT_INVALID" }),
    );
    expect(() => parseCommand(["preview"])).toThrowError(
      expect.objectContaining({ code: "DREVER_COMMAND_UNKNOWN" }),
    );
  });
});

describe("runCli export", () => {
  it("resolves the configured entry and default PDF beside the project", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-export-cli-test-"));
    directories.push(root);
    await writeFile(join(root, "talk.mdx"), "# Talk\n");
    await writeFile(join(root, "drever.config.ts"), 'export default { entry: "talk.mdx" };\n');
    const exportPdf = vi.fn(async () => {});
    let output = "";

    await runCli(["export", "pdf", "--steps"], {
      cwd: root,
      exportPdf,
      stdout: { write: (chunk) => ((output += String(chunk)), true) },
    });

    expect(exportPdf).toHaveBeenCalledOnce();
    expect(exportPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        output: join(root, "talk-export.pdf"),
        project: expect.objectContaining({ entry: join(root, "talk.mdx"), root }),
        steps: true,
      }),
    );
    expect(output).toBe(`Exported ${join(root, "talk.mdx")} to ${join(root, "talk-export.pdf")}\n`);
  });

  it("lets the positional entry override config and resolves a custom output from the root", async () => {
    const root = await mkdtemp(join(tmpdir(), "drever-export-cli-test-"));
    directories.push(root);
    await writeFile(join(root, "slides.mdx"), "# Default\n");
    await writeFile(join(root, "keynote.mdx"), "# Keynote\n");
    const exportPdf = vi.fn(async () => {});

    await runCli(["export", "pdf", "keynote.mdx", "-o", "exports/keynote.pdf"], {
      cwd: root,
      exportPdf,
      stdout: { write: () => true },
    });

    expect(exportPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        output: join(root, "exports", "keynote.pdf"),
        project: expect.objectContaining({ entry: join(root, "keynote.mdx") }),
        steps: false,
      }),
    );
  });
});
