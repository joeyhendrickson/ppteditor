import { NextRequest, NextResponse } from "next/server";
import type { SlideAnalysis } from "@/types/slide";
import { generatePptxFromAnalysis } from "@/lib/pptx";
import { generateDiagnostics } from "@/lib/diagnostics";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const analysis = body.analysis as SlideAnalysis;
    const referenceText = body.referenceText as string | undefined;

    if (!analysis?.slide || !Array.isArray(analysis.elements)) {
      return NextResponse.json(
        { error: "Invalid analysis payload" },
        { status: 400 }
      );
    }

    const pptxBuffer = await generatePptxFromAnalysis(analysis);
    const diagnostics = generateDiagnostics(analysis, referenceText);

    const base64 = pptxBuffer.toString("base64");

    const previewImage: string | undefined = analysis.reference_image;

    return NextResponse.json({
      pptxBase64: base64,
      diagnostics,
      previewImage,
      filename: "editable-slide.pptx",
    });
  } catch (error) {
    console.error("generate-pptx error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate PPTX";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
