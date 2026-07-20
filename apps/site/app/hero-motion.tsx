import { useEffect, useRef } from "react";

type Rgb = readonly [number, number, number];
type Point = readonly [x: number, y: number];

const GRID_COLUMNS = 44;
const GRID_ROWS = 25;
const CONTENT_PARTICLE_COUNT = 1800;
const SLIDE_HALF_WIDTH = 1.12;
const SLIDE_HALF_HEIGHT = SLIDE_HALF_WIDTH * (9 / 16);

const vertexShaderSource = `
  precision highp float;

  attribute vec2 a_position0;
  attribute vec2 a_position1;
  attribute vec2 a_position2;
  attribute float a_seed;
  attribute float a_tone;
  attribute float a_kind;
  attribute float a_size;

  uniform vec2 u_resolution;
  uniform vec2 u_pointer;
  uniform float u_pixel_ratio;
  uniform float u_time;
  uniform vec3 u_signal;
  uniform vec3 u_route;
  uniform vec3 u_ink;

  varying vec3 v_color;
  varying float v_alpha;

  const float PI = 3.141592653589793;

  vec2 positionAt(float index) {
    if (index < 0.5) return a_position0;
    if (index < 1.5) return a_position1;
    return a_position2;
  }

  vec3 toneColor(float tone) {
    vec3 inkToRoute = mix(u_ink, u_route, clamp(tone, 0.0, 1.0));
    return mix(inkToRoute, u_signal, clamp(tone - 1.0, 0.0, 1.0));
  }

  void main() {
    float sequence = mod(u_time / 6.5, 3.0);
    float fromIndex = floor(sequence);
    float toIndex = mod(fromIndex + 1.0, 3.0);
    float localTime = fract(sequence);
    float transition = smoothstep(0.58, 0.94, localTime);
    vec2 fromPosition = positionAt(fromIndex);
    vec2 toPosition = positionAt(toIndex);
    float horizontalOrder = clamp(
      (fromPosition.x / ${SLIDE_HALF_WIDTH.toFixed(2)} + 1.0) * 0.5,
      0.0,
      1.0
    );
    float verticalOrder = clamp(
      (fromPosition.y / ${SLIDE_HALF_HEIGHT.toFixed(4)} + 1.0) * 0.5,
      0.0,
      1.0
    );
    float delay = (horizontalOrder * 0.11 + verticalOrder * 0.035) * a_kind;
    float progress = smoothstep(delay, 1.0, transition);
    float flight = sin(progress * PI) * a_kind;

    vec2 direction = toPosition - fromPosition;
    float directionLength = max(length(direction), 0.0001);
    vec2 perpendicular = vec2(-direction.y, direction.x) / directionLength;
    float arcDirection = direction.x * direction.y < 0.0 ? -1.0 : 1.0;
    float arcHeight = (0.025 + min(directionLength, 1.2) * 0.028) * arcDirection;

    vec2 point =
      mix(fromPosition, toPosition, progress) +
      perpendicular * flight * arcHeight;
    float depth = flight * (0.045 + fract(a_seed * 13.17) * 0.11);

    vec2 planeMotion = vec2(
      sin(u_time * 0.19) * 0.014,
      cos(u_time * 0.16) * 0.011
    );
    planeMotion += vec2(u_pointer.x * 0.021, -u_pointer.y * 0.016);
    point += planeMotion * mix(0.76, 1.0, a_kind);
    point.x += point.y * u_pointer.x * 0.012;
    point.y -= point.x * u_pointer.y * 0.008;
    depth += (u_pointer.x * point.x - u_pointer.y * point.y) * 0.012;

    float perspective = 1.0 / max(0.82, 1.0 - depth * 0.38);
    float aspect = u_resolution.x / max(u_resolution.y, 1.0);
    vec2 clipPosition = vec2(
      point.x * perspective / aspect,
      point.y * perspective
    );

    float baseSize = mix(0.54, 1.38, a_kind);
    float sizeVariation = mix(0.16, 0.48, a_kind) * a_size;
    gl_PointSize = max(
      1.0,
      (baseSize + sizeVariation + flight * 0.18) *
        u_pixel_ratio *
        perspective
    );
    gl_Position = vec4(clipPosition, 0.0, 1.0);
    v_color = toneColor(a_tone);
    v_alpha = mix(0.105, 0.78, a_kind);
  }
`;

