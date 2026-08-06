import { parseDeck } from "@drever/compiler";
import type { Diagnostic, SourcePoint, SourceRange } from "@drever/schema";
import { readFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";

type StyleImport = Readonly<{
  end: number;
  specifier: string;
  start: number;
}>;

type SourceFile = Readonly<{
  path: string;
  source: string;
}>;

export type CheckStyleSourcesOptions = Readonly<{
  entry: string;
  root: string;
  source: string;
}>;

const unsupportedSchemes = new Set(["blob", "data", "javascript"]);
const scriptExtensions = [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".cjs", ".cts"];
const supportedExtensions = new Set([".css", ...scriptExtensions]);

const pointLocator = (source: string): ((offset: number) => SourcePoint) => {
  const lineStarts = [0];
  for (let offset = 0; offset < source.length; offset += 1) {
    if (source[offset] === "\n") lineStarts.push(offset + 1);
  }
  return (offset) => {
    let lower = 0;
    let upper = lineStarts.length;
    while (lower + 1 < upper) {
      const middle = Math.floor((lower + upper) / 2);
      if ((lineStarts[middle] ?? 0) <= offset) lower = middle;
      else upper = middle;
    }
    return {
      line: lower + 1,
      column: offset - (lineStarts[lower] ?? 0) + 1,
      offset,
    };
  };
};

const sourceRange = (path: string, source: string, start: number, end: number): SourceRange => {
  const locate = pointLocator(source);
  return { path, start: locate(start), end: locate(end) };
};

const skipWhitespace = (source: string, initial: number): number => {
  let offset = initial;
  while (/\s/u.test(source[offset] ?? "")) offset += 1;
  return offset;
};

const skipLineComment = (source: string, start: number): number => {
  const end = source.indexOf("\n", start + 2);
  return end < 0 ? source.length : end + 1;
};

const skipBlockComment = (source: string, start: number): number => {
  const end = source.indexOf("*/", start + 2);
  return end < 0 ? source.length : end + 2;
};

const skipTrivia = (source: string, initial: number): number => {
  let offset = initial;
  while (offset < source.length) {
    const whitespaceEnd = skipWhitespace(source, offset);
    if (whitespaceEnd !== offset) {
      offset = whitespaceEnd;
      continue;
    }
    if (source.startsWith("//", offset)) {
      offset = skipLineComment(source, offset);
      continue;
    }
    if (source.startsWith("/*", offset)) {
      offset = skipBlockComment(source, offset);
      continue;
    }
    break;
  }
  return offset;
};

const quotedImport = (source: string, start: number): StyleImport | undefined => {
  const quote = source[start];
  if (quote !== '"' && quote !== "'") return;
  let offset = start + 1;
  while (offset < source.length) {
    if (source[offset] === "\\") {
      offset += 2;
      continue;
    }
    if (source[offset] === quote) {
      return { start: start + 1, end: offset, specifier: source.slice(start + 1, offset) };
    }
    offset += 1;
  }
};

const skipTemplate = (source: string, start: number): number => {
  let offset = start + 1;
  while (offset < source.length) {
    if (source[offset] === "\\") {
      offset += 2;
      continue;
    }
    if (source[offset] === "`") return offset + 1;
    offset += 1;
  }
  return source.length;
};

const identifier = (
  source: string,
  start: number,
): Readonly<{ end: number; value: string }> | undefined => {
  if (!/[A-Z_a-z$]/u.test(source[start] ?? "")) return;
  let end = start + 1;
  while (/[\w$]/u.test(source[end] ?? "")) end += 1;
  return { end, value: source.slice(start, end) };
};

const fromSpecifier = (source: string, start: number): StyleImport | undefined => {
  let depth = 0;
  let offset = start;
  while (offset < source.length) {
    offset = skipTrivia(source, offset);
    const character = source[offset];
    if (character === undefined || (character === ";" && depth === 0)) return;
    if (character === '"' || character === "'") {
      const quoted = quotedImport(source, offset);
      offset = quoted === undefined ? source.length : quoted.end + 1;
      continue;
    }
    if (character === "`") {
      offset = skipTemplate(source, offset);
      continue;
    }
    if ("{[(".includes(character)) {
      depth += 1;
      offset += 1;
      continue;
    }
    if ("}])".includes(character)) {
      depth = Math.max(0, depth - 1);
      offset += 1;
      continue;
    }
    const token = identifier(source, offset);
    if (token === undefined) {
      offset += 1;
      continue;
    }
    if (token.value === "from" && depth === 0) {
      return quotedImport(source, skipTrivia(source, token.end));
    }
    if ((token.value === "import" || token.value === "export") && depth === 0) return;
    offset = token.end;
  }
};

const canReexport = (source: string, start: number): boolean => {
  const offset = skipTrivia(source, start);
  if (source[offset] === "*" || source[offset] === "{") return true;
  const token = identifier(source, offset);
  return token?.value === "type" && source[skipTrivia(source, token.end)] === "{";
};

const moduleImports = (source: string): readonly StyleImport[] => {
  const imports: StyleImport[] = [];
  let offset = 0;
  while (offset < source.length) {
    if (source.startsWith("//", offset)) {
      offset = skipLineComment(source, offset);
      continue;
    }
    if (source.startsWith("/*", offset)) {
      offset = skipBlockComment(source, offset);
      continue;
    }
    const character = source[offset];
    if (character === '"' || character === "'") {
      const quoted = quotedImport(source, offset);
      offset = quoted === undefined ? source.length : quoted.end + 1;
      continue;
    }
    if (character === "`") {
      offset = skipTemplate(source, offset);
      continue;
    }
    const token = identifier(source, offset);
    if (token === undefined) {
      offset += 1;
      continue;
    }
    offset = token.end;
    if (token.value !== "import" && token.value !== "export") continue;

    const afterKeyword = skipTrivia(source, offset);
    if (token.value === "export" && !canReexport(source, offset)) continue;
    if (token.value === "import" && source[afterKeyword] === "(") continue;
    const imported =
      token.value === "import" && (source[afterKeyword] === '"' || source[afterKeyword] === "'")
        ? quotedImport(source, afterKeyword)
        : fromSpecifier(source, afterKeyword);
    if (imported !== undefined) imports.push(imported);
  }
  return imports;
};

const urlImport = (source: string, start: number): StyleImport | undefined => {
  if (source.slice(start, start + 3).toLowerCase() !== "url") return;
  const opening = skipWhitespace(source, start + 3);
  if (source[opening] !== "(") return;
  const valueStart = skipWhitespace(source, opening + 1);
  const quoted = quotedImport(source, valueStart);
  if (quoted !== undefined) return quoted;

  const closing = source.indexOf(")", valueStart);
  if (closing < 0) return;
  let end = closing;
  while (end > valueStart && /\s/u.test(source[end - 1] ?? "")) end -= 1;
  return { start: valueStart, end, specifier: source.slice(valueStart, end) };
};

const cssImports = (source: string): readonly StyleImport[] => {
  const imports: StyleImport[] = [];
  let offset = 0;
  while (offset < source.length) {
    if (source.startsWith("/*", offset)) {
      const closing = source.indexOf("*/", offset + 2);
      offset = closing < 0 ? source.length : closing + 2;
      continue;
    }
    if (source[offset] === '"' || source[offset] === "'") {
      const quoted = quotedImport(source, offset);
      offset = quoted === undefined ? source.length : quoted.end + 1;
      continue;
    }
    if (source[offset] !== "@" || source.slice(offset, offset + 7).toLowerCase() !== "@import") {
      offset += 1;
      continue;
    }
    const afterKeyword = offset + 7;
    if (!/\s/u.test(source[afterKeyword] ?? "")) {
      offset = afterKeyword;
      continue;
    }
    const valueStart = skipWhitespace(source, afterKeyword);
    const imported = quotedImport(source, valueStart) ?? urlImport(source, valueStart);
    if (imported !== undefined) imports.push(imported);
    offset = imported === undefined ? afterKeyword : imported.end + 1;
  }
  return imports;
};

const schemeOf = (specifier: string): string | undefined =>
  /^([a-z][a-z\d+.-]*):/iu.exec(specifier.trim())?.[1]?.toLowerCase();

const insideRoot = (root: string, path: string): boolean => {
  const relation = relative(root, path);
  return (
    relation === "" || (!isAbsolute(relation) && relation !== ".." && !relation.startsWith("../"))
  );
};

const localSourceCandidates = (
  specifier: string,
  importer: string,
  root: string,
  kind: "css" | "module",
): readonly string[] => {
  const clean = specifier.split(/[?#]/u, 1)[0];
  if (clean === undefined || (!clean.startsWith("./") && !clean.startsWith("../"))) return [];
  const base = resolve(dirname(importer), clean);
  if (!insideRoot(root, base)) return [];
  const extension = extname(base).toLowerCase();
  if (extension.length > 0) return supportedExtensions.has(extension) ? [base] : [];
  const extensions = kind === "css" ? [".css"] : scriptExtensions;
  return [
    ...extensions.map((suffix) => `${base}${suffix}`),
    ...extensions.map((suffix) => resolve(base, `index${suffix}`)),
  ];
};

const unsupportedImportDiagnostic = (
  path: string,
  source: string,
  imported: StyleImport,
  scheme: string,
): Diagnostic => ({
  code: "DREVER_CSS_IMPORT_SCHEME_UNSUPPORTED",
  severity: "error",
  stage: "bundle",
  message: `CSS @import cannot use the ${scheme}: URL scheme.`,
  hint: "Write the CSS in a project file and import that file with a relative path.",
  source: sourceRange(path, source, imported.start, imported.end),
  details: { scheme, specifier: imported.specifier },
});

const readSource = async (path: string): Promise<string | undefined> => {
  try {
    return await readFile(path, "utf8");
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EISDIR") return;
    throw cause;
  }
};

const loadImportedSource = async (
  specifier: string,
  importer: string,
  root: string,
  kind: "css" | "module",
): Promise<SourceFile | undefined> => {
  for (const path of localSourceCandidates(specifier, importer, root, kind)) {
    const source = await readSource(path);
    if (source !== undefined) return { path, source };
  }
};

const entrySources = async (entry: string, root: string, source: string): Promise<SourceFile[]> => {
  const parsed = parseDeck(source, { path: entry });
  if (!parsed.ok) return [];
  const files: SourceFile[] = [];
  for (const fragment of parsed.value.preamble) {
    for (const imported of moduleImports(fragment.value)) {
      const file = await loadImportedSource(imported.specifier, entry, root, "module");
      if (file !== undefined) files.push(file);
    }
  }
  return files;
};

/** Checks project-local CSS reached from the deck before Vite tries to transform it. */
export const checkStyleSources = async ({
  entry,
  root,
  source,
}: CheckStyleSourcesOptions): Promise<readonly Diagnostic[]> => {
  const pending = await entrySources(entry, root, source);
  const visited = new Set<string>();
  const diagnostics: Diagnostic[] = [];

  while (pending.length > 0) {
    const file = pending.shift();
    if (file === undefined || visited.has(file.path)) continue;
    visited.add(file.path);

    if (extname(file.path).toLowerCase() === ".css") {
      for (const imported of cssImports(file.source)) {
        const scheme = schemeOf(imported.specifier);
        if (scheme !== undefined && unsupportedSchemes.has(scheme)) {
          diagnostics.push(unsupportedImportDiagnostic(file.path, file.source, imported, scheme));
          continue;
        }
        const nested = await loadImportedSource(imported.specifier, file.path, root, "css");
        if (nested !== undefined) pending.push(nested);
      }
      continue;
    }

    for (const imported of moduleImports(file.source)) {
      const nested = await loadImportedSource(imported.specifier, file.path, root, "module");
      if (nested !== undefined) pending.push(nested);
    }
  }

  return diagnostics;
};
