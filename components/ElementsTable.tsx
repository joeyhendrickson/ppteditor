"use client";

import type { SlideElement } from "@/types/slide";
import { CONFIDENCE_THRESHOLD } from "@/types/slide";

interface ElementsTableProps {
  elements: SlideElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<SlideElement>) => void;
  onDelete: (id: string) => void;
  confidences?: Record<string, number>;
}

export function ElementsTable({
  elements,
  selectedId,
  onSelect,
  onUpdate,
  onDelete,
  confidences,
}: ElementsTableProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">
          Detected elements ({elements.length})
        </h2>
      </div>
      <div className="max-h-[400px] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Content</th>
              <th className="px-3 py-2">Pos</th>
              <th className="px-3 py-2">Conf.</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {elements.map((el) => {
              const conf = confidences?.[el.id] ?? el.confidence ?? 0;
              const lowConf = conf < CONFIDENCE_THRESHOLD;
              const content =
                el.type === "text"
                  ? el.text.slice(0, 40)
                  : el.type === "shape"
                    ? el.shape
                    : "image";

              return (
                <tr
                  key={el.id}
                  className={`border-t border-slate-100 hover:bg-slate-50 ${
                    selectedId === el.id ? "bg-blue-50" : ""
                  }`}
                  onClick={() => onSelect(el.id)}
                >
                  <td className="px-3 py-2 font-mono text-slate-600">{el.id}</td>
                  <td className="px-3 py-2">{el.type}</td>
                  <td className="px-3 py-2 max-w-[140px] truncate" title={content}>
                    {el.type === "text" ? (
                      <input
                        value={el.text}
                        onChange={(e) =>
                          onUpdate(el.id, { text: e.target.value } as Partial<SlideElement>)
                        }
                        className="w-full rounded border border-slate-200 px-1 py-0.5"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      content
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {el.x.toFixed(1)}, {el.y.toFixed(1)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        lowConf
                          ? "rounded bg-amber-100 px-1.5 py-0.5 text-amber-800"
                          : "text-slate-600"
                      }
                    >
                      {conf.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-red-500 hover:text-red-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(el.id);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
