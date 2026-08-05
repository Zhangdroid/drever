import {
  DreverRenderModeProvider,
  MDXRenderer,
  SlideStateProvider,
  type MDXComponents,
  type MDXContent,
  type ResolvedSlideState,
  type SlideIdentity,
} from "@drever/core";
import type { CanvasDefinition, DeckManifest, PlannedTheme, SlideManifest } from "@drever/schema";
import { useLayoutEffect, type CSSProperties, type ReactElement } from "react";
import { DEFAULT_CANVAS, resolveCanvasThemeStyle } from "./canvas.tsx";
import type { DeckPosition } from "./presentation-state.ts";
import { PresentationStage, type StageComponents } from "./stage.tsx";
import { scheduleStableMountNotification } from "./viewer-lifecycle.ts";

type DocumentStyle = CSSProperties &
  Readonly<{
    "--drever-canvas-height": number;
    "--drever-canvas-width": number;
    "--drever-theme-token-canvas"?: string;
    "--drever-theme-token-ink"?: string;
  }>;

export type DeckDocumentProps = Readonly<{
  audienceURL: string;
  Content: MDXContent;
  canvas?: CanvasDefinition;
  documentURL: string;
  manifest: DeckManifest;
  registry?: MDXComponents;
  stage?: StageComponents;
  theme?: PlannedTheme;
}>;

const finalStep = (slide: SlideManifest): number => slide.stepStops.at(-1) ?? 0;
const slideURL = (documentURL: string, slideId: string): string => {
  const url = new URL(documentURL);
  url.hash = slideId;
  return url.href;
};

type DocumentPageProps = Readonly<{
  Content: MDXContent;
  canvas: CanvasDefinition;
  manifest: DeckManifest;
  registry?: MDXComponents;
  slide: SlideManifest;
  stage?: StageComponents;
}>;

const DocumentPage = ({
  Content,
  canvas,
  manifest,
  registry,
  slide,
  stage,
}: DocumentPageProps): ReactElement => {
  const position: DeckPosition = Object.freeze({
    slideId: slide.id,
    slideIndex: slide.index,
    step: finalStep(slide),
  });
  const resolve = (identity: SlideIdentity): ResolvedSlideState => {
    const identified = identity.id !== undefined || identity.index !== undefined;
    const active =
      identified &&
      (identity.id === undefined || identity.id === slide.id) &&
      (identity.index === undefined || identity.index === slide.index);
    return Object.freeze({
      active,
      currentStep: active ? position.step : 0,
      ...(active && slide.title !== undefined ? { label: slide.title } : {}),
    });
  };

  return (
    <article
      className="drever-document__page"
      data-drever-document-page=""
      data-slide-id={slide.id}
      data-slide-index={slide.index}
    >
      <DreverRenderModeProvider mode="document">
        <PresentationStage
          canvas={canvas}
          manifest={manifest}
          position={position}
          reducedMotion
          renderMode="document"
          {...(stage === undefined ? {} : { stage })}
        >
          <div className="drever-deck" data-drever-deck="" data-drever-render-mode="document">
            <SlideStateProvider pruneInactive resolver={resolve}>
              <MDXRenderer Content={Content} {...(registry === undefined ? {} : { registry })} />
            </SlideStateProvider>
          </div>
        </PresentationStage>
      </DreverRenderModeProvider>
    </article>
  );
};

/** Renders one searchable, fully revealed document with a named landmark per slide. */
export const DeckDocument = ({
  audienceURL,
  Content,
  canvas = DEFAULT_CANVAS,
  documentURL,
  manifest,
  registry,
  stage,
  theme,
}: DeckDocumentProps): ReactElement => {
  const style: DocumentStyle = {
    "--drever-canvas-height": canvas.height,
    "--drever-canvas-width": canvas.width,
    ...resolveCanvasThemeStyle(theme),
  };

  return (
    <div className="drever-document drever-viewer" data-drever-document="" style={style}>
      <header className="drever-document__header" dir="ltr" lang="en">
        <div>
          <p>Drever document</p>
          <h1>Presentation transcript</h1>
          <span>{manifest.slides.length} slides · fully revealed</span>
        </div>
        <a href={audienceURL}>Return to presentation</a>
      </header>
      <nav aria-labelledby="drever-document-toc-label" className="drever-document__toc">
        <span className="drever-visually-hidden" dir="ltr" id="drever-document-toc-label" lang="en">
          Slides
        </span>
        <ol>
          {manifest.slides.map((slide) => (
            <li key={slide.id}>
              <a href={slideURL(documentURL, slide.id)}>
                <span>{String(slide.index + 1).padStart(2, "0")}</span>
                {slide.title === undefined ? (
                  <span dir="ltr" lang="en">
                    Slide {slide.index + 1}
                  </span>
                ) : (
                  <span>{slide.title}</span>
                )}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="drever-document__pages">
        <div className="drever-document__deck">
          {manifest.slides.map((slide) => (
            <DocumentPage
              Content={Content}
              canvas={canvas}
              key={slide.id}
              manifest={manifest}
              {...(registry === undefined ? {} : { registry })}
              slide={slide}
              {...(stage === undefined ? {} : { stage })}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export type DocumentHostProps = DeckDocumentProps &
  Readonly<{
    onMounted(): void;
  }>;

/** @internal Provides StrictMode-safe commit notification to createDocument. */
export const DocumentHost = ({ onMounted, ...props }: DocumentHostProps): ReactElement => {
  useLayoutEffect(() => scheduleStableMountNotification(onMounted), [onMounted]);
  return <DeckDocument {...props} />;
};
