import { Component, type ErrorInfo, type ReactNode } from "react";

type RenderHotContext = Readonly<{
  on(event: "vite:afterUpdate", listener: () => void): void;
  off(event: "vite:afterUpdate", listener: () => void): void;
}>;

const renderHotContext = (import.meta as ImportMeta & Readonly<{ hot?: RenderHotContext }>).hot;

type RenderErrorBoundaryProps = Readonly<{
  children: ReactNode;
  fallback(error: unknown): ReactNode;
  onError?(error: Error, info: ErrorInfo): void;
  resetKeys?: readonly unknown[];
}>;

type RenderErrorBoundaryState = Readonly<{
  error?: unknown;
  failed: boolean;
}>;

export const renderErrorBoundaryShouldReset = (
  previous: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined,
): boolean =>
  previous?.length !== next?.length ||
  (previous?.some((value, index) => !Object.is(value, next?.[index])) ?? false);

/** @internal Keeps a recoverable authored render failure inside its owned surface. */
export class RenderErrorBoundary extends Component<
  RenderErrorBoundaryProps,
  RenderErrorBoundaryState
> {
  override state: RenderErrorBoundaryState = { failed: false };
  private awaitingHotRetry = false;

  static getDerivedStateFromError(error: unknown): RenderErrorBoundaryState {
    return { error, failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    if (renderHotContext !== undefined && !this.awaitingHotRetry) {
      this.awaitingHotRetry = true;
      renderHotContext.on("vite:afterUpdate", this.retryAfterHotUpdate);
    }
  }

  override componentDidUpdate(previousProps: RenderErrorBoundaryProps): void {
    if (
      this.state.failed &&
      renderErrorBoundaryShouldReset(previousProps.resetKeys, this.props.resetKeys)
    ) {
      this.reset();
    }
  }

  override componentWillUnmount(): void {
    this.stopWaitingForHotRetry();
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback(this.state.error) : this.props.children;
  }

  private readonly retryAfterHotUpdate = (): void => {
    this.reset();
  };

  private reset(): void {
    this.stopWaitingForHotRetry();
    if (this.state.failed) this.setState({ error: undefined, failed: false });
  }

  private stopWaitingForHotRetry(): void {
    if (!this.awaitingHotRetry || renderHotContext === undefined) return;
    this.awaitingHotRetry = false;
    renderHotContext.off("vite:afterUpdate", this.retryAfterHotUpdate);
  }
}
