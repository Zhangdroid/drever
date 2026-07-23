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
source produces the same tarball. During bootstrap, npm authenticates with the
temporary `NPM_TOKEN`. After each package has a trusted publisher, npm uses the
workflow's OIDC identity instead.

Trusted Publishing automatically adds provenance when the source repository
and package are public; the publish command must not pass `--provenance`
explicitly. A private source repository can still publish with either a token
or Trusted Publishing, but npm does not generate provenance for that release.

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
their first publication. Repository visibility does not block npm publication:
a private repository can complete this bootstrap and use Trusted Publishing.
Keeping it private only removes npm provenance and, depending on the GitHub
plan, some environment protection rules.

1. Enable 2FA on the npm maintainer account.
2. Create a GitHub environment named `npm`. A private bootstrap may use the
   environment without protection and a repository-level secret. Before the
   first stable release, make the repository public and add a required reviewer,
   a `main` deployment branch rule, a separate `v*` deployment tag rule, and a
   GitHub tag ruleset for `v*`.
3. Create a granular npm access token with the minimum one-day expiry. Select
   **Packages and scopes: Read and write**, **All Packages**, and **Bypass 2FA**.
   `All Packages` is temporarily necessary because most packages, including
   the unscoped `create-drever`, do not exist yet. Store it as a repository or
   `npm` environment secret named `NPM_TOKEN`. Never commit the token.
4. Run the `Publish` workflow manually on `main`. It publishes a
   `0.0.0-commit.g<sha>` test release under the `commit` dist-tag.
5. Configure every package to trust `Zhangdroid/drever`, workflow
   `publish.yml`, environment `npm`, with `npm publish` permission. A granular
   access token, including one with Bypass 2FA, cannot access npm's trust
   endpoints. Sign in interactively from a neutral directory instead:

   ```sh
   cd /tmp
   npm login --auth-type=web --registry=https://registry.npmjs.org
   ```

   Then return to the repository and run the idempotent bulk configurator with
   npm 11.15 or newer:

   ```sh
   node scripts/configure-trusted-publishing.mjs
   ```

   The first trust request opens npm's 2FA flow. Select the option to skip
   additional 2FA checks for five minutes; the script spaces requests by two
   seconds as npm recommends. It first inspects all 16 packages, skips exact
   matches, refuses to replace a conflicting policy, creates missing policies,
   and then reads all policies back from npm. A partial network failure is safe
   to resume by running the same command again. To perform a read-only audit,
   pass `--verify-only`.

6. Delete the GitHub `NPM_TOKEN` secret and revoke the token immediately.
7. Set each package's publishing access to **Require two-factor authentication
   and disallow tokens**.
8. Push or merge a new commit to `main` and dispatch that new SHA as a second
   commit test. Confirm that it publishes through OIDC without `NPM_TOKEN`. If
   the repository is public, also confirm that npm shows provenance from the
   GitHub workflow. Do not rerun the first SHA: it has the same immutable
   version and would only verify and skip existing packages without exercising
   OIDC publication.

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
