# Drever website

The public website is intentionally a placeholder while the product and documentation experience are being redesigned.

It uses TanStack Start for file-based routing and build-time prerendering. Only the generated files in `dist/client` are deployed. There is no production server, server function, Pages Function, or Worker runtime.

## Site boundaries

The finished site has three surfaces:

- `/` contains the product website.
- `/docs/*` contains prerendered documentation routes.
- `/demos/*` hosts real Drever builds selected from `examples/`.

TanStack Start owns the website and documentation routes. A future build assembly step will build each curated example in its own project and copy its complete output to `dist/client/demos/<slug>`. The website must not duplicate a demo's MDX or React components. This keeps every published demo executable with the same Drever code users receive.

The initial curated set will be:

- `examples/product-tour` at `/demos/product/`
- `examples/feature-gallery` at `/demos/features/`
- `examples/motion-recipes` at `/demos/motion/`

## Local development

Run commands from the repository root:

```sh
vp run dev:website
vp run build:website
vp run preview:website
```

`build:website` prerenders every static route and type-checks the website. `preview:website` serves the exact `dist/client` directory through the Cloudflare Pages development server.

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

The manual fallback command is:

```sh
vp run deploy:website
```

The custom domain is managed by Pages rather than source configuration. The previous Worker remains available during migration only as a rollback target.
