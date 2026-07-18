import {
  DreverRenderModeProvider,
  MDXRenderer,
  SlideStateProvider,
  type MDXComponents,
  type MDXContent,
  type ResolvedSlideState,
  type SlideIdentity,
} from "@drever/core";
import type { CanvasDefinition, DeckManifest, SlideManifest } from "@drever/schema";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  type CSSProperties,
  type ReactElement,
} from "react";
import { DEFAULT_CANVAS } from "./canvas.tsx";
import { scheduleStableMountNotification } from "./viewer-lifecycle.ts";

type DocumentStyle = CSSProperties &
  Readonly<{
    "--drever-canvas-height": number;
    "--drever-canvas-width": number;
  }>;

export type DeckDocumentProps = Readonly<{
  audienceURL: string;
  Content: MDXContent;
  canvas?: CanvasDefinition;
  documentURL: string;
  manifest: DeckManifest;
  registry?: MDXComponents;
}>;

const finalStep = (slide: SlideManifest): number => slide.stepStops.at(-1) ?? 0;
const slideURL = (documentURL: string, slideId: string): string => {
  const url = new URL(documentURL);
  url.hash = slideId;
  return url.href;
};

/** Renders one searchable, fully revealed document with a named landmark per slide. */
export const DeckDocument = ({
  audienceURL,
  Content,
  canvas = DEFAULT_CANVAS,
  documentURL,
  manifest,
  registry,
}: DeckDocumentProps): ReactElement => {
  const slidesById = useMemo(
    () => new Map(manifest.slides.map((slide) => [slide.id, slide])),
    [manifest],
  );
  const resolve = useCallback(
    (identity: SlideIdentity): ResolvedSlideState => {
      const slide =
        identity.id === undefined
          ? manifest.slides[identity.index ?? -1]
          : slidesById.get(identity.id);
      const active =
        slide !== undefined &&
        (identity.index === undefined || identity.index === slide.index) &&
        (identity.id === undefined || identity.id === slide.id);
      return Object.freeze({
        active,
        currentStep: active ? finalStep(slide) : 0,
        ...(active ? { label: slide.title ?? `Slide ${slide.index + 1}` } : {}),
      });
    },
    [manifest.slides, slidesById],
  );
  const style: DocumentStyle = {
    "--drever-canvas-height": canvas.height,
    "--drever-canvas-width": canvas.width,
  };

  return (
    <div className="drever-document drever-viewer" data-drever-document="" style={style}>
      <header className="drever-document__header">
        <div>
          <p>Drever document</p>
          <h1>Presentation transcript</h1>
          <span>{manifest.slides.length} slides · fully revealed</span>
        </div>
        <a href={audienceURL}>Return to presentation</a>
      </header>
      <nav aria-label="Slides" className="drever-document__toc">
        <ol>
          {manifest.slides.map((slide) => (
            <li key={slide.id}>
              <a href={slideURL(documentURL, slide.id)}>
                <span>{String(slide.index + 1).padStart(2, "0")}</span>
                {slide.title ?? `Slide ${slide.index + 1}`}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="drever-document__pages">
        <div
          className="drever-deck drever-document__deck"
          data-drever-deck=""
          data-drever-render-mode="document"
        >
          <DreverRenderModeProvider mode="document">
            <SlideStateProvider resolver={resolve}>
              <MDXRenderer Content={Content} {...(registry === undefined ? {} : { registry })} />
            </SlideStateProvider>
          </DreverRenderModeProvider>
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
