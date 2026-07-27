import { defineTheme } from "@drever/compiler";
import { CJK_SANS_FONT_STACKS } from "../cjk-typography.ts";

const PACKAGE = "@drever/designs/ledger";

export type LedgerRecipe = Readonly<{
  constraints: readonly string[];
  id: "auditable-evidence" | "decision-metric" | "variance-narrative";
  layout: "Evidence" | "Markdown" | "Metric";
  prompt: string;
  purpose: string;
}>;

/** Typed composition guidance for evidence-led authoring and generation tools. */
export const ledgerRecipes = [
  {
    id: "decision-metric",
    layout: "Metric",
    purpose: "Make one measure and its decision consequence unmistakable.",
    prompt:
      "Name the measure and period, show one exact value, then explain what decision the change supports.",
    constraints: [
      "One dominant measure",
      "Always label the period and unit",
      "Context at most 28 words",
    ],
  },
  {
    id: "auditable-evidence",
    layout: "Evidence",
    purpose: "Pair one conclusion with the artifact that lets the audience verify it.",
    prompt:
      "State the conclusion before showing the chart, table, code, or source artifact that supports it.",
    constraints: [
      "One inspectable artifact",
      "Interpretation at most 45 words",
      "Include provenance when available",
    ],
  },
  {
    id: "variance-narrative",
    layout: "Markdown",
    purpose: "Explain a variance through baseline, change, cause, and resulting decision.",
    prompt:
      "Write the conclusion first, then identify the baseline, material change, and action without imitating a dashboard.",
    constraints: [
      "At most one compact table",
      "At most four evidence points",
      "Do not use color as the only signal",
    ],
  },
] as const satisfies readonly LedgerRecipe[];

