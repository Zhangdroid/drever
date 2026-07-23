# Releasing Drever

Drever publishes 16 public packages with one lockstep version. In particular,
`drever`, `create-drever`, and `@drever/agent` must always share the same
version so project creation, the runtime, and agent workflows remain
compatible.

## Release channels

| Channel     | Version                            | npm dist-tag | Trigger                             |
| ----------- | ---------------------------------- | ------------ | ----------------------------------- |
| Commit test | `0.0.0-commit.g<12-character-sha>` | `commit`     | Manual `Publish` workflow on `main` |
| Prerelease  | `0.1.0-next.0` or `0.1.0-rc.1`     | `next`       | Published GitHub prerelease         |
| Stable      | `0.1.0`                            | `latest`     | Published GitHub release            |

Every publish passes an explicit dist-tag. A commit test must never update
`latest`. npm package versions are immutable, so a commit build cannot later
be renamed to a stable version. A stable release rebuilds the same source
revision with its final version.

## Release gate

Run the complete local gate before requesting a release:

```sh
vp run ready
vp run release:check
```

The gates collectively:

1. format, lint, and type-check the workspace;
2. run unit and end-to-end tests;
3. remove stale package outputs and build every workspace package;
4. verify public package versions, licenses, repository metadata, runtime
   descriptors, plugin manifests, and required tarball files;
5. pack all public packages;
6. install those tarballs in a clean temporary project outside the workspace;
7. run packed `create-drever`, then validate and build its generated deck with
   the packed `drever` CLI.

This clean-consumer flow is required because workspace resolution can hide
missing package dependencies and native bindings.

## Automated publishing

[`.github/workflows/publish.yml`](../.github/workflows/publish.yml) is the only
npm publishing identity. Publications are queued rather than replaced and run
as two jobs:

1. an unprivileged audit job installs, tests, versions, packs, dry-runs, and
   uploads the release artifact with `contents: read` only;
2. a minimal publish job downloads that exact artifact, receives
   `id-token: write` through the `npm` environment, publishes it, and verifies
   a clean registry consumer.

The workflow verifies the unmodified source revision first. It then applies an
ephemeral lockstep version, rebuilds, and first packs with pnpm through Vite+.
pnpm converts `workspace:` and `catalog:` references to registry-safe versions.
Drever then orders dependency maps and repacks the result with npm so the same
source produces the same tarball. npm also performs the Trusted Publishing OIDC
exchange.

Trusted Publishing automatically adds provenance when the source repository
and package are public; the publish command must not pass `--provenance`
explicitly. npm does not support provenance for private source repositories.

The release receipt records the Git commit, package order, tarball sizes, and
SHA-512 integrity values. Publication is dependency-ordered and retryable. A
failed publish job reuses the already-audited artifact; a complete rerun
reproduces the same bytes. An existing package version is skipped only when the
registry integrity matches the audited tarball. `drever` and `create-drever`
are published after their dependencies.

After publishing, a clean npm consumer installs the exact public versions,
creates a deck, checks it, builds it, and verifies the packaged Codex and
Claude plugin versions.

## One-time npm bootstrap

npm Trusted Publishing can only be configured after a package exists. The
existing `drever@0.0.0` is a placeholder, while the other public packages need
their first publication.

1. Make `Zhangdroid/drever` public. This project is intended to be open source,
   and a public repository enables npm provenance and GitHub environment
   protection on the current account plan.
2. Enable 2FA on the npm maintainer account.
3. Create a GitHub environment named `npm`. Add a required reviewer, then add
   `main` as a deployment branch rule and `v*` as a separate deployment tag
   rule. Add a GitHub tag ruleset for `v*` before the first stable release so
   only maintainers can create release tags.
4. Create a granular npm access token with the minimum one-day expiry. Select
   **Packages and scopes: Read and write**, **All Packages**, and **Bypass 2FA**.
   `All Packages` is temporarily necessary because most packages, including
   the unscoped `create-drever`, do not exist yet. Store it as the `NPM_TOKEN`
   secret on the `npm` environment.
5. Run the `Publish` workflow manually on `main`. It publishes a
   `0.0.0-commit.g<sha>` test release under the `commit` dist-tag.
6. Configure every package to trust `Zhangdroid/drever`, workflow
   `publish.yml`, environment `npm`, with `npm publish` permission. After
   logging in to npm, the package list is available with:

   ```sh
   node scripts/release.mjs packages
   ```

   Do not reuse the automation token for this step. Sign in interactively with
   2FA from a neutral directory, because the repository enforces pnpm through
   `devEngines`, then configure each package with npm 11.16 or newer:

   ```sh
   cd /tmp
   npm login
   npm trust github <package> \
     --repo Zhangdroid/drever \
     --file publish.yml \
     --env npm \
     --allow-publish \
     --yes
   ```

7. Delete the GitHub `NPM_TOKEN` secret and revoke the token immediately.
8. Set each package's publishing access to **Require two-factor authentication
   and disallow tokens**.
9. Push or merge a new commit to `main`, dispatch that new SHA as a second
   commit test, and confirm that npm shows provenance from the GitHub workflow.
   Do not rerun the first SHA: it has the same immutable version and would only
   verify and skip existing packages without exercising OIDC publication.

Trusted Publishing requires the repository URL in each package manifest to
match the GitHub repository. The workflow filename and environment name are
also exact, case-sensitive parts of npm's trust policy.

## Release recovery

npm publication across multiple packages is not transactional. If only the
publish job fails, use **Re-run failed jobs** so it downloads the exact audited
artifact. A full rerun for the same commit is also safe because the pack is
reproducible. Matching versions are verified and skipped; missing packages
continue in dependency order. A version with different integrity stops the
workflow.

Do not unpublish a broken release by default. npm never allows the same
name/version pair to be reused. Publish a corrected version and deprecate the
broken one when necessary.

The release process must not use `postinstall` scripts to modify user files or
install Playwright Chromium. PDF browser installation remains an explicit,
recoverable delivery step.

## References

- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm provenance](https://docs.npmjs.com/generating-provenance-statements/)
- [npm dist-tags](https://docs.npmjs.com/cli/dist-tag/)
- [pnpm workspace package publishing](https://pnpm.io/workspaces#publishing-workspace-packages)
- [Vite+ continuous integration](https://viteplus.dev/guide/ci)
