export type ShapeKind =
  | "rect"
  | "roundedRect"
  | "ellipse"
  | "line"
  | "arrow"
  | "freeform"
  | "imagePlaceholder";

export type ElementType = "shape" | "text" | "image";

export type TextAlignment = "left" | "center" | "right";

export interface SlideMeta {
  width: number;
  height: number;
  background_color: string;
}

export interface SlideElementBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  confidence?: number;
  visible?: boolean;
}

export interface ShapeElement extends SlideElementBase {
  type: "shape";
  shape: ShapeKind;
  fill_color?: string;
  line_color?: string;
  line_width?: number;
  opacity?: number;
  rotation?: number;
  /** Arrow direction for arrow shapes */
  arrow_direction?: "left" | "right" | "up" | "down";
}

export interface TextElement extends SlideElementBase {
  type: "text";
  text: string;
  font_family?: string;
  font_size?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  alignment?: TextAlignment;
}

export interface ImageElement extends SlideElementBase {
  type: "image";
  image_data?: string; // base64
  image_path?: string;
}

export type SlideElement = ShapeElement | TextElement | ImageElement;

export interface SlideAnalysis {
  slide: SlideMeta;
  elements: SlideElement[];
  source_type?: "image" | "pdf" | "pptx" | "vision";
  slide_index?: number;
  slide_count?: number;
  reference_image?: string; // base64 preview of source
}

export interface SlideDeckAnalysis {
  slides: SlideAnalysis[];
  slide_count: number;
  source_type?: SlideAnalysis["source_type"];
}

export interface DiagnosticsIssue {
  type:
    | "missing_text"
    | "extra_text"
    | "misaligned"
    | "low_confidence_shape"
    | "low_confidence_text";
  element_id?: string;
  message: string;
  severity: "low" | "medium" | "high";
}

export interface DiagnosticsReport {
  issues: DiagnosticsIssue[];
  overall_confidence: number;
  element_confidences: Record<string, number>;
}

export type VisibilityFilter = {
  text: boolean;
  shapes: boolean;
  lines: boolean;
  images: boolean;
};

export const DEFAULT_SLIDE: SlideMeta = {
  width: 13.333,
  height: 7.5,
  background_color: "#FFFFFF",
};

export const CONFIDENCE_THRESHOLD = 0.6;

export function createElementId(index: number): string {
  return `element_${String(index).padStart(3, "0")}`;
}

export function isLineOrArrow(el: SlideElement): boolean {
  return (
    el.type === "shape" &&
    (el.shape === "line" || el.shape === "arrow")
  );
}

export function isShapeElement(el: SlideElement): boolean {
  return el.type === "shape" && !isLineOrArrow(el);
}
