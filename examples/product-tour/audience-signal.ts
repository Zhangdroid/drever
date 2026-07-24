import { useSyncExternalStore } from "react";

export type SignalId = "evidence" | "explore" | "risk";

let selectedSignal: SignalId | undefined;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const selectAudienceSignal = (signal: SignalId): void => {
  selectedSignal = signal;
  listeners.forEach((listener) => listener());
};

export const useAudienceSignal = (): SignalId | undefined =>
  useSyncExternalStore(
    subscribe,
    () => selectedSignal,
    () => undefined,
  );
