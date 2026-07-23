import { useEffect, useRef, useState } from "react";

import { CheckIcon, CopyIcon } from "./icons";

const heroMoments = [
  {
    detail: "Agree on the one decision this presentation must help people make.",
    index: "01",
    label: "Frame the question",
    signal: "What must the room decide?",
  },
  {
    detail: "Let the audience reveal which concern deserves the next piece of evidence.",
    index: "02",
    label: "Hear the room",
    signal: "What would help you decide?",
  },
  {
    detail: "Bring in the proof at the moment it can change the conversation.",
    index: "03",
    label: "Reveal the proof",
    signal: "96% completed setup unaided.",
  },
] as const;

export function HeroStage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeMoment = heroMoments[activeIndex] ?? heroMoments[0];

  return (
    <section className="hero-stage" aria-label="Interactive Drever presentation preview">
      <div className="hero-stage__canvas">
        <span className="hero-stage__kicker">Launch review · live</span>
        <h2>
          Make the next
          <br />
          <mark>decision clear.</mark>
        </h2>
        <div className="hero-stage__moment" key={activeMoment.index}>
          <span>{activeMoment.index}</span>
          <div>
            <strong>{activeMoment.signal}</strong>
            <p>{activeMoment.detail}</p>
          </div>
        </div>
        <span className="hero-stage__page">04 / 12</span>
      </div>

      <div className="hero-stage__controls" aria-label="Choose a presentation moment" role="group">
        {heroMoments.map((moment, index) => (
          <button
            aria-pressed={activeIndex === index}
            key={moment.index}
            onClick={() => setActiveIndex(index)}
            type="button"
          >
            <span>{moment.index}</span>
            <strong>{moment.label}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

export function ThemePreview({ theme }: { theme: "default" | "editorial" | "studio" }) {
  if (theme === "editorial") {
    return (
      <div className="theme-preview theme-preview--editorial" aria-hidden="true">
        <span>Field notes · 04</span>
        <strong>
          Ideas need
          <br />
          room to arrive.
        </strong>
        <i />
        <small>Pause before the proof.</small>
      </div>
    );
  }

  if (theme === "studio") {
    return (
      <div className="theme-preview theme-preview--studio" aria-hidden="true">
        <span>DECISION / 03</span>
        <strong>
          One system.
          <br />
          Every surface.
        </strong>
        <div>
          <i />
          <i />
          <i />
        </div>
        <small>COMPILE · ROUTE · DELIVER</small>
      </div>
    );
  }

  return (
    <div className="theme-preview theme-preview--default" aria-hidden="true">
      <span>Quarterly review</span>
      <strong>
        Make the next
        <br />
        step obvious.
      </strong>
      <div>
        <i />
        <i />
        <i />
      </div>
      <small>03 / 12</small>
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

export function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <div className="code-block">
      <div className="code-block__bar">
        <span>{label ?? "Code"}</span>
        <CopyButton label="code" value={children} />
      </div>
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const copy = async () => {
    window.clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    resetTimer.current = window.setTimeout(() => setStatus("idle"), 1600);
  };

  const text = status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : "Copy";

  return (
    <button aria-label={`${text} ${label}`} onClick={copy} type="button">
      {status === "copied" ? <CheckIcon /> : <CopyIcon />}
      <span aria-live="polite">{text}</span>
    </button>
  );
}
