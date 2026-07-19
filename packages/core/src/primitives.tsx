/// <reference types="react/canary" />

import type { MotionIntent } from "@drever/schema";
import {
  Activity,
  Children,
  createContext,
  createElement,
  isValidElement,
  useContext,
  ViewTransition,
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type ElementType,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
} from "react";
import { DreverRuntimeError } from "./runtime-error.ts";

type SlideRuntime = Readonly<{
  active: boolean;
  currentStep: number;
}>;

const SlideContext = createContext<SlideRuntime | undefined>(undefined);
const DirectStepMotionContext = createContext<MotionIntent | undefined>(undefined);

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
const SlideStatePruningContext = createContext(false);

export type SlideStateProviderProps = PropsWithChildren<
  Readonly<{
    pruneInactive?: boolean;
    resolver: SlideStateResolver;
  }>
>;

export const SlideStateProvider = ({
  children,
  pruneInactive = false,
  resolver,
}: SlideStateProviderProps): ReactElement =>
  createElement(
    SlideStateResolverContext.Provider,
    { value: resolver },
    createElement(SlideStatePruningContext.Provider, { value: pruneInactive }, children),
  );

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
  const pruneInactive = useContext(SlideStatePruningContext);
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

  if ((exporting || pruneInactive) && !active) {
    return null;
  }

  const content = createElement(
    SlideContext.Provider,
    { value: Object.freeze({ active, currentStep }) },
    children,
  );
  const section = createElement(
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
    createElement(Activity, { mode: active ? "visible" : "hidden", children: content }),
  );

  if (renderMode !== "audience") {
    return section;
  }

  return createElement(
    ViewTransition,
    {
      name: index === undefined ? "auto" : `drever-slide-${index}`,
      default: "none",
      enter: "none",
      exit: "none",
      update: active ? "drever-motion-slide-enter" : "drever-motion-slide-exit",
    },
    section,
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
  const motionIntent = useContext(DirectStepMotionContext);
  const renderMode = useContext(DreverRenderModeContext);
  if (at === undefined && runtime !== undefined) {
    throw new DreverRuntimeError(
      "DREVER_RUNTIME_STEP_INDEX_MISSING",
      "Step at is required inside a compiled Slide.",
    );
  }

  const state = resolveStepState(at, runtime?.currentStep);
  const concealed =
    state === "pending" ||
    (renderMode !== "document" && motionIntent === "replace" && state === "complete");

  return createElement(
    Component,
    {
      ...props,
      "data-drever-step": at ?? "",
      "data-step-state": state,
      "aria-hidden": concealed || undefined,
      inert: concealed || undefined,
      style: concealed ? { ...style, visibility: "hidden" } : style,
    },
    children,
  );
};

export type NoteProps = PropsWithChildren;

export const Note = (_props: NoteProps) => null;

type MotionGroupElementProps = Omit<ComponentPropsWithoutRef<"div">, "name">;

export type MotionFlow = "block" | "inline";

type ContinuityMotionGroupProps = MotionGroupElementProps &
  Readonly<{
    flow?: never;
    intent: "continuity";
    name: string;
  }>;

type LocalMotionIntent = Exclude<MotionIntent, "continuity">;

type LocalMotionGroupProps = MotionGroupElementProps &
  Readonly<{
    flow?: MotionFlow;
    intent: LocalMotionIntent;
    name?: never;
  }>;

export type MotionGroupProps = ContinuityMotionGroupProps | LocalMotionGroupProps;

type ViewTransitionStyle = CSSProperties &
  Readonly<{
    viewTransitionClass?: string | undefined;
    viewTransitionName?: string | undefined;
  }>;

const MOTION_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const MOTION_FLOW_ERROR = "DREVER_RUNTIME_MOTION_FLOW_INVALID";
const MOTION_INTENT_ERROR = "DREVER_RUNTIME_MOTION_INTENT_INVALID";
const MOTION_IDENTITY_ERROR = "DREVER_RUNTIME_MOTION_IDENTITY_INVALID";

const resolveMotionIntent = (value: unknown): MotionIntent => {
  switch (value) {
    case "focus":
    case "replace":
    case "compare":
    case "stagger":
    case "continuity":
      return value;
  }

  throw new DreverRuntimeError(
    MOTION_INTENT_ERROR,
    "MotionGroup intent must be focus, replace, compare, stagger, or continuity.",
    { received: typeof value === "string" ? value : typeof value },
  );
};

const resolveMotionFlow = (value: unknown, intent: MotionIntent): MotionFlow | undefined => {
  if (value === undefined) {
    return;
  }
  if (intent !== "continuity" && (value === "block" || value === "inline")) {
    return value;
  }

  throw new DreverRuntimeError(
    MOTION_FLOW_ERROR,
    intent === "continuity"
      ? "MotionGroup flow is not valid for the continuity intent."
      : "MotionGroup flow must be block or inline when provided.",
    { intent, received: typeof value === "string" ? value : typeof value },
  );
};

const assertMotionIdentity = (intent: MotionIntent, name: string | undefined): void => {
  if (intent === "continuity") {
    if (typeof name !== "string" || !MOTION_NAME_PATTERN.test(name)) {
      throw new DreverRuntimeError(
        MOTION_IDENTITY_ERROR,
        "A continuity MotionGroup name must be a lowercase kebab-case identifier.",
        { intent },
      );
    }
    return;
  }

  if (name !== undefined) {
    throw new DreverRuntimeError(
      MOTION_IDENTITY_ERROR,
      "MotionGroup name is only valid for the continuity intent.",
      { intent },
    );
  }
};

const provideIntentToDirectSteps = (children: ReactNode, intent: MotionIntent): ReactNode =>
  Children.map(children, (child) =>
    isValidElement(child) && child.type === Step
      ? createElement(DirectStepMotionContext.Provider, { value: intent }, child)
      : child,
  );

const withoutNativeTransitionStyles = (
  style: ViewTransitionStyle | undefined,
): CSSProperties | undefined => {
  if (style === undefined) {
    return undefined;
  }
  const {
    viewTransitionClass: _viewTransitionClass,
    viewTransitionName: _viewTransitionName,
    ...authoredStyle
  } = style;
  return authoredStyle;
};

export const MotionGroup = ({
  children,
  flow,
  intent,
  name,
  style,
  ...props
}: MotionGroupProps): ReactElement => {
  const resolvedIntent = resolveMotionIntent(intent);
  const resolvedFlow = resolveMotionFlow(flow, resolvedIntent);
  assertMotionIdentity(resolvedIntent, name);
  const renderMode = useContext(DreverRenderModeContext);
  const slide = useContext(SlideContext);
  const group = createElement(
    "div",
    {
      ...props,
      "data-drever-motion-group": "",
      "data-motion-flow": resolvedFlow,
      "data-motion-intent": resolvedIntent,
      "data-motion-name": name,
      style:
        resolvedIntent === "continuity"
          ? withoutNativeTransitionStyles(style as ViewTransitionStyle | undefined)
          : style,
    },
    provideIntentToDirectSteps(children, resolvedIntent),
  );

  if (renderMode !== "audience" || resolvedIntent !== "continuity") {
    return group;
  }

  return createElement(
    ViewTransition,
    {
      name: slide?.active === false ? "auto" : `drever-${name}`,
      default: "none",
      enter: "none",
      exit: "none",
      share: "drever-motion-continuity",
      update: "none",
    },
    group,
  );
};
