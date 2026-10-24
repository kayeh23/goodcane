"use client";

import { useState } from "react";
import type { PackingStage } from "@/lib/analytics";

interface PackingStageToggleProps {
  orderId: string;
  orderCode: string;
  stage: PackingStage;
  onStageChange: (nextStage: PackingStage) => Promise<void>;
  disabled?: boolean;
}

const STAGES: Array<{ key: PackingStage; label: string }> = [
  { key: "bottled", label: "Bottled" },
  { key: "packed", label: "Packed" },
  { key: "collected", label: "Collected" },
];

export function PackingStageToggle({
  orderCode,
  stage,
  onStageChange,
  disabled = false,
}: PackingStageToggleProps) {
  const [busy, setBusy] = useState(false);

  const isChecked = (targetStage: PackingStage): boolean => {
    if (stage === "collected") return true;
    if (stage === "packed") return targetStage === "bottled" || targetStage === "packed";
    if (stage === "bottled") return targetStage === "bottled";
    return false;
  };

  const handleToggle = async (targetStage: PackingStage) => {
    if (busy || disabled) return;
    setBusy(true);

    let nextStage: PackingStage = targetStage;
    if (targetStage === "bottled") {
      nextStage = isChecked("bottled") ? "pending" : "bottled";
    } else if (targetStage === "packed") {
      nextStage = isChecked("packed") ? "bottled" : "packed";
    } else if (targetStage === "collected") {
      nextStage = isChecked("collected") ? "packed" : "collected";
    }

    try {
      await onStageChange(nextStage);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {STAGES.map((s, idx) => {
        const checked = isChecked(s.key);
        return (
          <div key={s.key} className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              disabled={busy || disabled}
              onClick={() => handleToggle(s.key)}
              aria-label={`Mark order ${orderCode} as ${s.label}`}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold transition ${
                checked
                  ? "border-cane bg-cane/15 text-cane-dark"
                  : "border-black/20 bg-white text-black/60 hover:border-black/40 hover:bg-black/5"
              } ${busy || disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <span
                className={`flex size-3.5 items-center justify-center rounded-sm border ${
                  checked ? "border-cane bg-cane text-white" : "border-black/30 bg-white"
                }`}
              >
                {checked && (
                  <svg
                    className="size-2.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span>{s.label}</span>
            </button>
            {idx < STAGES.length - 1 && (
              <span className="text-[10px] text-black/30 select-none">→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
