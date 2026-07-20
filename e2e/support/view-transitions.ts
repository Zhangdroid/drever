import type { Page } from "@playwright/test";

export type ViewTransitionCall = Readonly<{
  kind: "document" | "element";
  target: string;
  types: readonly string[];
}>;

type TransitionPhase = "finished" | "ready";

export type CapturedViewTransition = Readonly<{
  index: number;
}>;

export const monitorViewTransitions = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const calls: ViewTransitionCall[] = [];
    const transitions: ViewTransition[] = [];
    Object.defineProperty(globalThis, "__dreverTransitionCalls", { value: calls });
    Object.defineProperty(globalThis, "__dreverTransitions", { value: transitions });

    const wrap = (prototype: object, kind: ViewTransitionCall["kind"]): void => {
      const start = Reflect.get(prototype, "startViewTransition") as (
        ...args: unknown[]
      ) => unknown;
      if (typeof start !== "function") return;

      Reflect.set(
        prototype,
        "startViewTransition",
        function (this: Document | Element, ...args: unknown[]) {
          const options = args[0] as Readonly<{ types?: Iterable<string> }> | undefined;
          const call = {
            kind,
            target:
              kind === "document"
                ? "document"
                : this instanceof HTMLElement && this.hasAttribute("data-drever-deck")
                  ? "deck"
                  : this instanceof HTMLElement && this.hasAttribute("data-drever-canvas")
                    ? "canvas"
                    : this instanceof Element
                      ? this.localName
                      : "element",
            types: [...(options?.types ?? [])],
          } satisfies ViewTransitionCall;
          const index = calls.push(call) - 1;
          const transition = Reflect.apply(start, this, args) as ViewTransition;
          transitions[index] = transition;
          return transition;
        },
      );
    };

    wrap(Document.prototype, "document");
    wrap(Element.prototype, "element");
  });
};

export const readViewTransitionCalls = (page: Page): Promise<readonly ViewTransitionCall[]> =>
  page.evaluate(
    () => Reflect.get(globalThis, "__dreverTransitionCalls") as readonly ViewTransitionCall[],
  );

export const captureNextViewTransition = async (
  page: Page,
  action: () => Promise<unknown>,
): Promise<CapturedViewTransition> => {
  const index = await page.evaluate(
    () =>
      (Reflect.get(globalThis, "__dreverTransitionCalls") as readonly ViewTransitionCall[]).length,
  );
  await action();
  await page.waitForFunction(
    (expectedIndex) =>
      (Reflect.get(globalThis, "__dreverTransitions") as readonly (ViewTransition | undefined)[])[
        expectedIndex
      ] !== undefined,
    index,
  );
  return { index };
};

export const waitForViewTransition = async (
  page: Page,
  captured: CapturedViewTransition,
  phase: TransitionPhase,
): Promise<void> => {
  await page.evaluate(
    async ({ index, requestedPhase }) => {
      const transitions = Reflect.get(globalThis, "__dreverTransitions") as readonly Readonly<
        Record<TransitionPhase, Promise<void>>
      >[];
      const transition = transitions[index];
      if (transition === undefined) {
        throw new Error(`Expected View Transition ${index} to be captured.`);
      }
      await transition[requestedPhase];
    },
    { index: captured.index, requestedPhase: phase },
  );
};
