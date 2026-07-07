// Limitador en memoria por instancia de proceso. Suficiente para un solo servidor Next.js (el caso
// actual); si en el futuro se despliega en múltiples instancias/serverless, esto necesita moverse a
// un store compartido (Redis/Upstash) porque cada instancia tendría su propio conteo independiente.
const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}

export async function getClientIp(): Promise<string> {
  const { headers } = await import("next/headers");
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return headerList.get("x-real-ip") ?? "unknown";
}
