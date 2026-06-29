import { NextRequest, NextResponse } from "next/server";
import {
  cleanupTempDir,
  ensureTmpDir,
  getFileCategory,
  isSupportedFile,
  writeTempFile,
} from "@/lib/file-utils";
import {
  preprocessImage,
  pdfPageToImage,
  getPdfPageCount,
} from "@/lib/image-analysis";
import { analyzeSlideImage } from "@/lib/openai";
import {
  parsePptxFile,
  parseAllPptxSlides,
  getPptxSlideCount,
} from "@/lib/pptx-parser";
import { generateDiagnostics } from "@/lib/diagnostics";
import type { SlideAnalysis } from "@/types/slide";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Cap vision-based multi-page analysis on serverless (time + cost). */
const MAX_VISION_SLIDES = 30;

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
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!isSupportedFile(file.name)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Use PPTX, PDF, PNG, JPG, JPEG, or WEBP. Legacy .ppt files must be saved as .pptx first.",
        },
        { status: 400 }
      );
    }

    tmpDir = await ensureTmpDir();
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = await writeTempFile(tmpDir, file.name, buffer);
    const category = getFileCategory(file.name);

    let slides: SlideAnalysis[] = [];
    let slideCount = 1;

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
    } else if (category === "pdf") {
      slideCount = await getPdfPageCount(filePath);
      const indices = analyzeAll
        ? Array.from(
            { length: Math.min(slideCount, MAX_VISION_SLIDES) },
            (_, i) => i
          )
        : [Math.min(slideIndex, slideCount - 1)];

      if (analyzeAll && slideCount > MAX_VISION_SLIDES) {
        console.warn(
          `PDF has ${slideCount} pages; analyzing first ${MAX_VISION_SLIDES} with vision`
        );
      }

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
        return NextResponse.json(
          {
            error:
              "Single images can only be analyzed as one slide. Upload a PPTX or PDF for full-deck conversion.",
          },
          { status: 400 }
        );
      }
      const preprocessed = await preprocessImage(buffer);
      const analysis = await analyzeSlideImage(preprocessed.base64);
      analysis.source_type = "image";
      analysis.reference_image = preprocessed.base64;
      slides = [analysis];
    }

    const activeIndex = analyzeAll ? 0 : slides[0]?.slide_index ?? slideIndex;
    const diagnostics = generateDiagnostics(
      slides[activeIndex] ?? slides[0]
    );

    return NextResponse.json({
      slides,
      analysis: slides[activeIndex] ?? slides[0],
      diagnostics,
      slideCount,
      analyzeAll,
      truncated:
        category === "pdf" && analyzeAll && slideCount > MAX_VISION_SLIDES,
      truncatedMessage:
        category === "pdf" && analyzeAll && slideCount > MAX_VISION_SLIDES
          ? `Analyzed first ${MAX_VISION_SLIDES} of ${slideCount} PDF pages (server limit). Split large PDFs or analyze single pages.`
          : undefined,
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
