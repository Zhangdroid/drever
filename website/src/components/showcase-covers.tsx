import type { ThemeId } from "../site-data";
import { HomeShowcaseCover } from "./showcase";

export type StudyId = "architecture" | "features" | "motion" | "scenes";

export function StudyCover({ study }: { study: StudyId }) {
  if (study === "motion") {
    return <HomeShowcaseCover kind="motion" />;
  }

  if (study === "features") {
    return (
      <div className="study-cover study-cover--features" aria-hidden="true">
        <header className="study-cover__meta">
          <span>Source → live slide</span>
          <small>06 / 09</small>
        </header>
        <div className="feature-study__workbench">
          <div className="feature-study__source">
            <span>deck.mdx</span>
            <code>
              <i>#</i> Evidence
            </code>
            <code>
              <i>&lt;</i>Step<i>&gt;</i>
            </code>
            <code>
              <b>$$</b> E = mc²
            </code>
          </div>
          <i className="feature-study__signal" />
          <div className="feature-study__result">
            <span>Live</span>
            <strong>E = mc²</strong>
            <div>
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
        <footer className="study-cover__foot">
          <span>MDX · React · LaTeX</span>
          <small>One authored source</small>
        </footer>
      </div>
    );
  }

  if (study === "scenes") {
    return (
      <div className="study-cover study-cover--scenes" aria-hidden="true">
        <header className="study-cover__meta">
          <span>Room atmosphere</span>
          <small>Live scene</small>
        </header>
        <div className="scene-study__glow" />
        <div className="scene-study__record">
          <i />
          <span>Now playing</span>
          <strong>Before the room begins</strong>
        </div>
        <div className="scene-study__wave">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="scene-study__countdown">
          <span>Doors open</span>
          <strong>04:12</strong>
        </div>
        <footer className="study-cover__foot">
          <span>Audio-reactive</span>
          <small>Scene persists</small>
        </footer>
      </div>
    );
  }

  return (
    <div className="study-cover study-cover--architecture" aria-hidden="true">
      <header className="study-cover__meta">
        <span>Build graph</span>
        <small>01 source · 04 surfaces</small>
      </header>
      <div className="architecture-study__graph">
        <div className="architecture-study__node architecture-study__node--source">
          <small>Author</small>
          <strong>MDX</strong>
        </div>
        <i className="architecture-study__edge architecture-study__edge--one" />
        <div className="architecture-study__node architecture-study__node--compile">
          <small>Compile</small>
          <strong>AST</strong>
        </div>
        <i className="architecture-study__edge architecture-study__edge--two" />
        <div className="architecture-study__node architecture-study__node--runtime">
          <small>Runtime</small>
          <strong>React</strong>
        </div>
        <i className="architecture-study__edge architecture-study__edge--three" />
        <div className="architecture-study__outputs">
          <span>Audience</span>
          <span>Speaker</span>
          <span>Document</span>
        </div>
        <b className="architecture-study__pulse" />
      </div>
      <footer className="study-cover__foot">
        <span>Deterministic pipeline</span>
        <small>Inspect every boundary</small>
      </footer>
    </div>
  );
}

