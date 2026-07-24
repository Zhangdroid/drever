import { useStage } from "@drever/client";
import type { CSSProperties, ReactElement, ReactNode } from "react";

type GraphNodeProps = Readonly<{
  className?: string;
  detail?: string;
  label: string;
  signal?: boolean;
}>;

const GraphNode = ({
  className = "",
  detail,
  label,
  signal = false,
}: GraphNodeProps): ReactElement => (
  <div className={`arch-graph-node ${className}`} data-signal={signal ? "" : undefined}>
    {detail === undefined ? null : <small>{detail}</small>}
    <strong>{label}</strong>
  </div>
);

export const BuildGraph = ({
  resolved = false,
}: Readonly<{ resolved?: boolean }>): ReactElement => (
  <div className="arch-build-graph" data-resolved={resolved ? "" : undefined}>
    <svg aria-hidden="true" viewBox="0 0 760 430">
      <path className="arch-edge" d="M130 215H165" />
      <path className="arch-edge" d="M285 215H320" />
      <path className="arch-edge" d="M440 215H475" />
      <path className="arch-edge" d="M595 215H615" />
      <path className="arch-edge" d="M615 215V89H632" />
      <path className="arch-edge" d="M615 215V189H632" />
      <path className="arch-edge" d="M615 215V289H632" />
      <path className="arch-edge" d="M615 215V389H632" />
      <path className="arch-edge arch-edge--signal" d="M130 215H615V89H632" pathLength="1" />
    </svg>
    <GraphNode className="arch-node--source" detail="AUTHORED" label="MDX" />
    <GraphNode className="arch-node--ir" detail="SEMANTICS" label="Deck IR" />
    <GraphNode className="arch-node--manifest" detail="CONTRACT" label="Manifest" signal />
    <GraphNode className="arch-node--runtime" detail="INTERPRETER" label="Runtime" />
    <div className="arch-surface-stack">
      <GraphNode detail="SURFACE" label="Audience" signal={resolved} />
      <GraphNode detail="SURFACE" label="Speaker" signal={resolved} />
      <GraphNode detail="SURFACE" label="Document" signal={resolved} />
      <GraphNode detail="SURFACE" label="Export" signal={resolved} />
    </div>
    <span className="arch-signal-pulse" aria-hidden="true" />
  </div>
);

const Surface = ({
  className,
  label,
  value,
}: Readonly<{ className: string; label: string; value: string }>): ReactElement => (
  <div className={`arch-drift-surface ${className}`}>
    <small>{label}</small>
    <strong>{value}</strong>
  </div>
);

export const InvariantMap = (): ReactElement => (
  <div className="arch-invariant-map">
    <svg aria-hidden="true" viewBox="0 0 1040 470">
      <path d="M520 235L190 105" />
      <path d="M520 235L850 105" />
      <path d="M520 235L190 365" />
      <path d="M520 235L850 365" />
    </svg>
    <div className="arch-contract-core">
      <small>SEMANTIC CENTER</small>
      <strong>Deck contract</strong>
      <span>slides · steps · notes · source</span>
    </div>
    <Surface className="arch-drift--audience" label="Audience" value="04 / step 5" />
    <Surface className="arch-drift--speaker" label="Speaker" value="04 / step 5" />
    <Surface className="arch-drift--document" label="Document" value="04 / step 5" />
    <Surface className="arch-drift--export" label="Export" value="04 / step 5" />
  </div>
);

type Artifact = Readonly<{
  code: ReactNode;
  detail: string;
  label: string;
}>;

