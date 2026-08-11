import { useEffect, useRef, type ReactNode } from "react";

import { CopyButton } from "./copy-button";

export function HeroStage() {
  const stageRef = useRef<HTMLElement>(null);
  const lightfieldRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const pointerFrameRef = useRef<number | undefined>(undefined);

  const updatePointer = (event: PointerEvent) => {
    if (
      event.pointerType === "touch" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;

    const hero = stage.closest<HTMLElement>(".home-hero");
    if (!hero) return;

    const stageBounds = stage.getBoundingClientRect();
    const heroBounds = hero.getBoundingClientRect();
    const isOverStage =
      event.clientX >= stageBounds.left &&
      event.clientX <= stageBounds.right &&
      event.clientY >= stageBounds.top &&
      event.clientY <= stageBounds.bottom;
    const bounds = isOverStage ? stageBounds : heroBounds;
    const influence = isOverStage ? 1 : 0.5;
    const x =
      Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1)) * influence;
    const y =
      Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1)) * influence;
    pointerRef.current = { x, y };

    window.cancelAnimationFrame(pointerFrameRef.current ?? 0);
    pointerFrameRef.current = window.requestAnimationFrame(() => {
      stage.style.setProperty("--hero-tilt-x", `${(-y * 4).toFixed(2)}deg`);
      stage.style.setProperty("--hero-tilt-y", `${(x * 6).toFixed(2)}deg`);
      stage.style.setProperty("--hero-shift-x", `${(x * 6).toFixed(2)}px`);
      stage.style.setProperty("--hero-shift-y", `${(y * 5).toFixed(2)}px`);
      stage.style.setProperty("--hero-pointer-x", `${((x + 1) * 50).toFixed(2)}%`);
      stage.style.setProperty("--hero-pointer-y", `${((y + 1) * 50).toFixed(2)}%`);
      stage.dataset.active = "true";
    });
  };

  const resetPointer = () => {
    pointerRef.current = { x: 0, y: 0 };

    const stage = stageRef.current;
    if (!stage) return;

    window.cancelAnimationFrame(pointerFrameRef.current ?? 0);
    pointerFrameRef.current = window.requestAnimationFrame(() => {
      stage.style.setProperty("--hero-tilt-x", "0deg");
      stage.style.setProperty("--hero-tilt-y", "0deg");
      stage.style.setProperty("--hero-shift-x", "0px");
      stage.style.setProperty("--hero-shift-y", "0px");
      stage.style.setProperty("--hero-pointer-x", "50%");
      stage.style.setProperty("--hero-pointer-y", "50%");
      delete stage.dataset.active;
    });
  };

  useEffect(() => {
    const stage = stageRef.current;
    const hero = stage?.closest<HTMLElement>(".home-hero");
    if (!hero) return;

    hero.addEventListener("pointermove", updatePointer, { passive: true });
    hero.addEventListener("pointerleave", resetPointer);
    return () => {
      hero.removeEventListener("pointermove", updatePointer);
      hero.removeEventListener("pointerleave", resetPointer);
    };
  }, []);

  useEffect(() => {
    const canvas = lightfieldRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
      premultipliedAlpha: true,
    });
    if (!gl) return;

    const vertexSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    const fragmentSource = `
      precision highp float;

      uniform vec2 u_resolution;
      uniform vec2 u_pointer;
      uniform float u_time;

      float glow(vec2 point, vec2 center, float size) {
        float distanceFromCenter = length(point - center);
        return size / max(distanceFromCenter, 0.035);
      }

      void main() {
        vec2 resolution = max(u_resolution, vec2(1.0));
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        vec2 pointer = (u_pointer * 2.0 - 1.0);
        pointer.x *= resolution.x / resolution.y;

        float time = u_time * 0.11;
        vec2 limePosition = vec2(
          0.42 * cos(time * 0.9) + pointer.x * 0.13,
          0.34 * sin(time * 1.1) + pointer.y * 0.10
        );
        vec2 violetPosition = vec2(
          -0.46 * cos(time * 0.72) - pointer.x * 0.09,
          -0.3 * sin(time * 0.8) - pointer.y * 0.08
        );

        float lime = pow(glow(uv, limePosition, 0.105), 1.55);
        float violet = pow(glow(uv, violetPosition, 0.12), 1.48);
        float pointerGlow = pow(glow(uv, pointer * 0.62, 0.045), 1.32);
        float ribbon = 0.5 + 0.5 * sin(
          uv.x * 3.4 - uv.y * 2.1 + time * 2.0 + sin(uv.y * 2.8 + time)
        );
        ribbon = pow(ribbon, 9.0) * smoothstep(1.25, 0.05, length(uv));

        vec3 color = vec3(0.95, 0.94, 0.99);
        color += vec3(0.64, 0.93, 0.08) * lime * 0.07;
        color += vec3(0.42, 0.32, 0.96) * violet * 0.10;
        color += vec3(0.76, 0.95, 0.42) * pointerGlow * 0.035;
        color += vec3(0.48, 0.40, 0.98) * ribbon * 0.055;

        float vignette = smoothstep(1.42, 0.12, length(uv));
        float alpha = clamp(vignette * 0.48, 0.0, 0.48);
        gl_FragColor = vec4(color * alpha, alpha);
      }
    `;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const pointerLocation = gl.getUniformLocation(program, "u_pointer");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let visible = true;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
      const width = Math.max(1, Math.round(bounds.width * pixelRatio));
      const height = Math.max(1, Math.round(bounds.height * pixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    };

    const draw = (time: number) => {
      resize();
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform2f(
        pointerLocation,
        pointerRef.current.x * 0.5 + 0.5,
        0.5 - pointerRef.current.y * 0.5,
      );
      gl.uniform1f(timeLocation, reducedMotion.matches ? 0 : time / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (visible && !reducedMotion.matches) {
        animationFrame = window.requestAnimationFrame(draw);
      }
    };

    const start = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(draw);
    };
    const handleMotionPreference = () => start();
    const resizeObserver =
      typeof ResizeObserver === "function" ? new ResizeObserver(() => start()) : undefined;
    const visibilityObserver =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? true;
            if (visible) start();
            else window.cancelAnimationFrame(animationFrame);
          })
        : undefined;

    resizeObserver?.observe(canvas);
    visibilityObserver?.observe(canvas);
    reducedMotion.addEventListener("change", handleMotionPreference);
    start();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(pointerFrameRef.current ?? 0);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      reducedMotion.removeEventListener("change", handleMotionPreference);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return (
    <figure
      className="hero-stage"
      aria-label="A local agent moving from brief to Storyboard to live deck under human direction"
      ref={stageRef}
    >
      <canvas className="hero-stage__lightfield" ref={lightfieldRef} aria-hidden="true" />
      <div className="hero-stage__halo" aria-hidden="true" />
      <div className="hero-stage__mesh" aria-hidden="true" />
      <div className="hero-stage__scene" aria-hidden="true">
        <div className="hero-stage__deck">
          <div className="hero-stage__plane hero-stage__plane--back" />
          <div className="hero-stage__plane hero-stage__plane--middle" />
          <div className="hero-stage__canvas">
            <div className="hero-stage__shine" />
            <div className="hero-stage__rail">
              <i />
              <i />
              <i />
            </div>
            <div className="hero-stage__orbit hero-stage__orbit--upper" />
            <div className="hero-stage__orbit hero-stage__orbit--lower" />
            <div className="hero-stage__source">
              <span />
              <span />
              <i />
            </div>
            <div className="hero-stage__outcome">
              <i />
            </div>
            <div className="hero-stage__frame">
              <i />
              <i />
            </div>
          </div>
        </div>
        <div className="hero-stage__satellite hero-stage__satellite--one">
          <i />
        </div>
        <div className="hero-stage__satellite hero-stage__satellite--two">
          <i />
        </div>
        <div className="hero-stage__satellite hero-stage__satellite--three">
          <i />
        </div>
      </div>
      <figcaption>
        A brief becoming an approved story, a directed live draft, and a checked presentation.
      </figcaption>
    </figure>
  );
}

