import { useDreverRenderMode } from "drever";
import { useEffect, useRef, useState, type ReactElement } from "react";

const REVEAL_DELAY_MS = 180;

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
  const revealFrame = useRef<number>(undefined);
  const revealTimer = useRef<number>(undefined);

  useEffect(() => {
    setReady(false);
    return () => {
      if (revealFrame.current !== undefined) cancelAnimationFrame(revealFrame.current);
      if (revealTimer.current !== undefined) window.clearTimeout(revealTimer.current);
    };
  }, [live, src]);

  const revealScene = (): void => {
    revealFrame.current = requestAnimationFrame(() => {
      revealFrame.current = requestAnimationFrame(() => {
        revealTimer.current = window.setTimeout(() => setReady(true), REVEAL_DELAY_MS);
      });
    });
  };

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
          onLoad={revealScene}
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
