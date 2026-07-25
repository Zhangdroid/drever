import type { ReactElement } from "react";

/** One stable route back into the product from every public design study. */
export const ShowcaseExit = (): ReactElement => (
  <nav aria-label="Continue with Drever" className="drever-example-exit">
    <a
      className="drever-example-exit__primary"
      data-drever-showcase-return=""
      href="https://drever.dev/docs/getting-started/"
    >
      Start a deck
    </a>
    <a className="drever-example-exit__secondary" href="https://drever.dev/showcase/">
      More design studies
    </a>
  </nav>
);
