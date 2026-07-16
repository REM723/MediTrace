import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import ThemeToggle from "@/components/ThemeToggle";

export default async function PatientsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-13 items-center justify-between border-b border-[#E4E4E3] bg-white px-5">
        <Link href="/patients" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-blue-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 4v16M4 12h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight text-[#111110]">MediTrace</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-neutral-400 sm:block">{user?.email}</span>
          <Link href="/patients/guide" className="btn hidden text-xs text-neutral-400 hover:text-neutral-700 sm:block">
            Guide
          </Link>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
