import { useId, type ReactElement } from "react";

export type DataChartKind = "area" | "bar" | "donut" | "dot" | "line";

export type DataChartDatum = Readonly<{
  label: string;
  value: number;
}>;

export type DataChartProps = Readonly<{
  data: readonly DataChartDatum[];
  kind?: DataChartKind;
  label: string;
  valuePrefix?: string;
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
const DOT_LABEL_X = 174;
const DOT_PLOT_LEFT = 210;
const DOT_PLOT_RIGHT = 720;
const DOT_PLOT_TOP = 44;
const DOT_PLOT_BOTTOM = 360;
const DONUT_CENTER_X = 206;
const DONUT_CENTER_Y = 194;
const DONUT_RADIUS = 126;
const MAX_POINTS = 12;
const CHART_KINDS = new Set<DataChartKind>(["area", "bar", "donut", "dot", "line"]);

const coordinate = (value: number): number => Number(value.toFixed(3));

const assertChartProps = ({
  data,
  kind,
  label,
  valuePrefix,
  valueSuffix,
}: Required<Pick<DataChartProps, "data" | "kind" | "label">> &
  Readonly<{
    valuePrefix: string | undefined;
    valueSuffix: string | undefined;
  }>): void => {
  if (typeof label !== "string" || label.trim().length === 0) {
    throw new TypeError("DataChart label must be a non-empty string.");
  }
  if (!CHART_KINDS.has(kind)) {
    throw new TypeError('DataChart kind must be one of "bar", "line", "area", "dot", or "donut".');
  }
  if (!Array.isArray(data) || data.length === 0 || data.length > MAX_POINTS) {
    throw new RangeError(`DataChart data must contain between 1 and ${MAX_POINTS} points.`);
  }
  if (valuePrefix !== undefined && typeof valuePrefix !== "string") {
    throw new TypeError("DataChart valuePrefix must be a string.");
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
    if (kind === "donut" && datum.value < 0) {
      throw new RangeError(`DataChart donut data[${index}].value must not be negative.`);
    }
  });

  if (kind === "donut") {
    const total = data.reduce((sum, { value }) => sum + value, 0);
    if (!Number.isFinite(total)) {
      throw new RangeError("DataChart donut values must have a finite total.");
    }
    if (total <= 0) {
      throw new RangeError("DataChart donut values must have a total greater than zero.");
    }
  }
};

const valueLabel = (value: number, prefix = "", suffix = ""): string =>
  `${prefix}${String(value)}${suffix}`;

