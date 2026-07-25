import { creationStory } from "./creation-story-data";

export function RoomMomentDemo() {
  return (
    <figure
      aria-label="A live presentation responding to the room, revealing evidence, and preserving the exact moment"
      className="home-room-demo"
    >
      <div className="home-room-demo__stage">
        <header>
          <span>
            <i aria-hidden="true" />
            Live room
          </span>
          <code>/5/2</code>
        </header>

        <div className="home-room-demo__canvas">
          <div className="home-room-demo__signal">
            <span>Room signal</span>
            <div aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>

          <div className="home-room-demo__moment">
            <div className="home-room-demo__prompt">
              <small>Ask</small>
              <strong>{creationStory.question}</strong>
              <div>
                <span>Pilot scope</span>
                <span className="home-room-demo__choice">
                  <i aria-hidden="true" />
                  {creationStory.choice}
                </span>
                <span>Support load</span>
              </div>
            </div>

            <div className="home-room-demo__proof">
              <small>Evidence requested</small>
              <strong>
                <b>{creationStory.evidence}</b>
                <span>{creationStory.evidenceDetail}</span>
              </strong>
              <div aria-hidden="true" className="home-room-demo__bars">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>

          <aside className="home-room-demo__note">
            <span>Speaker cue</span>
            <strong>Let the room choose the proof.</strong>
          </aside>

          <div className="home-room-demo__address">
            <span>Exact moment</span>
            <strong>yourdeck.com{creationStory.route}</strong>
            <i aria-hidden="true" />
          </div>
        </div>
      </div>

      <figcaption className="home-room-demo__timeline">
        <i aria-hidden="true" />
        <span>Ask</span>
        <span>Reveal what matters</span>
        <span>Return exactly here</span>
      </figcaption>
    </figure>
  );
}

export function ConnectedSourceDemo() {
  return (
    <figure
      aria-label="One readable MDX source becoming audience, speaker, document, and delivery surfaces"
      className="home-connected-demo"
    >
      <div className="home-connected-demo__editor">
        <header>
          <div aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <span>slides.mdx</span>
          <small>source</small>
        </header>
        <code>
          <span>
            <b>#</b> {creationStory.title}
          </span>
          <span>{creationStory.question}</span>
          <span className="home-connected-demo__source-line">
            <b>&lt;Step&gt;</b>
            {creationStory.evidence} {creationStory.evidenceDetail}
            <b>&lt;/Step&gt;</b>
          </span>
          <span>
            <b>&lt;Note&gt;</b>Pause before the launch recommendation.<b>&lt;/Note&gt;</b>
          </span>
        </code>
      </div>

      <div aria-hidden="true" className="home-connected-demo__bus">
        <i />
      </div>

      <div className="home-connected-demo__outputs">
        <div className="home-connected-demo__surface" data-surface="audience">
          <header>
            <span>Audience</span>
            <small>Live</small>
          </header>
          <div>
            <strong>{creationStory.evidence}</strong>
            <span>{creationStory.evidenceDetail}</span>
            <i aria-hidden="true" />
          </div>
        </div>

        <div className="home-connected-demo__surface" data-surface="speaker">
          <header>
            <span>Speaker</span>
            <small>08:42</small>
          </header>
          <div>
            <i aria-hidden="true" />
            <strong>Reveal unaided completion.</strong>
            <small>Pause before the recommendation.</small>
          </div>
        </div>

        <div className="home-connected-demo__surface" data-surface="document">
          <header>
            <span>Document</span>
            <small>{creationStory.route}</small>
          </header>
          <div>
            <strong>{creationStory.title}</strong>
            <span>
              {creationStory.evidence} {creationStory.evidenceDetail}
            </span>
            <i aria-hidden="true" />
            <i aria-hidden="true" />
          </div>
        </div>

        <div className="home-connected-demo__surface" data-surface="delivery">
          <header>
            <span>Delivery</span>
            <small>Ready</small>
          </header>
          <div>
            <strong>WEB</strong>
            <i aria-hidden="true" />
            <strong>PDF</strong>
          </div>
        </div>
      </div>

      <figcaption>One readable source. Four purpose-built surfaces.</figcaption>
    </figure>
  );
}
