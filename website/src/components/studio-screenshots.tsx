import liveDraftImage from "../assets/studio/live-draft.png";
import storyboardReviewImage from "../assets/studio/storyboard-review.png";

const studioScreenshots = [
  {
    alt: "Drever Studio showing an Architecture presentation Storyboard, deck-scoped feedback, and the Approve story action",
    eyebrow: "01 · Storyboard",
    image: storyboardReviewImage,
    title: "Approve the story before styling enters the conversation.",
  },
  {
    alt: "Drever Studio showing a live Architecture draft, speaker Notes, agent status, and slide-scoped feedback",
    eyebrow: "02 · Live draft",
    image: liveDraftImage,
    title: "Review the real deck, Notes, and feedback in one local room.",
  },
] as const;

export function StudioScreenshots() {
  return (
    <section aria-label="Drever Studio interface" className="studio-screenshots">
      <header>
        <span>Studio, in practice</span>
        <p>Two checkpoints, one evolving presentation.</p>
      </header>
      <div>
        {studioScreenshots.map((screenshot) => (
          <figure key={screenshot.eyebrow}>
            <a href={screenshot.image} rel="noreferrer" target="_blank">
              <img
                alt={screenshot.alt}
                decoding="async"
                height={1000}
                loading="lazy"
                src={screenshot.image}
                width={1600}
              />
            </a>
            <figcaption>
              <span>{screenshot.eyebrow}</span>
              <strong>{screenshot.title}</strong>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
