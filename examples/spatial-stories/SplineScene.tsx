import type { Application as SplineApplication, SPEObject } from "@splinetool/runtime";
import { useDreverRenderMode } from "drever";
import { useEffect, useRef, useState, type ReactElement } from "react";

export type SplineSceneMode = "context" | "evidence" | "hidden" | "object" | "opening";
export type SplineSceneVariant = "cloner" | "object";

type ScenePhase = "error" | "loading" | "poster" | "ready";
type SceneObject = SPEObject & {
  parentUuid?: string;
  type?: string;
};
type Rotation = Readonly<{ x: number; y: number; z: number }>;
type RotationRecord = Readonly<{ base: Rotation; object: SceneObject }>;
type SplineRuntime = typeof import("@splinetool/runtime");
type ClonerSceneMode = Extract<SplineSceneMode, "context" | "evidence" | "opening">;

let runtimePromise: Promise<SplineRuntime> | undefined;

const ROTATION_DURATION_MS = 1050;
const SCENE_SETTLE_MS = 400;

const loadSplineRuntime = (): Promise<SplineRuntime> => {
  runtimePromise ??= import("@splinetool/runtime").catch((error: unknown) => {
    runtimePromise = undefined;
    throw error;
  });
  return runtimePromise;
};

const modeRotations: Record<ClonerSceneMode, Rotation> = {
  opening: { x: 0, y: 0, z: 0 },
  evidence: { x: -0.08, y: 0.34, z: 0.03 },
  context: { x: 0.12, y: 0.62, z: -0.05 },
};

const isClonerMode = (mode: SplineSceneMode): mode is ClonerSceneMode =>
  mode === "opening" || mode === "evidence" || mode === "context";
const easeOutQuint = (progress: number): number => 1 - (1 - progress) ** 5;
const mix = (from: number, to: number, progress: number): number => from + (to - from) * progress;
const readRotation = ({ x, y, z }: Rotation): Rotation => ({ x, y, z });

const selectSceneRoots = (objects: SceneObject[]): SceneObject[] => {
  const objectIds = new Set(objects.map(({ uuid }) => uuid));
  const roots = objects.filter(
    ({ parentUuid }) => parentUuid === undefined || !objectIds.has(parentUuid),
  );
  const visualRoots = roots.filter(
    ({ name, type }) => !/camera|light/i.test(`${name} ${type ?? ""}`),
  );
  return visualRoots.length > 0 ? visualRoots : roots;
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

export type SplineSceneProps = Readonly<{
  className?: string;
  description: string;
  label: string;
  mode: SplineSceneMode;
  reducedMotion?: boolean;
  scene: string;
  variant: SplineSceneVariant;
}>;

/** Keeps one Spline runtime mounted while the authored slide states reframe its 3D objects. */
export function SplineScene({
  className,
  description,
  label,
  mode,
  reducedMotion: authoredReducedMotion,
  scene,
  variant,
}: SplineSceneProps): ReactElement {
  const renderMode = useDreverRenderMode();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const applicationRef = useRef<SplineApplication>(null);
  const animationFrameRef = useRef<number>(undefined);
  const modeRef = useRef(mode);
  const rotationsRef = useRef<RotationRecord[]>([]);
  const reducedMotion = useReducedMotion(authoredReducedMotion);
  const [phase, setPhase] = useState<ScenePhase>("poster");
  const live = renderMode === "audience" && !reducedMotion && mode !== "hidden";

  const stopRotation = (): void => {
    if (animationFrameRef.current === undefined) return;
    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = undefined;
  };

  const rotateToMode = (nextMode: SplineSceneMode, immediate = false): void => {
    stopRotation();
    if (!isClonerMode(nextMode) || rotationsRef.current.length === 0) return;

    const offset = modeRotations[nextMode];
    const transitions = rotationsRef.current.map(({ base, object }) => ({
      from: readRotation(object.rotation),
      object,
      to: {
        x: base.x + offset.x,
        y: base.y + offset.y,
        z: base.z + offset.z,
      },
    }));

    const apply = (progress: number): void => {
      transitions.forEach(({ from, object, to }) => {
        object.rotation.x = mix(from.x, to.x, progress);
        object.rotation.y = mix(from.y, to.y, progress);
        object.rotation.z = mix(from.z, to.z, progress);
      });
    };

    if (immediate) {
      apply(1);
      return;
    }

    const startedAt = performance.now();
    const tick = (time: number): void => {
      const progress = Math.min((time - startedAt) / ROTATION_DURATION_MS, 1);
      apply(easeOutQuint(progress));
      if (progress < 1) animationFrameRef.current = requestAnimationFrame(tick);
      else animationFrameRef.current = undefined;
    };
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    modeRef.current = mode;
    const application = applicationRef.current;
    if (application !== null) {
      if (mode === "hidden") application.stop();
      else {
        application.play();
        rotateToMode(mode, reducedMotion);
      }
    }
  }, [mode, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    if (!live) {
      setPhase("poster");
      return;
    }

    let disposed = false;
    let application: SplineApplication | undefined;
    let initializationTimer: number | undefined;
    setPhase("loading");

    void loadSplineRuntime()
      .then(async ({ Application }) => {
        if (disposed) return;
        application = new Application(canvas, { renderMode: "auto" });
        applicationRef.current = application;
        await application.load(scene);
        if (disposed) return;
        application.setGlobalEvents(false);
        setPhase("ready");
        if (variant === "cloner") {
          const objects = application.getAllObjects() as SceneObject[];
          const roots = selectSceneRoots(objects);
          // Let authored Spline start actions materialize cloned geometry before rotating its roots.
          initializationTimer = window.setTimeout(() => {
            if (disposed) return;
            rotationsRef.current = roots.map((object) => ({
              base: readRotation(object.rotation),
              object,
            }));
            rotateToMode(modeRef.current, true);
          }, SCENE_SETTLE_MS);
        }
      })
      .catch(() => {
        if (!disposed) setPhase("error");
      });

    return () => {
      disposed = true;
      if (initializationTimer !== undefined) window.clearTimeout(initializationTimer);
      stopRotation();
      rotationsRef.current = [];
      applicationRef.current = null;
      application?.dispose();
    };
  }, [live, scene, variant]);

  return (
    <figure
      aria-label={description}
      className={["spline-scene", className].filter(Boolean).join(" ")}
      data-mode={mode}
      data-phase={phase}
      data-variant={variant}
      role="img"
    >
      <div aria-hidden="true" className="spline-scene__poster">
        <div className={`spline-poster spline-poster--${variant}`}>
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
      <canvas
        aria-hidden="true"
        data-label={label}
        className="spline-scene__canvas"
        ref={canvasRef}
      />
    </figure>
  );
}
