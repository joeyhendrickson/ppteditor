import OpenAI from "openai";
import type { SlideAnalysis } from "@/types/slide";
import { DEFAULT_SLIDE } from "@/types/slide";

import OpenAI from "openai";
import type { SlideAnalysis, SlideElement } from "@/types/slide";
import { DEFAULT_SLIDE } from "@/types/slide";

const SYSTEM_PROMPT = `You analyze presentation slides and return structured JSON to rebuild them as editable PowerPoint objects.

CRITICAL RULES:
- Do NOT suggest using the slide image as a background.
- Recreate graphics as editable shapes (rectangles, rounded rectangles, ellipses, lines, arrows).
- Place large colored background shapes BEHIND text (lower z_index).
- Add text boxes as separate editable text elements (higher z_index).
- Use inches for coordinates on a 13.333 x 7.5 inch widescreen slide.
- Origin (0,0) is top-left.
- Include approximate hex colors (#RRGGBB).
- Only include text that is visibly present — do not invent words.
- Only include graphics you can reasonably represent as shapes — use imagePlaceholder only for photos, logos, or complex icons.
- Assign confidence 0.0-1.0 per element (lower when uncertain).
- Use z_index for layer order (1 = back, higher = front).
- For tables/timelines, use multiple rect/line/arrow shapes plus text boxes.

Return JSON with this structure:
{
  "slide": { "width": 13.333, "height": 7.5, "background_color": "#FFFFFF" },
  "elements": [
    {
      "id": "element_001",
      "type": "shape",
      "shape": "rect",
      "x": 0.5, "y": 1.2, "width": 2.5, "height": 0.6,
      "fill_color": "#003A70", "line_color": "#003A70", "line_width": 1,
      "opacity": 1, "rotation": 0, "z_index": 1, "confidence": 0.9
    },
    {
      "id": "element_002",
      "type": "text",
      "text": "TITLE",
      "x": 2.4, "y": 0.2, "width": 8.5, "height": 0.4,
      "font_family": "Arial", "font_size": 24, "bold": true, "italic": false,
      "color": "#002855", "alignment": "center", "z_index": 10, "confidence": 0.85
    }
  ]
}`;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey });
}

export async function analyzeSlideImage(
  imageBase64: string
): Promise<SlideAnalysis> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this slide image. Return editable shape and text elements to reconstruct the slide without using the image as a background.",
          },
          {
            type: "image_url",
            image_url: { url: imageBase64, detail: "high" },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  const parsed = JSON.parse(content) as SlideAnalysis;
  return normalizeAnalysis(parsed);
}

function normalizeAnalysis(analysis: SlideAnalysis): SlideAnalysis {
  const slide = {
    ...DEFAULT_SLIDE,
    ...analysis.slide,
  };

  const elements = analysis.elements.map((el, i) => ({
    ...el,
    id: el.id || `element_${String(i + 1).padStart(3, "0")}`,
    visible: true,
    confidence: el.confidence ?? 0.75,
  })) as SlideElement[];

  return {
    slide,
    elements,
    source_type: "vision",
  };
}