const fragmentShaderSource = `
  precision mediump float;

  varying vec3 v_color;
  varying float v_alpha;

  void main() {
    float distanceToCenter = length(gl_PointCoord - vec2(0.5));
    float dotMask = 1.0 - smoothstep(0.3, 0.5, distanceToCenter);
    gl_FragColor = vec4(v_color, v_alpha * dotMask);
  }
`;

function createRandom(seed: number) {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function gridPoint(
  index: number,
  count: number,
  left: number,
  top: number,
  width: number,
  height: number,
  columns: number,
): Point {
  const rows = Math.ceil(count / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);

  return [
    (left + ((column + 0.5) / columns) * width) * SLIDE_HALF_WIDTH,
    (top + ((row + 0.5) / rows) * height) * SLIDE_HALF_HEIGHT,
  ];
}

function layoutRegion(
  index: number,
  start: number,
  end: number,
  bounds: readonly [left: number, top: number, width: number, height: number],
  columns: number,
): Point {
  return gridPoint(index - start, end - start, ...bounds, columns);
}

function sampleLayout(index: number, state: number): Point {
  if (state === 0) {
    if (index < 96) return layoutRegion(index, 0, 96, [-0.72, -0.62, 0.23, 0.035], 32);
    if (index < 540) return layoutRegion(index, 96, 540, [-0.72, -0.42, 0.68, 0.13], 37);
    if (index < 900) return layoutRegion(index, 540, 900, [-0.72, -0.22, 0.55, 0.12], 36);
    if (index < 1120) return layoutRegion(index, 900, 1120, [-0.72, -0.025, 0.38, 0.1], 22);
    if (index < 1240) return layoutRegion(index, 1120, 1240, [-0.72, 0.28, 0.48, 0.035], 40);
    if (index < 1324) return layoutRegion(index, 1240, 1324, [-0.72, 0.37, 0.34, 0.035], 28);
    if (index < 1492) return layoutRegion(index, 1324, 1492, [0.18, -0.5, 0.5, 0.18], 21);
    if (index < 1646) return layoutRegion(index, 1492, 1646, [0.07, -0.13, 0.62, 0.17], 22);
    return layoutRegion(index, 1646, 1800, [0.26, 0.24, 0.43, 0.17], 22);
  }

  if (state === 1) {
    if (index < 96) return layoutRegion(index, 0, 96, [-0.72, -0.63, 0.03, 0.24], 4);
    if (index < 540) return layoutRegion(index, 96, 540, [-0.62, -0.62, 0.72, 0.12], 37);
    if (index < 900) return layoutRegion(index, 540, 900, [-0.62, -0.44, 0.58, 0.11], 36);
    if (index < 1324) return layoutRegion(index, 900, 1324, [-0.72, -0.12, 0.74, 0.55], 24);
    if (index < 1484) return layoutRegion(index, 1324, 1484, [0.2, -0.1, 0.5, 0.04], 40);
    if (index < 1604) return layoutRegion(index, 1484, 1604, [0.2, 0.03, 0.4, 0.04], 40);
    if (index < 1694) return layoutRegion(index, 1604, 1694, [0.2, 0.16, 0.3, 0.04], 30);
    return layoutRegion(index, 1694, 1800, [0.2, 0.36, 0.22, 0.05], 26);
  }

  if (index < 96) return layoutRegion(index, 0, 96, [-0.72, -0.62, 0.23, 0.035], 32);
  if (index < 540) return layoutRegion(index, 96, 540, [-0.72, -0.48, 0.78, 0.12], 37);
  if (index < 900) return layoutRegion(index, 540, 900, [-0.72, -0.3, 0.58, 0.1], 36);

  const barIndex = Math.min(4, Math.floor((index - 900) / 180));
  const barStart = 900 + barIndex * 180;
  const heights = [0.24, 0.43, 0.33, 0.62, 0.5];
  const height = heights[barIndex]!;
  return layoutRegion(
    index,
    barStart,
    barStart + 180,
    [-0.65 + barIndex * 0.29, 0.57 - height, 0.17, height],
    12,
  );
}

function createParticleData() {
  const random = createRandom(0x44525652);
  const backgroundCount = GRID_COLUMNS * GRID_ROWS;
  const particleCount = backgroundCount + CONTENT_PARTICLE_COUNT;
  const stride = 10;
  const data = new Float32Array(particleCount * stride);
  let offset = 0;

  function push(
    position0: Point,
    position1: Point,
    position2: Point,
    seed: number,
    tone: number,
    kind: number,
    size: number,
  ) {
    data[offset] = position0[0];
    data[offset + 1] = position0[1];
    data[offset + 2] = position1[0];
    data[offset + 3] = position1[1];
    data[offset + 4] = position2[0];
    data[offset + 5] = position2[1];
    data[offset + 6] = seed;
    data[offset + 7] = tone;
    data[offset + 8] = kind;
    data[offset + 9] = size;
    offset += stride;
  }

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let column = 0; column < GRID_COLUMNS; column += 1) {
      const point: Point = [
        -SLIDE_HALF_WIDTH + (column / (GRID_COLUMNS - 1)) * SLIDE_HALF_WIDTH * 2,
        -SLIDE_HALF_HEIGHT + (row / (GRID_ROWS - 1)) * SLIDE_HALF_HEIGHT * 2,
      ];
      push(point, point, point, random(), 1, 0, random());
    }
  }

  for (let index = 0; index < CONTENT_PARTICLE_COUNT; index += 1) {
    const tone = index < 96 ? 2 : index < 900 ? 0 : 1;
    push(
      sampleLayout(index, 0),
      sampleLayout(index, 1),
      sampleLayout(index, 2),
      random(),
      tone,
      1,
      random(),
    );
  }

  return { data, particleCount };
}

