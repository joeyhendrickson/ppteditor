import { NextRequest, NextResponse } from "next/server";
import type { SlideAnalysis } from "@/types/slide";
import {
  generatePptxFromAnalysis,
  generateMultiSlidePptx,
} from "@/lib/pptx";
import { generateDiagnostics } from "@/lib/diagnostics";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const analyses: SlideAnalysis[] = Array.isArray(body.analyses)
      ? body.analyses
      : body.analysis
        ? [body.analysis as SlideAnalysis]
        : [];

    const referenceText = body.referenceText as string | undefined;

    if (analyses.length === 0) {
      return NextResponse.json(
        { error: "Invalid analysis payload — provide analysis or analyses" },
        { status: 400 }
      );
    }

    for (const a of analyses) {
      if (!a?.slide || !Array.isArray(a.elements)) {
        return NextResponse.json(
          { error: "Each slide must include slide metadata and elements" },
          { status: 400 }
        );
      }
    }

    const pptxBuffer =
      analyses.length === 1
        ? await generatePptxFromAnalysis(analyses[0])
        : await generateMultiSlidePptx(analyses);

    const diagnostics = generateDiagnostics(analyses[0], referenceText);
    const base64 = pptxBuffer.toString("base64");
    const previewImage = analyses[0]?.reference_image;
    const filename =
      analyses.length > 1
        ? "editable-presentation.pptx"
        : "editable-slide.pptx";

    return NextResponse.json({
      pptxBase64: base64,
      diagnostics,
      previewImage,
      filename,
      slideCount: analyses.length,
    });
  } catch (error) {
    console.error("generate-pptx error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate PPTX";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
