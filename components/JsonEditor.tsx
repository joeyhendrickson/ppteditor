"use client";

import { useEffect, useState } from "react";
import type { SlideAnalysis } from "@/types/slide";

interface JsonEditorProps {
  analysis: SlideAnalysis | null;
  onChange: (analysis: SlideAnalysis) => void;
}

export function JsonEditor({ analysis, onChange }: JsonEditorProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (analysis) {
      setText(JSON.stringify(analysis, null, 2));
      setError(null);
    }
  }, [analysis]);

  const apply = () => {
    try {
      const parsed = JSON.parse(text) as SlideAnalysis;
      if (!parsed.slide || !Array.isArray(parsed.elements)) {
        throw new Error("Invalid slide analysis structure");
      }
      onChange(parsed);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">JSON editor</h2>
        <button
          type="button"
          onClick={apply}
          className="rounded-md bg-slate-800 px-3 py-1 text-xs text-white hover:bg-slate-700"
        >
          Apply JSON
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-64 w-full resize-y p-3 font-mono text-xs text-slate-700 outline-none"
        spellCheck={false}
        placeholder="Slide analysis JSON will appear here..."
      />
      {error && (
        <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
