export interface StepDef {
  id: number;
  label: string;
}

interface StepIndicatorProps {
  steps: StepDef[];
  current: number;
  maxUnlocked: number;
  onSelect: (step: number) => void;
}

export default function StepIndicator({ steps, current, maxUnlocked, onSelect }: StepIndicatorProps) {
  return (
    <nav className="step-indicator">
      {steps.map(step => {
        const reachable = step.id <= maxUnlocked;
        const isCurrent = step.id === current;
        return (
          <button
            key={step.id}
            type="button"
            className={isCurrent ? 'step-pill active' : 'step-pill'}
            disabled={!reachable}
            onClick={() => reachable && onSelect(step.id)}
          >
            <span className="step-num">{step.id}</span>
            {step.label}
          </button>
        );
      })}
    </nav>
  );
}
