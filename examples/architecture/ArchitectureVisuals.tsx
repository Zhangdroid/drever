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
      <path className="arch-edge" d="M112 215H130" />
      <path className="arch-edge" d="M242 215H260" />
      <path className="arch-edge" d="M372 215H390" />
      <path className="arch-edge" d="M502 215H520" />
      <path className="arch-edge" d="M632 215H640" />
      <path className="arch-edge" d="M640 215V89H650" />
      <path className="arch-edge" d="M640 215V189H650" />
      <path className="arch-edge" d="M640 215V289H650" />
      <path className="arch-edge" d="M640 215V389H650" />
      <path className="arch-edge arch-edge--signal" d="M112 215H640V89H650" pathLength="1" />
    </svg>
    <GraphNode className="arch-node--plan" detail="APPROVED" label="Story" />
    <GraphNode className="arch-node--source" detail="AUTHORED" label="MDX" />
    <GraphNode className="arch-node--ir" detail="SEMANTICS" label="Deck IR" />
    <GraphNode className="arch-node--compile" detail="RESOLVED" label="Plan" />
    <GraphNode className="arch-node--artifact" detail="SEALED" label="Artifact" signal />
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
      <span>story · slides · steps · notes · source</span>
    </div>
    <Surface className="arch-drift--audience" label="Audience" value="09 / step 3" />
    <Surface className="arch-drift--speaker" label="Speaker" value="09 / step 3" />
    <Surface className="arch-drift--document" label="Document" value="09 / step 3" />
    <Surface className="arch-drift--export" label="Export" value="09 / step 3" />
  </div>
);

const storyState = (index: number, active: number): "active" | "passed" | undefined => {
  if (index === active) return "active";
  if (index < active) return "passed";
};

export const StoryContract = (): ReactElement => {
  const { position } = useStage();
  const active = Math.min(position.step, 3);

  return (
    <div className="arch-story-contract" style={{ "--story-step": active } as CSSProperties}>
      <svg aria-hidden="true" viewBox="0 0 1180 360">
        <path d="M286 176H410" />
        <path d="M770 176H894" />
        <path className="arch-story-contract__signal" d="M286 176H894" pathLength="1" />
      </svg>
      <div className="arch-story-brief" data-state={storyState(0, active)}>
        <small>brief.md</small>
        <strong>What should change?</strong>
        <span>Audience / outcome</span>
        <span>Duration / density</span>
        <span>Language / constraints</span>
      </div>
      <div className="arch-story-plan" data-state={storyState(1, active)}>
        <header>
          <span>drever.plan.json</span>
          <small>v1</small>
        </header>
        <div>
          <i />
          <span>
            <b>01</b> Open with the invariant
          </span>
        </div>
        <div>
          <i />
          <span>
            <b>02</b> Make the contract visible
          </span>
        </div>
        <div>
          <i />
          <span>
            <b>03</b> Prove the system boundary
          </span>
        </div>
      </div>
      <div className="arch-storyboard" data-state={storyState(2, active)}>
        <header>
          <span>/storyboard</span>
          <small>DEV ONLY</small>
        </header>
        <div className="arch-storyboard__slide arch-storyboard__slide--opening">
          <i />
          <span />
          <span />
        </div>
        <div className="arch-storyboard__slide">
          <i />
          <span />
          <span />
        </div>
        <div className="arch-storyboard__slide">
          <i />
          <span />
          <span />
        </div>
      </div>
      <div className="arch-story-approval" data-state={storyState(3, active)}>
        <span aria-hidden="true">✓</span>
        <strong>Human approved</strong>
        <small>AUTHORING MAY BEGIN</small>
      </div>
    </div>
  );
};

type Artifact = Readonly<{
  code: ReactNode;
  detail: string;
  label: string;
}>;

