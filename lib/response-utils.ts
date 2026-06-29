import type { SlideAnalysis, SlideElement } from "@/types/slide";

/** Remove heavy base64 payloads from API responses (Vercel 4.5MB limit). */
export function slimSlideForResponse(
  slide: SlideAnalysis,
  options?: { keepReference?: boolean }
): SlideAnalysis {
  const keepReference = options?.keepReference ?? false;
  return {
    ...slide,
    reference_image: keepReference ? slide.reference_image : undefined,
    elements: slide.elements.map((el) => {
      if (el.type === "image" && el.image_data) {
        const { image_data, ...rest } = el;
        void image_data;
        return rest as SlideElement;
      }
      return el;
    }),
  };
}

export function slimSlidesForResponse(
  slides: SlideAnalysis[],
  options?: { keepReferenceOnIndex?: number }
): SlideAnalysis[] {
  const refIdx = options?.keepReferenceOnIndex ?? 0;
  return slides.map((s, i) =>
    slimSlideForResponse(s, { keepReference: i === refIdx })
  );
}

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel serverless request limit
export const MAX_UPLOAD_WARN_BYTES = 3 * 1024 * 1024;

export function validateUploadSize(bytes: number): string | null {
  if (bytes > MAX_UPLOAD_BYTES) {
    return `File is ${(bytes / 1024 / 1024).toFixed(1)}MB. Vercel limits uploads to ~4MB. Export fewer slides, compress images, or run locally with npm run dev.`;
  }
  return null;
}
