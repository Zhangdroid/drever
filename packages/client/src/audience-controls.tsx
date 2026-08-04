/// <reference types="react/canary" />

import type { CanvasDefinition, DeckManifest, SlideManifest } from "@drever/schema";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import { DreverClientError } from "./client-error.ts";
import { createFullscreenSession } from "./fullscreen-session.ts";
import { acceptsPresentationShortcut } from "./keyboard.ts";
import {
  CloseIcon,
  DocumentIcon,
  FullscreenIcon,
  HelpIcon,
  NextIcon,
  OverviewIcon,
  PreviousIcon,
  ShareIcon,
  SpeakerIcon,
} from "./presentation-icons.tsx";
import type { DeckCommand, DeckPosition } from "./presentation-state.ts";
import { PresentationFocusTools } from "./presentation-focus-tools.tsx";
import type { PresentationFocusAppearance } from "./presentation-focus.ts";
import type { PresentationFocusStore } from "./presentation-focus-store.ts";

type AudiencePanel = "help" | "overview";
type PauseScreen = "black" | "white";
type ShareResult = "copied" | "failed";

const PRESENTATION_CONTROLS_REVEAL_ZONE_PX = 80;
const PRESENTATION_CONTROLS_IDLE_DELAY_MS = 1_200;

type ShareFeedback = Readonly<{
  positionKey: string;
  result: ShareResult;
}>;

export type AudienceControlsProps = Readonly<{
  canvas: CanvasDefinition;
  canvasRef: RefObject<HTMLDivElement | null>;
  deckRef: RefObject<HTMLDivElement | null>;
  focusTools?: PresentationFocusAppearance;
  hiddenForNavigation: boolean;
  manifest: DeckManifest;
  onCopyShareURL(position: DeckPosition): Promise<void>;
  onError(error: unknown): void;
  onNavigate(command: DeckCommand): void | Promise<void>;
  onOpenDocument(): void;
  onOpenSpeaker(): void;
  onPointerIntent(): void;
  position: DeckPosition;
  remoteFocus: PresentationFocusStore;
  renderSlidePreview(slide: SlideManifest): ReactNode;
}>;

export type AudienceProgress = Readonly<{
  canGoNext: boolean;
  canGoPrevious: boolean;
  slideLabel: string;
  stepLabel?: string;
}>;

export type SlideNavigationItem = Readonly<{
  id: string;
  index: number;
  title: string;
  titleLanguage?: "en";
}>;

const compactText = (value: string | null | undefined): string | undefined => {
  const compact = value?.replace(/\s+/gu, " ").trim();
  return compact === undefined || compact.length === 0 ? undefined : compact;
};

const releasePointerFocus = (
  event: Readonly<{ currentTarget: HTMLButtonElement; detail: number }>,
): void => {
  if (event.detail > 0) {
    event.currentTarget.blur();
  }
};

export const readSlideNavigationItems = (
  deck: ParentNode | null,
  manifest: DeckManifest,
): readonly SlideNavigationItem[] =>
  Object.freeze(
    manifest.slides.map((slide) => {
      const element = deck?.querySelector<HTMLElement>(
        `[data-drever-slide][data-slide-index="${slide.index}"]`,
      );
      const heading = element?.querySelector("h1, h2, h3, h4, h5, h6");
      const title =
        compactText(element?.getAttribute("aria-label")) ??
        compactText(heading?.getAttribute("aria-label")) ??
        compactText(slide.title) ??
        compactText(heading?.textContent);
      return Object.freeze({
        id: slide.id,
        index: slide.index,
        title: title ?? `Slide ${slide.index + 1}`,
        ...(title === undefined ? { titleLanguage: "en" as const } : {}),
      });
    }),
  );

export type SlideOverviewItemProps = Readonly<{
  canvas: CanvasDefinition;
  current: boolean;
  onSelect(): void;
  previewRoot: RefObject<HTMLDivElement | null>;
  renderPreview(): ReactNode;
  slide: SlideNavigationItem;
}>;

