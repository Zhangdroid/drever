# Drever website

The public website combines the Drever product story, curated documentation, a unified showcase,
and complete executable example builds.

It uses TanStack Start for file-based routing and build-time prerendering. Only the generated files in `dist/client` are deployed. There is no production server, server function, Pages Function, or Worker runtime.

## Site boundaries

The site has five primary surfaces:

- `/` contains the product website.
- `/changelog` renders the repository's canonical `CHANGELOG.md`.
- `/docs/*` contains prerendered documentation routes.
- `/showcase` curates complete stories, focused capability studies, and art directions.
- `/showcase/*` hosts the real Drever builds selected from `examples/`.

TanStack Start owns the website, documentation, and showcase routes. The root build compiles each
curated example in its own project and copies its complete output to
`dist/client/showcase/<slug>`. The website does not duplicate a demo's MDX or React components. Every
published demo is executable from repository source. Room Scenes is an explicitly incubating
source study; the other demos use released Drever packages.

The curated set is:

- `examples/product-tour` at `/showcase/product/`
- `examples/feature-gallery` at `/showcase/features/`
- `examples/motion-recipes` at `/showcase/motion/`
- `examples/room-scenes` at `/showcase/scenes/` (incubating source study)
- `examples/architecture` at `/showcase/architecture/`
- `examples/basic` at `/showcase/basic/`

Eight focused decks from `examples/theme-showcase` form the design catalog:

- Basic at `/showcase/design/basic/`
- Editorial at `/showcase/design/editorial/`
- Studio at `/showcase/design/studio/`
- Fieldnote at `/showcase/design/fieldnote/`
- Atlas at `/showcase/design/atlas/`
- Ledger at `/showcase/design/ledger/`
- Cinema at `/showcase/design/cinema/`
- Construct at `/showcase/design/construct/`

The theme-showcase project builds all eight studies once and keeps their output
isolated under `dist/<study>`. The website mounts those outputs independently
without adding them to the main demo catalog.

Legacy `/demos/*` URLs permanently redirect to the equivalent `/showcase/*` path.

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

The site is a Git-integrated Cloudflare Pages project. Pages owns production
deployments from `main` and creates isolated previews for pull requests.
[`deploy-website.yml`](../.github/workflows/deploy-website.yml) waits for the
matching Cloudflare check on each `main` commit and mirrors its outcome to the
GitHub `website` environment. This gives production a real GitHub Deployment
record and a direct `drever.dev` environment URL without uploading the same
site twice. Pull-request preview URLs remain owned by the Cloudflare check and
its PR integration.

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
