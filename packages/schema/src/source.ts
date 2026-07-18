export type SourcePoint = Readonly<{
  line: number;
  column: number;
  offset: number;
}>;

export type SourceRange = Readonly<{
  path: string;
  start: SourcePoint;
  end: SourcePoint;
}>;

export type SourceFragment = Readonly<{
  value: string;
  range: SourceRange;
}>;
