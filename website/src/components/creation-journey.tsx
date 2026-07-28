import { useEffect, useRef, useState, type CSSProperties } from "react";

import { creationStory } from "./creation-story-data";
import { ArrowIcon } from "./icons";

const journeyStages = [
  {
    id: "brief",
    label: "Brief",
    title: "Start with the change.",
    description:
      "One sentence gives the deck a job: help the product team decide whether a simpler setup is ready to launch.",
    status: "Brief received",
  },
  {
    id: "draft",
    label: "Plan",
    title: "Review the shape first.",
    description:
      "AI turns the answers into a complete brief and page-by-page outline, then stops before authoring.",
    status: "Awaiting approval",
  },
  {
    id: "iterate",
    label: "Your review",
    title: "Direct it before it becomes slides.",
    description:
      "Change the emphasis, density, order, or motion intent while the plan is still cheap to reshape.",
    status: "Plan revised",
  },
  {
    id: "refine",
    label: "First draft",
    title: "Make the approved story visible.",
    description:
      "Only after approval does Drever author the complete story, move detail to Notes, and open one live preview.",
    status: "Draft live",
  },
  {
    id: "direction",
    label: "Art direction + motion",
    title: "Let the subject direct the motion.",
    description:
      "Three setup paths resolve into one. Palette, layout, and movement now explain simplification instead of decorating it.",
    status: "Art directed",
  },
  {
    id: "room",
    label: "The room",
    title: "Reveal what the room asks for.",
    description: `The team chooses “${creationStory.choice}.” The next Step reveals ${creationStory.evidence} and preserves the exact ${creationStory.route} moment.`,
    status: "Live room",
  },
  {
    id: "delivery",
    label: "Every surface",
    title: "Keep the exact moment useful.",
    description:
      "Audience, speaker, document, website, and PDF stay connected to the same authored story.",
    status: "Every surface",
  },
] as const;

type JourneyStage = (typeof journeyStages)[number]["id"];

