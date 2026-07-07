import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function requireStaffSession(orgSlug: string) {
  const session = await auth();
  if (!session?.user || session.user.orgSlug !== orgSlug) {
    redirect("/login");
  }
  return session;
}

export async function requireAdminSession(orgSlug: string) {
  const session = await requireStaffSession(orgSlug);
  if (session.user.role !== "ADMIN") {
    notFound();
  }
  return session;
}
