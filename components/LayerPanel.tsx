"use client";

import type { ShapeElement, SlideElement } from "@/types/slide";

interface LayerPanelProps {
  elements: SlideElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
  onDuplicate: (id: string) => void;
  onUpdate: (id: string, patch: Partial<SlideElement>) => void;
}

export function LayerPanel({
  elements,
  selectedId,
  onSelect,
  onReorder,
  onDuplicate,
  onUpdate,
}: LayerPanelProps) {
  const sorted = [...elements].sort((a, b) => b.z_index - a.z_index);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">Layers</h2>
        <p className="text-xs text-slate-500">Top to bottom (front first)</p>
      </div>
      <ul className="max-h-[320px] overflow-auto p-2">
        {sorted.map((el) => {
          const label =
            el.type === "text"
              ? `Text: ${el.text.slice(0, 24)}`
              : el.type === "shape"
                ? `Shape: ${el.shape}`
                : "Image";

          return (
            <li
              key={el.id}
              className={`mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                selectedId === el.id ? "bg-blue-50" : "hover:bg-slate-50"
              }`}
            >
              <button
                type="button"
                className="flex-1 truncate text-left"
                onClick={() => onSelect(el.id)}
              >
                {label}
              </button>
              <span className="text-slate-400">z:{el.z_index}</span>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-800"
                onClick={() => onReorder(el.id, "up")}
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-800"
                onClick={() => onReorder(el.id, "down")}
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-800"
                onClick={() => onDuplicate(el.id)}
                title="Duplicate"
              >
                ⧉
              </button>
            </li>
          );
        })}
      </ul>

      {selectedId && (
        <div className="border-t border-slate-100 p-3 text-xs space-y-2">
          <p className="font-medium text-slate-700">Edit selected</p>
          {(() => {
            const el = elements.find((e) => e.id === selectedId);
            if (!el) return null;
            return (
              <div className="grid grid-cols-2 gap-2">
                <label>
                  x
                  <input
                    type="number"
                    step="0.1"
                    value={el.x}
                    onChange={(e) =>
                      onUpdate(el.id, { x: Number(e.target.value) })
                    }
                    className="w-full rounded border px-1 py-0.5"
                  />
                </label>
                <label>
                  y
                  <input
                    type="number"
                    step="0.1"
                    value={el.y}
                    onChange={(e) =>
                      onUpdate(el.id, { y: Number(e.target.value) })
                    }
                    className="w-full rounded border px-1 py-0.5"
                  />
                </label>
                <label>
                  width
                  <input
                    type="number"
                    step="0.1"
                    value={el.width}
                    onChange={(e) =>
                      onUpdate(el.id, { width: Number(e.target.value) })
                    }
                    className="w-full rounded border px-1 py-0.5"
                  />
                </label>
                <label>
                  height
                  <input
                    type="number"
                    step="0.1"
                    value={el.height}
                    onChange={(e) =>
                      onUpdate(el.id, { height: Number(e.target.value) })
                    }
                    className="w-full rounded border px-1 py-0.5"
                  />
                </label>
                {el.type === "shape" && (
                  <>
                    <label className="col-span-2">
                      shape
                      <select
                        value={(el as ShapeElement).shape}
                        onChange={(e) =>
                          onUpdate(el.id, {
                            shape: e.target.value as ShapeElement["shape"],
                          })
                        }
                        className="w-full rounded border px-1 py-0.5"
                      >
                        <option value="rect">rect</option>
                        <option value="roundedRect">roundedRect</option>
                        <option value="ellipse">ellipse</option>
                        <option value="line">line</option>
                        <option value="arrow">arrow</option>
                        <option value="freeform">freeform</option>
                        <option value="imagePlaceholder">imagePlaceholder</option>
                      </select>
                    </label>
                    <label className="col-span-2">
                      fill
                      <input
                        type="color"
                        value={(el as ShapeElement).fill_color ?? "#000000"}
                        onChange={(e) =>
                          onUpdate(el.id, { fill_color: e.target.value })
                        }
                        className="w-full"
                      />
                    </label>
                  </>
                )}
                {el.type === "text" && (
                  <label className="col-span-2">
                    color
                    <input
                      type="color"
                      value={el.color ?? "#000000"}
                      onChange={(e) =>
                        onUpdate(el.id, { color: e.target.value })
                      }
                      className="w-full"
                    />
                  </label>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// Fix type for shape update - SlideElement union doesn't have shape on all types
// The onUpdate uses Partial<SlideElement> which is fine at runtime
