import { createCompilePlan, defineTheme } from "@drever/compiler";
import { DreverRenderModeProvider, type DreverRenderMode } from "@drever/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import mediaPlugin from "./index.ts";
import { activateYouTubeFrame, YouTube } from "./youtube.tsx";

const theme = defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: "test-theme",
  tokens: {},
  manifest: { title: "Test", summary: "Test theme." },
});

const renderInMode = (mode: DreverRenderMode): string =>
  renderToStaticMarkup(
    createElement(
      DreverRenderModeProvider,
      { mode },
      createElement(YouTube, {
        aspectRatio: "9:16",
        id: "M7lc1UVf-VE",
        start: 30,
        title: "YouTube player API demo",
      }),
    ),
  );

describe("@drever/plugin-media", () => {
  it("registers one owned component and its scoped styles only when enabled", () => {
    const withoutPlugin = createCompilePlan({ theme, plugins: [] });
    expect(withoutPlugin).toMatchObject({
      ok: true,
      value: { plugins: [], runtime: { components: [] } },
    });

    const result = createCompilePlan({
      theme,
      plugins: [{ plugin: mediaPlugin, origin: "user" }],
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        plugins: [{ id: "@drever/plugin-media", origin: "user" }],
        runtime: {
          components: [
            {
              name: "YouTube",
              owner: { kind: "plugin", id: "@drever/plugin-media" },
              module: { exportName: "YouTube" },
            },
          ],
          styles: [
            {
              owner: { kind: "plugin", id: "@drever/plugin-media" },
              style: { layer: "component" },
            },
          ],
        },
      },
    });
  });

  it("renders a lazy privacy-enhanced audience iframe and printable fallback", () => {
    const markup = renderInMode("audience");

    expect(markup).toContain('data-render-mode="audience"');
    expect(markup).toContain(
      'data-src="https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?start=30"',
    );
    expect(markup).not.toContain(
      ' src="https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?start=30"',
    );
    expect(markup).toContain('title="YouTube player API demo"');
    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain('referrerPolicy="strict-origin-when-cross-origin"');
    expect(markup).toContain("allowFullScreen");
    expect(markup).toContain("--drever-youtube-aspect-ratio:9 / 16");
    expect(markup).toContain("Watch on YouTube");
    expect(markup).not.toContain("autoplay=1");
  });

  it("removes the remote source when React deactivates the media effect", () => {
    const removeAttribute = vi.fn();
    const frame = { removeAttribute, src: "" } as unknown as HTMLIFrameElement;
    const cleanup = activateYouTubeFrame(
      frame,
      "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE",
    );

    expect(frame.src).toBe("https://www.youtube-nocookie.com/embed/M7lc1UVf-VE");
    cleanup();
    expect(removeAttribute).toHaveBeenCalledExactlyOnceWith("src");
  });

  it.each<DreverRenderMode>(["document", "export", "speaker-current", "speaker-next"])(
    "keeps %s deterministic and free of embedded media",
    (mode) => {
      const markup = renderInMode(mode);

      expect(markup).toContain(`data-render-mode="${mode}"`);
      expect(markup).toContain("YouTube player API demo");
      expect(markup).toContain('href="https://www.youtube.com/watch?v=M7lc1UVf-VE&amp;t=30s"');
      expect(markup).toContain("Watch on YouTube");
      expect(markup).not.toContain("<iframe");
      expect(markup).not.toContain("youtube-nocookie.com");
    },
  );

  it.each([
    {
      expected: 'YouTube: "id" must be an 11-character YouTube video id.',
      props: { id: "https://youtu.be/M7lc1UVf-VE", title: "Video" },
    },
    {
      expected: 'YouTube: "title" must be a non-empty string.',
      props: { id: "M7lc1UVf-VE", title: "  " },
    },
    {
      expected: 'YouTube: "start" must be a non-negative whole number of seconds.',
      props: { id: "M7lc1UVf-VE", start: 1.5, title: "Video" },
    },
    {
      expected: 'YouTube: "aspectRatio" must be one of "16:9", "4:3", "1:1", or "9:16".',
      props: { aspectRatio: "wide", id: "M7lc1UVf-VE", title: "Video" },
    },
  ] as const)("fails invalid authored values with a precise error", ({ expected, props }) => {
    expect(() => renderToStaticMarkup(createElement(YouTube, props as never))).toThrow(expected);
  });
});