export function CreationJourney() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStage = journeyStages[activeIndex] ?? journeyStages[0];

  useEffect(() => {
    const section = sectionRef.current;
    if (section === null) {
      return;
    }

    const steps = [...section.querySelectorAll<HTMLElement>("[data-journey-step]")];
    const observer = new IntersectionObserver(
      (entries) => {
        const activeEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              Math.abs(
                left.boundingClientRect.top +
                  left.boundingClientRect.height / 2 -
                  window.innerHeight / 2,
              ) -
              Math.abs(
                right.boundingClientRect.top +
                  right.boundingClientRect.height / 2 -
                  window.innerHeight / 2,
              ),
          )[0];

        if (activeEntry === undefined) {
          return;
        }

        const nextIndex = Number((activeEntry.target as HTMLElement).dataset.journeyStep);
        if (Number.isInteger(nextIndex)) {
          setActiveIndex(nextIndex);
        }
      },
      { rootMargin: "-42% 0px -42% 0px" },
    );

    steps.forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      aria-labelledby="home-journey-title"
      className="home-journey"
      data-header-tone="dark"
      ref={sectionRef}
    >
      <header className="home-journey__intro">
        <span>One deck · becoming</span>
        <h2 id="home-journey-title">Watch a presentation earn its final form.</h2>
        <p>
          The canvas stays put. The thinking gets clearer as you scroll—from raw brief, through a
          reviewed plan, to a live, shareable room.
        </p>
      </header>

      <div className="home-journey__layout">
        <JourneyVisual
          activeIndex={activeIndex}
          activeStage={activeStage.id}
          status={activeStage.status}
        />

        <ol className="home-journey__steps">
          {journeyStages.map((stage, index) => (
            <li
              data-active={index === activeIndex ? "" : undefined}
              data-journey-step={index}
              key={stage.id}
            >
              <article aria-current={index === activeIndex ? "step" : undefined}>
                <span>
                  {String(index + 1).padStart(2, "0")} · {stage.label}
                </span>
                <h3>{stage.title}</h3>
                <p>{stage.description}</p>
                {stage.id === "delivery" ? (
                  <a className="button button--light" href="/showcase/product/">
                    Open the finished deck <ArrowIcon />
                  </a>
                ) : null}
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function JourneyVisual({
  activeIndex,
  activeStage,
  status,
}: {
  activeIndex: number;
  activeStage: JourneyStage;
  status: string;
}) {
  return (
    <figure
      aria-hidden="true"
      className="home-journey__visual"
      data-stage={activeStage}
      style={
        {
          "--journey-progress": (activeIndex + 1) / journeyStages.length,
        } as CSSProperties
      }
    >
      <div className="home-journey__visual-shell">
        <header className="home-journey__visual-header">
          <span>Drever</span>
          <small>Editable throughout</small>
        </header>

        <div className="home-journey__workbench">
          <div className="home-journey__rail">
            {["Opening", "Friction", "Proof", "Decision"].map((label, index) => (
              <div data-selected={index === Math.min(activeIndex, 3) ? "" : undefined} key={label}>
                <i />
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
            ))}
          </div>

          <div className="home-journey__deck">
            <div className="home-journey__deck-night" />
            <div className="home-journey__deck-grid" />

            <div className="home-journey__brief-card">
              <span>What should change?</span>
              <p>{creationStory.brief}</p>
              <i />
            </div>

            <div className="home-journey__draft">
              <small>Brief · awaiting approval</small>
              <h3>Seven-slide decision story</h3>
              <p>
                Open with setup friction, compare three paths, reveal one proof point, and end with
                a launch decision.
              </p>
              <ul>
                <li>8 minutes</li>
                <li>Concise</li>
                <li>Full Notes</li>
              </ul>
            </div>

            <div className="home-journey__feedback">
              <header>
                <span>Your direction</span>
                <small>You</small>
              </header>
              <strong>Make the decision unmistakable before authoring.</strong>
              <ul>
                <li>Keep one proof point.</li>
                <li>Move the rest to Notes.</li>
              </ul>
              <i />
            </div>

            <div className="home-journey__final-copy">
              <small>Setup study</small>
              <h3>{creationStory.title}</h3>
              <p>{creationStory.question}</p>
            </div>

            <div className="home-journey__motif">
              <i />
              <i />
              <i />
              <b />
            </div>

            <aside className="home-journey__notes">
              <span>Moved to Notes</span>
              <p>Define the cohort, sample size, and support-volume caveat before discussion.</p>
            </aside>

            <div className="home-journey__choice">
              <small>The room chooses</small>
              <strong>{creationStory.choice}</strong>
            </div>

            <div className="home-journey__proof">
              <strong>{creationStory.evidence}</strong>
              <span>{creationStory.evidenceDetail}</span>
            </div>

            <div className="home-journey__room-chrome">
              <span>Live · 09:42</span>
              <span>Speaker cue ready</span>
            </div>

            <div className="home-journey__route">
              <i />
              <span>yourdeck.com{creationStory.route}</span>
            </div>
          </div>

          <div className="home-journey__surfaces">
            <article data-surface="audience">
              <span>Audience</span>
              <strong>{creationStory.evidence}</strong>
              <small>Exact Step</small>
            </article>
            <article data-surface="speaker">
              <span>Speaker</span>
              <strong>Decision cue</strong>
              <small>09:42 elapsed</small>
            </article>
            <article data-surface="document">
              <span>Document</span>
              <strong>Setup study</strong>
              <small>Readable context</small>
            </article>
            <article data-surface="delivery">
              <span>Delivery</span>
              <strong>Web · PDF</strong>
              <small>One source</small>
            </article>
          </div>
        </div>

        <figcaption className="home-journey__visual-footer">
          <span>
            {String(activeIndex + 1).padStart(2, "0")} /{" "}
            {String(journeyStages.length).padStart(2, "0")}
          </span>
          <strong>{status}</strong>
          <div>
            {journeyStages.map((stage, index) => (
              <i data-active={index === activeIndex ? "" : undefined} key={stage.id} />
            ))}
          </div>
        </figcaption>
      </div>
    </figure>
  );
}
