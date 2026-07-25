import type { ReactElement } from "react";
import "./studio-request-trace.css";

export type RequestTracePhase = "diagnosis" | "overview" | "verified";

const nodes = [
  { label: "Client", node: "client", time: "22 ms" },
  { label: "Router", node: "router", time: "18 ms" },
  { label: "Transform", node: "transform", time: "640 ms" },
  { label: "Render", node: "render", time: "94 ms" },
] as const;

const descriptions: Record<RequestTracePhase, string> = {
  diagnosis:
    "Illustrative request trace 7F3A. Client takes 22 milliseconds, router 18, transform 640, and render 94. Transform is the owning bottleneck.",
  overview:
    "Illustrative request trace 7F3A across client, router, transform, and render. Total captured latency is 774 milliseconds.",
  verified:
    "Illustrative request trace 7F3A remains as the diagnosed baseline while a verification signal confirms the transform boundary has been corrected.",
};

/** A fixed four-boundary trace whose focal state changes without moving the topology. */
export const RequestTrace = ({ phase }: Readonly<{ phase: RequestTracePhase }>): ReactElement => (
  <div
    aria-label={descriptions[phase]}
    className="theme-showcase-studio-request-trace"
    data-phase={phase}
    role="img"
  >
    <header>
      <span>Trace 7F3A</span>
      <strong>One request · four boundaries</strong>
    </header>
    <div aria-hidden="true" className="theme-showcase-studio-request-trace__nodes">
      {nodes.map(({ label, node, time }, index) => (
        <section data-node={node} key={node}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{label}</strong>
          <div>
            <i />
            <b />
          </div>
          <small>{time}</small>
        </section>
      ))}
      <span className="theme-showcase-studio-request-trace__verification" />
    </div>
    <footer>
      <span>Captured baseline</span>
      <strong>774 ms total</strong>
    </footer>
  </div>
);
