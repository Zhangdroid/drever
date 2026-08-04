# Releasing Drever

Drever publishes its public packages with one lockstep version. In particular,
`drever`, `create-drever`, and `@drever/agent` must always share the same
version so project creation, the runtime, and agent workflows remain
compatible.

## Release channels

| Channel     | Version                            | npm dist-tag | Workflow input               | GitHub result |
| ----------- | ---------------------------------- | ------------ | ---------------------------- | ------------- |
| Commit test | `0.0.0-commit.g<12-character-sha>` | `commit`     | `commit`; version left empty | Prerelease    |
| Prerelease  | `0.1.0-next.0` or `0.1.0-rc.1`     | `next`       | `next`; prerelease SemVer    | Prerelease    |
| Stable      | `0.1.0`                            | `latest`     | `latest`; stable SemVer      | Release       |

Every publish passes an explicit dist-tag. A commit test must never update
`latest`. npm package versions are immutable, so a commit build cannot later
be renamed to a stable version. A stable release rebuilds the same source
revision with its final version. GitHub Releases are written only after npm
publication and public-registry verification succeed.

## Release cadence

`Unreleased` is an accumulation buffer, not a signal to publish immediately.
Merge completed package changes with their tests, documentation, and changelog
entries, then release a coherent batch. Prefer one patch containing several
small compatible fixes over a sequence of patches. Exceptions are an explicit
maintainer request, a security issue, or a serious public regression. Commit
snapshots are reserved for intentional installability checks and do not
automatically run the AI smoke.

## Release notes

[`CHANGELOG.md`](../CHANGELOG.md) is the canonical release history for the
repository, website, and GitHub Releases. Keep its `Unreleased` section current
as user-facing work lands.

Before dispatching `next` or `latest`, move the relevant entries into one
version section:

```md
## [0.2.0] - 2026-08-01

### Added

- Describe the user-visible capability.
```

The heading version must exactly match the workflow input. A commit test uses
the current `Unreleased` section. Every selected section must contain at least
one list item; otherwise the audit job fails before npm publication.