const chartDescription = (
  data: readonly DataChartDatum[],
  prefix: string | undefined,
  suffix: string | undefined,
): string =>
  `${data.length} ${data.length === 1 ? "point" : "points"}. ${data
    .map(({ label, value }) => `${label}: ${valueLabel(value, prefix, suffix)}`)
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

const dotGeometry = (
  data: readonly DataChartDatum[],
): Readonly<{ baseline: number; points: readonly Point[] }> => {
  const values = data.map(({ value }) => value);
  const magnitude = Math.max(...values.map((value) => Math.abs(value)));
  const normalizedValues = values.map((value) => value / (magnitude || 1));
  const domainMin = Math.min(0, ...normalizedValues);
  const maximum = Math.max(0, ...normalizedValues);
  const domainMax = domainMin === 0 && maximum === 0 ? 1 : maximum;
  const span = domainMax - domainMin;
  const x = (value: number): number =>
    coordinate(DOT_PLOT_LEFT + ((value - domainMin) / span) * (DOT_PLOT_RIGHT - DOT_PLOT_LEFT));
  const band = (DOT_PLOT_BOTTOM - DOT_PLOT_TOP) / data.length;

  return {
    baseline: x(0),
    points: data.map((datum, index) => ({
      datum,
      x: x(normalizedValues[index] ?? 0),
      y: coordinate(DOT_PLOT_TOP + band * (index + 0.5)),
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

type MarkProps = Readonly<{
  points: readonly Point[];
  valuePrefix: string | undefined;
  valueSuffix: string | undefined;
}>;

const BarMarks = ({
  baseline,
  points,
  valuePrefix,
  valueSuffix,
}: MarkProps & Readonly<{ baseline: number }>): ReactElement => {
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
              {valueLabel(datum.value, valuePrefix, valueSuffix)}
            </text>
          </g>
        );
      })}
    </g>
  );
};

const linePath = (points: readonly Point[]): string =>
  points.map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ");

const PointMarks = ({ points, valuePrefix, valueSuffix }: MarkProps): ReactElement => (
  <>
    {points.map(({ datum, x, y }, index) => (
      <g data-chart-value={datum.value} key={`${datum.label}-${index}`}>
        <circle cx={x} cy={y} r="7" />
        <text data-chart-value-label="" textAnchor="middle" x={x} y={coordinate(y - 14)}>
          {valueLabel(datum.value, valuePrefix, valueSuffix)}
        </text>
      </g>
    ))}
  </>
);

const LineMarks = (props: MarkProps): ReactElement => (
  <g data-chart-line="">
    <path d={linePath(props.points)} />
    <PointMarks {...props} />
  </g>
);

const AreaMarks = ({
  baseline,
  points,
  valuePrefix,
  valueSuffix,
}: MarkProps & Readonly<{ baseline: number }>): ReactElement => {
  const first = points[0] as Point;
  const last = points.at(-1) as Point;
  const fillPath = [
    `M${first.x} ${baseline}`,
    ...points.map(({ x, y }) => `L${x} ${y}`),
    `L${last.x} ${baseline}`,
    "Z",
  ].join(" ");

  return (
    <g data-chart-area="">
      <path d={fillPath} data-chart-area-fill="" />
      <path d={linePath(points)} data-chart-area-line="" />
      <PointMarks points={points} valuePrefix={valuePrefix} valueSuffix={valueSuffix} />
    </g>
  );
};

const DotMarks = ({
  baseline,
  points,
  valuePrefix,
  valueSuffix,
}: MarkProps & Readonly<{ baseline: number }>): ReactElement => (
  <g data-chart-dots="">
    <line
      data-chart-dot-baseline=""
      x1={baseline}
      x2={baseline}
      y1={DOT_PLOT_TOP}
      y2={DOT_PLOT_BOTTOM}
    />
    {points.map(({ datum, x, y }, index) => {
      return (
        <g
          data-chart-polarity={datum.value < 0 ? "negative" : "positive"}
          data-chart-value={datum.value}
          key={`${datum.label}-${index}`}
        >
          <text data-chart-dot-category="" textAnchor="end" x={DOT_LABEL_X} y={coordinate(y + 6)}>
            {datum.label}
          </text>
          <line data-chart-dot-stem="" x1={baseline} x2={x} y1={y} y2={y} />
          <circle cx={x} cy={y} r="8" />
          <text data-chart-value-label="" textAnchor="end" x="770" y={coordinate(y + 6)}>
            {valueLabel(datum.value, valuePrefix, valueSuffix)}
          </text>
        </g>
      );
    })}
  </g>
);

const DonutMarks = ({
  data,
  valuePrefix,
  valueSuffix,
}: Readonly<{
  data: readonly DataChartDatum[];
  valuePrefix: string | undefined;
  valueSuffix: string | undefined;
}>): ReactElement => {
  const total = data.reduce((sum, { value }) => sum + value, 0);
  let cumulativeValue = 0;

  return (
    <g data-chart-donut="">
      <circle cx={DONUT_CENTER_X} cy={DONUT_CENTER_Y} data-chart-donut-track="" r={DONUT_RADIUS} />
      <g data-chart-donut-segments="">
        {data.map((datum, index) => {
          const percentage = coordinate((datum.value / total) * 100);
          const dashOffset = coordinate(-(cumulativeValue / total) * 100);
          cumulativeValue += datum.value;
          return (
            <circle
              cx={DONUT_CENTER_X}
              cy={DONUT_CENTER_Y}
              data-chart-series-index={index + 1}
              data-chart-value={datum.value}
              key={`${datum.label}-${index}`}
              pathLength="100"
              r={DONUT_RADIUS}
              strokeDasharray={`${percentage} ${coordinate(100 - percentage)}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${DONUT_CENTER_X} ${DONUT_CENTER_Y})`}
            />
          );
        })}
      </g>
      <text data-chart-donut-total="" textAnchor="middle" x={DONUT_CENTER_X} y={DONUT_CENTER_Y}>
        {valueLabel(total, valuePrefix, valueSuffix)}
      </text>
      <text
        data-chart-donut-total-caption=""
        textAnchor="middle"
        x={DONUT_CENTER_X}
        y={DONUT_CENTER_Y + 30}
      >
        total
      </text>
      <g data-chart-donut-legend="">
        {data.map((datum, index) => {
          const y =
            data.length === 1 ? DONUT_CENTER_Y : coordinate(54 + index * (312 / (data.length - 1)));
          return (
            <g
              data-chart-donut-legend-row=""
              data-chart-series-index={index + 1}
              key={`${datum.label}-${index}`}
            >
              <rect height="14" rx="3" width="14" x="430" y={coordinate(y - 11)} />
              <text data-chart-donut-label="" x="456" y={y}>
                {datum.label}
              </text>
              <text data-chart-value-label="" textAnchor="end" x="770" y={y}>
                {valueLabel(datum.value, valuePrefix, valueSuffix)}
              </text>
            </g>
          );
        })}
      </g>
    </g>
  );
};

const DotChart = ({
  data,
  valuePrefix,
  valueSuffix,
}: Readonly<{
  data: readonly DataChartDatum[];
  valuePrefix: string | undefined;
  valueSuffix: string | undefined;
}>): ReactElement => {
  const { baseline, points } = dotGeometry(data);
  return (
    <DotMarks
      baseline={baseline}
      points={points}
      valuePrefix={valuePrefix}
      valueSuffix={valueSuffix}
    />
  );
};

const CartesianChart = ({
  data,
  kind,
  valuePrefix,
  valueSuffix,
}: Readonly<{
  data: readonly DataChartDatum[];
  kind: "area" | "bar" | "line";
  valuePrefix: string | undefined;
  valueSuffix: string | undefined;
}>): ReactElement => {
  const { baseline, points } = geometry(data);
  const marks =
    kind === "bar" ? (
      <BarMarks
        baseline={baseline}
        points={points}
        valuePrefix={valuePrefix}
        valueSuffix={valueSuffix}
      />
    ) : kind === "area" ? (
      <AreaMarks
        baseline={baseline}
        points={points}
        valuePrefix={valuePrefix}
        valueSuffix={valueSuffix}
      />
    ) : (
      <LineMarks points={points} valuePrefix={valuePrefix} valueSuffix={valueSuffix} />
    );

  return (
    <>
      <Grid />
      <line data-chart-baseline="" x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={baseline} y2={baseline} />
      {marks}
      <AxisLabels points={points} />
    </>
  );
};

/** A small theme-aware chart whose SVG and accessible description share the same data. */
export function DataChart({
  data,
  kind = "bar",
  label,
  valuePrefix,
  valueSuffix,
}: DataChartProps): ReactElement {
  assertChartProps({ data, kind, label, valuePrefix, valueSuffix });
  const titleId = useId();
  const descriptionId = useId();

  return (
    <figure data-chart-kind={kind} data-drever-data-chart="">
      <svg
        aria-labelledby={`${titleId} ${descriptionId}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <title id={titleId}>{label}</title>
        <desc id={descriptionId}>{chartDescription(data, valuePrefix, valueSuffix)}</desc>
        {kind === "donut" ? (
          <DonutMarks data={data} valuePrefix={valuePrefix} valueSuffix={valueSuffix} />
        ) : kind === "dot" ? (
          <DotChart data={data} valuePrefix={valuePrefix} valueSuffix={valueSuffix} />
        ) : (
          <CartesianChart
            data={data}
            kind={kind}
            valuePrefix={valuePrefix}
            valueSuffix={valueSuffix}
          />
        )}
      </svg>
    </figure>
  );
}
