# Editable Slide Converter

A local-first web app that converts uploaded slide images, PDFs, and PPTX files into **editable** PowerPoint presentations. Graphics are rebuilt as native PowerPoint shapes and text boxes—not as screenshot backgrounds.

## Features

- **Upload** PPTX, PDF, PNG, JPG, JPEG, or WEBP
- **PPTX input**: parse native shapes, text, lines, tables, and images via OOXML
- **Image/PDF input**: OpenAI Vision analyzes layout and returns structured JSON
- **Generate** editable PPTX with pptxgenjs (rectangles, rounded rects, ellipses, lines, arrows, text)
- **Manual correction**: edit text, positions, colors, shape types, layers
- **Diagnostics**: confidence scores, missing/extra text, alignment warnings

## Setup

```bash
cd editable-slide-converter
npm install
cp .env.example .env.local
# Edit .env.local and set OPENAI_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes (for image/PDF) | Server-side OpenAI key. Never exposed to the browser. |
| `OPENAI_MODEL` | No | Vision model (default: `gpt-4o`) |

PPTX-only conversion does not require OpenAI.

## How conversion works

### PPTX input (best quality)

1. JSZip opens the OOXML package.
2. Slide XML is parsed for shapes (`sp`), connectors (`cxnSp`), pictures (`pic`), and groups (`grpSp`).
3. Positions (EMU → inches), colors, fonts, and text are extracted.
4. A clean PPTX is rebuilt with pptxgenjs using editable objects.

Native PPTX preserves the most structure because shapes and text come from the source file—not from vision inference.

### Image / PDF input

1. PDF pages are rendered to PNG (pdfjs-dist + canvas).
2. Images are preprocessed with sharp (resize, normalize).
3. OpenAI Vision returns structured JSON: slide dimensions, shapes, text boxes, z-order, colors, confidence.
4. The reference image is **not** placed as a slide background.
5. pptxgenjs creates real PowerPoint shapes and text boxes from the JSON.

### Generation order

1. Background color
2. Shapes and lines (low `z_index` first)
3. Images (icons/photos only when shapes are insufficient)
4. Text boxes (highest layer)

## Project structure

```
app/
  page.tsx
  api/analyze-slide/route.ts
  api/generate-pptx/route.ts
lib/
  openai.ts          # Vision analysis
  pptx.ts            # pptxgenjs generation
  pptx-parser.ts     # OOXML PPTX parsing
  image-analysis.ts  # PDF render, image prep
  file-utils.ts      # Temp uploads & cleanup
  diagnostics.ts     # QC reports
components/          # UI panels
types/slide.ts       # Shared types
```

## Limitations

- **Vision-based conversion is approximate.** Flattened slides, subtle gradients, custom icons, and complex diagrams may not match pixel-perfectly.
- **No screenshot-background mode.** The app deliberately avoids placing the source image behind text.
- **PPTX parsing** covers common shape presets and text; exotic SmartArt, charts, and animations are not fully preserved.
- **PDF** quality depends on whether the PDF contains vector text vs. scanned pages.
- **Grouped shapes** are partially supported; deeply nested groups may flatten.
- **Fonts** may substitute to Arial in generated output.

## Why screenshot-to-editable-PPTX is approximate

Editable reconstruction infers *structure* (boxes, text regions, colors) from pixels or partial OOXML. A single flattened PNG hides whether a blue bar is one shape or three. Vision models estimate geometry and may misread small text or overlapping layers. The product prioritizes **editability** over pixel fidelity: you get movable text and shapes you can adjust in PowerPoint, not a perfect visual clone.

## Improving results

1. **Use source PPTX when possible** — native parsing preserves real object structure.
2. **Export Keynote to PPTX** before upload for better shape extraction.
3. **Use high-resolution images** with clear contrast and legible text.
4. **Manually correct** positions and text in the UI before generating.
5. **Review diagnostics** for low-confidence elements.

## Security

- `OPENAI_API_KEY` is only used in API routes (server-side).
- Uploads are stored temporarily under `tmp/uploads/` and deleted after analysis.
- Do not commit `.env.local`.

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```
