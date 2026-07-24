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
          <code>/4/2</code>
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
              <strong>What would help you decide?</strong>
              <div>
                <span>Migration</span>
                <span className="home-room-demo__choice">
                  <i aria-hidden="true" />
                  Show me the proof
                </span>
                <span>Cost</span>
              </div>
            </div>

            <div className="home-room-demo__proof">
              <small>Evidence requested</small>
              <strong>
                <b>96%</b>
                <span>completed setup unaided.</span>
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
            <strong>Let the room choose.</strong>
          </aside>

          <div className="home-room-demo__address">
            <span>Exact moment</span>
            <strong>drever.dev/4/2</strong>
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
            <b>#</b> Make the decision clear.
          </span>
          <span>What does the room need next?</span>
          <span className="home-connected-demo__source-line">
            <b>&lt;Step&gt;</b>Reveal the evidence.<b>&lt;/Step&gt;</b>
          </span>
          <span>
            <b>&lt;Note&gt;</b>Pause before the result.<b>&lt;/Note&gt;</b>
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
            <strong>96%</strong>
            <span>completed setup unaided.</span>
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
            <strong>Reveal the evidence.</strong>
            <small>Pause before the result.</small>
          </div>
        </div>

        <div className="home-connected-demo__surface" data-surface="document">
          <header>
            <span>Document</span>
            <small>/4/2</small>
          </header>
          <div>
            <strong>Make the decision clear.</strong>
            <span>96% completed setup unaided.</span>
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
