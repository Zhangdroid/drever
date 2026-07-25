import { creationStory } from "./creation-story-data";

const creationStages = [
  {
    detail: creationStory.brief,
    label: "Brief",
  },
  {
    detail: `Turn “${creationStory.title}” into a visual system built from fewer steps.`,
    label: "Shape",
  },
  {
    detail: `${creationStory.question} The room chooses: “${creationStory.choice}”`,
    label: "Present",
  },
  {
    detail: `${creationStory.route} returns to ${creationStory.evidence} ${creationStory.evidenceDetail}`,
    label: "Continue",
  },
] as const;

export function CreationStoryMap() {
  return (
    <section
      aria-label="One presentation from brief to continued use"
      className="home-creation-story"
    >
      <ol>
        {creationStages.map((stage, index) => (
          <li data-stage={stage.label.toLowerCase()} key={stage.label}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{stage.label}</strong>
              <p>{stage.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function StoryDirectionDemo() {
  return (
    <figure
      aria-label="The setup-flow brief becoming a subject-led visual system and opening slide"
      className="home-direction-demo"
    >
      <div className="home-direction-demo__brief">
        <span>Brief</span>
        <p>{creationStory.brief}</p>
      </div>

      <div aria-hidden="true" className="home-direction-demo__path">
        <i />
        <i />
        <i />
      </div>

      <section aria-label="Visual direction" className="home-direction-demo__system">
        <header>
          <span>Shape</span>
          <strong>Fewer steps become the visual rule.</strong>
        </header>
        <dl>
          <div>
            <dt>Motif</dt>
            <dd>Three paths resolve into one.</dd>
          </div>
          <div>
            <dt>Motion</dt>
            <dd>Collapse, clarify, settle.</dd>
          </div>
          <div>
            <dt>Voice</dt>
            <dd>Calm enough for a launch decision.</dd>
          </div>
        </dl>
        <div aria-hidden="true" className="home-direction-demo__tokens">
          <i />
          <i />
          <i />
        </div>
      </section>

      <article aria-label="Opening slide" className="home-direction-demo__slide">
        <header>
          <span>Decision story</span>
          <small>01 / 08</small>
        </header>
        <div>
          <small>Setup study</small>
          <h3>{creationStory.title}</h3>
          <p>{creationStory.question}</p>
        </div>
        <footer>
          <span>{creationStory.choice}</span>
          <i aria-hidden="true" />
        </footer>
      </article>

      <figcaption>One subject. One visual logic. One story ready for the room.</figcaption>
    </figure>
  );
}
