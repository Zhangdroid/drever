import type { ThemeId } from "../site-data";
import cinemaNightBusImage from "../../../examples/theme-showcase/assets/cinema-night-bus.jpg";
import { HomeShowcaseCover } from "./showcase";

export type StudyId = "architecture" | "features" | "motion" | "scenes" | "spatial";

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

  if (study === "spatial") {
    return (
      <div className="study-cover study-cover--spatial" aria-hidden="true">
        <header className="study-cover__meta">
          <span>Live 3D · Spline</span>
          <small>One scene · four roles</small>
        </header>
        <div className="spatial-study__field">
          <i className="spatial-study__orbit" />
          <div className="spatial-study__cluster">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="study-cover study-cover--architecture" aria-hidden="true">
      <header className="study-cover__meta">
        <span>Story → proof</span>
        <small>14 slides · 04 surfaces</small>
      </header>
      <div className="architecture-study__graph">
        <div className="architecture-study__node architecture-study__node--source">
          <small>Approve</small>
          <strong>Plan</strong>
        </div>
        <i className="architecture-study__edge architecture-study__edge--one" />
        <div className="architecture-study__node architecture-study__node--compile">
          <small>Compile</small>
          <strong>Deck IR</strong>
        </div>
        <i className="architecture-study__edge architecture-study__edge--two" />
        <div className="architecture-study__node architecture-study__node--runtime">
          <small>Seal</small>
          <strong>Manifest</strong>
        </div>
        <i className="architecture-study__edge architecture-study__edge--three" />
        <div className="architecture-study__outputs">
          <span>Audience</span>
          <span>Speaker</span>
          <span>Document</span>
          <span>Export</span>
        </div>
        <b className="architecture-study__pulse" />
      </div>
      <footer className="study-cover__foot">
        <span>Routes select surfaces</span>
        <small>Checks return evidence</small>
      </footer>
    </div>
  );
}

export function ArtDirectionCover({ theme }: { theme: ThemeId }) {
  if (theme === "fieldnote") {
    return (
      <div className="art-cover art-cover--fieldnote" aria-hidden="true">
        <header>
          <span>Checkout study · session 03</span>
        </header>
        <div className="fieldnote-cover__checkout">
          <div>
            <span>Delivery</span>
            <i />
          </div>
          <div>
            <span>Payment</span>
            <i />
          </div>
          <div>
            <span>Review</span>
            <i />
          </div>
        </div>
        <div className="fieldnote-cover__annotation">
          <strong>7 / 8 paused here</strong>
          <span>Say when charging happens.</span>
        </div>
      </div>
    );
  }

  if (theme === "atlas") {
    return (
      <div className="art-cover art-cover--atlas" aria-hidden="true">
        <header>
          <span>Alder River · August survey</span>
        </header>
        <svg className="atlas-cover__river" viewBox="0 0 720 390">
          <path
            className="atlas-cover__river-base"
            d="M42 318 C150 298 176 228 270 238 S392 282 454 202 S566 86 680 70"
          />
          <path className="atlas-cover__river-break" d="M270 238 C342 236 392 282 454 202" />
          <circle cx="128" cy="282" r="11" />
          <circle cx="270" cy="238" r="11" />
          <circle cx="454" cy="202" r="11" />
          <circle cx="594" cy="102" r="11" />
          <circle className="atlas-cover__signal" cx="42" cy="318" r="8" />
        </svg>
        <div className="atlas-cover__label">
          <strong>One exposed bend breaks the cold corridor.</strong>
        </div>
      </div>
    );
  }

  if (theme === "ledger") {
    return (
      <div className="art-cover art-cover--ledger" aria-hidden="true">
        <header>
          <span>Activation review / Q2</span>
        </header>
        <div className="ledger-cover__metric">
          <strong>68.4%</strong>
          <b>+7.2 pp vs Q1</b>
        </div>
        <div className="ledger-cover__benchmark">
          <span>0</span>
          <div>
            <i />
            <b />
          </div>
          <span>100</span>
          <small>Decision line 65</small>
        </div>
      </div>
    );
  }

  if (theme === "cinema") {
    return (
      <div className="art-cover art-cover--cinema" aria-hidden="true">
        <header>
          <span>Route 14 · the missing hour</span>
        </header>
        <div className="cinema-cover__frame">
          <img alt="" src={cinemaNightBusImage} />
          <div className="cinema-cover__route">
            <i />
            <b />
          </div>
        </div>
        <div className="cinema-cover__caption">
          <strong>The city stayed open.</strong>
        </div>
      </div>
    );
  }

  if (theme === "construct") {
    return (
      <div className="art-cover art-cover--construct" aria-hidden="true">
        <header>
          <span>Reliable handoff · test 03</span>
        </header>
        <div className="construct-cover__assembly">
          <div data-part="owner">
            <strong>Owner</strong>
          </div>
          <div data-part="context">
            <strong>Context</strong>
          </div>
          <div data-part="acceptance">
            <strong>Acceptance</strong>
          </div>
        </div>
        <div className="construct-cover__gate">
          <span>Ready to send</span>
          <i />
        </div>
      </div>
    );
  }

  if (theme === "editorial") {
    return (
      <div className="art-cover art-cover--editorial" aria-hidden="true">
        <header>
          <span>Library hours · evening brief</span>
        </header>
        <div className="editorial-cover__folio">20:00</div>
        <div className="editorial-cover__statement">
          <strong>
            The busiest hour
            <br /> starts after closing.
          </strong>
        </div>
        <div className="editorial-cover__hours">
          <span>16</span>
          <i />
          <span>17</span>
          <i />
          <span>18</span>
          <i />
          <span>19</span>
          <i />
          <span>20</span>
          <b />
        </div>
      </div>
    );
  }

  if (theme === "studio") {
    return (
      <div className="art-cover art-cover--studio" aria-hidden="true">
        <header>
          <span>Request trace · 774 ms</span>
        </header>
        <div className="studio-cover__artifact">
          <span>Client</span>
          <i />
          <span>Router</span>
          <i />
          <span data-hot="">Transform</span>
          <i />
          <span>Render</span>
          <b />
        </div>
        <div className="studio-cover__finding">
          <strong>640 ms</strong>
          <span>waiting at Transform</span>
        </div>
      </div>
    );
  }

  return (
    <div className="art-cover art-cover--basic" aria-hidden="true">
      <header>
        <span>Decision brief · week 34</span>
      </header>
      <div className="basic-cover__statement">
        <strong>Protect Wednesday mornings.</strong>
      </div>
      <div className="basic-cover__week">
        <div>
          <span>Mon</span>
          <i data-load="high" />
        </div>
        <div>
          <span>Tue</span>
          <i data-load="high" />
        </div>
        <div>
          <span>Wed</span>
          <i data-decision="" />
        </div>
        <div>
          <span>Thu</span>
          <i data-load="high" />
        </div>
        <div>
          <span>Fri</span>
          <i data-load="medium" />
        </div>
      </div>
    </div>
  );
}
