# Drever theme showcase

One real Drever project for reviewing five additional official design studies
without maintaining five duplicate example packages. `DREVER_THEME` selects
both the Theme contract and a short deck written specifically for that visual
language. Default, Editorial, and Studio are treated the same way in the main
design-study catalog; this project concentrates the five newer studies:

| Value       | Entry                 | Story                                                      |
| ----------- | --------------------- | ---------------------------------------------------------- |
| `fieldnote` | `decks/fieldnote.mdx` | Usability-research observations and annotations            |
| `atlas`     | `decks/atlas.mdx`     | Restoring a river corridor through place and progression   |
| `ledger`    | `decks/ledger.mdx`    | An activation review with a metric, evidence, and decision |
| `cinema`    | `decks/cinema.mdx`    | A narrative about restoring late-night bus service         |
| `construct` | `decks/construct.mdx` | A facilitation exercise that assembles a reliable handoff  |

The default is `fieldnote`. The selected entry and theme always come from the
same lookup in `drever.config.ts`, so this example cannot accidentally show one
deck with another deck's intended theme.

## Run one theme

From the repository root:

```sh
DREVER_THEME=atlas vp run -F @drever/example-theme-showcase dev
DREVER_THEME=ledger vp run -F @drever/example-theme-showcase check
DREVER_THEME=cinema vp run -F @drever/example-theme-showcase build
```

`DREVER_THEME` is the canonical selector. When invoking the runner directly,
`--theme` is a cross-platform convenience that sets the variable for the
Drever child process:

```sh
node examples/theme-showcase/scripts/run.mjs dev --theme construct
```

Open <http://localhost:4326>. The project uses a strict port that does not
overlap the other repository examples. Production output is isolated under
`dist/<theme>`, so builds do not overwrite one another.

Build the workspace packages before the first run if their `dist` files are not
present. The showcase itself has no network-loaded assets.

## Review all themes

The runner can check or build every selection sequentially:

```sh
vp run -F @drever/example-theme-showcase check:all
vp run -F @drever/example-theme-showcase build:all
```

`check:all` prints one compiler JSON report per theme. `build:all` leaves five
independent static projects under `dist/`.

For a visual review, inspect:

- whether the subject and layout feel inseparable rather than generically
  reskinned;
- ordinary Markdown as well as each theme's semantic layouts;
- numeric alignment, source labels, captions, and accessible SVG summaries;
- audience, speaker, document, and reduced-motion surfaces.
