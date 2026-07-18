import type { MotionIntent } from "@drever/schema";
import {
  Activity,
  createContext,
  createElement,
  useContext,
  type ComponentPropsWithoutRef,
  type ElementType,
  type PropsWithChildren,
  type ReactElement,
} from "react";
import { DreverRuntimeError } from "./runtime-error.ts";

type SlideRuntime = Readonly<{
  currentStep: number;
}>;

const SlideContext = createContext<SlideRuntime | undefined>(undefined);

export type DreverRenderMode =
  | "audience"
  | "document"
  | "export"
  | "speaker-current"
  | "speaker-next";

const DreverRenderModeContext = createContext<DreverRenderMode>("audience");
const DreverRenderIdPrefixContext = createContext<string | undefined>(undefined);

export type DreverRenderModeProviderProps = PropsWithChildren<
  Readonly<{
    idPrefix?: string;
    mode: DreverRenderMode;
  }>
>;

/** Identifies the surface rendering MDX and optionally isolates its generated IDs. */
export const DreverRenderModeProvider = ({
  children,
  idPrefix,
  mode,
}: DreverRenderModeProviderProps): ReactElement =>
  createElement(
    DreverRenderModeContext.Provider,
    { value: mode },
    createElement(DreverRenderIdPrefixContext.Provider, { value: idPrefix }, children),
  );

/** Lets components adapt media, network, and global effects to the current render surface. */
export const useDreverRenderMode = (): DreverRenderMode => useContext(DreverRenderModeContext);

export type SlideIdentity = Readonly<{
  id?: string;
  index?: number;
}>;

/** The complete presentation state resolved for one compiled slide. */
export type ResolvedSlideState = Readonly<{
  active: boolean;
  currentStep: number;
  label?: string;
}>;

export type SlideStateResolver = (slide: SlideIdentity) => ResolvedSlideState;

const SlideStateResolverContext = createContext<SlideStateResolver | undefined>(undefined);

export type SlideStateProviderProps = PropsWithChildren<
  Readonly<{
    resolver: SlideStateResolver;
  }>
>;

export const SlideStateProvider = ({ children, resolver }: SlideStateProviderProps): ReactElement =>
  createElement(SlideStateResolverContext.Provider, { value: resolver }, children);

const assertNonNegativeInteger = (name: string, value: number | undefined): void => {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
    throw new DreverRuntimeError(
      "DREVER_RUNTIME_SLIDE_STATE_INVALID",
      `${name} must be a non-negative safe integer.`,
      { name, value },
    );
  }
};

const assertBoolean = (name: string, value: boolean | undefined): void => {
  if (value !== undefined && typeof value !== "boolean") {
    throw new DreverRuntimeError(
      "DREVER_RUNTIME_SLIDE_STATE_INVALID",
      `${name} must be a boolean when provided.`,
      { name, receivedType: typeof value },
    );
  }
};

const snapshotResolvedState = (value: ResolvedSlideState): ResolvedSlideState => {
  if (typeof value !== "object" || value === null) {
    throw new DreverRuntimeError(
      "DREVER_RUNTIME_SLIDE_STATE_INVALID",
      "Slide state resolver must return an object.",
      { name: "resolver", receivedType: value === null ? "null" : typeof value },
    );
  }

  const { active, currentStep, label } = value;
  if (typeof active !== "boolean") {
    throw new DreverRuntimeError(
      "DREVER_RUNTIME_SLIDE_STATE_INVALID",
      "Slide state resolver active must be a boolean.",
      { name: "resolver.active", receivedType: typeof active },
    );
  }
  if (!Number.isSafeInteger(currentStep) || currentStep < 0) {
    throw new DreverRuntimeError(
      "DREVER_RUNTIME_SLIDE_STATE_INVALID",
      "Slide state resolver currentStep must be a non-negative safe integer.",
      { name: "resolver.currentStep", receivedType: typeof currentStep },
    );
  }
  if (label !== undefined && (typeof label !== "string" || label.length === 0)) {
    throw new DreverRuntimeError(
      "DREVER_RUNTIME_SLIDE_STATE_INVALID",
      "Slide state resolver label must be a non-empty string when provided.",
      { name: "resolver.label", receivedType: typeof label },
    );
  }

  return Object.freeze({ active, currentStep, ...(label === undefined ? {} : { label }) });
};

export type SlideProps = ComponentPropsWithoutRef<"section"> &
  Readonly<{
    active?: boolean;
    index?: number;
    currentStep?: number;
  }>;

