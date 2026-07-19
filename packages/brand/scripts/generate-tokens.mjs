import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceUrl = new URL("../tokens.json", import.meta.url);
const cssUrl = new URL("../tokens.css", import.meta.url);
const typescriptUrl = new URL("../src/generated-tokens.ts", import.meta.url);
const tokenName = /^[a-z][a-zA-Z0-9]*$/u;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cssFontFamily(value, path) {
  const families = typeof value === "string" ? [value] : value;
  assert(Array.isArray(families) && families.length > 0, `${path} must define a font family.`);

  const generics = new Set([
    "cursive",
    "fantasy",
    "monospace",
    "sans-serif",
    "serif",
    "system-ui",
    "ui-monospace",
  ]);
  return families
    .map((family) => {
      assert(
        typeof family === "string" && family.length > 0,
        `${path} contains an invalid font family.`,
      );
      return generics.has(family) ? family : JSON.stringify(family);
    })
    .join(", ");
}

function cssColor(value, path) {
  assert(isRecord(value), `${path} must define an sRGB color object.`);
  assert(value.colorSpace === "srgb", `${path} must use the sRGB color space.`);
  assert(
    Array.isArray(value.components) && value.components.length === 3,
    `${path} must contain three sRGB components.`,
  );
  assert(
    value.components.every(
      (component) => typeof component === "number" && component >= 0 && component <= 1,
    ),
    `${path} contains an invalid sRGB component.`,
  );
  assert(value.alpha === undefined || value.alpha === 1, `${path} must define an opaque color.`);
  assert(
    typeof value.hex === "string" && /^#[\dA-F]{6}$/u.test(value.hex),
    `${path} must include an uppercase six-digit hex fallback.`,
  );

  const fallbackComponents = value.hex
    .slice(1)
    .match(/.{2}/gu)
    .map((component) => Number.parseInt(component, 16) / 255);
  assert(
    value.components.every(
      (component, index) => Math.abs(component - fallbackComponents[index]) <= 0.5 / 255,
    ),
    `${path} has components that do not match its hex fallback.`,
  );
  return value.hex;
}

export function toCssValue(type, value, path = "token") {
  if (type === "color") return cssColor(value, path);
  if (type === "fontFamily") return cssFontFamily(value, path);

  if (type === "dimension" || type === "duration") {
    assert(
      isRecord(value) && typeof value.value === "number" && Number.isFinite(value.value),
      `${path} must define a finite value.`,
    );
    const allowedUnits = type === "dimension" ? ["px", "rem"] : ["ms", "s"];
    assert(
      typeof value.unit === "string" && allowedUnits.includes(value.unit),
      `${path} uses an invalid ${type} unit.`,
    );
    return `${value.value}${value.unit}`;
  }

  if (type === "fontWeight") {
    assert(
      typeof value === "number" && value >= 1 && value <= 1000,
      `${path} must define a font weight from 1 to 1000.`,
    );
    return String(value);
  }

  if (type === "number") {
    assert(
      typeof value === "number" && Number.isFinite(value),
      `${path} must define a finite number.`,
    );
    return String(value);
  }

  if (type === "cubicBezier") {
    assert(
      Array.isArray(value) && value.length === 4 && value.every(Number.isFinite),
      `${path} must define four Bézier coordinates.`,
    );
    assert(
      value[0] >= 0 && value[0] <= 1 && value[2] >= 0 && value[2] <= 1,
      `${path} contains an invalid Bézier x coordinate.`,
    );
    return `cubic-bezier(${value.join(", ")})`;
  }

  throw new Error(`${path} uses unsupported token type ${JSON.stringify(type)}.`);
}

