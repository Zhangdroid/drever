export type KeyboardCommand =
  | "first"
  | "last"
  | "next"
  | "nextSlide"
  | "previous"
  | "previousSlide";

export type KeyboardNavigationSurface = "audience" | "speaker";

export type KeyboardEventInput = Readonly<
  Pick<
    KeyboardEvent,
    | "altKey"
    | "ctrlKey"
    | "defaultPrevented"
    | "isComposing"
    | "key"
    | "metaKey"
    | "repeat"
    | "shiftKey"
  > & {
    target: EventTarget | null;
  }
>;

type ClosestTarget = Readonly<{
  closest(selectors: string): Element | null;
}>;

const IGNORED_TARGETS = [
  "input",
  "textarea",
  "select",
  "button",
  "summary",
  "a[href]",
  "audio[controls]",
  "video[controls]",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable]:not([contenteditable='false'])",
  "[aria-haspopup]",
  "[role='button']",
  "[role='checkbox']",
  "[role='combobox']",
  "[role='grid']",
  "[role='listbox']",
  "[role='menu']",
  "[role='menuitem']",
  "[role='option']",
  "[role='radio']",
  "[role='scrollbar']",
  "[role='slider']",
  "[role='spinbutton']",
  "[role='switch']",
  "[role='tab']",
  "[role='textbox']",
  "[role='tree']",
  "[role='treeitem']",
  "[data-drever-keyboard='ignore']",
].join(",");

const SPEAKER_CONTROLS = "[data-drever-speaker-controls]";
const SPEAKER_EDITABLE_CONTROLS =
  "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

const canFindClosest = (value: EventTarget | null): value is EventTarget & ClosestTarget =>
  value !== null &&
  "closest" in value &&
  typeof (value as Partial<ClosestTarget>).closest === "function";

const isHandledOrModified = (event: KeyboardEventInput): boolean =>
  event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey;

const hasIgnoredTarget = (target: EventTarget | null): boolean =>
  canFindClosest(target) && target.closest(IGNORED_TARGETS) !== null;

/** Applies the shared input policy for non-navigation presentation shortcuts. */
export const acceptsPresentationShortcut = (event: KeyboardEventInput): boolean =>
  !isHandledOrModified(event) && !hasIgnoredTarget(event.target);

const commandForKey = (event: KeyboardEventInput): KeyboardCommand | undefined => {
  if (event.key === " " || event.key === "Spacebar") {
    return event.shiftKey ? "previous" : "next";
  }

  switch (event.key) {
    case "ArrowDown":
      return "nextSlide";
    case "ArrowRight":
    case "PageDown":
      return "next";
    case "ArrowLeft":
    case "PageUp":
      return "previous";
    case "ArrowUp":
      return "previousSlide";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return undefined;
  }
};

const isSpaceKey = (key: string): boolean => key === " " || key === "Spacebar";

export const keyboardCommandFor = (
  event: KeyboardEventInput,
  surface: KeyboardNavigationSurface = "audience",
): KeyboardCommand | undefined => {
  if (isHandledOrModified(event)) {
    return undefined;
  }

  const command = commandForKey(event);
  if (command === undefined || !canFindClosest(event.target)) {
    return command;
  }

  const ignored = event.target.closest(IGNORED_TARGETS) !== null;
  if (!ignored) {
    return command;
  }

  const speakerNavigation =
    surface === "speaker" &&
    !isSpaceKey(event.key) &&
    event.target.closest(SPEAKER_CONTROLS) !== null &&
    event.target.closest(SPEAKER_EDITABLE_CONTROLS) === null;
  return speakerNavigation ? command : undefined;
};

/** Opens one speaker window from an unmodified audience shortcut. */
export const isOpenSpeakerShortcut = (event: KeyboardEventInput): boolean =>
  !event.repeat && (event.key === "p" || event.key === "P") && acceptsPresentationShortcut(event);

export type KeyboardEventTarget = Readonly<{
  addEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void;
}>;

export type AttachKeyboardNavigationOptions = Readonly<{
  target: KeyboardEventTarget;
  onCommand(command: KeyboardCommand): void | Promise<void>;
  onError(error: unknown): void;
  onOpenSpeaker?(): void | Promise<void>;
  surface?: KeyboardNavigationSurface;
}>;

export const attachKeyboardNavigation = ({
  target,
  onCommand,
  onError,
  onOpenSpeaker,
  surface = "audience",
}: AttachKeyboardNavigationOptions): (() => void) => {
  const run = (action: () => void | Promise<void>): void => {
    try {
      Promise.resolve(action()).catch(onError);
    } catch (error) {
      onError(error);
    }
  };
  const listener = (event: KeyboardEvent): void => {
    if (surface === "audience" && onOpenSpeaker !== undefined && isOpenSpeakerShortcut(event)) {
      event.preventDefault();
      run(onOpenSpeaker);
      return;
    }

    const command = keyboardCommandFor(event, surface);
    if (command === undefined) {
      return;
    }

    event.preventDefault();
    run(() => onCommand(command));
  };
  target.addEventListener("keydown", listener);
  return () => target.removeEventListener("keydown", listener);
};
