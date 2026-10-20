"use client";

export function Stepper({ qty, onChange, label }: { qty: number; onChange: (q: number) => void; label: string }) {
  if (qty === 0)
    return (
      <button type="button" className="btn-outline min-w-[76px] px-3 py-2" onClick={() => onChange(1)} aria-label={`Add ${label}`}>
        + Add
      </button>
    );
  return (
    <div className="flex items-center rounded-xl bg-ink text-white" role="group" aria-label={`${label} quantity`}>
      <button type="button" className="size-10 text-lg font-bold" onClick={() => onChange(qty - 1)} aria-label={`Remove one ${label}`}>
        −
      </button>
      <span className="w-6 text-center text-sm font-bold tabular-nums" aria-live="polite">
        {qty}
      </span>
      <button type="button" className="size-10 text-lg font-bold" onClick={() => onChange(qty + 1)} aria-label={`Add one ${label}`} disabled={qty >= 20}>
        +
      </button>
    </div>
  );
}
