import { createCompilePlan, defineTheme } from "@drever/compiler";
import { DreverRenderModeProvider, type DreverRenderMode } from "@drever/core";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  AnimatedNumber,
  isAnimatedNumberOwnerActive,
  isAnimatedNumberReducedMotion,
  shouldAnimateNumber,
  startNumberAnimation,
} from "./animated-number.tsx";
import { DataChart } from "./data-chart.tsx";
import chartsPlugin from "./index.ts";

const theme = defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: "test-theme",
  tokens: {},
  manifest: { title: "Test", summary: "Test theme." },
});
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

const renderChart = (props: Parameters<typeof DataChart>[0]): string =>
  renderToStaticMarkup(createElement(DataChart, props));

const renderNumber = (
  mode: DreverRenderMode,
  props: Parameters<typeof AnimatedNumber>[0],
): string =>
  renderToStaticMarkup(
    createElement(DreverRenderModeProvider, { mode }, createElement(AnimatedNumber, props)),
  );

describe("@drever/plugin-charts manifest", () => {
  it("publishes both AI-described components and scoped component styles", () => {
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
                  kind: {
                    default: "bar",
                    values: ["bar", "line", "area", "dot", "donut"],
                  },
                  label: { required: true, type: "string" },
                  valuePrefix: { type: "string" },
                  valueSuffix: { type: "string" },
                },
              },
              owner: { id: "@drever/plugin-charts", kind: "plugin" },
            },
            {
              name: "AnimatedNumber",
              manifest: {
                props: {
                  decimals: { default: 0, type: "number" },
                  duration: { default: 1200, type: "number" },
                  from: { default: 0, type: "number" },
                  label: { required: true, type: "string" },
                  value: { required: true, type: "number" },
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
      expect(result.value.runtime.components.map(({ module }) => module.specifier)).toEqual([
        expect.stringMatching(/\/packages\/plugin-charts\/src\/data-chart\.tsx$/u),
        expect.stringMatching(/\/packages\/plugin-charts\/src\/animated-number\.tsx$/u),
      ]);
    }
  });
});

