export const releaseSmokeAudienceStates = (slides) =>
  Object.freeze(
    slides.flatMap((slide, slideIndex) =>
      [0, ...(Array.isArray(slide?.stepStops) ? slide.stepStops : [])].map((step) =>
        Object.freeze({
          slideIndex,
          slideNumber: slideIndex + 1,
          step,
        }),
      ),
    ),
  );

export const releaseSmokeStatePath = (mountPath, { slideIndex, slideNumber, step }) => {
  if (slideIndex === 0 && step === 0) return `${mountPath}/`;
  return `${mountPath}/${String(slideNumber)}${step === 0 ? "" : `/${String(step)}`}`;
};

const TEXT_SAFE_AREA_BLOCK_RATIO = 0.02;
const TEXT_SAFE_AREA_INLINE_RATIO = 0.015;
const TEXT_SAFE_AREA_MINIMUM = 6;

const round = (value) => Math.round(value * 10) / 10;

export const releaseSmokeTextSafeAreaIssues = (frame) => {
  const canvas = frame.slide.rect;
  const threshold = {
    block: round(Math.max(TEXT_SAFE_AREA_MINIMUM, canvas.height * TEXT_SAFE_AREA_BLOCK_RATIO)),
    inline: round(Math.max(TEXT_SAFE_AREA_MINIMUM, canvas.width * TEXT_SAFE_AREA_INLINE_RATIO)),
  };
  return (frame.textElements ?? []).flatMap((element) => {
    if (element.decorative) return [];
    const rect = element.rect;
    if (
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.x < canvas.x ||
      rect.y < canvas.y ||
      rect.x + rect.width > canvas.x + canvas.width ||
      rect.y + rect.height > canvas.y + canvas.height
    ) {
      return [];
    }
    const clearance = {
      "block-end": round(canvas.y + canvas.height - (rect.y + rect.height)),
      "block-start": round(rect.y - canvas.y),
      "inline-end": round(canvas.x + canvas.width - (rect.x + rect.width)),
      "inline-start": round(rect.x - canvas.x),
    };
    const sides = Object.keys(clearance).filter((side) =>
      side.startsWith("inline")
        ? clearance[side] < threshold.inline
        : clearance[side] < threshold.block,
    );
    return sides.length === 0
      ? []
      : [
          {
            type: "text-safe-area",
            clearance,
            key: element.key,
            label: element.label,
            rect,
            sides,
            tag: element.tag,
            threshold,
          },
        ];
  });
};

const largeLayoutChange = (before, after, slide) => {
  const widthChange = Math.abs(after.width - before.width);
  const heightChange = Math.abs(after.height - before.height);
  const xChange = Math.abs(after.x - before.x);
  const yChange = Math.abs(after.y - before.y);
  const settledArea = after.width * after.height;
  const slideArea = slide.width * slide.height;
  const collapsed =
    (before.width <= 1 && after.width >= slide.width * 0.15) ||
    (before.height <= 1 && after.height >= slide.height * 0.15);
  const resized =
    settledArea >= slideArea * 0.025 &&
    (widthChange >= slide.width * 0.15 || heightChange >= slide.height * 0.15);
  const rebased =
    settledArea >= slideArea * 0.01 &&
    (xChange >= slide.width * 0.12 || yChange >= slide.height * 0.12);
  return collapsed || resized || rebased;
};

export const releaseSmokeTransitionIssues = (transitionFrame, settledFrame) => {
  const issues = [...(transitionFrame.issues ?? [])];
  if (
    transitionFrame.slide.index !== settledFrame.slide.index ||
    transitionFrame.slide.id !== settledFrame.slide.id
  ) {
    return [
      ...issues,
      {
        type: "transition-slide-mismatch",
        transition: {
          id: transitionFrame.slide.id,
          index: transitionFrame.slide.index,
        },
        settled: {
          id: settledFrame.slide.id,
          index: settledFrame.slide.index,
        },
      },
    ];
  }
  const settledByKey = new Map(settledFrame.stepElements.map((element) => [element.key, element]));
  return [
    ...issues,
    ...transitionFrame.stepElements.flatMap((element) => {
      const settled = settledByKey.get(element.key);
      if (
        element.layout === null ||
        settled?.layout === null ||
        settled === undefined ||
        !largeLayoutChange(element.layout, settled.layout, settledFrame.slide.rect)
      ) {
        return [];
      }
      return [
        {
          type: "unstable-step-layout",
          key: element.key,
          label: settled.label,
          transition: element.layout,
          settled: settled.layout,
        },
      ];
    }),
  ];
};

/**
 * This function is serialized into the generated deck page by Playwright.
 * Keep every helper inside its body and return only JSON-safe evidence.
 */
