"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function adminLogin(fd: FormData) {
  const pw = fd.get("password") as string;
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || pw !== expected) redirect("/admin?error=1");
  (await cookies()).set("admin_session", expected, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  redirect("/admin");
}

export async function adminLogout() {
  (await cookies()).delete("admin_session");
  redirect("/admin");
}
