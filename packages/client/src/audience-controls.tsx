import type { DeckManifest, SlideManifest } from "@drever/schema";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
  type SVGProps,
} from "react";
import { DreverClientError } from "./client-error.ts";
import { acceptsPresentationShortcut } from "./keyboard.ts";
import type { DeckCommand, DeckPosition } from "./presentation-state.ts";

type AudiencePanel = "help" | "overview";
type PauseScreen = "black" | "white";

export type AudienceControlsProps = Readonly<{
  deckRef: RefObject<HTMLDivElement | null>;
  manifest: DeckManifest;
  onError(error: unknown): void;
  onNavigate(command: DeckCommand): void | Promise<void>;
  onOpenSpeaker(): void;
  position: DeckPosition;
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
}>;

const compactText = (value: string | null | undefined): string | undefined => {
  const compact = value?.replace(/\s+/gu, " ").trim();
  return compact === undefined || compact.length === 0 ? undefined : compact;
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
      return Object.freeze({
        id: slide.id,
        index: slide.index,
        title:
          compactText(element?.getAttribute("aria-label")) ??
          compactText(heading?.textContent) ??
          compactText(slide.title) ??
          `Slide ${slide.index + 1}`,
      });
    }),
  );

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

const Icon = ({ children, ...props }: SVGProps<SVGSVGElement>): ReactElement => (
  <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18" {...props}>
    {children}
  </svg>
);

const PreviousIcon = (): ReactElement => (
  <Icon>
    <path
      d="m15 18-6-6 6-6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </Icon>
);

const NextIcon = (): ReactElement => (
  <Icon>
    <path
      d="m9 6 6 6-6 6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </Icon>
);

const OverviewIcon = (): ReactElement => (
  <Icon>
    <rect height="5" rx="1" stroke="currentColor" strokeWidth="1.6" width="7" x="3" y="4" />
    <rect height="5" rx="1" stroke="currentColor" strokeWidth="1.6" width="7" x="14" y="4" />
    <rect height="5" rx="1" stroke="currentColor" strokeWidth="1.6" width="7" x="3" y="15" />
    <rect height="5" rx="1" stroke="currentColor" strokeWidth="1.6" width="7" x="14" y="15" />
  </Icon>
);

const SpeakerIcon = (): ReactElement => (
  <Icon>
    <path
      d="M5 19h14M8 19v-4h8v4M6 5h12v10H6z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
    <path d="m10 8 4 2-4 2z" fill="currentColor" />
  </Icon>
);