export function collectTokens(document) {
  assert(isRecord(document), "The token document must be an object.");
  const tokens = [];

  function visit(node, path, inheritedType) {
    assert(isRecord(node), `${path.join(".") || "root"} must be an object.`);

    if (Object.hasOwn(node, "$value")) {
      const type = node.$type ?? inheritedType;
      assert(typeof type === "string" && type.length > 0, `${path.join(".")} has no token type.`);
      const name = path.join(".");
      tokens.push({ name, type, value: toCssValue(type, node.$value, name) });
      return;
    }

    const type = typeof node.$type === "string" ? node.$type : inheritedType;
    for (const [name, child] of Object.entries(node)) {
      if (name.startsWith("$")) continue;
      assert(tokenName.test(name), `${[...path, name].join(".")} has an invalid token name.`);
      visit(child, [...path, name], type);
    }
  }

  visit(document, [], undefined);
  assert(tokens.length > 0, "The token document is empty.");

  const cssNames = new Map();
  for (const { name } of tokens) {
    const cssName = kebabCase(name);
    const conflictingName = cssNames.get(cssName);
    assert(
      conflictingName === undefined,
      `${name} and ${conflictingName} normalize to the same CSS property.`,
    );
    cssNames.set(cssName, name);
  }
  return tokens;
}

function kebabCase(value) {
  return value
    .replace(/([a-z\d])([A-Z])/gu, "$1-$2")
    .replaceAll(".", "-")
    .toLowerCase();
}

export function renderCss(tokens) {
  const declarations = tokens.map(({ name, value }) => {
    const property = `--drever-brand-${kebabCase(name)}`;
    const cssValue = value.startsWith("#") ? value.toLowerCase() : value;
    const declaration = `  ${property}: ${cssValue};`;
    return declaration.length > 100 ? `  ${property}:\n    ${cssValue};` : declaration;
  });
  return `/* Generated from tokens.json. Run \`vp run -F @drever/brand generate\` to update. */\n:root {\n${declarations.join("\n")}\n}\n`;
}

export function renderTypescript(tokens) {
  const flat = Object.fromEntries(tokens.map(({ name, value }) => [name, value]));
  const nested = Object.create(null);

  for (const { name, value } of tokens) {
    const parts = name.split(".");
    let cursor = nested;
    for (const part of parts.slice(0, -1)) {
      if (!Object.hasOwn(cursor, part)) cursor[part] = Object.create(null);
      cursor = cursor[part];
    }
    cursor[parts.at(-1)] = value;
  }

  function renderObject(value, depth = 0) {
    const indentation = "  ".repeat(depth);
    const entries = Object.entries(value).map(([key, child]) => {
      const property = /^[A-Za-z_$][\w$]*$/u.test(key) ? key : JSON.stringify(key);
      const rendered = isRecord(child)
        ? renderObject(child, depth + 1)
        : typeof child === "string" && child.includes('"') && !child.includes("'")
          ? `'${child}'`
          : JSON.stringify(child);
      return `${"  ".repeat(depth + 1)}${property}: ${rendered},`;
    });
    return `{\n${entries.join("\n")}\n${indentation}}`;
  }

  const flatEntries = Object.keys(flat).map(
    (name) => `  ${JSON.stringify(name)}: brandTokens.${name},`,
  );

  return `// Generated from tokens.json. Run \`vp run -F @drever/brand generate\` to update.\n\nexport const brandTokens = ${renderObject(nested)} as const;\n\nexport const brandTokenValues = {\n${flatEntries.join("\n")}\n} as const;\n\nexport type BrandTokenPath = keyof typeof brandTokenValues;\nexport type BrandTokens = typeof brandTokens;\n`;
}

async function generate({ check }) {
  const source = JSON.parse(await readFile(sourceUrl, "utf8"));
  const tokens = collectTokens(source);
  const outputs = [
    [cssUrl, renderCss(tokens)],
    [typescriptUrl, renderTypescript(tokens)],
  ];

  for (const [url, expected] of outputs) {
    if (check) {
      const actual = await readFile(url, "utf8").catch(() => "");
      assert(actual === expected, `${fileURLToPath(url)} is stale. Run the brand token generator.`);
    } else {
      await writeFile(url, expected);
    }
  }
}

const entry =
  process.argv[1] === undefined ? undefined : pathToFileURL(resolve(process.argv[1])).href;
if (entry === import.meta.url) {
  await generate({ check: process.argv.includes("--check") }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export { packageRoot };
