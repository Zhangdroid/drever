import { definePlugin } from "@drever/compiler";

const PACKAGE_ROOT = new URL("../", import.meta.url).href;
const DATA_CHART_MODULE = import.meta.url.endsWith(".ts")
  ? "./src/data-chart.tsx"
  : "./dist/data-chart.mjs";
const ANIMATED_NUMBER_MODULE = import.meta.url.endsWith(".ts")
  ? "./src/animated-number.tsx"
  : "./dist/animated-number.mjs";

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
          description:
            "Render a compact, accessible bar, line, area, dot, or donut chart from labeled numeric data.",
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
              values: ["bar", "line", "area", "dot", "donut"],
              default: "bar",
            },
            label: {
              type: "string",
              description: "A concise accessible title that states what the chart measures.",
              required: true,
            },
            valuePrefix: {
              type: "string",
              description: "Optional unit placed before every displayed and accessible value.",
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
      {
        name: "AnimatedNumber",
        module: { specifier: ANIMATED_NUMBER_MODULE, exportName: "AnimatedNumber" },
        manifest: {
          description:
            "Count to one important metric when its audience slide becomes active, with stable output everywhere else.",
          props: {
            label: {
              type: "string",
              description: "A concise accessible label explaining what the number measures.",
              required: true,
            },
            value: {
              type: "number",
              description: "The finite final value exposed to assistive and static surfaces.",
              required: true,
            },
            from: {
              type: "number",
              description: "The finite starting value used for audience animation.",
              default: 0,
            },
            valuePrefix: {
              type: "string",
              description: "Optional unit placed before the visible and accessible value.",
            },
            valueSuffix: {
              type: "string",
              description: "Optional unit appended to the visible and accessible value.",
            },
            duration: {
              type: "number",
              description: "Animation duration in positive milliseconds.",
              default: 1200,
            },
            decimals: {
              type: "number",
              description: "Fixed decimal places from zero through six.",
              default: 0,
            },
          },
          example:
            '<AnimatedNumber label="Audience agreement" value={96} valueSuffix="%" duration={1400} />',
        },
      },
    ],
    styles: [{ specifier: "./styles.css", layer: "component" }],
  },
  manifest: {
    title: "Drever Charts",
    summary:
      "Adds presentation-sized charts and metrics with deterministic static output and purposeful audience motion.",
  },
});

export default chartsPlugin;
