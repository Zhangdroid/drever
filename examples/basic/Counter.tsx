import { useState, type ReactElement } from "react";

export const Counter = (): ReactElement => {
  const [count, setCount] = useState(0);

  return (
    <div className="demo-counter">
      <span className="demo-counter__label">Live React state</span>
      <output aria-live="polite" className="demo-counter__value" data-testid="counter-value">
        {count}
      </output>
      <button
        className="demo-counter__button"
        data-testid="counter-increment"
        onClick={() => setCount((value) => value + 1)}
        type="button"
      >
        Add one
      </button>
    </div>
  );
};
