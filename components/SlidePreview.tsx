"use client";

import type { SlideAnalysis, VisibilityFilter } from "@/types/slide";
import { isLineOrArrow } from "@/types/slide";

interface SlidePreviewProps {
  analysis: SlideAnalysis | null;
  referenceImage?: string;
  visibility: VisibilityFilter;
  selectedId?: string | null;
  onSelectElement?: (id: string) => void;
}

export function SlidePreview({
  analysis,
  referenceImage,
  visibility,
  selectedId,
  onSelectElement,
}: SlidePreviewProps) {
  if (!analysis) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
        Upload and analyze a slide to see preview
      </div>
    );
  }

  const { slide, elements } = analysis;
  const scale = 100 / slide.width;

  const visibleElements = elements.filter((el) => {
    if (el.visible === false) return false;
    if (el.type === "text") return visibility.text;
    if (el.type === "image") return visibility.images;
    if (el.type === "shape" && isLineOrArrow(el)) return visibility.lines;
    if (el.type === "shape") return visibility.shapes;
    return true;
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">Slide preview</h2>
        {referenceImage && (
          <span className="text-xs text-slate-400">Reference overlay available</span>
        )}
      </div>

      <div className="mt-3 overflow-auto">
        <div
          className="relative mx-auto border border-slate-200 shadow-inner"
          style={{
            width: `${slide.width * scale}px`,
            height: `${slide.height * scale}px`,
            backgroundColor: slide.background_color,
          }}
        >
          {referenceImage && (
            <img
              src={referenceImage}
              alt="Reference"
              className="pointer-events-none absolute inset-0 h-full w-full object-fill opacity-20"
            />
          )}

          {visibleElements
            .sort((a, b) => a.z_index - b.z_index)
            .map((el) => {
              const isSelected = selectedId === el.id;
              const baseStyle: React.CSSProperties = {
                left: `${el.x * scale}px`,
                top: `${el.y * scale}px`,
                width: `${el.width * scale}px`,
                height: `${el.height * scale}px`,
                position: "absolute",
                boxSizing: "border-box",
                cursor: "pointer",
                outline: isSelected ? "2px solid #2563eb" : undefined,
                zIndex: el.z_index,
              };

              if (el.type === "text") {
                return (
                  <div
                    key={el.id}
                    style={{
                      ...baseStyle,
                      color: el.color ?? "#000",
                      fontSize: `${(el.font_size ?? 12) * 0.45}px`,
                      fontWeight: el.bold ? "bold" : "normal",
                      fontStyle: el.italic ? "italic" : "normal",
                      textAlign: el.alignment ?? "left",
                      overflow: "hidden",
                      lineHeight: 1.1,
                    }}
                    onClick={() => onSelectElement?.(el.id)}
                    title={el.text}
                  >
                    {el.text}
                  </div>
                );
              }

              if (el.type === "image" && el.image_data) {
                return (
                  <img
                    key={el.id}
                    src={el.image_data}
                    alt=""
                    style={{ ...baseStyle, objectFit: "contain" }}
                    onClick={() => onSelectElement?.(el.id)}
                  />
                );
              }

              if (el.type === "shape") {
                const isLine = isLineOrArrow(el);
                return (
                  <div
                    key={el.id}
                    style={{
                      ...baseStyle,
                      backgroundColor: isLine
                        ? "transparent"
                        : el.fill_color ?? "transparent",
                      border: isLine
                        ? "none"
                        : `1px solid ${el.line_color ?? el.fill_color ?? "#999"}`,
                      borderRadius:
                        el.shape === "roundedRect" ? "6px" : el.shape === "ellipse" ? "50%" : 0,
                      opacity: el.opacity ?? 1,
                      transform: `rotate(${el.rotation ?? 0}deg)`,
                    }}
                    onClick={() => onSelectElement?.(el.id)}
                  />
                );
              }

              return null;
            })}
        </div>
      </div>
    </div>
  );
}
