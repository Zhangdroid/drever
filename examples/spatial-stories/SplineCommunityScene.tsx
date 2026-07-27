import { useDreverRenderMode } from "drever";
import { useEffect, useState, type ReactElement } from "react";

export type SplineCommunitySceneProps = Readonly<{
  className?: string;
  description: string;
  reducedMotion: boolean;
  src: string;
}>;

/** Uses a public Spline preview only in the live audience surface. */
export function SplineCommunityScene({
  className,
  description,
  reducedMotion,
  src,
}: SplineCommunitySceneProps): ReactElement {
  const renderMode = useDreverRenderMode();
  const live = renderMode === "audience" && !reducedMotion;
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(false), [live, src]);

  return (
    <figure
      aria-label={description}
      className={["spline-scene", className].filter(Boolean).join(" ")}
      data-phase={live && ready ? "ready" : "poster"}
      data-variant="ambient"
      role="img"
    >
      <div aria-hidden="true" className="spline-scene__poster">
        <div className="spline-poster spline-poster--ambient">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
      {live ? (
        <iframe
          aria-hidden="true"
          className="spline-scene__frame"
          loading="eager"
          onLoad={() => setReady(true)}
          referrerPolicy="no-referrer"
          sandbox="allow-same-origin allow-scripts"
          src={src}
          tabIndex={-1}
          title="Particle Nebula by Spline Community"
        />
      ) : null}
    </figure>
  );
}
