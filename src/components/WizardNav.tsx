interface WizardNavProps {
  currentStep: number;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  blockerMessage: string;
}

export default function WizardNav({ currentStep, onPrev, onNext, nextDisabled, blockerMessage }: WizardNavProps) {
  return (
    <div className="wizard-nav">
      <button type="button" disabled={currentStep === 1} onClick={onPrev}>← 이전</button>
      {currentStep < 4 && (
        <div>
          <button type="button" className="primary" disabled={nextDisabled} onClick={onNext}>다음 →</button>
          {nextDisabled && blockerMessage && <p className="error">{blockerMessage}</p>}
        </div>
      )}
    </div>
  );
}
