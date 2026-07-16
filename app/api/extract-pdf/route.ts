import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractPdfText, ocrPdfText, parseFindings } from "@/lib/extract";

// OCR (model download + rasterize + recognize) can be slow on cold starts.
export const maxDuration = 60;

// Runs as the logged-in user (RLS-scoped client), so it can only ever touch
// that user's investigations and files. No service key involved.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { investigationId } = (await req.json()) as { investigationId?: string };
  if (!investigationId) {
    return NextResponse.json({ error: "investigationId required" }, { status: 400 });
  }

  const { data: inv } = await supabase
    .from("investigations")
    .select("id, pdf_path")
    .eq("id", investigationId)
    .maybeSingle();
  if (!inv?.pdf_path) {
    return NextResponse.json({ error: "Investigation or PDF not found" }, { status: 404 });
  }

  try {
    // Transient download/OCR-worker flakes get one retry (NFR-3); a genuinely
    // unreadable PDF fails both attempts and is marked failed in the catch.
    let findings: ReturnType<typeof parseFindings> | undefined;
    let usedOcr = false;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { data: blob, error: dlErr } = await supabase.storage
          .from("reports")
          .download(inv.pdf_path);
        if (dlErr || !blob) throw dlErr ?? new Error("Download failed");
        const buffer = Buffer.from(await blob.arrayBuffer());

        let text = await extractPdfText(buffer);
        usedOcr = false;
        // Near-empty text layer means a scanned PDF: fall back to OCR.
        if (text.replace(/\s/g, "").length < 40) {
          text = await ocrPdfText(buffer);
          usedOcr = true;
        }
        findings = parseFindings(text);
        lastErr = undefined;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (lastErr || !findings) throw lastErr ?? new Error("Extraction produced nothing");

    // Replace previous auto-extracted rows, never rows the user confirmed.
    await supabase
      .from("findings")
      .delete()
      .eq("investigation_id", investigationId)
      .eq("confirmed_by_user", false);
    if (findings.length > 0) {
      const { error: insErr } = await supabase.from("findings").insert(
        findings.map((f) => ({
          investigation_id: investigationId,
          ...f,
          confirmed_by_user: false, // safety rule: physician must confirm
        }))
      );
      if (insErr) throw insErr;
    }

    await supabase
      .from("investigations")
      .update({ extraction_status: findings.length > 0 ? "extracted" : "failed" })
      .eq("id", investigationId);

    return NextResponse.json({ count: findings.length, usedOcr });
  } catch (err) {
    await supabase
      .from("investigations")
      .update({ extraction_status: "failed" })
      .eq("id", investigationId);
    console.error("extract-pdf failed:", err);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