const ARTIFACTS = [
  {
    label: "Authored source",
    detail: "Readable intent",
    code: (
      <>
        <b># Ship one story.</b>
        <span>&lt;Step&gt;Reveal the proof.&lt;/Step&gt;</span>
        <span>&lt;Note&gt;Pause here.&lt;/Note&gt;</span>
      </>
    ),
  },
  {
    label: "Deck IR",
    detail: "Serializable meaning",
    code: (
      <>
        <b>{"slide: { index: 3, id: 'proof' }"}</b>
        <span>{"steps: [1]"}</span>
        <span>{"note: { line: 5, value: 'Pause here.' }"}</span>
      </>
    ),
  },
  {
    label: "Manifest",
    detail: "Frozen navigation contract",
    code: (
      <>
        <b>{'"id": "proof"'}</b>
        <span>{'"stepStops": [1]'}</span>
        <span>{'"speakerNotes": [{ "format": "markdown" }]'}</span>
      </>
    ),
  },
  {
    label: "Runtime",
    detail: "One exact position",
    code: (
      <>
        <b>{'"surface": "audience"'}</b>
        <span>{'"slideIndex": 3'}</span>
        <span>{'"step": 1'}</span>
      </>
    ),
  },
] as const satisfies readonly Artifact[];

export const ArtifactLineage = (): ReactElement => {
  const { position } = useStage();
  const artifactIndex = Math.min(Math.max(position.step, 0), ARTIFACTS.length - 1);
  const artifact = ARTIFACTS[artifactIndex] ?? ARTIFACTS[0];

  return (
    <div className="arch-artifact-lineage">
      <div className="arch-lineage-rail" aria-label="Artifact lineage">
        {ARTIFACTS.map((candidate, index) => (
          <div
            key={candidate.label}
            className="arch-lineage-stop"
            data-active={index === artifactIndex ? "" : undefined}
            data-passed={index < artifactIndex ? "" : undefined}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{candidate.label}</strong>
          </div>
        ))}
      </div>
      <div className="arch-artifact-lens" aria-live="polite">
        <header>
          <span>{artifact.label}</span>
          <small>{artifact.detail}</small>
        </header>
        <code>{artifact.code}</code>
      </div>
    </div>
  );
};

const COMPILER_PASSES = [
  ["Split", "Reserve slide boundaries"],
  ["Analyze", "Build semantic IR"],
  ["Resolve", "Order owned extensions"],
  ["Compile", "Transform protected phases"],
  ["Seal", "Validate and emit"],
] as const;

export const CompilerRail = (): ReactElement => {
  const { position } = useStage();
  const active = Math.max(position.step - 1, -1);

  return (
    <div className="arch-compiler-rail" style={{ "--active-pass": active } as CSSProperties}>
      <div className="arch-compiler-track" aria-hidden="true">
        <span />
      </div>
      {COMPILER_PASSES.map(([label, detail], index) => (
        <div
          key={label}
          className="arch-compiler-pass"
          data-active={index === active ? "" : undefined}
          data-passed={index < active ? "" : undefined}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{label}</strong>
          <small>{detail}</small>
        </div>
      ))}
    </div>
  );
};

export const BoundaryMap = (): ReactElement => (
  <div className="arch-boundary-map">
    <div className="arch-boundary-orbit arch-boundary-orbit--design">
      <span>DESIGN</span>
      <strong>Expression</strong>
      <small>type · layout · motion · color</small>
    </div>
    <div className="arch-boundary-deck">
      <small>UNCHANGED SEMANTICS</small>
      <strong>Deck contract</strong>
      <span>04 / step 5</span>
    </div>
    <div className="arch-boundary-orbit arch-boundary-orbit--plugin">
      <span>PLUGIN</span>
      <strong>Capability</strong>
      <small>math · diagrams · code · media</small>
    </div>
    <p>
      Components may live in both. <b>Ownership</b> keeps the boundary clear.
    </p>
  </div>
);

const COMMIT_STATES = [
  ["Intent", "navigate('/4/5')"],
  ["Atomic update", "URL + React + transition"],
  ["Publish", "speaker + audience"],
] as const;

