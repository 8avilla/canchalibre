import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Convención Next 16: `middleware.ts` está deprecado a favor de `proxy.ts` (ver
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
export default auth((request) => {
  const staffMatch = request.nextUrl.pathname.match(/^\/([^/]+)\/(pos|admin)(\/|$)/);
  if (!staffMatch) {
    return NextResponse.next();
  }

  const [, orgSlugInUrl, section] = staffMatch;
  const session = request.auth;

  if (!session?.user) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.user.orgSlug !== orgSlugInUrl) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  }

  if (section === "admin" && session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL(`/${orgSlugInUrl}/pos`, request.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/:org/pos/:path*", "/:org/admin/:path*"],
};
