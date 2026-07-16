import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/db";

// Full patient record export (§5.5). RLS scopes every read to the owner, so a
// user can only ever export their own patient. Returns a JSON attachment.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: encounters }, { data: diagnoses }] = await Promise.all([
    supabase
      .from("encounters")
      .select("*, complaints(*), prescriptions(*), investigations(*, findings(*))")
      .eq("patient_id", id)
      .order("date"),
    supabase
      .from("diagnoses")
      .select("*, qa_history(*)")
      .eq("patient_id", id)
      .order("created_at"),
  ]);

  await logAudit(supabase, user.id, "export", "patient", id);

  const payload = {
    exported_at: new Date().toISOString(),
    patient,
    encounters: encounters ?? [],
    diagnoses: diagnoses ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="meditrace-${id}.json"`,
    },
  });
}
