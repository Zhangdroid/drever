import { createCompilePlan, defineTheme } from "@drever/compiler";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { DataChart } from "./data-chart.tsx";
import chartsPlugin from "./index.ts";

const theme = defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: "test-theme",
  tokens: {},
  manifest: { title: "Test", summary: "Test theme." },
});

const render = (props: Parameters<typeof DataChart>[0]): string =>
  renderToStaticMarkup(createElement(DataChart, props));

describe("@drever/plugin-charts", () => {
  it("publishes one AI-described component and scoped component styles", () => {
    const result = createCompilePlan({
      theme,
      plugins: [{ plugin: chartsPlugin, origin: "user" }],
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        plugins: [{ id: "@drever/plugin-charts", origin: "user" }],
        runtime: {
          components: [
            {
              name: "DataChart",
              manifest: {
                props: {
                  data: { required: true, type: "json" },
                  kind: { default: "bar", values: ["bar", "line"] },
                  label: { required: true, type: "string" },
                  valueSuffix: { type: "string" },
                },
              },
              owner: { id: "@drever/plugin-charts", kind: "plugin" },
            },
          ],
          styles: [
            {
              owner: { id: "@drever/plugin-charts", kind: "plugin" },
              style: { layer: "component" },
            },
          ],
        },
      },
    });
    if (result.ok) {
      expect(result.value.runtime.components[0]?.module.specifier).toMatch(
        /\/packages\/plugin-charts\/src\/data-chart\.tsx$/u,
      );
    }
  });

  it("renders positive and negative bars against one accessible baseline", () => {
    const markup = render({
      data: [
        { label: "North", value: 18 },
        { label: "South", value: -6 },
        { label: "West", value: 0 },
      ],
      label: "Change by region",
      valueSuffix: "%",
    });

    expect(markup).toContain('data-chart-kind="bar"');
    expect(markup).toContain('role="img"');
    expect(markup).toContain("<title");
    expect(markup).toContain(">Change by region</title>");
    expect(markup).toContain("3 points. North: 18%; South: -6%; West: 0%.");
    expect(markup).toContain('data-chart-polarity="negative"');
    expect(markup.match(/<rect/g)).toHaveLength(3);
    expect(markup).toContain("data-chart-baseline");
  });

  it("renders a deterministic line path and exact point values", () => {
    const props = {
      data: [
        { label: "Q1", value: 28 },
        { label: "Q2", value: 46 },
        { label: "Q3", value: 71 },
      ],
      kind: "line" as const,
      label: "Adoption by quarter",
      valueSuffix: "%",
    };
    const first = render(props);
    const second = render(props);

    expect(first).toBe(second);
    expect(first).toContain('data-chart-kind="line"');
    expect(first).toMatch(/<path d="M[^"]+ L[^"]+ L[^"]+"/u);
    expect(first.match(/<circle/g)).toHaveLength(3);
    expect(first).toContain(">28%</text>");
    expect(first).toContain(">46%</text>");
    expect(first).toContain(">71%</text>");
  });

  it("places an all-zero series on the bottom baseline", () => {
    const markup = render({
      data: [
        { label: "Before", value: 0 },
        { label: "After", value: 0 },
      ],
      label: "Change",
    });

    expect(markup).toContain('<line data-chart-baseline="" x1="50" x2="776" y1="340" y2="340">');
    expect(markup.match(/y="340"/gu)).toHaveLength(2);
  });

  it("normalizes opposite extreme finite values without invalid SVG geometry", () => {
    const markup = render({
      data: [
        { label: "Minimum", value: -Number.MAX_VALUE },
        { label: "Maximum", value: Number.MAX_VALUE },
      ],
      kind: "bar",
      label: "Extreme range",
    });

    expect(markup).toContain("Extreme range");
    expect(markup.match(/<rect/g)).toHaveLength(2);
    expect(markup).not.toMatch(/(?:NaN|Infinity)/u);
  });

  it.each([
    {
      name: "an empty accessible label",
      props: { data: [{ label: "One", value: 1 }], label: " " },
      message: "DataChart label must be a non-empty string.",
    },
    {
      name: "an empty data set",
      props: { data: [], label: "Empty" },
      message: "DataChart data must contain between 1 and 12 points.",
    },
    {
      name: "a blank point label",
      props: { data: [{ label: "", value: 1 }], label: "Blank label" },
      message: "DataChart data[0].label must be a non-empty string.",
    },
    {
      name: "a non-finite point value",
      props: { data: [{ label: "One", value: Number.NaN }], label: "Invalid value" },
      message: "DataChart data[0].value must be a finite number.",
    },
  ])("fails clearly for $name", ({ message, props }) => {
    expect(() => render(props)).toThrow(message);
  });
});
