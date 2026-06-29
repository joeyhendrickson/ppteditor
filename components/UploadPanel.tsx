"use client";

import { useCallback, useRef } from "react";
import { MAX_UPLOAD_BYTES } from "@/lib/response-utils";

const ACCEPT =
  ".pptx,.pdf,.png,.jpg,.jpeg,.webp,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf,image/*";

interface UploadPanelProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  slideIndex: number;
  slideCount: number;
  onSlideIndexChange: (index: number) => void;
  analyzeAll: boolean;
  onAnalyzeAllChange: (value: boolean) => void;
  disabled?: boolean;
}

export function UploadPanel({
  onFileSelect,
  selectedFile,
  slideIndex,
  slideCount,
  onSlideIndexChange,
  analyzeAll,
  onAnalyzeAllChange,
  disabled,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  const isDeckFile =
    selectedFile &&
    (selectedFile.name.toLowerCase().endsWith(".pptx") ||
      selectedFile.name.toLowerCase().endsWith(".pdf"));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-800">Upload presentation</h2>
      <p className="mt-1 text-xs text-slate-500">
        Full PPTX/PDF deck or single slide image
      </p>

      <div
        className="mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 transition hover:border-blue-400 hover:bg-blue-50/50"
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={handleChange}
          disabled={disabled}
        />
        <p className="text-sm text-slate-600">
          {selectedFile ? selectedFile.name : "Click to choose a file"}
        </p>
        {selectedFile && (
          <p className="mt-1 text-xs text-slate-400">
            {(selectedFile.size / 1024).toFixed(1)} KB
            {selectedFile.size > MAX_UPLOAD_BYTES && (
              <span className="text-red-600"> — exceeds 4MB upload limit</span>
            )}
          </p>
        )}
      </div>

      {isDeckFile && (
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={analyzeAll}
            onChange={(e) => onAnalyzeAllChange(e.target.checked)}
            disabled={disabled}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Analyze entire presentation</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              All slides/pages → one editable PPTX. PPTX uses native parsing
              (fast). PDF uses vision per page (slower).
            </span>
          </span>
        </label>
      )}

      {isDeckFile && !analyzeAll && slideCount > 1 && (
        <div className="mt-4">
          <label className="text-xs font-medium text-slate-600">
            Single slide / page ({slideCount} total)
          </label>
          <input
            type="number"
            min={1}
            max={slideCount}
            value={slideIndex + 1}
            onChange={(e) =>
              onSlideIndexChange(
                Math.max(0, Math.min(slideCount - 1, Number(e.target.value) - 1))
              )
            }
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            disabled={disabled}
          />
        </div>
      )}

      {selectedFile?.name.toLowerCase().endsWith(".ppt") && (
        <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md p-2">
          Legacy .ppt is not supported. Open in PowerPoint/Keynote and export as
          .pptx.
        </p>
      )}
    </div>
  );
}
