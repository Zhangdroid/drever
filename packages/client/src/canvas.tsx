import type { CanvasDefinition } from "@drever/schema";
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PropsWithChildren,
  type Ref,
  type ReactElement,
} from "react";
import { DreverClientError } from "./client-error.ts";

export const DEFAULT_CANVAS = Object.freeze({
  width: 1920,
  height: 1080,
}) satisfies CanvasDefinition;

export type ViewportSize = Readonly<{
  width: number;
  height: number;
}>;

export const computeCanvasScale = (
  canvas: CanvasDefinition,
  viewport: ViewportSize,
  padding = 0,
): number => {
  if (
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    !Number.isFinite(padding) ||
    padding < 0
  ) {
    return 0;
  }
  const availableWidth = Math.max(0, viewport.width - padding * 2);
  const availableHeight = Math.max(0, viewport.height - padding * 2);
  if (
    availableWidth === 0 ||
    availableHeight === 0 ||
    !Number.isFinite(canvas.width) ||
    !Number.isFinite(canvas.height) ||
    canvas.width <= 0 ||
    canvas.height <= 0
  ) {
    return 0;
  }

  return Math.min(availableWidth / canvas.width, availableHeight / canvas.height);
};

type CanvasStyle = CSSProperties &
  Readonly<{
    "--drever-canvas-height": number;
    "--drever-canvas-scale": number;
    "--drever-canvas-width": number;
  }>;

export type CanvasViewportProps = PropsWithChildren<
  Readonly<{
    canvas?: CanvasDefinition;
    canvasRef?: Ref<HTMLDivElement>;
    padding?: number;
  }>
>;

export const CanvasViewport = ({
  canvas = DEFAULT_CANVAS,
  canvasRef,
  children,
  padding = 0,
}: CanvasViewportProps): ReactElement => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }

    const update = (): void => {
      const bounds = viewport.getBoundingClientRect();
      setScale(computeCanvasScale(canvas, bounds, padding));
    };
    update();
    const Observer = viewport.ownerDocument.defaultView?.ResizeObserver;
    if (typeof Observer !== "function") {
      throw new DreverClientError(
        "DREVER_CLIENT_PLATFORM_UNSUPPORTED",
        "Drever requires ResizeObserver in the canvas document.",
        { details: { capability: "ResizeObserver" } },
      );
    }
    const observer = new Observer(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [canvas, padding]);

  const style: CanvasStyle = {
    "--drever-canvas-height": canvas.height,
    "--drever-canvas-scale": scale,
    "--drever-canvas-width": canvas.width,
  };

  return (
    <div className="drever-viewer" data-drever-viewer="" ref={viewportRef}>
      <div
        className="drever-canvas"
        data-drever-canvas=""
        data-scale={scale}
        ref={canvasRef}
        style={style}
      >
        {children}
      </div>
    </div>
  );
};
