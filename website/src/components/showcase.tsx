import type { ThemeId } from "../site-data";
import { CopyButton } from "./copy-button";

export function HeroStage() {
  return (
    <figure
      className="hero-stage"
      aria-label="One idea becoming a coherent visual system across a presentation"
    >
      <div className="hero-stage__halo" aria-hidden="true" />
      <div className="hero-stage__plane hero-stage__plane--back" aria-hidden="true" />
      <div className="hero-stage__plane hero-stage__plane--middle" aria-hidden="true" />
      <div className="hero-stage__canvas" aria-hidden="true">
        <div className="hero-stage__rail">
          <i />
          <i />
          <i />
        </div>
        <div className="hero-stage__orbit hero-stage__orbit--wide">
          <i />
        </div>
        <div className="hero-stage__orbit hero-stage__orbit--tall">
          <i />
        </div>
        <div className="hero-stage__core">
          <span />
          <span />
          <i />
        </div>
        <div className="hero-stage__frame">
          <i />
          <i />
        </div>
      </div>
      <figcaption>Intent becomes visual direction, motion, and a complete deck.</figcaption>
    </figure>
  );
}

export function ThemePreview({ theme }: { theme: ThemeId }) {
  if (theme === "fieldnote") {
    return (
      <div className="theme-preview theme-preview--fieldnote" aria-hidden="true">
        <span>Workshop · 02</span>
        <strong>
          Start with
          <br />
          what changed.
        </strong>
        <i />
        <small>note → name the turning point</small>
      </div>
    );
  }

  if (theme === "atlas") {
    return (
      <div className="theme-preview theme-preview--atlas" aria-hidden="true">
        <span>37.8° N / 122.4° W</span>
        <strong>
          Find the route
          <br />
          through change.
        </strong>
        <div>
          <i />
          <i />
          <i />
        </div>
        <small>03 / 05 · CURRENT WAYPOINT</small>
      </div>
    );
  }

  if (theme === "ledger") {
    return (
      <div className="theme-preview theme-preview--ledger" aria-hidden="true">
        <span>OPERATING REVIEW / Q3</span>
        <strong>18.4%</strong>
        <div>
          <i />
          <b>+3.2 pts</b>
        </div>
        <small>Source · verified close</small>
      </div>
    );
  }

  if (theme === "cinema") {
    return (
      <div className="theme-preview theme-preview--cinema" aria-hidden="true">
        <span>SCENE 04</span>
        <strong>
          The quiet
          <br />
          turning point.
        </strong>
        <i />
        <small>00:42:18 · CASE STUDY</small>
      </div>
    );
  }

  if (theme === "construct") {
    return (
      <div className="theme-preview theme-preview--construct" aria-hidden="true">
        <span>ASSEMBLY · 03</span>
        <strong>
          Build the answer
          <br />
          together.
        </strong>
        <div>
          <i />
          <i />
          <i />
        </div>
        <small>01 + 02 → 03</small>
      </div>
    );
  }

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
