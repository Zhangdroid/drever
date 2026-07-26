import { useDreverRenderMode } from "@drever/core";
import { useEffect, useRef, useState, type ReactElement, type RefObject } from "react";

const SPLINE_VIEWER_VERSION = "1.12.98";
const SPLINE_VIEWER_RUNTIME = `https://unpkg.com/@splinetool/viewer@${SPLINE_VIEWER_VERSION}/build/spline-viewer.js`;
const RUNTIME_ATTRIBUTE = "data-drever-spline-runtime";

type ScenePhase = "error" | "loading" | "poster" | "ready";
type SplinePoster = "cloner" | "orbit";

let runtimePromise: Promise<void> | undefined;

const loadSplineViewer = (): Promise<void> => {
  if (customElements.get("spline-viewer") !== undefined) return Promise.resolve();
  if (runtimePromise !== undefined) return runtimePromise;

  runtimePromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[${RUNTIME_ATTRIBUTE}="${SPLINE_VIEWER_VERSION}"]`,
    );
    existing?.remove();

    const script = document.createElement("script");
    script.type = "module";
    script.src = SPLINE_VIEWER_RUNTIME;
    script.setAttribute(RUNTIME_ATTRIBUTE, SPLINE_VIEWER_VERSION);
    script.addEventListener(
      "error",
      () => {
        script.remove();
        reject(new Error("The Spline Viewer runtime could not be loaded."));
      },
      { once: true },
    );
    script.addEventListener(
      "load",
      () => {
        if (customElements.get("spline-viewer") === undefined) {
          script.remove();
          reject(new Error("The Spline Viewer runtime did not register its custom element."));
          return;
        }
        resolve();
      },
      { once: true },
    );
    document.head.append(script);
  }).catch((error: unknown) => {
    runtimePromise = undefined;
    throw error;
  });

  return runtimePromise;
};

const useReducedMotion = (authoredPreference?: boolean): boolean => {
  const [preference, setPreference] = useState<"allow" | "checking" | "reduce">(
    authoredPreference === undefined ? "checking" : authoredPreference ? "reduce" : "allow",
  );

  useEffect(() => {
    if (authoredPreference !== undefined) {
      setPreference(authoredPreference ? "reduce" : "allow");
      return;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const synchronize = (): void => setPreference(media.matches ? "reduce" : "allow");
    media.addEventListener("change", synchronize);
    synchronize();
    return () => media.removeEventListener("change", synchronize);
  }, [authoredPreference]);

  return preference !== "allow";
};

const useOwnerActive = (
  rootRef: RefObject<HTMLElement | null>,
  authoredActive?: boolean,
): boolean => {
  const [active, setActive] = useState(authoredActive ?? false);

  useEffect(() => {
    if (authoredActive !== undefined) {
      setActive(authoredActive);
      return;
    }

    const root = rootRef.current;
    if (root === null) return;
    const slide = root.closest<HTMLElement>("[data-drever-slide]");
    const synchronize = (): void =>
      setActive(slide === null || slide.getAttribute("data-slide-state") === "active");
    if (slide === null) {
      synchronize();
      return;
    }

    const observer = new MutationObserver(synchronize);
    observer.observe(slide, {
      attributeFilter: ["data-slide-state", "hidden"],
      attributes: true,
    });
    synchronize();
    return () => observer.disconnect();
  }, [authoredActive, rootRef]);

  return active;
};

export type SplineSceneProps = Readonly<{
  active?: boolean;
  background: string;
  className?: string;
  description: string;
  eventsTarget?: "global" | "local";
  hint?: boolean;
  label: string;
  poster: SplinePoster;
  reducedMotion?: boolean;
  scene: string;
  sourceHref?: string;
}>;

/** Loads a remote official Spline example only for the active audience surface. */
export function SplineScene({
  active: authoredActive,
  background,
  className,
  description,
  eventsTarget,
  hint = false,
  label,
  poster,
  reducedMotion: authoredReducedMotion,
  scene,
  sourceHref,
}: SplineSceneProps): ReactElement {
  const renderMode = useDreverRenderMode();
  const rootRef = useRef<HTMLElement>(null);
  const viewerHostRef = useRef<HTMLDivElement>(null);
  const active = useOwnerActive(rootRef, authoredActive);
  const reducedMotion = useReducedMotion(authoredReducedMotion);
  const [phase, setPhase] = useState<ScenePhase>("poster");
  const live = renderMode === "audience" && active && !reducedMotion;

  useEffect(() => {
    const host = viewerHostRef.current;
    if (host === null) return;
    host.replaceChildren();

    if (!live) {
      setPhase("poster");
      return;
    }

    let disposed = false;
    setPhase("loading");

    void loadSplineViewer()
      .then(() => {
        if (disposed) return;
        const viewer = document.createElement("spline-viewer");
        const handleLoad = (): void => {
          if (!disposed) setPhase("ready");
        };
        const handleContextLoss = (): void => {
          if (!disposed) setPhase("error");
        };

        viewer.setAttribute("aria-label", label);
        viewer.setAttribute("background", background);
        if (eventsTarget !== undefined) viewer.setAttribute("events-target", eventsTarget);
        viewer.setAttribute("loading", "eager");
        viewer.setAttribute("url", scene);
        if (hint) viewer.setAttribute("hint", "true");
        viewer.addEventListener("load-complete", handleLoad, { once: true });
        viewer.addEventListener("context-loss", handleContextLoss, { once: true });
        host.replaceChildren(viewer);
      })
      .catch(() => {
        if (!disposed) setPhase("error");
      });

    return () => {
      disposed = true;
      host.replaceChildren();
    };
  }, [background, eventsTarget, hint, label, live, scene]);

  return (
    <figure
      aria-label={description}
      className={["spline-scene", className].filter(Boolean).join(" ")}
      data-phase={phase}
      data-poster={poster}
      ref={rootRef}
    >
      <div aria-hidden="true" className="spline-scene__poster">
        {poster === "cloner" ? (
          <div className="spline-poster spline-poster--cloner">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        ) : (
          <div className="spline-poster spline-poster--orbit">
            <i />
            <i />
            <i />
            <i />
          </div>
        )}
      </div>
      <div
        aria-hidden={phase === "ready" ? undefined : true}
        className="spline-scene__viewer"
        ref={viewerHostRef}
      />
      {sourceHref === undefined ? null : (
        <figcaption className="spline-scene__caption">
          <span aria-live="polite">
            {renderMode !== "audience"
              ? "Interactive in Audience View"
              : phase === "error"
                ? "Live scene unavailable · poster shown"
                : phase === "loading"
                  ? "Loading live 3D"
                  : phase === "ready"
                    ? "Drag to orbit · scroll to zoom"
                    : "Poster shown"}
          </span>
          <a href={sourceHref} rel="noreferrer" target="_blank">
            Remix the scene <span aria-hidden="true">↗</span>
          </a>
        </figcaption>
      )}
    </figure>
  );
}
