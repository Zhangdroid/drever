import type { JsonObject, JsonValue } from "@drever/schema";

const cloneAndFreeze = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => cloneAndFreeze(item)));
  }
  if (typeof value === "object" && value !== null) {
    return Object.freeze(
      Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneAndFreeze(child)])),
    );
  }
  return value;
};

export const snapshotJson = <Value extends JsonValue>(value: Value): Value =>
  cloneAndFreeze(value) as Value;

export const EMPTY_CONFIG: JsonObject = Object.freeze({});
