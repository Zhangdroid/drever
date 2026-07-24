import { useDreverRenderMode } from "@drever/core";
import { useEffect, useRef, type CSSProperties, type ReactElement } from "react";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/u;
const ASPECT_RATIOS = {
  "16:9": "16 / 9",
  "4:3": "4 / 3",
  "1:1": "1 / 1",
  "9:16": "9 / 16",
} as const;

export type YouTubeAspectRatio = keyof typeof ASPECT_RATIOS;

export type YouTubeProps = Readonly<{
  aspectRatio?: YouTubeAspectRatio;
  id: string;
  start?: number;
  title: string;
}>;

type YouTubeStyle = CSSProperties &
  Readonly<{
    "--drever-youtube-aspect-ratio": string;
  }>;

const invalid = (property: string, requirement: string): never => {
  throw new TypeError(`YouTube: "${property}" must be ${requirement}.`);
};

const videoId = (value: unknown): string =>
  typeof value === "string" && VIDEO_ID.test(value)
    ? value
    : invalid("id", "an 11-character YouTube video id");

const videoTitle = (value: unknown): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return invalid("title", "a non-empty string");
  }
  return value.trim();
};

const startTime = (value: unknown): number => {
  if (
    value === undefined ||
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
  ) {
    return value ?? 0;
  }
  return invalid("start", "a non-negative whole number of seconds");
};

const aspectRatio = (value: unknown): YouTubeAspectRatio => {
  if (value === undefined) return "16:9";
  if (typeof value === "string" && Object.hasOwn(ASPECT_RATIOS, value)) {
    return value as YouTubeAspectRatio;
  }
  return invalid("aspectRatio", 'one of "16:9", "4:3", "1:1", or "9:16"');
};

const embedUrl = (id: string, start: number): string => {
  const url = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
  if (start > 0) url.searchParams.set("start", String(start));
  return url.href;
};

const watchUrl = (id: string, start: number): string => {
  const url = new URL("https://www.youtube.com/watch");
  url.searchParams.set("v", id);
  if (start > 0) url.searchParams.set("t", `${start}s`);
  return url.href;
};

export const activateYouTubeFrame = (frame: HTMLIFrameElement, source: string): (() => void) => {
  frame.src = source;
  return () => frame.removeAttribute("src");
};

const YouTubeFrame = ({
  source,
  title,
}: Readonly<{ source: string; title: string }>): ReactElement => {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (frame === null) return;
    return activateYouTubeFrame(frame, source);
  }, [source]);

  return (
    <iframe
      allow="encrypted-media; picture-in-picture; web-share"
      allowFullScreen
      data-src={source}
      loading="lazy"
      ref={frameRef}
      referrerPolicy="strict-origin-when-cross-origin"
      title={title}
    />
  );
};

/** A lazy privacy-enhanced YouTube embed with stable non-interactive output. */
export function YouTube({
  aspectRatio: authoredAspectRatio,
  id: authoredId,
  start: authoredStart,
  title: authoredTitle,
}: YouTubeProps): ReactElement {
  const id = videoId(authoredId);
  const title = videoTitle(authoredTitle);
  const start = startTime(authoredStart);
  const ratio = aspectRatio(authoredAspectRatio);
  const renderMode = useDreverRenderMode();
  const interactive = renderMode === "audience";
  const style: YouTubeStyle = {
    "--drever-youtube-aspect-ratio": ASPECT_RATIOS[ratio],
  };

  return (
    <figure
      className="drever-youtube"
      data-drever-media="youtube"
      data-render-mode={renderMode}
      style={style}
    >
      <div className="drever-youtube__viewport">
        {interactive ? <YouTubeFrame source={embedUrl(id, start)} title={title} /> : null}
        <a
          className="drever-youtube__fallback"
          href={watchUrl(id, start)}
          rel="noreferrer"
          target="_blank"
        >
          <span aria-hidden="true" className="drever-youtube__play" />
          <span className="drever-youtube__copy">
            <strong>{title}</strong>
            <small>Watch on YouTube</small>
          </span>
        </a>
      </div>
    </figure>
  );
}
