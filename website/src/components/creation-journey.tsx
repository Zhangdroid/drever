import { useEffect, useRef, useState, type CSSProperties } from "react";

import { creationStory } from "./creation-story-data";
import { ArrowIcon } from "./icons";

const journeyStages = [
  {
    id: "brief",
    label: "Brief",
    title: "Give the deck one clear job.",
    description:
      "Start with the topic, the people in the room, and what should change when the talk ends. Choose the essentials—or let your agent resolve what is still open.",
    status: "Brief received",
  },
  {
    id: "discover",
    label: "Direction",
    title: "Answer only what changes the story.",
    description:
      "Your agent resolves the common choices, then asks a few questions selected from this subject and your earlier answers—not a generic form.",
    status: "Direction resolved",
  },
  {
    id: "storyboard",
    label: "Storyboard",
    title: "Approve content before styling.",
    description:
      "See the complete page-by-page argument before MDX exists. Select a beat, redirect the emphasis, or approve the plan while change is still cheap.",
    status: "Awaiting approval",
  },
  {
    id: "design",
    label: "Art direction",
    title: "Let the subject shape the design.",
    description:
      "Your agent studies the subject—or imports visual evidence from a reference—and writes a local visual system instead of choosing a random skin.",
    status: "Art direction owned",
  },
  {
    id: "iterate",
    label: "Live draft",
    title: "Direct the complete first draft.",
    description:
      "Draft 1 arrives early with Notes. Comment on one slide or the whole deck while agent activity stays visible and the last valid preview remains available.",
    status: "Agent refining · Draft live",
  },
  {
    id: "review",
    label: "Rendered review",
    title: "Catch what generation can miss.",
    description:
      "Every authored Step is tested for clipping, overflow, overlap, contrast, density, and unstable geometry. Visual judgment still belongs to you.",
    status: "Rendered evidence ready",
  },
  {
    id: "delivery",
    label: "The room",
    title: "Take the same story everywhere.",
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
      id="studio-workflow"
      ref={sectionRef}
    >
      <header className="home-journey__intro">
        <span>One Studio · one evolving deck</span>
        <h2 id="home-journey-title">Stay in the loop while the work becomes real.</h2>
        <p>
          See useful work early, approve the important decisions, and let your agent keep refining
          without taking the presentation out of your hands.
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
  const selectedRailIndex = Math.min(Math.max(activeIndex - 2, 0), 3);

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
          <small>Drever Studio · Agent connected</small>
        </header>

        <div className="home-journey__workbench">
          <div className="home-journey__rail">
            {["Opening", "Friction", "Proof", "Decision"].map((label, index) => (
              <div data-selected={index === selectedRailIndex ? "" : undefined} key={label}>
                <i />
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
            ))}
          </div>

          <div className="home-journey__deck">
            <div className="home-journey__deck-night" />
            <div className="home-journey__deck-grid" />

            <div className="home-journey__brief-card">
              <span>Topic + shared choices</span>
              <p>{creationStory.brief}</p>
              <ul>
                <li>8 minutes</li>
                <li>Concise</li>
                <li>Measured motion</li>
              </ul>
            </div>

            <div className="home-journey__questions">
              <header>
                <span>Question 02</span>
                <small>Chosen for this topic</small>
              </header>
              <strong>What proof would make the launch feel safe?</strong>
              <div>
                <span data-selected="">Unaided completion</span>
                <span>Support volume</span>
                <span>Time to value</span>
              </div>
              <p>Changes the evidence and decision slides.</p>
            </div>

            <div className="home-journey__storyboard">
              <header>
                <small>Storyboard · awaiting approval</small>
                <span>7 slides</span>
              </header>
              <h3>One decision, seven beats.</h3>
              <ol>
                {[
                  ["01", "Opening"],
                  ["03", "Friction"],
                  ["05", "Proof"],
                  ["07", "Decision"],
                ].map(([index, label]) => (
                  <li data-selected={label === "Proof" ? "" : undefined} key={label}>
                    <span>{index}</span>
                    <i />
                    <strong>{label}</strong>
                  </li>
                ))}
              </ol>
            </div>

            <div className="home-journey__feedback">
              <header>
                <span>Entire deck</span>
                <small>You</small>
              </header>
              <strong>Let the proof arrive one beat earlier.</strong>
              <ul>
                <li>Keep this slide concise.</li>
                <li>Move cohort detail to Notes.</li>
              </ul>
              <i />
            </div>

            <div className="home-journey__final-copy">
              <small>Setup study · 05 / 07</small>
              <h3>{creationStory.title}</h3>
              <p>{creationStory.question}</p>
            </div>

            <div className="home-journey__motif">
              <i />
              <i />
              <i />
              <b />
            </div>

            <div className="home-journey__choice">
              <small>The room chooses</small>
              <strong>{creationStory.choice}</strong>
            </div>

            <div className="home-journey__proof">
              <strong>{creationStory.evidence}</strong>
              <span>{creationStory.evidenceDetail}</span>
            </div>

            <div className="home-journey__quality">
              <header>
                <span>Rendered review</span>
                <strong>Ready</strong>
              </header>
              <ul>
                <li>Exact states</li>
                <li>Contrast</li>
                <li>Geometry</li>
              </ul>
              <p>7 slides · 11 states · both directions</p>
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
