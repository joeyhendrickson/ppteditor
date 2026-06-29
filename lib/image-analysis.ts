import sharp from "sharp";
import { createCanvas } from "canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileAsBuffer } from "./file-utils";

const EMU_PER_INCH = 914400;
const DEFAULT_SLIDE_WIDTH_IN = 13.333;
const DEFAULT_SLIDE_HEIGHT_IN = 7.5;

export async function preprocessImage(
  input: Buffer,
  maxWidth = 1920
): Promise<{ buffer: Buffer; width: number; height: number; base64: string }> {
  const image = sharp(input);
  const meta = await image.metadata();
  let pipeline = image;

  if (meta.width && meta.width > maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }

  const buffer = await pipeline.png().toBuffer();
  const outMeta = await sharp(buffer).metadata();

  return {
    buffer,
    width: outMeta.width ?? maxWidth,
    height: outMeta.height ?? 1080,
    base64: `data:image/png;base64,${buffer.toString("base64")}`,
  };
}

export async function pdfPageToImage(
  pdfPath: string,
  pageIndex: number,
  scale = 2
): Promise<{ buffer: Buffer; base64: string; width: number; height: number }> {
  const data = await readFileAsBuffer(pdfPath);
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d");

  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
    // pdfjs types expect canvas property in newer versions
    canvas: canvas as unknown as HTMLCanvasElement,
  }).promise;

  const buffer = canvas.toBuffer("image/png");
  return {
    buffer,
    base64: `data:image/png;base64,${buffer.toString("base64")}`,
    width: viewport.width,
    height: viewport.height,
  };
}

export async function getPdfPageCount(pdfPath: string): Promise<number> {
  const data = await readFileAsBuffer(pdfPath);
  const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  return pdf.numPages;
}

/** Convert pixel coordinates to slide inches assuming slide fills image */
export function pixelsToSlideCoords(
  pxX: number,
  pxY: number,
  pxW: number,
  pxH: number,
  imgW: number,
  imgH: number,
  slideW = DEFAULT_SLIDE_WIDTH_IN,
  slideH = DEFAULT_SLIDE_HEIGHT_IN
): { x: number; y: number; width: number; height: number } {
  return {
    x: (pxX / imgW) * slideW,
    y: (pxY / imgH) * slideH,
    width: (pxW / imgW) * slideW,
    height: (pxH / imgH) * slideH,
  };
}

export function emuToInches(emu: number): number {
  return emu / EMU_PER_INCH;
}
