/// <reference lib="dom" />

import type { SourceRange } from "@drever/schema";

export type RenderedMotionSource = Readonly<{
  precision: "ancestor" | "exact";
  range: SourceRange;
}>;

export type RenderedPostTransitionEntrance = Readonly<{
  animation: Readonly<{
    activeStartMilliseconds: number;
    delayMilliseconds: number;
    documentFinishMilliseconds: number;
    durationMilliseconds: number;
    entranceProperties: readonly string[];
    fill: string;
    name: string;
  }>;
  direction: "forward" | "reverse";
  element: Readonly<{
    key: string;
    label: string;
    source?: RenderedMotionSource;
    tag: string;
  }>;
  from: Readonly<{ route: string; slideIndex: number; step: number }>;
  sampledAtMilliseconds: number;
  slideId: string;
  to: Readonly<{ route: string; slideIndex: number; step: number }>;
}>;

export type RenderedMotionEdge = Readonly<{
  direction: "forward" | "reverse";
  from: Readonly<{ route: string; slideIndex: number; step: number }>;
  sampledAtMilliseconds: number;
  slideId: string;
  to: Readonly<{ route: string; slideIndex: number; step: number }>;
}>;

/**
 * This function is serialized into Chromium by Playwright. Keep helpers inside
 * its body and return JSON-safe evidence only.
 */
