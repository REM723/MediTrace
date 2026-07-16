// PDF -> text -> structured findings. Server-side only (heavy imports).
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export type ParsedFinding = {
  key: string;
  value: string | null;
  unit: string | null;
  abnormal_flag: boolean | null;
  impression_text: string | null;
};

async function loadPdf(buffer: Buffer) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdfjs needs its bundled base-14 font data to lay out and render text.
  const require = createRequire(import.meta.url);
  const fontDir = join(dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts");
  return getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: fontDir + "/",
  }).promise;
}

// Text-layer extraction, grouping runs into lines by their y coordinate.
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const doc = await loadPdf(buffer);
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5] as number;
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        text += line.join(" ") + "\n";
        line = [];
      }
      line.push(item.str);
      lastY = y;
    }
    text += line.join(" ") + "\n";
  }
  return text;
}

// OCR fallback for scanned PDFs: rasterize pages, run Tesseract.
// ponytail: first 5 pages only, keeps serverless runtime bounded; raise if
// real reports run longer.
export async function ocrPdfText(buffer: Buffer): Promise<string> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const { createWorker } = await import("tesseract.js");
  const doc = await loadPdf(buffer);
  const worker = await createWorker("eng", 1, { cachePath: tmpdir() });
  try {
    let text = "";
    for (let i = 1; i <= Math.min(doc.numPages, 5); i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(viewport.width, viewport.height);
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        viewport,
      }).promise;
      const { data } = await worker.recognize(canvas.toBuffer("image/png"));
      text += data.text + "\n";
    }
    return text;
  } finally {
    await worker.terminate();
  }
}

// Heuristic lab-report parser: "Hemoglobin: 9.8 g/dL Low" style lines plus an
// impression paragraph. Deliberately loose; the physician reviews and edits
// every row in FindingsEditor before anything is trusted.
// ponytail: regex heuristic; upgrade path is LLM-structured extraction if
// real-world reports parse too poorly.
const VALUE_LINE =
  /^([A-Za-z][A-Za-z0-9 %/().'-]{1,60}?)\s*[:\-]?\s+(\d[\d,]*(?:\.\d+)?)\s*([A-Za-zµ%][A-Za-zµ%/^0-9.]*)?\s*(.*)$/;
const NOISE_KEY =
  /\b(page|date|time|phone|tel|fax|reg|uhid|mrn|id no|report|patient|name|age|sex|gender|address|doctor|dr|lab|collected|received)\b/i;
const ABNORMAL = /\b(high|low|abnormal|positive|critical|elevated|reduced)\b|\s[HL]\*?$/i;

export function parseFindings(text: string): ParsedFinding[] {
  const findings: ParsedFinding[] = [];

  for (const raw of text.split(/\r?\n/)) {
    if (findings.length >= 40) break;
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(VALUE_LINE);
    if (!m || NOISE_KEY.test(m[1])) continue;
    findings.push({
      key: m[1].trim(),
      value: m[2],
      unit: m[3]?.trim() || null,
      abnormal_flag: ABNORMAL.test(line) ? true : null,
      impression_text: null,
    });
  }

  const imp = text.match(
    /(?:impression|conclusion|opinion)\s*[:\-]?\s*([\s\S]{1,600}?)(?:\n\s*\n|$)/i
  );
  if (imp) {
    findings.push({
      key: "Impression",
      value: null,
      unit: null,
      abnormal_flag: null,
      impression_text: imp[1].replace(/\s+/g, " ").trim(),
    });
  }

  return findings;
}
