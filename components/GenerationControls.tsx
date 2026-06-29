"use client";

import type { DiagnosticsReport, VisibilityFilter } from "@/types/slide";

interface GenerationControlsProps {
  onAnalyze: () => void;
  onGenerate: () => void;
  onDownload: () => void;
  analyzing: boolean;
  generating: boolean;
  canAnalyze: boolean;
  canGenerate: boolean;
  canDownload: boolean;
  visibility: VisibilityFilter;
  onVisibilityChange: (v: VisibilityFilter) => void;
  onAddElement: () => void;
  diagnostics: DiagnosticsReport | null;
}

export function GenerationControls({
  onAnalyze,
  onGenerate,
  onDownload,
  analyzing,
  generating,
  canAnalyze,
  canGenerate,
  canDownload,
  visibility,
  onVisibilityChange,
  onAddElement,
  diagnostics,
}: GenerationControlsProps) {
  const toggle = (key: keyof VisibilityFilter) => {
    onVisibilityChange({ ...visibility, [key]: !visibility[key] });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={!canAnalyze || analyzing}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {analyzing ? "Analyzing…" : "Analyze Slide"}
        </button>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || generating}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {generating ? "Generating…" : "Generate Editable PowerPoint"}
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={!canDownload}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Download PPTX
        </button>
        <button
          type="button"
          onClick={onAddElement}
          disabled={!canGenerate}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Add text box
        </button>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-600 mb-2">Visibility</p>
        <div className="flex flex-wrap gap-3 text-sm">
          {(
            [
              ["text", "Text"],
              ["shapes", "Shapes"],
              ["lines", "Lines"],
              ["images", "Images"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={visibility[key]}
                onChange={() => toggle(key)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {diagnostics && (
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
          <p className="font-medium text-slate-700">
            Diagnostics — overall confidence:{" "}
            {diagnostics.overall_confidence.toFixed(2)}
          </p>
          {diagnostics.issues.length === 0 ? (
            <p className="mt-1 text-slate-500">No issues detected.</p>
          ) : (
            <ul className="mt-2 space-y-1 max-h-32 overflow-auto">
              {diagnostics.issues.map((issue, i) => (
                <li key={i} className="text-slate-600">
                  <span
                    className={
                      issue.severity === "high"
                        ? "text-red-600"
                        : issue.severity === "medium"
                          ? "text-amber-700"
                          : "text-slate-500"
                    }
                  >
                    [{issue.type}]
                  </span>
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
