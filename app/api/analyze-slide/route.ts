import { NextRequest, NextResponse } from "next/server";
import {
  cleanupTempDir,
  ensureTmpDir,
  getFileCategory,
  isSupportedFile,
  writeTempFile,
} from "@/lib/file-utils";
import { preprocessImage, pdfPageToImage, getPdfPageCount } from "@/lib/image-analysis";
import { analyzeSlideImage } from "@/lib/openai";
import { parsePptxFile, getPptxSlideCount } from "@/lib/pptx-parser";
import { generateDiagnostics } from "@/lib/diagnostics";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let tmpDir: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const slideIndex = Number(formData.get("slideIndex") ?? 0);

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!isSupportedFile(file.name)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use PPTX, PDF, PNG, JPG, JPEG, or WEBP." },
        { status: 400 }
      );
    }

    tmpDir = await ensureTmpDir();
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = await writeTempFile(tmpDir, file.name, buffer);
    const category = getFileCategory(file.name);

    let analysis;
    let referenceImage: string | undefined;
    let slideCount = 1;

    if (category === "pptx") {
      slideCount = await getPptxSlideCount(buffer);
      analysis = await parsePptxFile(buffer, slideIndex);
      analysis.source_type = "pptx";
      analysis.slide_index = slideIndex;
      analysis.slide_count = slideCount;
    } else if (category === "pdf") {
      slideCount = await getPdfPageCount(filePath);
      const page = await pdfPageToImage(filePath, slideIndex);
      referenceImage = page.base64;
      const preprocessed = await preprocessImage(page.buffer);
      referenceImage = preprocessed.base64;

      analysis = await analyzeSlideImage(preprocessed.base64);
      analysis.source_type = "pdf";
      analysis.slide_index = slideIndex;
      analysis.slide_count = slideCount;
      analysis.reference_image = referenceImage;
    } else {
      const preprocessed = await preprocessImage(buffer);
      referenceImage = preprocessed.base64;
      analysis = await analyzeSlideImage(preprocessed.base64);
      analysis.source_type = "image";
      analysis.reference_image = referenceImage;
    }

    if (!analysis.reference_image && referenceImage) {
      analysis.reference_image = referenceImage;
    }

    const diagnostics = generateDiagnostics(analysis);

    return NextResponse.json({
      analysis,
      diagnostics,
      slideCount,
    });
  } catch (error) {
    console.error("analyze-slide error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to analyze slide";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (tmpDir) {
      await cleanupTempDir(tmpDir);
    }
  }
}
