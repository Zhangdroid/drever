import { useState, type ReactElement } from "react";

export const Counter = (): ReactElement => {
  const [count, setCount] = useState(0);

  return (
    <div className="fixture-counter">
      <span>Live React state</span>
      <output aria-live="polite" data-testid="counter-value">
        {count}
      </output>
      <button data-testid="counter-increment" onClick={() => setCount((value) => value + 1)}>
        Add one
      </button>
    </div>
  );
};
