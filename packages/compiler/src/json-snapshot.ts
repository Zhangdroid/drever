const cloneAndFreeze = (value: unknown): unknown => {
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

export const createJsonSnapshot = <Value>(value: Value): Value => cloneAndFreeze(value) as Value;
