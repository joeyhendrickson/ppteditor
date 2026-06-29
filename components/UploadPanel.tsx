"use client";

import { useCallback, useRef } from "react";

const ACCEPT =
  ".pptx,.pdf,.png,.jpg,.jpeg,.webp,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf,image/*";

interface UploadPanelProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  slideIndex: number;
  slideCount: number;
  onSlideIndexChange: (index: number) => void;
  disabled?: boolean;
}

export function UploadPanel({
  onFileSelect,
  selectedFile,
  slideIndex,
  slideCount,
  onSlideIndexChange,
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-800">Upload slide</h2>
      <p className="mt-1 text-xs text-slate-500">
        PPTX, PDF, PNG, JPG, JPEG, or WEBP
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
          </p>
        )}
      </div>

      {slideCount > 1 && (
        <div className="mt-4">
          <label className="text-xs font-medium text-slate-600">
            Slide / page ({slideCount} total)
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
    </div>
  );
}
