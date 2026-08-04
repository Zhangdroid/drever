/// <reference lib="dom" />

import type { SourceRange } from "@drever/schema";

export type RenderedCheckRect = Readonly<{
  height: number;
  width: number;
  x: number;
  y: number;
}>;

export type RenderedCheckSource = Readonly<{
  precision: "ancestor" | "exact";
  range: SourceRange;
}>;

export type RenderedCheckElement = Readonly<{
  fragments: readonly RenderedCheckRect[];
  key: string;
  label: string;
  layout: RenderedCheckRect | null;
  rect: RenderedCheckRect;
  source?: RenderedCheckSource;
  step?: number;
  tag: string;
}>;

export type RenderedCheckIssue =
  | Readonly<{
      actual: number;
      expected: 1;
      type: "active-slide-count";
    }>
  | Readonly<{
      element: RenderedCheckElement;
      evidence: "line-fragment" | "scroll-overflow";
      owner: Readonly<{ key: string; rect: RenderedCheckRect; tag: string }>;
      overflow?: Readonly<{ x: number; y: number }>;
      type: "content-clipped";
    }>
  | Readonly<{
      elements: readonly [RenderedCheckElement, RenderedCheckElement];
      intersection: RenderedCheckRect;
      type: "content-overlap";
    }>
  | Readonly<{
      actual: number;
      background: string;
      element: RenderedCheckElement;
      expected: number;
      fontSize: number;
      fontWeight: number;
      foreground: string;
      largeText: boolean;
      type: "text-contrast-low";
    }>
  | Readonly<{
      element: RenderedCheckElement;
      reason: string;
      type: "text-contrast-indeterminate";
    }>
  | Readonly<{
      element: RenderedCheckElement;
      type: "canvas-overflow";
    }>;

export type RenderedCheckFrame = Readonly<{
  density: Readonly<{
    characterCount: number;
    lineFragmentCount: number;
    semanticElementCount: number;
    textAreaRatio: number;
  }>;
  elements: readonly RenderedCheckElement[];
  issues: readonly RenderedCheckIssue[];
  route: string;
  slide: Readonly<{
    id: string;
    index: number;
    rect: RenderedCheckRect;
    step: number;
  }>;
}>;

/**
 * This function is serialized into Chromium by Playwright. Keep helpers inside
 * its body and return JSON-safe evidence only.
 */