export function ArtDirectionCover({ theme }: { theme: ThemeId }) {
  if (theme === "fieldnote") {
    return (
      <div className="art-cover art-cover--fieldnote" aria-hidden="true">
        <header>
          <span>Research debrief · 02</span>
          <small>Observed / 14:20</small>
        </header>
        <div className="fieldnote-cover__note">
          <i />
          <strong>
            Name the
            <br />
            hesitation.
          </strong>
          <span>People stopped here</span>
        </div>
        <div className="fieldnote-cover__trace">
          <i />
          <i />
          <i />
        </div>
        <footer>
          <span>Evidence → recommendation</span>
          <small>03 / 05</small>
        </footer>
      </div>
    );
  }

  if (theme === "atlas") {
    return (
      <div className="art-cover art-cover--atlas" aria-hidden="true">
        <header>
          <span>Restoration corridor</span>
          <small>37.8° N / 122.4° W</small>
        </header>
        <div className="atlas-cover__terrain">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="atlas-cover__route">
          <i />
          <i />
          <i />
          <b />
        </div>
        <div className="atlas-cover__label">
          <span>Current waypoint</span>
          <strong>Open the river edge</strong>
        </div>
        <footer>
          <span>Evidence along a route</span>
          <small>03 / 05</small>
        </footer>
      </div>
    );
  }

  if (theme === "ledger") {
    return (
      <div className="art-cover art-cover--ledger" aria-hidden="true">
        <header>
          <span>Operating review / Q3</span>
          <small>Verified close</small>
        </header>
        <div className="ledger-cover__metric">
          <span>Completion rate</span>
          <strong>18.4%</strong>
          <b>+3.2 pts</b>
        </div>
        <div className="ledger-cover__bars">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="ledger-cover__decision">
          <span>Decision boundary</span>
          <strong>Fund the next 2 cohorts</strong>
        </div>
        <footer>
          <span>Source · cohort_07.csv</span>
          <small>04 / 06</small>
        </footer>
      </div>
    );
  }

  if (theme === "cinema") {
    return (
      <div className="art-cover art-cover--cinema" aria-hidden="true">
        <header>
          <span>Scene 04</span>
          <small>00:42:18</small>
        </header>
        <div className="cinema-cover__frame">
          <div className="cinema-cover__window">
            <i />
            <i />
            <i />
          </div>
          <div className="cinema-cover__route">
            <i />
            <span>Last bus · 00:51</span>
          </div>
        </div>
        <div className="cinema-cover__caption">
          <strong>The final hour should still feel connected.</strong>
        </div>
        <footer>
          <span>Service story</span>
          <small>Case study / 05</small>
        </footer>
      </div>
    );
  }

  if (theme === "construct") {
    return (
      <div className="art-cover art-cover--construct" aria-hidden="true">
        <header>
          <span>Handoff workshop · 03</span>
          <small>Assembly board</small>
        </header>
        <div className="construct-cover__assembly">
          <div>
            <span>01</span>
            <strong>Owner</strong>
          </div>
          <div>
            <span>02</span>
            <strong>Proof</strong>
          </div>
          <div>
            <span>03</span>
            <strong>Next move</strong>
          </div>
          <i />
        </div>
        <strong className="construct-cover__answer">A handoff people can test.</strong>
        <footer>
          <span>01 + 02 + 03</span>
          <small>Built together</small>
        </footer>
      </div>
    );
  }

  if (theme === "editorial") {
    return (
      <div className="art-cover art-cover--editorial" aria-hidden="true">
        <header>
          <span>Essay · issue 04</span>
          <small>Field notes</small>
        </header>
        <div className="editorial-cover__folio">04</div>
        <div className="editorial-cover__statement">
          <span>The pause before the proof</span>
          <strong>
            Give the idea
            <br />
            room to arrive.
          </strong>
          <i />
        </div>
        <blockquote>“A measured reveal can carry more conviction than another chart.”</blockquote>
        <footer>
          <span>Point of view, set in type</span>
          <small>2 min read</small>
        </footer>
      </div>
    );
  }

  if (theme === "studio") {
    return (
      <div className="art-cover art-cover--studio" aria-hidden="true">
        <header>
          <span>System trace / 03</span>
          <small>All boundaries healthy</small>
        </header>
        <div className="studio-cover__artifact">
          <div className="studio-cover__core">
            <span>Source</span>
            <strong>01</strong>
          </div>
          <i />
          <div className="studio-cover__surfaces">
            <span>Room</span>
            <span>Notes</span>
            <span>Web</span>
          </div>
          <b />
        </div>
        <div className="studio-cover__status">
          <span>Compile</span>
          <i />
          <span>Route</span>
          <i />
          <span>Deliver</span>
        </div>
        <footer>
          <span>One system · every surface</span>
          <small>11.8 ms</small>
        </footer>
      </div>
    );
  }

  return (
    <div className="art-cover art-cover--default" aria-hidden="true">
      <header>
        <span>Quarterly review</span>
        <small>03 / 12</small>
      </header>
      <div className="default-cover__question">
        <span>Decision</span>
        <strong>What should happen next?</strong>
      </div>
      <div className="default-cover__steps">
        <div>
          <span>01</span>
          <i />
          <small>Signal</small>
        </div>
        <div>
          <span>02</span>
          <i />
          <small>Evidence</small>
        </div>
        <div>
          <span>03</span>
          <i />
          <small>Move</small>
        </div>
      </div>
      <footer>
        <span>Make the next step obvious</span>
        <small>Ready</small>
      </footer>
    </div>
  );
}
