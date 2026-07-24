import { definePlugin } from "@drever/compiler";

const PACKAGE_ROOT = new URL("../", import.meta.url).href;
const YOUTUBE_MODULE = import.meta.url.endsWith(".ts") ? "./src/youtube.tsx" : "./dist/youtube.mjs";

export const mediaPlugin = definePlugin({
  kind: "plugin",
  apiVersion: 1,
  id: "@drever/plugin-media",
  version: "0.0.0",
  baseURL: PACKAGE_ROOT,
  compilerTargets: ["canonical"],
  runtime: {
    components: [
      {
        name: "YouTube",
        module: { specifier: YOUTUBE_MODULE, exportName: "YouTube" },
        manifest: {
          description:
            "Embed a YouTube video on the active audience slide and render a stable link on non-interactive surfaces.",
          props: {
            id: {
              type: "string",
              description: "The 11-character YouTube video id, not a full URL.",
              required: true,
            },
            title: {
              type: "string",
              description: "An accessible title describing the video.",
              required: true,
            },
            start: {
              type: "number",
              description: "The whole number of seconds at which playback begins.",
              default: 0,
            },
            aspectRatio: {
              type: "string",
              description: "The frame aspect ratio.",
              values: ["16:9", "4:3", "1:1", "9:16"],
              default: "16:9",
            },
          },
          example: '<YouTube id="M7lc1UVf-VE" title="YouTube player API demo" start={30} />',
        },
      },
    ],
    styles: [{ specifier: "./styles.css", layer: "component" }],
  },
  manifest: {
    title: "Drever Media",
    summary:
      "Adds privacy-enhanced media components with deterministic document and export output.",
  },
});

export type { YouTubeAspectRatio, YouTubeProps } from "./youtube.tsx";

export default mediaPlugin;
