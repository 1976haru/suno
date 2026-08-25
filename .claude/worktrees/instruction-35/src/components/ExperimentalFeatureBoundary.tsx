import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  featureLabel: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * v4.0 (TASK D, P1) — audit report §9-4: nothing in this app stopped an
 * experimental feature's render-time exception from crashing the whole
 * React tree (white screen), core generation flow included — there was no
 * error boundary anywhere in the app at all. Scattered try/catch inside
 * async handlers (the pattern AudioAnalysisPanel.tsx/AudioEditPanel.tsx
 * already use for their own async decode/analyze calls) only ever catches
 * async logic errors, never a render-time throw — this is the other half.
 * Scoped tightly around each individual experimental panel (audio
 * analysis/edit, rating insights, thumbnail image generation), never
 * around the core 5-step flow itself, so this can never mask a real bug in
 * production-status code.
 */
export default class ExperimentalFeatureBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[experimental:${this.props.featureLabel}]`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="experimental-feature-error">
          <strong>{this.props.featureLabel} 기능에서 오류가 발생했습니다 (실험 기능).</strong>
          <p>{this.state.error.message}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>다시 시도</button>
        </div>
      );
    }
    return this.props.children;
  }
}
