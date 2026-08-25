import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** 화면 이름 (Korean, user-facing) — e.g. "설계안 (Step 3)". */
  stepLabel: string;
  /** Present only when a previous step exists to retreat to. */
  onGoBack?: () => void;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 정합성 점검 §0-6/결함6 fix — real gap: core/ExperimentalFeatureBoundary.tsx
 * exists but was scoped tightly to individual experimental panels (that
 * component's own doc comment), never around the core 5-step wizard flow
 * itself (Step1Channel/Step2Concept/Step2Plan/Step3Generate/Step4Result) —
 * so a render-time exception in any of those still took down the entire
 * React tree with no error boundary anywhere to catch it. From the user's
 * side this reads as "the 다음 button stopped working" with zero visible
 * explanation (§0's own reported symptom) — the console has the real stack,
 * but nothing on screen tells the user that, or which screen failed, or
 * what to try. This boundary is scoped per-step (wrapped individually at
 * each currentStep render site in App.tsx) rather than once around the
 * whole wizard, so a crash on one step doesn't also blank out navigation
 * chrome (WizardNav) that a user might need to leave that step.
 */
export default class StepErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[step-error:${this.props.stepLabel}]`, error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    // A step change (e.g. the user went back via onGoBack, or otherwise
    // navigated away and back) should get a fresh mount attempt rather than
    // staying stuck on a stale error from a different screen.
    if (this.state.error && prevProps.stepLabel !== this.props.stepLabel) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="step-error-boundary">
          <strong>&ldquo;{this.props.stepLabel}&rdquo; 화면에서 오류가 발생했습니다.</strong>
          <p className="step-error-boundary-message">{this.state.error.message}</p>
          <p className="supporting">
            페이지를 새로고침하거나, 이전 화면으로 돌아가 다른 값을 선택한 뒤 다시 시도해 보세요.
            같은 오류가 반복되면 브라우저 콘솔에 찍힌 상세 내용과 함께 알려주세요.
          </p>
          <div className="button-row">
            <button type="button" onClick={() => this.setState({ error: null })}>다시 시도</button>
            {this.props.onGoBack && (
              <button type="button" onClick={() => { this.props.onGoBack!(); this.setState({ error: null }); }}>이전 화면으로</button>
            )}
            <button type="button" onClick={() => window.location.reload()}>페이지 새로고침</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
