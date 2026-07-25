import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

export const removeReleaseSmokeGeneratedArtifacts = async (websiteOutput) => {
  const runsRoot = join(websiteOutput, "release-smoke", "runs");
  const runs = await readdir(runsRoot, { withFileTypes: true }).catch((error) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  });
  await Promise.all(
    runs
      .filter((run) => run.isDirectory())
      .flatMap((run) =>
        readdir(join(runsRoot, run.name), { withFileTypes: true }).then((scenarios) =>
          Promise.all(
            scenarios
              .filter((scenario) => scenario.isDirectory())
              .flatMap((scenario) =>
                ["deck", "source"].map((artifact) =>
                  rm(join(runsRoot, run.name, scenario.name, artifact), {
                    force: true,
                    recursive: true,
                  }),
                ),
              ),
          ),
        ),
      ),
  );
};
