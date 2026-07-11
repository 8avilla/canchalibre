import { db } from "@/lib/db";

// Registro de auditoría de acciones sensibles (negocio.md: blindar contra fugas/fraude). No lanza
// si falla — un error de auditoría no debe tumbar la acción real que ya se aplicó.
export async function logAdminAction(params: {
  orgId: string;
  actorUserId: string;
  actorName: string;
  action: string;
  summary: string;
}): Promise<void> {
  try {
    await db.auditLog.create({ data: params });
  } catch (error) {
    console.error("[audit] error registrando acción", error);
  }
}
