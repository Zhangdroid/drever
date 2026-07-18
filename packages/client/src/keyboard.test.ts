import { describe, expect, it, vi } from "vite-plus/test";
import {
  attachKeyboardNavigation,
  isOpenSpeakerShortcut,
  keyboardCommandFor,
  type KeyboardEventInput,
  type KeyboardEventTarget,
} from "./keyboard.ts";

const keyEvent = (key: string, input: Partial<KeyboardEventInput> = {}): KeyboardEventInput => ({
  altKey: false,
  ctrlKey: false,
  defaultPrevented: false,
  isComposing: false,
  key,
  metaKey: false,
  repeat: false,
  shiftKey: false,
  target: null,
  ...input,
});

describe("keyboard navigation", () => {
  it("maps presentation keys without reserving interaction shortcuts", () => {
    expect(keyboardCommandFor(keyEvent("ArrowRight"))).toBe("next");
    expect(keyboardCommandFor(keyEvent("ArrowDown"))).toBe("next");
    expect(keyboardCommandFor(keyEvent("PageDown"))).toBe("next");
    expect(keyboardCommandFor(keyEvent(" "))).toBe("next");
    expect(keyboardCommandFor(keyEvent(" ", { shiftKey: true }))).toBe("previous");
    expect(keyboardCommandFor(keyEvent("ArrowLeft"))).toBe("previous");
    expect(keyboardCommandFor(keyEvent("Home"))).toBe("first");
    expect(keyboardCommandFor(keyEvent("End"))).toBe("last");
    expect(keyboardCommandFor(keyEvent("o"))).toBeUndefined();
  });

  it("does not steal keys from interactive, opted-out, modified, or composing content", () => {
    for (const selector of [
      "video[controls]",
      "[tabindex]:not([tabindex='-1'])",
      "[role='slider']",
      "[role='tab']",
      "[data-drever-keyboard='ignore']",
    ]) {
      const target = {
        closest: (selectors: string) => (selectors.includes(selector) ? ({} as Element) : null),
      } as unknown as EventTarget;
      expect(keyboardCommandFor(keyEvent("ArrowRight", { target }))).toBeUndefined();
    }

    const passive = { closest: () => null } as unknown as EventTarget;
    expect(keyboardCommandFor(keyEvent("ArrowRight", { target: passive }))).toBe("next");
    expect(keyboardCommandFor(keyEvent("ArrowRight", { ctrlKey: true }))).toBeUndefined();
    expect(keyboardCommandFor(keyEvent("ArrowRight", { metaKey: true }))).toBeUndefined();
    expect(keyboardCommandFor(keyEvent("ArrowRight", { altKey: true }))).toBeUndefined();
    expect(keyboardCommandFor(keyEvent("ArrowRight", { isComposing: true }))).toBeUndefined();
    expect(keyboardCommandFor(keyEvent("ArrowRight", { defaultPrevented: true }))).toBeUndefined();
  });

  it("keeps remote navigation keys active on speaker chrome without stealing button activation", () => {
    const speakerButton = {
      closest: (selectors: string) =>
        selectors === "[data-drever-speaker-controls]" || selectors.includes("button")
          ? ({} as Element)
          : null,
    } as unknown as EventTarget;

    expect(keyboardCommandFor(keyEvent("ArrowRight", { target: speakerButton }))).toBeUndefined();
    expect(keyboardCommandFor(keyEvent("ArrowRight", { target: speakerButton }), "speaker")).toBe(
      "next",
    );
    expect(keyboardCommandFor(keyEvent("PageUp", { target: speakerButton }), "speaker")).toBe(
      "previous",
    );
    expect(keyboardCommandFor(keyEvent("Home", { target: speakerButton }), "speaker")).toBe(
      "first",
    );
    expect(keyboardCommandFor(keyEvent("End", { target: speakerButton }), "speaker")).toBe("last");
    expect(keyboardCommandFor(keyEvent(" ", { target: speakerButton }), "speaker")).toBeUndefined();
    expect(
      keyboardCommandFor(keyEvent(" ", { shiftKey: true, target: speakerButton }), "speaker"),
    ).toBeUndefined();
    expect(
      keyboardCommandFor(keyEvent("Enter", { target: speakerButton }), "speaker"),
    ).toBeUndefined();

    const notesScroller = {
      closest: (selectors: string) =>
        selectors.includes("[tabindex]:not([tabindex='-1'])") ? ({} as Element) : null,
    } as unknown as EventTarget;
    expect(
      keyboardCommandFor(keyEvent("PageDown", { target: notesScroller }), "speaker"),
    ).toBeUndefined();
  });

  it("reserves P for one audience speaker window without stealing editable input", () => {
    expect(isOpenSpeakerShortcut(keyEvent("p"))).toBe(true);
    expect(isOpenSpeakerShortcut(keyEvent("P", { shiftKey: true }))).toBe(true);
    expect(isOpenSpeakerShortcut(keyEvent("p", { repeat: true }))).toBe(false);
    expect(isOpenSpeakerShortcut(keyEvent("p", { metaKey: true }))).toBe(false);

    const input = {
      closest: (selectors: string) => (selectors.includes("input") ? ({} as Element) : null),
    } as unknown as EventTarget;
    const optedOut = {
      closest: (selectors: string) =>
        selectors.includes("[data-drever-keyboard='ignore']") ? ({} as Element) : null,
    } as unknown as EventTarget;
    expect(isOpenSpeakerShortcut(keyEvent("p", { target: input }))).toBe(false);
    expect(isOpenSpeakerShortcut(keyEvent("p", { target: optedOut }))).toBe(false);
  });

  it("attaches one disposable handler and routes asynchronous failures", async () => {
    let listener: ((event: KeyboardEvent) => void) | undefined;
    const target: KeyboardEventTarget = {
      addEventListener: (_type, next) => {
        listener = next;
      },
      removeEventListener: (_type, current) => {
        if (listener === current) {
          listener = undefined;
        }
      },
    };
    const onError = vi.fn();
    const preventDefault = vi.fn();
    const event = {
      ...keyEvent("ArrowRight"),
      preventDefault,
    } as unknown as KeyboardEvent;
    const dispose = attachKeyboardNavigation({
      target,
      onCommand: async () => {
        throw new Error("navigation failed");
      },
      onError,
    });

    listener?.(event);
    await Promise.resolve();
    await Promise.resolve();

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "navigation failed" }));
    dispose();
    expect(listener).toBeUndefined();
  });

  it("opens the speaker view through the same disposable audience handler", () => {
    let listener: ((event: KeyboardEvent) => void) | undefined;
    const target: KeyboardEventTarget = {
      addEventListener: (_type, next) => {
        listener = next;
      },
      removeEventListener: () => undefined,
    };
    const onCommand = vi.fn();
    const onOpenSpeaker = vi.fn();
    const preventDefault = vi.fn();
    attachKeyboardNavigation({
      target,
      onCommand,
      onError: vi.fn(),
      onOpenSpeaker,
    });

    listener?.({ ...keyEvent("p"), preventDefault } as unknown as KeyboardEvent);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onOpenSpeaker).toHaveBeenCalledOnce();
    expect(onCommand).not.toHaveBeenCalled();
  });
});
