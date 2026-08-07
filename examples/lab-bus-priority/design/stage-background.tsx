import type { StageLayerProps } from "drever";

export default function RivertonStage({ position, reducedMotion }: StageLayerProps) {
  const index = position.slideIndex;
  const phase =
    index === 0
      ? "opening"
      : index >= 2 && index <= 4
        ? "corridor"
        : index >= 11 && index <= 12
          ? "gates"
          : index === 14
            ? "close"
            : "paper";
  const crossing = index === 4;

  return (
    <div
      className={`rv-stage rv-stage--${phase}${reducedMotion ? " is-reduced" : ""}`}
      data-slide-index={index}
    >
      <div className="rv-stage__grain" />
      <div className={`rv-stage__route${crossing ? " has-crossing" : ""}`}>
        <span className="rv-stage__track" />
        <span className="rv-stage__crossing" />
        <i className="rv-stage__node rv-stage__node--one" />
        <i className="rv-stage__node rv-stage__node--two" />
        <i className="rv-stage__node rv-stage__node--three" />
        <b className="rv-stage__signal" />
      </div>
    </div>
  );
}
