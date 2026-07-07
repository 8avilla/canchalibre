import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDaySlots, parseDateParam } from "@/lib/booking/availability";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ org: string; venueId: string }> },
): Promise<Response> {
  const { org: orgSlug, venueId } = await params;
  const { searchParams } = new URL(request.url);

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  }

  const venue = await db.venue.findUnique({ where: { id: venueId } });
  if (!venue || venue.orgId !== organization.id) {
    return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  }

  const dateIso = parseDateParam(searchParams.get("date") ?? undefined);
  const slots = await getDaySlots(venue.id, dateIso);

  return NextResponse.json({ slots });
}
