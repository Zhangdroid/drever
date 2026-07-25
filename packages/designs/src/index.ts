import atlasTheme from "./atlas/index.ts";
import basicTheme from "./basic/index.ts";
import cinemaTheme from "./cinema/index.ts";
import constructTheme from "./construct/index.ts";
import editorialTheme from "./editorial/index.ts";
import fieldnoteTheme from "./fieldnote/index.ts";
import ledgerTheme from "./ledger/index.ts";
import studioTheme from "./studio/index.ts";

export { atlasRecipes } from "./atlas/index.ts";
export type { AtlasRecipe } from "./atlas/index.ts";
export { cinemaRecipes } from "./cinema/index.ts";
export type { CinemaRecipe } from "./cinema/index.ts";
export { constructRecipes } from "./construct/index.ts";
export type { ConstructRecipe } from "./construct/index.ts";
export { editorialRecipes } from "./editorial/index.ts";
export type { EditorialRecipe } from "./editorial/index.ts";
export { fieldnoteRecipes } from "./fieldnote/index.ts";
export type { FieldnoteRecipe } from "./fieldnote/index.ts";
export { ledgerRecipes } from "./ledger/index.ts";
export type { LedgerRecipe } from "./ledger/index.ts";
export { studioRecipes } from "./studio/index.ts";
export type { StudioRecipe } from "./studio/index.ts";

export {
  atlasTheme,
  basicTheme,
  cinemaTheme,
  constructTheme,
  editorialTheme,
  fieldnoteTheme,
  ledgerTheme,
  studioTheme,
};

export const officialDesigns = Object.freeze({
  atlas: atlasTheme,
  basic: basicTheme,
  cinema: cinemaTheme,
  construct: constructTheme,
  editorial: editorialTheme,
  fieldnote: fieldnoteTheme,
  ledger: ledgerTheme,
  studio: studioTheme,
});

export type OfficialDesignName = keyof typeof officialDesigns;
