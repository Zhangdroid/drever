import { describe, expect, it, vi } from "vite-plus/test";
import {
  PRESENTATION_TRANSITION_TYPES,
  resolveLocalSlideTransition,
  setLocalSlideTransitionMode,
  startScopedViewTransition,
  type ScopedViewTransition,
} from "./view-transition.ts";

describe("presentation transition types", () => {
  it("exposes stable L2 transition types", () => {
    expect(PRESENTATION_TRANSITION_TYPES).toEqual([
      "drever-step-forward",
      "drever-step-backward",
      "drever-slide-forward",
      "drever-slide-backward",
      "drever-jump-forward",
      "drever-jump-backward",
    ]);
    expect(Object.isFrozen(PRESENTATION_TRANSITION_TYPES)).toBe(true);
  });

  it("uses local motion only for the matching adjacent target relation", () => {
    const rootWith = (target: number, from: "next" | "previous") =>
      ({
        querySelector: vi.fn((selector: string) =>
          selector.includes(
            `[data-slide-index="${target}"]` +
              `[data-drever-slide-transition-from-${from}="local"]`,
          )
            ? {}
            : null,
        ),
      }) as unknown as Pick<HTMLElement, "querySelector">;
    const forward = {
      from: { slideId: "two", slideIndex: 1, step: 0 },
      to: { slideId: "three", slideIndex: 2, step: 0 },
      transitionType: "drever-slide-forward",
    } as const;
    const reverse = {
      from: forward.to,
      to: forward.from,
      transitionType: "drever-slide-backward",
    } as const;
    const jump = {
      from: { slideId: "one", slideIndex: 0, step: 0 },
      to: forward.to,
      transitionType: "drever-jump-forward",
    } as const;

    expect(resolveLocalSlideTransition(rootWith(2, "previous"), forward)).toBe("previous");
    expect(resolveLocalSlideTransition(rootWith(1, "next"), reverse)).toBe("next");
    expect(resolveLocalSlideTransition(rootWith(2, "next"), forward)).toBeUndefined();
    expect(resolveLocalSlideTransition(rootWith(2, "previous"), jump)).toBeUndefined();
  });

  it("sets and clears the local transition CSS state", () => {
    const root = {
      removeAttribute: vi.fn(),
      setAttribute: vi.fn(),
    } as unknown as Pick<HTMLElement, "removeAttribute" | "setAttribute">;

    setLocalSlideTransitionMode(root, "previous");
    expect(root.setAttribute).toHaveBeenCalledWith("data-drever-transition-from", "previous");
    expect(root.setAttribute).toHaveBeenCalledWith("data-drever-transition-mode", "local");

    setLocalSlideTransitionMode(root, undefined);
    expect(root.removeAttribute).toHaveBeenCalledWith("data-drever-transition-from");
    expect(root.removeAttribute).toHaveBeenCalledWith("data-drever-transition-mode");
  });

  it("starts one typed transition on the supplied presentation surface", async () => {
    const transition: ScopedViewTransition = {
      finished: Promise.resolve(),
      ready: Promise.resolve(),
      skipTransition: vi.fn(),
      updateCallbackDone: Promise.resolve(),
    };
    const update = vi.fn(async () => undefined);
    let options:
      | Readonly<{
          types: readonly string[];
          update(): Promise<void>;
        }>
      | undefined;
    const startViewTransition = vi.fn(
      (received: NonNullable<typeof options>): ScopedViewTransition => {
        options = received;
        return transition;
      },
    );
    const deck = { startViewTransition } as unknown as HTMLElement;

    expect(startScopedViewTransition(deck, "drever-slide-forward", update)).toBe(transition);
    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(options?.types).toEqual(["drever-slide-forward"]);
    expect(update).not.toHaveBeenCalled();

    await options?.update();
    expect(update).toHaveBeenCalledOnce();
  });
});
