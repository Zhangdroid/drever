import brandTokenSource from "@drever/brand/tokens.json" with { type: "json" };

const syntax = {
  comment: "#8F8A9B",
  constant: "#8DDFCD",
  error: "#FF8A92",
  iris: "#A193E0",
  string: "#D9A08D",
};
const brandColor = {
  night: brandTokenSource.color.night.$value.hex,
  nightText: brandTokenSource.color.nightText.$value.hex,
  signal: brandTokenSource.color.signal.$value.hex,
};

export const dreverShikiTheme = {
  bg: brandColor.night,
  colors: {
    "editor.background": brandColor.night,
    "editor.foreground": brandColor.nightText,
  },
  fg: brandColor.nightText,
  name: "drever-night",
  tokenColors: [
    {
      settings: {
        background: brandColor.night,
        foreground: brandColor.nightText,
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
      settings: { foreground: brandColor.signal },
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
      settings: { fontStyle: "bold", foreground: brandColor.signal },
    },
    {
      scope: "markup.italic",
      settings: { fontStyle: "italic", foreground: brandColor.nightText },
    },
  ],
  type: "dark" as const,
};
