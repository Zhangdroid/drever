import { describe, expect, it, vi } from "vite-plus/test";
import { createPresentationLaserStore } from "./presentation-laser.ts";

describe("presentation laser store", () => {
  it("publishes immutable transient points and ignores a duplicate clear", () => {
    const store = createPresentationLaserStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const source = {
      point: { x: 0.25, y: 0.75 },
      position: { slideId: "intro", slideIndex: 0, step: 2 },
    };

    store.set(source);
    source.point.x = 1;
    source.position.step = 99;

    expect(store.getSnapshot()).toEqual({
      point: { x: 0.25, y: 0.75 },
      position: { slideId: "intro", slideIndex: 0, step: 2 },
    });
    expect(Object.isFrozen(store.getSnapshot())).toBe(true);
    expect(Object.isFrozen(store.getSnapshot()?.point)).toBe(true);
    expect(Object.isFrozen(store.getSnapshot()?.position)).toBe(true);

    store.set();
    store.set();
    unsubscribe();
    store.set(source);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot()?.point.x).toBe(1);
  });
});