export function HomeShowcaseCover({ kind }: { kind: "motion" | "product" }) {
  if (kind === "product") {
    return (
      <div className="home-showcase-cover home-showcase-cover--product" aria-hidden="true">
        <div className="home-showcase-cover__meta">
          <span>Live product story</span>
          <small>08 / 09</small>
        </div>
        <div className="home-product-cover__statement">
          <strong>The room</strong>
          <strong>
            <mark>changes.</mark>
          </strong>
        </div>
        <div className="home-product-cover__surfaces">
          <div data-surface="audience">
            <span>Audience</span>
            <strong>What would help you decide?</strong>
            <small>Step 02 / 02</small>
          </div>
          <div data-surface="speaker">
            <span>Speaker</span>
            <strong>Next: reveal the proof</strong>
            <small>Note · 08:42</small>
          </div>
          <div data-surface="document">
            <span>Document</span>
            <strong>The exact moment stays readable.</strong>
            <small>/7/2 · searchable</small>
          </div>
        </div>
        <small className="home-product-cover__promise">One story · every useful surface</small>
      </div>
    );
  }

  return (
    <div className="home-showcase-cover home-showcase-cover--motion" aria-hidden="true">
      <div className="home-showcase-cover__meta">
        <span>Object lifecycle</span>
        <small>03 / 18</small>
      </div>
      <div className="home-motion-cover__artifact">
        <header>
          <i />
          <i />
          <i />
        </header>
        <div>
          <span />
          <strong />
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="home-motion-cover__answer">
        <span>Same object</span>
        <strong>New narrative job.</strong>
      </div>
      <div className="home-motion-cover__route">
        <span>arrive</span>
        <i />
        <span>explain</span>
        <i />
        <span>recede</span>
        <b />
      </div>
    </div>
  );
}

export function CopyCommand({ command }: { command: string }) {
  return (
    <div className="copy-command">
      <code>{command}</code>
      <CopyButton label="command" value={command} />
    </div>
  );
}

export function CodeBlock({
  children,
  label,
  renderedCode,
}: {
  children: string;
  label?: string;
  renderedCode?: ReactNode;
}) {
  return (
    <div className="code-block" data-header-tone="dark">
      <div className="code-block__bar">
        <span>{label ?? "Code"}</span>
        <CopyButton label="code" value={children} />
      </div>
      <pre aria-label={`${label ?? "Code"} example`} tabIndex={0}>
        {renderedCode ?? <code>{children}</code>}
      </pre>
    </div>
  );
}
