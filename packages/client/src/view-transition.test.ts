import { describe, expect, it, vi } from "vite-plus/test";
import {
  PRESENTATION_TRANSITION_TYPES,
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