export const Slide = ({
  active: explicitActive,
  children,
  id,
  index,
  currentStep: explicitStep,
  ...props
}: SlideProps): ReactElement | null => {
  assertBoolean("active", explicitActive);
  assertNonNegativeInteger("index", index);
  const renderMode = useContext(DreverRenderModeContext);
  const idPrefix = useContext(DreverRenderIdPrefixContext);
  const resolver = useContext(SlideStateResolverContext);
  const needsResolvedState = explicitActive === undefined || explicitStep === undefined;
  const resolvedState =
    needsResolvedState && resolver !== undefined
      ? snapshotResolvedState(
          resolver(
            Object.freeze({
              ...(id === undefined ? {} : { id }),
              ...(index === undefined ? {} : { index }),
            }),
          ),
        )
      : undefined;
  const active = explicitActive ?? resolvedState?.active ?? true;
  const currentStep = explicitStep !== undefined ? explicitStep : (resolvedState?.currentStep ?? 0);
  const exporting = renderMode === "export";
  const documentMode = renderMode === "document";
  const renderedId =
    id === undefined
      ? undefined
      : idPrefix !== undefined
        ? `${idPrefix}-${id}`
        : renderMode.startsWith("speaker-")
          ? `${renderMode}-${id}`
          : id;
  assertNonNegativeInteger("currentStep", currentStep);

  if (exporting && !active) {
    return null;
  }

  return createElement(
    "section",
    {
      ...props,
      id: renderedId,
      "data-drever-slide": "",
      "data-slide-id": id,
      "data-slide-index": index,
      "data-slide-state": active ? "active" : "inactive",
      "data-current-step": currentStep,
      "aria-current": !exporting && !documentMode && active ? "page" : undefined,
      "aria-label": documentMode
        ? (props["aria-label"] ?? resolvedState?.label)
        : props["aria-label"],
      "aria-hidden": active ? undefined : true,
      tabIndex: exporting
        ? undefined
        : documentMode
          ? props.tabIndex
          : (props.tabIndex ?? (active ? -1 : undefined)),
      inert: active ? undefined : true,
      hidden: active ? undefined : true,
    },
    createElement(Activity, {
      mode: active ? "visible" : "hidden",
      children: createElement(
        SlideContext.Provider,
        { value: Object.freeze({ currentStep }) },
        children,
      ),
    }),
  );
};

export type StepState = "active" | "complete" | "pending";

export type StepProps = ComponentPropsWithoutRef<"div"> &
  Readonly<{
    as?: ElementType;
    at?: number;
  }>;

const resolveStepState = (at: number | undefined, currentStep: number | undefined): StepState => {
  if (at === undefined || currentStep === undefined) {
    return "active";
  }
  if (at < currentStep) {
    return "complete";
  }
  return at === currentStep ? "active" : "pending";
};

export const Step = ({
  as: Component = "div",
  at,
  children,
  style,
  ...props
}: StepProps): ReactElement => {
  if (at !== undefined && (!Number.isSafeInteger(at) || at <= 0)) {
    throw new DreverRuntimeError(
      "DREVER_RUNTIME_STEP_INDEX_INVALID",
      "Step at must be a positive safe integer when provided.",
      { at },
    );
  }

  const runtime = useContext(SlideContext);
  if (at === undefined && runtime !== undefined) {
    throw new DreverRuntimeError(
      "DREVER_RUNTIME_STEP_INDEX_MISSING",
      "Step at is required inside a compiled Slide.",
    );
  }

  const state = resolveStepState(at, runtime?.currentStep);
  const pending = state === "pending";

  return createElement(
    Component,
    {
      ...props,
      "data-drever-step": at ?? "",
      "data-step-state": state,
      "aria-hidden": pending || undefined,
      inert: pending || undefined,
      style: pending ? { ...style, visibility: "hidden" } : style,
    },
    children,
  );
};

export type NoteProps = PropsWithChildren;

export const Note = (_props: NoteProps) => null;

export type MotionGroupProps = ComponentPropsWithoutRef<"div"> &
  Readonly<{
    intent?: MotionIntent;
  }>;

export const MotionGroup = ({ children, intent, ...props }: MotionGroupProps): ReactElement =>
  createElement(
    "div",
    {
      ...props,
      "data-drever-motion-group": "",
      "data-motion-intent": intent,
    },
    children,
  );