export const captureReleaseSmokeFrame = () => {
  const round = (value) => Math.round(value * 10) / 10;
  const activeSlides = [
    ...document.querySelectorAll('[data-drever-slide][data-slide-state="active"]'),
  ];
  if (activeSlides.length !== 1) {
    return {
      issues: [
        {
          type: "active-slide-count",
          actual: activeSlides.length,
          expected: 1,
        },
      ],
      slide: { id: "", index: -1, rect: { height: 0, width: 0, x: 0, y: 0 }, step: 0 },
      stepElements: [],
      textElements: [],
      visibleElementCount: 0,
    };
  }

  const slide = activeSlides[0];
  const roundedRect = (rect) => ({
    x: round(rect.x),
    y: round(rect.y),
    width: round(rect.width),
    height: round(rect.height),
  });
  const slideRect = slide.getBoundingClientRect();
  const meaningfulSelector =
    'h1,h2,h3,h4,h5,h6,p,li,a,button,img[alt]:not([alt=""]),svg[aria-label],pre,code,table,[role="img"],[aria-label]';
  const textSelector = "h1,h2,h3,h4,h5,h6,p,li,a,button,pre,code,th,td";
  const fallbackTextOwners = new Set();
  const directText = (element) =>
    [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? "")
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim();
  const labelFor = (element) =>
    (
      directText(element) ||
      element.getAttribute("aria-label") ||
      element.getAttribute("role") ||
      element.localName
    ).slice(0, 120);
  const pathFor = (element) => {
    const segments = [];
    let current = element;
    while (current !== slide && current.parentElement !== null) {
      const parent = current.parentElement;
      segments.push(`${current.localName}:${[...parent.children].indexOf(current)}`);
      current = parent;
    }
    return segments.reverse().join("/");
  };
  const isMeaningful = (element) =>
    directText(element) !== "" || element.matches(meaningfulSelector);
  const isVisible = (element) => {
    if (
      element.closest('[aria-hidden="true"],[inert]') !== null ||
      element.getClientRects().length === 0
    ) {
      return false;
    }
    let current = element;
    while (current !== null) {
      const style = getComputedStyle(current);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse" ||
        Number.parseFloat(style.opacity) <= 0.01
      ) {
        return false;
      }
      if (current === slide) break;
      current = current.parentElement;
    }
    return true;
  };
  const clippedBy = (element, rect) => {
    let current = element.parentElement;
    while (current !== null) {
      const style = getComputedStyle(current);
      const clipX = style.overflowX === "hidden" || style.overflowX === "clip";
      const clipY = style.overflowY === "hidden" || style.overflowY === "clip";
      if (clipX || clipY) {
        const owner = current.getBoundingClientRect();
        const tolerance = Math.max(12, Math.min(owner.width, owner.height) * 0.015);
        const clipped =
          (clipX && (rect.left < owner.left - tolerance || rect.right > owner.right + tolerance)) ||
          (clipY && (rect.top < owner.top - tolerance || rect.bottom > owner.bottom + tolerance));
        if (clipped) {
          return {
            key: pathFor(current),
            rect: roundedRect(owner),
          };
        }
      }
      if (current === slide) break;
      current = current.parentElement;
    }
    return null;
  };
  const layoutRect = (element) => {
    let current = element;
    let x = 0;
    let y = 0;
    while (current !== slide && current instanceof HTMLElement) {
      x += current.offsetLeft;
      y += current.offsetTop;
      current = current.offsetParent;
    }
    return current === slide
      ? {
          x: round(x),
          y: round(y),
          width: round(element.offsetWidth),
          height: round(element.offsetHeight),
        }
      : null;
  };
  const textPaintRect = (element) => {
    const fragments = [];
    const fallback = fallbackTextOwners.has(element);
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if (
        (node.textContent ?? "").trim().length === 0 ||
        (fallback
          ? node.parentElement !== element
          : node.parentElement?.closest(textSelector) !== element) ||
        !isVisible(node.parentElement)
      ) {
        continue;
      }
      const range = document.createRange();
      range.selectNode(node);
      for (const fragment of range.getClientRects()) {
        if (fragment.width > 0.5 && fragment.height > 0.5) fragments.push(fragment);
      }
    }
    if (fragments.length === 0) return null;
    const left = Math.min(...fragments.map(({ left }) => left));
    const right = Math.max(...fragments.map(({ right }) => right));
    const top = Math.min(...fragments.map(({ top }) => top));
    const bottom = Math.max(...fragments.map(({ bottom }) => bottom));
    return { x: left, y: top, width: right - left, height: bottom - top };
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
  const meaningfulElements = [...slide.querySelectorAll("*")].filter(isMeaningful);
  const visibleElements = meaningfulElements.filter(isVisible);
  const textElements = [...slide.querySelectorAll(textSelector), ...fallbackTextOwners].flatMap(
    (element) => {
      if (!isVisible(element)) return [];
      const rect = textPaintRect(element);
      if (rect === null) return [];
      return [
        {
          decorative: element.closest('[data-drever-visual-role="decoration"]') !== null,
          key: pathFor(element),
          label: labelFor(element),
          rect: roundedRect(rect),
          tag: element.localName,
        },
      ];
    },
  );
  const issues = visibleElements.flatMap((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0.5 || rect.height <= 0.5) return [];
    const owner = clippedBy(element, rect);
    if (owner === null) return [];
    return [
      {
        type: "clipped-visible-element",
        key: pathFor(element),
        label: labelFor(element),
        rect: roundedRect(rect),
        owner,
      },
    ];
  });

  const activeSteps = [...slide.querySelectorAll('[data-drever-step][data-step-state="active"]')];
  const stepElements = activeSteps
    .flatMap((step) => [step, ...step.querySelectorAll("*")])
    .filter((element) => element instanceof HTMLElement)
    .slice(0, 240)
    .map((element) => ({
      key: pathFor(element),
      label: labelFor(element),
      layout: layoutRect(element),
      rect: roundedRect(element.getBoundingClientRect()),
    }));

  return {
    issues,
    slide: {
      id: slide.getAttribute("data-slide-id") ?? "",
      index: Number(slide.getAttribute("data-slide-index") ?? -1),
      rect: roundedRect(slideRect),
      step: Number(slide.getAttribute("data-current-step") ?? 0),
    },
    stepElements,
    textElements,
    visibleElementCount: visibleElements.length,
  };
};
