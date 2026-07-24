import { useDreverRenderMode } from "@drever/core";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactElement,
} from "react";

export type RoomAudioSource = "demo" | "microphone" | "system";

export type RoomAudioTrack = Readonly<{
  artist?: string;
  crossOrigin?: "anonymous" | "use-credentials";
  href?: string;
  hrefLabel?: string;
  loop?: boolean;
  sourceLabel?: string;
  src: string;
  title: string;
}>;

export type RoomAudioProps = Omit<ComponentPropsWithoutRef<"section">, "title"> &
  Readonly<{
    label?: string;
    reducedMotion?: boolean;
    track?: RoomAudioTrack;
  }>;

type RoomAudioGraph = {
  analyser: AnalyserNode;
  context: AudioContext;
  data: Uint8Array<ArrayBuffer>;
  elementSource?: MediaElementAudioSourceNode;
  frame: number | undefined;
  source?: AudioNode;
  stream?: MediaStream;
};

type RoomAudioSession = {
  context: Pick<AudioContext, "suspend">;
  frame: number | undefined;
  source?: Pick<AudioNode, "disconnect">;
  stream?: Readonly<{
    getTracks(): readonly Pick<MediaStreamTrack, "stop">[];
  }>;
};

type RoomAudioCaptureSource = Exclude<RoomAudioSource, "demo">;

type DisplayAudioOptions = DisplayMediaStreamOptions & {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: "exclude" | "include";
  systemAudio?: "exclude" | "include";
  windowAudio?: "exclude" | "system" | "window";
};

const SIGNAL_PROPERTIES = [
  "--drever-audio-high",
  "--drever-audio-level",
  "--drever-audio-low",
  "--drever-audio-mid",
] as const;

/** Disconnects a live input and releases every permissioned media track. */
const releaseRoomAudioInput = (
  session: RoomAudioSession | undefined,
  cancelFrame: (frame: number) => void,
): void => {
  if (session === undefined) return;
  if (session.frame !== undefined) cancelFrame(session.frame);
  session.frame = undefined;
  session.source?.disconnect();
  delete session.source;
  session.stream?.getTracks().forEach((track) => track.stop());
  delete session.stream;
};

export const deactivateRoomAudio = async (
  session: RoomAudioSession | undefined,
  cancelFrame: (frame: number) => void,
): Promise<void> => {
  if (session === undefined) return;
  releaseRoomAudioInput(session, cancelFrame);
  await session.context.suspend();
};

const average = (data: Uint8Array, start: number, end: number): number => {
  let total = 0;
  for (let index = start; index < end; index += 1) total += data[index] ?? 0;
  return total / Math.max(1, end - start) / 255;
};

const signal = (value: number): number => (value < 0.025 ? 0 : Math.min(1, value * 1.8));
const errorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : "The audio source could not start.";

const sourceLabel = (source: RoomAudioSource, track?: RoomAudioTrack): string => {
  if (source === "demo") return track?.sourceLabel ?? "Demo track";
  if (source === "system") return "Computer audio";
  return "Microphone";
};

const sourceDescription = (source: RoomAudioSource, track?: RoomAudioTrack): string => {
  if (source === "demo") return track?.artist ?? "Streaming audio";
  if (source === "system") return "Listening to the shared tab or screen";
  return "Listening to sound in the room";
};