describe("DataChart", () => {
  it("publishes a deterministic twelve-series CSS-token palette", () => {
    expect(styles).toContain("--drever-data-chart-series-1:");
    expect(styles).toContain("--drever-data-chart-series-12:");
    expect(styles).toContain('[data-chart-series-index="12"]');
  });

  it("renders positive and negative bars against one accessible baseline", () => {
    const markup = renderChart({
      data: [
        { label: "North", value: 18 },
        { label: "South", value: -6 },
        { label: "West", value: 0 },
      ],
      label: "Change by region",
      valuePrefix: "$",
      valueSuffix: "m",
    });

    expect(markup).toContain('data-chart-kind="bar"');
    expect(markup).toContain('role="img"');
    expect(markup).toContain(">Change by region</title>");
    expect(markup).toContain("3 points. North: $18m; South: $-6m; West: $0m.");
    expect(markup).toContain('data-chart-polarity="negative"');
    expect(markup.match(/<rect/g)).toHaveLength(3);
    expect(markup).toContain("data-chart-baseline");
  });

  it("renders a deterministic straight line path and exact point values", () => {
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
    const first = renderChart(props);
    const second = renderChart(props);

    expect(first).toBe(second);
    expect(first).toContain('data-chart-kind="line"');
    expect(first).toMatch(/<path d="M[^"]+ L[^"]+ L[^"]+"/u);
    expect(first).toMatch(/<path d="[^CQ"]+"/u);
    expect(first.match(/<circle/g)).toHaveLength(3);
    expect(first).toContain(">71%</text>");
  });

  it("closes an area to the shared baseline while keeping its trend straight", () => {
    const markup = renderChart({
      data: [
        { label: "Mon", value: 18 },
        { label: "Tue", value: 42 },
        { label: "Wed", value: 31 },
      ],
      kind: "area",
      label: "Daily reach",
    });

    expect(markup).toContain('data-chart-kind="area"');
    expect(markup).toMatch(/<path d="M[^"]+ L[^"]+ L[^"]+ L[^"]+ L[^"]+ Z" data-chart-area-fill/u);
    expect(markup).toMatch(/<path d="M[^"]+ L[^"]+ L[^"]+" data-chart-area-line/u);
    expect(markup).toContain('data-chart-baseline=""');
  });

  it("renders a horizontal lollipop ranking with categories beside their marks", () => {
    const markup = renderChart({
      data: [
        { label: "Search", value: 84 },
        { label: "Referral", value: 57 },
        { label: "Events", value: 31 },
      ],
      kind: "dot",
      label: "Qualified leads by channel",
      valueSuffix: "%",
    });

    expect(markup).toContain('data-chart-kind="dot"');
    expect(markup).toContain("data-chart-dot-baseline");
    expect(markup.match(/data-chart-dot-stem/g)).toHaveLength(3);
    expect(markup.match(/data-chart-dot-category/g)).toHaveLength(3);
    expect(markup.match(/<circle/g)).toHaveLength(3);
    expect(markup).toContain(">Search</text>");
    expect(markup).toContain(">84%</text>");
  });

  it("renders deterministic donut arcs, an exact total, and a complete legend", () => {
    const props = {
      data: [
        { label: "Product", value: 56 },
        { label: "Services", value: 29 },
        { label: "Other", value: 15 },
      ],
      kind: "donut" as const,
      label: "Revenue mix",
      valuePrefix: "$",
      valueSuffix: "m",
    };
    const first = renderChart(props);

    expect(first).toBe(renderChart(props));
    expect(first).toContain('data-chart-kind="donut"');
    expect(first.match(/data-chart-series-index=/g)).toHaveLength(6);
    expect(first.match(/data-chart-donut-legend-row/g)).toHaveLength(3);
    expect(first).toContain('stroke-dasharray="56 44"');
    expect(first).toContain('data-chart-donut-total=""');
    expect(first).toContain(">$100m</text>");
    expect(first).toContain(">Product</text>");
    expect(first).toContain("3 points. Product: $56m; Services: $29m; Other: $15m.");
  });

  it("keeps zero-valued donut categories in the legend without creating invalid geometry", () => {
    const markup = renderChart({
      data: [
        { label: "Used", value: 4 },
        { label: "Unused", value: 0 },
      ],
      kind: "donut",
      label: "Capacity",
    });

    expect(markup).toContain(">Unused</text>");
    expect(markup).toContain('stroke-dasharray="0 100"');
    expect(markup).not.toMatch(/(?:NaN|Infinity)/u);
  });

  it("places an all-zero Cartesian series on the bottom baseline", () => {
    const markup = renderChart({
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
    const markup = renderChart({
      data: [
        { label: "Minimum", value: -Number.MAX_VALUE },
        { label: "Maximum", value: Number.MAX_VALUE },
      ],
      kind: "dot",
      label: "Extreme range",
    });

    expect(markup).toContain("Extreme range");
    expect(markup.match(/<circle/g)).toHaveLength(2);
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
    {
      name: "an unknown chart kind",
      props: { data: [{ label: "One", value: 1 }], kind: "pie", label: "Invalid kind" },
      message: 'DataChart kind must be one of "bar", "line", "area", "dot", or "donut".',
    },
    {
      name: "a negative donut value",
      props: {
        data: [
          { label: "One", value: 2 },
          { label: "Two", value: -1 },
        ],
        kind: "donut",
        label: "Invalid donut",
      },
      message: "DataChart donut data[1].value must not be negative.",
    },
    {
      name: "a zero donut total",
      props: {
        data: [
          { label: "One", value: 0 },
          { label: "Two", value: 0 },
        ],
        kind: "donut",
        label: "Empty donut",
      },
      message: "DataChart donut values must have a total greater than zero.",
    },
    {
      name: "an overflowing donut total",
      props: {
        data: [
          { label: "One", value: Number.MAX_VALUE },
          { label: "Two", value: Number.MAX_VALUE },
        ],
        kind: "donut",
        label: "Overflowing donut",
      },
      message: "DataChart donut values must have a finite total.",
    },
  ])("fails clearly for $name", ({ message, props }) => {
    expect(() => renderChart(props as Parameters<typeof DataChart>[0])).toThrow(message);
  });
});

describe("AnimatedNumber", () => {
  it("reserves width for the range while exposing one final accessible value", () => {
    const markup = renderNumber("audience", {
      decimals: 1,
      from: 8,
      label: "Audience agreement",
      value: 96.4,
      valuePrefix: "~",
      valueSuffix: "%",
    });

    expect(markup).toContain('data-drever-animated-number=""');
    expect(markup).toContain('data-render-mode="audience"');
    expect(markup).toContain("--drever-animated-number-characters:6");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain(">~8.0%</span>");
    expect(markup).toContain("Audience agreement: ~96.4%");
    expect(markup.match(/Audience agreement: ~96\.4%/g)).toHaveLength(1);
  });

  it.each<DreverRenderMode>(["document", "export", "speaker-current", "speaker-next"])(
    "renders the final stable value on %s",
    (mode) => {
      const markup = renderNumber(mode, {
        from: 10,
        label: "Total",
        value: 42,
        valuePrefix: "$",
      });

      expect(markup).toContain(`data-render-mode="${mode}"`);
      expect(markup).toContain(">$42</span>");
      expect(markup).not.toContain(">$10</span>");
      expect(markup).toContain("Total: $42");
    },
  );

  it("permits animation only for an active, motion-enabled audience surface", () => {
    expect(
      shouldAnimateNumber({
        ownerActive: true,
        reducedMotion: false,
        renderMode: "audience",
      }),
    ).toBe(true);
    expect(
      shouldAnimateNumber({
        ownerActive: false,
        reducedMotion: false,
        renderMode: "audience",
      }),
    ).toBe(false);
    expect(
      shouldAnimateNumber({
        ownerActive: true,
        reducedMotion: true,
        renderMode: "audience",
      }),
    ).toBe(false);
    expect(
      shouldAnimateNumber({
        ownerActive: true,
        reducedMotion: false,
        renderMode: "speaker-current",
      }),
    ).toBe(false);
  });

  it("reads active state from the owning Slide", () => {
    const outsideSlide = { closest: () => null } as unknown as Element;
    const activeSlide = {
      closest: () => ({ getAttribute: () => "active" }),
    } as unknown as Element;
    const inactiveSlide = {
      closest: () => ({ getAttribute: () => "inactive" }),
    } as unknown as Element;

    expect(isAnimatedNumberOwnerActive(outsideSlide)).toBe(true);
    expect(isAnimatedNumberOwnerActive(activeSlide)).toBe(true);
    expect(isAnimatedNumberOwnerActive(inactiveSlide)).toBe(false);
  });

  it("honors both Drever's explicit motion policy and the browser preference", () => {
    const defaultMotion = {
      closest: () => null,
    } as unknown as Element;
    const reducedMotion = {
      closest: (selector: string) => (selector === "[data-drever-reduced-motion]" ? {} : null),
    } as unknown as Element;

    expect(isAnimatedNumberReducedMotion(defaultMotion, false)).toBe(false);
    expect(isAnimatedNumberReducedMotion(defaultMotion, true)).toBe(true);
    expect(isAnimatedNumberReducedMotion(reducedMotion, false)).toBe(true);
  });

  it("interpolates with requestAnimationFrame and cancels the outstanding frame", () => {
    const callbacks: FrameRequestCallback[] = [];
    const values: number[] = [];
    const cancelFrame = vi.fn();
    let frameId = 0;
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      frameId += 1;
      return frameId;
    });
    const cancel = startNumberAnimation({
      cancelFrame,
      duration: 1_000,
      from: 0,
      onValue: (value) => values.push(value),
      requestFrame,
      to: 100,
    });

    callbacks.shift()?.(0);
    callbacks.shift()?.(500);
    callbacks.shift()?.(1_000);

    expect(values).toEqual([0, 87.5, 100]);
    expect(requestFrame).toHaveBeenCalledTimes(3);
    cancel();
    expect(cancelFrame).not.toHaveBeenCalled();

    const cancelPending = startNumberAnimation({
      cancelFrame,
      duration: 1_000,
      from: 100,
      onValue: vi.fn(),
      requestFrame,
      to: 0,
    });
    cancelPending();
    expect(cancelFrame).toHaveBeenCalledExactlyOnceWith(4);
  });

  it.each([
    {
      expected: 'AnimatedNumber: "label" must be a non-empty string.',
      props: { label: " ", value: 1 },
    },
    {
      expected: 'AnimatedNumber: "value" must be a finite number.',
      props: { label: "Value", value: Number.NaN },
    },
    {
      expected: 'AnimatedNumber: "from" must be a finite number.',
      props: { from: Number.POSITIVE_INFINITY, label: "Value", value: 1 },
    },
    {
      expected: 'AnimatedNumber: "duration" must be a positive number of milliseconds.',
      props: { duration: 0, label: "Value", value: 1 },
    },
    {
      expected: 'AnimatedNumber: "decimals" must be a whole number between 0 and 6.',
      props: { decimals: 7, label: "Value", value: 1 },
    },
  ])("fails invalid authored values with a precise error", ({ expected, props }) => {
    expect(() => renderNumber("audience", props)).toThrow(expected);
  });
});
