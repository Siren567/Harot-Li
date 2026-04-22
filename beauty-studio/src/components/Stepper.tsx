export function Stepper({ steps, current }: { steps: { label: string; sub?: string }[]; current: number }) {
  return (
    <div className="stepper" role="list">
      {steps.map((s, i) => {
        const state = i === current ? 'active' : i < current ? 'done' : '';
        return (
          <div key={i} className={`step-pill ${state}`} role="listitem">
            <span>שלב {i + 1}</span>
            <strong>{s.label}</strong>
          </div>
        );
      })}
    </div>
  );
}
