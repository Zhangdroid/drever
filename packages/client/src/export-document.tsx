import {
  DreverRenderModeProvider,
  MDXRenderer,
  SlideStateProvider,
  type MDXComponents,
  type MDXContent,
  type ResolvedSlideState,
  type SlideIdentity,
} from "@drever/core";
import type { CanvasDefinition, DeckManifest } from "@drever/schema";
import { useLayoutEffect, type CSSProperties, type ReactElement } from "react";
import { DEFAULT_CANVAS } from "./canvas.tsx";
import type { ExportPage } from "./export-pages.ts";
import { PresentationStage, type StageComponents } from "./stage.tsx";
import { scheduleStableMountNotification } from "./viewer-lifecycle.ts";

type ExportDocumentStyle = CSSProperties &
  Readonly<{
    "--drever-canvas-height": number;
    "--drever-canvas-width": number;
  }>;

export type ExportDocumentProps = Readonly<{
  Content: MDXContent;
  canvas?: CanvasDefinition;
  manifest: DeckManifest;
  pages: readonly ExportPage[];
  registry?: MDXComponents;
  stage?: StageComponents;
}>;

type ExportPageDocumentProps = Readonly<{
  Content: MDXContent;
  canvas: CanvasDefinition;
  manifest: DeckManifest;
  page: ExportPage;
  pageNumber: number;
  registry?: MDXComponents;
  stage?: StageComponents;
}>;

const ExportPageDocument = ({
  Content,
  canvas,
  manifest,
  page,
  pageNumber,
  registry,
  stage,
}: ExportPageDocumentProps): ReactElement => {
  const resolve = (slide: SlideIdentity): ResolvedSlideState => {
    const identified = slide.id !== undefined || slide.index !== undefined;
    const active =
      identified &&
      (slide.id === undefined || slide.id === page.slideId) &&
      (slide.index === undefined || slide.index === page.slideIndex);
    return Object.freeze({ active, currentStep: active ? page.step : 0 });
  };

  return (
    <article
      aria-label={`Slide ${page.slideIndex + 1}, Step ${page.step}`}
      className="drever-export-page"
      data-drever-export-page=""
      data-page-number={pageNumber}
      data-slide-id={page.slideId}
      data-slide-index={page.slideIndex}
      data-step={page.step}
    >
      <DreverRenderModeProvider mode="export" idPrefix={`drever-export-page-${pageNumber}`}>
        <PresentationStage
          canvas={canvas}
          manifest={manifest}
          position={page}
          reducedMotion
          renderMode="export"
          {...(stage === undefined ? {} : { stage })}
        >
          <div className="drever-deck" data-drever-deck="" data-drever-render-mode="export">
            <SlideStateProvider resolver={resolve}>
              <MDXRenderer Content={Content} {...(registry === undefined ? {} : { registry })} />
            </SlideStateProvider>
          </div>
        </PresentationStage>
      </DreverRenderModeProvider>
    </article>
  );
};

/** Renders every planned PDF page at its exact canvas size without viewport scaling. */
export const ExportDocument = ({
  Content,
  canvas = DEFAULT_CANVAS,
  manifest,
  pages,
  registry,
  stage,
}: ExportDocumentProps): ReactElement => {
  const style: ExportDocumentStyle = {
    "--drever-canvas-height": canvas.height,
    "--drever-canvas-width": canvas.width,
  };

  return (
    <div
      className="drever-export-document drever-viewer"
      data-canvas-height={canvas.height}
      data-canvas-width={canvas.width}
      data-drever-export-document=""
      data-page-count={pages.length}
      style={style}
    >
      {pages.map((page, pageIndex) => (
        <ExportPageDocument
          Content={Content}
          canvas={canvas}
          key={`${page.slideId}:${page.step}`}
          manifest={manifest}
          page={page}
          pageNumber={pageIndex + 1}
          {...(registry === undefined ? {} : { registry })}
          {...(stage === undefined ? {} : { stage })}
        />
      ))}
    </div>
  );
};

export type ExportHostProps = ExportDocumentProps &
  Readonly<{
    onMounted(): void;
  }>;

/** @internal Provides StrictMode-safe commit notification to createExport. */
export const ExportHost = ({ onMounted, ...props }: ExportHostProps): ReactElement => {
  useLayoutEffect(() => scheduleStableMountNotification(onMounted), [onMounted]);
  return <ExportDocument {...props} />;
};
