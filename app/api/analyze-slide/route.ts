import { NextRequest, NextResponse } from "next/server";
import {
  cleanupTempDir,
  ensureTmpDir,
  getFileCategory,
  isSupportedFile,
  writeTempFile,
} from "@/lib/file-utils";
import {
  parsePptxFile,
  parseAllPptxSlides,
  getPptxSlideCount,
} from "@/lib/pptx-parser";
import {
  generatePptxFromAnalysis,
  generateMultiSlidePptx,
} from "@/lib/pptx";
import { generateDiagnostics } from "@/lib/diagnostics";
import {
  slimSlidesForResponse,
  validateUploadSize,
} from "@/lib/response-utils";
import type { SlideAnalysis } from "@/types/slide";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Cap vision-based multi-page analysis on serverless (time + cost). */
const MAX_VISION_SLIDES = 15;

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  let tmpDir: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const slideIndex = Number(formData.get("slideIndex") ?? 0);
    const analyzeAll =
      formData.get("analyzeAll") === "true" ||
      formData.get("analyzeAll") === "1";

    if (!file) {
      return jsonError("No file uploaded", 400);
    }

    const sizeError = validateUploadSize(file.size);
    if (sizeError) {
      return jsonError(sizeError, 413);
    }

    if (!isSupportedFile(file.name)) {
      return jsonError(
        "Unsupported file type. Use PPTX, PDF, PNG, JPG, JPEG, or WEBP. Legacy .ppt files must be saved as .pptx first.",
        400
      );
    }

    tmpDir = await ensureTmpDir();
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = await writeTempFile(tmpDir, file.name, buffer);
    const category = getFileCategory(file.name);

    let slides: SlideAnalysis[] = [];
    let slideCount = 1;
    let pptxBase64: string | undefined;
    let pptxFilename = "editable-slide.pptx";

    if (category === "pptx") {
      slideCount = await getPptxSlideCount(buffer);
      if (analyzeAll) {
        slides = await parseAllPptxSlides(buffer);
      } else {
        slides = [await parsePptxFile(buffer, slideIndex)];
      }
      for (const s of slides) {
        s.source_type = "pptx";
        s.slide_count = slideCount;
      }

      // Build editable PPTX server-side (avoids huge JSON round-trip with embedded images)
      const pptxBuffer =
        slides.length > 1
          ? await generateMultiSlidePptx(slides)
          : await generatePptxFromAnalysis(slides[0]);
      pptxBase64 = pptxBuffer.toString("base64");
      pptxFilename =
        slides.length > 1 ? "editable-presentation.pptx" : "editable-slide.pptx";
    } else if (category === "pdf") {
      const {
        preprocessImage,
        pdfPageToImage,
        getPdfPageCount,
      } = await import("@/lib/image-analysis");
      const { analyzeSlideImage } = await import("@/lib/openai");

      slideCount = await getPdfPageCount(filePath);
      const indices = analyzeAll
        ? Array.from(
            { length: Math.min(slideCount, MAX_VISION_SLIDES) },
            (_, i) => i
          )
        : [Math.min(slideIndex, slideCount - 1)];

      for (const idx of indices) {
        const page = await pdfPageToImage(filePath, idx);
        const preprocessed = await preprocessImage(page.buffer);
        const analysis = await analyzeSlideImage(preprocessed.base64);
        analysis.source_type = "pdf";
        analysis.slide_index = idx;
        analysis.slide_count = slideCount;
        analysis.reference_image = preprocessed.base64;
        slides.push(analysis);
      }
    } else {
      if (analyzeAll) {
        return jsonError(
          "Single images can only be analyzed as one slide. Upload a PPTX or PDF for full-deck conversion.",
          400
        );
      }
      const { preprocessImage } = await import("@/lib/image-analysis");
      const { analyzeSlideImage } = await import("@/lib/openai");
      const preprocessed = await preprocessImage(buffer);
      const analysis = await analyzeSlideImage(preprocessed.base64);
      analysis.source_type = "image";
      analysis.reference_image = preprocessed.base64;
      slides = [analysis];
    }

    if (slides.length === 0) {
      return jsonError("No slides could be analyzed", 400);
    }

    const activeIndex = analyzeAll ? 0 : slides[0]?.slide_index ?? slideIndex;
    const diagnostics = generateDiagnostics(
      slides[activeIndex] ?? slides[0]
    );

    const responseSlides = slimSlidesForResponse(slides, {
      keepReferenceOnIndex: activeIndex,
    });

    const payload = {
      slides: responseSlides,
      analysis: responseSlides[activeIndex] ?? responseSlides[0],
      diagnostics,
      slideCount,
      analyzeAll,
      pptxBase64,
      pptxFilename,
      truncated:
        category === "pdf" && analyzeAll && slideCount > MAX_VISION_SLIDES,
      truncatedMessage:
        category === "pdf" && analyzeAll && slideCount > MAX_VISION_SLIDES
          ? `Analyzed first ${MAX_VISION_SLIDES} of ${slideCount} PDF pages (server limit). Split large PDFs or analyze single pages.`
          : undefined,
    };

    try {
      return NextResponse.json(payload);
    } catch {
      return jsonError(
        "Response too large. Try a smaller file, fewer slides, or run locally with npm run dev.",
        413
      );
    }
  } catch (error) {
    console.error("analyze-slide error:", error);
    const message =
      error instanceof Error ? error.message : "Analysis failed";
    if (message.includes("model") || message.includes("OPENAI")) {
      return jsonError(
        `${message}. Check OPENAI_API_KEY and OPENAI_MODEL in Vercel environment variables.`,
        500
      );
    }
    return jsonError(message, 500);
  } finally {
    if (tmpDir) {
      await cleanupTempDir(tmpDir);
    }
  }
}
