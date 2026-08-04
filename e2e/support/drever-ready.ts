import { expect, type Page } from "@playwright/test";

/** Waits for the asynchronously selected presentation surface to own its inputs. */
export const waitForDreverReady = async (page: Page): Promise<void> => {
  await expect(page.locator("#drever-root")).toHaveAttribute("data-drever-ready", "", {
    timeout: 15_000,
  });
};
