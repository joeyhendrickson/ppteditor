import type {
  DiagnosticsIssue,
  DiagnosticsReport,
  SlideAnalysis,
  SlideElement,
} from "@/types/slide";
import { CONFIDENCE_THRESHOLD, isLineOrArrow } from "@/types/slide";

export function generateDiagnostics(
  analysis: SlideAnalysis,
  referenceText?: string
): DiagnosticsReport {
  const issues: DiagnosticsIssue[] = [];
  const element_confidences: Record<string, number> = {};

  const textElements = analysis.elements.filter((e) => e.type === "text");
  const detectedText = textElements
    .map((e) => (e.type === "text" ? e.text : ""))
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (referenceText) {
    const ref = referenceText.toLowerCase().replace(/\s+/g, " ").trim();
    const refWords = new Set(ref.split(/\s+/).filter(Boolean));
    const detWords = new Set(detectedText.split(/\s+/).filter(Boolean));

    for (const word of Array.from(refWords)) {
      if (word.length > 2 && !detWords.has(word)) {
        issues.push({
          type: "missing_text",
          message: `Reference contains "${word}" but it was not detected`,
          severity: "medium",
        });
      }
    }

    for (const word of Array.from(detWords)) {
      if (word.length > 2 && !refWords.has(word)) {
        issues.push({
          type: "extra_text",
          message: `Detected "${word}" which may not be in reference`,
          severity: "low",
        });
      }
    }
  }

  for (const el of analysis.elements) {
    const confidence = el.confidence ?? 0.75;
    element_confidences[el.id] = confidence;

    if (confidence < CONFIDENCE_THRESHOLD) {
      if (el.type === "text") {
        issues.push({
          type: "low_confidence_text",
          element_id: el.id,
          message: `Low confidence text: "${el.text.slice(0, 40)}" (${confidence.toFixed(2)})`,
          severity: "medium",
        });
      } else if (el.type === "shape") {
        issues.push({
          type: "low_confidence_shape",
          element_id: el.id,
          message: `Low confidence shape (${el.shape}) at (${el.x.toFixed(2)}, ${el.y.toFixed(2)}) — ${confidence.toFixed(2)}`,
          severity: "low",
        });
      }
    }

    if (el.width <= 0 || el.height <= 0) {
      issues.push({
        type: "misaligned",
        element_id: el.id,
        message: `Element has zero or negative dimensions`,
        severity: "high",
      });
    }

    if (el.x < -0.5 || el.y < -0.5) {
      issues.push({
        type: "misaligned",
        element_id: el.id,
        message: `Element position may be off-slide (${el.x.toFixed(2)}, ${el.y.toFixed(2)})`,
        severity: "medium",
      });
    }
  }

  // Overlap heuristic for text on text
  for (let i = 0; i < textElements.length; i++) {
    for (let j = i + 1; j < textElements.length; j++) {
      const a = textElements[i];
      const b = textElements[j];
      if (boxesOverlap(a, b)) {
        issues.push({
          type: "misaligned",
          element_id: a.id,
          message: `Text boxes ${a.id} and ${b.id} overlap — review positions`,
          severity: "low",
        });
      }
    }
  }

  const confidences = Object.values(element_confidences);
  const overall_confidence =
    confidences.length > 0
      ? confidences.reduce((s, c) => s + c, 0) / confidences.length
      : 0;

  return {
    issues,
    overall_confidence,
    element_confidences,
  };
}

function boxesOverlap(a: SlideElement, b: SlideElement): boolean {
  const margin = 0.05;
  return (
    a.x < b.x + b.width - margin &&
    a.x + a.width - margin > b.x &&
    a.y < b.y + b.height - margin &&
    a.y + a.height - margin > b.y
  );
}

export function filterElementsByVisibility(
  analysis: SlideAnalysis,
  filters: {
    text: boolean;
    shapes: boolean;
    lines: boolean;
    images: boolean;
  }
): SlideElement[] {
  return analysis.elements.filter((el) => {
    if (el.type === "text") return filters.text;
    if (el.type === "image") return filters.images;
    if (el.type === "shape" && isLineOrArrow(el)) return filters.lines;
    if (el.type === "shape") return filters.shapes;
    return true;
  });
}
