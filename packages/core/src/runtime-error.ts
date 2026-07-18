import type { JsonObject } from "@drever/schema";

export class DreverRuntimeError extends Error {
  readonly code: string;
  readonly details?: JsonObject;

  constructor(code: string, message: string, details?: JsonObject) {
    super(message);
    this.name = "DreverRuntimeError";
    this.code = code;
    if (details !== undefined) {
      this.details = Object.freeze({ ...details });
    }
  }
}
