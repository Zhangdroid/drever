import { useDreverRenderMode, type DreverRenderMode } from "@drever/core";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";

export type AnimatedNumberProps = Readonly<{
  decimals?: number;
  duration?: number;
  from?: number;
  label: string;
  value: number;
  valuePrefix?: string;
  valueSuffix?: string;
}>;

type AnimationOptions = Readonly<{
  cancelFrame: (frame: number) => void;
  duration: number;
  from: number;
  onValue: (value: number) => void;
  requestFrame: (callback: FrameRequestCallback) => number;
  to: number;
}>;

type AnimatedNumberStyle = CSSProperties &
  Readonly<{
    "--drever-animated-number-characters": number;
  }>;

const invalid = (property: string, requirement: string): never => {
  throw new TypeError(`AnimatedNumber: "${property}" must be ${requirement}.`);
};

const finiteNumber = (property: string, value: unknown): number =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : invalid(property, "a finite number");

const optionalText = (property: string, value: unknown): string => {
  if (value === undefined) return "";
  return typeof value === "string" ? value : invalid(property, "a string");
};

const accessibleLabel = (value: unknown): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return invalid("label", "a non-empty string");
  }
  return value.trim();
};

const decimalPlaces = (value: unknown): number => {
  if (value === undefined) return 0;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 6) {
    return invalid("decimals", "a whole number between 0 and 6");
  }
  return value;
};

const animationDuration = (value: unknown): number => {
  if (value === undefined) return 1_200;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return invalid("duration", "a positive number of milliseconds");
  }
  return value;
};

const formattedNumber = (value: number, decimals: number): string => {
  const threshold = 0.5 * 10 ** -decimals;
  return (Math.abs(value) < threshold ? 0 : value).toFixed(decimals);
};

const displayedValue = (value: number, decimals: number, prefix: string, suffix: string): string =>
  `${prefix}${formattedNumber(value, decimals)}${suffix}`;

const easeOutCubic = (progress: number): number => 1 - (1 - progress) ** 3;

/** Runs one cancellable number interpolation against an injected animation clock. */
export const startNumberAnimation = ({
  cancelFrame,
  duration,
  from,
  onValue,
  requestFrame,
  to,
}: AnimationOptions): (() => void) => {
  let frame = 0;
  let startedAt: number | undefined;

  const draw = (timestamp: number): void => {
    startedAt ??= timestamp;
    const progress = Math.min(1, (timestamp - startedAt) / duration);
    onValue(from + (to - from) * easeOutCubic(progress));
    frame = progress < 1 ? requestFrame(draw) : 0;
  };

  frame = requestFrame(draw);
  return () => {
    if (frame !== 0) cancelFrame(frame);
  };
};

/** Treats a number outside a Slide as active while respecting its owning Slide when present. */
export const isAnimatedNumberOwnerActive = (root: Element): boolean => {
  const slide = root.closest("[data-drever-slide]");
  return slide === null || slide.getAttribute("data-slide-state") === "active";
};

/** Combines Drever's explicit motion policy with the browser preference. */
export const isAnimatedNumberReducedMotion = (root: Element, mediaQueryMatches: boolean): boolean =>
  root.closest("[data-drever-reduced-motion]") !== null || mediaQueryMatches;

/** Resolves the exact surface and motion conditions that permit interpolation. */
export const shouldAnimateNumber = ({
  ownerActive,
  reducedMotion,
  renderMode,
}: Readonly<{
  ownerActive: boolean;
  reducedMotion: boolean;
  renderMode: DreverRenderMode;
}>): boolean => renderMode === "audience" && ownerActive && !reducedMotion;

/**
 * A presentation-aware metric that animates only on an active audience slide and
 * stays deterministic on every static render surface.
 */
export function AnimatedNumber({
  decimals: authoredDecimals,
  duration: authoredDuration,
  from: authoredFrom = 0,
  label: authoredLabel,
  value: authoredValue,
  valuePrefix: authoredPrefix,
  valueSuffix: authoredSuffix,
}: AnimatedNumberProps): ReactElement {
  const decimals = decimalPlaces(authoredDecimals);
  const duration = animationDuration(authoredDuration);
  const from = finiteNumber("from", authoredFrom);
  const label = accessibleLabel(authoredLabel);
  const value = finiteNumber("value", authoredValue);
  const valuePrefix = optionalText("valuePrefix", authoredPrefix);
  const valueSuffix = optionalText("valueSuffix", authoredSuffix);
  const renderMode = useDreverRenderMode();
  const interactive = renderMode === "audience";
  const rootRef = useRef<HTMLElement>(null);
  const [current, setCurrent] = useState(interactive ? from : value);
  const finalText = displayedValue(value, decimals, valuePrefix, valueSuffix);
  const characterCount = Math.max(
    displayedValue(from, decimals, valuePrefix, valueSuffix).length,
    finalText.length,
  );

  useLayoutEffect(() => {
    if (!interactive) {
      setCurrent(value);
      return;
    }
    const root = rootRef.current;
    if (root === null) return;
    const slide = root.closest("[data-drever-slide]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cancelAnimation: (() => void) | undefined;

    const synchronize = (): void => {
      cancelAnimation?.();
      cancelAnimation = undefined;
      const ownerActive = isAnimatedNumberOwnerActive(root);
      const reducedMotionRequested = isAnimatedNumberReducedMotion(root, reducedMotion.matches);
      if (!ownerActive) return;
      if (
        !shouldAnimateNumber({
          ownerActive,
          reducedMotion: reducedMotionRequested,
          renderMode,
        }) ||
        from === value
      ) {
        setCurrent(value);
        return;
      }

      setCurrent(from);
      cancelAnimation = startNumberAnimation({
        cancelFrame: (frame) => window.cancelAnimationFrame(frame),
        duration,
        from,
        onValue: setCurrent,
        requestFrame: (callback) => window.requestAnimationFrame(callback),
        to: value,
      });
    };

    const observer = slide === null ? undefined : new MutationObserver(synchronize);
    if (slide !== null) {
      observer?.observe(slide, {
        attributeFilter: ["data-slide-state", "hidden"],
        attributes: true,
      });
    }
    reducedMotion.addEventListener("change", synchronize);
    synchronize();

    return () => {
      observer?.disconnect();
      reducedMotion.removeEventListener("change", synchronize);
      cancelAnimation?.();
    };
  }, [duration, from, interactive, renderMode, value]);

  const style: AnimatedNumberStyle = {
    "--drever-animated-number-characters": characterCount,
  };

  return (
    <figure
      data-drever-animated-number=""
      data-render-mode={renderMode}
      ref={rootRef}
      style={style}
    >
      <span aria-hidden="true" className="drever-animated-number__value">
        {displayedValue(current, decimals, valuePrefix, valueSuffix)}
      </span>
      <figcaption aria-hidden="true" className="drever-animated-number__label">
        {label}
      </figcaption>
      <span className="drever-animated-number__accessible">
        {label}: {finalText}
      </span>
    </figure>
  );
}