/** Turns live, streamed, or room audio into a persistent Stage signal. */
export function RoomAudio({
  className,
  label = "React to your room",
  reducedMotion,
  style,
  track,
  ...props
}: RoomAudioProps): ReactElement {
  const renderMode = useDreverRenderMode();
  const interactive = renderMode === "audience";
  const audioRef = useRef<HTMLAudioElement>(null);
  const graphRef = useRef<RoomAudioGraph | undefined>(undefined);
  const mountedRef = useRef(true);
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const [activeSource, setActiveSource] = useState<RoomAudioSource>();
  const [error, setError] = useState<string>();

  const getStage = useCallback((): HTMLElement | null => {
    const stage = rootRef.current?.closest<HTMLElement>("[data-drever-stage]") ?? stageRef.current;
    stageRef.current = stage;
    return stage;
  }, []);

  const setSignal = useCallback(
    (low: number, mid: number, high: number): void => {
      const values = {
        "--drever-audio-high": signal(high),
        "--drever-audio-level": signal((low + mid + high) / 3),
        "--drever-audio-low": signal(low),
        "--drever-audio-mid": signal(mid),
      } as const;
      for (const target of [rootRef.current, getStage()]) {
        if (target === null) continue;
        for (const [property, value] of Object.entries(values)) {
          target.style.setProperty(property, value.toFixed(3));
        }
      }
    },
    [getStage],
  );

  const clearStageSignal = useCallback((): void => {
    const stageRoot = getStage();
    stageRoot?.removeAttribute("data-drever-room-audio-active");
    for (const target of [rootRef.current, stageRoot]) {
      if (target === null) continue;
      for (const property of SIGNAL_PROPERTIES) target.style.removeProperty(property);
    }
    stageRef.current = null;
  }, [getStage]);

  const ensureGraph = (): RoomAudioGraph => {
    const current = graphRef.current;
    if (current !== undefined) return current;

    const context = new AudioContext();
    const analyser = context.createAnalyser();
    const silentOutput = context.createGain();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.78;
    silentOutput.gain.value = 0;
    analyser.connect(silentOutput);
    silentOutput.connect(context.destination);
    const graph: RoomAudioGraph = {
      analyser,
      context,
      data: new Uint8Array(analyser.frequencyBinCount),
      frame: undefined,
    };
    graphRef.current = graph;
    return graph;
  };

  const draw = (graph: RoomAudioGraph): void => {
    graph.analyser.getByteFrequencyData(graph.data);
    const binHz = graph.context.sampleRate / graph.analyser.fftSize;
    const indexFor = (frequency: number): number =>
      Math.min(graph.data.length, Math.max(0, Math.round(frequency / binHz)));
    setSignal(
      average(graph.data, indexFor(40), indexFor(220)),
      average(graph.data, indexFor(220), indexFor(2_000)),
      average(graph.data, indexFor(2_000), indexFor(8_000)),
    );
    graph.frame = window.requestAnimationFrame(() => draw(graph));
  };

  const stop = useCallback(async (): Promise<void> => {
    audioRef.current?.pause();
    const deactivation = deactivateRoomAudio(graphRef.current, (frame) =>
      window.cancelAnimationFrame(frame),
    );
    clearStageSignal();
    setActiveSource(undefined);
    await deactivation;
  }, [clearStageSignal]);

  const activate = async (
    source: RoomAudioSource,
    connect: (graph: RoomAudioGraph) => Promise<void>,
  ): Promise<void> => {
    audioRef.current?.pause();
    releaseRoomAudioInput(graphRef.current, (frame) => window.cancelAnimationFrame(frame));
    clearStageSignal();
    setActiveSource(undefined);
    try {
      const graph = ensureGraph();
      await Promise.all([graph.context.resume(), connect(graph)]);
      if (!mountedRef.current) {
        await deactivateRoomAudio(graph, (frame) => window.cancelAnimationFrame(frame));
        return;
      }
      setError(undefined);
      setActiveSource(source);
      getStage()?.setAttribute("data-drever-room-audio-active", "");
      if (!(reducedMotion ?? window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
        draw(graph);
      }
    } catch (cause) {
      await stop();
      if (mountedRef.current) setError(errorMessage(cause));
    }
  };

  const activateCapture = async (
    source: RoomAudioCaptureSource,
    streamRequest: Promise<MediaStream>,
  ): Promise<void> => {
    try {
      const stream = await streamRequest;
      if (!mountedRef.current) {
        stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
        return;
      }
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
        throw new Error("Choose a tab or screen with Share audio enabled.");
      }
      if (source === "system") {
        stream.getVideoTracks().forEach((mediaTrack) => {
          mediaTrack.enabled = false;
        });
      }
      await activate(source, async (graph) => {
        const mediaSource = graph.context.createMediaStreamSource(stream);
        mediaSource.connect(graph.analyser);
        graph.source = mediaSource;
        graph.stream = stream;
        stream
          .getTracks()
          .forEach((mediaTrack) =>
            mediaTrack.addEventListener("ended", () => void stop(), { once: true }),
          );
      });
    } catch (cause) {
      if (mountedRef.current) setError(errorMessage(cause));
    }
  };

  const toggleTrack = (): Promise<void> => {
    if (activeSource === "demo") {
      return stop();
    }
    const audio = audioRef.current;
    if (audio === null) return Promise.resolve();

    return activate("demo", async (graph) => {
      graph.elementSource ??= graph.context.createMediaElementSource(audio);
      graph.elementSource.connect(graph.analyser);
      graph.elementSource.connect(graph.context.destination);
      graph.source = graph.elementSource;
      await audio.play();
    });
  };

  const toggleMicrophone = (): Promise<void> => {
    if (activeSource === "microphone") {
      return stop();
    }
    return activateCapture(
      "microphone",
      navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
        video: false,
      }),
    );
  };

  const toggleSystem = (): Promise<void> => {
    if (activeSource === "system") {
      return stop();
    }
    const options: DisplayAudioOptions = {
      audio: true,
      preferCurrentTab: false,
      selfBrowserSurface: "exclude",
      systemAudio: "include",
      video: true,
      windowAudio: "system",
    };
    return activateCapture("system", navigator.mediaDevices.getDisplayMedia(options));
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      audioRef.current?.pause();
      const deactivation = deactivateRoomAudio(graphRef.current, (frame) =>
        window.cancelAnimationFrame(frame),
      );
      clearStageSignal();
      void deactivation;
    };
  }, [clearStageSignal]);

  const rootStyle = {
    ...style,
    "--drever-audio-high": 0,
    "--drever-audio-level": 0,
    "--drever-audio-low": 0,
    "--drever-audio-mid": 0,
  } as CSSProperties;

  return (
    <section
      {...props}
      className={["drever-room-audio", className].filter(Boolean).join(" ")}
      data-active={activeSource === undefined ? undefined : ""}
      data-render-mode={renderMode}
      data-source={activeSource}
      ref={rootRef}
      style={rootStyle}
    >
      <div aria-hidden="true" className="drever-room-audio__meter">
        <i data-band="low" />
        <i data-band="mid" />
        <i data-band="high" />
      </div>

      <div className="drever-room-audio__copy">
        <small>{activeSource === undefined ? "Sound input" : "Listening now"}</small>
        <strong>
          {activeSource === undefined
            ? label
            : activeSource === "demo"
              ? (track?.title ?? sourceLabel(activeSource, track))
              : sourceLabel(activeSource, track)}
        </strong>
        <span>
          {activeSource === undefined
            ? "Pick a source. Silence stays still."
            : sourceDescription(activeSource, track)}
        </span>
      </div>

      {interactive ? (
        <div
          aria-label="Choose an audio source"
          className="drever-room-audio__controls"
          role="group"
        >
          {track === undefined ? null : (
            <button
              aria-pressed={activeSource === "demo"}
              onClick={() => void toggleTrack()}
              type="button"
            >
              {activeSource === "demo" ? "Stop" : (track.sourceLabel ?? "Demo")}
            </button>
          )}
          <button
            aria-pressed={activeSource === "system"}
            onClick={() => void toggleSystem()}
            type="button"
          >
            {activeSource === "system" ? "Stop" : "Computer audio"}
          </button>
          <button
            aria-pressed={activeSource === "microphone"}
            onClick={() => void toggleMicrophone()}
            type="button"
          >
            {activeSource === "microphone" ? "Stop" : "Microphone"}
          </button>
        </div>
      ) : (
        <span className="drever-room-audio__status">Live input is available in audience view</span>
      )}

      {interactive && track !== undefined ? (
        <audio
          crossOrigin={track.crossOrigin ?? "anonymous"}
          loop={track.loop}
          onEnded={() => void stop()}
          preload="metadata"
          ref={audioRef}
          src={track.src}
        />
      ) : null}

      {activeSource === "demo" && track?.href !== undefined ? (
        <a className="drever-room-audio__credit" href={track.href} rel="noreferrer" target="_blank">
          {track.hrefLabel ?? "Open source"}
        </a>
      ) : null}

      {error === undefined ? null : (
        <p className="drever-room-audio__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