export const captureRenderedPostTransitionEntrances = (
  edge: RenderedMotionEdge,
): readonly RenderedPostTransitionEntrance[] => {
  const round = (value: number): number => Math.round(value * 10) / 10;
  const number = (value: unknown): number | undefined => {
    const resolved = Number(value);
    return Number.isFinite(resolved) ? resolved : undefined;
  };
  const effectPseudo = (effect: AnimationEffect): string | undefined => {
    const value = Reflect.get(effect, "pseudoElement");
    return typeof value === "string" ? value : undefined;
  };
  const animationEnd = (animation: Animation): number | undefined => {
    const effect = animation.effect;
    const start = number(animation.startTime);
    const rate = animation.playbackRate;
    const end = effect === null ? undefined : number(effect.getComputedTiming().endTime);
    if (start === undefined || end === undefined || !Number.isFinite(rate) || rate <= 0) return;
    return start + end / rate;
  };
  const nativeFinish = Math.max(
    ...document
      .getAnimations()
      .filter((animation) => {
        const effect = animation.effect;
        const pseudo = effect === null ? undefined : effectPseudo(effect);
        return pseudo?.startsWith("::view-transition-") === true;
      })
      .flatMap((animation) => {
        const end = animationEnd(animation);
        return end === undefined ? [] : [end];
      }),
  );
  if (!Number.isFinite(nativeFinish)) return [];

  const activeSlide = document.querySelector<HTMLElement>(
    '[data-drever-slide][data-slide-state="active"]',
  );
  if (activeSlide === null) return [];

  const sourceFor = (element: Element): RenderedMotionSource | undefined => {
    const owner = element.closest<HTMLElement>("[data-drever-dev-source-range]");
    const encoded = owner?.getAttribute("data-drever-dev-source-range");
    const path = owner?.getAttribute("data-drever-dev-source-path");
    if (encoded === undefined || encoded === null || path === undefined || path === null) return;
    const values = encoded.split(":").map(Number);
    if (values.length !== 6 || !values.every(Number.isSafeInteger)) return;
    return {
      precision: owner === element ? "exact" : "ancestor",
      range: {
        path,
        start: {
          column: values[1] as number,
          line: values[0] as number,
          offset: values[2] as number,
        },
        end: {
          column: values[4] as number,
          line: values[3] as number,
          offset: values[5] as number,
        },
      },
    };
  };
  const pathFor = (element: Element): string => {
    const segments: string[] = [];
    let current: Element | null = element;
    while (current !== activeSlide && current?.parentElement !== null) {
      const parent: Element = current.parentElement;
      segments.push(`${current.localName}:${String([...parent.children].indexOf(current))}`);
      current = parent;
    }
    return segments.reverse().join("/");
  };
  const labelFor = (element: Element): string =>
    (
      element.getAttribute("aria-label") ??
      element.getAttribute("alt") ??
      element.textContent ??
      element.localName
    )
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, 160) || element.localName;
  const visibleBeforeActiveInterval = (element: Element): boolean => {
    if (
      element.closest('[aria-hidden="true"],[inert],[data-drever-visual-role="decoration"]') !==
        null ||
      element.getClientRects().length === 0
    ) {
      return false;
    }
    let opacity = 1;
    let current: Element | null = element;
    while (current !== null) {
      const style = getComputedStyle(current);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse"
      ) {
        return false;
      }
      opacity *= Number.parseFloat(style.opacity);
      if (current === activeSlide) break;
      current = current.parentElement;
    }
    return opacity > 0.01;
  };
  const frameValue = (
    frame: ComputedKeyframe | undefined,
    property: string,
  ): string | undefined => {
    const value = frame === undefined ? undefined : Reflect.get(frame, property);
    if (typeof value === "number") return String(value);
    return typeof value === "string" && value.length > 0 ? value : undefined;
  };
  const matrix = (value: string): DOMMatrixReadOnly | undefined => {
    try {
      return new DOMMatrixReadOnly(value === "none" ? undefined : value);
    } catch {
      return;
    }
  };
  const entranceProperties = (effect: KeyframeEffect, target: Element): readonly string[] => {
    const frames = effect.getKeyframes();
    const first = frames[0];
    if (first === undefined) return [];
    const style = getComputedStyle(target);
    const properties: string[] = [];
    const firstOpacity = number(frameValue(first, "opacity"));
    const finalOpacity = Number.parseFloat(style.opacity);
    if (
      firstOpacity !== undefined &&
      Number.isFinite(finalOpacity) &&
      finalOpacity - firstOpacity >= 0.1
    ) {
      properties.push("opacity");
    }

    const firstTranslate = frameValue(first, "translate");
    if (
      firstTranslate !== undefined &&
      firstTranslate !== "none" &&
      firstTranslate !== "0px" &&
      firstTranslate !== "0px 0px" &&
      (style.translate === "none" || style.translate === "0px" || style.translate === "0px 0px")
    ) {
      properties.push("translate");
    }
    const firstScale = frameValue(first, "scale");
    if (
      firstScale !== undefined &&
      firstScale !== "none" &&
      firstScale !== "1" &&
      firstScale !== "1 1" &&
      (style.scale === "none" || style.scale === "1" || style.scale === "1 1")
    ) {
      properties.push("scale");
    }

    const firstTransform = frameValue(first, "transform");
    if (firstTransform !== undefined) {
      const from = matrix(firstTransform);
      const to = matrix(style.transform);
      if (from !== undefined && to !== undefined) {
        const translation = Math.hypot(from.e - to.e, from.f - to.f);
        const fromScaleX = Math.hypot(from.a, from.b);
        const fromScaleY = Math.hypot(from.c, from.d);
        const toScaleX = Math.hypot(to.a, to.b);
        const toScaleY = Math.hypot(to.c, to.d);
        if (
          translation > 2 ||
          Math.abs(fromScaleX - toScaleX) > 0.02 ||
          Math.abs(fromScaleY - toScaleY) > 0.02
        ) {
          properties.push("transform");
        }
      }
    }
    const firstClip = frameValue(first, "clipPath");
    if (firstClip !== undefined && firstClip !== "none" && style.clipPath === "none") {
      properties.push("clip-path");
    }
    return properties;
  };

  const findings: RenderedPostTransitionEntrance[] = [];
  for (const animation of document.getAnimations()) {
    const effect = animation.effect;
    if (!(effect instanceof KeyframeEffect) || effectPseudo(effect) !== undefined) continue;
    const target = effect.target;
    if (!(target instanceof Element) || !activeSlide.contains(target)) continue;
    const timing = effect.getTiming();
    const delay = number(timing.delay);
    const duration = number(timing.duration);
    const iterations = number(timing.iterations);
    const start = number(animation.startTime);
    const current = number(animation.currentTime);
    const rate = animation.playbackRate;
    if (
      delay === undefined ||
      duration === undefined ||
      iterations === undefined ||
      start === undefined ||
      current === undefined ||
      delay <= 0 ||
      duration <= 0 ||
      !Number.isFinite(iterations) ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      current >= delay ||
      animation.playState === "finished" ||
      animation.playState === "paused" ||
      timing.fill === "backwards" ||
      timing.fill === "both" ||
      !visibleBeforeActiveInterval(target)
    ) {
      continue;
    }
    const activeStart = start + delay / rate;
    if (activeStart < nativeFinish - 1) continue;
    const properties = entranceProperties(effect, target);
    if (properties.length === 0) continue;
    const source = sourceFor(target);
    const animationName = Reflect.get(animation, "animationName");
    findings.push({
      animation: {
        activeStartMilliseconds: round(activeStart),
        delayMilliseconds: round(delay),
        documentFinishMilliseconds: round(nativeFinish),
        durationMilliseconds: round(duration),
        entranceProperties: properties,
        fill: timing.fill ?? "none",
        name:
          typeof animationName === "string" && animationName.length > 0
            ? animationName
            : animation.id || animation.constructor.name,
      },
      direction: edge.direction,
      element: {
        key: pathFor(target),
        label: labelFor(target),
        ...(source === undefined ? {} : { source }),
        tag: target.localName,
      },
      from: edge.from,
      sampledAtMilliseconds: edge.sampledAtMilliseconds,
      slideId: edge.slideId,
      to: edge.to,
    });
  }
  return findings;
};
