export const RELEASE_SMOKE_CLAUDE_BUDGET_USD = 15;
export const RELEASE_SMOKE_CLAUDE_MAX_TURNS = 80;
export const RELEASE_SMOKE_CLAUDE_PROXY_TIMEOUT_MS = 21 * 60_000;
export const RELEASE_SMOKE_CLAUDE_SCENARIO_TIMEOUT_MS = 35 * 60_000;
export const RELEASE_SMOKE_CLAUDE_TURN_TIMEOUT_MS = 20 * 60_000;
export const RELEASE_SMOKE_DEFAULT_TURN_TIMEOUT_MS = 12 * 60_000;

export const resolveReleaseSmokeTurnTimeout = ({ providerId, remainingScenarioMs }) => {
  if (providerId !== "claude") return RELEASE_SMOKE_DEFAULT_TURN_TIMEOUT_MS;
  if (!Number.isFinite(remainingScenarioMs) || remainingScenarioMs <= 0) {
    throw new Error("Claude exceeded the release smoke scenario time limit.");
  }
  return Math.min(RELEASE_SMOKE_CLAUDE_TURN_TIMEOUT_MS, remainingScenarioMs);
};

export const releaseSmokeTimeoutMessage = ({
  providerId,
  providerLabel,
  timeoutMs,
  turnCount,
  turnNumber,
}) => {
  const limit =
    providerId === "claude" && timeoutMs < RELEASE_SMOKE_CLAUDE_TURN_TIMEOUT_MS
      ? "35-minute scenario deadline"
      : `${String(Math.round(timeoutMs / 60_000))}-minute turn limit`;
  return `${providerLabel} exceeded the ${limit} during turn ${String(turnNumber)} of ${String(turnCount)}.`;
};
