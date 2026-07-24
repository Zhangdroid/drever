import { definePlugin } from "@drever/compiler";

const PACKAGE_ROOT = new URL("../", import.meta.url).href;
const DATA_CHART_MODULE = import.meta.url.endsWith(".ts")
  ? "./src/data-chart.tsx"
  : "./dist/data-chart.mjs";

export const chartsPlugin = definePlugin({
  kind: "plugin",
  apiVersion: 1,
  id: "@drever/plugin-charts",
  version: "0.0.0",
  baseURL: PACKAGE_ROOT,
  compilerTargets: ["canonical"],
  runtime: {
    components: [
      {
        name: "DataChart",
        module: { specifier: DATA_CHART_MODULE, exportName: "DataChart" },
        manifest: {
          description: "Render a compact, accessible bar or line chart from labeled numeric data.",
          props: {
            data: {
              type: "json",
              description:
                "One to twelve JSON-safe points shaped as { label: string, value: number }.",
              required: true,
            },
            kind: {
              type: "string",
              description: "The visual relationship used to compare the values.",
              values: ["bar", "line"],
              default: "bar",
            },
            label: {
              type: "string",
              description: "A concise accessible title that states what the chart measures.",
              required: true,
            },
            valueSuffix: {
              type: "string",
              description: "Optional unit appended to every displayed and accessible value.",
            },
          },
          example:
            '<DataChart label="Adoption by quarter" kind="line" valueSuffix="%" data={[{ label: "Q1", value: 28 }, { label: "Q2", value: 46 }, { label: "Q3", value: 71 }]} />',
        },
      },
    ],
    styles: [{ specifier: "./styles.css", layer: "component" }],
  },
  manifest: {
    title: "Drever Charts",
    summary: "Adds a small, accessible DataChart component with deterministic SVG output.",
  },
});

export default chartsPlugin;
