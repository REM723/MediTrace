"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const supabase = createClient();

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset`,
      });
      setBusy(false);
      if (error) { setError(error.message); return; }
      setNotice("If that email has an account, a reset link is on its way. Check your inbox.");
      return;
    }

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setBusy(false); return; }
      router.push("/patients");
      router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setBusy(false); return; }
      if (data.session) {
        router.push("/patients");
        router.refresh();
      } else {
        setNotice("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
        setBusy(false);
      }
    }
  }

  const fieldCls = "field mt-1.5 w-full rounded-lg border border-[#E4E4E3] bg-white px-3 py-2.5 text-sm text-[#111110] placeholder:text-neutral-400";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F6] px-4">
      {/* Brand */}
      <div className="mb-10 flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-800 shadow-[0_4px_16px_rgba(0,0,0,0.18)]">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 3.5V20.5" stroke="white" strokeWidth="2.4" strokeLinecap="round"/>
            <path d="M3.5 12H8.5L10.5 8.5L13 15.5L15 12H20.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-[22px] font-semibold tracking-tight text-[#111110]">MediTrace</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Clinical timelines and diagnostic support</p>
        </div>
      </div>

      {/* Decorative EKG line */}
      <svg width="220" height="32" viewBox="0 0 220 32" fill="none" className="mb-8 text-neutral-200" aria-hidden>
        <path
          d="M0 16 H80 L89 4 L98 28 L107 9 L116 23 L125 16 H220"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Auth card */}
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-[#E4E4E3] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <h2 className="text-base font-semibold text-[#111110]">
            {mode === "signin" ? "Sign in to your account" : mode === "signup" ? "Create an account" : "Reset your password"}
          </h2>
          {mode === "forgot" && (
            <p className="mt-1 text-xs text-neutral-500">Enter your email and we will send a link to set a new password.</p>
          )}

          <form onSubmit={handleSubmit} className="mt-5">
            <label className="block text-xs font-semibold uppercase tracking-[0.06em] text-neutral-400" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldCls}
              placeholder="you@example.com"
            />

            {mode !== "forgot" && (
              <>
                <div className="mt-4 flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-[0.06em] text-neutral-400" htmlFor="password">
                    Password
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setError(null); setNotice(null); }}
                      className="btn text-xs font-medium text-blue-700 hover:text-blue-900"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={fieldCls}
                  placeholder="••••••••"
                />
              </>
            )}

            {error && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}
            {notice && (
              <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn mt-5 w-full rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-40"
            >
              {busy ? "Working..." : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </button>
          </form>
        </div>

        <button
          type="button"
          onClick={() => { setMode(mode === "signup" ? "signin" : mode === "signin" ? "signup" : "signin"); setError(null); setNotice(null); }}
          className="btn mt-4 w-full text-center text-sm text-neutral-500 hover:text-neutral-800"
        >
          {mode === "signin" ? "No account? Create one" : mode === "signup" ? "Already registered? Sign in" : "Back to sign in"}
        </button>

        <a href="/admin" className="mt-6 block text-center text-xs text-neutral-400 hover:text-neutral-600">
          Admin portal
        </a>
      </div>
    </main>
  );
}
