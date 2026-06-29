"use client";

import { useCallback, useState } from "react";
import type {
  DiagnosticsReport,
  SlideAnalysis,
  SlideElement,
  VisibilityFilter,
} from "@/types/slide";
import { createElementId } from "@/types/slide";
import { apiPostForm, apiPostJson } from "@/lib/api-client";
import { UploadPanel } from "@/components/UploadPanel";
import { SlidePreview } from "@/components/SlidePreview";
import { SlideNavigator } from "@/components/SlideNavigator";
import { ElementsTable } from "@/components/ElementsTable";
import { LayerPanel } from "@/components/LayerPanel";
import { JsonEditor } from "@/components/JsonEditor";
import { GenerationControls } from "@/components/GenerationControls";

const defaultVisibility: VisibilityFilter = {
  text: true,
  shapes: true,
  lines: true,
  images: true,
};

type AnalyzeResponse = {
  slides: SlideAnalysis[];
  analysis: SlideAnalysis;
  diagnostics: DiagnosticsReport;
  slideCount: number;
  analyzeAll?: boolean;
  truncated?: boolean;
  truncatedMessage?: string;
};

type GenerateResponse = {
  pptxBase64: string;
  diagnostics: DiagnosticsReport;
  filename: string;
  slideCount: number;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideCount, setSlideCount] = useState(1);
  const [slides, setSlides] = useState<SlideAnalysis[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [analyzeAll, setAnalyzeAll] = useState(true);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsReport | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<VisibilityFilter>(defaultVisibility);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pptxBase64, setPptxBase64] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState("editable-slide.pptx");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const analysis = slides[activeSlideIndex] ?? null;

  const handleFileSelect = useCallback((f: File) => {
    setFile(f);
    setSlides([]);
    setDiagnostics(null);
    setPptxBase64(null);
    setSlideIndex(0);
    setActiveSlideIndex(0);
    setSlideCount(1);
    setError(null);
    setInfo(null);
    const isDeck =
      f.name.toLowerCase().endsWith(".pptx") ||
      f.name.toLowerCase().endsWith(".pdf");
    setAnalyzeAll(isDeck);
  }, []);

  const updateSlideAt = (index: number, updated: SlideAnalysis) => {
    setSlides((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    setInfo(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("slideIndex", String(slideIndex));
      formData.append("analyzeAll", analyzeAll ? "true" : "false");

      const data = await apiPostForm<AnalyzeResponse>(
        "/api/analyze-slide",
        formData
      );

      setSlides(data.slides);
      setActiveSlideIndex(0);
      setDiagnostics(data.diagnostics);
      setSlideCount(data.slideCount ?? data.slides.length);
      setPptxBase64(null);
      if (data.truncated && data.truncatedMessage) {
        setInfo(data.truncatedMessage);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (slides.length === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const data = await apiPostJson<GenerateResponse>("/api/generate-pptx", {
        analyses: slides,
      });

      setPptxBase64(data.pptxBase64);
      setDownloadFilename(data.filename);
      setDiagnostics(data.diagnostics);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!pptxBase64) return;
    const bytes = Uint8Array.from(atob(pptxBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateElement = (id: string, patch: Partial<SlideElement>) => {
    if (!analysis) return;
    updateSlideAt(activeSlideIndex, {
      ...analysis,
      elements: analysis.elements.map((el) =>
        el.id === id ? { ...el, ...patch } as SlideElement : el
      ),
    });
  };

  const deleteElement = (id: string) => {
    if (!analysis) return;
    updateSlideAt(activeSlideIndex, {
      ...analysis,
      elements: analysis.elements.filter((el) => el.id !== id),
    });
    if (selectedId === id) setSelectedId(null);
  };

  const reorderElement = (id: string, direction: "up" | "down") => {
    if (!analysis) return;
    const el = analysis.elements.find((e) => e.id === id);
    if (!el) return;
    const delta = direction === "up" ? 1 : -1;
    updateElement(id, { z_index: el.z_index + delta });
  };

  const duplicateElement = (id: string) => {
    if (!analysis) return;
    const el = analysis.elements.find((e) => e.id === id);
    if (!el) return;
    const newEl = {
      ...el,
      id: createElementId(analysis.elements.length + 1),
      x: el.x + 0.2,
      y: el.y + 0.2,
      z_index: el.z_index + 1,
    } as SlideElement;
    updateSlideAt(activeSlideIndex, {
      ...analysis,
      elements: [...analysis.elements, newEl],
    });
  };

  const addTextElement = () => {
    if (!analysis) return;
    const id = createElementId(analysis.elements.length + 1);
    const newEl: SlideElement = {
      id,
      type: "text",
      text: "New text",
      x: 1,
      y: 1,
      width: 3,
      height: 0.5,
      z_index: 200,
      font_family: "Arial",
      font_size: 18,
      color: "#000000",
      alignment: "left",
      confidence: 1,
      visible: true,
    };
    updateSlideAt(activeSlideIndex, {
      ...analysis,
      elements: [...analysis.elements, newEl],
    });
    setSelectedId(id);
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <h1 className="text-xl font-bold text-slate-900">
            Editable Slide Converter
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload a full PPTX/PDF deck or a single slide — rebuild as editable
            PowerPoint objects, not flattened screenshots.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {info && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {info}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-3 space-y-4">
            <UploadPanel
              onFileSelect={handleFileSelect}
              selectedFile={file}
              slideIndex={slideIndex}
              slideCount={slideCount}
              onSlideIndexChange={setSlideIndex}
              analyzeAll={analyzeAll}
              onAnalyzeAllChange={setAnalyzeAll}
              disabled={analyzing}
            />
            {slides.length > 1 && (
              <SlideNavigator
                slideCount={slides.length}
                activeIndex={activeSlideIndex}
                onSelect={setActiveSlideIndex}
                disabled={analyzing}
              />
            )}
            <GenerationControls
              onAnalyze={handleAnalyze}
              onGenerate={handleGenerate}
              onDownload={handleDownload}
              analyzing={analyzing}
              generating={generating}
              canAnalyze={Boolean(file)}
              canGenerate={slides.length > 0}
              canDownload={Boolean(pptxBase64)}
              visibility={visibility}
              onVisibilityChange={setVisibility}
              onAddElement={addTextElement}
              diagnostics={diagnostics}
              deckSlideCount={slides.length}
            />
          </div>

          <div className="lg:col-span-6 space-y-4">
            <SlidePreview
              analysis={analysis}
              referenceImage={analysis?.reference_image}
              visibility={visibility}
              selectedId={selectedId}
              onSelectElement={setSelectedId}
              slideLabel={
                slides.length > 1
                  ? `Slide ${activeSlideIndex + 1} of ${slides.length}`
                  : undefined
              }
            />
            {pptxBase64 && analysis?.reference_image && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800">
                  Quality comparison
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Left: original reference. Right: reconstructed layout preview.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={analysis.reference_image}
                    alt="Original"
                    className="rounded border border-slate-200"
                  />
                  <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500 flex items-center justify-center">
                    {slides.length > 1
                      ? `${slides.length} slides in deck — download PPTX to edit`
                      : "Download PPTX to edit in PowerPoint"}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-3 space-y-4">
            <LayerPanel
              elements={analysis?.elements ?? []}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onReorder={reorderElement}
              onDuplicate={duplicateElement}
              onUpdate={updateElement}
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ElementsTable
            elements={analysis?.elements ?? []}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdate={updateElement}
            onDelete={deleteElement}
            confidences={diagnostics?.element_confidences}
          />
          <JsonEditor
            analysis={analysis}
            onChange={(a) => updateSlideAt(activeSlideIndex, a)}
          />
        </div>
      </div>
    </main>
  );
}
