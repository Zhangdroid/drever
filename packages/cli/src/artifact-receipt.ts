export type WebsiteArtifact = Readonly<{
  entry: string;
  kind: "website";
  path: string;
}>;

export type PdfArtifact = Readonly<{
  kind: "pdf";
  path: string;
  slides?: readonly Readonly<{ first: number; last: number }>[];
  steps: boolean;
}>;

export type DreverArtifact = PdfArtifact | WebsiteArtifact;

export type ArtifactReceipt = Readonly<{
  artifacts: readonly DreverArtifact[];
  command: "build" | "export";
  ok: true;
  sourcePath: string;
  version: 1;
}>;

/** Returns the stable machine contract for successfully created presentation artifacts. */
export const createArtifactReceipt = (
  command: ArtifactReceipt["command"],
  sourcePath: string,
  artifacts: readonly DreverArtifact[],
): ArtifactReceipt =>
  Object.freeze({
    artifacts: Object.freeze(artifacts.map((artifact) => Object.freeze(artifact))),
    command,
    ok: true,
    sourcePath,
    version: 1,
  });

export const writeArtifactReceipt = (
  receipt: ArtifactReceipt,
  stdout: Pick<NodeJS.WriteStream, "write">,
): void => {
  stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
};
