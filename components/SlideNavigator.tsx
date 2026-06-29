"use client";

interface SlideNavigatorProps {
  slideCount: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  disabled?: boolean;
}

export function SlideNavigator({
  slideCount,
  activeIndex,
  onSelect,
  disabled,
}: SlideNavigatorProps) {
  if (slideCount <= 1) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">
          Slides ({slideCount})
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={disabled || activeIndex === 0}
            onClick={() => onSelect(activeIndex - 1)}
            className="rounded border border-slate-200 px-2 py-1 text-xs disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={disabled || activeIndex >= slideCount - 1}
            onClick={() => onSelect(activeIndex + 1)}
            className="rounded border border-slate-200 px-2 py-1 text-xs disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 max-h-24 overflow-auto">
        {Array.from({ length: slideCount }, (_, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(i)}
            className={`rounded px-2 py-1 text-xs ${
              i === activeIndex
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
