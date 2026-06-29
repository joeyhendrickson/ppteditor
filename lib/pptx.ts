import PptxGenJS from "pptxgenjs";
import type {
  ImageElement,
  ShapeElement,
  SlideAnalysis,
  SlideElement,
  TextElement,
} from "@/types/slide";

function stripHash(color?: string): string {
  if (!color) return "000000";
  return color.replace("#", "").toUpperCase();
}

function sortByZIndex(elements: SlideElement[]): SlideElement[] {
  return [...elements].sort((a, b) => a.z_index - b.z_index);
}

function addShapeToSlide(
  slide: PptxGenJS.Slide,
  el: ShapeElement,
  pptx: PptxGenJS
): void {
  const opts: PptxGenJS.ShapeProps = {
    x: el.x,
    y: el.y,
    w: el.width,
    h: el.height,
    rotate: el.rotation ?? 0,
  };

  if (el.fill_color && el.shape !== "line") {
    opts.fill = {
      color: stripHash(el.fill_color),
      transparency: el.opacity != null ? (1 - el.opacity) * 100 : 0,
    };
  } else if (el.shape !== "line" && el.shape !== "arrow") {
    opts.fill = { type: "none" };
  }

  if (el.line_color || el.shape === "line" || el.shape === "arrow") {
    opts.line = {
      color: stripHash(el.line_color ?? el.fill_color ?? "#000000"),
      width: el.line_width ?? 1,
    };
  }

  switch (el.shape) {
    case "roundedRect":
      slide.addShape(pptx.ShapeType.roundRect, opts);
      break;
    case "ellipse":
      slide.addShape(pptx.ShapeType.ellipse, opts);
      break;
    case "line":
      slide.addShape(pptx.ShapeType.line, opts);
      break;
    case "arrow":
      slide.addShape(pptx.ShapeType.rightArrow, {
        ...opts,
        flipH: el.arrow_direction === "left",
        flipV: el.arrow_direction === "down",
      });
      break;
    case "freeform":
      slide.addShape(pptx.ShapeType.rect, opts);
      break;
    case "imagePlaceholder":
      slide.addShape(pptx.ShapeType.rect, {
        ...opts,
        fill: { color: "E8E8E8" },
        line: { color: "CCCCCC", width: 1, dashType: "dash" },
      });
      break;
    default:
      slide.addShape(pptx.ShapeType.rect, opts);
  }
}

function addTextToSlide(slide: PptxGenJS.Slide, el: TextElement): void {
  const alignMap: Record<string, PptxGenJS.HAlign> = {
    left: "left",
    center: "center",
    right: "right",
  };

  slide.addText(el.text, {
    x: el.x,
    y: el.y,
    w: el.width,
    h: el.height,
    fontFace: el.font_family ?? "Arial",
    fontSize: el.font_size ?? 14,
    bold: el.bold ?? false,
    italic: el.italic ?? false,
    color: stripHash(el.color ?? "#000000"),
    align: alignMap[el.alignment ?? "left"],
    valign: "middle",
    margin: 0,
  });
}

async function addImageToSlide(
  slide: PptxGenJS.Slide,
  el: ImageElement
): Promise<void> {
  if (!el.image_data) return;

  const data = el.image_data.includes(",")
    ? el.image_data.split(",")[1]
    : el.image_data;

  slide.addImage({
    data: `image/png;base64,${data.replace(/^data:image\/\w+;base64,/, "")}`,
    x: el.x,
    y: el.y,
    w: el.width,
    h: el.height,
  });
}

export async function generatePptxFromAnalysis(
  analysis: SlideAnalysis
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.defineLayout({
    name: "CUSTOM",
    width: analysis.slide.width,
    height: analysis.slide.height,
  });
  pptx.layout = "CUSTOM";

  const slide = pptx.addSlide();
  slide.background = { color: stripHash(analysis.slide.background_color) };

  const sorted = sortByZIndex(
    analysis.elements.filter((e) => e.visible !== false)
  );

  // Graphics first (shapes, lines, images), then text on top
  const shapes = sorted.filter((e) => e.type === "shape");
  const images = sorted.filter((e) => e.type === "image");
  const texts = sorted.filter((e) => e.type === "text");

  for (const el of shapes) {
    addShapeToSlide(slide, el as ShapeElement, pptx);
  }

  for (const el of images) {
    await addImageToSlide(slide, el as ImageElement);
  }

  for (const el of texts) {
    addTextToSlide(slide, el as TextElement);
  }

  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(output as ArrayBuffer);
}

export async function generateMultiSlidePptx(
  analyses: SlideAnalysis[]
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  const first = analyses[0];
  pptx.defineLayout({
    name: "CUSTOM",
    width: first?.slide.width ?? 13.333,
    height: first?.slide.height ?? 7.5,
  });
  pptx.layout = "CUSTOM";

  for (const analysis of analyses) {
    const slide = pptx.addSlide();
    slide.background = { color: stripHash(analysis.slide.background_color) };

    const sorted = sortByZIndex(
      analysis.elements.filter((e) => e.visible !== false)
    );
    const shapes = sorted.filter((e) => e.type === "shape");
    const images = sorted.filter((e) => e.type === "image");
    const texts = sorted.filter((e) => e.type === "text");

    for (const el of shapes) {
      addShapeToSlide(slide, el as ShapeElement, pptx);
    }
    for (const el of images) {
      await addImageToSlide(slide, el as ImageElement);
    }
    for (const el of texts) {
      addTextToSlide(slide, el as TextElement);
    }
  }

  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(output as ArrayBuffer);
}
