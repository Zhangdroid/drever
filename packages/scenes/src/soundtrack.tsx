import { useDreverRenderMode } from "@drever/core";
import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactElement,
} from "react";
import { resolveMusicEmbed, type MusicProvider } from "./music-links.ts";

export type SoundtrackVisual = "halo" | "spectrum";

export type SoundtrackProps = Omit<ComponentPropsWithoutRef<"section">, "title"> &
  Readonly<{
    artist?: string;
    artwork?: string;
    artworkAlt?: string;
    crossOrigin?: "anonymous" | "use-credentials";
    loop?: boolean;
    playlistUrl?: string;
    provider?: MusicProvider | "other";
    reducedMotion?: boolean;
    src?: string;
    title: string;
    visual?: SoundtrackVisual;
  }>;

type AudioGraph = {
  analyser: AnalyserNode;
  context: AudioContext;
  data: Uint8Array<ArrayBuffer>;
  frame: number | undefined;
  source: MediaElementAudioSourceNode;
};

const average = (data: Uint8Array, start: number, end: number): number => {
  let total = 0;
  for (let index = start; index < end; index += 1) {
    total += data[index] ?? 0;
  }
  return total / Math.max(1, end - start) / 255;
};

const providerLabel = (provider: MusicProvider | "other"): string => {
  if (provider === "apple-music") return "Apple Music";
  if (provider === "spotify") return "Spotify";
  return "playlist";
};

