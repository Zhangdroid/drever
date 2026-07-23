# Drever website

The public website is intentionally a placeholder while the product and documentation experience are being redesigned.

## Local development

From the repository root:

```sh
vp run -F @drever/website dev
```

## Cloudflare deployment

The site deploys as static assets on Cloudflare Workers. Deployment automation uses Workers Builds rather than a GitHub Actions deployment workflow, so Cloudflare owns the build credentials and posts preview URLs directly to pull requests.

Workers Builds is connected to `Zhangdroid/drever`. Pushes to `main` deploy to
production, while other branches upload isolated preview versions.

Current settings:

- Repository: `Zhangdroid/drever`
- Worker name: `drever-website`
- Root directory: `/`
- Production branch: `main`
- Build command: `vp run -F @drever/website build`
- Production deploy command: `vp run -F @drever/website deploy`
- Non-production deploy command: `vp run -F @drever/website deploy:preview`
- Build variable: `PNPM_VERSION=11.15.1`
- Non-production branch builds: enabled

The repository's `.node-version` pins Node.js for local development and Workers Builds. The custom domain and preview URL policy are declared in `wrangler.jsonc`.