export const theme = defineTheme({
  kind: "theme",
  apiVersion: 1,
  id: PACKAGE,
  version: "0.0.0",
  compilerTargets: ["canonical", "browser-lite"],
  canvas: { width: 1600, height: 900 },
  tokens: {
    color: {
      canvas: "#f4f2ea",
      ink: "#18201e",
      muted: "#59635f",
      accent: "#c9432f",
      accentStrong: "#8f2d21",
      accentSoft: "#f2d9d2",
      positive: "#17664f",
      positiveSoft: "#d9ebe4",
      surface: "#fffdf7",
      border: "#c9cec8",
      grid: "#dde0da",
      codeCanvas: "#18201e",
      codeInk: "#f5f2e8",
    },
    typography: {
      display: "Arial, Helvetica Neue, Segoe UI, ui-sans-serif, system-ui, sans-serif",
      body: "Aptos, Segoe UI, Helvetica Neue, Arial, ui-sans-serif, system-ui, sans-serif",
      mono: "SFMono-Regular, Cascadia Code, Consolas, Liberation Mono, ui-monospace, monospace",
      titleSize: 72,
      bodySize: 26,
      numerals: "tabular lining",
      cjk: {
        sans: CJK_SANS_FONT_STACKS,
        titleLineHeight: 1.15,
        bodyLineHeight: 1.58,
      },
    },
    space: { slideX: 104, slideY: 78, rhythm: 22 },
    shape: { radius: 6, borderWidth: 1 },
    motion: { duration: 400, easing: "cubic-bezier(0.2, 0.75, 0.25, 1)" },
  },
  styles: [{ specifier: `${PACKAGE}/theme.css`, layer: "theme" }],
  motion: {
    id: "ledger",
    intents: ["focus", "replace", "compare", "stagger", "continuity"],
    guidance: [
      "Use focus to isolate the current finding while keeping prior evidence available for audit.",
      "Use replace for one measure or model changing against a stable baseline, and compare for evidence that remains concurrently readable.",
      "Follow the evidence structure: use block flow for a vertical audit trail and inline flow for periods, cohorts, or side-by-side variance.",
      "Ledger favors direct page commits and row-level reveals that settle quickly onto a baseline; it should feel recorded rather than performed.",
      "Use continuity only for a short audit where the same measure, chart, table, or source artifact persists into the adjacent slide.",
    ],
  },
  layouts: [
    {
      name: "Metric",
      module: { specifier: `${PACKAGE}/layouts`, exportName: "Metric" },
      description:
        "Present one decision-driving measure with its period, unit, change, benchmark, and concise interpretation.",
      slots: [
        {
          name: "label",
          purpose: "The exact name of the measure.",
          accepts: ["text"],
          required: true,
          maxItems: 1,
        },
        {
          name: "value",
          purpose: "The single dominant measured value.",
          accepts: ["text"],
          required: true,
          maxItems: 1,
        },
        {
          name: "unit",
          purpose: "A short unit that is not already part of the value.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "period",
          purpose: "The time window, cohort, or scope for the value.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "change",
          purpose: "One labeled delta or status relative to the relevant baseline.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "context",
          purpose: "One sentence explaining why the measure matters to the decision.",
          accepts: ["text"],
          required: true,
          maxItems: 1,
        },
        {
          name: "benchmark",
          purpose: "An optional target, prior period, or comparison point.",
          accepts: ["text"],
          maxItems: 1,
        },
      ],
      variants: ["neutral", "positive", "attention"],
      constraints: {
        contextWords: { recommendedMaximum: 28 },
        valueItems: { maximum: 1 },
        colorRequiresTextLabel: true,
      },
      example:
        '<Metric label="Activation rate" value="68.4" unit="%" period="Q2 · New accounts" change="+7.2 pp vs Q1" context="Guided setup moved more teams to their first shared result." benchmark="Target 65%" tone="positive" />',
    },
    {
      name: "Evidence",
      module: { specifier: `${PACKAGE}/layouts`, exportName: "Evidence" },
      description:
        "Pair one conclusion with an inspectable chart, table, code sample, media object, or source artifact and its provenance.",
      slots: [
        {
          name: "label",
          purpose: "A short analysis, finding, or section label.",
          accepts: ["text"],
          maxItems: 1,
        },
        {
          name: "claim",
          purpose: "The conclusion supported by the evidence.",
          accepts: ["text"],
          required: true,
          maxItems: 1,
        },
        {
          name: "interpretation",
          purpose: "The minimum explanation needed to understand the artifact and its implication.",
          accepts: ["text", "code", "component"],
          required: true,
          maxItems: 1,
        },
        {
          name: "evidence",
          purpose: "One table, chart, diagram, code sample, media object, or interactive artifact.",
          accepts: ["media", "code", "component"],
          required: true,
          maxItems: 1,
        },
        {
          name: "source",
          purpose: "The source, method, sample, or date needed to audit the evidence.",
          accepts: ["text"],
          maxItems: 1,
        },
      ],
      variants: ["evidence-led", "balanced", "argument-led"],
      constraints: {
        interpretationWords: { recommendedMaximum: 45 },
        evidenceItems: { maximum: 1 },
        sourceWords: { recommendedMaximum: 20 },
        nestedColumns: false,
      },
      example:
        '<Evidence label="Finding 04" claim="Most delay enters before review." interpretation={<p>Queue time, not implementation, explains the missed service level.</p>} evidence={<CycleTimeChart />} source="Workflow events · Apr–Jun 2026 · n=1,842" />',
    },
  ],
  manifest: {
    title: "Drever Ledger",
    summary:
      "An evidence-led theme for metrics, research, operational reviews, analytical arguments, and accountable decisions.",
    artDirection: {
      keywords: ["analytical", "evidence-led", "exact", "calm", "accountable"],
      principles: [
        "Lead with the conclusion, then make its evidence inspectable",
        "Give one decision-driving number clear visual priority",
        "Align quantities and label every period, unit, and comparison",
        "Use accent color for material variance or action, never decoration",
      ],
      avoid: [
        "Dashboard mosaics made from many tiny metrics",
        "Unlabeled values, axes, periods, samples, or sources",
        "Color as the only indication of status or change",
        "Decorative ticker tape, financial clichés, and ornamental grid noise",
      ],
    },
    choices: {
      tones: ["neutral", "positive", "attention"],
      emphases: ["metric", "evidence", "variance", "decision"],
      densities: ["airy", "balanced", "compact"],
    },
  },
});

export default theme;
