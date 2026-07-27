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

type ExportCjkFontVariable =
  `--drever-theme-font-cjk-${"handwritten" | "sans" | "serif"}-${"ja" | "ko" | "zh-hans" | "zh-hant"}`;

type ExportDocumentStyle = CSSProperties &
  Readonly<
    Record<ExportCjkFontVariable, string> & {
      "--drever-canvas-height": number;
      "--drever-canvas-width": number;
    }
  >;

const EXPORT_CJK_FONT_STACKS = {
  handwritten: {
    ja: '"Hiragino Maru Gothic ProN", "Yu Gothic", "Noto Sans CJK JP", "Noto Sans JP", Klee',
    ko: '"Nanum Pen Script", "Nanum Brush Script", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans CJK KR", "Noto Sans KR"',
    zhHans: '"Kaiti SC", STKaiti, KaiTi, "Noto Serif CJK SC", "Noto Serif SC"',
    zhHant: '"Kaiti TC", BiauKai, "DFKai-SB", "Noto Serif CJK TC", "Noto Serif TC"',
  },
  sans: {
    ja: '"Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, "Noto Sans CJK JP", "Noto Sans JP", "Hiragino Sans"',
    ko: '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans CJK KR", "Noto Sans KR"',
    zhHans:
      '"Heiti SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", "PingFang SC", "Hiragino Sans GB"',
    zhHant:
      '"Heiti TC", "Microsoft JhengHei", "Noto Sans CJK TC", "Noto Sans TC", "PingFang TC", "PingFang HK"',
  },
  serif: {
    ja: '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "Noto Serif CJK JP", "Noto Serif JP"',
    ko: 'AppleMyungjo, Batang, "Noto Serif CJK KR", "Noto Serif KR"',
    zhHans: '"Songti SC", STSong, SimSun, "Noto Serif CJK SC", "Noto Serif SC"',
    zhHant: '"Songti TC", "LiSong Pro", PMingLiU, MingLiU, "Noto Serif CJK TC", "Noto Serif TC"',
  },
} as const;

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
  const labelId = `drever-export-page-${pageNumber}-label`;
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
      aria-labelledby={labelId}
      className="drever-export-page"
      data-drever-export-page=""
      data-page-number={pageNumber}
      data-slide-id={page.slideId}
      data-slide-index={page.slideIndex}
      data-step={page.step}
    >
      <span className="drever-visually-hidden" dir="ltr" id={labelId} lang="en">
        Slide {page.slideIndex + 1}, Step {page.step}
      </span>
      <DreverRenderModeProvider mode="export" idPrefix={`drever-export-page-${pageNumber}`}>
        <PresentationStage
          canvas={canvas}
          manifest={manifest}
          position={page}
          reducedMotion
          renderMode="export"
          suppressReducedMotionAttribute
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
    // Chromium can paint but omit some native UI CJK faces from PDFs on macOS.
    // Prefer embeddable local faces only in export; live theme typography stays unchanged.
    "--drever-theme-font-cjk-handwritten-ja": EXPORT_CJK_FONT_STACKS.handwritten.ja,
    "--drever-theme-font-cjk-handwritten-ko": EXPORT_CJK_FONT_STACKS.handwritten.ko,
    "--drever-theme-font-cjk-handwritten-zh-hans": EXPORT_CJK_FONT_STACKS.handwritten.zhHans,
    "--drever-theme-font-cjk-handwritten-zh-hant": EXPORT_CJK_FONT_STACKS.handwritten.zhHant,
    "--drever-theme-font-cjk-sans-ja": EXPORT_CJK_FONT_STACKS.sans.ja,
    "--drever-theme-font-cjk-sans-ko": EXPORT_CJK_FONT_STACKS.sans.ko,
    "--drever-theme-font-cjk-sans-zh-hans": EXPORT_CJK_FONT_STACKS.sans.zhHans,
    "--drever-theme-font-cjk-sans-zh-hant": EXPORT_CJK_FONT_STACKS.sans.zhHant,
    "--drever-theme-font-cjk-serif-ja": EXPORT_CJK_FONT_STACKS.serif.ja,
    "--drever-theme-font-cjk-serif-ko": EXPORT_CJK_FONT_STACKS.serif.ko,
    "--drever-theme-font-cjk-serif-zh-hans": EXPORT_CJK_FONT_STACKS.serif.zhHans,
    "--drever-theme-font-cjk-serif-zh-hant": EXPORT_CJK_FONT_STACKS.serif.zhHant,
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