const FullscreenIcon = ({ active }: Readonly<{ active: boolean }>): ReactElement => (
  <Icon>
    {active ? (
      <path
        d="M9 4v5H4m11-5v5h5M9 20v-5H4m11 5v-5h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    ) : (
      <path
        d="M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    )}
  </Icon>
);

const HelpIcon = (): ReactElement => (
  <Icon>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M9.8 9.2a2.35 2.35 0 1 1 3.04 2.24c-.84.3-.84.9-.84 1.56"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
    />
    <circle cx="12" cy="16.5" fill="currentColor" r="1" />
  </Icon>
);

const shortcutRows = Object.freeze([
  ["Next Step", "→  Space  Page Down"],
  ["Previous Step", "←  Shift+Space  Page Up"],
  ["Next / previous slide", "↓  ↑"],
  ["First / last state", "Home  End"],
  ["Slide navigator", "O  G"],
  ["Go to slide", "Number, then Enter"],
  ["Speaker view", "P"],
  ["Fullscreen", "F"],
  ["Pause on black / white", "B  W"],
  ["Keyboard help", "?"],
] as const);

/** Discoverable controls layered outside the transitioning presentation canvas. */
export const AudienceControls = ({
  deckRef,
  manifest,
  onError,
  onNavigate,
  onOpenSpeaker,
  position,
}: AudienceControlsProps): ReactElement => {
  const hostRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [gotoBuffer, setGotoBuffer] = useState("");
  const [gotoError, setGotoError] = useState<string>();
  const [panel, setPanel] = useState<AudiencePanel>();
  const [pauseScreen, setPauseScreen] = useState<PauseScreen>();
  const [query, setQuery] = useState("");
  const [slides, setSlides] = useState<readonly SlideNavigationItem[]>(() =>
    readSlideNavigationItems(null, manifest),
  );
  const progress = resolveAudienceProgress(manifest, position);

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
    const update = (): void => setFullscreen(document.fullscreenElement !== null);
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

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
  }, [gotoBuffer, pauseScreen, submitGoto, toggleFullscreen]);

  const visibleSlides = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (needle.length === 0) {
      return slides;
    }
    return slides.filter(
      (slide) =>
        String(slide.index + 1).includes(needle) ||
        slide.title.toLocaleLowerCase().includes(needle),
    );
  }, [query, slides]);

  const closePanel = (): void => setPanel(undefined);

  return (
    <div className="drever-audience-controls" data-drever-audience-controls="" ref={hostRef}>
      <nav aria-label="Presentation controls" className="drever-audience-controls__bar">
        <button
          aria-label="Previous presentation state"
          disabled={!progress.canGoPrevious}
          onClick={() => navigate({ type: "previous" })}
          title="Previous Step (Arrow Left)"
          type="button"
        >
          <PreviousIcon />
        </button>
        <button
          aria-label="Open slide navigator"
          className="drever-audience-controls__position"
          onClick={() => setPanel("overview")}
          title="Slide navigator (O)"
          type="button"
        >
          <OverviewIcon />
          <span>
            <strong>{progress.slideLabel}</strong>
            {progress.stepLabel === undefined ? null : <small>{progress.stepLabel}</small>}
          </span>
        </button>
        <button
          aria-label="Next presentation state"
          disabled={!progress.canGoNext}
          onClick={() => navigate({ type: "next" })}
          title="Next Step (Arrow Right)"
          type="button"
        >
          <NextIcon />
        </button>
        <span aria-hidden="true" className="drever-audience-controls__divider" />
        <button
          aria-label="Open speaker view"
          onClick={() => run(onOpenSpeaker)}
          title="Speaker view (P)"
          type="button"
        >
          <SpeakerIcon />
        </button>
        <button
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          onClick={toggleFullscreen}
          title={`${fullscreen ? "Exit" : "Enter"} fullscreen (F)`}
          type="button"
        >
          <FullscreenIcon active={fullscreen} />
        </button>
        <button
          aria-label="Show keyboard shortcuts"
          onClick={() => setPanel("help")}
          title="Keyboard shortcuts (?)"
          type="button"
        >
          <HelpIcon />
        </button>
      </nav>

      {gotoBuffer.length === 0 ? null : (
        <div aria-atomic="true" aria-live="polite" className="drever-audience-goto" role="status">
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
          onClick={() => setPauseScreen(undefined)}
          type="button"
        />
      )}

      <dialog
        aria-labelledby="drever-audience-dialog-title"
        className="drever-audience-dialog"
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
            <header>
              <div>
                <span>Drever</span>
                <h2 id="drever-audience-dialog-title">Slide navigator</h2>
              </div>
              <button aria-label="Close slide navigator" onClick={closePanel} type="button">
                ×
              </button>
            </header>
            <label className="drever-audience-dialog__search">
              <span className="drever-visually-hidden">Find a slide</span>
              <input
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Find by title or number"
                ref={searchRef}
                type="search"
                value={query}
              />
            </label>
            <div className="drever-audience-dialog__slides">
              {visibleSlides.map((slide) => (
                <button
                  aria-current={slide.index === position.slideIndex ? "page" : undefined}
                  className="drever-audience-slide-link"
                  key={slide.id}
                  onClick={() => jumpTo(slide)}
                  type="button"
                >
                  <span>{String(slide.index + 1).padStart(2, "0")}</span>
                  <strong>{slide.title}</strong>
                  {slide.index === position.slideIndex ? <small>Current</small> : null}
                </button>
              ))}
              {visibleSlides.length === 0 ? <p>No slides match “{query}”.</p> : null}
            </div>
          </div>
        ) : panel === "help" ? (
          <div className="drever-audience-dialog__content drever-audience-dialog__content--help">
            <header>
              <div>
                <span>Drever</span>
                <h2 id="drever-audience-dialog-title">Keyboard shortcuts</h2>
              </div>
              <button aria-label="Close keyboard shortcuts" onClick={closePanel} type="button">
                ×
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