/** A pre-show soundtrack with honest ambient or Web Audio-reactive visuals. */
export function Soundtrack({
  artist,
  artwork,
  artworkAlt = "",
  children,
  className,
  crossOrigin,
  loop = true,
  playlistUrl,
  provider: explicitProvider,
  reducedMotion,
  src,
  style,
  title,
  visual = "halo",
  ...props
}: SoundtrackProps): ReactElement {
  const renderMode = useDreverRenderMode();
  const interactive = renderMode === "audience";
  const embed = playlistUrl === undefined ? undefined : resolveMusicEmbed(playlistUrl);
  const embedUrl = embed?.embedUrl;
  const provider = explicitProvider ?? embed?.provider ?? "other";
  const audioRef = useRef<HTMLAudioElement>(null);
  const graphRef = useRef<AudioGraph | undefined>(undefined);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const [error, setError] = useState<string>();
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);

  const writeSignal = (low: number, mid: number, high: number): void => {
    const root = rootRef.current;
    if (root === null) return;
    root.style.setProperty("--drever-audio-low", low.toFixed(3));
    root.style.setProperty("--drever-audio-mid", mid.toFixed(3));
    root.style.setProperty("--drever-audio-high", high.toFixed(3));
    root.style.setProperty("--drever-audio-level", ((low + mid + high) / 3).toFixed(3));
  };

  const stopFrame = (): void => {
    const graph = graphRef.current;
    if (graph?.frame !== undefined) {
      window.cancelAnimationFrame(graph.frame);
      graph.frame = undefined;
    }
  };

  const draw = (graph: AudioGraph): void => {
    graph.analyser.getByteFrequencyData(graph.data);
    const binHz = graph.context.sampleRate / graph.analyser.fftSize;
    const indexFor = (frequency: number): number =>
      Math.min(graph.data.length, Math.max(0, Math.round(frequency / binHz)));
    writeSignal(
      average(graph.data, indexFor(40), indexFor(220)),
      average(graph.data, indexFor(220), indexFor(2_000)),
      average(graph.data, indexFor(2_000), indexFor(8_000)),
    );
    graph.frame = window.requestAnimationFrame(() => draw(graph));
  };

  const prefersReducedMotion = (): boolean =>
    reducedMotion ?? window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ensureGraph = (audio: HTMLAudioElement): AudioGraph => {
    const current = graphRef.current;
    if (current !== undefined) return current;

    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.76;
    const source = context.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(context.destination);
    const graph: AudioGraph = {
      analyser,
      context,
      data: new Uint8Array(analyser.frequencyBinCount),
      frame: undefined,
      source,
    };
    graphRef.current = graph;
    return graph;
  };

  const toggleAudio = async (): Promise<void> => {
    const audio = audioRef.current;
    if (audio === null) return;

    if (!audio.paused) {
      audio.pause();
      stopFrame();
      setPlaying(false);
      return;
    }

    try {
      const graph = ensureGraph(audio);
      await graph.context.resume();
      await audio.play();
      setError(undefined);
      setPlaying(true);
      if (!prefersReducedMotion()) {
        draw(graph);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The soundtrack could not start.");
    }
  };

  useEffect(
    () => () => {
      const graph = graphRef.current;
      audioRef.current?.pause();
      stopFrame();
      graph?.source.disconnect();
      graph?.analyser.disconnect();
      if (graph !== undefined) void graph.context.close();
      graphRef.current = undefined;
    },
    [],
  );

  useEffect(() => {
    const player = playerRef.current;
    if (!playerLoaded || player === null || embedUrl === undefined) return;

    player.src = embedUrl;
    return () => {
      player.src = "about:blank";
    };
  }, [embedUrl, playerLoaded]);

  const staticSurface = !interactive;
  const sourceMode = src === undefined ? "ambient" : "audio-reactive";
  const rootStyle = {
    ...style,
    "--drever-audio-high": 0.2,
    "--drever-audio-level": 0.22,
    "--drever-audio-low": 0.28,
    "--drever-audio-mid": 0.18,
  } as CSSProperties;

  return (
    <section
      {...props}
      className={["drever-soundtrack", className].filter(Boolean).join(" ")}
      data-active={playing || playerLoaded ? "" : undefined}
      data-render-mode={renderMode}
      data-source-mode={sourceMode}
      data-visual={visual}
      ref={rootRef}
      style={rootStyle}
    >
      <div aria-hidden="true" className="drever-soundtrack__visual">
        <span data-band="low" />
        <span data-band="mid" />
        <span data-band="high" />
        <i />
      </div>

      <div className="drever-soundtrack__content">
        {artwork === undefined ? (
          <span aria-hidden="true" className="drever-soundtrack__artwork-placeholder">
            <i />
            <i />
            <i />
          </span>
        ) : (
          <img alt={artworkAlt} className="drever-soundtrack__artwork" src={artwork} />
        )}

        <div className="drever-soundtrack__meta">
          <small>{sourceMode === "audio-reactive" ? "Audio reactive" : "Ambient mode"}</small>
          <strong>{title}</strong>
          {artist === undefined ? null : <span>{artist}</span>}
        </div>

        {staticSurface ? (
          <span className="drever-soundtrack__status">Playback available in audience view</span>
        ) : src === undefined ? (
          embed === undefined ? null : (
            <button
              aria-expanded={playerLoaded}
              className="drever-soundtrack__control"
              onClick={() => setPlayerLoaded((current) => !current)}
              type="button"
            >
              {playerLoaded ? "Hide player" : `Load ${providerLabel(provider)} player`}
            </button>
          )
        ) : (
          <>
            <audio
              crossOrigin={crossOrigin}
              loop={loop}
              onEnded={() => {
                stopFrame();
                setPlaying(false);
              }}
              preload="metadata"
              ref={audioRef}
              src={src}
            />
            <button
              aria-label={`${playing ? "Pause" : "Play"} ${title}`}
              aria-pressed={playing}
              className="drever-soundtrack__control"
              onClick={() => void toggleAudio()}
              type="button"
            >
              {playing ? "Pause room" : "Start room"}
            </button>
          </>
        )}
      </div>

      {interactive && playerLoaded && embed !== undefined ? (
        <iframe
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          className="drever-soundtrack__embed"
          loading="lazy"
          ref={playerRef}
          src={embed.embedUrl}
          title={`${providerLabel(provider)} player for ${title}`}
        />
      ) : null}

      {playlistUrl === undefined ? null : (
        <a
          className="drever-soundtrack__link"
          href={embed?.openUrl ?? playlistUrl}
          rel="noreferrer"
          target="_blank"
        >
          Open in {providerLabel(provider)}
        </a>
      )}

      {error === undefined ? null : (
        <p className="drever-soundtrack__error" role="alert">
          {error}
        </p>
      )}
      {children}
    </section>
  );
}
