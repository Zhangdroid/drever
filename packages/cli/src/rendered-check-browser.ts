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
      owner: Readonly<{ key: string; rect: RenderedCheckRect; tag: string }>;
      type: "content-clipped";
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
  const paintBounds = (element: Element): DOMRect | DOMRectReadOnly => {
    if (element.matches("p,li,a,button,h1,h2,h3,h4,h5,h6,pre,th,td")) {
      const range = document.createRange();
      range.selectNodeContents(element);
      const bounds = range.getBoundingClientRect();
      if (bounds.width > 0.5 && bounds.height > 0.5) return bounds;
    }
    return element.getBoundingClientRect();
  };
  const layoutFor = (element: Element): RenderedCheckRect | null => {
    if (!(element instanceof HTMLElement)) return null;
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
    return {
      key: keyFor(element, source),
      label: labelFor(element),
      layout: layoutFor(element),
      rect: rectangle(paintBounds(element)),
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
    paint: DOMRect | DOMRectReadOnly,
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
          (clipsX && (paint.left < bounds.left - 1.5 || paint.right > bounds.right + 1.5)) ||
          (clipsY && (paint.top < bounds.top - 1.5 || paint.bottom > bounds.bottom + 1.5))
        ) {
          return current;
        }
      }
      if (current === slide) break;
      current = current.parentElement;
    }
    return;
  };

  const candidates = [...slide.querySelectorAll(meaningfulSelector)].filter(
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
    const paint = paintBounds(element);
    if (outside(paint, slideBounds)) {
      issues.push({ element: evidence, type: "canvas-overflow" });
      continue;
    }
    const owner = clippingOwner(element, paint);
    if (owner !== undefined && owner !== slide) {
      issues.push({
        element: evidence,
        owner: {
          key: pathFor(owner),
          rect: rectangle(owner.getBoundingClientRect()),
          tag: owner.localName,
        },
        type: "content-clipped",
      });
    }
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