/** Keeps authored preview content inert and separate from the card's navigation button. */
export const SlideOverviewItem = ({
  canvas,
  current,
  onSelect,
  previewRoot,
  renderPreview,
  slide,
}: SlideOverviewItemProps): ReactElement => {
  const cardRef = useRef<HTMLElement>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const ordinal = slide.index + 1;

  useEffect(() => {
    const card = cardRef.current;
    if (card === null || previewReady) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting === true) {
          setPreviewReady(true);
          observer.disconnect();
        }
      },
      {
        root: previewRoot.current,
        rootMargin: "320px 0px",
      },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [previewReady, previewRoot]);

  return (
    <article
      className="drever-audience-slide-card"
      data-current={current ? "" : undefined}
      data-slide-index={slide.index}
      ref={cardRef}
    >
      <div
        aria-hidden="true"
        className="drever-audience-slide-preview"
        data-drever-slide-preview=""
        inert
        style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
      >
        {previewReady ? renderPreview() : null}
      </div>
      <div aria-hidden="true" className="drever-audience-slide-meta">
        <span>{String(ordinal).padStart(2, "0")}</span>
        <strong
          dir={slide.titleLanguage === undefined ? undefined : "ltr"}
          lang={slide.titleLanguage}
        >
          {slide.title}
        </strong>
        {current ? (
          <small dir="ltr" lang="en">
            Now
          </small>
        ) : null}
      </div>
      <button
        aria-current={current ? "page" : undefined}
        className="drever-audience-slide-link"
        onClick={onSelect}
        type="button"
      >
        <span className="drever-visually-hidden">
          <span dir="ltr" lang="en">
            Go to slide {ordinal}:{" "}
          </span>
          <span
            dir={slide.titleLanguage === undefined ? undefined : "ltr"}
            lang={slide.titleLanguage}
          >
            {slide.title}
          </span>
        </span>
      </button>
    </article>
  );
};

const lastStep = (slide: SlideManifest): number => slide.stepStops.at(-1) ?? 0;

export const resolveAudienceProgress = (
  manifest: DeckManifest,
  position: DeckPosition,
): AudienceProgress => {
  const slide = manifest.slides[position.slideIndex] as SlideManifest;
  const stepIndex = position.step === 0 ? 0 : slide.stepStops.indexOf(position.step) + 1;
  const lastSlide = manifest.slides.at(-1) as SlideManifest;
  return Object.freeze({
    canGoNext: position.slideIndex !== lastSlide.index || position.step !== lastStep(lastSlide),
    canGoPrevious: position.slideIndex !== 0 || position.step !== 0,
    slideLabel: `Slide ${position.slideIndex + 1} of ${manifest.slides.length}`,
    ...(slide.stepStops.length === 0
      ? {}
      : { stepLabel: `Step ${stepIndex} of ${slide.stepStops.length}` }),
  });
};

const shortcutRows = Object.freeze([
  ["Next Step", "→  Space  Page Down"],
  ["Previous Step", "←  Shift+Space  Page Up"],
  ["Next / previous slide", "↓  ↑"],
  ["First / last state", "Home  End"],
  ["Slide navigator", "O  G"],
  ["Go to slide", "Number, then Enter"],
  ["Document view", "D"],
  ["Speaker view", "P"],
  ["Laser pointer", "L"],
  ["Pen / ink", "I"],
  ["Highlighter", "H"],
  ["Fullscreen", "F"],
  ["Pause on black / white", "B  W"],
  ["Keyboard help", "?"],
] as const);

