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
          <small>06 / 14</small>
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
          <span>Build · components · media</span>
          <small>One plugin contract</small>
        </footer>
      </div>
    );
  }

  if (study === "scenes") {
    return (
      <div className="study-cover study-cover--scenes" aria-hidden="true">
        <header className="study-cover__meta">
          <span>Room Sense</span>
          <small>Microphone reactive</small>
        </header>
        <div className="scene-study__field">
          <i className="scene-study__glow scene-study__glow--lime" />
          <i className="scene-study__glow scene-study__glow--violet" />
          <div className="scene-study__rings scene-study__rings--near">
            <i />
            <i />
            <i />
          </div>
          <div className="scene-study__rings scene-study__rings--far">
            <i />
            <i />
          </div>
        </div>
        <div className="scene-study__statement">
          <strong>
            Let the room
            <br />
            move the light.
          </strong>
        </div>
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
      </div>
    );
  }

  if (theme === "atlas") {
    return (
      <div className="art-cover art-cover--atlas" aria-hidden="true">
        <header>
          <span>Restoration corridor</span>
        </header>
        <div className="atlas-cover__terrain">
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
          <strong>Open the river edge</strong>
        </div>
      </div>
    );
  }

  if (theme === "ledger") {
    return (
      <div className="art-cover art-cover--ledger" aria-hidden="true">
        <header>
          <span>Operating review / Q3</span>
        </header>
        <div className="ledger-cover__metric">
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
      </div>
    );
  }

  if (theme === "cinema") {
    return (
      <div className="art-cover art-cover--cinema" aria-hidden="true">
        <header>
          <span>Scene 04</span>
        </header>
        <div className="cinema-cover__frame">
          <div className="cinema-cover__window">
            <i />
            <i />
            <i />
          </div>
          <div className="cinema-cover__route">
            <i />
          </div>
        </div>
        <div className="cinema-cover__caption">
          <strong>The final hour stays connected.</strong>
        </div>
      </div>
    );
  }

  if (theme === "construct") {
    return (
      <div className="art-cover art-cover--construct" aria-hidden="true">
        <header>
          <span>Handoff workshop · 03</span>
        </header>
        <div className="construct-cover__assembly">
          <div>
            <strong>Owner</strong>
          </div>
          <div>
            <strong>Proof</strong>
          </div>
          <div>
            <strong>Next move</strong>
          </div>
          <i />
        </div>
      </div>
    );
  }

  if (theme === "editorial") {
    return (
      <div className="art-cover art-cover--editorial" aria-hidden="true">
        <header>
          <span>Essay · issue 04</span>
        </header>
        <div className="editorial-cover__folio">04</div>
        <div className="editorial-cover__statement">
          <strong>
            Give the idea
            <br />
            room to arrive.
          </strong>
          <i />
        </div>
      </div>
    );
  }

  if (theme === "studio") {
    return (
      <div className="art-cover art-cover--studio" aria-hidden="true">
        <header>
          <span>System trace / 03</span>
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
      </div>
    );
  }

  return (
    <div className="art-cover art-cover--basic" aria-hidden="true">
      <header>
        <span>Quarterly review</span>
      </header>
      <div className="basic-cover__question">
        <strong>What should happen next?</strong>
      </div>
      <div className="basic-cover__steps">
        <div>
          <span>01</span>
          <i />
        </div>
        <div>
          <span>02</span>
          <i />
        </div>
        <div>
          <span>03</span>
          <i />
        </div>
      </div>
    </div>
  );
}
