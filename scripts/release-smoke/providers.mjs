export const releaseSmokeProviders = Object.freeze([
  Object.freeze({
    agent: "codex",
    id: "codex",
    label: "Codex",
    model: "gpt-5.6-sol",
  }),
  Object.freeze({
    agent: "claude",
    id: "claude",
    label: "Claude",
    model: "claude-opus-5",
  }),
]);

export const getReleaseSmokeProvider = (id) => {
  const provider = releaseSmokeProviders.find((candidate) => candidate.id === id);
  if (provider === undefined) throw new Error(`Unknown release smoke provider: ${id}`);
  return provider;
};

export const releaseSmokeCaseId = (providerId, scenarioId) => {
  getReleaseSmokeProvider(providerId);
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(scenarioId)) {
    throw new Error(`Invalid release smoke scenario id: ${scenarioId}`);
  }
  return `${providerId}-${scenarioId}`;
};
