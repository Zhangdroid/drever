import type { ComponentPropsWithoutRef, CSSProperties, ReactElement } from "react";

export type AmbientStageState = "focus" | "gather" | "quiet" | "resolve";

export type AmbientStageProps = Omit<ComponentPropsWithoutRef<"div">, "aria-hidden"> &
  Readonly<{
    accent?: string;
    accentAlt?: string;
    energy?: number;
    reducedMotion?: boolean;
    state?: AmbientStageState;
  }>;

/** A persistent, decorative field whose smallest parts can move between story states. */
export function AmbientStage({
  accent,
  accentAlt,
  className,
  energy = 0.36,
  reducedMotion = false,
  state = "quiet",
  style,
  ...props
}: AmbientStageProps): ReactElement {
  const sceneStyle = {
    ...style,
    "--drever-scene-accent": accent,
    "--drever-scene-accent-alt": accentAlt,
    "--drever-scene-energy": Math.min(1, Math.max(0, energy)),
  } as CSSProperties;

  return (
    <div
      {...props}
      aria-hidden="true"
      className={["drever-ambient-stage", className].filter(Boolean).join(" ")}
      data-reduced-motion={reducedMotion ? "" : undefined}
      data-state={state}
      inert
      style={sceneStyle}
    >
      <span data-orbit="near" />
      <span data-orbit="far" />
      <i data-signal="primary" />
      <i data-signal="secondary" />
    </div>
  );
}
