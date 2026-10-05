import { NextResponse, type NextRequest } from "next/server";

const protectedPath = /^\/(graph|dashboard|account|outage|challenge)(\/|$)/;

export default function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get("sg_session")?.value);
  const { pathname } = request.nextUrl;
  if ((pathname === "/login" || pathname === "/register") && hasSession) {
    return NextResponse.redirect(new URL("/graph", request.nextUrl));
  }
  if (!hasSession && protectedPath.test(pathname)) {
    const url = new URL("/login", request.nextUrl);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/graph",
    "/graph/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/account",
    "/account/:path*",
    "/outage",
    "/outage/:path*",
    "/challenge/:path*",
    "/login",
    "/register",
  ],
};
