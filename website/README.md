# Drever website

The public website combines the Drever product story, curated documentation,
official theme previews, and complete executable example builds.

It uses TanStack Start for file-based routing and build-time prerendering. Only the generated files in `dist/client` are deployed. There is no production server, server function, Pages Function, or Worker runtime.

## Site boundaries

The site has four primary surfaces:

- `/` contains the product website.
- `/docs/*` contains prerendered documentation routes.
- `/demos/*` hosts real Drever builds selected from `examples/`.
- `/themes` presents representative design previews and links to live studies.

TanStack Start owns the website, documentation, demo catalog, and theme catalog
routes. The root build compiles each curated example in its own project and
copies its complete output to `dist/client/demos/<slug>`. The website does not
duplicate a demo's MDX or React components. Every published demo is executable
with the same Drever code users receive.

The curated set is:

- `examples/product-tour` at `/demos/product/`
- `examples/feature-gallery` at `/demos/features/`
- `examples/motion-recipes` at `/demos/motion/`
- `examples/architecture` at `/demos/architecture/`
- `examples/basic` at `/demos/basic/`

Five focused decks from `examples/theme-showcase` extend the design catalog:

- Fieldnote at `/demos/design/fieldnote/`
- Atlas at `/demos/design/atlas/`
- Ledger at `/demos/design/ledger/`
- Cinema at `/demos/design/cinema/`
- Construct at `/demos/design/construct/`

The theme-showcase project builds all five studies once and keeps their output
isolated under `dist/<study>`. The website mounts those outputs independently
without adding them to the main demo catalog.

## Local development

Run commands from the repository root:

```sh
pnpm run dev:website
pnpm run build:website
pnpm run preview:website
```

`build:website` builds workspace packages, rebuilds the curated examples,
prerenders every static route, copies the standalone demos, and verifies the
final output. `preview:website` serves that exact `dist/client` directory
through the Cloudflare Pages development server.

## Cloudflare Pages

The site is a Git-integrated Cloudflare Pages project. Pages owns production deployments from `main` and creates isolated previews for pull requests.

Build settings:

- Repository: `Zhangdroid/drever`
- Production branch: `main`
- Root directory: repository root
- Build command: `pnpm run build:website`
- Build output directory: `website/dist/client`
- Node.js: `24.18.0`
- pnpm: `11.15.1`

The manual fallback command builds and verifies the same output before upload:

```sh
pnpm run deploy:website
```

The custom domain is managed by Pages rather than source configuration.
