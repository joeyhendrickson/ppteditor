import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type {
  ImageElement,
  ShapeElement,
  ShapeKind,
  SlideAnalysis,
  SlideElement,
  TextElement,
} from "@/types/slide";
import { DEFAULT_SLIDE, createElementId } from "@/types/slide";
import { emuToInches } from "./image-analysis";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  isArray: (name) =>
    ["p", "sp", "pic", "cxnSp", "grpSp"].includes(name) ||
    name === "a:t" ||
    name === "a:r",
});

const EMU_PER_INCH = 914400;

function asArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function hexFromColor(color?: {
  srgbClr?: { "@_val"?: string };
  schemeClr?: { "@_val"?: string };
}): string | undefined {
  if (color?.srgbClr?.["@_val"]) {
    return `#${color.srgbClr["@_val"]}`;
  }
  return undefined;
}

function getTransform(
  xfrm?: {
    off?: { "@_x"?: string; "@_y"?: string };
    ext?: { "@_w"?: string; "@_h"?: string };
    rot?: string;
  }
): { x: number; y: number; width: number; height: number; rotation: number } {
  const x = emuToInches(Number(xfrm?.off?.["@_x"] ?? 0));
  const y = emuToInches(Number(xfrm?.off?.["@_y"] ?? 0));
  const width = emuToInches(Number(xfrm?.ext?.["@_w"] ?? 0));
  const height = emuToInches(Number(xfrm?.ext?.["@_h"] ?? 0));
  const rotation = xfrm?.rot
    ? Number(xfrm.rot) / 60000
    : 0;
  return { x, y, width, height, rotation };
}

function mapPresetToShape(prst?: string): ShapeKind {
  const map: Record<string, ShapeKind> = {
    rect: "rect",
    roundRect: "roundedRect",
    ellipse: "ellipse",
    line: "line",
    straightConnector1: "line",
    rightArrow: "arrow",
    leftArrow: "arrow",
    upArrow: "arrow",
    downArrow: "arrow",
    bentConnector3: "line",
  };
  return map[prst ?? ""] ?? "rect";
}

