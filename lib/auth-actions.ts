"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

export async function loginAction(formData: FormData): Promise<void> {
  const callbackUrl = String(formData.get("callbackUrl") || "/");

  const ip = await getClientIp();
  if (!checkRateLimit(`login:${ip}`, 5, 5 * 60_000)) {
    redirect(`/login?error=demasiados_intentos&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=credenciales_invalidas&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    throw error;
  }
}
