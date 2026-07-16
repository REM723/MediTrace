"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { errMsg } from "@/lib/db";
import FindingsEditor from "./FindingsEditor";
import type { Investigation } from "@/lib/types";

export default function InvestigationUpload({ investigation }: { investigation: Investigation }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const inv = investigation;
  const confirmed = inv.findings.filter((f) => f.confirmed_by_user).length;
  const unconfirmed = inv.findings.length - confirmed;

  async function handleUpload(file: File) {
    setError(null);
    setBusy("Uploading");
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const path = `${user.id}/${inv.id}.pdf`;
      const { error: upErr } = await supabase.storage.from("reports").upload(path, file, { upsert: true, contentType: "application/pdf" });
      if (upErr) throw upErr;
      const { error: updErr } = await supabase.from("investigations").update({ pdf_path: path, extraction_status: "pending" }).eq("id", inv.id);
      if (updErr) throw updErr;
      setBusy("Extracting");
      const res = await fetch("/api/extract-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investigationId: inv.id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Extraction failed");
      }
      setReviewing(true);
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleView() {
    if (!inv.pdf_path) return;
    setError(null);
    const { data, error } = await createClient().storage.from("reports").createSignedUrl(inv.pdf_path, 300);
    if (error || !data) { setError(errMsg(error)); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const pillBtn = "btn rounded-lg border border-[#E4E4E3] bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600 hover:bg-[#F7F7F6] hover:text-[#111110] disabled:opacity-40";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
        />
        <button className={pillBtn} disabled={busy !== null} onClick={() => fileRef.current?.click()}>
          {busy ?? (inv.pdf_path ? "Replace PDF" : "Upload report PDF")}
        </button>
        {inv.pdf_path && (
          <button className={pillBtn} onClick={handleView}>View PDF</button>
        )}
        {inv.findings.length > 0 && (
          <button className={pillBtn} onClick={() => setReviewing(!reviewing)}>
            {reviewing ? "Hide findings" : `Review findings (${inv.findings.length})`}
          </button>
        )}
        {inv.extraction_status === "failed" && inv.findings.length === 0 && (
          <button className={pillBtn} onClick={() => setReviewing(!reviewing)}>
            {reviewing ? "Hide" : "Add findings"}
          </button>
        )}
        {inv.extraction_status === "failed" && (
          <span className="text-[11px] text-red-600">Extraction failed. Add findings manually.</span>
        )}
      </div>

      {unconfirmed > 0 && (
        <p className="mt-1.5 text-[11px] text-amber-700">
          {unconfirmed} extracted finding{unconfirmed === 1 ? "" : "s"} awaiting review. Not used for diagnosis until confirmed.
        </p>
      )}
      {inv.findings.length > 0 && unconfirmed === 0 && (
        <p className="mt-1.5 text-[11px] text-green-700">{confirmed} finding{confirmed === 1 ? "" : "s"} confirmed.</p>
      )}
      {error && <p className="mt-1.5 text-[11px] text-red-600">{error}</p>}

      {reviewing && (
        <div className="mt-3">
          <FindingsEditor investigationId={inv.id} initial={inv.findings} onDone={() => setReviewing(false)} />
        </div>
      )}
    </div>
  );
}