The audit job extracts the selected section into the retained release artifact.
The record job uses only that audited file for the GitHub Release body and
appends package version, dist-tag, source commit, and npm links. The public
website compiles the same root file at
[`/changelog`](https://drever.dev/changelog/), so release notes are never copied
between three independently maintained sources.

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
   descriptors, plugin manifests, and manifest-declared tarball entry points;
5. pack all public packages;
6. install those tarballs in a clean temporary project outside the workspace;
7. run packed `create-drever`, then validate and build its generated deck with
   the packed `drever` CLI.

This clean-consumer flow is required because workspace resolution can hide
missing package dependencies and native bindings.

## Automated publishing

[`.github/workflows/publish.yml`](../.github/workflows/publish.yml) is the only
recurring lockstep publishing identity. Run it manually from `main`, choose
`commit`, `next`, or `latest`, provide a version only for a named release, and
choose whether its AI smoke should follow the default policy, always run, or
never run. Publications are queued rather than replaced and run as four jobs:

1. an unprivileged audit job installs, tests, versions, packs, extracts the
   required changelog section, retains the release artifact, checks the
   registry package set, and dry-runs publication with `contents: read` only;
2. a minimal publish job downloads that exact artifact, receives
   `id-token: write` through the `npm` environment, verifies that every public
   package name has already been bootstrapped, publishes it, and verifies a
   clean registry consumer;
3. an isolated record job receives `contents: write` only after publication
   succeeds and creates the matching GitHub Release with the audited receipt
   and release notes;
4. a conditional dispatch job receives `actions: write` only after the GitHub
   Release exists and queues the independent post-release Codex smoke run.

The workflow verifies the unmodified source revision first. It then applies an
ephemeral lockstep version, rebuilds, and first packs with pnpm through Vite+.
pnpm converts `workspace:` and `catalog:` references to registry-safe versions.
Drever then orders dependency maps and repacks the result with npm so the same
source produces the same tarball. npm authenticates exclusively through the
workflow's short-lived OIDC identity; the publish job has no registry token.

The `npm` environment is a publishing security boundary, not a deployment
target. The publish job keeps its environment protections and trusted
publishing identity but disables GitHub Deployment records. Every completed
npm publication is recorded as a GitHub Release; commit tests and `next`
versions are marked as prereleases. Creating the Release last prevents GitHub
from advertising a version whose npm publication failed.

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

Before publishing the first tarball, the publish command checks every package
name against the public registry. This prevents a newly added, unbootstrapped
package from leaving a lockstep release half-published. npm OIDC credentials
authorize only publication and cannot inspect Trusted Publisher settings, so
run the authenticated trust audit below after changing the public package set
and before dispatching the release:

```sh
node scripts/configure-trusted-publishing.mjs --verify-only
```

After publishing, a clean npm consumer installs the exact public versions,
creates a deck, checks it, builds it, and verifies the packaged Codex and
Claude plugin versions.

## Post-release AI comparison smoke

The publishing workflow's `ai_smoke` input defaults to `auto`: stable `latest`
releases dispatch [`release-smoke.yml`](../.github/workflows/release-smoke.yml)
with the exact published version and audited source commit, while `commit`
snapshots and `next` prereleases stop after registry and GitHub Release
verification. Choose `always` when a prerelease or intentional commit snapshot
needs full AI evidence, or `never` when a stable release must omit it.
Maintainers can also dispatch the smoke manually for any published version.

The smoke is intentionally separate from npm publication: a nondeterministic AI
failure remains visible without making an already verified registry release
appear to have failed. Each journey runs independently through
`gpt-5.6-sol` and `claude-opus-5`, both at medium reasoning effort, then
publishes both results as a direct comparison. The shared effort level keeps
the comparison balanced while bounding latency and token use. One non-matrix
authorization job owns the protected-environment approval for the whole run.
After it passes, all four provider-and-briefing journeys generate independently
in parallel; neither Claude case opens another approval. Each Claude journey
has a 35-minute scenario deadline, allows an individual turn up to 20 minutes,
and carries its own cumulative $15 CLI budget plus agent-turn and proxy request
limits. A failed validation may spend at most one additional repair turn with a
$3 Claude cap. Cost is further controlled by running this expensive evidence
once for stable releases by default.
The Codex half may qualify for OpenAI's complimentary
shared-traffic allowance only when project data sharing is enabled, the
organization is eligible, and daily quota remains; otherwise normal API billing
applies. See
[OpenAI's data-sharing and complimentary-token policy](https://help.openai.com/en/articles/10306912-sharing-feedback-and-api-inputs-and-outputs-with-openai).

The workflow exercises two fixed user journeys against the public
`https://drever.dev/prompt.md`. Both use the same stable, broadly understandable
science topic—why black holes are not cosmic vacuum cleaners—so the briefing
mode is the variable rather than the subject. A supplied factual fixture keeps
both providers away from external research and gives them the same material for
stellar collapse, the event horizon, an equal-mass Sun thought experiment,
orbits, close-range effects, detection, and an inverse-square comparison. The
requested 12-slide story, enforced as a 10-to-14-slide build contract, is long
enough to exercise a real narrative arc, readable diagrams, purposeful motion,
and speaker notes without making an occasional one-slide model variance discard
the entire paid run:

1. a user supplies the topic, uses the briefing's **Skip remaining questions**
   escape to delegate every remaining creative decision, reviews the resulting
   brief and outline, then approves creation;
2. a user supplies the same topic, answers the high-impact briefing questions,
   and gives concrete audience, duration, density, motion, and learning goals
   before approving the resulting brief and outline.

Each provider receives both journeys from the exact published `create-drever`
version. The
preparation job installs the release and reduces it to inert authoring context.
A fresh secret-bearing runner downloads that context into quarantine and
rebuilds it again from an exact regular-file allowlist before starting the
provider runner. Codex receives `OPENAI_API_KEY` through the pinned official
Action and uses its protected proxy plus a shell-denial hook. Claude Code is
pinned separately, runs in bare mode inside a read-only container, and reaches
the Anthropic API only through a bounded loopback proxy that holds
`CLAUDE_API_KEY`; the container sees a disposable proxy token instead of the
real credential. Its available tools are limited to direct file reads and
edits, with shell, network tools, subagents, skills, and MCP removed. Both
providers receive the exact prompt, project contract, and provider-native
skills as preloaded context. Before every resumed turn, the harness rejects new
executable configuration, symlinks, or changes to its immutable instructions.
The final authoring turn first inventories every slide's visible static
heading, makes the normalized headings unique, and keeps any repeated closing
refrain as supporting copy beneath a distinct title. It then rereads the
literal MDX, JSX, imports, and expressions for source-level syntax defects
before handing the result off.
Generated project code cannot execute in either credential-bearing job. A
separate job with no model secret installs each generated project, runs
`drever context`, checks and builds it in a digest-pinned, non-root,
no-network container, and loads the audience, document, and speaker routes in
Chromium. The browser audit traverses every exact audience slide and Step route,
checks the active state identity, samples each adjacent transition and settled
frame, and rejects material clipping or a large Step layout rebase before the
result can be published. The guided journey must also produce speaker notes.

When this validation reports an authored or rendered defect, the workflow
returns its bounded, sanitized diagnostics to the same provider for exactly one
narrow repair turn. That turn can read and edit only the allowlisted source,
cannot run commands or network tools, and is explicitly forbidden from
weakening or bypassing a check. Cases that already passed make no second model
call and reuse their verified build. A second keyless build validates repaired
source; any remaining failure stops publication rather than starting another
repair loop. Unclassified runner, container, browser-infrastructure, artifact,
or provenance failures stop immediately and never spend a repair call. The
original conversation remains intact, with the repair turn and validation
summary appended to its public provenance.

Successful runs retain both sanitized conversations, source allowlists, build
receipts, and real interactive static decks—never screenshots. A final job
with no model secret assembles those generated files in its disposable Actions
workspace and uploads them to the dedicated `drever-release-smoke` Cloudflare
Pages Direct Upload project. It first publishes a run-specific deck deployment,
replaces the predictable branch alias with Cloudflare's unique hash URL, and
then hydrates the recent manifest and small `run.json` records from the current
report and the pinned migration archive. Historical deck trees are not copied:
each retained run record continues to point at its own immutable Pages
deployment. The new run is prepended before the pinned report becomes the
project's latest production deployment, keeping recent release-smoke runs
directly selectable on the public website. Before publishing the workflow
summary, the job fetches the report, run record, audience view, document view,
and authored source from those exact origins and rechecks the release and
harness provenance.

Generated decks, source, transcripts, and receipts are build artifacts, not
repository source. None are committed to Git. The Pages deployment is the
directly browsable record; a 30-day GitHub Actions artifact is retained only as
a downloadable diagnostic bundle. The workflow adds the immutable report URL
to the matching GitHub Release, and the public website loads the latest report
from the isolated Pages origin at runtime. Cloudflare's unique deployment URL
is the durable review link and remains available until it is explicitly
deleted.

Create a Cloudflare API token limited to **Account → Cloudflare Pages → Edit**
for the Drever account, then add these repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The publisher creates the `drever-release-smoke` Direct Upload project on its
first run, with `main` as the production branch. Keep the existing
`drever-website` project Git-integrated; Pages does not add Git integration to
an existing Direct Upload project, so the smoke evidence intentionally uses a
separate project.

Create a protected GitHub environment named `ai-release-smoke`, limit it to
the `main` branch, and add a required reviewer. Only the single authorization
job enters that environment. Drever reuses the repository's existing
`OPENAI_API_KEY` and `CLAUDE_API_KEY`; each secret is referenced only by its
matching initial-generation step and its conditional one-repair step.
Preparation, other-provider work, validation, final build, and publishing
cannot read it. Do not expose either key at job scope. The result publisher
uses a Markdown summary file rather than raw terminal output so ANSI control
sequences and raw logs cannot enter the workflow summary.

## One-time npm bootstrap

npm Trusted Publishing can only be configured after a package exists. The
current package set is already bootstrapped except when a change introduces a
new public name. For example, consolidating the official design studies
requires one initial publication of `@drever/designs`; the retired
`@drever/theme-*` packages are not part of later lockstep releases. Repository
visibility does not block npm publication: a private repository can complete
this bootstrap and use Trusted Publishing. Keeping it private only removes npm
provenance and, depending on the GitHub plan, some environment protection
rules.

The same bootstrap rule applies whenever a later change adds a public package.
Create every new package name with one temporary-token commit release,
configure and verify its Trusted Publisher, remove the token, and only then
dispatch a named `next` or `latest` release. Do not start a lockstep named
release while one package is still absent from npm: multi-package publication
is retryable, but it is not transactional. The publish preflight deliberately
rejects a missing package name before uploading any tarball.

1. Enable 2FA on the npm maintainer account.
2. Create a GitHub environment named `npm`. A private repository can publish
   through Trusted Publishing, but npm provenance is available only after the
   repository is public. When the repository is public, add a required reviewer,
   a `main` deployment branch rule, a separate `v*` deployment tag rule, and a
   GitHub tag ruleset for `v*`.
3. Dispatch a `commit` release. The audit job packs and retains the complete
   release artifact, then deliberately stops at the registry preflight and
   names every package that still needs bootstrapping.
4. Download the retained artifact, verify its `release.json`, and publish only
   the named missing tarballs with `--access public` and the `commit` tag from a
   neutral temporary directory. Prefer an interactive npm login with 2FA. If a
   short-lived bootstrap token is unavoidable, keep it local and never add it
   to the workflow, repository, or GitHub secrets. npm cannot grant
   package-specific access to a name that does not exist yet.
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
   additional 2FA checks for five minutes. The script paces requests within
   that verification window, first inspects the complete package set, skips
   exact matches, refuses to replace a conflicting policy, creates missing
   policies, and then reads all policies back from npm. A partial network
   failure is safe to resume by running the same command again. To perform a
   read-only audit, pass `--verify-only`.

6. Revoke the bootstrap token immediately when one was used.
7. Set each package's publishing access to **Require two-factor authentication
   and disallow tokens**.
8. Rerun the failed workflow jobs. The audit reproduces the same artifact, the
   registry preflight now passes, and the publish job verifies and skips the
   bootstrapped tarballs before publishing the remaining package set through
   OIDC. If the repository is public, confirm that npm shows provenance from
   the GitHub workflow.

Trusted Publishing requires the repository URL in each package manifest to
match the GitHub repository. The workflow filename and environment name are
also exact, case-sensitive parts of npm's trust policy.

## Release recovery

npm publication across multiple packages is not transactional. If only the
publish job fails, use **Re-run failed jobs** so it downloads the exact audited
artifact. A full rerun for the same commit is also safe because the pack is
reproducible. Matching versions are verified and skipped; missing packages
continue in dependency order. A version with different integrity stops the
workflow. If only GitHub Release creation fails, rerun that final job; an
existing matching tag and prerelease state have their notes repaired from the
audited artifact, while a conflicting record stops the workflow.

Do not unpublish a broken release by default. npm never allows the same
name/version pair to be reused. Publish a corrected version and deprecate the
broken one when necessary.

The release process must not use `postinstall` scripts to modify user files or
install Playwright Chromium. PDF browser installation remains an explicit,
recoverable delivery step owned by `drever browser install`, which resolves the
CLI's installed Playwright Core version rather than asking a package runner to
select one.

## References

- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm provenance](https://docs.npmjs.com/generating-provenance-statements/)
- [npm dist-tags](https://docs.npmjs.com/cli/dist-tag/)
- [pnpm workspace package publishing](https://pnpm.io/workspaces#publishing-workspace-packages)
- [Vite+ continuous integration](https://viteplus.dev/guide/ci)
- [Cloudflare Pages preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
