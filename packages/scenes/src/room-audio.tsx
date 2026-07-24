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

export type RoomAudioProps = Omit<ComponentPropsWithoutRef<"section">, "title"> &
  Readonly<{
    label?: string;
    prompt?: string;
    reducedMotion?: boolean;
  }>;

export type RoomAudioBands = Readonly<{
  high: number;
  low: number;
  mid: number;
}>;

type RoomAudioSignal = RoomAudioBands &
  Readonly<{
    level: number;
  }>;

type RoomAudioPhase = "active" | "idle" | "requesting";

type RoomAudioGraph = {
  analyser: AnalyserNode;
  context: AudioContext;
  data: Uint8Array<ArrayBuffer>;
  frame: number | undefined;
  source?: AudioNode;
  stream?: MediaStream;
};

type RoomAudioInputSession = {
  frame: number | undefined;
  source?: Pick<AudioNode, "disconnect">;
  stream?: Readonly<{
    getTracks(): readonly Pick<MediaStreamTrack, "stop">[];
  }>;
};

type RoomAudioSession = RoomAudioInputSession & {
  context: Pick<AudioContext, "suspend">;
};

type RoomAudioDisposableSession = RoomAudioInputSession & {
  context: Pick<AudioContext, "close">;
};

const MICROPHONE_CONSTRAINTS = {
  audio: {
    autoGainControl: false,
    echoCancellation: false,
    noiseSuppression: false,
  },
  video: false,
} as const satisfies MediaStreamConstraints;

const SIGNAL_PROPERTIES = [
  "--drever-audio-high",
  "--drever-audio-level",
  "--drever-audio-low",
  "--drever-audio-mid",
] as const;

