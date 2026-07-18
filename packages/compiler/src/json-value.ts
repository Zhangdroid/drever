type JsonIssue = Readonly<{
  path: string;
  reason: string;
}>;

const joinPath = (path: string, key: string | number): string =>
  typeof key === "number" ? `${path}[${key}]` : `${path}.${key}`;

const findIssue = (value: unknown, path: string, ancestors: Set<object>): JsonIssue | undefined => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { path, reason: "numbers must be finite" };
    }
    return Object.is(value, -0)
      ? { path, reason: "negative zero is not canonical JSON" }
      : undefined;
  }

  if (typeof value !== "object") {
    return { path, reason: `${typeof value} values are not JSON-safe` };
  }

  if (ancestors.has(value)) {
    return { path, reason: "circular references are not JSON-safe" };
  }

  ancestors.add(value);
  try {
    if (Object.getOwnPropertySymbols(value).length > 0) {
      return { path, reason: "symbol keys are not JSON-safe" };
    }

    if (Array.isArray(value)) {
      const propertyNames = Object.getOwnPropertyNames(value);
      const extraProperty = propertyNames.find((key) => {
        if (key === "length") {
          return false;
        }
        return !/^(0|[1-9]\d*)$/u.test(key) || Number(key) >= value.length;
      });
      if (extraProperty) {
        return {
          path: joinPath(path, extraProperty),
          reason: "extra array properties are not JSON-safe",
        };
      }

      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor) {
          return { path: joinPath(path, index), reason: "sparse array entries are not JSON-safe" };
        }
        if (!("value" in descriptor)) {
          return {
            path: joinPath(path, index),
            reason: "accessor properties are not JSON-safe",
          };
        }
        if (!descriptor.enumerable) {
          return {
            path: joinPath(path, index),
            reason: "non-enumerable properties are not JSON-safe",
          };
        }
        const issue = findIssue(descriptor.value, joinPath(path, index), ancestors);
        if (issue) {
          return issue;
        }
      }
      return;
    }

    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Object.prototype && prototype !== null) {
      return { path, reason: "only plain objects are JSON-safe" };
    }

    for (const key of Object.getOwnPropertyNames(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) {
        return {
          path: joinPath(path, key),
          reason: "accessor properties are not JSON-safe",
        };
      }
      if (!descriptor.enumerable) {
        return {
          path: joinPath(path, key),
          reason: "non-enumerable properties are not JSON-safe",
        };
      }
      const issue = findIssue(descriptor.value, joinPath(path, key), ancestors);
      if (issue) {
        return issue;
      }
    }
    return;
  } finally {
    ancestors.delete(value);
  }
};

export const findJsonIssue = (value: unknown, path = "$"): JsonIssue | undefined =>
  findIssue(value, path, new Set());
