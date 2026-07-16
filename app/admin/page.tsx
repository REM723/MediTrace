import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { adminLogin, adminLogout } from "./actions";

export const dynamic = "force-dynamic";

type SP = Promise<{ error?: string }>;

export default async function AdminPage({ searchParams }: { searchParams: SP }) {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  const expected = process.env.ADMIN_PASSWORD;
  const isAuth = !!expected && session === expected;

  if (!isAuth) {
    const { error } = await searchParams;
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F6] p-4">
        <div className="w-full max-w-sm rounded-2xl border border-[#E4E4E3] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" className="h-5 w-5">
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">MediTrace</p>
              <h1 className="text-base font-semibold text-[#111110]">Admin panel</h1>
            </div>
          </div>

          {error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              Incorrect password.
            </p>
          )}

          <form action={adminLogin}>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              autoFocus
              className="field mt-1.5 w-full rounded-lg border border-[#E4E4E3] bg-white px-3 py-2 text-sm text-[#111110]"
            />
            <button
              type="submit"
              className="btn mt-4 w-full rounded-xl bg-blue-800 py-2.5 text-sm font-medium text-white hover:bg-blue-900"
            >
              Sign in
            </button>
          </form>

          <a href="/login" className="mt-5 block text-center text-xs text-neutral-400 hover:text-neutral-600">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const [
    { count: patientCount, error: e1 },
    { count: diagCount },
    { count: auditCount },
    { data: patients },
    { data: logs },
    { data: userList },
  ] = await Promise.all([
    db.from("patients").select("*", { count: "exact", head: true }),
    db.from("diagnoses").select("*", { count: "exact", head: true }),
    db.from("audit_log").select("*", { count: "exact", head: true }),
    db.from("patients")
      .select("id, name, owner_id, dob_or_age, sex, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("audit_log").select("*").order("at", { ascending: false }).limit(30),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const users = userList?.users ?? [];
  const emailById = new Map(users.map((u) => [u.id, u.email ?? "-"]));

  const stats = [
    {
      label: "Registered users",
      value: users.length,
      tint: "bg-blue-50 text-blue-700",
      icon: <path fillRule="evenodd" d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 0 0-11.215 0c-.22.578.254 1.139.872 1.139h9.47Z" clipRule="evenodd" />,
    },
    {
      label: "Total patients",
      value: patientCount ?? 0,
      tint: "bg-emerald-50 text-emerald-700",
      icon: <path fillRule="evenodd" d="M8 1.5A2.5 2.5 0 0 0 5.5 4v.5H5A2.5 2.5 0 0 0 2.5 7v5A2.5 2.5 0 0 0 5 14.5h6a2.5 2.5 0 0 0 2.5-2.5V7A2.5 2.5 0 0 0 11 4.5h-.5V4A2.5 2.5 0 0 0 8 1.5Zm.75 6.25a.75.75 0 0 0-1.5 0v1h-1a.75.75 0 0 0 0 1.5h1v1a.75.75 0 0 0 1.5 0v-1h1a.75.75 0 0 0 0-1.5h-1v-1Z" clipRule="evenodd" />,
    },
    {
      label: "Total diagnoses",
      value: diagCount ?? 0,
      tint: "bg-violet-50 text-violet-700",
      icon: <path d="M8 1a5 5 0 0 0-3 9v1.5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V10a5 5 0 0 0-3-9ZM6 14.5a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5A.75.75 0 0 1 6 14.5Z" />,
    },
    {
      label: "Audit events",
      value: auditCount ?? 0,
      tint: "bg-amber-50 text-amber-700",
      icon: <path fillRule="evenodd" d="M2.5 3A1.5 1.5 0 0 1 4 1.5h8A1.5 1.5 0 0 1 13.5 3v10A1.5 1.5 0 0 1 12 14.5H4A1.5 1.5 0 0 1 2.5 13V3Zm3 2.25a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Zm0 3a.75.75 0 0 0 0 1.5h2a.75.75 0 0 0 0-1.5h-2Z" clipRule="evenodd" />,
    },
  ];

  const avatarColors = ["bg-blue-800", "bg-emerald-700", "bg-violet-700", "bg-amber-600", "bg-rose-600", "bg-cyan-700"];
  const avatar = (seed: string) => avatarColors[seed.charCodeAt(0) % avatarColors.length];
  const initials = (s: string) => s.trim().slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#F7F7F6]">
      <header className="border-b border-[#E4E4E3] bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" className="h-4 w-4">
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">MediTrace</p>
              <h1 className="text-sm font-semibold text-[#111110]">Admin panel</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/login" className="btn rounded-lg border border-[#E4E4E3] bg-white px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50">
              Back to login
            </a>
            <form action={adminLogout}>
              <button type="submit" className="btn rounded-lg border border-[#E4E4E3] bg-white px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Hero banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-800 via-blue-700 to-blue-900">
        <svg className="absolute inset-0 h-full w-full text-white/10" preserveAspectRatio="none" viewBox="0 0 800 160" fill="none" aria-hidden>
          <path d="M0 100 H180 L200 60 L224 132 L248 40 L272 110 L300 100 H520 L540 60 L564 132 L588 40 L612 110 L640 100 H800" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="relative mx-auto max-w-5xl px-6 py-10">
          <h2 className="text-2xl font-semibold text-white">Overview</h2>
          <p className="mt-1 text-sm text-blue-100">Live activity across every account on this instance.</p>
        </div>
      </div>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        {e1 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Service role key may be invalid. Queries returned errors. Check{" "}
            <code className="rounded bg-red-100 px-1 text-xs">SUPABASE_SERVICE_ROLE_KEY</code> in{" "}
            <code className="rounded bg-red-100 px-1 text-xs">.env.local</code>.
          </div>
        )}

        <div className="grid grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-[#E4E4E3] bg-white p-5 transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.tint}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-5 w-5">{s.icon}</svg>
              </span>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">{s.label}</p>
              <p className="mt-0.5 text-3xl font-semibold tabular-nums text-[#111110]">{s.value}</p>
            </div>
          ))}
        </div>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-neutral-400">Registered users</h2>
          <div className="overflow-hidden rounded-xl border border-[#E4E4E3] bg-white">
            {users.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F0F0EF] bg-[#FAFAFA]">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Email</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Confirmed</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Last sign in</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id} className={i % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"}>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2.5">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatar(u.email ?? "?")}`}>
                            {initials(u.email ?? "?")}
                          </span>
                          <span className="font-medium text-[#111110]">{u.email ?? "-"}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {u.email_confirmed_at ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Confirmed</span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-500">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "Never"}</td>
                      <td className="px-4 py-2.5 text-neutral-500">{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-6 text-sm text-neutral-400">No users yet.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-neutral-400">All patients</h2>
          <div className="overflow-hidden rounded-xl border border-[#E4E4E3] bg-white">
            {patients && patients.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F0F0EF] bg-[#FAFAFA]">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Name</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Age/DOB</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Sex</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Owner</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p, i) => (
                    <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"}>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2.5">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatar(p.name as string)}`}>
                            {initials(p.name as string)}
                          </span>
                          <span className="font-medium text-[#111110]">{p.name}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-neutral-500">{p.dob_or_age ?? "-"}</td>
                      <td className="px-4 py-2.5 text-neutral-500">{p.sex ?? "-"}</td>
                      <td className="px-4 py-2.5 text-neutral-500">{emailById.get(p.owner_id as string) ?? "-"}</td>
                      <td className="px-4 py-2.5 text-neutral-500">{new Date(p.created_at as string).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-6 text-sm text-neutral-400">No patients yet.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-neutral-400">Recent audit log</h2>
          <div className="overflow-hidden rounded-xl border border-[#E4E4E3] bg-white">
            {logs && logs.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F0F0EF] bg-[#FAFAFA]">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">When</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Actor</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Action</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l, i) => (
                    <tr key={l.id} className={i % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"}>
                      <td className="px-4 py-2.5 text-neutral-500">{new Date(l.at as string).toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-neutral-400">{(l.actor_id as string).slice(0, 8)}...</td>
                      <td className="px-4 py-2.5 text-[#111110]">{l.action}</td>
                      <td className="px-4 py-2.5 text-neutral-500">{l.entity}{l.entity_id ? ` (${(l.entity_id as string).slice(0, 8)}...)` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-6 text-sm text-neutral-400">No audit events yet.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
