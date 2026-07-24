import { brandTokens } from "@drever/brand";

const syntax = {
  comment: "#8F8A9B",
  constant: "#8DDFCD",
  error: "#FF8A92",
  iris: "#A193E0",
  string: "#D9A08D",
};

export const dreverShikiTheme = {
  bg: brandTokens.color.night,
  colors: {
    "editor.background": brandTokens.color.night,
    "editor.foreground": brandTokens.color.nightText,
  },
  fg: brandTokens.color.nightText,
  name: "drever-night",
  tokenColors: [
    {
      settings: {
        background: brandTokens.color.night,
        foreground: brandTokens.color.nightText,
      },
    },
    {
      scope: ["comment", "punctuation.definition.comment", "string.comment"],
      settings: { fontStyle: "italic", foreground: syntax.comment },
    },
    {
      scope: ["delimiter", "meta.brace", "punctuation"],
      settings: { foreground: syntax.comment },
    },
    {
      scope: [
        "entity.name.tag",
        "keyword",
        "punctuation.definition.tag",
        "storage.modifier",
        "storage.type",
      ],
      settings: { foreground: brandTokens.color.signal },
    },
    {
      scope: [
        "entity.name",
        "entity.name.function",
        "entity.name.type",
        "meta.object-literal.key",
        "meta.property-name",
        "support",
        "variable.other.property",
      ],
      settings: { foreground: syntax.iris },
    },
    {
      scope: ["attribute.value", "markup.raw", "punctuation.definition.string", "string"],
      settings: { foreground: syntax.string },
    },
    {
      scope: ["constant", "constant.language", "constant.numeric", "number", "variable.language"],
      settings: { foreground: syntax.constant },
    },
    {
      scope: ["invalid", "message.error"],
      settings: { foreground: syntax.error },
    },
    {
      scope: ["markup.bold", "markup.heading"],
      settings: { fontStyle: "bold", foreground: brandTokens.color.signal },
    },
    {
      scope: "markup.italic",
      settings: { fontStyle: "italic", foreground: brandTokens.color.nightText },
    },
  ],
  type: "dark" as const,
};
