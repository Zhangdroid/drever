import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ArrowUpRightIcon, CheckIcon, PlayIcon } from "../components/icons";
import { PageHero } from "../components/page-hero";
import {
  readableReleaseSmokeMessage,
  releaseSmokeData,
  type ReleaseSmokeCase,
  type ReleaseSmokeRun,
} from "../release-smoke-data";
import { pageHead } from "../seo";

const description =
  "Codex creates new presentations from fixed briefs in clean projects. Inspect each real conversation and use the generated result.";

export const Route = createFileRoute("/release-smoke")({
  component: ReleaseSmokePage,
  head: () => pageHead("Release smoke", description, "/release-smoke"),
});

const formatDate = (timestamp: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));

const formatDuration = (seconds: number) => {
  if (seconds === 0) return "Not measured";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes === 0 ? `${remainder}s` : `${minutes}m ${remainder}s`;
};

function RunStatus({ run }: { run: ReleaseSmokeRun }) {
  const passed = run.cases.every((scenario) => scenario.status === "passed");
  return (
    <span className="release-smoke__status" data-status={passed ? "passed" : "failed"}>
      <i aria-hidden="true" />
      {passed ? "Build verified" : "Build needs attention"}
    </span>
  );
}

function RunMetadata({ run }: { run: ReleaseSmokeRun }) {
  const metadata = [
    ["Package", `drever@${run.release.version}`],
    ["Release", run.release.commit.slice(0, 8)],
    ["Harness", run.harness.commit.slice(0, 8)],
    ["Generated", `${formatDate(run.generatedAt)} UTC`],
    ["Model", run.runner.model],
    ["Codex", run.runner.codexVersion],
    ["Node", run.runner.nodeVersion],
  ];

  return (
    <dl className="release-smoke__metadata">
      {metadata.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CasePreview({ run, scenario }: { run: ReleaseSmokeRun; scenario: ReleaseSmokeCase }) {
  return (
    <>
      <section aria-labelledby="release-smoke-preview-title" className="release-smoke__preview">
        <header>
          <div>
            <span>{scenario.mode === "surprise-me" ? "Surprise me" : "Guided answers"}</span>
            <h2 id="release-smoke-preview-title">{scenario.title}</h2>
          </div>
          <p>{scenario.brief}</p>
        </header>

        <div className="release-smoke__stage">
          <iframe
            allowFullScreen
            key={`${run.id}:${scenario.id}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-presentation allow-same-origin allow-scripts"
            src={`${scenario.deck.audience}index.html`}
            title={`${scenario.title} live Drever presentation`}
          />
        </div>

        <div className="release-smoke__actions">
          <a
            className="button button--primary"
            href={`${scenario.deck.audience}index.html`}
            rel="noreferrer"
            target="_blank"
          >
            <PlayIcon /> Open live deck
          </a>
          <a
            className="button button--quiet"
            href={`${scenario.deck.document}index.html`}
            rel="noreferrer"
            target="_blank"
          >
            Read document <ArrowUpRightIcon />
          </a>
          <a
            className="button button--quiet"
            href={scenario.deck.source}
            rel="noreferrer"
            target="_blank"
          >
            View MDX <ArrowUpRightIcon />
          </a>
        </div>
      </section>

      <section
        aria-labelledby="release-smoke-conversation-title"
        className="release-smoke__evidence"
      >
        <div className="release-smoke__conversation">
          <header>
            <span>Conversation</span>
            <h2 id="release-smoke-conversation-title">The route to the result.</h2>
          </header>
          <ol>
            {scenario.messages.map((message, index) => (
              <li data-role={message.role} key={`${message.role}-${index}`}>
                <span>{message.role === "user" ? "User" : "Codex"}</span>
                <p>{readableReleaseSmokeMessage(message.content)}</p>
              </li>
            ))}
          </ol>
        </div>

        <aside className="release-smoke__checks">
          <header>
            <span>Verification</span>
            <strong>
              {scenario.status === "passed"
                ? "Build and surfaces verified"
                : "Build verification failed"}
            </strong>
          </header>
          <ul>
            {scenario.checks.map((check) => (
              <li key={check}>
                <CheckIcon />
                {check}
              </li>
            ))}
          </ul>
          <dl>
            <div>
              <dt>Run time</dt>
              <dd>{formatDuration(scenario.durationSeconds)}</dd>
            </div>
            <div>
              <dt>Prompt</dt>
              <dd>
                <a href={run.runner.promptUrl}>prompt.md</a>
              </dd>
            </div>
          </dl>
        </aside>
      </section>
    </>
  );
}

function EmptyReleaseSmokePage() {
  return (
    <main className="release-smoke" id="main" tabIndex={-1}>
      <PageHero
        description={description}
        eyebrow="Built in public"
        title="Watch the prompt become a real deck."
      >
        <div className="release-smoke__hero-proof">
          <span className="release-smoke__status" data-status="pending">
            <i aria-hidden="true" />
            Awaiting first run
          </span>
          <span>0 published journeys</span>
          <span>No fixture decks</span>
        </div>
      </PageHero>

      <section aria-labelledby="release-smoke-pending-title" className="release-smoke__pending">
        <div>
          <span>Pending evidence</span>
          <h2 id="release-smoke-pending-title">Nothing has been generated yet.</h2>
        </div>
        <div className="release-smoke__pending-copy">
          <p>
            The first release run will ask Codex to create two presentations from clean projects:
            one with guided answers and one in surprise-me mode.
          </p>
          <p>
            This page stays empty until the generated source has been installed, checked, built,
            opened in a browser, and published with its real conversation.
          </p>
          <a
            className="button button--quiet"
            href="https://github.com/Zhangdroid/drever/actions/workflows/release-smoke.yml"
            rel="noreferrer"
            target="_blank"
          >
            View workflow <ArrowUpRightIcon />
          </a>
        </div>
      </section>
    </main>
  );
}

function PublishedReleaseSmokePage({ latest }: { latest: ReleaseSmokeRun }) {
  const [selectedRunId, setSelectedRunId] = useState(latest.id);
  const selectedRun = releaseSmokeData.runs.find((run) => run.id === selectedRunId) ?? latest;
  const [selectedCaseId, setSelectedCaseId] = useState(selectedRun.cases[0]?.id ?? "");
  const selectedCase =
    selectedRun.cases.find((scenario) => scenario.id === selectedCaseId) ?? selectedRun.cases[0];
  const archivedRuns = releaseSmokeData.runs.filter((run) => run.id !== latest.id);

  if (selectedCase === undefined)
    throw new Error("A release smoke run requires at least one case.");

  const selectRun = (run: ReleaseSmokeRun) => {
    setSelectedRunId(run.id);
    setSelectedCaseId(run.cases[0]?.id ?? "");
  };

  return (
    <main className="release-smoke" id="main" tabIndex={-1}>
      <PageHero
        description={description}
        eyebrow="Built in public"
        title="Watch the prompt become a real deck."
      >
        <div className="release-smoke__hero-proof">
          <RunStatus run={selectedRun} />
          <span>{selectedRun.cases.length} real journeys</span>
          <span>Generated builds</span>
        </div>
      </PageHero>

      <section aria-labelledby="release-smoke-latest-title" className="release-smoke__run">
        <header className="release-smoke__run-heading">
          <div>
            <span>
              {selectedRun.id === latest.id
                ? selectedRun.kind === "preview"
                  ? "Preview run"
                  : "Latest run"
                : "Archived run"}
            </span>
            <h2 id="release-smoke-latest-title">
              {selectedRun.kind === "preview"
                ? `drever@${selectedRun.release.version}`
                : selectedRun.release.version}
            </h2>
          </div>
          <div className="release-smoke__run-links">
            <RunStatus run={selectedRun} />
            <a href={selectedRun.runner.workflowUrl} rel="noreferrer" target="_blank">
              {selectedRun.kind === "preview" ? "Harness" : "Workflow"} <ArrowUpRightIcon />
            </a>
            <a href={selectedRun.release.url} rel="noreferrer" target="_blank">
              Release <ArrowUpRightIcon />
            </a>
          </div>
        </header>

        <RunMetadata run={selectedRun} />
        {selectedRun.kind === "preview" ? (
          <p className="release-smoke__preview-note">
            Owner-authorized seed proof from the real harness. Automated post-release runs appear
            here after the workflow completes.
          </p>
        ) : null}

        <nav aria-label="Release smoke scenarios" className="release-smoke__cases">
          {selectedRun.cases.map((scenario, index) => (
            <button
              aria-pressed={scenario.id === selectedCase.id}
              key={scenario.id}
              onClick={() => setSelectedCaseId(scenario.id)}
              type="button"
            >
              <span>0{index + 1}</span>
              <strong>{scenario.title}</strong>
              <small>
                {scenario.mode === "surprise-me" ? "Autonomous direction" : "Answered brief"}
              </small>
            </button>
          ))}
        </nav>

        <CasePreview run={selectedRun} scenario={selectedCase} />
      </section>

      <section aria-labelledby="release-smoke-archive-title" className="release-smoke__archive">
        <header>
          <span>Archive</span>
          <h2 id="release-smoke-archive-title">Recent published runs stay inspectable.</h2>
        </header>
        {archivedRuns.length === 0 ? (
          <p className="release-smoke__archive-empty">
            Real release runs will appear here as the workflow publishes them.
          </p>
        ) : (
          <div className="release-smoke__archive-list">
            {archivedRuns.map((run) => (
              <button key={run.id} onClick={() => selectRun(run)} type="button">
                <span>{formatDate(run.generatedAt)}</span>
                <strong>{run.release.version}</strong>
                <RunStatus run={run} />
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ReleaseSmokePage() {
  return releaseSmokeData.latest === null ? (
    <EmptyReleaseSmokePage />
  ) : (
    <PublishedReleaseSmokePage latest={releaseSmokeData.latest} />
  );
}
