import { useId, type ReactElement } from "react";

export type DataChartKind = "bar" | "line";

export type DataChartDatum = Readonly<{
  label: string;
  value: number;
}>;

export type DataChartProps = Readonly<{
  data: readonly DataChartDatum[];
  kind?: DataChartKind;
  label: string;
  valueSuffix?: string;
}>;

type Point = Readonly<{
  datum: DataChartDatum;
  x: number;
  y: number;
}>;

const WIDTH = 800;
const HEIGHT = 420;
const PLOT_LEFT = 50;
const PLOT_RIGHT = 776;
const PLOT_TOP = 32;
const PLOT_BOTTOM = 340;
const LABEL_Y = 388;
const MAX_POINTS = 12;

const coordinate = (value: number): number => Number(value.toFixed(3));

const assertChartProps = ({
  data,
  kind,
  label,
  valueSuffix,
}: Required<Pick<DataChartProps, "data" | "kind" | "label">> &
  Readonly<{ valueSuffix: string | undefined }>): void => {
  if (typeof label !== "string" || label.trim().length === 0) {
    throw new TypeError("DataChart label must be a non-empty string.");
  }
  if (kind !== "bar" && kind !== "line") {
    throw new TypeError('DataChart kind must be either "bar" or "line".');
  }
  if (!Array.isArray(data) || data.length === 0 || data.length > MAX_POINTS) {
    throw new RangeError(`DataChart data must contain between 1 and ${MAX_POINTS} points.`);
  }
  if (valueSuffix !== undefined && typeof valueSuffix !== "string") {
    throw new TypeError("DataChart valueSuffix must be a string.");
  }

  data.forEach((datum, index) => {
    if (typeof datum?.label !== "string" || datum.label.trim().length === 0) {
      throw new TypeError(`DataChart data[${index}].label must be a non-empty string.`);
    }
    if (typeof datum.value !== "number" || !Number.isFinite(datum.value)) {
      throw new TypeError(`DataChart data[${index}].value must be a finite number.`);
    }
  });
};

const valueLabel = (value: number, suffix = ""): string => `${String(value)}${suffix}`;

const chartDescription = (data: readonly DataChartDatum[], suffix: string | undefined): string =>
  `${data.length} ${data.length === 1 ? "point" : "points"}. ${data
    .map(({ label, value }) => `${label}: ${valueLabel(value, suffix)}`)
    .join("; ")}.`;

const geometry = (
  data: readonly DataChartDatum[],
): Readonly<{ baseline: number; points: readonly Point[] }> => {
  const values = data.map(({ value }) => value);
  const magnitude = Math.max(...values.map((value) => Math.abs(value)));
  const normalizedValues = values.map((value) => value / (magnitude || 1));
  const domainMin = Math.min(0, ...normalizedValues);
  const maximum = Math.max(0, ...normalizedValues);
  const domainMax = domainMin === 0 && maximum === 0 ? 1 : maximum;
  const span = domainMax - domainMin;
  const y = (value: number): number =>
    coordinate(PLOT_TOP + ((domainMax - value) / span) * (PLOT_BOTTOM - PLOT_TOP));
  const band = (PLOT_RIGHT - PLOT_LEFT) / data.length;

  return {
    baseline: y(0),
    points: data.map((datum, index) => ({
      datum,
      x: coordinate(PLOT_LEFT + band * (index + 0.5)),
      y: y(normalizedValues[index] ?? 0),
    })),
  };
};

const Grid = (): ReactElement => (
  <g data-chart-grid="">
    {[0.25, 0.5, 0.75].map((position) => {
      const y = coordinate(PLOT_TOP + (PLOT_BOTTOM - PLOT_TOP) * position);
      return <line key={position} x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y} y2={y} />;
    })}
  </g>
);

const AxisLabels = ({ points }: Readonly<{ points: readonly Point[] }>): ReactElement => (
  <g data-chart-labels="">
    {points.map(({ datum, x }, index) => (
      <text key={`${datum.label}-${index}`} textAnchor="middle" x={x} y={LABEL_Y}>
        {datum.label}
      </text>
    ))}
  </g>
);

const BarMarks = ({
  baseline,
  points,
  valueSuffix,
}: Readonly<{
  baseline: number;
  points: readonly Point[];
  valueSuffix: string | undefined;
}>): ReactElement => {
  const band = (PLOT_RIGHT - PLOT_LEFT) / points.length;
  const width = coordinate(band * 0.62);

  return (
    <g data-chart-bars="">
      {points.map(({ datum, x, y }, index) => {
        const top = Math.min(y, baseline);
        const height = Math.max(1, Math.abs(y - baseline));
        const valueY = datum.value >= 0 ? y - 11 : y + 23;
        return (
          <g
            data-chart-polarity={datum.value < 0 ? "negative" : "positive"}
            data-chart-value={datum.value}
            key={`${datum.label}-${index}`}
          >
            <rect
              height={coordinate(height)}
              rx="6"
              width={width}
              x={coordinate(x - width / 2)}
              y={coordinate(top)}
            />
            <text data-chart-value-label="" textAnchor="middle" x={x} y={coordinate(valueY)}>
              {valueLabel(datum.value, valueSuffix)}
            </text>
          </g>
        );
      })}
    </g>
  );
};

const LineMarks = ({
  points,
  valueSuffix,
}: Readonly<{
  points: readonly Point[];
  valueSuffix: string | undefined;
}>): ReactElement => (
  <g data-chart-line="">
    <path d={points.map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ")} />
    {points.map(({ datum, x, y }, index) => (
      <g data-chart-value={datum.value} key={`${datum.label}-${index}`}>
        <circle cx={x} cy={y} r="7" />
        <text data-chart-value-label="" textAnchor="middle" x={x} y={coordinate(y - 14)}>
          {valueLabel(datum.value, valueSuffix)}
        </text>
      </g>
    ))}
  </g>
);

/** A small theme-aware chart whose SVG and accessible description share the same data. */
export function DataChart({
  data,
  kind = "bar",
  label,
  valueSuffix,
}: DataChartProps): ReactElement {
  assertChartProps({ data, kind, label, valueSuffix });
  const titleId = useId();
  const descriptionId = useId();
  const { baseline, points } = geometry(data);

  return (
    <figure data-chart-kind={kind} data-drever-data-chart="">
      <svg
        aria-labelledby={`${titleId} ${descriptionId}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <title id={titleId}>{label}</title>
        <desc id={descriptionId}>{chartDescription(data, valueSuffix)}</desc>
        <Grid />
        <line data-chart-baseline="" x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={baseline} y2={baseline} />
        {kind === "bar" ? (
          <BarMarks baseline={baseline} points={points} valueSuffix={valueSuffix} />
        ) : (
          <LineMarks points={points} valueSuffix={valueSuffix} />
        )}
        <AxisLabels points={points} />
      </svg>
    </figure>
  );
}