const ARTIFACTS = [
  {
    label: "Authored MDX",
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
        <b>{"slide: { index: 7, id: 'proof' }"}</b>
        <span>{"sourceFragments: [{ start, end }]"}</span>
        <span>{"steps: [1, 2, 3]"}</span>
      </>
    ),
  },
  {
    label: "CompilePlan",
    detail: "Resolved capability",
    code: (
      <>
        <b>{'"theme": { "name": "architecture" }'}</b>
        <span>{'"plugins": ["shiki", "mermaid"]'}</span>
        <span>{'"build": { "remark": [...], "rehype": [...] }'}</span>
      </>
    ),
  },
  {
    label: "Deck artifact",
    detail: "Sealed positions",
    code: (
      <>
        <b>{'"id": "proof"'}</b>
        <span>{'"stepStops": [1, 2, 3]'}</span>
        <span>{'"speakerNotes": [{ "format": "markdown" }]'}</span>
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
  ["Grammar", "Reserve root slide boundaries"],
  ["Analyze", "Record Deck IR + source"],
  ["Resolve", "Freeze JSON-safe CompilePlan"],
  ["Transform", "Run protected MDX phases"],
  ["Finalize", "Reject drift + seal artifact"],
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

export const DesignEvidence = (): ReactElement => (
  <div className="arch-design-evidence">
    <div className="arch-reference-page">
      <header>
        <i />
        <span />
        <span />
      </header>
      <div className="arch-reference-page__headline" />
      <div className="arch-reference-page__copy" />
      <div className="arch-reference-page__swatches">
        <i />
        <i />
        <i />
      </div>
      <small>PUBLIC REFERENCE</small>
    </div>
    <span className="arch-design-evidence__arrow" aria-hidden="true">
      →
    </span>
    <div className="arch-evidence-probe">
      <span className="arch-evidence-probe__scan" aria-hidden="true" />
      <small>ISOLATED BROWSER</small>
      <strong>Visual evidence</strong>
      <span>type · color · spacing · geometry</span>
    </div>
    <span className="arch-design-evidence__arrow" aria-hidden="true">
      →
    </span>
    <div className="arch-design-output">
      <small>PROJECT-OWNED OUTPUT</small>
      <strong>design/</strong>
      <code>reference.json</code>
      <code>theme.ts + theme.css</code>
      <code>art-direction.md</code>
    </div>
    <p>
      <b>No copied code.</b> No hotlinked assets. Evidence stays untrusted.
    </p>
  </div>
);

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
      <span>slide · step · note</span>
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
  ["Intent", "navigation.navigate('/9/3')"],
  ["Intercept", "signal + manual focus / scroll"],
  ["Commit", "React inside document transition"],
  ["Publish", "BroadcastChannel(position)"],
] as const;

export const CommitProtocol = (): ReactElement => {
  const { position } = useStage();
  const active = Math.min(position.step, COMMIT_STATES.length - 1);

  return (
    <div className="arch-commit-protocol">
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
    </div>
  );
};

export const SurfaceDelivery = (): ReactElement => (
  <div className="arch-surface-delivery">
    <div className="arch-delivery-route">
      <small>CANONICAL ROUTE</small>
      <strong>/9/3</strong>
      <span>routeDepth = 2</span>
    </div>
    <span className="arch-delivery-arrow" aria-hidden="true">
      →
    </span>
    <div className="arch-delivery-bootstrap">
      <small>ROUTE BOOTSTRAP</small>
      <strong>select surface</strong>
      <code>import("@drever/client/audience")</code>
    </div>
    <div className="arch-delivery-surfaces" aria-label="Route-selected runtime surfaces">
      <span data-active="">
        <b>Audience</b>
        <small>selected chunk</small>
      </span>
      <span>
        <b>Document</b>
        <small>not requested</small>
      </span>
      <span>
        <b>Speaker</b>
        <small>not requested</small>
      </span>
      <span>
        <b>Export</b>
        <small>isolated app</small>
      </span>
    </div>
    <div className="arch-delivery-seal">
      <span>
        <small>REAL FILE</small>
        <strong>dist/9/3/index.html</strong>
      </span>
      <span>
        <small>DOCUMENT METADATA</small>
        <strong>lang · canonical · og:* · icon</strong>
      </span>
    </div>
  </div>
);

const PREFLIGHT_STATES = ["/1", "/3/1", "/3/2", "/9/3", "/11/3"] as const;

export const RenderedPreflight = (): ReactElement => {
  const { position } = useStage();
  const active = Math.min(position.step, 3);

  return (
    <div className="arch-rendered-preflight" data-active={active}>
      <div className="arch-preflight-states">
        <small>EXACT MANIFEST STATES</small>
        {PREFLIGHT_STATES.map((route, index) => (
          <span key={route} data-scanned={active > 0 && index <= 3 ? "" : undefined}>
            <i />
            <code>{route}</code>
          </span>
        ))}
      </div>
      <div className="arch-preflight-browser">
        <header>
          <span />
          <span />
          <span />
          <small>DETERMINISTIC CHROMIUM</small>
        </header>
        <div>
          <i className="arch-preflight-browser__scan" />
          <strong>Every state</strong>
          <span>Slide + every Step · deck canvas</span>
        </div>
      </div>
      <div className="arch-preflight-result">
        <header>
          <span>rendered receipt</span>
          <small>v1 · ruleset 2</small>
        </header>
        <code data-visible={active >= 2 ? "" : undefined}>DREVER_RENDER_CONTENT_CLIPPED</code>
        <code data-visible={active >= 2 ? "" : undefined}>DREVER_RENDER_CONTENT_OVERLAP</code>
        <code data-visible={active >= 2 ? "" : undefined}>DREVER_RENDER_TEXT_CONTRAST_LOW</code>
        <footer data-visible={active >= 3 ? "" : undefined}>
          <span>every exact state captured</span>
          <strong>evidence ready → repair</strong>
        </footer>
      </div>
    </div>
  );
};

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
        <code>drever:step-index-invalid</code>
        <strong>Step at must be a positive safe integer.</strong>
        <span>slides.mdx:18:7 · compiler / manifest</span>
        <p>One structured error for the CLI, overlay, tests, and AI repair.</p>
      </div>
    </div>
  );
};

const TEST_LAYERS = [
  ["unit", "Pure state", "Routes · ordering · diagnostics"],
  ["compiler", "Artifact contract", "Deck IR · plan · manifest"],
  ["rendered", "Canvas evidence", "Clipping · contrast · drift"],
  ["outcome", "User reality", "Browsers · exports · real AI runs"],
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
          <strong>09 / step 3</strong>
        </div>
      </div>
      <p>
        Match the proof <b>to the boundary.</b>
      </p>
    </div>
  );
};
