import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const numericIdentifier = String.raw`(?:0|[1-9]\d*)`;
const prereleaseIdentifier = String.raw`(?:${numericIdentifier}|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)`;
const semverSource = String.raw`${numericIdentifier}\.${numericIdentifier}\.${numericIdentifier}(?:-${prereleaseIdentifier}(?:\.${prereleaseIdentifier})*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?`;
const semverPattern = new RegExp(`^${semverSource}$`, "u");
const releaseHeadingPattern = new RegExp(
  String.raw`^## \[(${semverSource})\] - (\d{4}-\d{2}-\d{2})$`,
  "u",
);
const headingLikePattern = /^ {0,3}##(?!#)/u;
const referenceDefinitionPattern = /^ {0,3}\[[^\]]+\]:[ \t]*\S/u;
const bulletPattern = /^ {0,3}[-+*][ \t]+\S/u;

const isValidDate = (date) => {
  const [year, month, day] = date.split("-").map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
};

const fencedLines = (lines) => {
  let fence;

  return lines.map((line) => {
    if (fence !== undefined) {
      const closing = line.match(/^ {0,3}([`~]+)[ \t]*$/u)?.[1];
      if (closing !== undefined && closing[0] === fence.marker && closing.length >= fence.length) {
        fence = undefined;
      }
      return true;
    }

    const opening = line.match(/^ {0,3}(`{3,}|~{3,})/u)?.[1];
    if (opening === undefined) return false;
    fence = { marker: opening[0], length: opening.length };
    return true;
  });
};

const parseHeading = (line, lineNumber) => {
  if (line === "## [Unreleased]") {
    return { section: "Unreleased" };
  }

  const match = line.match(releaseHeadingPattern);
  if (match !== null && isValidDate(match[2])) {
    return { section: match[1], date: match[2] };
  }

  if (headingLikePattern.test(line)) {
    throw new Error(`Malformed changelog heading on line ${lineNumber}: ${line}`);
  }
};

export function parseChangelog(source) {
  if (typeof source !== "string") throw new TypeError("Changelog source must be a string.");

  const lines = source.split(/\r?\n/u);
  const isFenced = fencedLines(lines);
  const headings = [];
  const sections = new Set();

  for (const [index, line] of lines.entries()) {
    if (isFenced[index]) continue;
    const heading = parseHeading(line, index + 1);
    if (heading === undefined) continue;
    if (sections.has(heading.section)) {
      throw new Error(`Duplicate changelog heading: [${heading.section}].`);
    }
    sections.add(heading.section);
    headings.push({ ...heading, line: index });
  }

  return headings.map((heading, index) => {
    const contentStart = heading.line + 1;
    const nextHeading = headings[index + 1]?.line ?? lines.length;
    let contentEnd = nextHeading;

    for (let line = contentStart; line < nextHeading; line += 1) {
      if (!isFenced[line] && referenceDefinitionPattern.test(lines[line])) {
        contentEnd = line;
        break;
      }
    }

    return {
      section: heading.section,
      ...(heading.date === undefined ? {} : { date: heading.date }),
      body: lines.slice(contentStart, contentEnd).join("\n").trim(),
      hasBullet: lines
        .slice(contentStart, contentEnd)
        .some((line, offset) => !isFenced[contentStart + offset] && bulletPattern.test(line)),
    };
  });
}

export function extractChangelogSection(source, selectedSection) {
  if (
    selectedSection !== "Unreleased" &&
    (typeof selectedSection !== "string" || !semverPattern.test(selectedSection))
  ) {
    throw new Error(`Invalid changelog section: ${String(selectedSection)}.`);
  }

  const section = parseChangelog(source).find(({ section }) => section === selectedSection);
  if (section === undefined) {
    throw new Error(`Changelog section [${selectedSection}] was not found.`);
  }
  if (!section.hasBullet) {
    throw new Error(`Changelog section [${selectedSection}] must contain at least one bullet.`);
  }
  return section.body;
}

const usage = "Usage: node scripts/changelog.mjs extract SECTION [PATH]";

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const [command, section, path = "CHANGELOG.md", ...extra] = process.argv.slice(2);
  if (command !== "extract" || section === undefined || extra.length > 0) {
    throw new Error(usage);
  }
  process.stdout.write(
    `${extractChangelogSection(await readFile(resolve(path), "utf8"), section)}\n`,
  );
}
