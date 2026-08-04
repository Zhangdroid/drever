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
    autoStart?: boolean;
    label?: string;
    prompt?: string;
    reducedMotion?: boolean;
    variant?: RoomAudioVariant;
  }>;

export type RoomAudioVariant = "ambient" | "panel";

export type RoomAudioBands = Readonly<{
  high: number;
  low: number;
  mid: number;
}>;

type RoomAudioSignal = RoomAudioBands &
  Readonly<{
    level: number;
  }>;

type RoomAudioRange = Readonly<{
  ceiling: number;
  floor: number;
}>;

type RoomAudioFrame = Readonly<{
  range: RoomAudioRange;
  signal: RoomAudioSignal;
}>;

type RoomAudioPhase = "active" | "idle" | "requesting";

type RoomAudioGraph = {
  analyser: AnalyserNode;
  context: AudioContext;
  data: Uint8Array<ArrayBuffer>;
  frame: number | undefined;
  lastFrameAt: number | undefined;
  range: RoomAudioRange;
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

type RoomAudioRequestCache = {
  current: Promise<MediaStream> | undefined;
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

const AUDIO_RANGE = Object.freeze({
  floor: 0.012,
  floorFallMs: 180,
  floorLimit: 0.08,
  floorRiseMs: 5000,
  headroom: 1.18,
  initialCeiling: 0.35,
  minimumCeiling: 0.18,
  minimumSpan: 0.1,
  outputLimit: 0.94,
  releaseMs: 1400,
});
const INITIAL_AUDIO_RANGE = Object.freeze({
  ceiling: AUDIO_RANGE.initialCeiling,
  floor: AUDIO_RANGE.floor,
});

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

/** Coalesces concurrent permission requests, including React StrictMode effect replays. */
export const requestPendingRoomMicrophone = (
  cache: RoomAudioRequestCache,
  mediaDevices: Pick<MediaDevices, "getUserMedia">,
): Promise<MediaStream> => {
  const pending = cache.current;
  if (pending !== undefined) return pending;

  const request = requestRoomMicrophone(mediaDevices);
  cache.current = request;
  void request.then(
    () => {
      if (cache.current === request) cache.current = undefined;
    },
    () => {
      if (cache.current === request) cache.current = undefined;
    },
  );
  return request;
};

const average = (data: Uint8Array, start: number, end: number): number => {
  let total = 0;
  for (let index = start; index < end; index += 1) total += data[index] ?? 0;
  return total / Math.max(1, end - start) / 255;
};

const approach = (value: number, target: number, elapsedMs: number, durationMs: number): number =>
  value + (target - value) * (1 - Math.exp(-elapsedMs / durationMs));

const normalizeSignal = (value: number, range: RoomAudioRange): number => {
  if (value <= range.floor) return 0;
  const position = Math.min(1, (value - range.floor) / (range.ceiling - range.floor));
  return position ** 0.62 * AUDIO_RANGE.outputLimit;
};

/** Adapts the analyser range while preserving the relative energy of every band. */
export const resolveRoomAudioFrame = (
  { high, low, mid }: RoomAudioBands,
  previousRange: RoomAudioRange = INITIAL_AUDIO_RANGE,
  elapsedMs = 1000 / 60,
): RoomAudioFrame => {
  const peak = Math.max(high, low, mid);
  const ceilingTarget = Math.max(AUDIO_RANGE.minimumCeiling, peak * AUDIO_RANGE.headroom);
  const ceiling =
    ceilingTarget > previousRange.ceiling
      ? ceilingTarget
      : approach(previousRange.ceiling, ceilingTarget, elapsedMs, AUDIO_RANGE.releaseMs);
  const floorTarget = Math.max(AUDIO_RANGE.floor, Math.min(AUDIO_RANGE.floorLimit, high, low, mid));
  const floor = Math.min(
    ceiling - AUDIO_RANGE.minimumSpan,
    approach(
      previousRange.floor,
      floorTarget,
      elapsedMs,
      floorTarget < previousRange.floor ? AUDIO_RANGE.floorFallMs : AUDIO_RANGE.floorRiseMs,
    ),
  );
  const range = Object.freeze({ ceiling, floor });

  return Object.freeze({
    range,
    signal: Object.freeze({
      high: normalizeSignal(high, range),
      level: normalizeSignal((low + mid + high) / 3, range),
      low: normalizeSignal(low, range),
      mid: normalizeSignal(mid, range),
    }),
  });
};

const errorMessage = (cause: unknown): string => {
  if (cause instanceof DOMException && cause.name === "NotAllowedError") {
    return "Microphone access is off. Allow it for this site, then try again.";
  }
  if (cause instanceof DOMException && cause.name === "NotFoundError") {
    return "No microphone was found.";
  }
  return cause instanceof Error ? cause.message : "The microphone could not start.";
};

/** Treats a component outside a Slide as active, while respecting its owning Slide when present. */
export const isRoomAudioOwnerActive = (root: Element): boolean => {
  const slide = root.closest("[data-drever-slide]");
  return slide === null || slide.getAttribute("data-slide-state") === "active";
};

/** Turns sound reaching the microphone into a persistent, local-only Stage signal. */
export function RoomAudio({
  autoStart = false,
  className,
  label = "Listen to the room",
  prompt = "Enable the microphone, then play music through your computer speakers.",
  reducedMotion,
  style,
  variant = "panel",
  ...props
}: RoomAudioProps): ReactElement {
  const renderMode = useDreverRenderMode();
  const interactive = renderMode === "audience";
  const ambient = variant === "ambient";
  const startsAutomatically = interactive && (autoStart || ambient);
  const activationRef = useRef<Promise<void> | undefined>(undefined);
  const autoLifecycleRef = useRef(0);
  const desiredActiveRef = useRef(false);
  const graphRef = useRef<RoomAudioGraph | undefined>(undefined);
  const mountedRef = useRef(false);
  const ownerActiveRef = useRef(false);
  const requestRef = useRef<Promise<MediaStream> | undefined>(undefined);
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
    ({ high, level, low, mid }: RoomAudioSignal): void => {
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

  const ensureGraph = useCallback((): RoomAudioGraph => {
    const current = graphRef.current;
    if (current !== undefined) return current;

    const context = new AudioContext();
    const analyser = context.createAnalyser();
    const silentOutput = context.createGain();
    analyser.fftSize = 256;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.78;
    silentOutput.gain.value = 0;
    analyser.connect(silentOutput);
    silentOutput.connect(context.destination);
    const graph: RoomAudioGraph = {
      analyser,
      context,
      data: new Uint8Array(analyser.frequencyBinCount),
      frame: undefined,
      lastFrameAt: undefined,
      range: INITIAL_AUDIO_RANGE,
    };
    graphRef.current = graph;
    return graph;
  }, []);

  const draw = useCallback(
    (graph: RoomAudioGraph): void => {
      graph.analyser.getByteFrequencyData(graph.data);
      const binHz = graph.context.sampleRate / graph.analyser.fftSize;
      const indexFor = (frequency: number): number =>
        Math.min(graph.data.length, Math.max(0, Math.round(frequency / binHz)));
      const now = performance.now();
      const elapsedMs =
        graph.lastFrameAt === undefined ? 1000 / 60 : Math.min(250, now - graph.lastFrameAt);
      graph.lastFrameAt = now;
      const frame = resolveRoomAudioFrame(
        {
          high: average(graph.data, indexFor(2_000), indexFor(8_000)),
          low: average(graph.data, indexFor(40), indexFor(220)),
          mid: average(graph.data, indexFor(220), indexFor(2_000)),
        },
        graph.range,
        elapsedMs,
      );
      graph.range = frame.range;
      setSignal(frame.signal);
      graph.frame = window.requestAnimationFrame(() => draw(graph));
    },
    [setSignal],
  );

  const stop = useCallback(
    async ({
      dispose = false,
      updateState = true,
    }: Readonly<{ dispose?: boolean; updateState?: boolean }> = {}): Promise<void> => {
      desiredActiveRef.current = false;
      const graph = graphRef.current;
      if (dispose) graphRef.current = undefined;
      const deactivation = dispose
        ? disposeRoomAudio(graph, (frame) => window.cancelAnimationFrame(frame))
        : deactivateRoomAudio(graph, (frame) => window.cancelAnimationFrame(frame));
      clearStageSignal();
      if (updateState && mountedRef.current) setPhase("idle");
      await deactivation;
    },
    [clearStageSignal],
  );

  const start = useCallback((): Promise<void> => {
    desiredActiveRef.current = true;
    if (graphRef.current?.stream !== undefined) {
      setPhase("active");
      return Promise.resolve();
    }
    const pendingActivation = activationRef.current;
    if (pendingActivation !== undefined) return pendingActivation;

    const activation = (async (): Promise<void> => {
      setError(undefined);
      setPhase("requesting");
      let stream: MediaStream | undefined;
      try {
        stream = await requestPendingRoomMicrophone(requestRef, navigator.mediaDevices);
        if (!mountedRef.current || !desiredActiveRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const graph = ensureGraph();
        releaseRoomAudioInput(graph, (frame) => window.cancelAnimationFrame(frame));
        graph.lastFrameAt = undefined;
        graph.range = INITIAL_AUDIO_RANGE;
        clearStageSignal();
        const activeStream = stream;
        graph.stream = activeStream;
        stream = undefined;
        const source = graph.context.createMediaStreamSource(activeStream);
        source.connect(graph.analyser);
        graph.source = source;
        activeStream.getTracks().forEach((track) =>
          track.addEventListener(
            "ended",
            () => {
              void stop({ dispose: startsAutomatically });
            },
            { once: true },
          ),
        );
        await graph.context.resume();

        if (!mountedRef.current || !desiredActiveRef.current) {
          graphRef.current = undefined;
          await disposeRoomAudio(graph, (frame) => window.cancelAnimationFrame(frame));
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
        await stop({ dispose: startsAutomatically });
        setError(errorMessage(cause));
      }
    })();
    activationRef.current = activation;
    const clearActivation = (): void => {
      if (activationRef.current === activation) activationRef.current = undefined;
    };
    void activation.then(clearActivation, clearActivation);
    return activation;
  }, [clearStageSignal, draw, ensureGraph, getStage, reducedMotion, startsAutomatically, stop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      desiredActiveRef.current = false;
      queueMicrotask(() => {
        if (mountedRef.current) return;
        const graph = graphRef.current;
        graphRef.current = undefined;
        clearStageSignal();
        void disposeRoomAudio(graph, (frame) => window.cancelAnimationFrame(frame));
      });
    };
  }, [clearStageSignal]);

  useEffect(() => {
    if (!startsAutomatically) return;
    const root = rootRef.current;
    if (root === null) return;
    const generation = autoLifecycleRef.current + 1;
    autoLifecycleRef.current = generation;
    const slide = root.closest("[data-drever-slide]");

    const syncWithOwner = (): void => {
      const active = isRoomAudioOwnerActive(root);
      ownerActiveRef.current = active;
      if (active) {
        void start();
        return;
      }
      desiredActiveRef.current = false;
      queueMicrotask(() => {
        if (autoLifecycleRef.current !== generation || ownerActiveRef.current) return;
        void stop({ dispose: true });
      });
    };

    const observer = slide === null ? undefined : new MutationObserver(syncWithOwner);
    if (slide !== null) {
      observer?.observe(slide, {
        attributeFilter: ["data-slide-state", "hidden"],
        attributes: true,
      });
    }
    syncWithOwner();

    return () => {
      observer?.disconnect();
      ownerActiveRef.current = false;
      desiredActiveRef.current = false;
      queueMicrotask(() => {
        if (autoLifecycleRef.current !== generation) return;
        void stop({ dispose: true });
      });
    };
  }, [start, startsAutomatically, stop]);

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
      className={[
        "drever-room-audio",
        ambient ? "drever-room-audio--ambient" : undefined,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-active={phase === "active" ? "" : undefined}
      data-phase={phase}
      data-render-mode={renderMode}
      data-source={phase === "active" ? "microphone" : undefined}
      data-variant={variant}
      ref={rootRef}
      style={rootStyle}
    >
      {ambient ? (
        <>
          <span
            aria-atomic="true"
            aria-live="polite"
            className="drever-room-audio__live"
            role="status"
          >
            {!interactive
              ? "Microphone visualization is available in audience view."
              : error !== undefined
                ? "Microphone unavailable."
                : phase === "active"
                  ? "Microphone active. The background is responding to sound."
                  : phase === "requesting"
                    ? "Requesting microphone permission."
                    : "Microphone starts when this slide is shown."}
          </span>
          {error === undefined ? null : (
            <p className="drever-room-audio__ambient-error" role="alert">
              {error}
            </p>
          )}
        </>
      ) : (
        <>
          <div aria-hidden="true" className="drever-room-audio__meter">
            <i data-band="low" />
            <i data-band="mid" />
            <i data-band="high" />
          </div>

          <div className="drever-room-audio__copy">
            <small>{phase === "active" ? "Listening now" : "Room Sense · microphone"}</small>
            <strong>{label}</strong>
            <span>
              {phase === "active"
                ? "The glow and rings are following the sound around you."
                : prompt}
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
        </>
      )}
    </section>
  );
}
