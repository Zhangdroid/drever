import type { ReactElement } from "react";

export type FieldnoteCheckoutState = "finding" | "observations" | "premise";

export type FieldnoteCheckoutProps = Readonly<{
  state: FieldnoteCheckoutState;
}>;

const descriptions: Record<FieldnoteCheckoutState, string> = {
  premise:
    "An illustrative three-screen checkout flow. The delivery summary does not explain what Continue will do.",
  observations:
    "The same illustrative checkout flow, ready for three timestamped research observations.",
  finding:
    "The same illustrative checkout flow with the delivery summary emphasized because seven of eight participants paused there.",
};

/** One stable checkout artifact that changes role across the Fieldnote study. */
export const FieldnoteCheckout = ({ state }: FieldnoteCheckoutProps): ReactElement => (
  <figure
    aria-label={descriptions[state]}
    className="fieldnote-checkout"
    data-fieldnote-checkout-state={state}
  >
    <figcaption className="fieldnote-checkout__caption">
      Illustrative mobile checkout · moderated study
    </figcaption>
    <ol aria-hidden="true" className="fieldnote-checkout__screens">
      <li className="fieldnote-checkout__screen" data-screen="delivery">
        <span className="fieldnote-checkout__index">01</span>
        <strong>Delivery summary</strong>
        <span>Address confirmed</span>
        <span>Standard delivery</span>
        <span className="fieldnote-checkout__button">Continue</span>
        <b className="fieldnote-checkout__pause">7 / 8 paused here</b>
      </li>
      <li className="fieldnote-checkout__screen" data-screen="payment">
        <span className="fieldnote-checkout__index">02</span>
        <strong>Payment details</strong>
        <span>Card ending 2408</span>
        <span>Billing address</span>
        <span className="fieldnote-checkout__button">Continue</span>
      </li>
      <li className="fieldnote-checkout__screen" data-screen="review">
        <span className="fieldnote-checkout__index">03</span>
        <strong>Final review</strong>
        <span>Delivery + payment</span>
        <span>Total confirmed</span>
        <span className="fieldnote-checkout__button">Place order</span>
      </li>
    </ol>
    <p aria-hidden="true" className="fieldnote-checkout__missing-promise">
      What happens after “Continue”?
    </p>
  </figure>
);
