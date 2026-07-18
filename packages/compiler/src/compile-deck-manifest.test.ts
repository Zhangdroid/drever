import { DECK_MANIFEST_VERSION } from "@drever/schema";
import type { Root } from "mdast";
import { describe, expect, it } from "vite-plus/test";
import type { Plugin } from "unified";
import { compileDeckManifest } from "./compile-deck-manifest.ts";

describe("compileDeckManifest", () => {
  it("applies configured remark plugins before sealing sparse Steps and notes", async () => {
    const reviseTitle: Plugin<[], Root> = () => (tree) => {
      const heading = tree.children
        .find((node) => node.type === "mdxJsxFlowElement")
        ?.children.find((node) => node.type === "heading");
      if (heading?.type === "heading") {
        heading.children = [{ type: "text", value: "Revised by plugin" }];
      }
    };

    const manifest = await compileDeckManifest(
      `# Original

<Step at={5}>Later</Step>

<Step at={2}>Earlier</Step>

<Note>Remember **why**.</Note>

---

# Finish`,
      { path: "talk.mdx", remarkPlugins: [reviseTitle] },
    );

    expect(manifest).toEqual({
      version: DECK_MANIFEST_VERSION,
      slides: [
        {
          id: "slide-1",
          index: 0,
          speakerNotes: [
            {
              format: "markdown",
              plainText: "Remember why.",
              value: "Remember **why**.",
            },
          ],
          stepStops: [2, 5],
          title: "Revised by plugin",
        },
        { id: "slide-2", index: 1, speakerNotes: [], stepStops: [], title: "Finish" },
      ],
    });
    expect(Object.isFrozen(manifest)).toBe(true);
  });

  it("preserves compiler diagnostics for invalid protected Step state", async () => {
    await expect(
      compileDeckManifest("# Invalid\n\n<Step at={state}>Dynamic</Step>", {
        path: "invalid.mdx",
      }),
    ).rejects.toMatchObject({ source: "drever", ruleId: "step-index-dynamic" });
  });
});
