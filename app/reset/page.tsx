"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    // The recovery link puts a session in the URL; supabase-js picks it up on load.
    const { error } = await createClient().auth.updateUser({ password });
    if (error) { setError(error.message); setBusy(false); return; }
    router.push("/patients");
    router.refresh();
  }

  const fieldCls = "field mt-1.5 w-full rounded-lg border border-[#E4E4E3] bg-white px-3 py-2.5 text-sm text-[#111110] placeholder:text-neutral-400";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F6] px-4">
      <div className="mb-10 flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-800 shadow-[0_4px_16px_rgba(0,0,0,0.18)]">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 4v16M4 12h16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-[22px] font-semibold tracking-tight text-[#111110]">MediTrace</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Set a new password</p>
        </div>
      </div>

      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-[#E4E4E3] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <h2 className="text-base font-semibold text-[#111110]">Choose a new password</h2>
          <p className="mt-1 text-xs text-neutral-500">Open this page from the reset link in your email.</p>

          <form onSubmit={handleSubmit} className="mt-5">
            <label className="block text-xs font-semibold uppercase tracking-[0.06em] text-neutral-400" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldCls}
              placeholder="••••••••"
            />

            {error && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn mt-5 w-full rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-40"
            >
              {busy ? "Saving..." : "Update password"}
            </button>
          </form>
        </div>

        <a href="/login" className="btn mt-4 block w-full text-center text-sm text-neutral-500 hover:text-neutral-800">
          Back to sign in
        </a>
      </div>
    </main>
  );
}