export const captureRenderedCheckFrame = (route: string): RenderedCheckFrame => {
  const round = (value: number): number => Math.round(value * 10) / 10;
  const rectangle = (rect: DOMRect | DOMRectReadOnly): RenderedCheckRect => ({
    height: round(rect.height),
    width: round(rect.width),
    x: round(rect.x),
    y: round(rect.y),
  });
  const emptyRect = (): RenderedCheckRect => ({ height: 0, width: 0, x: 0, y: 0 });
  const activeSlides = [
    ...document.querySelectorAll<HTMLElement>('[data-drever-slide][data-slide-state="active"]'),
  ];
  if (activeSlides.length !== 1) {
    return {
      density: {
        characterCount: 0,
        lineFragmentCount: 0,
        semanticElementCount: 0,
        textAreaRatio: 0,
      },
      elements: [],
      issues: [{ actual: activeSlides.length, expected: 1, type: "active-slide-count" }],
      route,
      slide: { id: "", index: -1, rect: emptyRect(), step: 0 },
    };
  }

  const slide = activeSlides[0] as HTMLElement;
  const slideBounds = slide.getBoundingClientRect();
  const meaningfulSelector = [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "li",
    "a",
    "button",
    "img[alt]",
    "svg[aria-label]",
    "pre",
    "table",
    "th",
    "td",
    "[role='img']",
    "[aria-label]",
  ].join(",");
  const directText = (element: Element): string =>
    [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? "")
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim();
  const labelFor = (element: Element): string =>
    (element.getAttribute("alt") ?? element.getAttribute("aria-label") ?? directText(element) ?? "")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, 160) || element.localName;
  const pathFor = (element: Element): string => {
    const segments: string[] = [];
    let current: Element | null = element;
    while (current !== slide && current?.parentElement !== null) {
      const parent: Element = current.parentElement;
      segments.push(`${current.localName}:${[...parent.children].indexOf(current)}`);
      current = parent;
    }
    return segments.reverse().join("/");
  };
  const sourceFor = (element: Element): RenderedCheckSource | undefined => {
    const owner = element.closest<HTMLElement>("[data-drever-dev-source-range]");
    const encoded = owner?.getAttribute("data-drever-dev-source-range");
    const path = owner?.getAttribute("data-drever-dev-source-path");
    if (encoded === undefined || encoded === null || path === undefined || path === null) {
      return;
    }
    const values = encoded.split(":").map(Number);
    if (values.length !== 6 || !values.every(Number.isSafeInteger)) {
      return;
    }
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
  const keyFor = (element: Element, source: RenderedCheckSource | undefined): string =>
    source === undefined
      ? pathFor(element)
      : `${source.range.path}:${source.range.start.offset}:${source.range.end.offset}:${element.localName}:${pathFor(element)}`;
  const isVisible = (element: Element): boolean => {
    if (
      element.closest('[aria-hidden="true"],[inert]') !== null ||
      element.getClientRects().length === 0
    ) {
      return false;
    }
    let current: Element | null = element;
    while (current !== null) {
      const style = getComputedStyle(current);
      const bounds = current.getBoundingClientRect();
      const visuallyHidden =
        bounds.width <= 2 &&
        bounds.height <= 2 &&
        (style.overflow === "hidden" ||
          style.overflow === "clip" ||
          style.clip !== "auto" ||
          style.clipPath !== "none");
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse" ||
        Number.parseFloat(style.opacity) <= 0.01 ||
        visuallyHidden
      ) {
        return false;
      }
      if (current === slide) break;
      current = current.parentElement;
    }
    return true;
  };
  const textSelector = "p,li,a,button,h1,h2,h3,h4,h5,h6,pre,th,td";
  const fallbackTextOwners = new Set<Element>();
  const paintRectCache = new Map<Element, readonly DOMRect[]>();
  const paintRects = (element: Element): readonly DOMRect[] => {
    const cached = paintRectCache.get(element);
    if (cached !== undefined) return cached;
    const fragments: DOMRect[] = [];
    if (element.matches(textSelector) || fallbackTextOwners.has(element)) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (
          parent === null ||
          (fallbackTextOwners.has(element) && parent !== element) ||
          (node.textContent ?? "").trim().length === 0 ||
          !isVisible(parent)
        ) {
          continue;
        }
        const range = document.createRange();
        range.selectNode(node);
        for (const fragment of range.getClientRects()) {
          if (fragment.width > 0.5 && fragment.height > 0.5) {
            fragments.push(DOMRect.fromRect(fragment));
          }
        }
      }
    }
    const result =
      fragments.length === 0 ? [DOMRect.fromRect(element.getBoundingClientRect())] : fragments;
    paintRectCache.set(element, result);
    return result;
  };
  const boundsFor = (rects: readonly DOMRect[]): DOMRect => {
    if (rects.length === 0) return DOMRect.fromRect();
    const left = Math.min(...rects.map(({ left }) => left));
    const right = Math.max(...rects.map(({ right }) => right));
    const top = Math.min(...rects.map(({ top }) => top));
    const bottom = Math.max(...rects.map(({ bottom }) => bottom));
    return new DOMRect(left, top, right - left, bottom - top);
  };
  const layoutFor = (element: Element): RenderedCheckRect | null => {
    if (!(element instanceof HTMLElement) || fallbackTextOwners.has(element)) return null;
    let current: HTMLElement | null = element;
    let x = 0;
    let y = 0;
    while (current !== slide) {
      x += current.offsetLeft;
      y += current.offsetTop;
      current = current.offsetParent as HTMLElement | null;
      if (current === null) return null;
    }
    return {
      height: round(element.offsetHeight),
      width: round(element.offsetWidth),
      x: round(x),
      y: round(y),
    };
  };
  const elementEvidence = (element: Element): RenderedCheckElement => {
    const source = sourceFor(element);
    const stepOwner = element.closest<HTMLElement>("[data-drever-step]");
    const stepValue = Number(stepOwner?.getAttribute("data-drever-step"));
    const fragments = paintRects(element);
    return {
      fragments: fragments.map(rectangle),
      key: keyFor(element, source),
      label: labelFor(element),
      layout: layoutFor(element),
      rect: rectangle(boundsFor(fragments)),
      ...(source === undefined ? {} : { source }),
      ...(Number.isSafeInteger(stepValue) && stepValue > 0 ? { step: stepValue } : {}),
      tag: element.localName,
    };
  };
  const outside = (
    child: DOMRect | DOMRectReadOnly,
    owner: DOMRect | DOMRectReadOnly,
    tolerance = 1.5,
  ): boolean =>
    child.left < owner.left - tolerance ||
    child.right > owner.right + tolerance ||
    child.top < owner.top - tolerance ||
    child.bottom > owner.bottom + tolerance;
  const clippingOwner = (
    element: Element,
    paints: readonly (DOMRect | DOMRectReadOnly)[],
  ): Element | undefined => {
    const clipsOverflow = (value: string): boolean =>
      value === "auto" || value === "clip" || value === "hidden" || value === "scroll";
    let current: Element | null = element;
    while (current !== null) {
      const style = getComputedStyle(current);
      const clipsX = clipsOverflow(style.overflowX);
      const clipsY = clipsOverflow(style.overflowY);
      if (clipsX || clipsY) {
        const bounds = current.getBoundingClientRect();
        if (
          paints.some(
            (paint) =>
              (clipsX && (paint.left < bounds.left - 1.5 || paint.right > bounds.right + 1.5)) ||
              (clipsY && (paint.top < bounds.top - 1.5 || paint.bottom > bounds.bottom + 1.5)),
          )
        ) {
          return current;
        }
      }
      if (current === slide) break;
      current = current.parentElement;
    }
    return;
  };
  const directScrollOverflow = (
    element: Element,
  ): Readonly<{ x: number; y: number }> | undefined => {
    if (!(element instanceof HTMLElement)) return;
    const clipsOverflow = (value: string): boolean =>
      value === "auto" || value === "clip" || value === "hidden" || value === "scroll";
    const style = getComputedStyle(element);
    const x = clipsOverflow(style.overflowX)
      ? Math.max(0, element.scrollWidth - element.clientWidth)
      : 0;
    const y = clipsOverflow(style.overflowY)
      ? Math.max(0, element.scrollHeight - element.clientHeight)
      : 0;
    return x > 1.5 || y > 1.5 ? { x: round(x), y: round(y) } : undefined;
  };

  type Color = Readonly<{ alpha: number; blue: number; green: number; red: number }>;
  const clamp = (value: number, maximum = 255): number => Math.min(maximum, Math.max(0, value));
  const parseColor = (value: string): Color | undefined => {
    const rgb = value.match(/^rgba?\((.*)\)$/iu);
    if (rgb !== null) {
      const parts = (rgb[1] as string)
        .replace("/", " ")
        .split(/[\s,]+/u)
        .filter(Boolean);
      if (parts.length < 3) return;
      const channel = (part: string): number =>
        part.endsWith("%")
          ? (clamp(Number.parseFloat(part), 100) / 100) * 255
          : clamp(Number.parseFloat(part));
      const alpha = parts[3]?.endsWith("%")
        ? clamp(Number.parseFloat(parts[3]), 100) / 100
        : clamp(Number.parseFloat(parts[3] ?? "1"), 1);
      const [red, green, blue] = parts.slice(0, 3).map(channel);
      if (![red, green, blue, alpha].every(Number.isFinite)) return;
      return { alpha, blue: blue as number, green: green as number, red: red as number };
    }
    const srgb = value.match(/^color\(srgb\s+(.*)\)$/iu);
    if (srgb === null) return;
    const parts = (srgb[1] as string).replace("/", " ").split(/\s+/u).filter(Boolean);
    if (parts.length < 3) return;
    const values = parts.map(Number);
    if (!values.every(Number.isFinite)) return;
    return {
      alpha: clamp(values[3] ?? 1, 1),
      blue: clamp((values[2] as number) * 255),
      green: clamp((values[1] as number) * 255),
      red: clamp((values[0] as number) * 255),
    };
  };
  const composite = (foreground: Color, background: Color): Color => {
    const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
    if (alpha <= 0) return { alpha: 0, blue: 0, green: 0, red: 0 };
    const channel = (front: number, back: number): number =>
      (front * foreground.alpha + back * background.alpha * (1 - foreground.alpha)) / alpha;
    return {
      alpha,
      blue: channel(foreground.blue, background.blue),
      green: channel(foreground.green, background.green),
      red: channel(foreground.red, background.red),
    };
  };
  const colorText = (color: Color): string =>
    `rgb(${String(Math.round(color.red))} ${String(Math.round(color.green))} ${String(Math.round(color.blue))})`;
  const luminance = (color: Color): number => {
    const channel = (value: number): number => {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return (
      0.2126 * channel(color.red) + 0.7152 * channel(color.green) + 0.0722 * channel(color.blue)
    );
  };
  const contrastRatio = (first: Color, second: Color): number => {
    const light = Math.max(luminance(first), luminance(second));
    const dark = Math.min(luminance(first), luminance(second));
    return (light + 0.05) / (dark + 0.05);
  };
  const hasPaint = (element: Element): boolean => {
    if (element.matches("img,svg,canvas,video,picture")) return true;
    const style = getComputedStyle(element);
    const background = parseColor(style.backgroundColor);
    return (
      style.backgroundImage !== "none" || (background !== undefined && background.alpha > 0.01)
    );
  };
  const paintedSiblingBelow = (element: Element, sample: DOMRect): boolean => {
    const x = sample.left + sample.width / 2;
    const y = sample.top + sample.height / 2;
    return document
      .elementsFromPoint(x, y)
      .some(
        (candidate) =>
          candidate !== element &&
          !candidate.contains(element) &&
          !element.contains(candidate) &&
          hasPaint(candidate),
      );
  };
  const resolveBackground = (
    element: Element,
    sample: DOMRect,
  ):
    | Readonly<{ color: Color; type: "solid" }>
    | Readonly<{ reason: string; type: "indeterminate" }> => {
    const layers: Color[] = [];
    let current: Element | null = element;
    let foundOpaqueLayer = false;
    let opaqueOwner: Element | undefined;
    while (current !== null) {
      const style = getComputedStyle(current);
      if (style.backgroundImage !== "none") {
        return { reason: "background-image-or-gradient", type: "indeterminate" };
      }
      if (
        style.mixBlendMode !== "normal" ||
        style.backgroundBlendMode !== "normal" ||
        style.filter !== "none" ||
        style.backdropFilter !== "none" ||
        Number.parseFloat(style.opacity) < 0.999
      ) {
        return { reason: "blend-filter-or-opacity", type: "indeterminate" };
      }
      const background = parseColor(style.backgroundColor);
      if (background === undefined) {
        return { reason: "unsupported-color-space", type: "indeterminate" };
      }
      if (background.alpha > 0) layers.push(background);
      if (background.alpha >= 0.999) {
        foundOpaqueLayer = true;
        opaqueOwner = current;
        break;
      }
      if (current === slide) {
        return { reason: "transparent-slide-surface", type: "indeterminate" };
      }
      current = current.parentElement;
    }
    if (opaqueOwner !== element && paintedSiblingBelow(element, sample)) {
      return { reason: "painted-content-behind-text", type: "indeterminate" };
    }
    let color: Color = { alpha: 1, blue: 255, green: 255, red: 255 };
    for (const layer of layers.toReversed()) color = composite(layer, color);
    if (!foundOpaqueLayer && color.alpha < 0.999) {
      return { reason: "transparent-canvas", type: "indeterminate" };
    }
    return { color, type: "solid" };
  };
  const hasMixedTextColors = (element: Element, color: string): boolean =>
    [...element.querySelectorAll("*")].some(
      (descendant) =>
        directText(descendant).length > 0 &&
        isVisible(descendant) &&
        getComputedStyle(descendant).color !== color,
    );
  const overlapExcluded = (element: Element): boolean =>
    element.closest('[data-drever-visual-role="decoration"],[data-drever-overlap="allow"]') !==
    null;
  const overlapKind = (element: Element): "content" | "text" | undefined => {
    if (element.matches("img,svg,canvas,video,pre,table,[role='img']")) return "content";
    if (
      (element.matches(textSelector) || fallbackTextOwners.has(element)) &&
      (directText(element).length > 0 || element.querySelector(textSelector) === null)
    ) {
      return "text";
    }
    return;
  };
  const effectiveOpacity = (element: Element): number => {
    let opacity = 1;
    let current: Element | null = element;
    while (current !== null) {
      opacity *= Number.parseFloat(getComputedStyle(current).opacity);
      if (current === slide) break;
      current = current.parentElement;
    }
    return opacity;
  };
  const intersection = (first: DOMRect, second: DOMRect): DOMRect | undefined => {
    const left = Math.max(first.left, second.left);
    const right = Math.min(first.right, second.right);
    const top = Math.max(first.top, second.top);
    const bottom = Math.min(first.bottom, second.bottom);
    if (right - left < 8 || bottom - top < 6) return;
    const area = (right - left) * (bottom - top);
    const smallerArea = Math.min(first.width * first.height, second.width * second.height);
    if (smallerArea <= 0 || area / smallerArea < 0.08) return;
    return new DOMRect(left, top, right - left, bottom - top);
  };
  const largestIntersection = (
    first: readonly DOMRect[],
    second: readonly DOMRect[],
  ): DOMRect | undefined => {
    let largest: DOMRect | undefined;
    for (const firstRect of first) {
      for (const secondRect of second) {
        const candidate = intersection(firstRect, secondRect);
        if (
          candidate !== undefined &&
          (largest === undefined ||
            candidate.width * candidate.height > largest.width * largest.height)
        ) {
          largest = candidate;
        }
      }
    }
    return largest;
  };
  const stackIndex = (element: Element, sample: DOMRect): number => {
    const x = sample.left + sample.width / 2;
    const y = sample.top + sample.height / 2;
    return document
      .elementsFromPoint(x, y)
      .findIndex((candidate) => candidate === element || element.contains(candidate));
  };

  const textWalker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
  for (let node = textWalker.nextNode(); node !== null; node = textWalker.nextNode()) {
    const parent = node.parentElement;
    if (
      parent !== null &&
      (node.textContent ?? "").trim().length > 0 &&
      parent.closest(meaningfulSelector) === null &&
      isVisible(parent)
    ) {
      fallbackTextOwners.add(parent);
    }
  }
  const candidates = [...slide.querySelectorAll(meaningfulSelector), ...fallbackTextOwners].filter(
    (element) =>
      isVisible(element) &&
      !(
        element.matches("[aria-label]:not(a):not(button):not(input):not([role='img'])") &&
        element.querySelector(meaningfulSelector) !== null
      ),
  );
  const elements = candidates.map(elementEvidence);
  const issues: RenderedCheckIssue[] = [];
  for (const [index, element] of candidates.entries()) {
    const evidence = elements[index] as RenderedCheckElement;
    if (evidence.rect.width <= 0.5 || evidence.rect.height <= 0.5) continue;
    const paints = paintRects(element);
    if (paints.some((paint) => outside(paint, slideBounds))) {
      issues.push({ element: evidence, type: "canvas-overflow" });
      continue;
    }
    const owner = clippingOwner(element, paints);
    const scrollOverflow = directScrollOverflow(element);
    if (owner !== undefined && owner !== slide) {
      issues.push({
        element: evidence,
        evidence:
          owner === element && scrollOverflow !== undefined ? "scroll-overflow" : "line-fragment",
        owner: {
          key: pathFor(owner),
          rect: rectangle(owner.getBoundingClientRect()),
          tag: owner.localName,
        },
        ...(owner === element && scrollOverflow !== undefined ? { overflow: scrollOverflow } : {}),
        type: "content-clipped",
      });
    } else if (scrollOverflow !== undefined) {
      issues.push({
        element: evidence,
        evidence: "scroll-overflow",
        overflow: scrollOverflow,
        owner: {
          key: pathFor(element),
          rect: rectangle(element.getBoundingClientRect()),
          tag: element.localName,
        },
        type: "content-clipped",
      });
    }
  }

  const overlapCandidates = candidates
    .map((element, index) => ({
      element,
      evidence: elements[index] as RenderedCheckElement,
      kind: overlapKind(element),
    }))
    .filter(
      (candidate): candidate is typeof candidate & Readonly<{ kind: "content" | "text" }> =>
        candidate.kind !== undefined && !overlapExcluded(candidate.element),
    );
  for (let firstIndex = 0; firstIndex < overlapCandidates.length; firstIndex += 1) {
    const first = overlapCandidates[firstIndex] as (typeof overlapCandidates)[number];
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < overlapCandidates.length;
      secondIndex += 1
    ) {
      const second = overlapCandidates[secondIndex] as (typeof overlapCandidates)[number];
      if (
        first.element.contains(second.element) ||
        second.element.contains(first.element) ||
        (first.kind === "content" && second.kind === "content")
      ) {
        continue;
      }
      const overlap = largestIntersection(paintRects(first.element), paintRects(second.element));
      if (overlap === undefined) continue;
      const firstStack = stackIndex(first.element, overlap);
      const secondStack = stackIndex(second.element, overlap);
      if (firstStack < 0 || secondStack < 0) continue;
      if (first.kind !== second.kind) {
        const content = first.kind === "content" ? first : second;
        const contentStack = first.kind === "content" ? firstStack : secondStack;
        const textStack = first.kind === "text" ? firstStack : secondStack;
        if (contentStack > textStack || effectiveOpacity(content.element) < 0.85) continue;
      } else if (effectiveOpacity(first.element) < 0.5 || effectiveOpacity(second.element) < 0.5) {
        continue;
      }
      issues.push({
        elements: [first.evidence, second.evidence],
        intersection: rectangle(overlap),
        type: "content-overlap",
      });
    }
  }

  const recordedIndeterminateContrast = new Set<string>();
  const contrastCandidates = candidates.filter(
    (element) =>
      overlapKind(element) === "text" &&
      (directText(element).length > 0 || element.querySelector(textSelector) === null),
  );
  for (const element of contrastCandidates) {
    const evidence = elements[candidates.indexOf(element)] as RenderedCheckElement;
    const samples = paintRects(element);
    if (samples.length === 0) continue;
    const style = getComputedStyle(element);
    const foreground = parseColor(style.color);
    let indeterminateReason: string | undefined;
    if (foreground === undefined) indeterminateReason = "unsupported-color-space";
    else if (hasMixedTextColors(element, style.color)) indeterminateReason = "mixed-text-colors";
    const backgrounds = samples.map((sample) => resolveBackground(element, sample));
    const unresolvedBackground = backgrounds.find(
      (background): background is Readonly<{ reason: string; type: "indeterminate" }> =>
        background.type === "indeterminate",
    );
    indeterminateReason ??= unresolvedBackground?.reason;
    if (indeterminateReason !== undefined || foreground === undefined) {
      if (!recordedIndeterminateContrast.has(indeterminateReason ?? "unresolved-background")) {
        issues.push({
          element: evidence,
          reason: indeterminateReason ?? "unresolved-background",
          type: "text-contrast-indeterminate",
        });
        recordedIndeterminateContrast.add(indeterminateReason ?? "unresolved-background");
      }
      continue;
    }
    const resolved = backgrounds
      .filter(
        (background): background is Readonly<{ color: Color; type: "solid" }> =>
          background.type === "solid",
      )
      .map((background) => {
        const resolvedForeground = composite(foreground, background.color);
        return {
          actual: contrastRatio(resolvedForeground, background.color),
          background: background.color,
          foreground: resolvedForeground,
        };
      })
      .toSorted((left, right) => left.actual - right.actual)[0];
    if (resolved === undefined) continue;
    const fontSize = Number.parseFloat(style.fontSize);
    const fontWeight = Number.parseInt(style.fontWeight, 10);
    const largeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
    const expected = largeText ? 3 : 4.5;
    if (resolved.actual + 0.005 >= expected) continue;
    issues.push({
      actual: Math.round(resolved.actual * 100) / 100,
      background: colorText(resolved.background),
      element: evidence,
      expected,
      fontSize: round(fontSize),
      fontWeight,
      foreground: colorText(resolved.foreground),
      largeText,
      type: "text-contrast-low",
    });
  }

  let characterCount = 0;
  let lineFragmentCount = 0;
  let textArea = 0;
  const segmenter = new Intl.Segmenter(document.documentElement.lang || "en", {
    granularity: "grapheme",
  });
  const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement;
    const text = (node.textContent ?? "").replace(/\s+/gu, " ").trim();
    if (parent === null || text.length === 0 || !isVisible(parent)) continue;
    characterCount += Array.from(segmenter.segment(text)).length;
    const range = document.createRange();
    range.selectNode(node);
    for (const rect of range.getClientRects()) {
      const width = Math.max(
        0,
        Math.min(rect.right, slideBounds.right) - Math.max(rect.left, slideBounds.left),
      );
      const height = Math.max(
        0,
        Math.min(rect.bottom, slideBounds.bottom) - Math.max(rect.top, slideBounds.top),
      );
      if (width <= 0.5 || height <= 0.5) continue;
      lineFragmentCount += 1;
      textArea += width * height;
    }
  }
  const slideArea = Math.max(1, slideBounds.width * slideBounds.height);

  return {
    density: {
      characterCount,
      lineFragmentCount,
      semanticElementCount: candidates.length,
      textAreaRatio: round(textArea / slideArea),
    },
    elements,
    issues,
    route,
    slide: {
      id: slide.getAttribute("data-slide-id") ?? "",
      index: Number(slide.getAttribute("data-slide-index") ?? -1),
      rect: rectangle(slideBounds),
      step: Number(slide.getAttribute("data-current-step") ?? 0),
    },
  };
};