export const CommitProtocol = (): ReactElement => {
  const { position } = useStage();
  const active = Math.min(position.step, COMMIT_STATES.length - 1);

  return (
    <div className="arch-commit-protocol">
      <div className="arch-commit-lanes">
        <span>URL</span>
        <span>React frame</span>
        <span>Remote position</span>
      </div>
      <div className="arch-commit-track" aria-hidden="true">
        <i style={{ "--commit-progress": active } as CSSProperties} />
      </div>
      <div className="arch-commit-states">
        {COMMIT_STATES.map(([label, detail], index) => (
          <div
            key={label}
            data-active={index === active ? "" : undefined}
            data-passed={index < active ? "" : undefined}
          >
            <span>{index + 1}</span>
            <strong>{label}</strong>
            <code>{detail}</code>
          </div>
        ))}
      </div>
      <code className="arch-commit-code">{"document.startViewTransition({ update })"}</code>
    </div>
  );
};

export const StaticTopology = (): ReactElement => (
  <div className="arch-static-topology">
    <div className="arch-static-route">
      <small>CANONICAL POSITION</small>
      <strong>/speaker/4/5</strong>
    </div>
    <span className="arch-static-arrow" aria-hidden="true">
      →
    </span>
    <div className="arch-static-file">
      <small>REAL FILE</small>
      <strong>dist/speaker/4/5/index.html</strong>
    </div>
    <div className="arch-static-tree" aria-label="Generated static route tree">
      <span>dist/</span>
      <span>├─ index.html</span>
      <span>├─ 4/5/index.html</span>
      <span>├─ document/index.html</span>
      <span className="arch-static-tree__active">└─ speaker/4/5/index.html</span>
    </div>
    <p>No app server. No rewrite rule. Deep links survive reload.</p>
  </div>
);

export const FailureBoundary = (): ReactElement => {
  const { position } = useStage();
  const failed = position.step > 0;

  return (
    <div className="arch-failure-boundary" data-failed={failed ? "" : undefined}>
      <div className="arch-resource-transaction">
        <small>SETUP TRANSACTION</small>
        {["Navigation", "Keyboard", "Synchronization", "Plugin setup"].map((resource, index) => (
          <div
            key={resource}
            data-resource={index}
            data-status={failed ? (index === 3 ? "failed" : "rolled-back") : "acquired"}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{resource}</strong>
            <small>{failed ? (index === 3 ? "failed" : "rolled back") : "acquired"}</small>
          </div>
        ))}
        <p>Acquire down · dispose up · abort once</p>
      </div>
      <div className="arch-diagnostic">
        <span className="arch-diagnostic__trace" aria-hidden="true" />
        <code>DREVER_COMPILE_STEP_INVALID</code>
        <strong>Step `at` must be a positive static integer.</strong>
        <span>slides.mdx:18:7 · compiler / analyze</span>
        <p>One structured error for the CLI, overlay, tests, and AI repair.</p>
      </div>
    </div>
  );
};

const TEST_LAYERS = [
  ["unit", "Pure state", "Routes · ordering · diagnostics"],
  ["compiler", "Artifact contract", "Deck IR · manifest · provenance"],
  ["browser", "User reality", "Reloads · transitions · sync · static mounts"],
] as const;

export const TestBoundaries = (): ReactElement => {
  const { position } = useStage();
  const active = Math.min(position.step, TEST_LAYERS.length - 1);

  return (
    <div className="arch-test-boundaries">
      <div className="arch-test-rings">
        {TEST_LAYERS.map(([kind, label, detail], index) => (
          <div
            key={kind}
            className={`arch-test-ring arch-test-ring--${kind}`}
            data-active={index === active ? "" : undefined}
            data-passed={index < active ? "" : undefined}
          >
            <span>{kind}</span>
            <strong>{label}</strong>
            <small>{detail}</small>
          </div>
        ))}
        <div className="arch-test-contract">
          <span>ONE CONTRACT</span>
          <strong>04 / step 5</strong>
        </div>
      </div>
      <p>
        Match the proof <b>to the boundary.</b>
      </p>
    </div>
  );
};