const useIdleControls = (
  hostRef: RefObject<HTMLDivElement | null>,
  barRef: RefObject<HTMLElement | null>,
  focusInteracting: boolean,
  controlsPinned: boolean,
): boolean => {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    const window = hostRef.current?.ownerDocument.defaultView;
    if (controlsPinned) {
      setIdle(false);
      return;
    }
    if (
      focusInteracting &&
      window !== null &&
      window !== undefined &&
      window.matchMedia("(pointer: fine)").matches
    ) {
      setIdle(true);
    }
  }, [controlsPinned, focusInteracting, hostRef]);

  useEffect(() => {
    const document = hostRef.current?.ownerDocument;
    if (document === undefined) {
      return;
    }
    const window = document.defaultView;
    if (window === null || !window.matchMedia("(pointer: fine)").matches) {
      return;
    }

    let timeout: number | undefined;
    const clearIdleTimer = (): void => window.clearTimeout(timeout);
    const scheduleIdle = (): void => {
      clearIdleTimer();
      if (controlsPinned || barRef.current?.contains(document.activeElement) === true) {
        return;
      }
      timeout = window.setTimeout(() => setIdle(true), PRESENTATION_CONTROLS_IDLE_DELAY_MS);
    };
    const show = (event: PointerEvent): void => {
      if (controlsPinned) {
        clearIdleTimer();
        setIdle(false);
        return;
      }
      const target = event.target;
      const pointsAtFocusLayer =
        target instanceof window.Element &&
        target.closest("[data-drever-focus-layer][data-active]") !== null;
      if (
        pointsAtFocusLayer &&
        event.clientY < window.innerHeight - PRESENTATION_CONTROLS_REVEAL_ZONE_PX
      ) {
        clearIdleTimer();
        setIdle(true);
        return;
      }
      setIdle(false);
      scheduleIdle();
    };
    const handleFocusIn = (event: FocusEvent): void => {
      if (event.target instanceof window.Node && barRef.current?.contains(event.target) === true) {
        clearIdleTimer();
        setIdle(false);
      }
    };
    const handleFocusOut = (event: FocusEvent): void => {
      if (
        !(event.relatedTarget instanceof window.Node) ||
        !barRef.current?.contains(event.relatedTarget)
      ) {
        scheduleIdle();
      }
    };

    document.addEventListener("pointermove", show, { passive: true });
    document.addEventListener("pointerdown", show, { passive: true });
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    scheduleIdle();
    return () => {
      clearIdleTimer();
      document.removeEventListener("pointermove", show);
      document.removeEventListener("pointerdown", show);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, [barRef, controlsPinned, hostRef]);

  return idle;
};

/** Discoverable live controls with a stable visual group above the transitioning canvas. */
export const AudienceControls = ({
  canvas,
  canvasRef,
  deckRef,
  focusTools,
  hiddenForNavigation,
  manifest,
  onCopyShareURL,
  onError,
  onNavigate,
  onOpenDocument,
  onOpenSpeaker,
  onPointerIntent,
  position,
  remoteFocus,
  renderSlidePreview,
}: AudienceControlsProps): ReactElement => {
  const hostRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [focusInteracting, setFocusInteracting] = useState(false);
  const [focusPaletteOpen, setFocusPaletteOpen] = useState(false);
  const [gotoBuffer, setGotoBuffer] = useState("");
  const [gotoError, setGotoError] = useState<string>();
  const [mobileHintDismissed, setMobileHintDismissed] = useState(false);
  const [panel, setPanel] = useState<AudiencePanel>();
  const [pauseScreen, setPauseScreen] = useState<PauseScreen>();
  const [query, setQuery] = useState("");
  const [shareFeedback, setShareFeedback] = useState<ShareFeedback>();
  const [slides, setSlides] = useState<readonly SlideNavigationItem[]>(() =>
    readSlideNavigationItems(null, manifest),
  );
  const controlsIdle = useIdleControls(hostRef, barRef, focusInteracting, focusPaletteOpen);
  const progress = resolveAudienceProgress(manifest, position);
  const positionKey = `${position.slideId}:${position.step}`;
  const visibleShareResult =
    shareFeedback?.positionKey === positionKey ? shareFeedback.result : undefined;

  useEffect(() => {
    if (visibleShareResult === undefined) {
      return;
    }
    const timeout = globalThis.setTimeout(() => setShareFeedback(undefined), 2_400);
    return () => globalThis.clearTimeout(timeout);
  }, [visibleShareResult]);

  useLayoutEffect(() => {
    setSlides(readSlideNavigationItems(deckRef.current, manifest));
  }, [deckRef, manifest, panel, position.slideIndex]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (panel === undefined) {
      if (dialog.open) {
        dialog.close();
      }
    } else if (!dialog.open) {
      dialog.showModal();
      if (panel === "overview") {
        searchRef.current?.focus();
      }
    }
  }, [panel]);

  useEffect(() => {
    const document = hostRef.current?.ownerDocument;
    if (document === undefined) {
      return;
    }
    const session = createFullscreenSession({ document, onError });
    const update = (): void => setFullscreen(document.fullscreenElement !== null);
    update();
    document.addEventListener("fullscreenchange", update);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      session.dispose();
    };
  }, [onError]);

  const run = useCallback(
    (action: () => void | Promise<void>): void => {
      try {
        Promise.resolve(action()).catch(onError);
      } catch (error) {
        onError(error);
      }
    },
    [onError],
  );

  const navigate = useCallback(
    (command: DeckCommand): void => run(() => onNavigate(command)),
    [onNavigate, run],
  );

  useEffect(() => {
    const document = hostRef.current?.ownerDocument;
    if (document === undefined || !hiddenForNavigation) {
      return;
    }

    const reveal = (event: PointerEvent): void => {
      if (document.documentElement.matches(":active-view-transition")) {
        return;
      }
      if (event.type === "pointerdown" || event.movementX !== 0 || event.movementY !== 0) {
        onPointerIntent();
      }
    };
    document.addEventListener("pointerdown", reveal, { passive: true });
    document.addEventListener("pointermove", reveal, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", reveal);
      document.removeEventListener("pointermove", reveal);
    };
  }, [hiddenForNavigation, onPointerIntent]);

  const copyShareURL = useCallback((): void => {
    const requestedPosition = position;
    const requestedPositionKey = positionKey;
    setShareFeedback(undefined);

    void Promise.resolve()
      .then(() => onCopyShareURL(requestedPosition))
      .then(
        () => setShareFeedback({ positionKey: requestedPositionKey, result: "copied" }),
        (error: unknown) => {
          setShareFeedback({ positionKey: requestedPositionKey, result: "failed" });
          onError(error);
        },
      );
  }, [onCopyShareURL, onError, position, positionKey]);

  const jumpTo = useCallback(
    (slide: SlideNavigationItem): void => {
      setPanel(undefined);
      setGotoBuffer("");
      setGotoError(undefined);
      navigate({ type: "goTo", slideId: slide.id });
    },
    [navigate],
  );

  const submitGoto = useCallback((): void => {
    const ordinal = Number(gotoBuffer);
    const slide = slides[ordinal - 1];
    if (slide === undefined) {
      setGotoError(`Slide ${gotoBuffer} does not exist.`);
      return;
    }
    jumpTo(slide);
  }, [gotoBuffer, jumpTo, slides]);

  const toggleFullscreen = useCallback((): void => {
    run(async () => {
      const document = hostRef.current?.ownerDocument;
      if (document === undefined) {
        throw new DreverClientError(
          "DREVER_CLIENT_CONTROLS_UNMOUNTED",
          "The audience controls are not connected to a document.",
        );
      }
      if (document.fullscreenElement === null) {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      } else {
        await document.exitFullscreen();
      }
    });
  }, [run]);

  useEffect(() => {
    const document = hostRef.current?.ownerDocument;
    if (document === undefined) {
      return;
    }
    const listener = (event: KeyboardEvent): void => {
      if (!acceptsPresentationShortcut(event) || event.repeat) {
        return;
      }

      if (/^\d$/u.test(event.key)) {
        event.preventDefault();
        setGotoBuffer((current) => `${current}${event.key}`.replace(/^0+(?=\d)/u, ""));
        setGotoError(undefined);
        return;
      }
      if (event.key === "Backspace" && gotoBuffer.length > 0) {
        event.preventDefault();
        setGotoBuffer((current) => current.slice(0, -1));
        setGotoError(undefined);
        return;
      }
      if (event.key === "Enter" && gotoBuffer.length > 0) {
        event.preventDefault();
        submitGoto();
        return;
      }
      if (event.key === "Escape" && (pauseScreen !== undefined || gotoBuffer.length > 0)) {
        event.preventDefault();
        setPauseScreen(undefined);
        setGotoBuffer("");
        setGotoError(undefined);
        return;
      }

      switch (event.key.toLowerCase()) {
        case "b":
          event.preventDefault();
          setPauseScreen((current) => (current === "black" ? undefined : "black"));
          break;
        case "d":
          event.preventDefault();
          run(onOpenDocument);
          break;
        case "f":
          event.preventDefault();
          toggleFullscreen();
          break;
        case "g":
        case "o":
          event.preventDefault();
          setQuery("");
          setPanel("overview");
          break;
        case "w":
          event.preventDefault();
          setPauseScreen((current) => (current === "white" ? undefined : "white"));
          break;
        default:
          if (event.key === "?") {
            event.preventDefault();
            setPanel("help");
          }
      }
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [gotoBuffer, onOpenDocument, pauseScreen, run, submitGoto, toggleFullscreen]);

  const visibleSlides = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) {
      return slides;
    }
    return slides.filter(
      (slide) =>
        String(slide.index + 1).includes(needle) || slide.title.toLowerCase().includes(needle),
    );
  }, [query, slides]);

  const closePanel = (): void => setPanel(undefined);

  return (
    <div
      className="drever-audience-controls"
      data-drever-audience-controls=""
      data-drever-controls-idle={controlsIdle ? "" : undefined}
      data-drever-controls-navigation-hidden={hiddenForNavigation ? "" : undefined}
      data-drever-controls-pinned={focusPaletteOpen ? "" : undefined}
      data-drever-focus-interacting={focusInteracting ? "" : undefined}
      ref={hostRef}
    >
      {mobileHintDismissed ? null : (
        <aside
          aria-label="Mobile viewing options"
          className="drever-audience-mobile-hint"
          dir="ltr"
          lang="en"
        >
          <span>Rotate for the live deck.</span>
          <button
            aria-label="Read presentation as a document"
            onClick={() => run(onOpenDocument)}
            type="button"
          >
            Read instead
          </button>
          <button
            aria-label="Dismiss mobile viewing hint"
            onClick={() => setMobileHintDismissed(true)}
            type="button"
          >
            <CloseIcon />
          </button>
        </aside>
      )}

      <nav
        aria-label="Presentation controls"
        className="drever-audience-controls__bar"
        dir="ltr"
        lang="en"
        ref={barRef}
      >
        <div className="drever-audience-controls__scroll">
          <button
            aria-keyshortcuts="ArrowLeft"
            aria-label="Previous presentation state"
            data-drever-audience-navigation-control=""
            data-drever-tooltip="Previous step · ←"
            disabled={!progress.canGoPrevious}
            onClick={(event) => {
              releasePointerFocus(event);
              navigate({ type: "previous" });
            }}
            type="button"
          >
            <PreviousIcon />
          </button>
          <button
            aria-keyshortcuts="O"
            aria-label="Open slide navigator"
            className="drever-audience-controls__position"
            data-drever-tooltip="Slide navigator · O"
            onClick={() => setPanel("overview")}
            type="button"
          >
            <OverviewIcon />
            <span>
              <strong>{progress.slideLabel}</strong>
              {progress.stepLabel === undefined ? null : <small>{progress.stepLabel}</small>}
            </span>
          </button>
          <button
            aria-keyshortcuts="ArrowRight"
            aria-label="Next presentation state"
            data-drever-audience-navigation-control=""
            data-drever-tooltip="Next step · →"
            disabled={!progress.canGoNext}
            onClick={(event) => {
              releasePointerFocus(event);
              navigate({ type: "next" });
            }}
            type="button"
          >
            <NextIcon />
          </button>
          <span aria-hidden="true" className="drever-audience-controls__divider" />
          <button
            aria-label="Copy link to current presentation state"
            data-drever-tooltip="Copy link"
            data-share-result={visibleShareResult}
            onClick={(event) => {
              releasePointerFocus(event);
              copyShareURL();
            }}
            type="button"
          >
            <ShareIcon />
          </button>
          <button
            aria-keyshortcuts="D"
            aria-label="Open document view"
            data-drever-tooltip="Document view · D"
            onClick={(event) => {
              releasePointerFocus(event);
              run(onOpenDocument);
            }}
            type="button"
          >
            <DocumentIcon />
          </button>
          <button
            aria-keyshortcuts="P"
            aria-label="Open speaker view"
            data-drever-tooltip="Speaker view · P"
            onClick={(event) => {
              releasePointerFocus(event);
              run(onOpenSpeaker);
            }}
            type="button"
          >
            <SpeakerIcon />
          </button>
        </div>
        <PresentationFocusTools
          {...(focusTools === undefined ? {} : { appearance: focusTools })}
          canvas={canvas}
          canvasRef={canvasRef}
          onInteractionChange={setFocusInteracting}
          onPaletteOpenChange={setFocusPaletteOpen}
          position={position}
          remoteFocus={remoteFocus}
        />
        <button
          aria-keyshortcuts="F"
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          data-drever-tooltip={`${fullscreen ? "Exit" : "Enter"} fullscreen · F`}
          onClick={(event) => {
            releasePointerFocus(event);
            toggleFullscreen();
          }}
          type="button"
        >
          <FullscreenIcon active={fullscreen} />
        </button>
        <button
          aria-keyshortcuts="?"
          aria-label="Show keyboard shortcuts"
          data-drever-tooltip="Keyboard shortcuts · ?"
          onClick={() => setPanel("help")}
          type="button"
        >
          <HelpIcon />
        </button>
      </nav>

      {visibleShareResult === undefined ? null : (
        <div
          aria-atomic="true"
          aria-live="polite"
          className="drever-audience-share-status"
          data-share-result={visibleShareResult}
          dir="ltr"
          lang="en"
          role="status"
        >
          {visibleShareResult === "copied" ? "Link copied." : "Could not copy link."}
        </div>
      )}

      {gotoBuffer.length === 0 ? null : (
        <div
          aria-atomic="true"
          aria-live="polite"
          className="drever-audience-goto"
          dir="ltr"
          lang="en"
          role="status"
        >
          <span>Go to slide</span>
          <strong>{gotoBuffer}</strong>
          {gotoError === undefined ? <small>Press Enter</small> : <small>{gotoError}</small>}
        </div>
      )}

      {pauseScreen === undefined ? null : (
        <button
          aria-label={`${pauseScreen === "black" ? "Black" : "White"} pause screen. Press Escape to return.`}
          className="drever-audience-pause"
          data-pause-screen={pauseScreen}
          dir="ltr"
          lang="en"
          onClick={() => setPauseScreen(undefined)}
          type="button"
        />
      )}

      <dialog
        aria-labelledby="drever-audience-dialog-title"
        className="drever-audience-dialog"
        data-panel={panel}
        onCancel={closePanel}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closePanel();
          }
        }}
        onClose={closePanel}
        ref={dialogRef}
      >
        {panel === "overview" ? (
          <div className="drever-audience-dialog__content">
            <header dir="ltr" lang="en">
              <div>
                <span>Drever</span>
                <h2 id="drever-audience-dialog-title">Slide navigator</h2>
              </div>
              <button aria-label="Close slide navigator" onClick={closePanel} type="button">
                <CloseIcon />
              </button>
            </header>
            <label className="drever-audience-dialog__search" dir="ltr" lang="en">
              <span className="drever-visually-hidden">Find a slide</span>
              <input
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Find by title or number"
                ref={searchRef}
                type="search"
                value={query}
              />
            </label>
            <div className="drever-audience-dialog__slides" ref={overviewRef}>
              {visibleSlides.map((slide) => {
                const manifestSlide = manifest.slides[slide.index] as SlideManifest;
                return (
                  <SlideOverviewItem
                    canvas={canvas}
                    current={slide.index === position.slideIndex}
                    key={slide.id}
                    onSelect={() => jumpTo(slide)}
                    previewRoot={overviewRef}
                    renderPreview={() => renderSlidePreview(manifestSlide)}
                    slide={slide}
                  />
                );
              })}
              {visibleSlides.length === 0 ? (
                <p dir="ltr" lang="en">
                  No slides match “{query}”.
                </p>
              ) : null}
            </div>
          </div>
        ) : panel === "help" ? (
          <div
            className="drever-audience-dialog__content drever-audience-dialog__content--help"
            dir="ltr"
            lang="en"
          >
            <header>
              <div>
                <span>Drever</span>
                <h2 id="drever-audience-dialog-title">Keyboard shortcuts</h2>
              </div>
              <button aria-label="Close keyboard shortcuts" onClick={closePanel} type="button">
                <CloseIcon />
              </button>
            </header>
            <dl>
              {shortcutRows.map(([label, keys]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{keys}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </dialog>
    </div>
  );
};
