import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ArrowUpRightIcon, CheckIcon, PlayIcon } from "../components/icons";
import { PageHero } from "../components/page-hero";
import {
  releaseSmokeData,
  type ReleaseSmokeCase,
  type ReleaseSmokeRun,
} from "../release-smoke-data";
import { pageHead } from "../seo";

const description =
  "After each Drever release, Codex creates fixed presentations in clean projects. Inspect the conversation and use the real result.";

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
      {passed ? "Passed" : "Needs attention"}
    </span>
  );
}

function RunMetadata({ run }: { run: ReleaseSmokeRun }) {
  const metadata = [
    ["Release", run.release.version],
    ["Commit", run.release.commit === "fixture" ? "Preview data" : run.release.commit.slice(0, 8)],
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
            src={scenario.deck.audience}
            title={`${scenario.title} live Drever presentation`}
          />
        </div>

        <div className="release-smoke__actions">
          <a
            className="button button--primary"
            href={scenario.deck.audience}
            rel="noreferrer"
            target="_blank"
          >
            <PlayIcon /> Open live deck
          </a>
          <a
            className="button button--quiet"
            href={scenario.deck.document}
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
            View source <ArrowUpRightIcon />
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
                <p>{message.content}</p>
              </li>
            ))}
          </ol>
        </div>

        <aside className="release-smoke__checks">
          <header>
            <span>Verification</span>
            <strong>
              {scenario.status === "passed" ? "Required checks passed" : "Check failed"}
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

function ReleaseSmokePage() {
  const [selectedRunId, setSelectedRunId] = useState(releaseSmokeData.latest.id);
  const selectedRun =
    releaseSmokeData.runs.find((run) => run.id === selectedRunId) ?? releaseSmokeData.latest;
  const [selectedCaseId, setSelectedCaseId] = useState(selectedRun.cases[0]?.id ?? "");
  const selectedCase =
    selectedRun.cases.find((scenario) => scenario.id === selectedCaseId) ?? selectedRun.cases[0];
  const archivedRuns = releaseSmokeData.runs.filter((run) => run.id !== releaseSmokeData.latest.id);

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
          <span>{selectedRun.cases.length} fixed scenarios</span>
          <span>No screenshots</span>
        </div>
      </PageHero>

      {selectedRun.kind === "fixture" ? (
        <aside className="release-smoke__fixture">
          <strong>Preview fixture</strong>
          <p>
            This record demonstrates the reporting surface with existing Drever examples. The first
            release smoke workflow will replace it with the real Codex transcript and generated
            builds.
          </p>
        </aside>
      ) : null}

      <section aria-labelledby="release-smoke-latest-title" className="release-smoke__run">
        <header className="release-smoke__run-heading">
          <div>
            <span>
              {selectedRun.id === releaseSmokeData.latest.id ? "Latest run" : "Archived run"}
            </span>
            <h2 id="release-smoke-latest-title">{selectedRun.release.version}</h2>
          </div>
          <div className="release-smoke__run-links">
            <RunStatus run={selectedRun} />
            <a href={selectedRun.runner.workflowUrl} rel="noreferrer" target="_blank">
              Workflow <ArrowUpRightIcon />
            </a>
            <a href={selectedRun.release.url} rel="noreferrer" target="_blank">
              Release <ArrowUpRightIcon />
            </a>
          </div>
        </header>

        <RunMetadata run={selectedRun} />

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
