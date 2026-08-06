export const DraftFailure = (): null => {
  if (new URLSearchParams(globalThis.location.search).has("broken-draft")) {
    throw new TypeError("The authored draft component failed intentionally.");
  }
  return null;
};