/** Disconnects the microphone and releases every permissioned media track. */
const releaseRoomAudioInput = (
  session: RoomAudioInputSession | undefined,
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

export const disposeRoomAudio = async (
  session: RoomAudioDisposableSession | undefined,
  cancelFrame: (frame: number) => void,
): Promise<void> => {
  if (session === undefined) return;
  releaseRoomAudioInput(session, cancelFrame);
  await session.context.close();
};

/** Requests the one input RoomAudio understands and rejects empty captures. */
export const requestRoomMicrophone = async (
  mediaDevices: Pick<MediaDevices, "getUserMedia">,
): Promise<MediaStream> => {
  const stream = await mediaDevices.getUserMedia(MICROPHONE_CONSTRAINTS);
  if (stream.getAudioTracks().length > 0) return stream;
  stream.getTracks().forEach((track) => track.stop());
  throw new Error("No microphone audio track was available.");
};

const average = (data: Uint8Array, start: number, end: number): number => {
  let total = 0;
  for (let index = start; index < end; index += 1) total += data[index] ?? 0;
  return total / Math.max(1, end - start) / 255;
};

const normalizeSignal = (value: number): number => (value < 0.025 ? 0 : Math.min(1, value * 1.8));

/** Converts analyser bands into the four stable Stage signals used by scenes. */
export const resolveRoomAudioSignal = ({ high, low, mid }: RoomAudioBands): RoomAudioSignal =>
  Object.freeze({
    high: normalizeSignal(high),
    level: normalizeSignal((low + mid + high) / 3),
    low: normalizeSignal(low),
    mid: normalizeSignal(mid),
  });

const errorMessage = (cause: unknown): string => {
  if (cause instanceof DOMException && cause.name === "NotAllowedError") {
    return "Microphone access is off. Allow it for this site, then try again.";
  }
  if (cause instanceof DOMException && cause.name === "NotFoundError") {
    return "No microphone was found.";
  }
  return cause instanceof Error ? cause.message : "The microphone could not start.";
};

/** Turns sound reaching the microphone into a persistent, local-only Stage signal. */
export function RoomAudio({
  className,
  label = "Listen to the room",
  prompt = "Enable the microphone, then play music through your computer speakers.",
  reducedMotion,
  style,
  ...props
}: RoomAudioProps): ReactElement {
  const renderMode = useDreverRenderMode();
  const interactive = renderMode === "audience";
  const graphRef = useRef<RoomAudioGraph | undefined>(undefined);
  const mountedRef = useRef(true);
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string>();
  const [phase, setPhase] = useState<RoomAudioPhase>("idle");

  const getStage = useCallback((): HTMLElement | null => {
    const stage = rootRef.current?.closest<HTMLElement>("[data-drever-stage]") ?? stageRef.current;
    stageRef.current = stage;
    return stage;
  }, []);

  const setSignal = useCallback(
    (bands: RoomAudioBands): void => {
      const { high, level, low, mid } = resolveRoomAudioSignal(bands);
      const values = {
        "--drever-audio-high": high,
        "--drever-audio-level": level,
        "--drever-audio-low": low,
        "--drever-audio-mid": mid,
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
    const stage = getStage();
    stage?.removeAttribute("data-drever-room-audio-active");
    for (const target of [rootRef.current, stage]) {
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
    setSignal({
      high: average(graph.data, indexFor(2_000), indexFor(8_000)),
      low: average(graph.data, indexFor(40), indexFor(220)),
      mid: average(graph.data, indexFor(220), indexFor(2_000)),
    });
    graph.frame = window.requestAnimationFrame(() => draw(graph));
  };

  const stop = useCallback(async (): Promise<void> => {
    const deactivation = deactivateRoomAudio(graphRef.current, (frame) =>
      window.cancelAnimationFrame(frame),
    );
    clearStageSignal();
    setPhase("idle");
    await deactivation;
  }, [clearStageSignal]);

  const start = async (): Promise<void> => {
    setError(undefined);
    setPhase("requesting");
    let stream: MediaStream | undefined;
    try {
      stream = await requestRoomMicrophone(navigator.mediaDevices);
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const graph = ensureGraph();
      releaseRoomAudioInput(graph, (frame) => window.cancelAnimationFrame(frame));
      clearStageSignal();
      const activeStream = stream;
      graph.stream = activeStream;
      stream = undefined;
      const source = graph.context.createMediaStreamSource(activeStream);
      source.connect(graph.analyser);
      graph.source = source;
      activeStream
        .getTracks()
        .forEach((track) => track.addEventListener("ended", () => void stop(), { once: true }));
      await graph.context.resume();

      if (!mountedRef.current) {
        await deactivateRoomAudio(graph, (frame) => window.cancelAnimationFrame(frame));
        return;
      }
      setPhase("active");
      getStage()?.setAttribute("data-drever-room-audio-active", "");
      if (!(reducedMotion ?? window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
        draw(graph);
      }
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop());
      if (!mountedRef.current) return;
      await stop();
      setError(errorMessage(cause));
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const disposal = disposeRoomAudio(graphRef.current, (frame) =>
        window.cancelAnimationFrame(frame),
      );
      clearStageSignal();
      void disposal;
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
      data-active={phase === "active" ? "" : undefined}
      data-phase={phase}
      data-render-mode={renderMode}
      data-source={phase === "active" ? "microphone" : undefined}
      ref={rootRef}
      style={rootStyle}
    >
      <div aria-hidden="true" className="drever-room-audio__meter">
        <i data-band="low" />
        <i data-band="mid" />
        <i data-band="high" />
      </div>

      <div className="drever-room-audio__copy">
        <small>{phase === "active" ? "Listening now" : "Room Sense · microphone"}</small>
        <strong>{label}</strong>
        <span>
          {phase === "active" ? "The glow and rings are following the sound around you." : prompt}
        </span>
      </div>

      {interactive ? (
        <button
          aria-pressed={phase === "active"}
          className="drever-room-audio__control"
          disabled={phase === "requesting"}
          onClick={() => void (phase === "active" ? stop() : start())}
          type="button"
        >
          <i aria-hidden="true" />
          {phase === "active"
            ? "Stop listening"
            : phase === "requesting"
              ? "Waiting for permission…"
              : error === undefined
                ? "Enable microphone"
                : "Try again"}
        </button>
      ) : (
        <span className="drever-room-audio__status">Microphone available in audience view</span>
      )}

      <small className="drever-room-audio__privacy">
        Processed in this browser. Nothing is recorded or uploaded.
      </small>

      {error === undefined ? null : (
        <p className="drever-room-audio__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
