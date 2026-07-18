export type JsonPrimitive = null | boolean | number | string;

export type JsonArray = readonly JsonValue[];

export type JsonObject = Readonly<{
  [key: string]: JsonValue;
}>;

export type JsonValue = JsonPrimitive | JsonArray | JsonObject;
