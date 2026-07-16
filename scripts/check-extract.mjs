// Extraction pipeline check: builds a minimal lab-report PDF in memory, then
// asserts text extraction, findings parsing, and the OCR fallback all work.
// Also writes sample-report.pdf for manual upload testing in the UI.
// Usage: node scripts/check-extract.mjs   (OCR downloads ~11MB on first run)
import assert from "node:assert";
import { writeFileSync } from "node:fs";
import { extractPdfText, ocrPdfText, parseFindings } from "../lib/extract.ts";

function buildPdf(lines) {
  const esc = (s) => s.replace(/[\\()]/g, (c) => "\\" + c);
  let content = "BT /F1 12 Tf 50 760 Td 18 TL\n";
  for (const line of lines) content += `(${esc(line)}) Tj T*\n`;
  content += "ET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  for (const [i, o] of objs.entries()) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += off.toString().padStart(10, "0") + " 00000 n \n";
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

const pdf = buildPdf([
  "COLONOSCOPY AND BIOPSY REPORT",
  "Patient: Test Patient   Age: 46",
  "Hemoglobin: 9.8 g/dL Low",
  "WBC Count: 11200 /cumm High",
  "Platelet Count: 210000 /cumm",
  "Impression: Multiple superficial ulcers in the sigmoid colon.",
]);
writeFileSync(new URL("../sample-report.pdf", import.meta.url), pdf);

// 1. Text layer extraction
const text = await extractPdfText(pdf);
assert.match(text, /Hemoglobin/, "text extraction should find Hemoglobin");

// 2. Findings parser
const findings = parseFindings(text);
const hb = findings.find((f) => /hemoglobin/i.test(f.key));
assert.ok(hb, "parser should produce a Hemoglobin row");
assert.equal(hb.value, "9.8");
assert.equal(hb.abnormal_flag, true, "Low marker should flag abnormal");
const plt = findings.find((f) => /platelet/i.test(f.key));
assert.ok(plt && plt.abnormal_flag === null, "unmarked value stays unflagged");
assert.ok(
  !findings.some((f) => /patient|age/i.test(f.key)),
  "noise lines must be skipped"
);
const imp = findings.find((f) => f.impression_text !== null);
assert.ok(imp && /sigmoid/i.test(imp.impression_text), "impression captured");

// 3. OCR fallback (rasterize + Tesseract on the same PDF)
console.log("running OCR fallback check (first run downloads eng model)...");
const ocrText = await ocrPdfText(pdf);
assert.match(ocrText, /h[ae]moglobin/i, "OCR should read Hemoglobin");

console.log(`PASS: text extraction, parser (${findings.length} findings), OCR`);