function extractTextFromSp(sp: Record<string, unknown>): string {
  const txBody = sp.txBody as Record<string, unknown> | undefined;
  if (!txBody) return "";
  const paragraphs = asArray(txBody.p as Record<string, unknown>);
  const lines: string[] = [];

  for (const p of paragraphs) {
    const para = p as Record<string, unknown>;
    const runs = asArray(para.r as Record<string, unknown>);
    let line = "";
    for (const run of runs) {
      const r = run as Record<string, unknown>;
      const t = r.t as Record<string, unknown> | string | undefined;
      if (typeof t === "string") line += t;
      else if (t?.["#text"]) line += String(t["#text"]);
      else if (t && typeof t === "object" && "#text" in t)
        line += String((t as { "#text": string })["#text"]);
    }
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

function extractTextStyle(sp: Record<string, unknown>): Partial<TextElement> {
  const txBody = sp.txBody as Record<string, unknown> | undefined;
  const p = asArray(txBody?.p as Record<string, unknown>)[0] as
    | Record<string, unknown>
    | undefined;
  const r = asArray(p?.r as Record<string, unknown>)[0] as
    | Record<string, unknown>
    | undefined;
  const rPr = r?.rPr as Record<string, unknown> | undefined;
  const pPr = p?.pPr as Record<string, unknown> | undefined;

  const sz = rPr?.["@_sz"] ? Number(rPr["@_sz"]) / 100 : undefined;
  const bold = rPr?.["@_b"] === "1" || rPr?.["@_b"] === "true";
  const italic = rPr?.["@_i"] === "1" || rPr?.["@_i"] === "true";

  const solidFill = rPr?.solidFill as Record<string, unknown> | undefined;
  const color = hexFromColor(solidFill as Parameters<typeof hexFromColor>[0]);

  let alignment: TextElement["alignment"] = "left";
  const algn = pPr?.["@_algn"] as string | undefined;
  if (algn === "ctr") alignment = "center";
  if (algn === "r") alignment = "right";

  return {
    font_size: sz,
    bold,
    italic,
    color,
    alignment,
    font_family: "Arial",
  };
}

function extractShapeStyle(spPr: Record<string, unknown>): Partial<ShapeElement> {
  const xfrm = spPr.xfrm as Record<string, unknown> | undefined;
  const prstGeom = spPr.prstGeom as Record<string, unknown> | undefined;
  const prst = prstGeom?.["@_prst"] as string | undefined;

  const spPrFill = spPr as Record<string, unknown>;
  const solidFill = spPrFill.solidFill as Record<string, unknown> | undefined;
  const ln = spPrFill.ln as Record<string, unknown> | undefined;
  const lnFill = ln?.solidFill as Record<string, unknown> | undefined;

  const fill_color = hexFromColor(
    solidFill as Parameters<typeof hexFromColor>[0]
  );
  const line_color = hexFromColor(
    lnFill as Parameters<typeof hexFromColor>[0]
  );
  const line_width = ln?.["@_w"]
    ? Number(ln["@_w"]) / 12700
    : undefined;

  const transform = getTransform(
    xfrm as Parameters<typeof getTransform>[0]
  );

  return {
    shape: mapPresetToShape(prst),
    fill_color,
    line_color,
    line_width,
    ...transform,
    opacity: 1,
  };
}

async function loadSlideSize(zip: JSZip): Promise<{ width: number; height: number }> {
  const presXml = await zip.file("ppt/presentation.xml")?.async("string");
  if (!presXml) return { width: DEFAULT_SLIDE.width, height: DEFAULT_SLIDE.height };

  const doc = parser.parse(presXml);
  const sldSz = doc.presentation?.sldSz;
  const w = emuToInches(Number(sldSz?.["@_cx"] ?? DEFAULT_SLIDE.width * EMU_PER_INCH));
  const h = emuToInches(Number(sldSz?.["@_cy"] ?? DEFAULT_SLIDE.height * EMU_PER_INCH));
  return { width: w, height: h };
}

async function getSlidePaths(zip: JSZip): Promise<string[]> {
  const presXml = await zip.file("ppt/presentation.xml")?.async("string");
  if (!presXml) return [];

  const relsXml = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
  const relsDoc = parser.parse(relsXml ?? "");
  const relationships = asArray(
    relsDoc.Relationships?.Relationship as Record<string, unknown>
  );
  const slideRelIds: string[] = [];

  const presDoc = parser.parse(presXml);
  const sldIdLst = asArray(
    presDoc.presentation?.sldIdLst?.sldId as Record<string, unknown>
  );
  for (const item of sldIdLst) {
    const sldId = item as Record<string, unknown>;
    slideRelIds.push(String(sldId["@_id"]));
  }

  const slidePaths: string[] = [];
  for (const item of relationships) {
    const rel = item as Record<string, unknown>;
    const type = String(rel["@_Type"] ?? "");
    if (type.endsWith("/slide")) {
      const target = String(rel["@_Target"] ?? "");
      slidePaths.push(`ppt/${target.replace(/^\//, "")}`);
    }
  }

  // Order by presentation sldId if possible
  if (slidePaths.length > 0) return slidePaths;
  return Object.keys(zip.files).filter((f) =>
    f.match(/^ppt\/slides\/slide\d+\.xml$/)
  );
}

async function processShapeTree(
  spTree: Record<string, unknown>,
  elements: SlideElement[],
  mediaMap: Map<string, string>,
  zip: JSZip,
  zBase: number
): Promise<void> {
  const shapes = asArray(spTree.sp as Record<string, unknown>);
  const pics = asArray(spTree.pic as Record<string, unknown>);
  const connectors = asArray(spTree.cxnSp as Record<string, unknown>);
  const groups = asArray(spTree.grpSp as Record<string, unknown>);

  let z = zBase;

  for (const item of shapes) {
    const sp = item as Record<string, unknown>;
    const spPr = sp.spPr as Record<string, unknown> | undefined;
    if (!spPr) continue;

    const text = extractTextFromSp(sp);
    const style = extractShapeStyle(spPr);
    const id = createElementId(elements.length + 1);

    const hasFill = Boolean(style.fill_color);
    const hasLine = Boolean(style.line_color || style.line_width);

    if (text.trim()) {
      const textEl: TextElement = {
        id: `${id}_text`,
        type: "text",
        text: text.trim(),
        x: style.x ?? 0,
        y: style.y ?? 0,
        width: style.width ?? 1,
        height: style.height ?? 0.5,
        z_index: z + 100,
        confidence: 0.95,
        visible: true,
        ...extractTextStyle(sp),
      };
      elements.push(textEl);
    }

    if (hasFill || hasLine || !text.trim()) {
      const shapeEl: ShapeElement = {
        id,
        type: "shape",
        shape: style.shape ?? "rect",
        x: style.x ?? 0,
        y: style.y ?? 0,
        width: style.width ?? 1,
        height: style.height ?? 0.5,
        fill_color: style.fill_color,
        line_color: style.line_color,
        line_width: style.line_width,
        opacity: style.opacity ?? 1,
        rotation: style.rotation ?? 0,
        z_index: z,
        confidence: 0.95,
        visible: true,
      };
      elements.push(shapeEl);
    }
    z += 1;
  }

  for (const item of connectors) {
    const cxn = item as Record<string, unknown>;
    const spPr = cxn.spPr as Record<string, unknown> | undefined;
    if (!spPr) continue;
    const style = extractShapeStyle(spPr);
    const id = createElementId(elements.length + 1);
    elements.push({
      id,
      type: "shape",
      shape: "line",
      x: style.x ?? 0,
      y: style.y ?? 0,
      width: style.width ?? 1,
      height: style.height ?? 0.01,
      line_color: style.line_color ?? "#000000",
      line_width: style.line_width ?? 1,
      z_index: z,
      confidence: 0.9,
      visible: true,
    });
    z += 1;
  }

  for (const item of pics) {
    const pic = item as Record<string, unknown>;
    const spPr = pic.spPr as Record<string, unknown> | undefined;
    const blipFill = pic.blipFill as Record<string, unknown> | undefined;
    const blip = blipFill?.blip as Record<string, unknown> | undefined;
    const embedId = blip?.["@_embed"] as string | undefined;

    const style = spPr ? extractShapeStyle(spPr) : {
      x: 0, y: 0, width: 2, height: 2, rotation: 0,
    };

    let image_data: string | undefined;
    if (embedId && mediaMap.has(embedId)) {
      const mediaPath = mediaMap.get(embedId)!;
      const file = zip.file(mediaPath);
      if (file) {
        const buf = await file.async("nodebuffer");
        const ext = mediaPath.split(".").pop()?.toLowerCase();
        const mime =
          ext === "png"
            ? "image/png"
            : ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : "image/png";
        image_data = `data:${mime};base64,${buf.toString("base64")}`;
      }
    }

    const id = createElementId(elements.length + 1);
    const imgEl: ImageElement = {
      id,
      type: "image",
      x: style.x ?? 0,
      y: style.y ?? 0,
      width: style.width ?? 2,
      height: style.height ?? 2,
      z_index: z,
      confidence: 0.95,
      visible: true,
      image_data,
    };
    elements.push(imgEl);
    z += 1;
  }

  for (const item of groups) {
    const grp = item as Record<string, unknown>;
    const grpSpPr = grp.grpSpPr as Record<string, unknown> | undefined;
    const grpSp = grp;
    const childTree = grpSp.spTree as Record<string, unknown> | undefined;
    if (childTree) {
      await processShapeTree(childTree, elements, mediaMap, zip, z);
    }
    void grpSpPr;
  }
}

async function buildMediaMap(
  zip: JSZip,
  slidePath: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const relPath = slidePath.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels";
  const relsXml = await zip.file(relPath)?.async("string");
  if (!relsXml) return map;

  const doc = parser.parse(relsXml);
  const relationships = asArray(
    doc.Relationships?.Relationship as Record<string, unknown>
  );

  for (const item of relationships) {
    const rel = item as Record<string, unknown>;
    const id = String(rel["@_Id"] ?? "");
    const target = String(rel["@_Target"] ?? "");
    const type = String(rel["@_Type"] ?? "");
    if (type.includes("/image")) {
      const mediaPath = target.startsWith("../")
        ? `ppt/${target.replace("../", "")}`
        : `ppt/slides/${target}`;
      map.set(id, mediaPath);
    }
  }
  return map;
}

export async function parsePptxFile(
  pptxBuffer: Buffer,
  slideIndex = 0
): Promise<SlideAnalysis> {
  const zip = await JSZip.loadAsync(pptxBuffer);
  const slidePaths = await getSlidePaths(zip);
  const slideCount = slidePaths.length;

  if (slideCount === 0) {
    throw new Error("No slides found in PPTX");
  }

  const idx = Math.min(slideIndex, slideCount - 1);
  const slidePath = slidePaths[idx];
  const slideXml = await zip.file(slidePath)?.async("string");
  if (!slideXml) {
    throw new Error(`Could not read slide ${idx + 1}`);
  }

  const slideSize = await loadSlideSize(zip);
  const mediaMap = await buildMediaMap(zip, slidePath);
  const doc = parser.parse(slideXml);

  const cSld = doc.sld?.cSld as Record<string, unknown> | undefined;
  const spTree = cSld?.spTree as Record<string, unknown> | undefined;

  const elements: SlideElement[] = [];
  if (spTree) {
    await processShapeTree(spTree, elements, mediaMap, zip, 1);
  }

  // Sort by z_index
  elements.sort((a, b) => a.z_index - b.z_index);

  const bgFill = cSld?.bg as Record<string, unknown> | undefined;
  const bgPr = bgFill?.bgPr as Record<string, unknown> | undefined;
  const bgColor = hexFromColor(
    bgPr?.solidFill as Parameters<typeof hexFromColor>[0]
  );

  return {
    slide: {
      width: slideSize.width,
      height: slideSize.height,
      background_color: bgColor ?? DEFAULT_SLIDE.background_color,
    },
    elements,
    source_type: "pptx",
    slide_index: idx,
    slide_count: slideCount,
  };
}

export async function getPptxSlideCount(pptxBuffer: Buffer): Promise<number> {
  const zip = await JSZip.loadAsync(pptxBuffer);
  const paths = await getSlidePaths(zip);
  return paths.length;
}
