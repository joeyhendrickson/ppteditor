import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const TMP_ROOT = path.join(os.tmpdir(), "ppteditor-uploads");

export type SupportedExtension =
  | ".pptx"
  | ".pdf"
  | ".png"
  | ".jpg"
  | ".jpeg"
  | ".webp";

const SUPPORTED: SupportedExtension[] = [
  ".pptx",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
];

export function getExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

export function isSupportedFile(filename: string): boolean {
  return SUPPORTED.includes(getExtension(filename) as SupportedExtension);
}

export function getFileCategory(filename: string): "pptx" | "pdf" | "image" {
  const ext = getExtension(filename);
  if (ext === ".pptx") return "pptx";
  if (ext === ".pdf") return "pdf";
  return "image";
}

export async function ensureTmpDir(): Promise<string> {
  const sessionId = uuidv4();
  const dir = path.join(TMP_ROOT, sessionId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function writeTempFile(
  dir: string,
  filename: string,
  data: Buffer
): Promise<string> {
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, data);
  return filePath;
}

export async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

export async function readFileAsBuffer(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}

export function bufferToBase64(buffer: Buffer, mime = "image/png"): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export async function fileToBase64(
  filePath: string,
  mime?: string
): Promise<string> {
  const buf = await readFileAsBuffer(filePath);
  const ext = getExtension(filePath);
  const defaultMime =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : ext === ".png"
          ? "image/png"
          : "application/octet-stream";
  return bufferToBase64(buf, mime ?? defaultMime);
}
