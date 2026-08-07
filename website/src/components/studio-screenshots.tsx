import { useEffect, useState } from "react";

const studioPhases = ["Brief", "Direction", "Storyboard", "Draft"] as const;
const studioPhaseDuration = 2600;

export function StudioScreenshots() {
  const [activePhase, setActivePhase] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setActivePhase((current) => (current + 1) % studioPhases.length);
    }, studioPhaseDuration);

    return () => window.clearTimeout(timeout);
  }, [activePhase]);

  return (
    <section aria-label="Drever Studio workflow" className="studio-screenshots">
      <header>
        <span>Studio, in practice</span>
        <p>From the first question to a live deck.</p>
      </header>

      <div
        aria-label="An animated overview of Studio moving through Brief, Direction, Storyboard, and Draft"
        className="studio-screenshots__demo"
        role="img"
      >
        <div aria-hidden="true" className="studio-screenshots__chrome">
          <div className="studio-screenshots__brand">
            <i />
            <span>Studio</span>
          </div>

          <ol className="studio-screenshots__phases">
            {studioPhases.map((phase, index) => (
              <li className={index === activePhase ? "is-active" : undefined} key={phase}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <span>{phase}</span>
              </li>
            ))}
          </ol>

          <span className="studio-screenshots__agent">
            <i /> Local agent
          </span>
        </div>

        <div aria-hidden="true" className="studio-screenshots__stage">
          <article
            className={`studio-screenshots__scene studio-screenshots__scene--brief${activePhase === 0 ? " is-active" : ""}`}
          >
            <div className="studio-screenshots__scene-copy">
              <span>01 · Brief</span>
              <h3>Begin with the room.</h3>
              <p>One clear intention gives the story somewhere to go.</p>
            </div>
            <div className="studio-screenshots__brief-card">
              <small>What should this presentation help people do?</small>
              <strong>See why the product is ready for launch.</strong>
              <div>
                <span>Product team</span>
                <span>12 minutes</span>
              </div>
            </div>
          </article>

          <article
            className={`studio-screenshots__scene studio-screenshots__scene--direction${activePhase === 1 ? " is-active" : ""}`}
          >
            <div className="studio-screenshots__scene-copy">
              <span>02 · Direction</span>
              <h3>Choose what matters.</h3>
              <p>The agent asks only what the brief did not answer.</p>
            </div>
            <div className="studio-screenshots__question">
              <small>What should earn the room&apos;s trust first?</small>
              <div>
                <span>Product evidence</span>
                <span className="is-selected">A real customer moment</span>
                <span>The implementation</span>
              </div>
            </div>
          </article>

          <article
            className={`studio-screenshots__scene studio-screenshots__scene--storyboard${activePhase === 2 ? " is-active" : ""}`}
          >
            <div className="studio-screenshots__scene-copy">
              <span>03 · Storyboard</span>
              <h3>Approve the story.</h3>
              <p>Review the sequence before visual polish enters the conversation.</p>
            </div>
            <div className="studio-screenshots__storyboard">
              <div>
                <b>01</b>
                <span>
                  <strong>The friction</strong>
                  <small>Make the old way felt.</small>
                </span>
              </div>
              <div className="is-current">
                <b>02</b>
                <span>
                  <strong>The turning point</strong>
                  <small>Show the proof in use.</small>
                </span>
              </div>
              <div>
                <b>03</b>
                <span>
                  <strong>The decision</strong>
                  <small>Leave one clear next step.</small>
                </span>
              </div>
            </div>
          </article>

          <article
            className={`studio-screenshots__scene studio-screenshots__scene--draft${activePhase === 3 ? " is-active" : ""}`}
          >
            <div className="studio-screenshots__draft-rail">
              <span className="is-current" />
              <span />
              <span />
            </div>
            <div className="studio-screenshots__draft-canvas">
              <small>02 · The turning point</small>
              <strong>
                Let the evidence
                <br />
                change the room.
              </strong>
              <i />
            </div>
            <div className="studio-screenshots__draft-note">
              <span>Live draft</span>
              <p>Preview, Notes, and feedback stay beside the work.</p>
            </div>
          </article>
        </div>
      </div>

      <nav aria-label="Choose a Studio workflow step" className="studio-screenshots__controls">
        {studioPhases.map((phase, index) => (
          <button
            aria-current={index === activePhase ? "step" : undefined}
            key={phase}
            onClick={() => setActivePhase(index)}
            type="button"
          >
            <i aria-hidden="true" />
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{phase}</strong>
          </button>
        ))}
      </nav>

      <p className="studio-screenshots__caption">
        Shape the intent, approve the story, then direct the real presentation in the same room.
      </p>
    </section>
  );
}