function parseCssColor(value: string, fallback: Rgb): Rgb {
  const color = value.trim();

  if (/^#[\da-f]{6}$/i.test(color)) {
    return [
      Number.parseInt(color.slice(1, 3), 16) / 255,
      Number.parseInt(color.slice(3, 5), 16) / 255,
      Number.parseInt(color.slice(5, 7), 16) / 255,
    ];
  }

  const rgb = color
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number);
  if (rgb?.length === 3) {
    return [rgb[0]! / 255, rgb[1]! / 255, rgb[2]! / 255];
  }

  return fallback;
}

function createShader(context: WebGLRenderingContext, type: number, source: string) {
  const shader = context.createShader(type);
  if (!shader) return null;

  context.shaderSource(shader, source);
  context.compileShader(shader);
  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    context.deleteShader(shader);
    return null;
  }

  return shader;
}

export function HeroMotion() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const context = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
    });
    if (!context) return;

    const vertexShader = createShader(context, context.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(context, context.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) return;

    const program = context.createProgram();
    const buffer = context.createBuffer();
    if (!program || !buffer) return;

    context.attachShader(program, vertexShader);
    context.attachShader(program, fragmentShader);
    context.linkProgram(program);
    if (!context.getProgramParameter(program, context.LINK_STATUS)) return;

    const particles = createParticleData();
    context.useProgram(program);
    context.enable(context.BLEND);
    context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA);
    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.bufferData(context.ARRAY_BUFFER, particles.data, context.STATIC_DRAW);

    const stride = 10 * Float32Array.BYTES_PER_ELEMENT;
    const attributes = [
      ["a_position0", 2, 0],
      ["a_position1", 2, 2],
      ["a_position2", 2, 4],
      ["a_seed", 1, 6],
      ["a_tone", 1, 7],
      ["a_kind", 1, 8],
      ["a_size", 1, 9],
    ] as const;

    for (const [name, size, floatOffset] of attributes) {
      const location = context.getAttribLocation(program, name);
      context.enableVertexAttribArray(location);
      context.vertexAttribPointer(
        location,
        size,
        context.FLOAT,
        false,
        stride,
        floatOffset * Float32Array.BYTES_PER_ELEMENT,
      );
    }

    const resolutionLocation = context.getUniformLocation(program, "u_resolution");
    const pointerLocation = context.getUniformLocation(program, "u_pointer");
    const pixelRatioLocation = context.getUniformLocation(program, "u_pixel_ratio");
    const timeLocation = context.getUniformLocation(program, "u_time");
    const signalLocation = context.getUniformLocation(program, "u_signal");
    const routeLocation = context.getUniformLocation(program, "u_route");
    const inkLocation = context.getUniformLocation(program, "u_ink");

    let signal: Rgb = [0.78, 0.94, 0.23];
    let route: Rgb = [0.36, 0.27, 0.85];
    let ink: Rgb = [0.1, 0.09, 0.17];

    function updatePalette() {
      const styles = getComputedStyle(document.documentElement);
      signal = parseCssColor(styles.getPropertyValue("--site-signal"), signal);
      route = parseCssColor(styles.getPropertyValue("--site-route"), route);
      ink = parseCssColor(styles.getPropertyValue("--site-text"), ink);
    }

    updatePalette();

    let width = 1;
    let height = 1;
    let pixelRatio = 1;

    function resize() {
      const bounds = canvas!.getBoundingClientRect();
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(bounds.width * pixelRatio));
      height = Math.max(1, Math.round(bounds.height * pixelRatio));
      canvas!.width = width;
      canvas!.height = height;
      context!.viewport(0, 0, width, height);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    resize();

    const themeObserver = new MutationObserver(updatePalette);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

    function handlePointerMove(event: PointerEvent) {
      const bounds = stage!.getBoundingClientRect();
      pointer.targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * SLIDE_HALF_WIDTH * 2;
      pointer.targetY =
        ((event.clientY - bounds.top) / bounds.height - 0.5) * SLIDE_HALF_HEIGHT * 2;
    }

    function resetPointer() {
      pointer.targetX = 0;
      pointer.targetY = 0;
    }

    stage.addEventListener("pointermove", handlePointerMove);
    stage.addEventListener("pointerleave", resetPointer);

    function draw(time: number) {
      pointer.x += (pointer.targetX - pointer.x) * 0.03;
      pointer.y += (pointer.targetY - pointer.y) * 0.03;
      context!.clearColor(0, 0, 0, 0);
      context!.clear(context!.COLOR_BUFFER_BIT);
      context!.uniform2f(resolutionLocation, width, height);
      context!.uniform2f(pointerLocation, pointer.x, pointer.y);
      context!.uniform1f(pixelRatioLocation, pixelRatio);
      context!.uniform1f(timeLocation, time * 0.001);
      context!.uniform3fv(signalLocation, signal);
      context!.uniform3fv(routeLocation, route);
      context!.uniform3fv(inkLocation, ink);
      context!.drawArrays(context!.POINTS, 0, particles.particleCount);
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;

    function animate(time: number) {
      draw(time);
      animationFrame = window.requestAnimationFrame(animate);
    }

    if (reducedMotion.matches) {
      draw(1200);
    } else {
      animationFrame = window.requestAnimationFrame(animate);
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      stage.removeEventListener("pointermove", handlePointerMove);
      stage.removeEventListener("pointerleave", resetPointer);
      context.deleteBuffer(buffer);
      context.deleteProgram(program);
      context.deleteShader(vertexShader);
      context.deleteShader(fragmentShader);
    };
  }, []);

  return (
    <div className="hero-motion" aria-hidden="true">
      <div className="hero-motion__stage" ref={stageRef}>
        <canvas className="hero-motion__canvas" ref={canvasRef} />
      </div>
    </div>
  );
}
